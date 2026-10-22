import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  NgZone
} from '@angular/core';
import {
  BuildingDefinition,
  BuildingType,
  CampEvent,
  CamperWalker,
  GameQuest,
  GameResources,
  GameStateSummary,
  PlacedBuilding,
  ResourceCost
} from './conveniat-game.types';
import { ConveniatAudioService } from './conveniat-audio.service';
import { MINIGAME_QUESTIONS } from './conveniat-minigames.data';
import { MinigameCategory, MinigameQuestion } from './conveniat-game.types';

export const BUILDING_DEFS: Record<BuildingType, BuildingDefinition> = {
  campfire: {
    type: 'campfire',
    name: 'Lagerfeuer (Zentrum)',
    category: 'infrastruktur',
    description: 'Das Herz deiner Zeltstadt! Erhöhe seine Stufe, um neue Cevi-Bauten und mehr Lagerkapazität freizuschalten.',
    icon: '🔥',
    baseCost: { wood: 0, blachen: 0, money: 0 },
    costMultiplier: 2.2,
    camperCapacity: 20,
    woodProduction: 1,
    blachenProduction: 0.5,
    moneyProduction: 1,
    spiritProduction: 2,
    size: { width: 2, height: 2 },
    minCampfireLevel: 1,
    maxLevel: 5
  },
  spatzenzelt: {
    type: 'spatzenzelt',
    name: 'Spatzenzelt (2er)',
    category: 'zelte',
    description: 'Kleines, wendiges 2-Personen-Zelt aus 4 Militärblachen. Perfekt für die ersten Cevianer.',
    icon: '⛺',
    baseCost: { wood: 15, blachen: 10, money: 10 },
    costMultiplier: 1.5,
    camperCapacity: 2,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 0.2,
    spiritProduction: 0.2,
    size: { width: 1, height: 1 },
    minCampfireLevel: 1,
    maxLevel: 3
  },
  firstzelt: {
    type: 'firstzelt',
    name: 'Firstzelt (6er)',
    category: 'zelte',
    description: 'Das bewährte Gruppenleiter- & Gruppenzelt aus 8 Blachen mit solider Firststange.',
    icon: '🎪',
    baseCost: { wood: 45, blachen: 30, money: 35 },
    costMultiplier: 1.55,
    camperCapacity: 6,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 0.6,
    spiritProduction: 0.5,
    size: { width: 2, height: 1 },
    minCampfireLevel: 2,
    maxLevel: 3
  },
  grosszelt: {
    type: 'grosszelt',
    name: 'Jurte / Grosszelt',
    category: 'zelte',
    description: 'Grosses Rundzelt für ganze Cevi-Stämme mit Rauchabzug in der Mitte.',
    icon: '🛖',
    baseCost: { wood: 110, blachen: 80, money: 90 },
    costMultiplier: 1.6,
    camperCapacity: 16,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 1.5,
    spiritProduction: 1.2,
    size: { width: 2, height: 2 },
    minCampfireLevel: 3,
    maxLevel: 3
  },
  sarasani: {
    type: 'sarasani',
    name: 'Sarasani (Riesenzelt)',
    category: 'zelte',
    description: 'Das Wahrzeichen jedes Grosslagers! Ein riesiges Blachendach an bis zu 2 Masten aufgehängt. Bietet Schutz vor Regen und riesigen Lager-Spirit.',
    icon: '🏕️',
    baseCost: { wood: 320, blachen: 220, money: 260 },
    costMultiplier: 1.7,
    camperCapacity: 120,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 3,
    spiritProduction: 4,
    size: { width: 3, height: 3 },
    minCampfireLevel: 4,
    maxLevel: 3
  },
  wood_depot: {
    type: 'wood_depot',
    name: 'Holzsammelstelle',
    category: 'pionier',
    description: 'Sammelt und lagert Pionierholz aus den Wäldern des Obergoms für Bünde und Zeltstangen.',
    icon: '🪵',
    baseCost: { wood: 20, blachen: 10, money: 25 },
    costMultiplier: 1.6,
    camperCapacity: 0,
    woodProduction: 3.5,
    blachenProduction: 0,
    moneyProduction: 0,
    spiritProduction: 0.1,
    size: { width: 2, height: 2 },
    minCampfireLevel: 1,
    maxLevel: 4
  },
  blachen_depot: {
    type: 'blachen_depot',
    name: 'Materialzelt & Blachen',
    category: 'pionier',
    description: 'Lagert und flickt Schweizer Militärblachen, Seile und Heringe für das gesamte Lager.',
    icon: '🧵',
    baseCost: { wood: 35, blachen: 15, money: 35 },
    costMultiplier: 1.6,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 2.5,
    moneyProduction: 0,
    spiritProduction: 0.1,
    size: { width: 2, height: 2 },
    minCampfireLevel: 2,
    maxLevel: 4
  },
  kitchen: {
    type: 'kitchen',
    name: 'Feldküche (Hörnli & Ghackets)',
    category: 'infrastruktur',
    description: 'Hier brodelt der Lagertee und feine Hörnli mit Apfelmus! Hält die Cevianer satt und glücklich.',
    icon: '🍲',
    baseCost: { wood: 80, blachen: 45, money: 85 },
    costMultiplier: 1.6,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 1.5,
    spiritProduction: 3,
    size: { width: 2, height: 2 },
    minCampfireLevel: 2,
    maxLevel: 3
  },
  kiosk: {
    type: 'kiosk',
    name: 'Cevi-Kiosk & Merch',
    category: 'infrastruktur',
    description: 'Verkauft Cevi-Schleckzeug, Krawatten, Pfadicrème und Conveniat 27 T-Shirts für wertvolle Batzen.',
    icon: '🍫',
    baseCost: { wood: 65, blachen: 35, money: 60 },
    costMultiplier: 1.65,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 4.5,
    spiritProduction: 1,
    size: { width: 2, height: 2 },
    minCampfireLevel: 2,
    maxLevel: 4
  },
  pioneer_tower: {
    type: 'pioneer_tower',
    name: 'Pionierturm',
    category: 'pionier',
    description: 'Meisterwerk der Cevi-Pioniertechnik! Nur mit Stangen und Seilbünden ohne Schrauben erbaut.',
    icon: '🔭',
    baseCost: { wood: 180, blachen: 40, money: 130 },
    costMultiplier: 1.7,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 2,
    spiritProduction: 4.5,
    size: { width: 2, height: 2 },
    minCampfireLevel: 3,
    maxLevel: 3
  },
  sanitaet: {
    type: 'sanitaet',
    name: 'Sanitätszelt (SanZelt)',
    category: 'infrastruktur',
    description: 'Versorgt Wanderblasen, Zeckenbisse und Schürfungen. Gibt Sicherheit und Zuversicht.',
    icon: '🩹',
    baseCost: { wood: 95, blachen: 65, money: 110 },
    costMultiplier: 1.6,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 1,
    spiritProduction: 2.5,
    size: { width: 2, height: 2 },
    minCampfireLevel: 3,
    maxLevel: 3
  },
  flagpole: {
    type: 'flagpole',
    name: 'Cevi-Fahnenmast',
    category: 'pionier',
    description: 'Hoch aufragender Mast mit dem rot-blauen Cevi-Kreuz. Weht stolz über dem Obergoms!',
    icon: '🚩',
    baseCost: { wood: 40, blachen: 15, money: 30 },
    costMultiplier: 1.5,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 0.5,
    spiritProduction: 2,
    size: { width: 1, height: 1 },
    minCampfireLevel: 1,
    maxLevel: 3
  },
  path: {
    type: 'path',
    name: 'Holzschnitzelweg',
    category: 'wege',
    description: 'Verbindet Zelte und Bauten über die Flugplatzwiese, hält Schlamm fern.',
    icon: '🪵',
    baseCost: { wood: 2, blachen: 0, money: 1 },
    costMultiplier: 1.2,
    camperCapacity: 0,
    woodProduction: 0,
    blachenProduction: 0,
    moneyProduction: 0,
    spiritProduction: 0.05,
    size: { width: 1, height: 1 },
    minCampfireLevel: 1,
    maxLevel: 1
  }
};

