import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import type { DamSpillwayOptimizerResult, HydrologicalCorridor } from '../types/hydrology';
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Clock,
  Gauge,
  Layers,
  Sliders,
  TrendingDown,
  Waves,
  Zap
} from 'lucide-react';

interface DamRuleCurveOptimizerPanelProps {
  damOptimizer: DamSpillwayOptimizerResult;
  corridor: HydrologicalCorridor;
}

export const DamRuleCurveOptimizerPanel: React.FC<DamRuleCurveOptimizerPanelProps> = ({
  damOptimizer,
  corridor
}) => {
  return (
    <div className="glass-panel p-4 rounded-lg border border-slate-800 space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-950 border border-amber-500 text-amber-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide">
              AI DAM RULE-CURVE &amp; SPILLWAY PRE-RELEASE OPTIMIZER
            </h3>
            <p className="text-[10px] text-slate-400">
              RADIAL GATE HYDRODYNAMICS &amp; ANTECEDENT VOID STORAGE SURGE MITIGATION
            </p>
          </div>
        </div>

        <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
          PROACTIVE PEAK SHAVING
        </div>
      </div>

      {/* Action Recommendation Banner */}
      <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/60 flex items-start gap-2.5 text-amber-200">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="text-[11px] leading-relaxed">
          <span className="font-bold uppercase text-amber-300">AEGIS RULE-CURVE DIRECTIVE: </span>
          <span>{damOptimizer.actionRecommendation}</span>
        </div>
      </div>

      {/* Dam Spillway Structural KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">RESERVOIR HEAD</div>
          <div className="text-base font-rajdhani font-bold text-cyan-300 mt-0.5">
            {damOptimizer.currentLevelM}m <span className="text-[10px] text-slate-400 font-mono">/ FRL {damOptimizer.fullReservoirLevelM}m</span>
          </div>
          <div className="text-[9px] text-slate-500">H_head = {damOptimizer.headAboveSillM}m above sill</div>
        </div>

        <div className="p-2.5 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">GATE OPENING DIRECTIVE</div>
          <div className="text-base font-rajdhani font-bold text-amber-400 mt-0.5">
            {damOptimizer.recommendedActiveGates} Gates @ {damOptimizer.recommendedGateOpeningHeightCm}cm
          </div>
          <div className="text-[9px] text-slate-500">Total Shutters: {damOptimizer.totalGates} radial</div>
        </div>

        <div className="p-2.5 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">PRE-RELEASE DISCHARGE</div>
          <div className="text-base font-rajdhani font-bold text-white mt-0.5">
            {damOptimizer.preReleaseDischargeM3s} <span className="text-[10px] text-slate-400 font-mono">m³/s</span>
          </div>
          <div className="text-[9px] text-slate-500">Safely below warning threshold</div>
        </div>

        <div className="p-2.5 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase">DOWNSTREAM CREST SHAVED</div>
          <div className="text-base font-rajdhani font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span>-{damOptimizer.crestShavedReductionM}m STAGE</span>
          </div>
          <div className="text-[9px] text-slate-500">{corridor.downstreamNode.name.split('/')[0]} Floodplain</div>
        </div>
      </div>

      {/* Dual Comparative Hydrograph: Unmitigated vs Aegis-Optimized */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-bold text-slate-300">
            12-HOUR TEMPORAL SIMULATION: UNMITIGATED SPILLAGE vs. AEGIS PRE-RELEASE
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="w-2.5 h-1 bg-red-500 inline-block" />
              <span>Unmitigated Peak</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-1 bg-emerald-400 inline-block" />
              <span>Aegis Optimized</span>
            </div>
          </div>
        </div>

        <div className="h-56 w-full bg-[#080d1a] p-2 rounded border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={damOptimizer.ruleCurveSeries} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="unmitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="timeLabel" stroke="#475569" fontSize={10} tickLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                unit=" m³/s"
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090e1a',
                  borderColor: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              />
              <ReferenceLine
                y={corridor.downstreamNode.dangerDischarge}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'DANGER DISCHARGE', fill: '#ef4444', fontSize: 9, position: 'top' }}
              />
              <Area
                type="monotone"
                dataKey="unmitigatedDischargeM3s"
                name="Unmitigated Emergency Spillage (m³/s)"
                stroke="#ef4444"
                fill="url(#unmitGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="optimizedDischargeM3s"
                name="Aegis Pre-Release Flow (m³/s)"
                stroke="#10b981"
                fill="url(#optGrad)"
                strokeWidth={2.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
          <div>
            Unmitigated River Stage: <strong className="text-red-400">{damOptimizer.unmitigatedPeakInundationStageM}m</strong>
          </div>
          <div>
            Aegis-Optimized Stage: <strong className="text-emerald-400">{damOptimizer.optimizedPeakInundationStageM}m</strong>
          </div>
          <div className="text-cyan-300 font-bold">
            Total Flood Mitigation Yield: Shaved {damOptimizer.crestShavedReductionM}m off Aluva Floodplain
          </div>
        </div>
      </div>
    </div>
  );
};
