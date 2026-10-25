import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Radio,
  RotateCcw,
  Shield,
  Smartphone,
  Sliders,
  Volume2,
  VolumeX,
  Vibrate,
  Zap,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { fieldSensorSync } from '../services/fieldSensorSync';
import { WirelessFieldBridge } from '../services/wirelessFieldBridge';
import type { FieldNodeTelemetryPacket } from '../services/wirelessFieldBridge';
import type { FieldNodeTelemetry } from '../types/hydrology';

interface MobileFieldNodeProps {
  pin?: string;
  onExit?: () => void;
}

export const MobileFieldNode: React.FC<MobileFieldNodeProps> = ({
  pin = '4092',
  onExit
}) => {
  // Read PIN from URL query param ?pin= or ?room= if present, else prop
  const resolvedPin = (() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin') || urlParams.get('room');
      if (urlPin) return urlPin;
    }
    return pin || '4092';
  })();

  const [activePin, setActivePin] = useState<string>(resolvedPin);
  const [pinInput, setPinInput] = useState<string>(resolvedPin);
  const [isWebRtcConnected, setIsWebRtcConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const bridgeRef = useRef<WirelessFieldBridge | null>(null);

  // Calibration baseline tare offsets
  const [pitchTare, setPitchTare] = useState<number>(0);
  const [rollTare, setRollTare] = useState<number>(0);
  const [stationName, setStationName] = useState<string>('WAYANAD-CHOORALMALA-SLOPE-1');
  const [poreSaturation, setPoreSaturation] = useState<number>(76.5);

  // Live sensor readings
  const [pitch, setPitch] = useState<number>(18.5);
  const [roll, setRoll] = useState<number>(1.2);
  const [pga, setPga] = useState<number>(0.014);
  const [seismicRms, setSeismicRms] = useState<number>(0.08);
  const [creepVelocity, setCreepVelocity] = useState<number>(0.02);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [sensorPermissionGranted, setSensorPermissionGranted] = useState<boolean>(false);
  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(false);
  const [activeTransport, setActiveTransport] = useState<string>('webrtc_peer');
  const [packetCount, setPacketCount] = useState<number>(0);

  // Oscilloscope canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seismicHistoryRef = useRef<number[]>(new Array(120).fill(0.015));
  const pitchHistoryRef = useRef<number[]>(new Array(120).fill(18.5));

  // Timestamp of last orientation for calculating delta creep
  const lastTimeRef = useRef<number>(Date.now());
  const lastPitchRef = useRef<number>(18.5);

  // Initialize WirelessFieldBridge transmitter
  useEffect(() => {
    const bridge = new WirelessFieldBridge(activePin);
    bridgeRef.current = bridge;
    setIsConnecting(true);

    bridge.connectPhoneToPc(activePin, (connected, peerPin) => {
      setIsWebRtcConnected(connected);
      setIsConnecting(false);
      if (connected) {
        setActiveTransport('webrtc_peer');
        console.log(`[MobileFieldNode] Linked to PC room ${peerPin} over WebRTC DataChannel`);
      }
    });

    fieldSensorSync.initSender(activePin);

    return () => {
      bridge.destroy();
    };
  }, [activePin]);

  const handleConnectPin = () => {
    const clean = pinInput.trim();
    if (clean.length > 0) {
      setActivePin(clean);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('pin', clean);
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  // Request Mobile Hardware Sensor Permissions (iOS 13+ / Android Chrome)
  const requestSensorAccess = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setSensorPermissionGranted(true);
        }
      } else {
        setSensorPermissionGranted(true);
      }
    } catch (err) {
      console.warn('Sensor permission error', err);
      setSensorPermissionGranted(true);
    }
  };

  // Physical Smartphone Hardware Listeners: DeviceOrientation & DeviceMotion
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) {
        const rawPitch = e.beta;
        const rawRoll = e.gamma;
        const now = Date.now();
        const dtHours = Math.max(0.0001, (now - lastTimeRef.current) / (1000 * 3600));
        const dPitch = rawPitch - lastPitchRef.current;
        const creep = parseFloat((dPitch / dtHours).toFixed(2));

        lastPitchRef.current = rawPitch;
        lastTimeRef.current = now;

        setPitch(parseFloat(rawPitch.toFixed(2)));
        setRoll(parseFloat(rawRoll.toFixed(2)));
        setCreepVelocity(creep);
      }
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (acc) {
        const ax = acc.x ?? 0;
        const ay = acc.y ?? 0;
        const az = acc.z ?? 9.81;

        // Dynamic acceleration excluding steady 1g earth gravity vector
        const dynamicMag = Math.sqrt(ax * ax + ay * ay + Math.pow(az - 9.81, 2));
        const livePgaVal = parseFloat((dynamicMag / 9.80665).toFixed(3));
        const liveRms = parseFloat((Math.sqrt((ax * ax + ay * ay + az * az) / 3)).toFixed(2));

        setPga(livePgaVal);
        setSeismicRms(liveRms);

        // Haptic feedback if severe tremor is registered on the phone
        if (livePgaVal > 0.12 && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 40, 100]);
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  // Tare / Zero Calibration: Store baseline phone resting angle
  const handleTareZero = () => {
    setPitchTare(pitch);
    setRollTare(roll);
    setIsCalibrated(true);
  };

  // Compute deltas from calibrated zero
  const pitchDelta = parseFloat((pitch - pitchTare).toFixed(2));
  const rollDelta = parseFloat((roll - rollTare).toFixed(2));

  // Determine hazard level
  let hazardLevel: FieldNodeTelemetry['hazardLevel'] = 'STABLE';
  if (Math.abs(pitchDelta) > 4.5 || pga > 0.08 || Math.abs(creepVelocity) > 0.25) {
    hazardLevel = 'CRITICAL_FAILURE';
  } else if (Math.abs(pitchDelta) > 1.8 || pga > 0.035 || Math.abs(creepVelocity) > 0.09) {
    hazardLevel = 'WARNING';
  }

  // High-Rate Telemetry Broadcast Loop (20Hz / 50ms)
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Send via WebRTC DataChannel + BroadcastChannel to PC
      const packet: FieldNodeTelemetryPacket = {
        pitch,
        roll,
        tiltDeltaDeg: pitchDelta,
        seismicPgaG: pga,
        seismicRmsMs2: seismicRms,
        simulatedMoisturePct: isSimulatedMode ? poreSaturation : null,
        timestamp: Date.now()
      };
      bridgeRef.current?.transmitTelemetry(packet);

      // 2. Also send full FieldNodeTelemetry envelope
      const telemetry: FieldNodeTelemetry = {
        roomId: activePin,
        deviceId: 'HIL-PHONE-NODE-1',
        timestamp: Date.now(),
        pitch,
        roll,
        pitchDelta,
        rollDelta,
        creepVelocity,
        pga,
        seismicRms,
        accelX: parseFloat((pga * 9.8).toFixed(2)),
        accelY: parseFloat((rollDelta * 0.1).toFixed(2)),
        accelZ: 9.81,
        poreSaturation,
        stationName,
        hazardLevel,
        isSimulated: isSimulatedMode
      };

      fieldSensorSync.broadcastTelemetry(telemetry);
      setPacketCount((c) => c + 1);

      // Push into rolling history arrays for the oscilloscope
      seismicHistoryRef.current.push(pga);
      if (seismicHistoryRef.current.length > 120) seismicHistoryRef.current.shift();

      pitchHistoryRef.current.push(pitchDelta);
      if (pitchHistoryRef.current.length > 120) pitchHistoryRef.current.shift();
    }, 50);

    return () => clearInterval(interval);
  }, [activePin, pitch, roll, pitchDelta, rollDelta, creepVelocity, pga, seismicRms, poreSaturation, stationName, hazardLevel, isSimulatedMode]);

  // Render high-speed Oscilloscope on Canvas
  useEffect(() => {
    let animId: number;

    const renderScope = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Dark tactical background
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = '#111e33';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Zero baseline
      const midY = height / 2;
      ctx.strokeStyle = '#1e3a5f';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Seismic PGA trace (Red/Amber)
      const seismicData = seismicHistoryRef.current;
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      const stepX = width / (seismicData.length - 1);

      for (let i = 0; i < seismicData.length; i++) {
        const val = seismicData[i];
        // Scale: 0 to 0.2g maps to midY to 0
        const y = Math.max(5, midY - (val / 0.15) * (midY - 10));
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * stepX, y);
      }
      ctx.stroke();

      // Draw Slope Pitch Delta trace (Cyan)
      const pitchData = pitchHistoryRef.current;
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;

      for (let i = 0; i < pitchData.length; i++) {
        const val = pitchData[i];
        // Scale: -5 deg to +5 deg maps across full height
        const y = midY - (val / 5.0) * (midY - 15);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * stepX, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(renderScope);
    };

    animId = requestAnimationFrame(renderScope);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Manual Trigger: Simulate Table Tap / Seismic Shockwave
  const handleSimulateTremor = () => {
    setIsSimulatedMode(true);
    const burstPga = parseFloat((0.08 + Math.random() * 0.12).toFixed(3));
    setPga(burstPga);
    setSeismicRms(0.75);
    setCreepVelocity(0.32);

    setTimeout(() => {
      setPga(0.014);
      setSeismicRms(0.08);
      setCreepVelocity(0.02);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 flex flex-col font-sans select-none pb-8">
      {/* Tactical Mobile Header */}
      <header className="glass-panel border-b border-cyan-900/60 p-3 flex items-center justify-between sticky top-0 z-30 bg-[#060b17]/95">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="p-1.5 rounded bg-cyan-950 border border-cyan-500 text-cyan-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-rajdhani font-bold text-sm tracking-wider text-white">
                AEGIS HIL NODE
              </span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-[10px] font-mono text-cyan-400 font-bold">
                PIN: {activePin}
              </span>
            </div>
            <p className="text-[9px] font-mono text-slate-400">
              SMARTPHONE SEISMIC &amp; INCLINOMETER STATION
            </p>
          </div>
        </div>

        {/* Real-time Streaming Pulse */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${
            isWebRtcConnected
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-400'
              : isConnecting
              ? 'bg-amber-950/80 border-amber-500 text-amber-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <Radio className={`w-3 h-3 ${isWebRtcConnected ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{isWebRtcConnected ? '20 Hz LIVE' : isConnecting ? 'CONNECTING' : 'OFFLINE'}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            #{packetCount}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-3 space-y-3 max-w-lg mx-auto w-full">
        {/* Wireless PC WebRTC Link Card with 4-Digit PIN Input Box */}
        <div className="glass-panel p-3 rounded-xl border border-cyan-800/60 bg-[#060c1c] space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              CROSS-DEVICE WEBRTC LINK (PC COMMAND CENTER)
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isWebRtcConnected
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                : isConnecting
                ? 'bg-amber-950 text-amber-300 border border-amber-500 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {isWebRtcConnected ? 'LINKED (20Hz)' : isConnecting ? 'PAIRING...' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                PC ROOM PIN (4 DIGITS)
              </label>
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="4092"
                className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-3 py-1.5 text-white font-mono text-base tracking-widest text-center focus:outline-none focus:border-cyan-400 uppercase"
              />
            </div>
            <button
              onClick={handleConnectPin}
              className={`px-4 py-2 mt-4 rounded-lg font-rajdhani font-bold text-xs tracking-wider transition-all shadow-md ${
                isWebRtcConnected
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-black'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black'
              }`}
            >
              {isWebRtcConnected ? 'RE-CONNECT' : 'CONNECT TO PC'}
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-400">
            {isWebRtcConnected ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Live 20Hz sensor stream flowing to PC Command Center (PIN: {activePin})
              </span>
            ) : (
              <span>
                Enter the 4-digit PIN displayed on your PC screen, or scan the QR code to auto-connect.
              </span>
            )}
          </div>
        </div>

        {/* Hardware Permission Prompt (if mobile motion sensors need activation) */}
        {!sensorPermissionGranted && (
          <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/50 flex items-center justify-between gap-2">
            <div className="text-xs">
              <p className="font-bold text-cyan-300">Activate Physical Sensors</p>
              <p className="text-slate-400 text-[11px]">Enable gyroscope &amp; accelerometer ingestion</p>
            </div>
            <button
              onClick={requestSensorAccess}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold"
            >
              Enable Sensors
            </button>
          </div>
        )}

        {/* Hazard Alert Banner */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
            hazardLevel === 'CRITICAL_FAILURE'
              ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
              : hazardLevel === 'WARNING'
              ? 'bg-amber-950/80 border-amber-500 text-amber-200'
              : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={`w-5 h-5 ${hazardLevel === 'CRITICAL_FAILURE' ? 'text-red-400' : hazardLevel === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div>
              <p className="text-xs font-mono font-bold tracking-wider">
                {hazardLevel === 'CRITICAL_FAILURE'
                  ? 'CRITICAL SLOPE DEFORMATION'
                  : hazardLevel === 'WARNING'
                  ? 'ELEVATED SEISMIC / CREEP'
                  : 'FIELD NODE STABLE'}
              </p>
              <p className="text-[10px] opacity-80">
                {hazardLevel === 'CRITICAL_FAILURE'
                  ? 'Subsurface shear rupture precursor registered!'
                  : hazardLevel === 'WARNING'
                  ? 'Creep strain detected on baseline inclination'
                  : 'Resting on monitoring surface'}
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black/40">
            {hazardLevel}
          </span>
        </div>

        {/* Real-time Oscilloscope Display */}
        <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              LIVE WAVEFORM OSCILLOSCOPE
            </span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-red-400 flex items-center gap-1">
                <span className="w-2 h-0.5 bg-red-500 inline-block" /> PGA (g)
              </span>
              <span className="text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Δ Pitch (°)
              </span>
            </div>
          </div>

          <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#060a12]">
            <canvas
              ref={canvasRef}
              width={420}
              height={140}
              className="w-full h-32 block"
            />
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-500">
              TIME (WINDOW: 6s @ 20Hz)
            </div>
          </div>
        </div>

        {/* Primary Gauges: Pitch Inclinometer & Seismic PGA */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Pitch Inclinometer Card */}
          <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                SLOPE TILT (β)
              </span>
              <span className="text-[10px] text-cyan-400 font-bold">
                {isCalibrated ? 'ZEROED' : 'UNCALIBRATED'}
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-mono font-bold text-white">
                  {pitchDelta >= 0 ? `+${pitchDelta}` : pitchDelta}°
                </span>
                <span className="text-xs font-mono text-slate-400">
                  raw: {pitch}°
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                Δ from Tare Baseline ({pitchTare.toFixed(1)}°)
              </p>
            </div>

            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Creep Velocity:</span>
              <span className={`font-bold ${Math.abs(creepVelocity) > 0.1 ? 'text-amber-400' : 'text-slate-300'}`}>
                {creepVelocity >= 0 ? `+${creepVelocity}` : creepVelocity}°/h
              </span>
            </div>
          </div>

          {/* Seismic PGA Card */}
          <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-red-400" />
                SEISMIC PGA
              </span>
              <span className="text-[10px] text-red-400 font-bold">
                3-AXIS IMU
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-mono font-bold ${pga > 0.05 ? 'text-red-400' : 'text-white'}`}>
                  {pga.toFixed(3)}g
                </span>
                <span className="text-xs font-mono text-slate-400">
                  RMS: {seismicRms}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                Peak Ground Acceleration
              </p>
            </div>

            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Acoustic Tremor:</span>
              <span className={`font-bold ${pga > 0.04 ? 'text-red-400' : 'text-emerald-400'}`}>
                {pga > 0.04 ? 'DETECTED' : 'QUIET'}
              </span>
            </div>
          </div>
        </div>

        {/* Tare / Zero Calibration Button (Primary Interaction) */}
        <div className="space-y-2">
          <button
            onClick={handleTareZero}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-black font-rajdhani font-bold text-base tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 active:scale-98 transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            <span>ZERO / TARE CALIBRATION NOW</span>
          </button>
          <p className="text-[10px] font-mono text-center text-slate-400">
            Place phone flat or inclined on judges&apos; table, then tap Tare to calibrate to 0.0°.
          </p>
        </div>

        {/* Demo Controls: Tap Table Simulation & Soil Saturation Slider */}
        <div className="glass-panel p-3 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              DESKTOP / TEST CONTROLS
            </span>
            <span className="text-[10px] text-slate-500">
              For manual or fallback testing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSimulateTremor}
              className="py-2.5 px-3 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/60 text-red-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
            >
              <Zap className="w-3.5 h-3.5 text-red-400" />
              <span>TAP TABLE / SHAKE</span>
            </button>

            <button
              onClick={() => {
                setIsSimulatedMode(true);
                setPitch((p) => parseFloat((p + 2.5).toFixed(1)));
              }}
              className="py-2.5 px-3 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-transform"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>TILT SLOPE +2.5°</span>
            </button>
          </div>

          {/* Soil Saturation Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-400">Subsurface Pore Saturation:</span>
              <span className="text-cyan-400 font-bold">{poreSaturation}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={100}
              step={1}
              value={poreSaturation}
              onChange={(e) => {
                setIsSimulatedMode(true);
                setPoreSaturation(parseFloat(e.target.value));
              }}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Station Selector */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Deployed Station:</span>
            <select
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] rounded px-2 py-1"
            >
              <option value="WAYANAD-CHOORALMALA-SLOPE-1">WAYANAD-CHOORALMALA-SLOPE-1</option>
              <option value="IDUKKI-CHERUTHONI-RIDGE-2">IDUKKI-CHERUTHONI-RIDGE-2</option>
              <option value="PATHANAMTHITTA-SABARIMALA-3">PATHANAMTHITTA-SABARIMALA-3</option>
              <option value="MALAPPURAM-NILAMBUR-SLOPE-4">MALAPPURAM-NILAMBUR-SLOPE-4</option>
            </select>
          </div>
        </div>

        {/* Pairing Information Footer */}
        <div className="p-2.5 rounded-lg bg-[#060b17] border border-slate-800/80 text-[10px] font-mono text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Transport: <span className="text-cyan-400 font-bold">{activeTransport.toUpperCase()}</span></span>
            <span>PIN: <span className="text-white font-bold">{activePin}</span></span>
          </div>
          <p className="text-[9px] text-slate-500">
            Streaming directly to Aegis Laptop Command Center via BroadcastChannel &amp; WebRTC DataChannel.
          </p>
        </div>
      </div>
    </div>
  );
};
