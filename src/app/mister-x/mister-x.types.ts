export type Role = 'MISTER_X' | 'DETECTIVE' | 'UNASSIGNED';

export type GameStatus = 'LOBBY' | 'PLAYING' | 'CAUGHT' | 'ESCAPED' | 'ENDED';

export type TacticalTool =
  | 'NONE'
  | 'GOING'
  | 'PING'
  | 'ARROW'
  | 'LINE'
  | 'ZONE'
  | 'SIGHTING'
  | 'SUSPECT'
  | 'BLOCK';

export type TacticalAnnotationType =
  | 'GOING'
  | 'PING'
  | 'ARROW'
  | 'LINE'
  | 'ZONE'
  | 'SIGHTING'
  | 'SUSPECT'
  | 'BLOCK';

export interface TacticalAnnotation {
  id: string;
  type: TacticalAnnotationType;
  authorId: string;
  authorName: string;
  timestamp: number;
  points?: [number, number][];
  lat?: number;
  lng?: number;
  originLat?: number;
  originLng?: number;
  radiusMeters?: number;
}

export interface TacticalEventMessage {
  action: 'ADD' | 'REMOVE' | 'CLEAR_ALL' | 'REQUEST_SYNC' | 'SYNC';
  senderId: string;
  senderName: string;
  timestamp: number;
  annotation?: TacticalAnnotation;
  annotationId?: string;
  annotations?: TacticalAnnotation[];
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  role: Role;
  lat?: number;
  lng?: number;
  accuracy?: number;
  heading?: number;
  lastUpdated?: number;
  isOutOfBounds?: boolean;
}

export interface GameSettings {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  pingIntervalSeconds: number; // e.g. 180 (3 min)
  catchRadiusMeters: number; // e.g. 10m
  misterXPlayerId?: string; // empty means random
  gameDurationMinutes: number; // 0 = unlimited until caught
}

export interface PingRecord {
  pingNumber: number;
  timestamp: number;
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
}

export interface GameEventMessage {
  type: 'JOIN' | 'LEAVE' | 'SYNC_STATE' | 'SETTINGS' | 'START_GAME' | 'POS' | 'PING' | 'CATCH' | 'END_GAME' | 'MESSAGE' | 'REQUEST_SYNC';
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}
