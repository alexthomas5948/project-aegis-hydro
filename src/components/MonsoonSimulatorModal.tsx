import React, { useState, useEffect } from 'react';
import { KERALA_CORRIDORS } from '../data/keralaCorridors';
import { telemetryEngine } from '../services/keralaTelemetryEngine';
import type { SimulationOverrides } from '../types/hydrology';
import {
  AlertOctagon,
  CloudLightning,
  Droplets,
  RotateCcw,
  Sliders,
  Waves,
  Zap,
  X,
  Play,
  Flame
} from 'lucide-react';

interface MonsoonSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCorridorId: string;
}

export const MonsoonSimulatorModal: React.FC<MonsoonSimulatorModalProps> = ({
  isOpen,
  onClose,
  selectedCorridorId
}) => {
  const [config, setConfig] = useState<SimulationOverrides>(telemetryEngine.getSimulationConfig());

  useEffect(() => {
    setConfig(telemetryEngine.getSimulationConfig());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSliderChange = (field: keyof SimulationOverrides, value: any) => {
    const updated = {
      ...config,
      active: true,
      [field]: value
    };
    setConfig(updated);
    telemetryEngine.setSimulationOverrides(updated);
  };

  const handleApplyPreset = (presetKey: 'live' | '2018_deluge' | 'wayanad_2024' | 'kuttanad_2019' | 'chalakudy_flash') => {
    telemetryEngine.loadPresetScenario(presetKey);
    setConfig(telemetryEngine.getSimulationConfig());
  };

  const handleResetLive = () => {
    telemetryEngine.setSimulationOverrides({
      active: false,
      scenarioId: 'live',
      scenarioName: 'Live Sensor Telemetry',
      targetCorridorId: 'all',
      cloudburstRateMmHr: 0,
      damReleaseM3s: 0,
      antecedentSoilMoisturePct: 50
    });
    setConfig(telemetryEngine.getSimulationConfig());
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl glass-panel rounded-xl border border-amber-500/40 shadow-2xl p-5 overflow-hidden scanline-effect text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-amber-950/80 border border-amber-500 text-amber-400">
              <CloudLightning className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-rajdhani font-bold text-white tracking-wider flex items-center gap-2">
                <span>EXTREME MONSOON STRESS-TEST SIMULATOR</span>
                <span className="px-1.5 py-0.5 text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  HACKATHON DEMO OVERRIDE
                </span>
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Instantly simulate cascading cloudbursts, dam shutter breaches, and saturated landslide failures.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Disaster Replay Presets */}
        <div className="my-3 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-red-400" />
            HISTORICAL KERALA DELUGE &amp; STRESS-TEST PRESETS:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              onClick={() => handleApplyPreset('2018_deluge')}
              className={`p-2 rounded border text-left transition-all ${
                config.scenarioId === '2018_deluge'
                  ? 'bg-red-950/90 border-red-500 text-red-200 glow-red'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-red-500/50'
              }`}
            >
              <div className="text-[11px] font-bold font-mono text-red-400">2018 GREAT DELUGE</div>
              <div className="text-[9px] text-slate-400 truncate">Idukki 5 Radial Gates + Aluva</div>
            </button>

            <button
              onClick={() => handleApplyPreset('wayanad_2024')}
              className={`p-2 rounded border text-left transition-all ${
                config.scenarioId === 'wayanad_2024'
                  ? 'bg-red-950/90 border-red-500 text-red-200 glow-red'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-red-500/50'
              }`}
            >
              <div className="text-[11px] font-bold font-mono text-amber-400">WAYANAD 2024</div>
              <div className="text-[9px] text-slate-400 truncate">Mundakkai Debris Scarp FoS 0.76</div>
            </button>

            <button
              onClick={() => handleApplyPreset('kuttanad_2019')}
              className={`p-2 rounded border text-left transition-all ${
                config.scenarioId === 'kuttanad_2019'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-amber-500/50'
              }`}
            >
              <div className="text-[11px] font-bold font-mono text-cyan-400">2019 KUTTANAD</div>
              <div className="text-[9px] text-slate-400 truncate">Pamba Swell &amp; Polder Inundation</div>
            </button>

            <button
              onClick={() => handleApplyPreset('chalakudy_flash')}
              className={`p-2 rounded border text-left transition-all ${
                config.scenarioId === 'chalakudy_flash'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-amber-500/50'
              }`}
            >
              <div className="text-[11px] font-bold font-mono text-yellow-400">CHALAKUDY OVERTOP</div>
              <div className="text-[9px] text-slate-400 truncate">Peringalkuthu Cascading Surge</div>
            </button>
          </div>
        </div>

        {/* Target Corridor Selector */}
        <div className="space-y-1 my-3 text-xs font-mono">
          <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            Target River Basin Corridor:
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleSliderChange('targetCorridorId', 'all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                config.targetCorridorId === 'all'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ALL KERALA BASINS
            </button>
            {KERALA_CORRIDORS.map(c => (
              <button
                key={c.id}
                onClick={() => handleSliderChange('targetCorridorId', c.id)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  config.targetCorridorId === c.id
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {c.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Physics Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 p-3 rounded bg-[#060a12] border border-slate-800">
          {/* Slider 1: Upstream Cloudburst Rate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <CloudLightning className="w-3.5 h-3.5 text-cyan-400" />
                Upstream Cloudburst Rate:
              </span>
              <span className="text-cyan-400 font-bold text-sm">
                {config.cloudburstRateMmHr} <span className="text-[10px] font-normal text-slate-400">mm/hr</span>
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="180"
              step="5"
              value={config.cloudburstRateMmHr}
              onChange={(e) => handleSliderChange('cloudburstRateMmHr', Number(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>0 (Clear)</span>
              <span>65 (Heavy Rain)</span>
              <span>180 (Extreme Cloudburst)</span>
            </div>
          </div>

          {/* Slider 2: Dam Shutter Release */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <Waves className="w-3.5 h-3.5 text-amber-400" />
                Dam Shutter Spillage Release:
              </span>
              <span className="text-amber-400 font-bold text-sm">
                {config.damReleaseM3s} <span className="text-[10px] font-normal text-slate-400">m³/s</span>
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3500"
              step="100"
              value={config.damReleaseM3s}
              onChange={(e) => handleSliderChange('damReleaseM3s', Number(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>0 (Closed)</span>
              <span>1200 (Alert Spillage)</span>
              <span>3500 (Full Breach)</span>
            </div>
          </div>

          {/* Slider 3: Antecedent Soil Moisture % */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-300" />
                Antecedent Soil Saturation:
              </span>
              <span className="text-cyan-300 font-bold text-sm">
                {config.antecedentSoilMoisturePct}%
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="2"
              value={config.antecedentSoilMoisturePct}
              onChange={(e) => handleSliderChange('antecedentSoilMoisturePct', Number(e.target.value))}
              className="w-full accent-cyan-300 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>20% (Dry AMC-I)</span>
              <span>65% (Field Capacity)</span>
              <span>100% (Fully Saturated)</span>
            </div>
          </div>

          {/* Slider 4: Rain Duration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-red-400" />
                Highland Rain Duration:
              </span>
              <span className="text-red-400 font-bold text-sm">
                {config.slopeRainDurationHours} <span className="text-[10px] font-normal text-slate-400">hours</span>
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              value={config.slopeRainDurationHours}
              onChange={(e) => handleSliderChange('slopeRainDurationHours', Number(e.target.value))}
              className="w-full accent-red-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>1 hr (Flash Pulse)</span>
              <span>6 hrs (Severe Event)</span>
              <span>12 hrs (Prolonged Deluge)</span>
            </div>
          </div>
        </div>

        {/* Live Status & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-800 gap-2">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${config.active ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-slate-300">
              {config.active ? `Simulator Engaged: "${config.scenarioName}"` : 'Live Satellite & Gauge Telemetry Active'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleResetLive}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>REVERT TO LIVE API</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-1.5 shadow-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>VIEW DIGITAL TWIN IMPACT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
