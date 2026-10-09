export type Role = 'MISTER_X' | 'DETECTIVE' | 'UNASSIGNED';

export type GameStatus = 'LOBBY' | 'PLAYING' | 'CAUGHT' | 'ESCAPED' | 'ENDED';

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
  catchRadiusMeters: number; // e.g. 30m
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
  type: 'JOIN' | 'LEAVE' | 'SYNC_STATE' | 'SETTINGS' | 'START_GAME' | 'POS' | 'PING' | 'CATCH' | 'END_GAME' | 'MESSAGE';
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}
