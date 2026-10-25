import React from 'react';
import { KERALA_CORRIDORS } from '../data/keralaCorridors';
import type { CorridorTelemetryState } from '../types/hydrology';
import {
  AlertTriangle,
  Clock,
  Compass,
  Droplets,
  Layers,
  MapPin,
  TrendingDown,
  TrendingUp,
  Waves
} from 'lucide-react';

interface CorridorCardsGridProps {
  telemetryMap: Record<string, CorridorTelemetryState>;
  selectedCorridorId: string;
  onSelectCorridor: (id: string) => void;
}

export const CorridorCardsGrid: React.FC<CorridorCardsGridProps> = ({
  telemetryMap,
  selectedCorridorId,
  onSelectCorridor
}) => {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
        <span className="font-bold uppercase tracking-wider text-cyan-400">
          REAL-TIME KERALA BASIN CORRIDORS ({KERALA_CORRIDORS.length})
        </span>
        <span>CLICK ANY CORRIDOR TO FLY 3D CAMERA &amp; INSPECT</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {KERALA_CORRIDORS.map(corridor => {
          const telemetry = telemetryMap[corridor.id];
          if (!telemetry) return null;

          const isSelected = selectedCorridorId === corridor.id;
          const { physics, downstream, upstream } = telemetry;
          const isCritical = physics.hazardTier === 'CRITICAL';
          const isWarning = physics.hazardTier === 'WARNING';

          const etaHours = Math.floor(physics.floodCrestEtaMinutes / 60);
          const etaMins = physics.floodCrestEtaMinutes % 60;
          const etaStr = etaHours > 0 ? `${etaHours}h ${etaMins}m` : `${etaMins}m`;

          return (
            <div
              key={corridor.id}
              onClick={() => onSelectCorridor(corridor.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'glass-panel border-cyan-400 ring-1 ring-cyan-400 shadow-lg glow-cyan'
                  : isCritical
                  ? 'bg-[#150a0e] border-red-500/60 hover:border-red-400'
                  : isWarning
                  ? 'bg-[#161208] border-amber-500/50 hover:border-amber-400'
                  : 'bg-[#090e1a]/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: Basin Name + DRI Badge */}
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div>
                    <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide">
                      {corridor.name.replace(' Corridor', '')}
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {corridor.region.split('(')[0]}
                    </div>
                  </div>

                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isCritical
                      ? 'bg-red-500/20 text-red-400 border border-red-500/60 animate-pulse'
                      : isWarning
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/60'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  }`}>
                    DRI {physics.dynamicRiskIndex}
                  </div>
                </div>

                {/* Upstream Status */}
                <div className="p-1.5 rounded bg-[#060a12]/80 border border-slate-900 mb-2 space-y-1 text-[11px] font-mono">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>UPSTREAM SLOPES</span>
                    <span className="text-cyan-400">{corridor.upstreamNode.slopeDeg}°</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Slope FoS:</span>
                    <span className={`font-bold ${
                      physics.factorOfSafety < 1.05
                        ? 'text-red-400'
                        : physics.factorOfSafety < 1.25
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {physics.factorOfSafety.toFixed(2)}{' '}
                      <span className="text-[9px] font-normal">
                        ({physics.factorOfSafety < 1.05 ? 'CRITICAL SLIP' : physics.factorOfSafety < 1.25 ? 'WATCH' : 'STABLE'})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Deep Saturation:</span>
                    <span className="text-cyan-300 font-bold">{physics.deepSaturationPct}%</span>
                  </div>
                </div>

                {/* Downstream Status */}
                <div className="p-1.5 rounded bg-[#060a12]/80 border border-slate-900 space-y-1 text-[11px] font-mono">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>DOWNSTREAM SURGE</span>
                    <span className="text-amber-400 font-bold">{downstream.inundationRadiusKm}km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Discharge:</span>
                    <span className="text-amber-300 font-bold">{downstream.dischargeM3s} m³/s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Stage Height:</span>
                    <span className="text-white">{downstream.stageHeightM}m</span>
                  </div>
                </div>
              </div>

              {/* Bottom ETA & Location Footer */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400 truncate max-w-[90px]">{corridor.downstreamNode.name.split('/')[0]}</span>
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  T-{etaStr}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
