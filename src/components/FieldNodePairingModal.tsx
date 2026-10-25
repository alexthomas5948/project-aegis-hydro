import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  CheckCircle2,
  Copy,
  ExternalLink,
  QrCode,
  Radio,
  Zap,
  X,
  Smartphone,
  Maximize2,
  Minimize2,
  PanelBottom,
  Layers
} from 'lucide-react';
import { fieldSensorSync } from '../services/fieldSensorSync';
import type { FieldNodeTelemetry } from '../types/hydrology';

interface FieldNodePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pin?: string;
  onLaunchMobileTab: () => void;
  telemetry?: FieldNodeTelemetry | null;
  isConnected?: boolean;
}

type ViewMode = 'modal' | 'fullscreen' | 'docked';

export const FieldNodePairingModal: React.FC<FieldNodePairingModalProps> = ({
  isOpen,
  onClose,
  pin = '4092',
  onLaunchMobileTab,
  telemetry: propTelemetry,
  isConnected: propIsConnected
}) => {
  const [internalTelemetry, setInternalTelemetry] = useState<FieldNodeTelemetry | null>(null);
  const [internalIsConnected, setInternalIsConnected] = useState<boolean>(false);
  const [transportMode, setTransportMode] = useState<string>('webrtc_peer');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('modal');

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pgaHistoryRef = useRef<number[]>(new Array(120).fill(0.015));
  const pitchHistoryRef = useRef<number[]>(new Array(120).fill(0));

  const telemetry = propTelemetry !== undefined ? propTelemetry : internalTelemetry;
  const isConnected = propIsConnected !== undefined ? propIsConnected : internalIsConnected;

  // Determine target mobile node URL with ?mode=field-node&pin=${pin}
  const [targetUrl, setTargetUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?mode=field-node&pin=${pin}`;
      setTargetUrl(url);
    }
  }, [pin]);

  // Update rolling history buffer when telemetry arrives
  useEffect(() => {
    if (telemetry) {
      pgaHistoryRef.current.push(telemetry.pga);
      if (pgaHistoryRef.current.length > 140) pgaHistoryRef.current.shift();

      pitchHistoryRef.current.push(telemetry.pitchDelta);
      if (pitchHistoryRef.current.length > 140) pitchHistoryRef.current.shift();
    }
  }, [telemetry]);

  // Generate QR Code on canvas
  useEffect(() => {
    if (isOpen && targetUrl && qrCanvasRef.current && viewMode !== 'docked') {
      QRCode.toCanvas(
        qrCanvasRef.current,
        targetUrl,
        {
          width: 170,
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
  }, [isOpen, targetUrl, viewMode]);

  // Fallback broadcast channel subscription
  useEffect(() => {
    if (!isOpen) return;

    fieldSensorSync.initReceiver(pin);

    const unsubTelemetry = fieldSensorSync.subscribe((data) => {
      setInternalTelemetry(data);
      setInternalIsConnected(true);
    });

    const unsubConn = fieldSensorSync.subscribeConnection((conn, transport) => {
      setInternalIsConnected(conn);
      setTransportMode(transport);
    });

    return () => {
      unsubTelemetry();
      unsubConn();
    };
  }, [isOpen, pin]);

  // High-Precision Digital Storage Oscilloscope (DSO) Engine with Phosphor Persistence
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;

    const render = () => {
      const canvas = scopeCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const displayW = rect.width > 0 ? rect.width : (canvas.parentElement?.clientWidth || 900);
      const displayH = 340; // 340px high-DPI canvas

      const targetBufW = Math.floor(displayW * dpr);
      const targetBufH = Math.floor(displayH * dpr);
      if (canvas.width !== targetBufW || canvas.height !== targetBufH) {
        canvas.width = targetBufW;
        canvas.height = targetBufH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const w = displayW;
      const h = displayH;

      // 1. Phosphor trailing decay / history persistence effect
      ctx.fillStyle = 'rgba(5, 9, 18, 0.28)';
      ctx.fillRect(0, 0, w, h);

      const padL = 62; // Left Axis labels (PGA)
      const padR = 62; // Right Axis labels (Pitch Tilt)
      const padT = 26;
      const padB = 26;
      const graphW = Math.max(100, w - padL - padR);
      const graphH = Math.max(80, h - padT - padB);
      const midY = padT + graphH / 2;

      // 2. Dual-Axis Dynamic Auto-Ranging
      // Left Axis (Red - Seismic PGA): 0.0g to Math.max(2.5g, currentPGA * 1.25)
      const pgas = pgaHistoryRef.current;
      const maxSamplePga = pgas.length > 0 ? Math.max(...pgas) : 0;
      const livePga = telemetry?.pga ?? 0;
      const currentPga = Math.max(maxSamplePga, livePga);
      const pgaMax = Math.max(2.5, Math.ceil((currentPga * 1.25) * 2) / 2);

      // Right Axis (Cyan - Pitch Tilt): -90° to +90° centered around calibrated zero
      const pitchMax = 90;

      // 3. High-Contrast Grid & Reference Lines
      // Vertical timebase divisions
      ctx.strokeStyle = '#0e1a2d';
      ctx.lineWidth = 1;
      for (let x = padL; x <= w - padR; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, h - padB);
        ctx.stroke();
      }

      // Horizontal divisions for Left Axis (0.5g intervals)
      const pgaStep = 0.5;
      const numPgaDivs = Math.round(pgaMax / pgaStep);

      for (let d = 0; d <= numPgaDivs; d++) {
        const valG = d * pgaStep;
        const normY = valG / pgaMax;
        const lineY = (padT + graphH) - normY * graphH;

        ctx.strokeStyle = valG === 0 ? '#1e385b' : 'rgba(239, 68, 68, 0.15)';
        ctx.lineWidth = valG === 0 ? 1.5 : 1;
        ctx.setLineDash(valG === 0 ? [] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, lineY);
        ctx.lineTo(w - padR, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Left Axis Label (Red - PGA)
        ctx.fillStyle = '#ef4444';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${valG.toFixed(1)}g`, padL - 8, lineY);
      }

      // Pitch Inclinometer Center Zero Reference (0° at midY)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(w - padR, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Horizontal reference lines and labels for Right Axis (15° steps)
      const pitchDivs = [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90];
      for (const deg of pitchDivs) {
        const lineY = midY - (deg / pitchMax) * (graphH / 2);
        const isMajor = deg % 30 === 0;

        if (deg !== 0) {
          ctx.strokeStyle = isMajor ? 'rgba(6, 182, 212, 0.16)' : 'rgba(6, 182, 212, 0.08)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 5]);
          ctx.beginPath();
          ctx.moveTo(padL, lineY);
          ctx.lineTo(w - padR, lineY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Right Axis Labels on major lines (0°, ±30°, ±60°, ±90°)
        if (isMajor) {
          ctx.fillStyle = '#06b6d4';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${deg >= 0 ? '+' : ''}${deg}°`, w - padR + 8, lineY);
        }
      }

      // Oscilloscope Frame Border
      ctx.strokeStyle = '#1e385b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(padL, padT, graphW, graphH);

      // 4. Smooth Bézier Spline Waveform Rendering with Phosphor Glow
      // Channel 1: Red Trace - Seismic PGA
      if (pgas.length > 1) {
        const stepX = graphW / (pgas.length - 1);
        const pgaPoints: { x: number; y: number }[] = [];

        for (let i = 0; i < pgas.length; i++) {
          const val = pgas[i];
          const px = padL + i * stepX;
          const py = (padT + graphH) - Math.min(1.0, Math.max(0, val / pgaMax)) * graphH;
          pgaPoints.push({ x: px, y: py });
        }

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#EF4444';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pgaPoints[0].x, pgaPoints[0].y);

        for (let i = 0; i < pgaPoints.length - 1; i++) {
          const p0 = pgaPoints[i];
          const p1 = pgaPoints[i + 1];
          const midPointX = (p0.x + p1.x) / 2;
          const midPointY = (p0.y + p1.y) / 2;
          ctx.quadraticCurveTo(p0.x, p0.y, midPointX, midPointY);
        }
        ctx.lineTo(pgaPoints[pgaPoints.length - 1].x, pgaPoints[pgaPoints.length - 1].y);
        ctx.stroke();
        ctx.restore();
      }

      // Channel 2: Cyan Trace - Pitch Tilt Delta
      const pitches = pitchHistoryRef.current;
      if (pitches.length > 1) {
        const stepX = graphW / (pitches.length - 1);
        const pitchPoints: { x: number; y: number }[] = [];

        for (let i = 0; i < pitches.length; i++) {
          const val = pitches[i];
          const px = padL + i * stepX;
          const py = midY - Math.max(-1.0, Math.min(1.0, val / pitchMax)) * (graphH / 2);
          pitchPoints.push({ x: px, y: py });
        }

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#06B6D4';
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pitchPoints[0].x, pitchPoints[0].y);

        for (let i = 0; i < pitchPoints.length - 1; i++) {
          const p0 = pitchPoints[i];
          const p1 = pitchPoints[i + 1];
          const midPointX = (p0.x + p1.x) / 2;
          const midPointY = (p0.y + p1.y) / 2;
          ctx.quadraticCurveTo(p0.x, p0.y, midPointX, midPointY);
        }
        ctx.lineTo(pitchPoints[pitchPoints.length - 1].x, pitchPoints[pitchPoints.length - 1].y);
        ctx.stroke();
        ctx.restore();
      }

      // 5. On-Screen DSO Channel Overlay Status Badges
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // CH1 (Red)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.fillText(
        `CH1 [RED]: SEISMIC PGA | SCALE: 0.0g - ${pgaMax.toFixed(1)}g | LIVE: ${livePga.toFixed(3)}g`,
        padL + 10,
        padT + 8
      );

      // CH2 (Cyan)
      const currentPitchDelta = telemetry?.pitchDelta ?? 0;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.95)';
      ctx.fillText(
        `CH2 [CYAN]: SLOPE TILT | SCALE: ±${pitchMax}° | LIVE: ${currentPitchDelta >= 0 ? '+' : ''}${currentPitchDelta.toFixed(1)}°`,
        padL + 10,
        padT + 22
      );

      // Bottom Right: Timebase & Phosphor DSO status
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
      ctx.fillText(
        `DSO 20Hz HIL STREAM | EMA α=0.15 | PHOSPHOR PERSISTENCE`,
        w - padR - 10,
        h - padB - 8
      );

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, telemetry]);

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
      creepVelocity: 0.2,
      pga: 0.185,
      seismicRms: 0.85,
      accelX: 1.8,
      accelY: 0.3,
      accelZ: 9.81,
      poreSaturation: 78.0,
      stationName: 'WAYANAD-CHOORALMALA-SLOPE-1',
      hazardLevel: 'WARNING',
      isSimulated: true
    };
    fieldSensorSync.broadcastTelemetry(burst);
  };

  if (!isOpen) return null;

  // DOCKED TO MAIN HUD (BOTTOM STRIP ACROSS 3D DASHBOARD)
  if (viewMode === 'docked') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#060b17]/95 border-t-2 border-cyan-500 shadow-2xl backdrop-blur-xl p-3 sm:px-6 transition-all duration-300">
        {/* Docked Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${isConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-600' : 'bg-slate-800 text-slate-500'}`}>
              <Radio className={`w-4 h-4 ${isConnected ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-rajdhani font-bold text-white tracking-wider">
                  HIL FIELD NODE OSCILLOSCOPE (DOCKED)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-[10px] font-mono font-bold text-cyan-400">
                  PIN: {pin}
                </span>
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  {telemetry?.stationName || 'WAYANAD-CHOORALMALA-SLOPE-1'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar & View Controls */}
          <div className="flex items-center gap-2 sm:gap-4 font-mono text-xs">
            <div className="hidden md:flex items-center gap-3 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-300 font-bold">
                PGA: {telemetry ? `${telemetry.pga.toFixed(3)}g` : '0.012g'}
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-bold">
                TILT: {telemetry ? `${telemetry.pitchDelta >= 0 ? '+' : ''}${telemetry.pitchDelta}°` : '+0.0°'}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300 font-bold">
                CREEP: {telemetry !== null && telemetry !== undefined ? `${telemetry.creepVelocity >= 0 ? '+' : ''}${telemetry.creepVelocity.toFixed(1)} °/h` : '+0.0 °/h'}
              </span>
            </div>

            <button
              onClick={handleSimulateTap}
              title="Simulate sudden table tremor"
              className="py-1 px-2.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-mono font-bold flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-red-400" />
              <span className="hidden sm:inline">TAP TABLE</span>
            </button>

            <button
              onClick={() => setViewMode('modal')}
              className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5"
              title="Expand to Wide Modal"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPAND TO MODAL</span>
            </button>

            <button
              onClick={() => setViewMode('fullscreen')}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Expand to Fullscreen"
            >
              <Maximize2 className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close Oscilloscope"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Docked Oscilloscope Canvas */}
        <div className="pt-2 relative">
          <canvas
            ref={scopeCanvasRef}
            className="w-full h-[340px] block rounded-lg overflow-hidden border border-slate-800 bg-[#060a12]"
          />
        </div>
      </div>
    );
  }

  // WIDE MODAL OR FULLSCREEN VIEW
  const isFullscreen = viewMode === 'fullscreen';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? 'p-0 bg-[#060b17]' : 'p-2 sm:p-4 bg-black/85 backdrop-blur-md'}`}>
      <div
        className={`glass-panel w-full ${
          isFullscreen
            ? 'h-full rounded-none border-none'
            : 'w-[94vw] max-w-6xl rounded-2xl border border-cyan-500/50 max-h-[95vh]'
        } bg-[#060b17] shadow-2xl overflow-hidden flex flex-col`}
      >
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
                <span className="text-xs font-mono text-emerald-400 hidden md:inline">
                  [{isConnected ? 'ONLINE & SYNCED' : 'WAITING FOR SENSOR LINK'}]
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">
                HARDWARE-IN-THE-LOOP (HIL) 20Hz DIGITAL STORAGE OSCILLOSCOPE (DSO) &amp; GEOTECHNICAL TELEMETRY
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle: Dock to Main HUD */}
            <button
              onClick={() => setViewMode('docked')}
              className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Dock Oscilloscope to bottom strip across main 3D HUD"
            >
              <PanelBottom className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">DOCK TO MAIN HUD</span>
            </button>

            {/* Toggle: Fullscreen */}
            <button
              onClick={() => setViewMode(isFullscreen ? 'modal' : 'fullscreen')}
              className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand to Fullscreen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">EXIT FULLSCREEN</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">FULLSCREEN</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Row: Pairing Instructions & QR Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Left: QR Code Card */}
            <div className="p-4 rounded-xl bg-[#080e1e] border border-cyan-900/50 flex flex-col sm:flex-row items-center gap-4 justify-center">
              <div className="p-2 rounded-xl bg-[#070c18] border border-cyan-500/40 shadow-lg shadow-cyan-950/40 shrink-0">
                <canvas ref={qrCanvasRef} width={170} height={170} className="rounded" />
              </div>

              <div className="text-left space-y-1.5">
                <p className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  SCAN WITH SMARTPHONE CAMERA
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Opens the zero-latency mobile sensor node directly in Chrome or Safari on your Android or iOS smartphone. Streams IMU &amp; accelerometer data at 20Hz.
                </p>
                <div className="pt-1 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span>Room: <strong className="text-cyan-400 font-bold">{pin}</strong></span>
                  <span>•</span>
                  <span>WebRTC DataChannel</span>
                </div>
              </div>
            </div>

            {/* Right: Quick Launch & URL Copy */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <p className="text-xs font-mono text-slate-300 font-bold">
                  TESTING ON SAME LAPTOP OR JUDGES&apos; SCREEN:
                </p>
                <p className="text-xs text-slate-400">
                  Launch the Field Node in a separate tab or side-by-side window. Telemetry synchronizes instantly via <span className="text-cyan-400 font-mono">BroadcastChannel</span> + <span className="text-cyan-400 font-mono">WebRTC</span>.
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

              {/* Connection Status Badge & Tap Table */}
              <div className="p-3 rounded-xl bg-[#080e1e] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
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
                  className="py-1.5 px-3 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-red-400" />
                  <span>TAP TABLE</span>
                </button>
              </div>
            </div>
          </div>

          {/* Expanded 340px High-DPI Oscilloscope Section */}
          <div className="space-y-3">
            <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-200 font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  20Hz LIVE DIGITAL STORAGE OSCILLOSCOPE (DUAL-AXIS AUTO-RANGING &amp; PHOSPHOR PERSISTENCE)
                </span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-red-400 flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-red-500 inline-block rounded shadow-sm shadow-red-500" /> Left Axis: Seismic PGA (0.0g - 2.5g+)
                  </span>
                  <span className="text-cyan-400 flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-cyan-400 inline-block rounded shadow-sm shadow-cyan-400" /> Right Axis: Pitch Tilt (±90°)
                  </span>
                </div>
              </div>

              {/* 340px Canvas Container */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#060a12] shadow-inner">
                <canvas
                  ref={scopeCanvasRef}
                  className="w-full h-[340px] block"
                />
              </div>
            </div>

            {/* Live Metrics Grid with Clean Units */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">PITCH INCLINOMETER</span>
                <span className="text-xl font-bold text-cyan-400 block">
                  {telemetry ? `${telemetry.pitchDelta >= 0 ? '+' : ''}${telemetry.pitchDelta.toFixed(1)}°` : '+0.0°'}
                </span>
                <span className="text-[10px] text-slate-500 block">Baseline Tare Delta</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">SEISMIC PGA</span>
                <span className={`text-xl font-bold block ${telemetry && telemetry.pga > 0.05 ? 'text-red-400' : 'text-white'}`}>
                  {telemetry ? `${telemetry.pga.toFixed(3)}g` : '0.012g'}
                </span>
                <span className="text-[10px] text-slate-500 block">Ground Acceleration</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">SLOPE CREEP VELOCITY</span>
                <span className="text-xl font-bold text-amber-400 block">
                  {telemetry !== null && telemetry !== undefined
                    ? `${telemetry.creepVelocity >= 0 ? '+' : ''}${telemetry.creepVelocity.toFixed(1)} °/h`
                    : '+0.0 °/h'}
                </span>
                <span className="text-[10px] text-slate-500 block">Smoothed EMA Derivative (α=0.15)</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">PORE SATURATION</span>
                <span className="text-xl font-bold text-blue-400 block">
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
            <span>Station: <strong className="text-white">{telemetry?.stationName ?? 'WAYANAD-CHOORALMALA-SLOPE-1'}</strong></span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="hidden sm:inline text-slate-500">Dual Auto-Ranging: [0.0g - 2.5g+] &amp; [±90°]</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('docked')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold transition-colors flex items-center gap-1.5"
            >
              <PanelBottom className="w-3.5 h-3.5" />
              <span>DOCK TO HUD</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-rajdhani font-bold transition-colors"
            >
              DONE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
