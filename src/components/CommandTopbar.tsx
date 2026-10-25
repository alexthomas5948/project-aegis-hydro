import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Download,
  Flame,
  Globe,
  Radio,
  RefreshCw,
  Shield,
  Volume2,
  VolumeX,
  Zap,
  Smartphone
} from 'lucide-react';
import { telemetryEngine } from '../services/keralaTelemetryEngine';
import { voiceDispatchEngine } from '../services/voiceDispatchEngine';
import type { CorridorTelemetryState } from '../types/hydrology';

interface CommandTopbarProps {
  telemetryMap: Record<string, CorridorTelemetryState>;
  onOpenSimulator: () => void;
  onOpenVoiceConsole: () => void;
  onOpenPairingModal: () => void;
  hasCriticalAlert: boolean;
  isHILConnected?: boolean;
  roomPin?: string;
}

export const CommandTopbar: React.FC<CommandTopbarProps> = ({
  telemetryMap,
  onOpenSimulator,
  onOpenVoiceConsole,
  onOpenPairingModal,
  hasCriticalAlert,
  isHILConnected = false,
  roomPin = '4092'
}) => {
  const [istTime, setIstTime] = useState('');
  const [utcTime, setUtcTime] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMuted, setIsMuted] = useState(voiceDispatchEngine.getIsMuted());

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setIstTime(now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }));
      setUtcTime(now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }));
      setCountdown(telemetryEngine.getNextFetchSeconds());
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await telemetryEngine.fetchLiveTelemetry();
    setIsRefreshing(false);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    voiceDispatchEngine.setMuted(next);
  };

  const handleExportBrief = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(telemetryMap, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `AEGIS-KERALA-TELEMETRY-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const isSimActive = telemetryEngine.getSimulationConfig().active;

  return (
    <header className="w-full glass-panel border-b border-slate-800 px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 sticky top-0 z-40 bg-[#060a12]/95 backdrop-blur-md">
      {/* Brand & C2 Identity */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="relative p-2 rounded bg-cyan-950/80 border border-cyan-500 text-cyan-400 glow-cyan">
            <Shield className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-rajdhani font-bold text-white tracking-wider flex items-center gap-1.5">
                <span>AEGIS-KERALA</span>
                <span className="text-cyan-400 font-mono text-xs px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800">
                  C2 DIGITAL TWIN
                </span>
              </h1>
            </div>
            <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
              STATEWIDE AUTONOMOUS FLOOD &amp; LANDSLIDE EARLY WARNING SYSTEM
            </p>
          </div>
        </div>

        {/* Live Simulation Badge if active */}
        {isSimActive && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-950/90 border border-amber-500 text-amber-300 text-xs font-mono font-bold animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>SIMULATOR ENGAGED</span>
          </div>
        )}
      </div>

      {/* Center: Live Telemetry Clocks & Polling Status */}
      <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
        {/* Clocks */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded bg-[#080e1c] border border-slate-800">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-slate-400">IST:</span>
            <span className="text-white font-bold">{istTime}</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-400">UTC:</span>
            <span className="text-slate-300">{utcTime}</span>
          </div>
        </div>

        {/* Polling Engine Status */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#080e1c] border border-slate-800">
          <div className="relative flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
          <div className="text-[11px]">
            <span className="text-slate-400">ECMWF / GloFAS: </span>
            <span className="text-emerald-400 font-bold">ONLINE</span>
            <span className="text-slate-500 ml-1.5 hidden sm:inline">({countdown}s)</span>
          </div>
          <button
            onClick={handleManualRefresh}
            title="Force refresh now"
            className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Right: Command Actions */}
      <div className="flex items-center gap-2">
        {/* Smartphone HIL Node Pair button */}
        <button
          onClick={onOpenPairingModal}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm ${
            isHILConnected
              ? 'bg-emerald-950/90 border border-emerald-400 text-emerald-300 shadow-emerald-900/50'
              : 'bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300'
          }`}
        >
          <Smartphone className={`w-3.5 h-3.5 ${isHILConnected ? 'text-emerald-400' : 'text-cyan-400'}`} />
          <span>
            {isHILConnected
              ? `FIELD NODE: LIVE 20Hz (PIN ${roomPin})`
              : `FIELD NODE: PIN ${roomPin} [PAIRING...]`}
          </span>
          {isHILConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />}
        </button>

        {/* Simulator Button */}
        <button
          onClick={onOpenSimulator}
          className="px-3 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/50 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>SIMULATE CLOUDBURST</span>
        </button>

        {/* Emergency Voice Console button */}
        <button
          onClick={onOpenVoiceConsole}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md ${
            hasCriticalAlert
              ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse glow-red'
              : 'bg-slate-800 hover:bg-slate-700 text-red-300 border border-red-900/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>VOICE DISPATCH</span>
        </button>

        {/* Audio Mute toggle */}
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute Emergency Siren & Voice' : 'Mute Audio'}
          className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Export Brief */}
        <button
          onClick={handleExportBrief}
          title="Export Operations JSON Brief"
          className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hidden sm:block"
        >
          <Download className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    </header>
  );
};
