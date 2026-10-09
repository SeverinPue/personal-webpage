import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import * as mqtt from 'mqtt';
import { GameEventMessage, Player } from './mister-x.types';

@Injectable({
  providedIn: 'root'
})
export class MisterXNetworkService {
  private client: mqtt.MqttClient | null = null;
  private roomCode: string = '';
  private currentPlayer: Player | null = null;

  public event$ = new Subject<GameEventMessage>();
  public location$ = new Subject<{ playerId: string; playerName?: string; role?: any; lat: number; lng: number; accuracy?: number; heading?: number; timestamp?: number }>();
  public connected$ = new Subject<boolean>();

  // Free public WebSocket MQTT brokers with fallback
  private brokers = [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt'
  ];
  private currentBrokerIndex = 0;

  constructor(private ngZone: NgZone) {}

  public connect(roomCode: string, player: Player): Promise<void> {
    this.disconnect();
    this.roomCode = roomCode.toUpperCase().trim();
    this.currentPlayer = player;

    return new Promise((resolve, reject) => {
      this.tryConnectBroker(this.currentBrokerIndex, resolve, reject);
    });
  }

  public updatePlayer(player: Player) {
    this.currentPlayer = player;
  }

  public isConnected(): boolean {
    return !!(this.client && this.client.connected);
  }

  public reconnect() {
    if (this.client && !this.client.connected) {
      try {
        this.client.reconnect();
      } catch (e) {
        if (this.roomCode && this.currentPlayer) {
          this.connect(this.roomCode, this.currentPlayer).catch(() => {});
        }
      }
    } else if (!this.client && this.roomCode && this.currentPlayer) {
      this.connect(this.roomCode, this.currentPlayer).catch(() => {});
    }
  }

  private tryConnectBroker(brokerIndex: number, resolve: () => void, reject: (err: any) => void) {
    const brokerUrl = this.brokers[brokerIndex % this.brokers.length];
    const clientId = `misterx_${this.currentPlayer?.id || Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId,
        clean: false,
        connectTimeout: 7000,
        reconnectPeriod: 2000,
        keepalive: 30
      });

      let hasResolved = false;

      this.client.on('connect', () => {
        this.ngZone.run(() => {
          this.connected$.next(true);

          // Subscribe to room topics
          const eventTopic = `misterx/game/${this.roomCode}/events`;
          const posTopic = `misterx/game/${this.roomCode}/pos`;

          this.client?.subscribe([eventTopic, posTopic], { qos: 0 }, (err) => {
            if (err) {
              console.error('Subscription error:', err);
            } else {
              // Send JOIN message
              this.publishEvent({
                type: 'JOIN',
                senderId: this.currentPlayer!.id,
                senderName: this.currentPlayer!.name,
                timestamp: Date.now(),
                payload: { player: this.currentPlayer }
              });
            }
          });

          if (!hasResolved) {
            hasResolved = true;
            resolve();
          }
        });
      });

      this.client.on('message', (topic: string, message: any) => {
        this.ngZone.run(() => {
          try {
            const raw = message.toString();
            const data = JSON.parse(raw);

            if (topic.endsWith('/pos')) {
              this.location$.next(data);
            } else {
              this.event$.next(data as GameEventMessage);
            }
          } catch (e) {
            console.error('Failed to parse incoming MQTT message:', e);
          }
        });
      });

      this.client.on('error', (err) => {
        this.ngZone.run(() => {
          console.warn('MQTT error with broker ' + brokerUrl, err);
          if (!hasResolved) {
            // Try next broker
            this.client?.end(true);
            if (brokerIndex + 1 < this.brokers.length) {
              this.currentBrokerIndex = brokerIndex + 1;
              this.tryConnectBroker(this.currentBrokerIndex, resolve, reject);
            } else {
              reject(err);
            }
          }
        });
      });

      this.client.on('close', () => {
        this.ngZone.run(() => {
          this.connected$.next(false);
        });
      });
    } catch (err) {
      reject(err);
    }
  }

  public publishEvent(event: GameEventMessage) {
    if (!this.client || !this.client.connected || !this.roomCode) return;
    const topic = `misterx/game/${this.roomCode}/events`;
    this.client.publish(topic, JSON.stringify(event), { qos: 0 });
  }

  public publishLocation(lat: number, lng: number, accuracy?: number, heading?: number) {
    if (!this.client || !this.client.connected || !this.roomCode || !this.currentPlayer) return;
    const topic = `misterx/game/${this.roomCode}/pos`;
    const payload = {
      playerId: this.currentPlayer.id,
      playerName: this.currentPlayer.name,
      role: this.currentPlayer.role,
      lat,
      lng,
      accuracy,
      heading,
      timestamp: Date.now()
    };
    this.client.publish(topic, JSON.stringify(payload), { qos: 0 });
  }

  public disconnect() {
    if (this.client) {
      if (this.currentPlayer && this.roomCode && this.client.connected) {
        this.publishEvent({
          type: 'LEAVE',
          senderId: this.currentPlayer.id,
          senderName: this.currentPlayer.name,
          timestamp: Date.now(),
          payload: { reason: 'user_left' }
        });
      }
      try {
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }
  }
}