@Component({
  selector: 'app-conveniat-game',
  templateUrl: './conveniat-game.component.html',
  styleUrls: ['./conveniat-game.component.scss']
})
export class ConveniatGameComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  public buildingDefs = BUILDING_DEFS;
  public readonly gridSize = 18;
  public readonly tileWidth = 64;
  public readonly tileHeight = 32;
  public readonly Math = Math;

  // Ressourcen
  public resources: GameResources = {
    wood: 120,
    blachen: 80,
    money: 100,
    spirit: 50,
    maxWood: 350,
    maxBlachen: 250,
    maxMoney: 500
  };

  // Lagerteilnehmende
  public camperCount = 8;
  public camperCapacity = 16;
  public targetCampers = 5000;

  // Bau- und Platzierungszustand
  public placedBuildings: PlacedBuilding[] = [];
  public selectedBuildingType: BuildingType | null = null;
  public selectedPlacedBuilding: PlacedBuilding | null = null;
  public hoveredTile: { x: number; y: number } | null = null;
  public activeCategory: 'zelte' | 'pionier' | 'infrastruktur' | 'wege' = 'zelte';

  // Kamera & Interaktion
  public cameraX = 0;
  public cameraY = 0;
  public zoom = 1.0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private hasDragged = false;

  // Cevianer Wusel-Figuren (Walkers)
  public walkers: CamperWalker[] = [];

  // Modals & Panels
  public showInfoModal = false;
  public showQuestsModal = false;
  public showResetConfirm = false;
  public currentNotification: string | null = null;
  private notificationTimer: any = null;

  // Aktives Lager-Event
  public activeEvent: CampEvent | null = null;
  private nextEventTime = 0;

  // Quests & Meilensteine
  public quests: GameQuest[] = [];
  public completedQuestsCount = 0;

  // Wolken-Animation
  private cloudOffset = 0;

  // Cevi Minigames & Pitech Challenges
  public minigameQuestions = MINIGAME_QUESTIONS;
  public showMinigameModal = false;
  public activeMinigameCategory: MinigameCategory = 'knoten';
  public currentQuestionIndex = 0;
  public selectedAnswerIndex: number | null = null;
  public answerSubmitted = false;
  public isAnswerCorrect = false;
  public solvedQuestionIds = new Set<string>();

  // Loop & Ticks
  private animationFrameId: number | null = null;
  private productionInterval: any = null;
  private saveInterval: any = null;
  private flameAngle = 0;
  private lastTime = 0;

  constructor(
    public audio: ConveniatAudioService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initQuests();
    this.loadGame();
    this.initWalkers();

    // Start production tick (1 sec)
    this.productionInterval = setInterval(() => {
      this.gameTick();
    }, 1000);

    // Auto-save every 10 seconds
    this.saveInterval = setInterval(() => {
      this.saveGame();
    }, 10000);

    this.nextEventTime = Date.now() + 45000; // Erstes Event nach 45s

    // Center camera on campfire
    setTimeout(() => {
      this.centerOnCampfire();
    }, 50);

    // Start render loop outside Angular zone for high 60fps performance
    this.ngZone.runOutsideAngular(() => {
      this.lastTime = performance.now();
      const loop = (time: number) => {
        const delta = (time - this.lastTime) / 1000;
        this.lastTime = time;
        this.updateAnimation(delta);
        this.renderCanvas();
        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.productionInterval) {
      clearInterval(this.productionInterval);
    }
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
  }

  // --- Quests initialisieren ---
  private initQuests(): void {
    this.quests = [
      {
        id: 'q_spatzen',
        title: 'Erste Schlafplätze',
        description: 'Baue mindestens 2 Spatzenzelte für die anreisenden Cevianer.',
        target: 2,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 40, blachen: 25, money: 30, spirit: 15 },
        check: (s) => s.buildingsCount.spatzenzelt || 0
      },
      {
        id: 'q_wood',
        title: 'Pionierholz für Bünde',
        description: 'Errichte eine Holzsammelstelle im Obergoms.',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 60, blachen: 20, money: 40, spirit: 20 },
        check: (s) => s.buildingsCount.wood_depot || 0
      },
      {
        id: 'q_mat',
        title: 'Militärblachen lagern',
        description: 'Baue ein Materialzelt für Blachen & Seile.',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 30, blachen: 50, money: 40, spirit: 20 },
        check: (s) => s.buildingsCount.blachen_depot || 0
      },
      {
        id: 'q_campfire2',
        title: 'Großes Lagerfeuer',
        description: 'Bringe das zentrale Lagerfeuer auf Stufe 2.',
        target: 2,
        progress: 1,
        completed: false,
        claimed: false,
        reward: { wood: 100, blachen: 60, money: 100, spirit: 50 },
        check: (s) => s.campfireLevel
      },
      {
        id: 'q_firstzelt',
        title: 'Leiterzelte aufstellen',
        description: 'Baue mindestens 2 Firstzelte für Gruppenleiter.',
        target: 2,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 80, blachen: 50, money: 80, spirit: 35 },
        check: (s) => s.buildingsCount.firstzelt || 0
      },
      {
        id: 'q_kitchen',
        title: 'Lagerküche anheizen',
        description: 'Baue die Feldküche für Hörnli mit Ghackets & feinen Lagertee!',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 70, blachen: 40, money: 120, spirit: 60 },
        check: (s) => s.buildingsCount.kitchen || 0
      },
      {
        id: 'q_campers_50',
        title: 'Erste Abteilung ist da!',
        description: 'Erreiche 50 Cevianer im Lager.',
        target: 50,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 120, blachen: 80, money: 150, spirit: 80 },
        check: (s) => s.camperCount
      },
      {
        id: 'q_sarasani',
        title: 'Das Wunder vom Goms',
        description: 'Errichte einen monumentalen Sarasani!',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 300, blachen: 200, money: 400, spirit: 250 },
        check: (s) => s.buildingsCount.sarasani || 0
      },
      {
        id: 'q_tower',
        title: 'Höhenflug ohne Schrauben',
        description: 'Errichte einen Pionierturm aus reinen Holzbünden.',
        target: 1,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 200, blachen: 100, money: 250, spirit: 150 },
        check: (s) => s.buildingsCount.pioneer_tower || 0
      },
      {
        id: 'q_campers_500',
        title: 'Das Lager füllt sich!',
        description: 'Beherberge 500 Cevianer in deiner Zeltstadt.',
        target: 500,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 400, blachen: 300, money: 600, spirit: 400 },
        check: (s) => s.camperCount
      },
      {
        id: 'q_campers_5000',
        title: 'MIR SIND CEVI! – Bundeslager 2027',
        description: 'Erreiche das finale Ziel: 5\'000 Cevianer im Obergoms!',
        target: 5000,
        progress: 0,
        completed: false,
        claimed: false,
        reward: { wood: 2000, blachen: 2000, money: 5000, spirit: 2000 },
        check: (s) => s.camperCount
      }
    ];
  }

  // --- Spielstand Speichern / Laden ---
  private saveGame(): void {
    try {
      const data = {
        resources: this.resources,
        camperCount: this.camperCount,
        placedBuildings: this.placedBuildings,
        quests: this.quests.map(q => ({ id: q.id, completed: q.completed, claimed: q.claimed })),
        solvedQuestions: Array.from(this.solvedQuestionIds)
      };
      localStorage.setItem('conveniat_game_save_v1', JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save game state:', e);
    }
  }

  private loadGame(): void {
    try {
      const raw = localStorage.getItem('conveniat_game_save_v1');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.resources) this.resources = data.resources;
        if (data.camperCount) this.camperCount = data.camperCount;
        if (data.placedBuildings && Array.isArray(data.placedBuildings)) {
          this.placedBuildings = data.placedBuildings;
        }
        if (data.solvedQuestions && Array.isArray(data.solvedQuestions)) {
          this.solvedQuestionIds = new Set(data.solvedQuestions);
        }
        if (data.quests && Array.isArray(data.quests)) {
          data.quests.forEach((sq: { id: string; completed: boolean; claimed: boolean }) => {
            const q = this.quests.find(item => item.id === sq.id);
            if (q) {
              q.completed = sq.completed;
              q.claimed = sq.claimed;
            }
          });
        }
      }
    } catch (e) {
      console.warn('Could not load saved game state, starting fresh:', e);
    }

    // Falls noch kein Gebäude da ist: Initiales Lagerfeuer in der Mitte aufstellen!
    if (!this.placedBuildings.some(b => b.type === 'campfire')) {
      const mid = Math.floor(this.gridSize / 2) - 1;
      this.placedBuildings.push({
        id: 'campfire_initial',
        type: 'campfire',
        level: 1,
        gridX: mid,
        gridY: mid,
        constructedAt: Date.now(),
        lastProductionAt: Date.now()
      });

      // Plus 2 Spatzenzelte als Start
      this.placedBuildings.push({
        id: 'start_spatzen_1',
        type: 'spatzenzelt',
        level: 1,
        gridX: mid - 2,
        gridY: mid,
        constructedAt: Date.now(),
        lastProductionAt: Date.now()
      });
      this.placedBuildings.push({
        id: 'start_spatzen_2',
        type: 'spatzenzelt',
        level: 1,
        gridX: mid,
        gridY: mid - 2,
        constructedAt: Date.now(),
        lastProductionAt: Date.now()
      });
    }

    this.recalculateCapacities();
    this.updateQuestProgress();
  }

  public resetGame(): void {
    localStorage.removeItem('conveniat_game_save_v1');
    this.showResetConfirm = false;
    this.placedBuildings = [];
    this.resources = {
      wood: 120,
      blachen: 80,
      money: 100,
      spirit: 50,
      maxWood: 350,
      maxBlachen: 250,
      maxMoney: 500
    };
    this.camperCount = 8;
    this.selectedBuildingType = null;
    this.selectedPlacedBuilding = null;
    this.initQuests();
    this.loadGame();
    this.centerOnCampfire();
    this.showToast('Zeltstadt wurde auf Anfang zurückgesetzt!');
  }

  // --- Spielmechanik: Ticks & Produktion ---
  private gameTick(): void {
    let woodGen = 0;
    let blachenGen = 0;
    let moneyGen = 0;
    let spiritGen = 0;

    let multiplier = 1.0;
    if (this.activeEvent) {
      if (this.activeEvent.bonusType === 'production') multiplier = this.activeEvent.multiplier;
      if (this.activeEvent.bonusType === 'sun') multiplier = 1.35;
      if (this.activeEvent.bonusType === 'rain') multiplier = 0.85;

      // Check event expiration
      if (Date.now() - this.activeEvent.startedAt > this.activeEvent.durationMs) {
        this.showToast(`Lager-Event beendet: ${this.activeEvent.title}`);
        this.activeEvent = null;
      }
    }

    // Produktion aus Gebäuden
    for (const b of this.placedBuildings) {
      const def = this.buildingDefs[b.type];
      const lvlFactor = 1 + (b.level - 1) * 0.75;
      woodGen += def.woodProduction * lvlFactor;
      blachenGen += def.blachenProduction * lvlFactor;
      moneyGen += def.moneyProduction * lvlFactor;
      spiritGen += def.spiritProduction * lvlFactor;
    }

    this.resources.wood = Math.min(this.resources.maxWood, this.resources.wood + woodGen * multiplier);
    this.resources.blachen = Math.min(this.resources.maxBlachen, this.resources.blachen + blachenGen * multiplier);
    this.resources.money = Math.min(this.resources.maxMoney, this.resources.money + moneyGen * multiplier);
    this.resources.spirit = Math.min(1000, this.resources.spirit + spiritGen * multiplier);

    // Teilnehmende wachsen schrittweise an, bis die Kapazität erreicht ist
    if (this.camperCount < this.camperCapacity) {
      // Je höher Spirit & Sanitär, desto schneller reisen Cevianer an!
      const hasSanitaet = this.placedBuildings.some(b => b.type === 'sanitaet');
      const arrivalRate = 1 + Math.floor(this.resources.spirit / 40) + (hasSanitaet ? 2 : 0);
      this.camperCount = Math.min(this.camperCapacity, this.camperCount + arrivalRate);
    }

    // Zufalls-Events auslösen
    if (!this.activeEvent && Date.now() > this.nextEventTime) {
      this.triggerRandomEvent();
    }

    this.updateQuestProgress();
    this.syncWalkers();
  }

  // Kapazitäten neu berechnen
  private recalculateCapacities(): void {
    let capacity = 0;
    let maxWood = 300;
    let maxBlachen = 200;
    let maxMoney = 400;

    for (const b of this.placedBuildings) {
      const def = this.buildingDefs[b.type];
      capacity += def.camperCapacity * b.level;

      if (b.type === 'wood_depot') maxWood += 200 * b.level;
      if (b.type === 'blachen_depot') maxBlachen += 150 * b.level;
      if (b.type === 'kiosk') maxMoney += 300 * b.level;
      if (b.type === 'campfire') {
        maxWood += 100 * b.level;
        maxBlachen += 80 * b.level;
        maxMoney += 150 * b.level;
      }
    }

    this.camperCapacity = capacity;
    this.resources.maxWood = maxWood;
    this.resources.maxBlachen = maxBlachen;
    this.resources.maxMoney = maxMoney;
  }

  // --- Quests prüfen ---
  private updateQuestProgress(): void {
    const summary = this.getGameStateSummary();
    let justCompleted = false;

    for (const q of this.quests) {
      q.progress = q.check(summary);
      if (!q.completed && q.progress >= q.target) {
        q.completed = true;
        justCompleted = true;
        this.showToast(`🏆 Quest abgeschlossen: ${q.title}!`);
        this.audio.playQuestComplete();
      }
    }

    this.completedQuestsCount = this.quests.filter(q => q.completed && !q.claimed).length;
    if (justCompleted) {
      this.saveGame();
    }
  }

  public claimQuestReward(quest: GameQuest): void {
    if (!quest.completed || quest.claimed) return;
    quest.claimed = true;

    if (quest.reward.wood) this.resources.wood = Math.min(this.resources.maxWood, this.resources.wood + quest.reward.wood);
    if (quest.reward.blachen) this.resources.blachen = Math.min(this.resources.maxBlachen, this.resources.blachen + quest.reward.blachen);
    if (quest.reward.money) this.resources.money = Math.min(this.resources.maxMoney, this.resources.money + quest.reward.money);
    if (quest.reward.spirit) this.resources.spirit = Math.min(1000, this.resources.spirit + quest.reward.spirit);

    this.audio.playCollect();
    this.showToast(`Belohnung für "${quest.title}" erhalten!`);
    this.completedQuestsCount = this.quests.filter(q => q.completed && !q.claimed).length;
    this.saveGame();
  }

  private getGameStateSummary(): GameStateSummary {
    const counts: Record<BuildingType, number> = {
      campfire: 0,
      spatzenzelt: 0,
      firstzelt: 0,
      grosszelt: 0,
      sarasani: 0,
      wood_depot: 0,
      blachen_depot: 0,
      kitchen: 0,
      kiosk: 0,
      pioneer_tower: 0,
      sanitaet: 0,
      flagpole: 0,
      path: 0
    };

    let campfireLvl = 1;
    for (const b of this.placedBuildings) {
      counts[b.type] = (counts[b.type] || 0) + 1;
      if (b.type === 'campfire' && b.level > campfireLvl) {
        campfireLvl = b.level;
      }
    }

    return {
      campfireLevel: campfireLvl,
      camperCount: this.camperCount,
      buildingsCount: counts,
      totalBuildings: this.placedBuildings.length,
      woodProduced: this.resources.wood,
      blachenProduced: this.resources.blachen,
      moneyEarned: this.resources.money
    };
  }

  // --- Zufalls-Events ---
  private triggerRandomEvent(): void {
    const events: Omit<CampEvent, 'startedAt'>[] = [
      {
        id: 'sun',
        title: 'Walliser Bergsonne im Obergoms!',
        description: 'Beste Laune und beste Sicht auf die Viertausender: Produktion +35%!',
        icon: '☀️',
        durationMs: 40000,
        bonusType: 'sun',
        multiplier: 1.35
      },
      {
        id: 'rain',
        title: 'Sommergewitter über dem Grimsel!',
        description: 'Regen peitscht über die Flugpiste! Der Sarasani bietet Schutz für alle Cevianer.',
        icon: '🌧️',
        durationMs: 30000,
        bonusType: 'rain',
        multiplier: 0.85
      },
      {
        id: 'singsong',
        title: 'Lager-Singsong am Feuer!',
        description: 'Gitarrenklänge schallen durchs Tal. «MIR SIND CEVI!» Cevi-Geist steigt rasant!',
        icon: '🎸',
        durationMs: 35000,
        bonusType: 'spirit',
        multiplier: 2.0
      },
      {
        id: 'hoernli',
        title: 'Grosse Hörnli-Party!',
        description: 'Die Küchenmannschaft zaubert Hörnli & Ghackets mit Apfelmus. Extra Batzen-Spenden!',
        icon: '🍝',
        durationMs: 35000,
        bonusType: 'money',
        multiplier: 2.2
      }
    ];

    const pick = events[Math.floor(Math.random() * events.length)];
    this.activeEvent = {
      ...pick,
      startedAt: Date.now()
    };

    this.audio.playEventHorn();
    this.showToast(`📢 ${this.activeEvent.title}`);
    this.nextEventTime = Date.now() + 65000 + Math.random() * 40000;
  }

  // --- Bauen & Platzieren ---
  public getCampfireLevel(): number {
    const cf = this.placedBuildings.find(b => b.type === 'campfire');
    return cf ? cf.level : 1;
  }

  public getUpgradeCost(b: PlacedBuilding): ResourceCost {
    const def = this.buildingDefs[b.type];
    const mult = Math.pow(def.costMultiplier, b.level);
    return {
      wood: Math.round(def.baseCost.wood * mult),
      blachen: Math.round(def.baseCost.blachen * mult),
      money: Math.round(def.baseCost.money * mult)
    };
  }

  public canAfford(cost: ResourceCost): boolean {
    return (
      this.resources.wood >= cost.wood &&
      this.resources.blachen >= cost.blachen &&
      this.resources.money >= cost.money
    );
  }

  public selectBuildingTypeToBuild(type: BuildingType): void {
    if (this.selectedBuildingType === type) {
      this.selectedBuildingType = null;
      return;
    }
    const def = this.buildingDefs[type];
    if (this.getCampfireLevel() < def.minCampfireLevel) {
      this.showToast(`Benötigt Lagerfeuer Stufe ${def.minCampfireLevel}!`);
      return;
    }
    this.selectedBuildingType = type;
    this.selectedPlacedBuilding = null;
    this.showToast(`Tippe auf ein freies Wiesenfeld, um ${def.name} zu bauen.`);
  }

  public cancelBuilding(): void {
    this.selectedBuildingType = null;
    this.selectedPlacedBuilding = null;
  }

  private tryPlaceBuilding(gridX: number, gridY: number): void {
    if (!this.selectedBuildingType) return;
    const def = this.buildingDefs[this.selectedBuildingType];

    // Kosten prüfen
    if (!this.canAfford(def.baseCost)) {
      this.showToast('Zu wenig Ressourcen für diesen Bau!');
      return;
    }

    // Grenzen & Überlappung prüfen
    if (!this.canBuildAt(gridX, gridY, def.size.width, def.size.height)) {
      this.showToast('Bauplatz blockiert oder ausserhalb des Lagers!');
      return;
    }

    // Bezahlen
    this.resources.wood -= def.baseCost.wood;
    this.resources.blachen -= def.baseCost.blachen;
    this.resources.money -= def.baseCost.money;

    const newBuilding: PlacedBuilding = {
      id: `${this.selectedBuildingType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: this.selectedBuildingType,
      level: 1,
      gridX,
      gridY,
      constructedAt: Date.now(),
      lastProductionAt: Date.now()
    };

    this.placedBuildings.push(newBuilding);
    this.audio.playBuild();
    this.showToast(`${def.name} erfolgreich gebaut!`);
    this.recalculateCapacities();
    this.updateQuestProgress();
    this.saveGame();

    // Bei Wegen bleibt die Auswahl aktiv für schnelles Pfadziehen
    if (this.selectedBuildingType !== 'path') {
      this.selectedBuildingType = null;
      this.selectedPlacedBuilding = newBuilding;
    }
  }

  public canBuildAt(x: number, y: number, w: number, h: number, ignoreId?: string): boolean {
    if (x < 0 || y < 0 || x + w > this.gridSize || y + h > this.gridSize) {
      return false;
    }

    for (const b of this.placedBuildings) {
      if (ignoreId && b.id === ignoreId) continue;
      const bDef = this.buildingDefs[b.type];
      const overlaps =
        x < b.gridX + bDef.size.width &&
        x + w > b.gridX &&
        y < b.gridY + bDef.size.height &&
        y + h > b.gridY;
      if (overlaps) return false;
    }
    return true;
  }

  public upgradeBuilding(b: PlacedBuilding): void {
    const def = this.buildingDefs[b.type];
    if (b.level >= def.maxLevel) {
      this.showToast('Maximale Stufe bereits erreicht!');
      return;
    }

    // Wenn nicht Lagerfeuer: darf nicht höher als Lagerfeuer-Level sein
    if (b.type !== 'campfire' && b.level >= this.getCampfireLevel()) {
      this.showToast(`Erhöhe zuerst die Stufe des Lagerfeuers!`);
      return;
    }

    const cost = this.getUpgradeCost(b);
    if (!this.canAfford(cost)) {
      this.showToast('Nicht genügend Ressourcen für das Upgrade!');
      return;
    }

    this.resources.wood -= cost.wood;
    this.resources.blachen -= cost.blachen;
    this.resources.money -= cost.money;

    b.level++;
    this.audio.playUpgrade();
    this.showToast(`🎉 ${def.name} auf Stufe ${b.level} aufgewertet!`);
    this.recalculateCapacities();
    this.updateQuestProgress();
    this.saveGame();
  }

  public demolishBuilding(b: PlacedBuilding): void {
    if (b.type === 'campfire') {
      this.showToast('Das zentrale Lagerfeuer kann nicht abgerissen werden!');
      return;
    }

    const def = this.buildingDefs[b.type];
    // Rückerstattung von 40% des Basispreises
    this.resources.wood = Math.min(this.resources.maxWood, this.resources.wood + Math.round(def.baseCost.wood * 0.4));
    this.resources.blachen = Math.min(this.resources.maxBlachen, this.resources.blachen + Math.round(def.baseCost.blachen * 0.4));
    this.resources.money = Math.min(this.resources.maxMoney, this.resources.money + Math.round(def.baseCost.money * 0.4));

    this.placedBuildings = this.placedBuildings.filter(item => item.id !== b.id);
    this.selectedPlacedBuilding = null;
    this.audio.playDemolish();
    this.showToast(`${def.name} abgerissen (Material teilweise zurückerhalten).`);
    this.recalculateCapacities();
    this.updateQuestProgress();
    this.saveGame();
  }

  // --- Cevianer Wusel-Logik ---
  private initWalkers(): void {
    this.walkers = [];
    const count = Math.min(30, Math.max(8, Math.floor(this.camperCount / 4)));
    const colors = ['#0284c7', '#0369a1', '#0ea5e9', '#38bdf8', '#2563eb'];

    for (let i = 0; i < count; i++) {
      const mid = Math.floor(this.gridSize / 2);
      this.walkers.push({
        id: i,
        gridX: mid + (Math.random() * 4 - 2),
        gridY: mid + (Math.random() * 4 - 2),
        targetX: mid + (Math.random() * 6 - 3),
        targetY: mid + (Math.random() * 6 - 3),
        speed: 0.4 + Math.random() * 0.5,
        color: colors[i % colors.length],
        state: 'walking',
        idleTimer: 0
      });
    }
  }

  private syncWalkers(): void {
    const targetWalkerCount = Math.min(45, Math.max(6, Math.floor(this.camperCount / 5)));
    while (this.walkers.length < targetWalkerCount) {
      const mid = Math.floor(this.gridSize / 2);
      this.walkers.push({
        id: this.walkers.length,
        gridX: mid + (Math.random() * 2 - 1),
        gridY: mid + (Math.random() * 2 - 1),
        targetX: Math.random() * this.gridSize,
        targetY: Math.random() * this.gridSize,
        speed: 0.4 + Math.random() * 0.5,
        color: '#0284c7',
        state: 'walking',
        idleTimer: 0
      });
    }
  }

  private updateAnimation(delta: number): void {
    this.flameAngle += delta * 6;
    this.cloudOffset = (this.cloudOffset + delta * 12) % 3000;

    // Walkers bewegen
    for (const w of this.walkers) {
      if (w.state === 'idle') {
        w.idleTimer -= delta;
        if (w.idleTimer <= 0) {
          // Neues Ziel wählen: Entweder Lagerfeuer oder ein zufälliges Zelt
          w.state = 'walking';
          if (Math.random() < 0.4 && this.placedBuildings.length > 0) {
            const b = this.placedBuildings[Math.floor(Math.random() * this.placedBuildings.length)];
            w.targetX = b.gridX + 0.5;
            w.targetY = b.gridY + 0.5;
          } else {
            w.targetX = 1 + Math.random() * (this.gridSize - 2);
            w.targetY = 1 + Math.random() * (this.gridSize - 2);
          }
        }
      } else {
        const dx = w.targetX - w.gridX;
        const dy = w.targetY - w.gridY;
        const dist = Math.hypot(dx, dy);

        if (dist < 0.1) {
          w.state = 'idle';
          w.idleTimer = 1.5 + Math.random() * 3.5;
        } else {
          const move = Math.min(dist, w.speed * delta);
          w.gridX += (dx / dist) * move;
          w.gridY += (dy / dist) * move;
        }
      }
    }
  }

  // --- Isometrische Berechnungen & Canvas Rendering ---
  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    const tileW = this.tileWidth * this.zoom;
    const tileH = this.tileHeight * this.zoom;
    const originX = (this.canvasRef.nativeElement.width / 2) + this.cameraX;
    const originY = (this.canvasRef.nativeElement.height / 3) + this.cameraY;

    const sx = originX + (gx - gy) * (tileW / 2);
    const sy = originY + (gx + gy) * (tileH / 2);
    return { x: sx, y: sy };
  }

  private screenToGrid(sx: number, sy: number): { x: number; y: number } {
    const tileW = this.tileWidth * this.zoom;
    const tileH = this.tileHeight * this.zoom;
    const originX = (this.canvasRef.nativeElement.width / 2) + this.cameraX;
    const originY = (this.canvasRef.nativeElement.height / 3) + this.cameraY;

    const relX = sx - originX;
    const relY = sy - originY;

    const gx = (relX / (tileW / 2) + relY / (tileH / 2)) / 2;
    const gy = (relY / (tileH / 2) - relX / (tileW / 2)) / 2;

    return { x: Math.floor(gx), y: Math.floor(gy) };
  }

  public centerOnCampfire(): void {
    const canvas = this.canvasRef.nativeElement;
    const cf = this.placedBuildings.find(b => b.type === 'campfire');
    const midX = cf ? cf.gridX + 1 : this.gridSize / 2;
    const midY = cf ? cf.gridY + 1 : this.gridSize / 2;

    this.zoom = 1.1;
    const tileW = this.tileWidth * this.zoom;
    const tileH = this.tileHeight * this.zoom;

    // Berechne Kamera-Offset so, dass Campfire exakt in Bildschirmmitte ist
    this.cameraX = - (midX - midY) * (tileW / 2);
    this.cameraY = (canvas.height / 2) - (canvas.height / 3) - (midX + midY) * (tileH / 2);
  }

  public zoomIn(): void {
    this.zoom = Math.min(2.0, this.zoom + 0.2);
  }

  public zoomOut(): void {
    this.zoom = Math.max(0.6, this.zoom - 0.2);
  }

  // --- Haupt-Render-Methode ---
  private renderCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resizing check
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    const w = canvas.width;
    const h = canvas.height;

    // 1. Malerischer Alpen-Hintergrund Obergoms Wallis
    this.drawAlpineBackground(ctx, w, h);

    // 2. Isometrisches Wiesengitter zeichnen
    this.drawIsometricGround(ctx);

    // 3. Pfade / Schnitzelwege
    this.drawPaths(ctx);

    // 4. Platzierungs-Vorschau (Highlight)
    this.drawPlacementHighlight(ctx);

    // 5. Gebäude & Cevianer Tiefensortiert (Y-Sort) zeichnen
    this.drawDepthSortedEntities(ctx);

    // 6. Wetter- & Partikeleffekte (Regen oder Sonnenstrahlen)
    this.drawWeatherEffects(ctx, w, h);
  }

  // Malerischer Alpen-Hintergrund Obergoms Wallis
  private drawAlpineBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const isRain = this.activeEvent && this.activeEvent.bonusType === 'rain';
    const isSunny = this.activeEvent && this.activeEvent.bonusType === 'sun';

    // 1. Himmel-Farbverlauf (Schweizer Bergsommer)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.75);
    if (isRain) {
      skyGrad.addColorStop(0, '#334155');
      skyGrad.addColorStop(0.5, '#475569');
      skyGrad.addColorStop(1, '#64748b');
    } else if (isSunny) {
      skyGrad.addColorStop(0, '#1d4ed8'); // Strahlendes Tiefblau
      skyGrad.addColorStop(0.35, '#38bdf8');
      skyGrad.addColorStop(0.75, '#bae6fd');
      skyGrad.addColorStop(1, '#fef08a'); // Warmer Gommer Sonnenschein
    } else {
      skyGrad.addColorStop(0, '#1e3a8a'); // Schweizer Bergblau
      skyGrad.addColorStop(0.3, '#0284c7');
      skyGrad.addColorStop(0.65, '#38bdf8');
      skyGrad.addColorStop(0.9, '#bae6fd');
      skyGrad.addColorStop(1, '#e0f2fe'); // Dunst im Talboden
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Bergsonne mit Corona & Lichtkranz
    if (!isRain) {
      const sunX = w * 0.82;
      const sunY = h * 0.14;
      const sunRadius = Math.min(w, h) * 0.06;

      const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.2, sunX, sunY, sunRadius * 3.5);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      sunGlow.addColorStop(0.3, 'rgba(253, 224, 71, 0.4)');
      sunGlow.addColorStop(0.7, 'rgba(250, 204, 21, 0.15)');
      sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');

      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Sonnenkern
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Zarte, ziehende Schönwetter-Wolken
    ctx.save();
    const clouds = [
      { xBase: 0.1, y: h * 0.12, r: 35, speed: 1.0 },
      { xBase: 0.42, y: h * 0.08, r: 48, speed: 0.8 },
      { xBase: 0.72, y: h * 0.16, r: 38, speed: 1.2 },
      { xBase: 1.05, y: h * 0.10, r: 42, speed: 0.9 }
    ];

    for (const c of clouds) {
      const cx = ((c.xBase * w + this.cloudOffset * c.speed) % (w + 300)) - 150;
      const cy = c.y;
      const cloudGrad = ctx.createRadialGradient(cx, cy, c.r * 0.2, cx, cy, c.r * 1.5);
      if (isRain) {
        cloudGrad.addColorStop(0, 'rgba(100, 116, 139, 0.85)');
        cloudGrad.addColorStop(0.6, 'rgba(71, 85, 105, 0.5)');
        cloudGrad.addColorStop(1, 'rgba(71, 85, 105, 0)');
      } else {
        cloudGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
        cloudGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
        cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }

      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
      ctx.arc(cx - c.r * 0.55, cy + c.r * 0.1, c.r * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + c.r * 0.6, cy + c.r * 0.15, c.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Hinterste majestätische 4000er Gipfelkette mit echten Fels- & Schneefacetten
    ctx.save();
    // Fels-Schattenseite (kühler Schiefer)
    ctx.fillStyle = isRain ? 'rgba(71, 85, 105, 0.7)' : 'rgba(148, 163, 184, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.45);
    ctx.lineTo(w * 0.12, h * 0.22);
    ctx.lineTo(w * 0.24, h * 0.36);
    ctx.lineTo(w * 0.44, h * 0.16); // Hauptgipfel (Finsteraarhorn / Galenstock)
    ctx.lineTo(w * 0.62, h * 0.35);
    ctx.lineTo(w * 0.82, h * 0.19);
    ctx.lineTo(w * 0.94, h * 0.32);
    ctx.lineTo(w, h * 0.26);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Sonnenbeschienene Schnee- & Gletscherfacetten
    if (!isRain) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      // Spitze 1
      ctx.beginPath();
      ctx.moveTo(w * 0.12, h * 0.22);
      ctx.lineTo(w * 0.16, h * 0.28);
      ctx.lineTo(w * 0.12, h * 0.30);
      ctx.closePath();
      ctx.fill();

      // Hauptgipfel Schneefeld
      ctx.beginPath();
      ctx.moveTo(w * 0.44, h * 0.16);
      ctx.lineTo(w * 0.50, h * 0.26);
      ctx.lineTo(w * 0.44, h * 0.29);
      ctx.lineTo(w * 0.39, h * 0.25);
      ctx.closePath();
      ctx.fill();

      // Spitze 3
      ctx.beginPath();
      ctx.moveTo(w * 0.82, h * 0.19);
      ctx.lineTo(w * 0.87, h * 0.27);
      ctx.lineTo(w * 0.82, h * 0.29);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Mittlere Bergkamm-Kette mit Arven- & Lärchenwald (typisch Obergoms)
    ctx.fillStyle = isRain ? 'rgba(51, 65, 85, 0.85)' : 'rgba(22, 101, 52, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.50);
    ctx.lineTo(w * 0.20, h * 0.34);
    ctx.lineTo(w * 0.36, h * 0.46);
    ctx.lineTo(w * 0.54, h * 0.31);
    ctx.lineTo(w * 0.74, h * 0.44);
    ctx.lineTo(w * 0.90, h * 0.33);
    ctx.lineTo(w, h * 0.45);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Stilisierte Tannen-Silhouetten entlang des mittleren Bergkammes
    ctx.fillStyle = isRain ? 'rgba(30, 41, 59, 0.9)' : 'rgba(20, 83, 45, 0.85)';
    const pinePoints = [0.18, 0.22, 0.32, 0.38, 0.52, 0.56, 0.70, 0.76, 0.88];
    for (const px of pinePoints) {
      const tx = w * px;
      const ty = h * (0.33 + Math.sin(px * 10) * 0.08);
      ctx.beginPath();
      ctx.moveTo(tx, ty - 12);
      ctx.lineTo(tx + 4, ty);
      ctx.lineTo(tx - 4, ty);
      ctx.closePath();
      ctx.fill();
    }

    // 6. Vordergrund: Weiche Talhügel des Gommer Hochplateaus
    const valleyGrad = ctx.createLinearGradient(0, h * 0.45, 0, h);
    valleyGrad.addColorStop(0, isRain ? 'rgba(30, 41, 59, 0.9)' : 'rgba(21, 128, 61, 0.85)');
    valleyGrad.addColorStop(1, isRain ? '#0f172a' : '#14532d');
    ctx.fillStyle = valleyGrad;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.quadraticCurveTo(w * 0.35, h * 0.48, w * 0.65, h * 0.56);
    ctx.quadraticCurveTo(w * 0.85, h * 0.62, w, h * 0.54);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Isometrisches Wiesengitter mit Schweizer Bergblumen, Enzian, Edelweiss & 3D-Kanten
  private drawIsometricGround(ctx: CanvasRenderingContext2D): void {
    const tileW = this.tileWidth * this.zoom;
    const tileH = this.tileHeight * this.zoom;

    // 1. 3D-Klippenrand / Sockel für die Zeltstadt-Insel
    const cliffDepth = 14 * this.zoom;
    ctx.save();
    for (let x = 0; x < this.gridSize; x++) {
      // Unterer Süd-Ost-Rand (x, gridSize - 1)
      const pt = this.gridToScreen(x, this.gridSize - 1);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y + tileH);
      ctx.lineTo(pt.x + tileW / 2, pt.y + tileH / 2);
      ctx.lineTo(pt.x + tileW / 2, pt.y + tileH / 2 + cliffDepth);
      ctx.lineTo(pt.x, pt.y + tileH + cliffDepth);
      ctx.closePath();
      ctx.fillStyle = '#3f2512'; // Erd- und Granitschicht
      ctx.fill();

      // Unterer Süd-West-Rand (gridSize - 1, x)
      const pt2 = this.gridToScreen(this.gridSize - 1, x);
      ctx.beginPath();
      ctx.moveTo(pt2.x - tileW / 2, pt2.y + tileH / 2);
      ctx.lineTo(pt2.x, pt2.y + tileH);
      ctx.lineTo(pt2.x, pt2.y + tileH + cliffDepth);
      ctx.lineTo(pt2.x - tileW / 2, pt2.y + tileH / 2 + cliffDepth);
      ctx.closePath();
      ctx.fillStyle = '#5c3818';
      ctx.fill();
    }
    ctx.restore();

    // 2. Kacheln zeichnen
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const pt = this.gridToScreen(x, y);

        // Kachel-Raute
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x + tileW / 2, pt.y + tileH / 2);
        ctx.lineTo(pt.x, pt.y + tileH);
        ctx.lineTo(pt.x - tileW / 2, pt.y + tileH / 2);
        ctx.closePath();

        // Lebendige Walliser Wiesenfarbe
        const isAlt = (x + y) % 2 === 0;
        ctx.fillStyle = isAlt ? '#34a853' : '#2e944b'; // Saftiges Gommer Berggras
        ctx.fill();

        // 3D-Lichtkanten: Sonnenkante oben hell, Schattenkante unten
        ctx.strokeStyle = 'rgba(134, 239, 172, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pt.x - tileW / 2, pt.y + tileH / 2);
        ctx.lineTo(pt.x, pt.y);
        ctx.lineTo(pt.x + tileW / 2, pt.y + tileH / 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(20, 83, 45, 0.35)';
        ctx.beginPath();
        ctx.moveTo(pt.x + tileW / 2, pt.y + tileH / 2);
        ctx.lineTo(pt.x, pt.y + tileH);
        ctx.lineTo(pt.x - tileW / 2, pt.y + tileH / 2);
        ctx.stroke();

        // 3. Organische Bergwiesen-Details (Enzian, Edelweiss, Kiesel, Grasbüschel)
        // Nur wenn auf der Kachel kein Gebäude steht
        const hasBuilding = this.findBuildingAt(x, y);
        if (!hasBuilding && this.zoom >= 0.75) {
          const seed = ((x * 47 + y * 73) * 9301 + 49297) % 233280;
          const rand = seed / 233280;

          const cx = pt.x;
          const cy = pt.y + tileH * 0.52;

          if (rand < 0.16) {
            // 💙 Blauer Walliser Enzian
            const fx = cx + (rand * 2 - 1) * (tileW * 0.22);
            const fy = cy + ((rand * 5) % 1 * 2 - 1) * (tileH * 0.18);
            ctx.fillStyle = '#1d4ed8'; // Tiefblau
            for (let a = 0; a < 5; a++) {
              const ang = (a * Math.PI * 2) / 5;
              ctx.beginPath();
              ctx.arc(fx + Math.cos(ang) * 2.6, fy + Math.sin(ang) * 1.8, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#facc15'; // Gelbe Mitte
            ctx.beginPath();
            ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (rand >= 0.16 && rand < 0.28) {
            // ✨ Weisses Schweizer Edelweiss
            const fx = cx + ((rand * 7) % 1 * 2 - 1) * (tileW * 0.22);
            const fy = cy + ((rand * 3) % 1 * 2 - 1) * (tileH * 0.18);
            ctx.fillStyle = '#f8fafc'; // Weisse Wollblüten
            for (let a = 0; a < 6; a++) {
              const ang = (a * Math.PI * 2) / 6;
              ctx.beginPath();
              ctx.arc(fx + Math.cos(ang) * 3.2, fy + Math.sin(ang) * 2.2, 1.9, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#d97706'; // Goldene Staubgefässe
            ctx.beginPath();
            ctx.arc(fx, fy, 1.4, 0, Math.PI * 2);
            ctx.fill();
          } else if (rand >= 0.28 && rand < 0.40) {
            // 🌸 Pinke Alpenrose
            const fx = cx + ((rand * 9) % 1 * 2 - 1) * (tileW * 0.2);
            const fy = cy + ((rand * 4) % 1 * 2 - 1) * (tileH * 0.16);
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
            ctx.arc(fx + 2, fy - 1, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(fx, fy, 0.9, 0, Math.PI * 2);
            ctx.fill();
          } else if (rand >= 0.40 && rand < 0.60) {
            // 🌱 Zartes Grasbüschel
            const gx = cx + ((rand * 11) % 1 * 2 - 1) * (tileW * 0.25);
            const gy = cy + ((rand * 6) % 1 * 2 - 1) * (tileH * 0.2);
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(gx - 2, gy);
            ctx.lineTo(gx - 4, gy - 5 * this.zoom);
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx, gy - 7 * this.zoom);
            ctx.moveTo(gx + 2, gy);
            ctx.lineTo(gx + 4, gy - 5 * this.zoom);
            ctx.stroke();
          } else if (rand >= 0.60 && rand < 0.70) {
            // 🪨 Rhonegletscher-Granitkiesel
            const kx = cx + ((rand * 13) % 1 * 2 - 1) * (tileW * 0.24);
            const ky = cy + ((rand * 8) % 1 * 2 - 1) * (tileH * 0.18);
            ctx.fillStyle = '#64748b'; // Schatten
            ctx.beginPath();
            ctx.ellipse(kx + 1, ky + 1, 2.8 * this.zoom, 1.8 * this.zoom, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cbd5e1'; // Sonnenfläche
            ctx.beginPath();
            ctx.ellipse(kx, ky, 2.5 * this.zoom, 1.6 * this.zoom, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // Pfade: Authentischer Walliser Holzschnitzelweg mit Rindenstruktur
  private drawPaths(ctx: CanvasRenderingContext2D): void {
    const tileW = this.tileWidth * this.zoom;
    const tileH = this.tileHeight * this.zoom;

    const paths = this.placedBuildings.filter(b => b.type === 'path');
    for (const p of paths) {
      const pt = this.gridToScreen(p.gridX, p.gridY);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + tileW / 2, pt.y + tileH / 2);
      ctx.lineTo(pt.x, pt.y + tileH);
      ctx.lineTo(pt.x - tileW / 2, pt.y + tileH / 2);
      ctx.closePath();

      // Dunklere Wald- & Rindenunterlage
      ctx.fillStyle = '#92400e';
      ctx.fill();

      // Hellere Schnitzelspäne auf dem Weg
      if (this.zoom >= 0.75) {
        const chips = [
          { dx: 0, dy: 0, color: '#f59e0b', w: 4, h: 2, rot: 0.3 },
          { dx: -tileW * 0.18, dy: -tileH * 0.1, color: '#d97706', w: 5, h: 2, rot: -0.4 },
          { dx: tileW * 0.18, dy: tileH * 0.1, color: '#b45309', w: 4, h: 2, rot: 0.7 },
          { dx: -tileW * 0.12, dy: tileH * 0.15, color: '#f59e0b', w: 3, h: 1.5, rot: 1.2 },
          { dx: tileW * 0.15, dy: -tileH * 0.15, color: '#d97706', w: 4, h: 2, rot: -0.8 }
        ];

        const cx = pt.x;
        const cy = pt.y + tileH * 0.5;

        for (const c of chips) {
          ctx.save();
          ctx.translate(cx + c.dx, cy + c.dy);
          ctx.rotate(c.rot);
          ctx.fillStyle = c.color;
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w * this.zoom, c.h * this.zoom);
          ctx.restore();
        }
      }

      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Vorschau für Platzierung
  private drawPlacementHighlight(ctx: CanvasRenderingContext2D): void {
    if (!this.hoveredTile) return;

    const tileW = this.tileWidth * this.zoom;
    const tileH = this.tileHeight * this.zoom;
    const hx = this.hoveredTile.x;
    const hy = this.hoveredTile.y;

    if (hx < 0 || hy < 0 || hx >= this.gridSize || hy >= this.gridSize) return;

    let w = 1;
    let h = 1;
    let isPlaceable = true;

    if (this.selectedBuildingType) {
      const def = this.buildingDefs[this.selectedBuildingType];
      w = def.size.width;
      h = def.size.height;
      isPlaceable = this.canBuildAt(hx, hy, w, h);
    }

    // Isometrisches Areal für Baugrösse zeichnen
    ctx.save();
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const pt = this.gridToScreen(hx + dx, hy + dy);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x + tileW / 2, pt.y + tileH / 2);
        ctx.lineTo(pt.x, pt.y + tileH);
        ctx.lineTo(pt.x - tileW / 2, pt.y + tileH / 2);
        ctx.closePath();

        ctx.fillStyle = isPlaceable ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.55)';
        ctx.fill();
        ctx.strokeStyle = isPlaceable ? '#16a34a' : '#dc2626';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Tiefensortierte Entitäten (Gebäude + Cevianer)
  private drawDepthSortedEntities(ctx: CanvasRenderingContext2D): void {
    // Entities zusammenstellen
    const entities: Array<{
      depth: number;
      type: 'building' | 'walker';
      building?: PlacedBuilding;
      walker?: CamperWalker;
    }> = [];

    for (const b of this.placedBuildings) {
      if (b.type === 'path') continue; // Wege wurden schon am Boden gezeichnet
      const def = this.buildingDefs[b.type];
      // Tiefe berechnen aus hinterster Kante
      const depth = (b.gridX + def.size.width / 2) + (b.gridY + def.size.height / 2);
      entities.push({ depth, type: 'building', building: b });
    }

    for (const w of this.walkers) {
      entities.push({ depth: w.gridX + w.gridY, type: 'walker', walker: w });
    }

    // Sortieren von hinten nach vorne
    entities.sort((a, b) => a.depth - b.depth);

    // Zeichnen
    for (const e of entities) {
      if (e.type === 'building' && e.building) {
        this.drawBuilding(ctx, e.building);
      } else if (e.type === 'walker' && e.walker) {
        this.drawWalker(ctx, e.walker);
      }
    }
  }

  // --- Spezifische Gebäude-Renderer (Isometrische 2.5D Vektoren) ---
  private drawBuilding(ctx: CanvasRenderingContext2D, b: PlacedBuilding): void {
    const def = this.buildingDefs[b.type];
    const pt = this.gridToScreen(b.gridX + def.size.width / 2, b.gridY + def.size.height / 2);
    const isSelected = this.selectedPlacedBuilding?.id === b.id;

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.scale(this.zoom, this.zoom);

    // Selektions-Ring
    if (isSelected) {
      ctx.beginPath();
      ctx.ellipse(0, 5, 38 * def.size.width, 20 * def.size.height, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Schattenwurf
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 28 * def.size.width, 15 * def.size.height, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (b.type) {
      case 'campfire':
        this.renderCampfire(ctx, b.level);
        break;
      case 'spatzenzelt':
        this.renderSpatzenzelt(ctx, b.level);
        break;
      case 'firstzelt':
        this.renderFirstzelt(ctx, b.level);
        break;
      case 'grosszelt':
        this.renderGrosszelt(ctx, b.level);
        break;
      case 'sarasani':
        this.renderSarasani(ctx, b.level);
        break;
      case 'wood_depot':
        this.renderWoodDepot(ctx, b.level);
        break;
      case 'blachen_depot':
        this.renderBlachenDepot(ctx, b.level);
        break;
      case 'kitchen':
        this.renderKitchen(ctx, b.level);
        break;
      case 'kiosk':
        this.renderKiosk(ctx, b.level);
        break;
      case 'pioneer_tower':
        this.renderPioneerTower(ctx, b.level);
        break;
      case 'sanitaet':
        this.renderSanitaet(ctx, b.level);
        break;
      case 'flagpole':
        this.renderFlagpole(ctx, b.level);
        break;
    }

    // Level-Badge anzeigen (wenn > 1)
    if (b.level > 1 && b.type !== 'path') {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(18, -48, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★${b.level}`, 18, -48);
    }

    ctx.restore();
  }

  // 1. Campfire Renderer
  private renderCampfire(ctx: CanvasRenderingContext2D, level: number): void {
    // Steinkreis
    ctx.fillStyle = '#64748b';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const rx = Math.cos(a) * 22;
      const ry = Math.sin(a) * 11;
      ctx.beginPath();
      ctx.arc(rx, ry, 5 + level, 0, Math.PI * 2);
      ctx.fill();
    }

    // Holzscheite
    ctx.fillStyle = '#78350f';
    ctx.lineWidth = 4 + level;
    ctx.strokeStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(-16, 5);
    ctx.lineTo(16, -5);
    ctx.moveTo(-16, -5);
    ctx.lineTo(16, 5);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.stroke();

    // Glühende Kohle
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animierte Flammen
    const flameHeight = 25 + level * 8 + Math.sin(this.flameAngle) * 5;
    const flameGrad = ctx.createLinearGradient(0, 0, 0, -flameHeight);
    flameGrad.addColorStop(0, '#f97316'); // Orange
    flameGrad.addColorStop(0.5, '#eab308'); // Gelb
    flameGrad.addColorStop(1, 'rgba(255, 255, 255, 0.8)'); // Glühende Spitze

    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-14, -flameHeight * 0.5, 0, -flameHeight);
    ctx.quadraticCurveTo(14, -flameHeight * 0.5, 10, 0);
    ctx.closePath();
    ctx.fill();

    // Rauchpartikel
    ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
    const smokeY = -flameHeight - 12 - (Math.sin(this.flameAngle * 0.7) * 6);
    ctx.beginPath();
    ctx.arc(Math.sin(this.flameAngle) * 6, smokeY, 8 + level * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Spatzenzelt (2 Personen)
  private renderSpatzenzelt(ctx: CanvasRenderingContext2D, level: number): void {
    // Militärblachen-Farbe (Schweizer Olivgrün / Cevi-Blau Akzente)
    const tentColor = level === 1 ? '#4d7c0f' : level === 2 ? '#3f6212' : '#1e3a8a';

    // Linke Dachseite
    ctx.fillStyle = tentColor;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-20, 2);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();

    // Rechte Dachseite (etwas dunkler im Schatten)
    ctx.fillStyle = '#365314';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 12);
    ctx.lineTo(20, 2);
    ctx.closePath();
    ctx.fill();

    // Zelteingang
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-7, 8);
    ctx.lineTo(7, 8);
    ctx.closePath();
    ctx.fill();

    // Cevi-Dreieck am First
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-4, -28);
    ctx.lineTo(4, -28);
    ctx.closePath();
    ctx.fill();

    // Spannschnüre
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 18);
    ctx.moveTo(-20, 2);
    ctx.lineTo(-26, 7);
    ctx.moveTo(20, 2);
    ctx.lineTo(26, 7);
    ctx.stroke();
  }

  // 3. Firstzelt (6 Personen)
  private renderFirstzelt(ctx: CanvasRenderingContext2D, level: number): void {
    const tentColor = level >= 2 ? '#1e3a8a' : '#4d7c0f';

    // Firststange Holz
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-28, -26);
    ctx.lineTo(16, -42);
    ctx.stroke();

    // Zelt-Dachfläche links
    ctx.fillStyle = tentColor;
    ctx.beginPath();
    ctx.moveTo(-28, -26);
    ctx.lineTo(16, -42);
    ctx.lineTo(34, -14);
    ctx.lineTo(-10, 2);
    ctx.closePath();
    ctx.fill();

    // Zelt-Dachfläche rechts
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-28, -26);
    ctx.lineTo(-42, -5);
    ctx.lineTo(-10, 2);
    ctx.closePath();
    ctx.fill();

    // Offener Giebel mit Cevi-Krawatte
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(-24, -20, 4, 0, Math.PI * 2);
    ctx.fill();

    // Cevi-Wimpel am vorderen Pfosten
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-28, -32);
    ctx.lineTo(-18, -28);
    ctx.lineTo(-28, -24);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Grossraumzelt / Jurte
  private renderGrosszelt(ctx: CanvasRenderingContext2D, level: number): void {
    // Schwarzzelt / Jurte
    const radius = 34;

    // Jurtenwand
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jurten-Kegeldach
    const roofColor = level >= 2 ? '#0f172a' : '#334155';
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(-radius, -6);
    ctx.quadraticCurveTo(0, 10, radius, -6);
    ctx.closePath();
    ctx.fill();

    // Rauchabzug & Mittelmast
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(0, -56);
    ctx.stroke();

    // Rauchwölkchen
    ctx.fillStyle = 'rgba(241, 245, 249, 0.4)';
    ctx.beginPath();
    ctx.arc(3, -62, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Sarasani (Monumentales Cevi-Dach)
  private renderSarasani(ctx: CanvasRenderingContext2D, level: number): void {
    const mastHeight = 85 + level * 10;

    // Hauptmast (Pionierstange)
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -mastHeight);
    ctx.stroke();

    // Querbünde / Ring an der Mastspitze
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-6, -mastHeight + 10, 12, 4);

    // Haupt-Blachendach (imposante Schwingung!)
    const saraGrad = ctx.createLinearGradient(0, -mastHeight + 12, 0, 10);
    saraGrad.addColorStop(0, '#0284c7'); // Cevi Blau
    saraGrad.addColorStop(0.5, '#0369a1');
    saraGrad.addColorStop(1, '#075985');

    ctx.fillStyle = saraGrad;
    ctx.beginPath();
    ctx.moveTo(0, -mastHeight + 12);
    ctx.quadraticCurveTo(-35, -20, -55, 6);
    ctx.quadraticCurveTo(0, 18, 55, 6);
    ctx.quadraticCurveTo(35, -20, 0, -mastHeight + 12);
    ctx.closePath();
    ctx.fill();

    // Rückwand-Schattierung
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -mastHeight + 12);
    ctx.lineTo(0, 14);
    ctx.moveTo(0, -mastHeight + 12);
    ctx.lineTo(-55, 6);
    ctx.moveTo(0, -mastHeight + 12);
    ctx.lineTo(55, 6);
    ctx.stroke();

    // Abspannseile zu den Eck-Heringen
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -mastHeight + 8);
    ctx.lineTo(-68, 16);
    ctx.moveTo(0, -mastHeight + 8);
    ctx.lineTo(68, 16);
    ctx.stroke();

    // Schweizer / Cevi-Fahne an der Spitze
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, -mastHeight - 12, 18, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, -mastHeight - 10, 4, 8);
    ctx.fillRect(5, -mastHeight - 8, 8, 4);
  }

  // 6. Pionierholz-Depot
  private renderWoodDepot(ctx: CanvasRenderingContext2D, level: number): void {
    // Gestapelte Baumstämme
    const logRadius = 4;
    const logColor = '#78350f';
    const logCore = '#d97706';

    const drawLog = (lx: number, ly: number, lLen: number) => {
      ctx.fillStyle = logColor;
      ctx.fillRect(lx, ly, lLen, logRadius * 2);
      ctx.fillStyle = logCore;
      ctx.beginPath();
      ctx.ellipse(lx + lLen, ly + logRadius, 3, logRadius, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    // Stämme-Stapel
    drawLog(-24, 0, 32);
    drawLog(-20, -7, 30);
    drawLog(-16, -14, 28);
    drawLog(-12, -21, 26);

    // Sägebock mit gekreuzten Stangen
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(26, -16);
    ctx.moveTo(26, 8);
    ctx.lineTo(14, -16);
    ctx.stroke();

    // Cevi-Spaltaxt
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(18, -12, 6, 8);
  }

  // 7. Materialzelt & Blachen
  private renderBlachenDepot(ctx: CanvasRenderingContext2D, level: number): void {
    // Kleines Arbeitszelt
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(-18, -26);
    ctx.lineTo(12, -34);
    ctx.lineTo(24, -10);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();

    // Stapel von gefalteten Schweizer Militärblachen
    ctx.fillStyle = '#365314';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-22, -i * 5, 14, 4);
      ctx.strokeStyle = '#4d7c0f';
      ctx.strokeRect(-22, -i * 5, 14, 4);
    }

    // Seilbund
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(10, 2, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 8. Feldküche
  private renderKitchen(ctx: CanvasRenderingContext2D, level: number): void {
    // Kochtisch aus Holz
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-24, -10, 48, 8);
    ctx.fillRect(-20, -2, 4, 12);
    ctx.fillRect(16, -2, 4, 12);

    // Grosser Armeekochkessel (Marmite)
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(0, -16, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-12, -16, 24, 14);

    // Kesselrand & Dampf
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-6, -2, 12, 4); // Feuer unter dem Kessel

    // Dampfschwaden
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(Math.sin(this.flameAngle) * 4, -28, 5, 0, Math.PI * 2);
    ctx.arc(Math.sin(this.flameAngle + 1) * 3, -36, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // 9. Cevi-Kiosk
  private renderKiosk(ctx: CanvasRenderingContext2D, level: number): void {
    // Holzhütte / Verkaufsstand
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-20, -18, 40, 24);

    // Schräges Dach rot-weiss gestreift
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-24, -18);
    ctx.lineTo(0, -32);
    ctx.lineTo(24, -18);
    ctx.closePath();
    ctx.fill();

    // Verkaufsöffnung
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-14, -12, 28, 12);

    // Schriftzug "KIOSK"
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KIOSK', 0, -3);
  }

  // 10. Pionierturm
  private renderPioneerTower(ctx: CanvasRenderingContext2D, level: number): void {
    const towerH = 65 + level * 8;

    // 4 Holzstangenbeine mit Querverstrebungen (Kreuzbünde)
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(-8, -towerH);
    ctx.moveTo(16, 4);
    ctx.lineTo(8, -towerH);
    ctx.stroke();

    // Diagonale Kreuzbünde
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(12, -25);
    ctx.moveTo(14, -5);
    ctx.lineTo(-12, -25);
    ctx.moveTo(-12, -30);
    ctx.lineTo(10, -50);
    ctx.moveTo(12, -30);
    ctx.lineTo(-10, -50);
    ctx.stroke();

    // Aussichtsplattform oben
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-14, -towerH, 28, 6);

    // Geländer
    ctx.strokeStyle = '#78350f';
    ctx.strokeRect(-14, -towerH - 10, 28, 10);

    // Conveniat Wimpel an der Spitze
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(0, -towerH - 12);
    ctx.lineTo(14, -towerH - 7);
    ctx.lineTo(0, -towerH - 2);
    ctx.closePath();
    ctx.fill();
  }

  // 11. Sanitätszelt
  private renderSanitaet(ctx: CanvasRenderingContext2D, level: number): void {
    // Grosses weisses Zelt
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(-24, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(24, 0);
    ctx.closePath();
    ctx.fill();

    // Rotes Kreuz auf dem Dach
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-3, -18, 6, 16);
    ctx.fillRect(-8, -13, 16, 6);

    // Eingang
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-6, 8);
    ctx.lineTo(6, 8);
    ctx.closePath();
    ctx.fill();
  }

  // 12. Cevi-Fahnenmast
  private renderFlagpole(ctx: CanvasRenderingContext2D, level: number): void {
    const poleH = 48;

    // Mast
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -poleH);
    ctx.stroke();

    // Cevi-Fahne (Rot & Blau mit Dreieck/Kreuz)
    const wave = Math.sin(this.flameAngle) * 2;
    ctx.fillStyle = '#0284c7'; // Blau
    ctx.beginPath();
    ctx.moveTo(0, -poleH + 2);
    ctx.lineTo(20 + wave, -poleH + 2);
    ctx.lineTo(20 + wave, -poleH + 16);
    ctx.lineTo(0, -poleH + 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dc2626'; // Rot
    ctx.beginPath();
    ctx.moveTo(0, -poleH + 2);
    ctx.lineTo(10 + wave * 0.5, -poleH + 2);
    ctx.lineTo(0, -poleH + 16);
    ctx.closePath();
    ctx.fill();
  }

  // Walker: Kleiner animierter Cevianer
  private drawWalker(ctx: CanvasRenderingContext2D, w: CamperWalker): void {
    const pt = this.gridToScreen(w.gridX, w.gridY);

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.scale(this.zoom, this.zoom);

    // Schatten
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beine (animiert bei 'walking')
    const legOffset = w.state === 'walking' ? Math.sin(this.flameAngle * 2 + w.id) * 3 : 0;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1.5, -5);
    ctx.lineTo(-2 + legOffset, 1);
    ctx.moveTo(1.5, -5);
    ctx.lineTo(2 - legOffset, 1);
    ctx.stroke();

    // Körper: Cevi-Hemd (Blau)
    ctx.fillStyle = w.color;
    ctx.fillRect(-3, -11, 6, 7);

    // Cevi-Krawatte (Halstuch rot)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-1.5, -11);
    ctx.lineTo(1.5, -11);
    ctx.lineTo(0, -8);
    ctx.closePath();
    ctx.fill();

    // Kopf
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -14, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Wetter-Effekte (Regen oder Sonnenstrahlen)
  private drawWeatherEffects(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.activeEvent) return;

    if (this.activeEvent.bonusType === 'rain') {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const rx = (Math.sin(i * 99 + this.flameAngle * 10) * 0.5 + 0.5) * w;
        const ry = (Math.cos(i * 33 + this.flameAngle * 8) * 0.5 + 0.5) * h;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 14);
      }
      ctx.stroke();
    } else if (this.activeEvent.bonusType === 'sun') {
      // Warmer Sonnen-Glow
      const sunGrad = ctx.createRadialGradient(w * 0.85, 40, 10, w * 0.85, 40, w * 0.7);
      sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.25)');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // --- Input & Interaktions-Handling ---
  public onCanvasMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  }

  public onCanvasMouseMove(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.hypot(dx, dy) > 4) {
        this.hasDragged = true;
        this.cameraX += dx;
        this.cameraY += dy;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      }
    }

    this.hoveredTile = this.screenToGrid(mouseX, mouseY);
  }

  public onCanvasMouseUp(e: MouseEvent): void {
    if (!this.hasDragged) {
      this.handleCanvasClick(e.clientX, e.clientY);
    }
    this.isDragging = false;
  }

  public onCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  // Touch Support für Mobile/Tablets
  public onCanvasTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.hasDragged = false;
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
    }
  }

  public onCanvasTouchMove(e: TouchEvent): void {
    if (this.isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - this.dragStartX;
      const dy = e.touches[0].clientY - this.dragStartY;
      if (Math.hypot(dx, dy) > 5) {
        this.hasDragged = true;
        this.cameraX += dx;
        this.cameraY += dy;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
      }
    }
  }

  public onCanvasTouchEnd(e: TouchEvent): void {
    if (!this.hasDragged && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      this.handleCanvasClick(t.clientX, t.clientY);
    }
    this.isDragging = false;
  }

  private handleCanvasClick(clientX: number, clientY: number): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const grid = this.screenToGrid(mouseX, mouseY);

    if (this.selectedBuildingType) {
      // Platziere das ausgewählte Gebäude
      this.tryPlaceBuilding(grid.x, grid.y);
    } else {
      // Inspiziere Gebäude auf dieser Kachel
      const clicked = this.findBuildingAt(grid.x, grid.y);
      this.selectedPlacedBuilding = clicked || null;
      if (clicked) {
        this.audio.playCollect();
      }
    }
  }

  private findBuildingAt(gx: number, gy: number): PlacedBuilding | undefined {
    return this.placedBuildings.find(b => {
      const def = this.buildingDefs[b.type];
      return (
        gx >= b.gridX &&
        gx < b.gridX + def.size.width &&
        gy >= b.gridY &&
        gy < b.gridY + def.size.height
      );
    });
  }

  // Toast Nachrichten
  public showToast(msg: string): void {
    this.currentNotification = msg;
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      this.currentNotification = null;
    }, 4500);
  }

  // --- Cevi Minigames & Pitech Challenges ---
  public openMinigames(category?: MinigameCategory): void {
    if (category) {
      this.activeMinigameCategory = category;
    }
    this.currentQuestionIndex = 0;
    this.selectedAnswerIndex = null;
    this.answerSubmitted = false;
    this.showMinigameModal = true;
    this.audio.playCollect();
  }

  public selectMinigameCategory(cat: MinigameCategory): void {
    this.activeMinigameCategory = cat;
    this.currentQuestionIndex = 0;
    this.selectedAnswerIndex = null;
    this.answerSubmitted = false;
  }

  public getCategoryQuestions(): MinigameQuestion[] {
    return this.minigameQuestions.filter(q => q.category === this.activeMinigameCategory);
  }

  public getCurrentQuestion(): MinigameQuestion | null {
    const list = this.getCategoryQuestions();
    return list[this.currentQuestionIndex] || list[0] || null;
  }

  public selectAnswer(idx: number): void {
    if (this.answerSubmitted) return;
    this.selectedAnswerIndex = idx;
  }

  public submitAnswer(): void {
    const q = this.getCurrentQuestion();
    if (!q || this.selectedAnswerIndex === null || this.answerSubmitted) return;
    this.answerSubmitted = true;
    this.isAnswerCorrect = (this.selectedAnswerIndex === q.correctIndex);

    if (this.isAnswerCorrect) {
      this.audio.playUpgrade();
      if (!this.solvedQuestionIds.has(q.id)) {
        this.solvedQuestionIds.add(q.id);
        this.resources.wood = Math.min(this.resources.maxWood, this.resources.wood + q.reward.wood);
        this.resources.blachen = Math.min(this.resources.maxBlachen, this.resources.blachen + q.reward.blachen);
        this.resources.money = Math.min(this.resources.maxMoney, this.resources.money + q.reward.money);
        this.resources.spirit += q.reward.spirit;
        this.saveGame();
        this.showToast(`🎉 Richtig! +${q.reward.wood} Holz, +${q.reward.blachen} Blachen, +${q.reward.money} Batzen, +${q.reward.spirit} Geist!`);
      }
    } else {
      this.audio.playDemolish();
    }
  }

  public nextQuestion(): void {
    const list = this.getCategoryQuestions();
    this.selectedAnswerIndex = null;
    this.answerSubmitted = false;
    this.isAnswerCorrect = false;
    if (this.currentQuestionIndex + 1 < list.length) {
      this.currentQuestionIndex++;
    } else {
      this.currentQuestionIndex = 0;
    }
  }

  public prevQuestion(): void {
    const list = this.getCategoryQuestions();
    this.selectedAnswerIndex = null;
    this.answerSubmitted = false;
    this.isAnswerCorrect = false;
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    } else {
      this.currentQuestionIndex = list.length - 1;
    }
  }

  public isCurrentQuestionSolved(): boolean {
    const q = this.getCurrentQuestion();
    return q ? this.solvedQuestionIds.has(q.id) : false;
  }

  public getUnsolvedCount(): number {
    return this.minigameQuestions.filter(q => !this.solvedQuestionIds.has(q.id)).length;
  }

}
