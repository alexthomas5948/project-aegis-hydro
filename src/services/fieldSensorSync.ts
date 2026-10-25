import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { FieldNodeTelemetry } from '../types/hydrology';

export type SyncTransportMode = 'broadcast_channel' | 'webrtc_peer' | 'simulated';

class FieldSensorSyncService {
  private broadcastChannel: BroadcastChannel | null = null;
  private peer: Peer | null = null;
  private peerConnection: DataConnection | null = null;
  private listeners: Set<(data: FieldNodeTelemetry) => void> = new Set();
  private connectionStateListeners: Set<(connected: boolean, transport: SyncTransportMode) => void> = new Set();
  private lastTelemetry: FieldNodeTelemetry | null = null;
  private currentPin: string = '4092';
  private isHost: boolean = false;
  private isPeerConnected: boolean = false;
  private activeTransport: SyncTransportMode = 'broadcast_channel';

  constructor() {
    this.initBroadcastChannel();
  }

  /**
   * Initialize local BroadcastChannel for zero-latency multi-tab sync
   */
  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('aegis_hil_bus');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'HIL_TELEMETRY') {
            const telemetry = event.data.payload as FieldNodeTelemetry;
            if (telemetry.roomId === this.currentPin || this.currentPin === '4092') {
              this.handleIncomingTelemetry(telemetry, 'broadcast_channel');
            }
          }
        };
      }
    } catch (err) {
      console.warn('[FieldSync] BroadcastChannel not supported in this environment', err);
    }
  }

  /**
   * Set up as the laptop Command Center receiver
   */
  public initReceiver(pin: string = '4092') {
    this.currentPin = pin;
    this.isHost = true;

    // Set default baseline telemetry
    if (!this.lastTelemetry) {
      this.lastTelemetry = {
        roomId: pin,
        deviceId: 'SIM-FN-INITIAL',
        timestamp: Date.now(),
        pitch: 18.5,
        roll: 1.2,
        pitchDelta: 0.0,
        rollDelta: 0.0,
        creepVelocity: 0.02,
        pga: 0.012,
        seismicRms: 0.08,
        accelX: 0.05,
        accelY: 0.12,
        accelZ: 9.81,
        poreSaturation: 74.5,
        stationName: 'WAYANAD-CHOORALMALA-SLOPE-1',
        hazardLevel: 'STABLE',
        isSimulated: true,
      };
    }

    // Try setting up WebRTC Peer for physical smartphone connection
    const hostPeerId = `aegis-kerala-host-${pin}`;
    try {
      if (this.peer) {
        this.peer.destroy();
      }
      this.peer = new Peer(hostPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('[FieldSync WebRTC Host] Listening on Peer ID:', id);
      });

      this.peer.on('connection', (conn) => {
        console.log('[FieldSync WebRTC Host] Mobile node paired from phone:', conn.peer);
        this.peerConnection = conn;
        this.isPeerConnected = true;
        this.activeTransport = 'webrtc_peer';
        this.notifyConnectionState(true, 'webrtc_peer');

        conn.on('data', (raw) => {
          try {
            const telemetry = typeof raw === 'string' ? JSON.parse(raw) : raw;
            this.handleIncomingTelemetry(telemetry, 'webrtc_peer');
          } catch (e) {
            console.error('[FieldSync] Failed to parse peer payload', e);
          }
        });

        conn.on('close', () => {
          this.isPeerConnected = false;
          this.activeTransport = 'broadcast_channel';
          this.notifyConnectionState(false, 'broadcast_channel');
        });

        conn.on('error', (err) => {
          console.warn('[FieldSync] Host connection error', err);
        });
      });

      this.peer.on('error', (err: any) => {
        // PeerJS ID may already be taken if multiple tabs or visitors are open; BroadcastChannel takes over
        console.info('[FieldSync WebRTC Status]:', err?.type || err?.message || 'Standby');
      });
    } catch (err) {
      console.info('[FieldSync] PeerJS standby, BroadcastChannel active');
    }
  }

  /**
   * Set up as the mobile smartphone sender
   */
  public initSender(pin: string = '4092') {
    this.currentPin = pin;
    this.isHost = false;

    const hostPeerId = `aegis-kerala-host-${pin}`;
    const clientPeerId = `aegis-mobile-${pin}-${Math.floor(Math.random() * 10000)}`;

    try {
      if (this.peer) {
        this.peer.destroy();
      }
      this.peer = new Peer(clientPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', () => {
        if (!this.peer) return;
        const conn = this.peer.connect(hostPeerId, { reliable: false });
        this.peerConnection = conn;

        conn.on('open', () => {
          console.log('[FieldSync Mobile] Connected to Laptop Host via WebRTC!');
          this.isPeerConnected = true;
          this.activeTransport = 'webrtc_peer';
          this.notifyConnectionState(true, 'webrtc_peer');
        });

        conn.on('close', () => {
          this.isPeerConnected = false;
          this.notifyConnectionState(false, 'broadcast_channel');
        });
      });
    } catch (err) {
      console.warn('[FieldSync] Mobile peer connection failed, using BroadcastChannel', err);
    }
  }

  /**
   * Broadcast high-rate IMU & seismic telemetry from mobile phone
   */
  public broadcastTelemetry(data: FieldNodeTelemetry) {
    this.lastTelemetry = data;

    // 1. Send via local BroadcastChannel (instant for multi-tab testing)
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'HIL_TELEMETRY',
        payload: data
      });
    }

    // 2. Send via WebRTC DataChannel if paired with physical phone
    if (this.peerConnection && this.peerConnection.open) {
      try {
        this.peerConnection.send(data);
      } catch (err) {
        // Ignore dropped UDP frames
      }
    }

    // 3. Notify local in-memory listeners
    this.notifyListeners(data);
  }

  private handleIncomingTelemetry(data: FieldNodeTelemetry, transport: SyncTransportMode) {
    this.lastTelemetry = data;
    this.activeTransport = transport;
    this.notifyListeners(data);
    this.notifyConnectionState(true, transport);
  }

  public subscribe(listener: (data: FieldNodeTelemetry) => void): () => void {
    this.listeners.add(listener);
    if (this.lastTelemetry) {
      listener(this.lastTelemetry);
    }
    return () => this.listeners.delete(listener);
  }

  public subscribeConnection(listener: (connected: boolean, transport: SyncTransportMode) => void): () => void {
    this.connectionStateListeners.add(listener);
    listener(this.isPeerConnected || this.lastTelemetry !== null, this.activeTransport);
    return () => this.connectionStateListeners.delete(listener);
  }

  private notifyListeners(data: FieldNodeTelemetry) {
    this.listeners.forEach((l) => {
      try {
        l(data);
      } catch (e) {
        console.error('[FieldSync] Error in listener', e);
      }
    });
  }

  private notifyConnectionState(connected: boolean, transport: SyncTransportMode) {
    this.connectionStateListeners.forEach((l) => {
      try {
        l(connected, transport);
      } catch (e) {
        console.error('[FieldSync] Error in connection listener', e);
      }
    });
  }

  public getLastTelemetry(): FieldNodeTelemetry | null {
    return this.lastTelemetry;
  }

  public getCurrentPin(): string {
    return this.currentPin;
  }

  public getActiveTransport(): SyncTransportMode {
    return this.activeTransport;
  }

  public isConnected(): boolean {
    return this.isPeerConnected || (this.lastTelemetry !== null && Date.now() - this.lastTelemetry.timestamp < 10000);
  }
}

export const fieldSensorSync = new FieldSensorSyncService();
