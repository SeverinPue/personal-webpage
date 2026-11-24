import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import * as QRCode from 'qrcode';
import { MisterXNetworkService } from './mister-x-network.service';

if (typeof window !== 'undefined') {
  (window as any).L = L;
  try {
    require('leaflet-rotate');
  } catch (e) {}
}
import { MisterXAudioService } from './mister-x-audio.service';
import {
  Player,
  Role,
  GameStatus,
  GameSettings,
  PingRecord,
  GameEventMessage,
  TacticalTool,
  TacticalAnnotation,
  TacticalAnnotationType,
  TacticalEventMessage
} from './mister-x.types';

@Component({
  selector: 'app-mister-x',
  templateUrl: './mister-x.component.html',
  styleUrls: ['./mister-x.component.scss']
})
export class MisterXComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild('lobbyMapContainer', { static: false }) lobbyMapContainer!: ElementRef;

  // View state
  public viewState: 'JOIN_SCREEN' | 'LOBBY' | 'GAME' = 'JOIN_SCREEN';
  public gameStatus: GameStatus = 'LOBBY';

  // Current user info
  public playerName = '';
  public playerId = '';
  public isHost = false;
  public myRole: Role = 'UNASSIGNED';
  public myPlayer: Player | null = null;
  public roomCode = '';

  // Other players in room
  public players: Player[] = [];

  // Game Settings (configured by Host)
  public settings: GameSettings = {
    centerLat: 47.3769, // Default Zurich or user GPS
    centerLng: 8.5417,
    radiusMeters: 800,
    pingIntervalSeconds: 180, // 3 Minutes default
    catchRadiusMeters: 10,
    misterXPlayerId: '',
    gameDurationMinutes: 45
  };

  // Ping tracking
  public pings: PingRecord[] = [];
  public lastPing: PingRecord | null = null;
  public nextPingInSeconds = 180;
  private pingTimerInterval: any = null;
  public nextPingTimestamp = 0;

  // Catch detection
  public distanceToMisterX: number | null = null;
  public canCatchMisterX = false;
  public misterXCaughtBy = '';
  public showCatchModal = false;
  public catchModalDismissed = false;
  public showRoleRevealModal = false;
  public mapBearing = 0;
  private wakeLockSentinel: any = null;

  // Real-life GPS
  public gpsActive = false;
  public gpsAccuracy: number | null = null;
  public isOutOfBounds = false;
  public currentLat: number | null = null;
  public currentLng: number | null = null;
  private watchPositionId: number | null = null;
  private lastPosBroadcastTime = 0;
  private locationHeartbeatInterval: any = null;

  // Simulator / Test Mode
  public centerManuallySet = false;
  public simulationMode = false;
  public showSimControls = false;

  // UI state
  public showQrModal = false;
  public showAbortModal = false;
  public qrCodeDataUrl = '';
  public copySuccess = false;
  public showPingHistory = false;
  public showPlayerListDrawer = false;
  public soundMuted = false;
  public notificationText = '';
  private notificationTimer: any = null;
  public connectionError = '';
  public connecting = false;

  // Detective Tactical Drawing Board (Detective-only!)
  public tacticalBarOpen = false;
  public activeTacticalTool: TacticalTool = 'NONE';
  public tacticalAnnotations: TacticalAnnotation[] = [];
  private tacticalLayers = new Map<string, L.Layer[]>();
  private tacticalArrowUpdaters: Array<() => void> = [];
  private isDrawingTactical = false;
  private currentStrokePoints: [number, number][] = [];
  private previewHaloLine: L.Polyline | null = null;
  private previewCoreLine: L.Polyline | null = null;
  private previewArrowHead: L.Marker | null = null;
  private arrowPendingStart: [number, number] | null = null;
  private arrowPendingMarker: L.Marker | null = null;
  private zoneStartLatLng: L.LatLng | null = null;
  private currentZoneRadius = 75;
  private zoneDragged = false;
  private previewZoneHalo: L.Circle | null = null;
  private previewZoneCircle: L.Circle | null = null;

  // Leaflet maps & layers
  private gameMap: L.Map | null = null;
  private lobbyMap: L.Map | null = null;
  private boundaryCircle: L.Circle | null = null;
  private lobbyBoundaryCircle: L.Circle | null = null;
  private lobbyCenterMarker: L.Marker | null = null;
  private playerMarkers = new Map<string, L.Marker>();
  private pingMarkers: L.Marker[] = [];
  private pingTrailPolyline: L.Polyline | null = null;

  // Subscriptions
  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private network: MisterXNetworkService,
    public audio: MisterXAudioService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Generate or restore persistent Player ID
    let storedId = localStorage.getItem('mx_player_id');
    if (!storedId) {
      storedId = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('mx_player_id', storedId);
    }
    this.playerId = storedId;

    // Restore Player Name
    const storedName = localStorage.getItem('mx_player_name');
    if (storedName) {
      this.playerName = storedName;
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);

    // Handle query params & session restoration
    this.subs.push(
      this.route.queryParams.subscribe(params => {
        const urlRoom = params['room'] ? params['room'].toUpperCase().trim() : '';

        // If we are currently connecting or already in LOBBY/GAME for this room, do NOT re-run!
        if (this.connecting || ((this.viewState === 'LOBBY' || this.viewState === 'GAME') && this.roomCode === urlRoom)) {
          return;
        }

        const savedSession = localStorage.getItem('mx_active_session');
        let sessionObj: any = null;
        if (savedSession) {
          try { sessionObj = JSON.parse(savedSession); } catch (e) {}
        }

        if (urlRoom) {
          // If entering via link or QR code with a room parameter:
          if (sessionObj && sessionObj.roomCode !== urlRoom) {
            localStorage.removeItem('mx_active_session');
            sessionObj = null;
          }

          // If the player was host in the saved session for this room, preserve host!
          const wasHost = (sessionObj && sessionObj.roomCode === urlRoom) ? !!sessionObj.isHost : false;

          this.roomCode = urlRoom;
          this.isHost = wasHost;

          // Ensure player has a name (fallback to generated agent name if empty)
          if (!this.playerName.trim()) {
            this.playerName = 'Agent ' + Math.floor(100 + Math.random() * 900);
            localStorage.setItem('mx_player_name', this.playerName);
          }

          // Directly join room into the lobby ONLY if on JOIN_SCREEN
          if (this.viewState === 'JOIN_SCREEN') {
            this.joinRoomInternal().then(() => {
              this.showToast(`Lobby ${this.roomCode} beigetreten!`);
              if (!this.isHost) {
                this.network.publishEvent({
                  type: 'REQUEST_SYNC',
                  senderId: this.playerId,
                  senderName: this.playerName,
                  timestamp: Date.now(),
                  payload: {}
                });
              }
            }).catch(err => {
              this.connecting = false;
              console.warn('Auto-join failed:', err);
            });
          }

        } else if (sessionObj && sessionObj.roomCode && sessionObj.playerName) {
          // No room in URL: restore session after lock screen or refresh
          this.roomCode = sessionObj.roomCode;
          this.playerName = sessionObj.playerName;
          this.playerId = sessionObj.playerId || this.playerId;
          this.isHost = !!sessionObj.isHost;

          if (this.viewState === 'JOIN_SCREEN') {
            this.joinRoomInternal().then(() => {
              this.showToast(`Sitzung für Raum ${this.roomCode} wiederhergestellt!`);
              if (!this.isHost) {
                this.network.publishEvent({
                  type: 'REQUEST_SYNC',
                  senderId: this.playerId,
                  senderName: this.playerName,
                  timestamp: Date.now(),
                  payload: {}
                });
              }
            }).catch(() => {
              this.connecting = false;
            });
          }
        }
      })
    );

    // Check initial GPS to center default coordinates
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.settings.centerLat = pos.coords.latitude;
          this.settings.centerLng = pos.coords.longitude;
          this.currentLat = pos.coords.latitude;
          this.currentLng = pos.coords.longitude;
          if (this.myPlayer) {
            this.myPlayer.lat = pos.coords.latitude;
            this.myPlayer.lng = pos.coords.longitude;
          }
          this.updateLobbyMapCenter();
        },
        (err) => console.log('Initial geolocation hint:', err.message),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }

    // Listen to network events
    this.subs.push(
      this.network.event$.subscribe(event => this.handleNetworkEvent(event)),
      this.network.location$.subscribe(loc => this.handleIncomingLocation(loc)),
      this.network.tactics$.subscribe(tactic => this.handleTacticalEvent(tactic)),
      this.network.connected$.subscribe(connected => {
        if (!connected && this.viewState !== 'JOIN_SCREEN') {
          console.warn('Network disconnected, attempting reconnection...');
        }
      })
    );
  }

  ngAfterViewInit(): void {
    // Initial map setup if needed
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    this.releaseWakeLock();
    this.stopGpsTracking();
    this.stopPingTimer();
    this.stopLocationHeartbeat();
    this.resetTacticalState();
    this.network.disconnect();
    this.subs.forEach(s => s.unsubscribe());
    if (this.gameMap) this.gameMap.remove();
    if (this.lobbyMap) this.lobbyMap.remove();
  }

  // --- LOBBY CREATION & JOINING ---

  public createLobby() {
    if (!this.playerName.trim() || this.connecting) return;
    localStorage.setItem('mx_player_name', this.playerName.trim());

    // Generate clean 5-digit room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.roomCode = code;
    this.isHost = true;
    this.joinRoomInternal();
  }

  public joinLobby() {
    if (!this.playerName.trim() || !this.roomCode.trim() || this.connecting) return;
    localStorage.setItem('mx_player_name', this.playerName.trim());
    this.roomCode = this.roomCode.toUpperCase().trim();
    this.isHost = false;
    this.joinRoomInternal();
  }

  private async joinRoomInternal() {
    if (this.connecting) return;
    this.connecting = true;
    this.connectionError = '';

    const isHostForThisRoom = this.isHost;

    this.myPlayer = {
      id: this.playerId,
      name: this.playerName.trim(),
      isHost: isHostForThisRoom,
      role: 'UNASSIGNED',
      lat: this.currentLat || this.settings.centerLat,
      lng: this.currentLng || this.settings.centerLng
    };

    // Update query params in URL without reloading
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { room: this.roomCode },
      queryParamsHandling: 'merge'
    });

    const timeoutTimer = setTimeout(() => {
      if (this.connecting) {
        this.connecting = false;
        this.connectionError = 'Verbindung hat zu lange gedauert. Bitte erneut versuchen.';
      }
    }, 8000);

    try {
      await this.network.connect(this.roomCode, this.myPlayer);
      clearTimeout(timeoutTimer);
      this.connecting = false;
      this.viewState = 'LOBBY';
      this.isHost = isHostForThisRoom;
      this.myPlayer.isHost = isHostForThisRoom;
      this.players = [this.myPlayer];
      this.startGpsTracking();
      this.generateQrCode();

      localStorage.setItem('mx_active_session', JSON.stringify({
        roomCode: this.roomCode,
        playerId: this.playerId,
        playerName: this.playerName,
        isHost: this.isHost
      }));

      // If joining existing room, request state sync
      if (!this.isHost) {
        setTimeout(() => {
          this.network.publishEvent({
            type: 'SYNC_STATE',
            senderId: this.playerId,
            senderName: this.playerName,
            timestamp: Date.now(),
            payload: { request: true }
          });
        }, 500);
      }

      // Initialize lobby preview map on next tick
      setTimeout(() => this.initLobbyMap(), 100);
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      this.connecting = false;
      this.connectionError = 'Verbindung fehlgeschlagen: ' + (err.message || 'Server nicht erreichbar');
    }
  }

  public leaveLobby() {
    this.connecting = false;
    this.connectionError = '';
    localStorage.removeItem('mx_active_session');
    this.releaseWakeLock();
    this.stopGpsTracking();
    this.stopPingTimer();
    this.stopLocationHeartbeat();
    this.resetTacticalState();
    this.network.disconnect();
    this.viewState = 'JOIN_SCREEN';
    this.gameStatus = 'LOBBY';
    this.players = [];
    this.myRole = 'UNASSIGNED';
    this.pings = [];
    this.lastPing = null;
    this.roomCode = '';
    this.isHost = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { room: null },
      queryParamsHandling: 'merge'
    });
  }

  public getShareUrl(): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?room=${this.roomCode}`;
  }

  public copyShareLink() {
    const url = this.getShareUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.copySuccess = true;
        setTimeout(() => (this.copySuccess = false), 2500);
      });
    }
  }

  public shareInvite() {
    const url = this.getShareUrl();
    if (navigator.share) {
      navigator.share({
        title: 'Mister X Jagd!',
        text: `Komm in meine Reallife Mister X Runde (Code: ${this.roomCode})!`,
        url: url
      }).catch(() => {});
    } else {
      this.copyShareLink();
    }
  }

  public generateQrCode() {
    QRCode.toDataURL(
      this.getShareUrl(),
      { width: 260, margin: 2, color: { dark: '#000000', light: '#ffffff' } },
      (err, url) => {
        if (!err) {
          this.qrCodeDataUrl = url;
        }
      }
    );
  }

  // --- HOST SETTINGS & LOBBY MAP ---

  private initLobbyMap() {
    if (!this.lobbyMapContainer || this.lobbyMap) return;

    this.lobbyMap = L.map(this.lobbyMapContainer.nativeElement, {
      center: [this.settings.centerLat, this.settings.centerLng],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.lobbyMap);

    this.lobbyBoundaryCircle = L.circle([this.settings.centerLat, this.settings.centerLng], {
      radius: this.settings.radiusMeters,
      color: '#09090b',
      fillColor: '#09090b',
      fillOpacity: 0.1,
      weight: 2.5,
      dashArray: '8, 6'
    }).addTo(this.lobbyMap);

    // Center pin icon (monochrome target bullseye)
    const centerIcon = L.divIcon({
      className: 'mx-center-marker',
      html: `<div class="mx-center-pin"><div class="mx-center-dot"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.lobbyCenterMarker = L.marker([this.settings.centerLat, this.settings.centerLng], {
      icon: centerIcon,
      draggable: this.isHost
    }).addTo(this.lobbyMap);

    if (this.isHost) {
      this.lobbyCenterMarker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        this.settings.centerLat = pos.lat;
        this.settings.centerLng = pos.lng;
        this.centerManuallySet = true;
        this.updateLobbyMapCenter();
        this.broadcastSettings();
      });

      this.lobbyMap.on('click', (e: L.LeafletMouseEvent) => {
        this.settings.centerLat = e.latlng.lat;
        this.settings.centerLng = e.latlng.lng;
        this.centerManuallySet = true;
        this.updateLobbyMapCenter();
        this.broadcastSettings();
      });
    }

    setTimeout(() => this.lobbyMap?.invalidateSize(), 200);
  }

  public updateRadius(meters: number) {
    this.settings.radiusMeters = meters;
    if (this.lobbyBoundaryCircle) {
      this.lobbyBoundaryCircle.setRadius(meters);
    }
    this.broadcastSettings();
  }

  public updatePingInterval(seconds: number) {
    this.settings.pingIntervalSeconds = seconds;
    this.broadcastSettings();
  }

  public setCenterToMyGps() {
    if (this.currentLat && this.currentLng) {
      this.settings.centerLat = this.currentLat;
      this.settings.centerLng = this.currentLng;
      this.centerManuallySet = true;
      this.updateLobbyMapCenter();
      this.broadcastSettings();
      this.showToast('Zentrum auf deinen aktuellen GPS-Standort gesetzt!');
    } else {
      this.showToast('GPS-Standort wird noch ermittelt...');
    }
  }

  private updateLobbyMapCenter() {
    if (this.lobbyMap && this.lobbyBoundaryCircle && this.lobbyCenterMarker) {
      const latlng: L.LatLngTuple = [this.settings.centerLat, this.settings.centerLng];
      this.lobbyBoundaryCircle.setLatLng(latlng);
      this.lobbyBoundaryCircle.setRadius(this.settings.radiusMeters);
      this.lobbyCenterMarker.setLatLng(latlng);
      this.lobbyMap.setView(latlng, this.lobbyMap.getZoom());
    }
  }

  public broadcastSettings() {
    if (!this.isHost) return;
    this.network.publishEvent({
      type: 'SETTINGS',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      payload: { settings: this.settings }
    });
  }

  // --- START GAME & ROLE ASSIGNMENT ---

  public startGame() {
    if (!this.isHost) return;
    if (this.players.length < 1) {
      this.showToast('Mindestens 1 Spieler erforderlich');
      return;
    }

    // Role assignment:
    // If specific Mister X selected, use that, otherwise pick random player
    let misterXId = this.settings.misterXPlayerId;
    if (!misterXId || !this.players.some(p => p.id === misterXId)) {
      const randomIndex = Math.floor(Math.random() * this.players.length);
      misterXId = this.players[randomIndex].id;
    }

    const assignedPlayers = this.players.map(p => ({
      ...p,
      role: (p.id === misterXId ? 'MISTER_X' : 'DETECTIVE') as Role
    }));

    this.network.publishEvent({
      type: 'START_GAME',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      payload: {
        settings: this.settings,
        players: assignedPlayers,
        startPingTimestamp: Date.now() + this.settings.pingIntervalSeconds * 1000
      }
    });

    this.applyGameStart(this.settings, assignedPlayers, Date.now() + this.settings.pingIntervalSeconds * 1000);
  }

  private applyGameStart(settings: GameSettings, assignedPlayers: Player[], nextPingTimestamp: number) {
    this.settings = settings;
    this.players = assignedPlayers;
    this.gameStatus = 'PLAYING';
    this.viewState = 'GAME';

    const me = this.players.find(p => p.id === this.playerId);
    if (me) {
      this.myRole = me.role;
      this.myPlayer = me;
      this.network.updatePlayer(this.myPlayer);
    }

    // Reset previous round's tactical drawings & enable detective-only channel strictly for detectives
    this.resetTacticalState();
    const isDetective = this.myRole === 'DETECTIVE';
    this.network.setTacticsSubscription(isDetective);
    if (isDetective) {
      setTimeout(() => {
        this.network.publishTactical({
          action: 'REQUEST_SYNC',
          senderId: this.playerId,
          senderName: this.playerName,
          timestamp: Date.now()
        });
      }, 450);
    }

    this.audio.playStartSound();
    this.audio.playRoleRevealSound(this.myRole === 'MISTER_X');
    this.showRoleRevealModal = true;
    if ('vibrate' in navigator) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
    this.requestWakeLock();
    this.showToast(`Spiel gestartet — Rolle: ${this.myRole === 'MISTER_X' ? 'MISTER X' : 'DETEKTIV'}`);

    this.nextPingTimestamp = nextPingTimestamp;
    this.startPingTimer();

    // Start continuous location heartbeat & broadcast current position immediately
    this.startLocationHeartbeat();
    if (this.currentLat && this.currentLng && this.myPlayer) {
      this.network.publishLocation(this.currentLat, this.currentLng, this.gpsAccuracy || 10, this.myPlayer.heading);
    }

    setTimeout(() => {
      this.initGameMap();
    }, 200);
  }

  // --- IN-GAME MAP & RADAR ---

  private initGameMap() {
    if (!this.mapContainer) return;
    if (this.gameMap) {
      this.gameMap.remove();
      this.gameMap = null;
    }

    const L_LIB: any = (typeof window !== 'undefined' && (window as any).L && (window as any).L.Map?.prototype?.setBearing)
      ? (window as any).L
      : L;

    const center: L.LatLngTuple = [this.settings.centerLat, this.settings.centerLng];
    const map = L_LIB.map(this.mapContainer.nativeElement, {
      center: center,
      zoom: 15,
      zoomControl: false,
      rotate: true,
      bearing: 0,
      touchRotate: true,
      rotateControl: false
    }) as L.Map;
    this.gameMap = map;

    this.mapBearing = 0;

    map.on('rotate' as any, () => {
      this.ngZone.run(() => {
        const b = typeof (map as any).getBearing === 'function' ? (map as any).getBearing() : 0;
        this.mapBearing = Math.round((b % 360 + 360) % 360);
        this.refreshTacticalArrowheads();
      });
    });

    map.on('zoomend', () => {
      this.refreshTacticalArrowheads();
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (
        this.myRole === 'DETECTIVE' &&
        (this.activeTacticalTool === 'GOING' ||
          this.activeTacticalTool === 'PING' ||
          this.activeTacticalTool === 'SUSPECT' ||
          this.activeTacticalTool === 'SIGHTING' ||
          this.activeTacticalTool === 'BLOCK')
      ) {
        this.placeTacticalStamp(this.activeTacticalTool, e.latlng.lat, e.latlng.lng);
        return;
      }

      if (this.simulationMode && this.activeTacticalTool === 'NONE') {
        this.simulateMove(e.latlng.lat, e.latlng.lng);
      }
    });

    this.initTouchRotation();
    this.initTacticalDrawingEvents();

    // Classic street map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Monochrome boundary zone circle
    this.boundaryCircle = L.circle(center, {
      radius: this.settings.radiusMeters,
      color: '#09090b',
      fillColor: '#09090b',
      fillOpacity: 0.07,
      weight: 2.5,
      dashArray: '8, 6',
      interactive: false
    }).addTo(map);

    // Monochrome breadcrumb trail polyline for Mister X's past pings
    this.pingTrailPolyline = L.polyline([], {
      color: '#09090b',
      weight: 3,
      opacity: 0.85,
      dashArray: '6, 8',
      interactive: false
    }).addTo(map);

    // Clean up stale markers and render all current player markers immediately
    this.playerMarkers.forEach(m => m.remove());
    this.playerMarkers.clear();
    this.renderAllPlayerMarkers();

    // Restore any existing pings
    if (this.pings.length > 0) {
      this.pingMarkers.forEach(m => m.remove());
      this.pingMarkers = [];
      this.pings.forEach(p => this.addPingMarkerToMap(p));
    }

    // Restore any existing detective tactical annotations
    if (this.myRole === 'DETECTIVE' && this.tacticalAnnotations.length > 0) {
      this.tacticalLayers.clear();
      this.tacticalArrowUpdaters = [];
      this.tacticalAnnotations.forEach(a => this.renderTacticalAnnotation(a));
    }

    // Trigger initial render
    setTimeout(() => {
      this.gameMap?.invalidateSize();
      this.centerOnMe();
      this.renderAllPlayerMarkers();
      this.refreshTacticalArrowheads();
    }, 300);
  }

  public centerOnMe() {
    if (!this.gameMap) return;
    if (this.currentLat && this.currentLng) {
      this.gameMap.setView([this.currentLat, this.currentLng], 16);
    } else {
      this.gameMap.setView([this.settings.centerLat, this.settings.centerLng], 15);
    }
  }

  public centerOnLastPing() {
    if (!this.gameMap || !this.lastPing) return;
    this.gameMap.setView([this.lastPing.lat, this.lastPing.lng], 16);
  }

  public fitGameZone() {
    if (!this.gameMap || !this.boundaryCircle) return;
    this.gameMap.fitBounds(this.boundaryCircle.getBounds(), { padding: [20, 20] });
  }

  // --- GPS GEOLOCATION ENGINE ---

  private startGpsTracking() {
    if (!('geolocation' in navigator)) {
      this.showToast('Geolocation wird von diesem Gerät nicht unterstützt!');
      return;
    }

    this.stopGpsTracking();

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 1500,
      timeout: 10000
    };

    this.watchPositionId = navigator.geolocation.watchPosition(
      (pos) => {
        this.ngZone.run(() => {
          this.gpsActive = true;
          this.gpsAccuracy = Math.round(pos.coords.accuracy);
          this.currentLat = pos.coords.latitude;
          this.currentLng = pos.coords.longitude;

          if (this.viewState === 'LOBBY' && this.isHost && !this.centerManuallySet) {
            this.settings.centerLat = pos.coords.latitude;
            this.settings.centerLng = pos.coords.longitude;
            this.updateLobbyMapCenter();
            this.broadcastSettings();
          }

          this.onPositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.heading || 0);
        });
      },
      (err) => {
        this.ngZone.run(() => {
          console.warn('GPS Watch error:', err.message);
        });
      },
      options
    );
  }

  private stopGpsTracking() {
    if (this.watchPositionId !== null) {
      navigator.geolocation.clearWatch(this.watchPositionId);
      this.watchPositionId = null;
    }
  }

  private startLocationHeartbeat() {
    this.stopLocationHeartbeat();
    this.locationHeartbeatInterval = setInterval(() => {
      if (this.currentLat && this.currentLng && this.myPlayer && this.network.isConnected()) {
        this.network.publishLocation(
          this.currentLat,
          this.currentLng,
          this.gpsAccuracy || 10,
          this.myPlayer.heading
        );
      }
    }, 3000);
  }

  private stopLocationHeartbeat() {
    if (this.locationHeartbeatInterval) {
      clearInterval(this.locationHeartbeatInterval);
      this.locationHeartbeatInterval = null;
    }
  }

  private onPositionUpdate(lat: number, lng: number, accuracy?: number, heading?: number) {
    if (!this.myPlayer) return;

    this.myPlayer.lat = lat;
    this.myPlayer.lng = lng;
    this.myPlayer.accuracy = accuracy;
    this.myPlayer.heading = heading;

    // Check boundary with hysteresis / buffer to prevent false alarms near border or during GPS drift
    const distFromCenter = this.calculateDistance(lat, lng, this.settings.centerLat, this.settings.centerLng);
    const buffer = Math.max(25, Math.min(accuracy || 10, 50));

    if (!this.isOutOfBounds) {
      if (distFromCenter > (this.settings.radiusMeters + buffer)) {
        this.isOutOfBounds = true;
      }
    } else {
      if (distFromCenter <= (this.settings.radiusMeters + 10)) {
        this.isOutOfBounds = false;
      }
    }
    this.myPlayer.isOutOfBounds = this.isOutOfBounds;

    // Throttle location broadcasts to MQTT (every 2.5 seconds)
    const now = Date.now();
    if (now - this.lastPosBroadcastTime > 2500) {
      this.lastPosBroadcastTime = now;
      this.network.publishLocation(lat, lng, accuracy, heading);
    }

    // Update map marker for self
    this.updatePlayerMapMarker(this.myPlayer);

    // If game is active, check catch conditions
    if (this.gameStatus === 'PLAYING') {
      this.evaluateCatchRadius();
    }
  }

  // --- PING SYSTEM (Every X minutes, default 3 min) ---

  private startPingTimer() {
    this.stopPingTimer();

    this.updatePingCountdown();
    this.pingTimerInterval = setInterval(() => {
      this.updatePingCountdown();
    }, 1000);
  }

  private stopPingTimer() {
    if (this.pingTimerInterval) {
      clearInterval(this.pingTimerInterval);
      this.pingTimerInterval = null;
    }
  }

  private updatePingCountdown() {
    const now = Date.now();
    const diff = Math.max(0, Math.floor((this.nextPingTimestamp - now) / 1000));
    this.nextPingInSeconds = diff;

    // Sound alert at 5, 4, 3, 2, 1 seconds
    if (diff <= 5 && diff > 0) {
      this.audio.playTickSound();
    }

    // If Host and time expired, trigger Ping
    if (diff === 0 && this.isHost) {
      this.triggerMisterXPing();
    }
  }

  public triggerMisterXPing() {
    const misterX = this.players.find(p => p.role === 'MISTER_X');
    if (!misterX || misterX.lat === undefined || misterX.lng === undefined) {
      // Mister X coords not yet received or solo test
      const pingLat = misterX?.lat || this.currentLat || this.settings.centerLat;
      const pingLng = misterX?.lng || this.currentLng || this.settings.centerLng;
      this.broadcastPingRecord(pingLat, pingLng);
    } else {
      this.broadcastPingRecord(misterX.lat, misterX.lng, misterX.accuracy);
    }
  }

  private broadcastPingRecord(lat: number, lng: number, accuracy?: number) {
    const pingNumber = this.pings.length + 1;
    const nextTimestamp = Date.now() + this.settings.pingIntervalSeconds * 1000;

    const record: PingRecord = {
      pingNumber,
      timestamp: Date.now(),
      lat,
      lng,
      accuracy
    };

    this.network.publishEvent({
      type: 'PING',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      payload: {
        record,
        nextPingTimestamp: nextTimestamp
      }
    });

    this.applyNewPing(record, nextTimestamp);
  }

  private applyNewPing(record: PingRecord, nextTimestamp: number) {
    if (this.pings.some(p => p.pingNumber === record.pingNumber || Math.abs(p.timestamp - record.timestamp) < 2000)) {
      return;
    }
    this.pings.push(record);
    this.lastPing = record;
    this.nextPingTimestamp = nextTimestamp;

    // Audio & vibration alert!
    this.audio.playPingSound();
    this.showToast(`PING #${record.pingNumber} — Mister X geortet`);

    // Add marker on Leaflet map
    this.addPingMarkerToMap(record);

    // Update distance calculation
    if (this.currentLat && this.currentLng) {
      this.distanceToMisterX = Math.round(this.calculateDistance(this.currentLat, this.currentLng, record.lat, record.lng));
    }
  }

  private addPingMarkerToMap(record: PingRecord) {
    if (!this.gameMap) return;

    // Stylized Monochrome Sonar Ping marker
    const pingHtml = `
      <div class="sonar-ping-marker">
        <div class="sonar-ring"></div>
        <div class="sonar-ring-delay"></div>
        <div class="sonar-core">#${record.pingNumber}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'mx-ping-div-icon',
      html: pingHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const marker = L.marker([record.lat, record.lng], { icon })
      .addTo(this.gameMap)
      .bindPopup(`<strong>PING #${record.pingNumber}</strong><br>${new Date(record.timestamp).toLocaleTimeString()}`);

    this.pingMarkers.push(marker);

    // Update polyline trail
    if (this.pingTrailPolyline) {
      const latlngs = this.pings.map(p => [p.lat, p.lng] as L.LatLngTuple);
      this.pingTrailPolyline.setLatLngs(latlngs);
    }
  }

  // --- CATCH LOGIC ---

  private evaluateCatchRadius() {
    const misterX = this.players.find(p => p.role === 'MISTER_X');
    if (!misterX || misterX.lat === undefined || misterX.lng === undefined || !this.currentLat || !this.currentLng) {
      this.canCatchMisterX = false;
      this.showCatchModal = false;
      return;
    }

    const dist = this.calculateDistance(this.currentLat, this.currentLng, misterX.lat, misterX.lng);
    this.distanceToMisterX = Math.round(dist);

    if (this.myRole === 'DETECTIVE' && this.gameStatus === 'PLAYING') {
      const withinRange = dist <= (this.settings.catchRadiusMeters || 10);
      this.canCatchMisterX = withinRange;

      if (withinRange) {
        if (!this.showCatchModal && !this.catchModalDismissed) {
          this.showCatchModal = true;
          this.audio.playCatchAlertSound();
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 400]);
          }
        }
      } else {
        this.catchModalDismissed = false;
        this.showCatchModal = false;
      }
    }
  }

  public dismissCatchModal() {
    this.showCatchModal = false;
    this.catchModalDismissed = true;
    this.showToast('Popup minimiert — Zugriff-Button bleibt aktiv');
  }

  public openCatchModal() {
    if (this.canCatchMisterX) {
      this.showCatchModal = true;
    }
  }

  public catchMisterX() {
    const maxRadius = this.settings.catchRadiusMeters || 10;
    if (!this.canCatchMisterX && this.distanceToMisterX !== null && this.distanceToMisterX > maxRadius) {
      this.showToast(`Distanz zu gross (${this.distanceToMisterX}m) — Maximal ${maxRadius}m erforderlich`);
      return;
    }

    this.showCatchModal = false;
    this.catchModalDismissed = false;

    this.network.publishEvent({
      type: 'CATCH',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      payload: {
        catcherName: this.playerName,
        catcherId: this.playerId
      }
    });

    this.applyCatch(this.playerName);
  }

  private applyCatch(catcherName: string) {
    this.gameStatus = 'CAUGHT';
    this.misterXCaughtBy = catcherName;
    this.showCatchModal = false;
    this.catchModalDismissed = false;
    this.audio.playCatchSound();
    this.stopPingTimer();
    this.showToast(`ZUGRIFF ERFOLGREICH — Mister X gestellt von ${catcherName}`);
  }

  public openAbortModal() {
    if (!this.isHost) return;
    this.closeAllDrawers();
    this.showAbortModal = true;
  }

  public closeAbortModal() {
    this.showAbortModal = false;
  }

  public confirmAbortToLobby() {
    if (!this.isHost) return;
    this.showAbortModal = false;
    this.restartGame(true);
    this.showToast('Spiel abgebrochen — Alle Spieler zurück in der Lobby.');
  }

  public abortAndCloseLobby() {
    if (!this.isHost) return;
    this.showAbortModal = false;
    this.network.publishEvent({
      type: 'END_GAME',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      payload: { closeLobby: true }
    });
    setTimeout(() => {
      this.leaveLobby();
      this.showToast('Spiel & Lobby wurden für alle beendet.');
    }, 120);
  }

  public restartGame(aborted = false) {
    if (!this.isHost) return;
    this.showAbortModal = false;
    this.showRoleRevealModal = false;
    this.gameStatus = 'LOBBY';
    this.viewState = 'LOBBY';
    this.pings = [];
    this.lastPing = null;
    this.canCatchMisterX = false;
    this.misterXCaughtBy = '';
    this.showCatchModal = false;
    this.catchModalDismissed = false;
    this.releaseWakeLock();
    this.stopPingTimer();
    this.stopLocationHeartbeat();
    this.resetTacticalState();
    this.network.setTacticsSubscription(false);

    // Clear map markers
    this.pingMarkers.forEach(m => m.remove());
    this.pingMarkers = [];
    if (this.pingTrailPolyline) {
      this.pingTrailPolyline.setLatLngs([]);
    }
    this.playerMarkers.forEach(m => m.remove());
    this.playerMarkers.clear();

    this.network.publishEvent({
      type: 'END_GAME',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      payload: { restartToLobby: true, aborted }
    });

    setTimeout(() => {
      this.initLobbyMap();
    }, 200);
  }

  // --- NETWORK EVENT HANDLING ---

  private handleNetworkEvent(msg: GameEventMessage) {
    // Ignore self messages for some actions
    switch (msg.type) {
      case 'JOIN': {
        const joinedPlayer: Player = msg.payload.player;
        if (joinedPlayer.id !== this.playerId) {
          const idx = this.players.findIndex(p => p.id === joinedPlayer.id);
          if (idx >= 0) {
            this.players[idx] = { ...this.players[idx], ...joinedPlayer };
          } else {
            this.players.push(joinedPlayer);
            this.showToast(`${joinedPlayer.name} ist beigetreten!`);
          }

          // If Host, respond with current state & settings
          if (this.isHost) {
            this.network.publishEvent({
              type: 'SYNC_STATE',
              senderId: this.playerId,
              senderName: this.playerName,
              timestamp: Date.now(),
              payload: {
                settings: this.settings,
                gameStatus: this.gameStatus,
                players: this.players,
                pings: this.pings,
                nextPingTimestamp: this.nextPingTimestamp
              }
            });
          }
        }
        break;
      }

      case 'LEAVE': {
        const leavingId = msg.senderId;
        const p = this.players.find(x => x.id === leavingId);
        if (p) {
          this.showToast(`${p.name} hat die Lobby verlassen.`);
        }
        this.players = this.players.filter(x => x.id !== leavingId);

        // Remove marker
        const marker = this.playerMarkers.get(leavingId);
        if (marker) {
          marker.remove();
          this.playerMarkers.delete(leavingId);
        }

        // If host left, elect oldest player
        if (p?.isHost && this.players.length > 0) {
          if (this.players[0].id === this.playerId) {
            this.isHost = true;
            this.myPlayer!.isHost = true;
            this.network.updatePlayer(this.myPlayer!);
            this.showToast('Du bist jetzt der neue Host!');
          }
        }
        break;
      }

      case 'SETTINGS': {
        if (!this.isHost && msg.payload.settings) {
          this.settings = msg.payload.settings;
          this.updateLobbyMapCenter();
        }
        break;
      }

      case 'REQUEST_SYNC': {
        if (this.isHost) {
          this.network.publishEvent({
            type: 'SYNC_STATE',
            senderId: this.playerId,
            senderName: this.playerName,
            timestamp: Date.now(),
            payload: {
              settings: this.settings,
              gameStatus: this.gameStatus,
              players: this.players,
              pings: this.pings,
              nextPingTimestamp: this.nextPingTimestamp
            }
          });
        }
        break;
      }

      case 'SYNC_STATE': {
        if (!this.isHost && msg.payload.settings) {
          this.settings = msg.payload.settings;
          this.players = msg.payload.players || this.players;

          // If current player is marked as host in the received player list, update isHost
          const meInList = this.players.find(p => p.id === this.playerId);
          if (meInList && meInList.isHost) {
            this.isHost = true;
          }

          // If game is in progress
          if (msg.payload.gameStatus === 'PLAYING') {
            this.applyGameStart(msg.payload.settings, msg.payload.players, msg.payload.nextPingTimestamp);
            if (msg.payload.pings) {
              msg.payload.pings.forEach((p: PingRecord) => this.applyNewPing(p, msg.payload.nextPingTimestamp));
            }
          }
        }
        break;
      }

      case 'START_GAME': {
        if (msg.payload.settings && msg.payload.players) {
          this.applyGameStart(msg.payload.settings, msg.payload.players, msg.payload.startPingTimestamp);
        }
        break;
      }

      case 'PING': {
        if (msg.payload.record && msg.senderId !== this.playerId) {
          this.applyNewPing(msg.payload.record, msg.payload.nextPingTimestamp);
        }
        break;
      }

      case 'CATCH': {
        this.applyCatch(msg.payload.catcherName || 'Detektiv');
        break;
      }

      case 'END_GAME': {
        if (msg.senderId === this.playerId) break;

        if (msg.payload?.closeLobby) {
          this.leaveLobby();
          this.showToast('Der Host hat das Spiel und die Lobby beendet.');
          break;
        }

        this.showRoleRevealModal = false;
        this.showCatchModal = false;
        this.showAbortModal = false;
        this.gameStatus = 'LOBBY';
        this.viewState = 'LOBBY';
        this.pings = [];
        this.lastPing = null;
        this.releaseWakeLock();
        this.stopPingTimer();
        this.stopLocationHeartbeat();
        this.resetTacticalState();
        this.network.setTacticsSubscription(false);
        this.showToast(
          msg.payload?.aborted
            ? 'Der Host hat das laufende Spiel abgebrochen.'
            : 'Host hat die Runde beendet — Zurück in der Lobby.'
        );
        setTimeout(() => this.initLobbyMap(), 200);
        break;
      }
    }
  }

  private handleIncomingLocation(loc: { playerId: string; playerName?: string; role?: Role; lat: number; lng: number; accuracy?: number; heading?: number }) {
    if (loc.playerId === this.playerId) return;

    let player = this.players.find(p => p.id === loc.playerId);
    if (!player) {
      player = {
        id: loc.playerId,
        name: loc.playerName || 'Detektiv',
        role: loc.role || 'DETECTIVE',
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        heading: loc.heading,
        lastUpdated: Date.now(),
        isHost: false
      };
      this.players.push(player);
    } else {
      player.lat = loc.lat;
      player.lng = loc.lng;
      player.accuracy = loc.accuracy;
      player.heading = loc.heading;
      player.lastUpdated = Date.now();
      if (loc.role && player.role === 'UNASSIGNED') {
        player.role = loc.role;
      }
    }

    // Check out of bounds with buffer
    const distFromCenter = this.calculateDistance(loc.lat, loc.lng, this.settings.centerLat, this.settings.centerLng);
    const buffer = Math.max(25, Math.min(loc.accuracy || 10, 50));
    player.isOutOfBounds = distFromCenter > (this.settings.radiusMeters + buffer);

    // Visibility rules:
    // - Detective sees themselves and ALL other Detectives live.
    // - Detective DOES NOT see Mister X live (only periodic pings!).
    // - Mister X sees themselves and ALL Detectives live.
    const isMisterX = player.role === 'MISTER_X';
    const shouldShow = (this.myRole === 'MISTER_X') || (!isMisterX) || (this.gameStatus !== 'PLAYING');

    if (shouldShow) {
      this.updatePlayerMapMarker(player);
    } else {
      const m = this.playerMarkers.get(player.id);
      if (m) {
        m.remove();
        this.playerMarkers.delete(player.id);
      }
    }

    if (this.gameStatus === 'PLAYING') {
      this.evaluateCatchRadius();
    }
  }

  // --- MAP MARKER UTILS ---

  private renderAllPlayerMarkers() {
    if (!this.gameMap) return;

    // Render self marker first
    if (this.myPlayer && this.myPlayer.lat !== undefined && this.myPlayer.lng !== undefined) {
      this.updatePlayerMapMarker(this.myPlayer);
    }

    // Render other players
    this.players.forEach(p => {
      if (p.id === this.playerId) return;
      if (p.lat !== undefined && p.lng !== undefined) {
        const isMisterX = p.role === 'MISTER_X';
        const shouldShow = (this.myRole === 'MISTER_X') || (!isMisterX) || (this.gameStatus !== 'PLAYING');
        if (shouldShow) {
          this.updatePlayerMapMarker(p);
        } else {
          const m = this.playerMarkers.get(p.id);
          if (m) {
            m.remove();
            this.playerMarkers.delete(p.id);
          }
        }
      }
    });
  }

  private escapeHtml(str: string): string {
    return (str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c] || c));
  }

  private updatePlayerMapMarker(player: Player) {
    if (!this.gameMap || player.lat === undefined || player.lng === undefined) return;

    const isMe = player.id === this.playerId;
    const isMisterX = player.role === 'MISTER_X';

    // In game, detectives must never see Mister X live
    if (this.gameStatus === 'PLAYING' && this.myRole === 'DETECTIVE' && isMisterX && !isMe) {
      const existing = this.playerMarkers.get(player.id);
      if (existing) {
        existing.remove();
        this.playerMarkers.delete(player.id);
      }
      return;
    }

    let marker = this.playerMarkers.get(player.id);
    const latlng: L.LatLngTuple = [player.lat, player.lng];

    const incognitoSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18"/><path d="M5 11l2-6h10l2 6"/><circle cx="8.5" cy="16.5" r="2.5"/><circle cx="15.5" cy="16.5" r="2.5"/><path d="M11 16.5h2"/></svg>`;
    const navSelfSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>`;
    const shieldSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

    const roleSvg = isMisterX ? incognitoSvg : (isMe ? navSelfSvg : shieldSvg);
    const safeName = this.escapeHtml(player.name);
    const label = isMe ? `${safeName} • DU` : (isMisterX ? `${safeName} • X` : safeName);

    const html = `
      <div class="player-custom-marker ${isMe ? 'is-me' : ''} ${isMisterX ? 'is-misterx' : 'is-detective'}">
        <div class="marker-badge">
          <span class="marker-icon">${roleSvg}</span>
        </div>
        <div class="marker-label">${label}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'mx-custom-player-icon',
      html: html,
      iconSize: [72, 56],
      iconAnchor: [36, 42]
    });

    if (!marker) {
      marker = L.marker(latlng, { icon, zIndexOffset: isMe ? 1000 : 500 }).addTo(this.gameMap);
      this.playerMarkers.set(player.id, marker);
    } else {
      marker.setLatLng(latlng);
      marker.setIcon(icon);
    }
  }

  // --- DETECTIVE TACTICAL DRAWING ENGINE (MOBILE-FIRST, TACTICAL RED, DETECTIVE-ONLY) ---

  public toggleTacticalBar() {
    if (this.myRole !== 'DETECTIVE') return;
    this.tacticalBarOpen = !this.tacticalBarOpen;
    if (this.tacticalBarOpen) {
      this.closeAllDrawers();
      if (this.activeTacticalTool === 'NONE') {
        this.selectTacticalTool('ARROW');
      }
    } else {
      this.selectTacticalTool('NONE');
    }
  }

  public closeTacticalBar() {
    this.tacticalBarOpen = false;
    this.selectTacticalTool('NONE');
  }

  public selectTacticalTool(tool: TacticalTool) {
    if (this.myRole !== 'DETECTIVE' && tool !== 'NONE') return;
    // Tapping an already-active tool toggles back to free map pan ('NONE')
    this.activeTacticalTool = (this.activeTacticalTool === tool && tool !== 'NONE') ? 'NONE' : tool;
    this.cancelActiveStroke();
    this.clearPendingArrowStart();

    if (this.gameMap) {
      if (
        this.activeTacticalTool === 'ARROW' ||
        this.activeTacticalTool === 'LINE' ||
        this.activeTacticalTool === 'ZONE'
      ) {
        this.gameMap.dragging.disable();
      } else {
        this.gameMap.dragging.enable();
      }

      // Disable doubleClickZoom while placing pings/arrows so rapid multi-tapping never zooms accidentally
      if (this.activeTacticalTool !== 'NONE') {
        this.gameMap.doubleClickZoom.disable();
      } else {
        this.gameMap.doubleClickZoom.enable();
      }
    }
  }

  public getTacticalHint(): string {
    switch (this.activeTacticalTool) {
      case 'GOING':
        return 'Tippen: „Dort gehe ich hin“ markieren (mehrfach möglich)';
      case 'PING':
        return 'Tippen: Rote Team-Pings schnell setzen (mehrfach)';
      case 'ARROW':
        return this.arrowPendingStart
          ? 'Jetzt Zielpunkt antippen für roten Pfeil'
          : 'Ziehen oder Start + Ziel antippen: Roter Pfeil';
      case 'LINE':
        return 'Finger ziehen: Rote Fluchtroute zeichnen';
      case 'ZONE':
        return 'Tippen (75m) oder ziehen: Roter Suchkreis';
      case 'SIGHTING':
        return 'Tippen: Rote Sichtung (!) melden';
      case 'SUSPECT':
        return 'Tippen: Roten Verdacht (?) setzen';
      case 'BLOCK':
        return 'Tippen: Weg gesperrt / abgedeckt (X)';
      default:
        return 'Karte frei verschieben & zoomen';
    }
  }

  public hasOwnTacticalItems(): boolean {
    return this.tacticalAnnotations.some(a => a.authorId === this.playerId);
  }

  private clearPendingArrowStart() {
    this.arrowPendingStart = null;
    if (this.arrowPendingMarker) {
      this.arrowPendingMarker.remove();
      this.arrowPendingMarker = null;
    }
  }

  private resetTacticalState() {
    this.tacticalBarOpen = false;
    this.activeTacticalTool = 'NONE';
    this.cancelActiveStroke();
    this.clearPendingArrowStart();
    this.tacticalLayers.forEach(layers => layers.forEach(l => l.remove()));
    this.tacticalLayers.clear();
    this.tacticalArrowUpdaters = [];
    this.tacticalAnnotations = [];
    if (this.gameMap) {
      try {
        this.gameMap.dragging.enable();
        this.gameMap.doubleClickZoom.enable();
      } catch (e) {}
    }
  }

  private cancelActiveStroke() {
    this.isDrawingTactical = false;
    this.currentStrokePoints = [];
    this.zoneStartLatLng = null;
    this.zoneDragged = false;
    if (this.previewHaloLine) {
      this.previewHaloLine.remove();
      this.previewHaloLine = null;
    }
    if (this.previewCoreLine) {
      this.previewCoreLine.remove();
      this.previewCoreLine = null;
    }
    if (this.previewArrowHead) {
      this.previewArrowHead.remove();
      this.previewArrowHead = null;
    }
    if (this.previewZoneHalo) {
      this.previewZoneHalo.remove();
      this.previewZoneHalo = null;
    }
    if (this.previewZoneCircle) {
      this.previewZoneCircle.remove();
      this.previewZoneCircle = null;
    }
  }

  private screenPointToLatLng(clientX: number, clientY: number): L.LatLng | null {
    if (!this.gameMap || !this.mapContainer?.nativeElement) return null;
    const el: HTMLElement = this.mapContainer.nativeElement;
    let ux = clientX;
    let uy = clientY;

    // If CSS fallback rotation is active on mapContainer, un-rotate touch point around element center
    if (el.style.transform && el.style.transform.includes('rotate(') && this.mapBearing !== 0) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = (-this.mapBearing * Math.PI) / 180;
      const dx = clientX - cx;
      const dy = clientY - cy;
      ux = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      uy = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }

    try {
      return this.gameMap.mouseEventToLatLng({ clientX: ux, clientY: uy } as MouseEvent);
    } catch (e) {
      return null;
    }
  }

  private isPopupOrControlTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return !!(target.closest('.leaflet-popup') || target.closest('.leaflet-control'));
  }

  private initTacticalDrawingEvents() {
    if (!this.mapContainer?.nativeElement) return;
    const el: HTMLElement = this.mapContainer.nativeElement;

    const isDragTool = () =>
      this.activeTacticalTool === 'ARROW' ||
      this.activeTacticalTool === 'LINE' ||
      this.activeTacticalTool === 'ZONE';

    const startStroke = (clientX: number, clientY: number) => {
      if (this.myRole !== 'DETECTIVE' || !this.gameMap || !isDragTool()) return;

      const latlng = this.screenPointToLatLng(clientX, clientY);
      if (!latlng) return;

      this.cancelActiveStroke();
      this.isDrawingTactical = true;

      if (this.activeTacticalTool === 'ARROW') {
        const pt: [number, number] = [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))];
        this.currentStrokePoints = [pt];
        this.previewHaloLine = L.polyline([pt], {
          color: '#ffffff',
          weight: 7.5,
          opacity: 0.95,
          lineCap: 'round',
          interactive: false
        }).addTo(this.gameMap);
        this.previewCoreLine = L.polyline([pt], {
          color: '#dc2626',
          weight: 4,
          opacity: 1,
          lineCap: 'round',
          interactive: false
        }).addTo(this.gameMap);
      } else if (this.activeTacticalTool === 'LINE') {
        const pt: [number, number] = [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))];
        this.currentStrokePoints = [pt];
        this.previewHaloLine = L.polyline([pt], {
          color: '#ffffff',
          weight: 7,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(this.gameMap);
        this.previewCoreLine = L.polyline([pt], {
          color: '#dc2626',
          weight: 3.5,
          opacity: 1,
          dashArray: '8, 6',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(this.gameMap);
      } else if (this.activeTacticalTool === 'ZONE') {
        this.zoneStartLatLng = latlng;
        this.currentZoneRadius = 75;
        this.zoneDragged = false;
        this.previewZoneHalo = L.circle(latlng, {
          radius: 75,
          color: '#ffffff',
          weight: 5.5,
          opacity: 0.9,
          fill: false,
          interactive: false
        }).addTo(this.gameMap);
        this.previewZoneCircle = L.circle(latlng, {
          radius: 75,
          color: '#dc2626',
          weight: 2.5,
          dashArray: '7, 6',
          fillColor: '#ef4444',
          fillOpacity: 0.16,
          interactive: false
        }).addTo(this.gameMap);
      }
    };

    const moveStroke = (clientX: number, clientY: number) => {
      if (!this.isDrawingTactical || !this.gameMap) return;
      const latlng = this.screenPointToLatLng(clientX, clientY);
      if (!latlng) return;

      if (this.activeTacticalTool === 'ARROW' && this.currentStrokePoints.length > 0) {
        const startPt = this.currentStrokePoints[0];
        const endPt: [number, number] = [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))];
        this.currentStrokePoints = [startPt, endPt];
        this.previewHaloLine?.setLatLngs([startPt, endPt]);
        this.previewCoreLine?.setLatLngs([startPt, endPt]);
        const dist = this.calculateDistance(startPt[0], startPt[1], endPt[0], endPt[1]);
        if (dist >= 6) {
          const icon = this.createArrowIcon(startPt, endPt);
          if (!this.previewArrowHead) {
            this.previewArrowHead = L.marker(endPt, { icon, interactive: false, zIndexOffset: 460 }).addTo(this.gameMap);
          } else {
            this.previewArrowHead.setLatLng(endPt);
            this.previewArrowHead.setIcon(icon);
          }
        }
      } else if (this.activeTacticalTool === 'LINE' && this.currentStrokePoints.length > 0) {
        const last = this.currentStrokePoints[this.currentStrokePoints.length - 1];
        const dist = this.calculateDistance(last[0], last[1], latlng.lat, latlng.lng);
        if (dist >= 4 && this.currentStrokePoints.length < 110) {
          this.currentStrokePoints.push([Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))]);
          this.previewHaloLine?.setLatLngs(this.currentStrokePoints);
          this.previewCoreLine?.setLatLngs(this.currentStrokePoints);
        }
      } else if (this.activeTacticalTool === 'ZONE' && this.zoneStartLatLng) {
        const rawDist = this.calculateDistance(
          this.zoneStartLatLng.lat,
          this.zoneStartLatLng.lng,
          latlng.lat,
          latlng.lng
        );
        if (rawDist > 14) {
          this.zoneDragged = true;
        }
        const clamped = Math.min(400, Math.max(25, Math.round(rawDist)));
        this.currentZoneRadius = this.zoneDragged ? clamped : 75;
        this.previewZoneHalo?.setRadius(this.currentZoneRadius);
        this.previewZoneCircle?.setRadius(this.currentZoneRadius);
      }
    };

    const finishStroke = () => {
      if (!this.isDrawingTactical) return;
      this.ngZone.run(() => {
        if (this.activeTacticalTool === 'ARROW') {
          const pts = [...this.currentStrokePoints];
          this.cancelActiveStroke();
          const draggedDist =
            pts.length >= 2 ? this.calculateDistance(pts[0][0], pts[0][1], pts[1][0], pts[1][1]) : 0;

          if (pts.length >= 2 && draggedDist >= 8) {
            // Dragged straight arrow
            this.clearPendingArrowStart();
            const ann: TacticalAnnotation = {
              id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
              type: 'ARROW',
              authorId: this.playerId,
              authorName: this.playerName,
              timestamp: Date.now(),
              points: [pts[0], pts[1]]
            };
            this.addAndBroadcastTactical(ann);
          } else if (pts.length >= 1 && this.gameMap) {
            // 2-Tap mode: 1st tap sets start, 2nd tap completes arrow!
            const tapPt = pts[pts.length - 1];
            if (!this.arrowPendingStart) {
              this.arrowPendingStart = tapPt;
              const startIcon = L.divIcon({
                className: 'mx-tactic-div-icon',
                html: `<div class="tactic-arrow-pending-dot"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
              });
              this.arrowPendingMarker = L.marker(tapPt, {
                icon: startIcon,
                interactive: false,
                zIndexOffset: 470
              }).addTo(this.gameMap);
            } else {
              const startPt = this.arrowPendingStart;
              this.clearPendingArrowStart();
              if (this.calculateDistance(startPt[0], startPt[1], tapPt[0], tapPt[1]) >= 4) {
                const ann: TacticalAnnotation = {
                  id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
                  type: 'ARROW',
                  authorId: this.playerId,
                  authorName: this.playerName,
                  timestamp: Date.now(),
                  points: [startPt, tapPt]
                };
                this.addAndBroadcastTactical(ann);
              }
            }
          }
        } else if (this.activeTacticalTool === 'LINE') {
          const pts = [...this.currentStrokePoints];
          this.cancelActiveStroke();
          if (pts.length >= 2) {
            const ann: TacticalAnnotation = {
              id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
              type: 'LINE',
              authorId: this.playerId,
              authorName: this.playerName,
              timestamp: Date.now(),
              points: pts
            };
            this.addAndBroadcastTactical(ann);
          } else {
            this.showToast('Finger über die Karte ziehen für Freihand-Route');
          }
        } else if (this.activeTacticalTool === 'ZONE' && this.zoneStartLatLng) {
          const center = this.zoneStartLatLng;
          const radius = this.zoneDragged ? this.currentZoneRadius : 75;
          this.cancelActiveStroke();
          const ann: TacticalAnnotation = {
            id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            type: 'ZONE',
            authorId: this.playerId,
            authorName: this.playerName,
            timestamp: Date.now(),
            lat: Number(center.lat.toFixed(6)),
            lng: Number(center.lng.toFixed(6)),
            radiusMeters: radius
          };
          this.addAndBroadcastTactical(ann);
        } else {
          this.cancelActiveStroke();
        }
      });
    };

    // Mobile Touch Listeners
    el.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (this.isPopupOrControlTarget(e.target)) return;
        if (e.touches.length >= 2) {
          this.cancelActiveStroke();
          return;
        }
        if (e.touches.length === 1 && this.myRole === 'DETECTIVE' && isDragTool()) {
          startStroke(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );

    el.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length >= 2) {
          this.cancelActiveStroke();
          return;
        }
        if (this.isDrawingTactical && e.touches.length === 1) {
          if (e.cancelable) {
            e.preventDefault();
          }
          moveStroke(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    el.addEventListener('touchend', () => {
      if (this.isDrawingTactical) {
        finishStroke();
      }
    });

    el.addEventListener('touchcancel', () => {
      this.cancelActiveStroke();
    });

    // Desktop Mouse Listeners (for PC / responsive testing)
    el.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0 || this.isPopupOrControlTarget(e.target)) return;
      if (this.myRole === 'DETECTIVE' && isDragTool()) {
        startStroke(e.clientX, e.clientY);
      }
    });

    el.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isDrawingTactical) {
        moveStroke(e.clientX, e.clientY);
      }
    });

    el.addEventListener('mouseup', () => {
      if (this.isDrawingTactical) {
        finishStroke();
      }
    });
  }

  private placeTacticalStamp(
    type: 'GOING' | 'PING' | 'SUSPECT' | 'SIGHTING' | 'BLOCK',
    lat: number,
    lng: number
  ) {
    if (this.myRole !== 'DETECTIVE') return;
    const ann: TacticalAnnotation = {
      id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      type,
      authorId: this.playerId,
      authorName: this.playerName,
      timestamp: Date.now(),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6))
    };

    // For GOING ("Dort gehe ich hin"), attach detective's current GPS position so a red vector arrow points to the target!
    if (type === 'GOING' && this.currentLat !== null && this.currentLng !== null) {
      ann.originLat = Number(this.currentLat.toFixed(6));
      ann.originLng = Number(this.currentLng.toFixed(6));
    }

    this.addAndBroadcastTactical(ann);
  }

  private addAndBroadcastTactical(ann: TacticalAnnotation) {
    if (this.myRole !== 'DETECTIVE') return;
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
    this.applyTacticalAdd(ann);
    this.network.publishTactical({
      action: 'ADD',
      senderId: this.playerId,
      senderName: this.playerName,
      timestamp: Date.now(),
      annotation: ann
    });
  }

  public undoMyLastTactical() {
    if (this.myRole !== 'DETECTIVE') return;
    for (let i = this.tacticalAnnotations.length - 1; i >= 0; i--) {
      if (this.tacticalAnnotations[i].authorId === this.playerId) {
        this.removeTacticalAnnotation(this.tacticalAnnotations[i].id, true);
        this.showToast('Letzte Einzeichnung rückgängig gemacht');
        return;
      }
    }
  }

  public removeTacticalAnnotation(id: string, broadcast = true) {
    const layers = this.tacticalLayers.get(id);
    if (layers) {
      layers.forEach(l => l.remove());
      this.tacticalLayers.delete(id);
    }
    this.tacticalAnnotations = this.tacticalAnnotations.filter(a => a.id !== id);
    if (broadcast && this.myRole === 'DETECTIVE') {
      this.network.publishTactical({
        action: 'REMOVE',
        senderId: this.playerId,
        senderName: this.playerName,
        timestamp: Date.now(),
        annotationId: id
      });
    }
  }

  public clearAllTactical(broadcast = true) {
    if (this.tacticalAnnotations.length === 0) return;
    this.clearPendingArrowStart();
    this.tacticalLayers.forEach(layers => layers.forEach(l => l.remove()));
    this.tacticalLayers.clear();
    this.tacticalArrowUpdaters = [];
    this.tacticalAnnotations = [];
    if (broadcast && this.myRole === 'DETECTIVE') {
      this.network.publishTactical({
        action: 'CLEAR_ALL',
        senderId: this.playerId,
        senderName: this.playerName,
        timestamp: Date.now()
      });
      this.showToast('Alle Taktik-Einzeichnungen gelöscht');
    }
  }

  private handleTacticalEvent(msg: TacticalEventMessage) {
    // Strict role guard: Mister X never processes or renders Detective tactical drawings
    if (this.myRole !== 'DETECTIVE' || this.viewState !== 'GAME') return;

    switch (msg.action) {
      case 'ADD': {
        if (msg.annotation && msg.senderId !== this.playerId) {
          const added = this.applyTacticalAdd(msg.annotation);
          if (added) {
            const labelMap: Record<TacticalAnnotationType, string> = {
              GOING: 'geht zu markiertem Ziel!',
              PING: 'hat einen roten Ping gesetzt',
              ARROW: 'hat einen Richtungspfeil gesetzt',
              LINE: 'hat eine Fluchtroute gezeichnet',
              ZONE: 'hat ein Suchgebiet markiert',
              SIGHTING: 'meldet SICHTUNG (!)',
              SUSPECT: 'hat Verdacht (?) markiert',
              BLOCK: 'hat Weg gesperrt (X)'
            };
            this.showToast(`${msg.senderName} ${labelMap[msg.annotation.type]}`);
          }
        }
        break;
      }
      case 'REMOVE': {
        if (msg.annotationId && msg.senderId !== this.playerId) {
          this.removeTacticalAnnotation(msg.annotationId, false);
        }
        break;
      }
      case 'CLEAR_ALL': {
        if (msg.senderId !== this.playerId) {
          this.clearAllTactical(false);
          this.showToast(`${msg.senderName} hat die Taktik-Karte geleert`);
        }
        break;
      }
      case 'REQUEST_SYNC': {
        if (msg.senderId !== this.playerId && this.tacticalAnnotations.length > 0) {
          this.network.publishTactical({
            action: 'SYNC',
            senderId: this.playerId,
            senderName: this.playerName,
            timestamp: Date.now(),
            annotations: this.tacticalAnnotations
          });
        }
        break;
      }
      case 'SYNC': {
        if (msg.annotations && msg.senderId !== this.playerId) {
          msg.annotations.forEach(a => this.applyTacticalAdd(a));
        }
        break;
      }
    }
  }

  private applyTacticalAdd(ann: TacticalAnnotation): boolean {
    if (this.tacticalAnnotations.some(a => a.id === ann.id)) return false;
    // Allow up to 150 active pings & arrows simultaneously
    if (this.tacticalAnnotations.length >= 150) {
      const oldest = this.tacticalAnnotations[0];
      this.removeTacticalAnnotation(oldest.id, false);
    }
    this.tacticalAnnotations.push(ann);
    this.renderTacticalAnnotation(ann);
    return true;
  }

  private buildTacticalPopup(ann: TacticalAnnotation, title: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'mx-tactic-popup';
    const timeStr = new Date(ann.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    container.innerHTML = `
      <div class="mx-tactic-popup-title">${this.escapeHtml(title)}</div>
      <div class="mx-tactic-popup-meta">Von ${this.escapeHtml(ann.authorName)} • ${timeStr}</div>
      <button type="button" class="mx-tactic-popup-del">Eintrag löschen</button>
    `;
    const btn = container.querySelector('.mx-tactic-popup-del');
    if (btn) {
      L.DomEvent.on(btn as HTMLElement, 'click', (ev: Event) => {
        L.DomEvent.stopPropagation(ev);
        this.ngZone.run(() => {
          this.gameMap?.closePopup();
          this.removeTacticalAnnotation(ann.id, true);
        });
      });
    }
    return container;
  }

  private renderTacticalAnnotation(ann: TacticalAnnotation) {
    if (!this.gameMap || this.myRole !== 'DETECTIVE') return;

    const layers: L.Layer[] = [];
    const safeAuthor = this.escapeHtml(ann.authorName);

    if ((ann.type === 'LINE' || ann.type === 'ARROW') && ann.points && ann.points.length >= 2) {
      const isArrow = ann.type === 'ARROW';
      const halo = L.polyline(ann.points, {
        color: '#ffffff',
        weight: isArrow ? 7.5 : 7,
        opacity: 0.94,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.gameMap);

      const core = L.polyline(ann.points, {
        color: '#dc2626',
        weight: isArrow ? 4 : 3.5,
        opacity: 1,
        dashArray: isArrow ? undefined : '8, 6',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.gameMap);

      const popupEl = this.buildTacticalPopup(ann, isArrow ? 'Richtungspfeil' : 'Fluchtroute / Linie');
      halo.bindPopup(popupEl);
      core.bindPopup(popupEl);

      // Red start anchor dot
      const startPt = ann.points[0];
      const startIcon = L.divIcon({
        className: 'mx-tactic-div-icon',
        html: `<div class="tactic-line-start"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      const startMarker = L.marker(startPt, { icon: startIcon, interactive: false }).addTo(this.gameMap);

      // Red directional arrowhead at endpoint
      const endPt = ann.points[ann.points.length - 1];
      const prevPt = ann.points[ann.points.length - 2];
      const arrowMarker = L.marker(endPt, {
        icon: this.createArrowIcon(prevPt, endPt),
        zIndexOffset: 430
      }).addTo(this.gameMap);
      arrowMarker.bindPopup(popupEl);

      const updateArrow = () => {
        if (!this.gameMap || !this.tacticalLayers.has(ann.id)) return;
        arrowMarker.setIcon(this.createArrowIcon(prevPt, endPt));
      };
      this.tacticalArrowUpdaters.push(updateArrow);

      layers.push(halo, core, startMarker, arrowMarker);
    } else if (ann.type === 'ZONE' && ann.lat !== undefined && ann.lng !== undefined) {
      const radius = ann.radiusMeters || 75;
      const center: L.LatLngTuple = [ann.lat, ann.lng];

      const haloCircle = L.circle(center, {
        radius,
        color: '#ffffff',
        weight: 5.5,
        opacity: 0.88,
        fill: false,
        interactive: false
      }).addTo(this.gameMap);

      const zoneCircle = L.circle(center, {
        radius,
        color: '#dc2626',
        weight: 2.5,
        dashArray: '7, 6',
        fillColor: '#ef4444',
        fillOpacity: 0.14
      }).addTo(this.gameMap);

      const popupEl = this.buildTacticalPopup(ann, `Suchgebiet (${radius}m)`);
      zoneCircle.bindPopup(popupEl);

      const labelIcon = L.divIcon({
        className: 'mx-tactic-div-icon',
        html: `<div class="tactic-zone-tag">? ${radius}m • ${safeAuthor}</div>`,
        iconSize: [126, 24],
        iconAnchor: [63, 12]
      });
      const labelMarker = L.marker(center, { icon: labelIcon, zIndexOffset: 420 }).addTo(this.gameMap);
      labelMarker.bindPopup(popupEl);

      layers.push(haloCircle, zoneCircle, labelMarker);
    } else if (ann.lat !== undefined && ann.lng !== undefined) {
      const center: L.LatLngTuple = [ann.lat, ann.lng];
      let svg = '';
      let tagText = '';
      let popupTitle = '';
      let variantClass = '';
      let hasPulse = false;

      if (ann.type === 'GOING') {
        variantClass = 'is-going';
        hasPulse = true;
        tagText = `Gehe hin • ${safeAuthor}`;
        popupTitle = `${ann.authorName}: Dort gehe ich hin`;
        svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;

        // Draw dashed red movement vector from detective's origin GPS position to destination
        if (ann.originLat !== undefined && ann.originLng !== undefined) {
          const moveDist = this.calculateDistance(ann.originLat, ann.originLng, ann.lat, ann.lng);
          if (moveDist >= 10) {
            const origPt: [number, number] = [ann.originLat, ann.originLng];
            const destPt: [number, number] = [ann.lat, ann.lng];
            const moveHalo = L.polyline([origPt, destPt], {
              color: '#ffffff',
              weight: 5.5,
              opacity: 0.85,
              lineCap: 'round',
              interactive: false
            }).addTo(this.gameMap);
            const moveLine = L.polyline([origPt, destPt], {
              color: '#dc2626',
              weight: 2.8,
              opacity: 0.95,
              dashArray: '5, 7',
              lineCap: 'round'
            }).addTo(this.gameMap);
            moveLine.bindPopup(this.buildTacticalPopup(ann, popupTitle));

            const midPt: [number, number] = [
              (ann.originLat + ann.lat) / 2,
              (ann.originLng + ann.lng) / 2
            ];
            const midArrow = L.marker(midPt, {
              icon: this.createArrowIcon(origPt, destPt),
              interactive: false,
              zIndexOffset: 425
            }).addTo(this.gameMap);
            const updateMidArrow = () => {
              if (!this.gameMap || !this.tacticalLayers.has(ann.id)) return;
              midArrow.setIcon(this.createArrowIcon(origPt, destPt));
            };
            this.tacticalArrowUpdaters.push(updateMidArrow);

            layers.push(moveHalo, moveLine, midArrow);
          }
        }
      } else if (ann.type === 'PING') {
        variantClass = 'is-ping';
        hasPulse = true;
        tagText = `Ping • ${safeAuthor}`;
        popupTitle = 'Roter Team-Ping';
        svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/></svg>`;
      } else if (ann.type === 'SUSPECT') {
        variantClass = 'is-suspect';
        tagText = `Verdacht • ${safeAuthor}`;
        popupTitle = 'Verdacht (?)';
        svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.6-2.5 2-2.5 3.8"/><circle cx="12" cy="16.8" r="0.6" fill="currentColor"/></svg>`;
      } else if (ann.type === 'SIGHTING') {
        variantClass = 'is-sighting';
        hasPulse = true;
        tagText = `Sichtung! • ${safeAuthor}`;
        popupTitle = 'Sichtung (!)';
        svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>`;
      } else {
        variantClass = 'is-block';
        tagText = `Sperre • ${safeAuthor}`;
        popupTitle = 'Weg gesperrt / Abgedeckt';
        svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/><line x1="15.5" y1="8.5" x2="8.5" y2="15.5"/></svg>`;
      }

      const pinHtml = `
        <div class="tactic-stamp-marker ${variantClass}">
          ${hasPulse ? '<div class="tactic-pulse-ring"></div>' : ''}
          <div class="tactic-stamp-badge">${svg}</div>
          <div class="tactic-stamp-label">${tagText}</div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'mx-tactic-div-icon',
        html: pinHtml,
        iconSize: [96, 54],
        iconAnchor: [48, 26]
      });

      const marker = L.marker(center, { icon, zIndexOffset: 460 }).addTo(this.gameMap);
      marker.bindPopup(this.buildTacticalPopup(ann, popupTitle));
      layers.push(marker);
    }

    if (layers.length > 0) {
      this.tacticalLayers.set(ann.id, layers);
    }
  }

  private createArrowIcon(prevPt: [number, number], endPt: [number, number]): L.DivIcon {
    let angleDeg = 0;
    if (this.gameMap) {
      try {
        const p1 = this.gameMap.latLngToContainerPoint(prevPt);
        const p2 = this.gameMap.latLngToContainerPoint(endPt);
        angleDeg = Math.round((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI + 90);
      } catch (e) {}
    }
    return L.divIcon({
      className: 'mx-tactic-div-icon',
      html: `
        <div class="tactic-arrow-head" style="transform: rotate(${angleDeg}deg)">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 2 L21 20 L12 15.5 L3 20 Z" fill="#dc2626" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/>
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  private refreshTacticalArrowheads() {
    this.tacticalArrowUpdaters.forEach(fn => fn());
  }

  // --- SIMULATOR / TEST-MODUS CONTROLS ---

  public toggleSimulationMode() {
    this.simulationMode = !this.simulationMode;
    if (this.simulationMode) {
      if (this.activeTacticalTool !== 'NONE') {
        this.selectTacticalTool('NONE');
      }
      this.showToast('Test-Modus aktiv — Klicke auf die Karte zum Bewegen');
    } else {
      this.showToast('Test-Modus beendet — Echtes GPS aktiv');
    }
  }

  public simulateStep(direction: 'N' | 'S' | 'E' | 'W') {
    if (!this.currentLat || !this.currentLng) {
      this.currentLat = this.settings.centerLat;
      this.currentLng = this.settings.centerLng;
    }

    const step = 0.0003; // approx 30 meters
    let newLat = this.currentLat;
    let newLng = this.currentLng;

    if (direction === 'N') newLat += step;
    if (direction === 'S') newLat -= step;
    if (direction === 'E') newLng += step * 1.5;
    if (direction === 'W') newLng -= step * 1.5;

    this.simulateMove(newLat, newLng);
  }

  private simulateMove(lat: number, lng: number) {
    this.currentLat = lat;
    this.currentLng = lng;
    this.onPositionUpdate(lat, lng, 10, 0);
    this.network.publishLocation(lat, lng, 10, 0);
  }

  // --- MATH & UTILITIES ---

  // Haversine formula in meters
  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Calculate cardinal direction (N, NO, O, SO, S, SW, W, NW)
  public getDirectionToMisterX(): string {
    if (!this.currentLat || !this.currentLng || !this.lastPing) return '';
    const dLat = this.lastPing.lat - this.currentLat;
    const dLng = this.lastPing.lng - this.currentLng;
    const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
    const normalized = (angle + 360) % 360;

    const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(normalized / 45) % 8;
    return directions[index];
  }

  public formatSeconds(totalSecs: number): string {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public showToast(text: string) {
    this.notificationText = text;
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      this.notificationText = '';
    }, 4000);
  }

  public toggleMute() {
    this.soundMuted = !this.soundMuted;
    this.audio.setSoundEnabled(!this.soundMuted);
  }

  public togglePingHistory() {
    this.showPingHistory = !this.showPingHistory;
    if (this.showPingHistory) {
      this.showPlayerListDrawer = false;
      this.closeTacticalBar();
    }
  }

  public togglePlayerListDrawer() {
    this.showPlayerListDrawer = !this.showPlayerListDrawer;
    if (this.showPlayerListDrawer) {
      this.showPingHistory = false;
      this.closeTacticalBar();
    }
  }

  public closeAllDrawers() {
    this.showPingHistory = false;
    this.showPlayerListDrawer = false;
  }

  public centerOnPing(ping: PingRecord) {
    if (!this.gameMap) return;
    this.gameMap.setView([ping.lat, ping.lng], 16);
    this.closeAllDrawers();
    this.showToast(`Auf Ping #${ping.pingNumber} zentriert`);
  }

  public closeRoleRevealModal() {
    this.showRoleRevealModal = false;
  }

  public setMapBearing(deg: number, notify = true) {
    this.mapBearing = Math.round((deg % 360 + 360) % 360);

    let rotated = false;
    if (this.gameMap && typeof (this.gameMap as any).setBearing === 'function') {
      try {
        (this.gameMap as any).setBearing(this.mapBearing);
        rotated = true;
      } catch (e) {
        console.warn('Native setBearing error:', e);
      }
    }

    if (!rotated && this.mapContainer?.nativeElement) {
      this.mapContainer.nativeElement.style.transform = `rotate(${this.mapBearing}deg)`;
      this.mapContainer.nativeElement.style.transformOrigin = 'center center';
    }

    this.refreshTacticalArrowheads();

    if (notify) {
      if (this.mapBearing === 0) {
        this.showToast('Karte nach Norden ausgerichtet (0°)');
      } else {
        this.showToast(`Ausrichtung: ${this.mapBearing}°`);
      }
    }
  }

  public rotateMap(delta: number) {
    this.setMapBearing(this.mapBearing + delta, true);
  }

  public resetNorth() {
    this.setMapBearing(0, true);
  }

  private touchStartAngle = 0;
  private touchStartBearing = 0;
  private isTwoFingerRotating = false;

  private initTouchRotation() {
    if (!this.mapContainer?.nativeElement) return;
    const el = this.mapContainer.nativeElement;

    el.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        this.isTwoFingerRotating = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        this.touchStartAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        this.touchStartBearing = this.mapBearing;
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e: TouchEvent) => {
      if (this.isTwoFingerRotating && e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const delta = currentAngle - this.touchStartAngle;
        const newBearing = Math.round((this.touchStartBearing - delta) % 360 + 360) % 360;
        this.setMapBearing(newBearing, false);
      }
    }, { passive: true });

    el.addEventListener('touchend', (e: TouchEvent) => {
      if (e.touches.length < 2) {
        this.isTwoFingerRotating = false;
      }
    }, { passive: true });
  }

  private async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
      }
    } catch (e) {}
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch (e) {}
      this.wakeLockSentinel = null;
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (this.viewState === 'GAME') {
        this.requestWakeLock();
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.ngZone.run(() => {
              this.currentLat = pos.coords.latitude;
              this.currentLng = pos.coords.longitude;
              this.gpsAccuracy = Math.round(pos.coords.accuracy);
              this.onPositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.heading || 0);
            });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      }

      if (this.roomCode && !this.network.isConnected()) {
        this.network.reconnect();
      }

      if (!this.isHost && this.roomCode && this.viewState !== 'GAME') {
        this.network.publishEvent({
          type: 'REQUEST_SYNC',
          senderId: this.playerId,
          senderName: this.playerName,
          timestamp: Date.now(),
          payload: {}
        });
      }

      if (this.viewState === 'GAME' && this.myRole === 'DETECTIVE' && this.roomCode) {
        this.network.publishTactical({
          action: 'REQUEST_SYNC',
          senderId: this.playerId,
          senderName: this.playerName,
          timestamp: Date.now()
        });
      }
    }
  };

  private handleOnline = () => {
    if (this.roomCode) {
      this.network.reconnect();
    }
  };
}
