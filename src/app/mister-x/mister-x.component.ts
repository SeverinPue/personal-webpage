import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import * as QRCode from 'qrcode';
import { MisterXNetworkService } from './mister-x-network.service';
import { MisterXAudioService } from './mister-x-audio.service';
import { Player, Role, GameStatus, GameSettings, PingRecord, GameEventMessage } from './mister-x.types';

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
  public simulationMode = false;
  public showSimControls = false;

  // UI state
  public showQrModal = false;
  public qrCodeDataUrl = '';
  public copySuccess = false;
  public showPingHistory = false;
  public showPlayerListDrawer = false;
  public soundMuted = false;
  public notificationText = '';
  private notificationTimer: any = null;
  public connectionError = '';
  public connecting = false;

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

    // Check query params for room code (invite link)
    this.route.queryParams.subscribe(params => {
      if (params['room']) {
        this.roomCode = params['room'].toUpperCase().trim();
      }
    });

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
    this.stopGpsTracking();
    this.stopPingTimer();
    this.stopLocationHeartbeat();
    this.network.disconnect();
    this.subs.forEach(s => s.unsubscribe());
    if (this.gameMap) this.gameMap.remove();
    if (this.lobbyMap) this.lobbyMap.remove();
  }

  // --- LOBBY CREATION & JOINING ---

  public createLobby() {
    if (!this.playerName.trim()) return;
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
    if (!this.playerName.trim() || !this.roomCode.trim()) return;
    localStorage.setItem('mx_player_name', this.playerName.trim());
    this.roomCode = this.roomCode.toUpperCase().trim();
    this.isHost = false;
    this.joinRoomInternal();
  }

  private async joinRoomInternal() {
    this.connecting = true;
    this.connectionError = '';

    this.myPlayer = {
      id: this.playerId,
      name: this.playerName.trim(),
      isHost: this.isHost,
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

    try {
      await this.network.connect(this.roomCode, this.myPlayer);
      this.connecting = false;
      this.viewState = 'LOBBY';
      this.players = [this.myPlayer];
      this.startGpsTracking();
      this.generateQrCode();

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
      this.connecting = false;
      this.connectionError = 'Verbindung fehlgeschlagen: ' + (err.message || 'Server nicht erreichbar');
    }
  }

  public leaveLobby() {
    this.stopGpsTracking();
    this.stopPingTimer();
    this.stopLocationHeartbeat();
    this.network.disconnect();
    this.viewState = 'JOIN_SCREEN';
    this.gameStatus = 'LOBBY';
    this.players = [];
    this.myRole = 'UNASSIGNED';
    this.pings = [];
    this.lastPing = null;
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
    QRCode.toDataURL(this.getShareUrl(), { width: 260, margin: 1 }, (err, url) => {
      if (!err) {
        this.qrCodeDataUrl = url;
      }
    });
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
      color: '#bd4913',
      fillColor: '#bd4913',
      fillOpacity: 0.15,
      weight: 3,
      dashArray: '6, 6'
    }).addTo(this.lobbyMap);

    // Center pin icon
    const centerIcon = L.divIcon({
      className: 'mx-center-marker',
      html: `<div style="background:#bd4913; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
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
        this.updateLobbyMapCenter();
        this.broadcastSettings();
      });

      this.lobbyMap.on('click', (e: L.LeafletMouseEvent) => {
        this.settings.centerLat = e.latlng.lat;
        this.settings.centerLng = e.latlng.lng;
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

    this.audio.playStartSound();
    this.showToast(`Spiel gestartet! Du bist: ${this.myRole === 'MISTER_X' ? '🎩 MISTER X' : '🕵️ DETEKTIV'}`);

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

    const center: L.LatLngTuple = [this.settings.centerLat, this.settings.centerLng];
    this.gameMap = L.map(this.mapContainer.nativeElement, {
      center: center,
      zoom: 15,
      zoomControl: false // Custom controls in UI
    });

    // Dark/tactical styled tiles or standard OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.gameMap);

    // Boundary zone circle
    this.boundaryCircle = L.circle(center, {
      radius: this.settings.radiusMeters,
      color: '#094456',
      fillColor: '#31636b',
      fillOpacity: 0.1,
      weight: 3,
      dashArray: '8, 8'
    }).addTo(this.gameMap);

    // Breadcrumb trail polyline for Mister X's past pings
    this.pingTrailPolyline = L.polyline([], {
      color: '#e74c3c',
      weight: 3,
      opacity: 0.7,
      dashArray: '4, 8'
    }).addTo(this.gameMap);

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

    // Trigger initial render
    setTimeout(() => {
      this.gameMap?.invalidateSize();
      this.centerOnMe();
      this.renderAllPlayerMarkers();
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

    // Check boundary
    const distFromCenter = this.calculateDistance(lat, lng, this.settings.centerLat, this.settings.centerLng);
    this.isOutOfBounds = distFromCenter > this.settings.radiusMeters;
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
    this.showToast(`🚨 PING #${record.pingNumber}: Mister X wurde geortet!`);

    // Add marker on Leaflet map
    this.addPingMarkerToMap(record);

    // Update distance calculation
    if (this.currentLat && this.currentLng) {
      this.distanceToMisterX = Math.round(this.calculateDistance(this.currentLat, this.currentLng, record.lat, record.lng));
    }
  }

  private addPingMarkerToMap(record: PingRecord) {
    if (!this.gameMap) return;

    // Stylized Sonar Ping marker
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
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([record.lat, record.lng], { icon })
      .addTo(this.gameMap)
      .bindPopup(`<b>Ping #${record.pingNumber}</b><br>${new Date(record.timestamp).toLocaleTimeString()}`);

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
    this.showToast('Popup minimiert. Fang-Button bleibt aktiv!');
  }

  public openCatchModal() {
    if (this.canCatchMisterX) {
      this.showCatchModal = true;
    }
  }

  public catchMisterX() {
    const maxRadius = this.settings.catchRadiusMeters || 10;
    if (!this.canCatchMisterX && this.distanceToMisterX !== null && this.distanceToMisterX > maxRadius) {
      this.showToast(`Zu weit entfernt (${this.distanceToMisterX}m)! Du musst innerhalb von ${maxRadius}m sein.`);
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
    this.showToast(`🎉 GEFANGEN! Mister X wurde von ${catcherName} geschnappt!`);
  }

  public restartGame() {
    if (!this.isHost) return;
    this.gameStatus = 'LOBBY';
    this.viewState = 'LOBBY';
    this.pings = [];
    this.lastPing = null;
    this.canCatchMisterX = false;
    this.misterXCaughtBy = '';
    this.showCatchModal = false;
    this.catchModalDismissed = false;
    this.stopLocationHeartbeat();

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
      payload: { restartToLobby: true }
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

      case 'SYNC_STATE': {
        if (!this.isHost && msg.payload.settings) {
          this.settings = msg.payload.settings;
          this.players = msg.payload.players || this.players;

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
        this.gameStatus = 'LOBBY';
        this.viewState = 'LOBBY';
        this.pings = [];
        this.lastPing = null;
        this.stopPingTimer();
        this.stopLocationHeartbeat();
        this.showToast('Host hat das Spiel beendet / neue Runde gestartet.');
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

    // Check out of bounds
    const distFromCenter = this.calculateDistance(loc.lat, loc.lng, this.settings.centerLat, this.settings.centerLng);
    player.isOutOfBounds = distFromCenter > this.settings.radiusMeters;

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

    const color = isMisterX ? '#e74c3c' : (isMe ? '#0284c7' : '#10b981');
    const roleIcon = isMisterX ? '🎩' : '🕵️';
    const label = isMe ? `${player.name} (Du)` : (isMisterX ? player.name : `${player.name} (Detektiv)`);

    const html = `
      <div class="player-custom-marker ${isMe ? 'is-me' : ''} ${isMisterX ? 'is-misterx' : 'is-detective'}">
        <div class="marker-badge" style="background:${color};">
          <span class="marker-icon">${roleIcon}</span>
        </div>
        <div class="marker-label">${label}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'mx-custom-player-icon',
      html: html,
      iconSize: [60, 52],
      iconAnchor: [30, 42]
    });

    if (!marker) {
      marker = L.marker(latlng, { icon, zIndexOffset: isMe ? 1000 : 500 }).addTo(this.gameMap);
      this.playerMarkers.set(player.id, marker);
    } else {
      marker.setLatLng(latlng);
      marker.setIcon(icon);
    }
  }

  // --- SIMULATOR / TEST-MODUS CONTROLS ---

  public toggleSimulationMode() {
    this.simulationMode = !this.simulationMode;
    if (this.simulationMode) {
      this.showToast('Test-Modus aktiviert: Klicke auf die Karte, um dich zu bewegen!');
      if (this.gameMap) {
        this.gameMap.on('click', (e: L.LeafletMouseEvent) => {
          if (this.simulationMode) {
            this.simulateMove(e.latlng.lat, e.latlng.lng);
          }
        });
      }
    } else {
      this.showToast('Test-Modus deaktiviert. Nutze wieder echtes GPS.');
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
    }
  }

  public togglePlayerListDrawer() {
    this.showPlayerListDrawer = !this.showPlayerListDrawer;
    if (this.showPlayerListDrawer) {
      this.showPingHistory = false;
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
}
