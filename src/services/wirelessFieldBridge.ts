import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export interface FieldNodeTelemetryPacket {
  pitch: number;
  roll: number;
  tiltDeltaDeg: number;
  seismicPgaG: number;
  seismicRmsMs2: number;
  simulatedMoisturePct: number | null;
  creepVelocity?: number;
  timestamp: number;
}

const PEER_PREFIX = 'aegis-kerala-c2-room-';

export class WirelessFieldBridge {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private localChannel: BroadcastChannel | null = null;
  private onDataCallback: ((data: FieldNodeTelemetryPacket) => void) | null = null;
  private onStatusCallback: ((connected: boolean, peerPin: string) => void) | null = null;
  public roomPin: string;

  constructor(customPin?: string) {
    // Use URL ?pin=XXXX if present, otherwise generate or reuse saved 4-digit PIN
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlPin = urlParams?.get('pin') || urlParams?.get('room');
    const savedPin = typeof window !== 'undefined' ? sessionStorage.getItem('AEGIS_ROOM_PIN') : null;
    this.roomPin = customPin || urlPin || savedPin || Math.floor(1000 + Math.random() * 9000).toString();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('AEGIS_ROOM_PIN', this.roomPin);
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.localChannel = new BroadcastChannel('aegis_hil_bus');
      this.localChannel.onmessage = (event) => {
        if (this.onDataCallback && event.data) {
          this.onDataCallback(event.data as FieldNodeTelemetryPacket);
        }
      };
    }
  }

  /**
   * 1. PC COMMAND CENTER MODE (RECEIVER)
   * Listens for incoming wireless telemetry from the Android phone
   */
  public startPcReceiver(
    onData: (data: FieldNodeTelemetryPacket) => void,
    onStatusChange?: (connected: boolean, pin: string) => void
  ) {
    this.onDataCallback = onData;
    this.onStatusCallback = onStatusChange || null;
    const hostPeerId = `${PEER_PREFIX}${this.roomPin}`;

    if (this.peer) this.peer.destroy();
    this.peer = new Peer(hostPeerId, { debug: 1 });

    this.peer.on('open', () => {
      console.log(`[AEGIS-PC] Wireless Receiver Online. Room PIN: ${this.roomPin}`);
      this.onStatusCallback?.(false, this.roomPin);
    });

    this.peer.on('connection', (connection) => {
      this.conn = connection;
      this.onStatusCallback?.(true, this.roomPin);

      connection.on('data', (rawPayload) => {
        const packet = rawPayload as FieldNodeTelemetryPacket;
        this.onDataCallback?.(packet);
      });

      connection.on('close', () => {
        this.onStatusCallback?.(false, this.roomPin);
      });
    });

    this.peer.on('error', (err) => {
      console.warn('[AEGIS-PC] Peer error:', err.type);
    });
  }

  /**
   * 2. ANDROID PHONE FIELD NODE MODE (TRANSMITTER)
   * Connects to the PC's 4-digit PIN and streams 20Hz sensor packets
   */
  public connectPhoneToPc(
    targetPin: string,
    onStatusChange?: (connected: boolean, pin: string) => void
  ) {
    this.roomPin = targetPin.trim();
    this.onStatusCallback = onStatusChange || null;
    const targetHostId = `${PEER_PREFIX}${this.roomPin}`;

    if (this.peer) this.peer.destroy();
    this.peer = new Peer({ debug: 1 });

    this.peer.on('open', () => {
      const connection = this.peer!.connect(targetHostId, { reliable: false });

      connection.on('open', () => {
        this.conn = connection;
        console.log(`[AEGIS-PHONE] Linked to PC Room ${this.roomPin}`);
        this.onStatusCallback?.(true, this.roomPin);
      });

      connection.on('close', () => {
        this.conn = null;
        this.onStatusCallback?.(false, this.roomPin);
      });

      connection.on('error', () => {
        this.onStatusCallback?.(false, this.roomPin);
      });
    });
  }

  /**
   * Called at 20Hz by the phone's DeviceOrientation & DeviceMotion listeners
   */
  public transmitTelemetry(packet: FieldNodeTelemetryPacket) {
    // Send over WebRTC to PC
    if (this.conn && this.conn.open) {
      this.conn.send(packet);
    }
    // Also broadcast locally in case testing on same machine
    this.localChannel?.postMessage(packet);
  }

  public destroy() {
    this.conn?.close();
    this.peer?.destroy();
    this.localChannel?.close();
  }
}
