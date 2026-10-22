export type BuildingType =
  | 'campfire'
  | 'spatzenzelt'
  | 'firstzelt'
  | 'grosszelt'
  | 'sarasani'
  | 'wood_depot'
  | 'blachen_depot'
  | 'kiosk'
  | 'kitchen'
  | 'pioneer_tower'
  | 'sanitaet'
  | 'flagpole'
  | 'path';

export interface ResourceCost {
  wood: number;
  blachen: number;
  money: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  category: 'zelte' | 'pionier' | 'infrastruktur' | 'wege';
  description: string;
  icon: string;
  baseCost: ResourceCost;
  costMultiplier: number;
  camperCapacity: number; // additional capacity per level
  woodProduction: number; // per second
  blachenProduction: number; // per second
  moneyProduction: number; // per second
  spiritProduction: number; // per second
  size: { width: number; height: number }; // in grid tiles
  minCampfireLevel: number;
  maxLevel: number;
}

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  level: number;
  gridX: number;
  gridY: number;
  constructedAt: number;
  lastProductionAt: number;
}

export interface GameResources {
  wood: number;
  blachen: number;
  money: number;
  spirit: number;
  maxWood: number;
  maxBlachen: number;
  maxMoney: number;
}

export interface CamperWalker {
  id: number;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  state: 'walking' | 'idle' | 'cheering';
  idleTimer: number;
}

export interface GameQuest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  reward: {
    wood?: number;
    blachen?: number;
    money?: number;
    spirit?: number;
  };
  check: (state: GameStateSummary) => number;
}

export interface GameStateSummary {
  campfireLevel: number;
  camperCount: number;
  buildingsCount: Record<BuildingType, number>;
  totalBuildings: number;
  woodProduced: number;
  blachenProduced: number;
  moneyEarned: number;
}

export interface CampEvent {
  id: string;
  title: string;
  description: string;
  icon: string;
  durationMs: number;
  startedAt: number;
  bonusType: 'production' | 'spirit' | 'money' | 'rain' | 'sun';
  multiplier: number;
}
