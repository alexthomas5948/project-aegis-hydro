import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  QrCode,
  Radio,
  RotateCcw,
  Smartphone,
  Wifi,
  X,
  Zap
} from 'lucide-react';
import { fieldSensorSync } from '../services/fieldSensorSync';
import type { FieldNodeTelemetry } from '../types/hydrology';

interface FieldNodePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pin?: string;
  onLaunchMobileTab: () => void;
}

export const FieldNodePairingModal: React.FC<FieldNodePairingModalProps> = ({
  isOpen,
  onClose,
  pin = '4092',
  onLaunchMobileTab
}) => {
  const [telemetry, setTelemetry] = useState<FieldNodeTelemetry | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [transportMode, setTransportMode] = useState<string>('broadcast_channel');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pgaHistoryRef = useRef<number[]>(new Array(100).fill(0.015));
  const pitchHistoryRef = useRef<number[]>(new Array(100).fill(0));

  // Determine target mobile node URL
  const [targetUrl, setTargetUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?mode=field-node&room=${pin}`;
      setTargetUrl(url);
    }
  }, [pin]);

  // Generate QR Code on canvas
  useEffect(() => {
    if (isOpen && targetUrl && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        targetUrl,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#00e5ff',
            light: '#070c18'
          }
        },
        (error) => {
          if (error) console.error('QR code generation error', error);
        }
      );
    }
  }, [isOpen, targetUrl]);

  // Subscribe to real-time telemetry from phone
  useEffect(() => {
    if (!isOpen) return;

    fieldSensorSync.initReceiver(pin);

    const unsubTelemetry = fieldSensorSync.subscribe((data) => {
      setTelemetry(data);
      setIsConnected(true);

      pgaHistoryRef.current.push(data.pga);
      if (pgaHistoryRef.current.length > 100) pgaHistoryRef.current.shift();

      pitchHistoryRef.current.push(data.pitchDelta);
      if (pitchHistoryRef.current.length > 100) pitchHistoryRef.current.shift();
    });

    const unsubConn = fieldSensorSync.subscribeConnection((conn, transport) => {
      setIsConnected(conn);
      setTransportMode(transport);
    });

    return () => {
      unsubTelemetry();
      unsubConn();
    };
  }, [isOpen, pin]);

  // Live Oscilloscope animation inside pairing modal
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;

    const render = () => {
      const canvas = scopeCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#101d30';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Midline
      const midY = h / 2;
      ctx.strokeStyle = '#1e385b';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw PGA (red)
      const pgas = pgaHistoryRef.current;
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      const step = w / (pgas.length - 1);

      for (let i = 0; i < pgas.length; i++) {
        const val = pgas[i];
        const y = Math.max(4, midY - (val / 0.12) * (midY - 8));
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();

      // Draw Pitch Delta (cyan)
      const pitches = pitchHistoryRef.current;
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;

      for (let i = 0; i < pitches.length; i++) {
        const val = pitches[i];
        const y = midY - (val / 4.0) * (midY - 10);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSimulateTap = () => {
    const burst: FieldNodeTelemetry = {
      roomId: pin,
      deviceId: 'SIM-LAPTOP-TAP',
      timestamp: Date.now(),
      pitch: 19.5,
      roll: 1.5,
      pitchDelta: 1.2,
      rollDelta: 0.3,
      creepVelocity: 0.18,
      pga: 0.095,
      seismicRms: 0.65,
      accelX: 0.9,
      accelY: 0.2,
      accelZ: 9.81,
      poreSaturation: 78.0,
      stationName: 'WAYANAD-CHOORALMALA-SLOPE-1',
      hazardLevel: 'WARNING',
      isSimulated: true
    };
    fieldSensorSync.broadcastTelemetry(burst);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-cyan-500/50 bg-[#060b17] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Topbar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-cyan-950/60 to-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500 text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-rajdhani font-bold text-white tracking-wider">
                  PAIR ANDROID FIELD NODE
                </h2>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-xs font-mono font-bold text-cyan-400">
                  PIN: {pin}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">
                HARDWARE-IN-THE-LOOP (HIL) SEISMIC ACCELEROMETER &amp; INCLINOMETER TELEMETRY
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Pairing Instructions & QR Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Left: QR Code Card */}
            <div className="p-4 rounded-xl bg-[#080e1e] border border-cyan-900/50 flex flex-col items-center justify-center space-y-3">
              <div className="p-2 rounded-xl bg-[#070c18] border border-cyan-500/40 shadow-lg shadow-cyan-950/40">
                <canvas ref={qrCanvasRef} width={180} height={180} className="rounded" />
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs font-mono font-bold text-cyan-300 flex items-center justify-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  SCAN WITH SMARTPHONE CAMERA
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Opens the zero-latency mobile sensor node directly in Chrome or Safari on your phone.
                </p>
              </div>
            </div>

            {/* Right: Quick Launch & URL Copy */}
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <p className="text-xs font-mono text-slate-300 font-bold">
                  TESTING ON SAME LAPTOP OR JUDGES&apos; SCREEN:
                </p>
                <p className="text-xs text-slate-400">
                  Launch the Field Node in a separate tab or side-by-side window. Telemetry synchronizes instantly via <span className="text-cyan-400 font-mono">BroadcastChannel</span>.
                </p>

                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={onLaunchMobileTab}
                    className="flex-1 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-rajdhani font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>LAUNCH IN NEW WINDOW</span>
                  </button>

                  <button
                    onClick={handleCopyUrl}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5"
                  >
                    {copiedUrl ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'COPIED!' : 'COPY URL'}</span>
                  </button>
                </div>
              </div>

              {/* Connection Status Badge */}
              <div className="p-3 rounded-xl bg-[#080e1e] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-600' : 'bg-slate-800 text-slate-500'}`}>
                    <Radio className={`w-4 h-4 ${isConnected ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-white">
                      {isConnected ? 'NODE CONNECTED & STREAMING' : 'WAITING FOR SENSOR NODE'}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Transport: <span className="text-cyan-400">{transportMode.toUpperCase()}</span> | Target Room: <span className="text-white font-bold">{pin}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSimulateTap}
                  title="Simulate sudden physical tremor on table"
                  className="py-1.5 px-2.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-mono font-bold flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5 text-red-400" />
                  <span>TAP TABLE</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Ingested Oscilloscope & Telemetry Cards */}
          <div className="space-y-3">
            <div className="glass-panel p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  LIVE HIGH-SPEED OSCILLOSCOPE (STREAMING FROM PHONE @ 20Hz)
                </span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-red-400 flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-red-500 inline-block" /> Seismic PGA (g)
                  </span>
                  <span className="text-cyan-400 flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Δ Pitch Tilt (°)
                  </span>
                </div>
              </div>

              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#060a12]">
                <canvas ref={scopeCanvasRef} width={680} height={130} className="w-full h-28 block" />
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">PITCH INCLINOMETER</span>
                <span className="text-lg font-bold text-cyan-400">
                  {telemetry ? `${telemetry.pitchDelta >= 0 ? '+' : ''}${telemetry.pitchDelta}°` : '0.0°'}
                </span>
                <span className="text-[10px] text-slate-500 block">Baseline Delta</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">SEISMIC PGA</span>
                <span className={`text-lg font-bold ${telemetry && telemetry.pga > 0.05 ? 'text-red-400' : 'text-white'}`}>
                  {telemetry ? `${telemetry.pga.toFixed(3)}g` : '0.012g'}
                </span>
                <span className="text-[10px] text-slate-500 block">Ground Acceleration</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">SLOPE CREEP VELOCITY</span>
                <span className="text-lg font-bold text-amber-400">
                  {telemetry ? `${telemetry.creepVelocity >= 0 ? '+' : ''}${telemetry.creepVelocity}°/h` : '0.02°/h'}
                </span>
                <span className="text-[10px] text-slate-500 block">Deformation Rate</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">PORE SATURATION</span>
                <span className="text-lg font-bold text-blue-400">
                  {telemetry ? `${telemetry.poreSaturation}%` : '74%'}
                </span>
                <span className="text-[10px] text-slate-500 block">Subsurface Moisture</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-[#050914] flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Station: <span className="text-white font-bold">{telemetry?.stationName ?? 'WAYANAD-CHOORALMALA-SLOPE-1'}</span></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
