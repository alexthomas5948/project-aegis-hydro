import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CloudRain,
  Compass,
  Database,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Mountain,
  Radio,
  Shield,
  Smartphone,
  Waves,
  Wind,
  Zap
} from 'lucide-react';
import type {
  SixVectorHazardState,
  KeralaDistrict,
  FieldNodeTelemetry
} from '../types/hydrology';

interface SixVectorMultiHazardMatrixProps {
  hazardState: SixVectorHazardState;
  fieldNodeTelemetry: FieldNodeTelemetry | null;
  onOpenPairingModal: () => void;
  onSelectDistrict?: (district: string) => void;
}

export const SixVectorMultiHazardMatrix: React.FC<SixVectorMultiHazardMatrixProps> = ({
  hazardState,
  fieldNodeTelemetry,
  onOpenPairingModal,
  onSelectDistrict
}) => {
  const [selectedVectorIndex, setSelectedVectorIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const {
    vector1Cloudburst: v1,
    vector2Urulpottal: v2,
    vector3LDOF: v3,
    vector4Reservoir: v4,
    vector5FluvialSurge: v5,
    vector6CoastalTidal: v6,
    faultNodes,
    faultEdges,
    districtHazards,
    overallCascadeRiskIndex
  } = hazardState;

  const isCritical = overallCascadeRiskIndex >= 70;

  return (
    <div className="glass-panel rounded-2xl border border-cyan-500/40 bg-[#060a14] p-4 sm:p-5 space-y-5 shadow-2xl">
      {/* Header & Global Cascading Risk HUD */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-950 to-blue-950 border border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-rajdhani font-bold text-white tracking-wider flex items-center gap-2">
                <span>6-VECTOR TOTAL KERALA MULTI-HAZARD EARLY DETECTION ENGINE</span>
              </h2>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-[11px] font-mono font-bold text-cyan-400">
                14 DISTRICTS 24/7
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              CASCADE PREDICTION: CLOUDBURST → URULPOTTAL → LDOF GORGE BREACH → DAM ROUTING → FLUVIAL SURGE → TIDAL LOCK
            </p>
          </div>
        </div>

        {/* Global Cascade Score & HIL Mobile Node Status */}
        <div className="flex items-center gap-3 self-stretch lg:self-auto justify-between lg:justify-end">
          {/* Smartphone HIL Status Pill */}
          <button
            onClick={onOpenPairingModal}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-98 ${
              fieldNodeTelemetry
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-cyan-950/50 border-cyan-700 text-cyan-400 hover:bg-cyan-900/60'
            }`}
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <div className="text-left text-[11px] font-mono leading-tight">
              <div className="font-bold flex items-center gap-1">
                <span>HIL FIELD NODE</span>
                <span className={`w-2 h-2 rounded-full ${fieldNodeTelemetry ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
              </div>
              <span className="text-[9px] text-slate-400">
                {fieldNodeTelemetry ? `PGA: ${fieldNodeTelemetry.pga.toFixed(3)}g | Δθ: ${fieldNodeTelemetry.pitchDelta.toFixed(1)}°` : 'PAIR ANDROID SENSOR'}
              </span>
            </div>
          </button>

          {/* Composite Cascade Score Indicator */}
          <div className={`px-4 py-1.5 rounded-xl border flex items-center gap-3 ${
            isCritical
              ? 'bg-red-950/80 border-red-500 text-red-200 animate-pulse'
              : overallCascadeRiskIndex >= 45
              ? 'bg-amber-950/70 border-amber-500 text-amber-200'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}>
            <div>
              <span className="text-[10px] font-mono text-slate-400 block">CASCADE RISK</span>
              <span className="text-xl font-mono font-bold">{overallCascadeRiskIndex}/100</span>
            </div>
            <div className="text-right text-[10px] font-mono leading-tight">
              <span className="font-bold block text-white">
                {isCritical ? 'CRITICAL CASCADE' : overallCascadeRiskIndex >= 45 ? 'ELEVATED CASCADE' : 'NORMAL BUFFER'}
              </span>
              <span className="text-slate-400">T-Lead Active</span>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* =========================================================================
              THE 6 VECTOR CARDS GRID
             ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* VECTOR 1: MINI-CLOUDBURST */}
            <div
              onClick={() => setSelectedVectorIndex(1)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                v1.status === 'BURST_ACTIVE'
                  ? 'bg-red-950/60 border-red-500 ring-1 ring-red-500'
                  : v1.status === 'CRITICAL_PRECURSOR'
                  ? 'bg-amber-950/50 border-amber-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-cyan-400" />
                  VECTOR 1: OROGRAPHIC CLOUDBURST
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  v1.status === 'BURST_ACTIVE' ? 'bg-red-950 text-red-300 border border-red-600' :
                  v1.status === 'CRITICAL_PRECURSOR' ? 'bg-amber-950 text-amber-300 border border-amber-600' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {v1.status === 'BURST_ACTIVE' ? 'BURST ACTIVE' : `LEAD: ${v1.leadTimeHours}h`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">PRESSURE dP/dt</span>
                  <span className={`text-sm font-bold ${v1.pressureTendencyHpaHr <= -2.0 ? 'text-red-400' : 'text-slate-200'}`}>
                    {v1.pressureTendencyHpaHr.toFixed(1)} hPa/hr
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">MOISTURE CONV.</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {v1.moistureConvergenceIndex}%
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {v1.summary}
              </p>
            </div>

            {/* VECTOR 2: DEEP URULPOTTAL (DEBRIS FLOW) */}
            <div
              onClick={() => setSelectedVectorIndex(2)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                v2.status === 'FAILURE_OCCURRED'
                  ? 'bg-red-950/60 border-red-500 ring-1 ring-red-500'
                  : v2.status === 'IMMINENT_DETACHMENT'
                  ? 'bg-amber-950/60 border-amber-500'
                  : v2.status === 'STABLE_EQUILIBRIUM'
                  ? 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className={`font-bold flex items-center gap-1.5 ${
                  v2.status === 'FAILURE_OCCURRED' ? 'text-red-400' :
                  v2.status === 'IMMINENT_DETACHMENT' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  <Mountain className="w-4 h-4" />
                  VECTOR 2: DEEP URULPOTTAL PDE
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  v2.status === 'FAILURE_OCCURRED' ? 'bg-red-950 text-red-300 border border-red-600' :
                  v2.status === 'IMMINENT_DETACHMENT' ? 'bg-amber-950 text-amber-300 border border-amber-600' :
                  v2.status === 'STABLE_EQUILIBRIUM' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {v2.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">DYNAMIC FoS (z={v2.depthFailureM}m)</span>
                  <span className={`text-sm font-bold ${v2.dynamicFoS < 1.0 ? 'text-red-400' : v2.dynamicFoS < 1.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {v2.dynamicFoS.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] flex items-center justify-between">
                    <span>SEISMIC PGA (g)</span>
                    {fieldNodeTelemetry && (
                      <span className="text-cyan-400 font-mono text-[9px]">Δθ: {fieldNodeTelemetry.pitchDelta.toFixed(1)}°</span>
                    )}
                  </span>
                  <span className={`text-sm font-bold ${v2.livePgaG > 0.04 ? 'text-red-400' : 'text-slate-200'}`}>
                    {v2.livePgaG.toFixed(3)}g
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {v2.summary}
              </p>
            </div>

            {/* VECTOR 3: LANDSLIDE DAM OUTBURST FLOOD (LDOF) */}
            <div
              onClick={() => setSelectedVectorIndex(3)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                v3.status === 'CATASTROPHIC_BREACH_ALERT'
                  ? 'bg-red-950/60 border-red-500 ring-1 ring-red-500'
                  : v3.status === 'IMPOUNDMENT_FORMING'
                  ? 'bg-amber-950/60 border-amber-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className={`font-bold flex items-center gap-1.5 ${
                  v3.status === 'CATASTROPHIC_BREACH_ALERT' ? 'text-red-400' : 'text-purple-400'
                }`}>
                  <AlertOctagon className="w-4 h-4" />
                  VECTOR 3: LDOF GORGE BREACH
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  v3.status === 'CATASTROPHIC_BREACH_ALERT'
                    ? 'bg-red-950 text-red-300 border border-red-600'
                    : 'bg-slate-800 text-purple-300'
                }`}>
                  {v3.status === 'CATASTROPHIC_BREACH_ALERT' ? 'BREACH ACTIVE' : 'W < 45m GORGE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">BLOCKAGE PROB.</span>
                  <span className={`text-sm font-bold ${v3.blockageProbabilityPct > 70 ? 'text-red-400' : v3.blockageProbabilityPct > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {v3.blockageProbabilityPct}%
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">FROEHLICH Q_PEAK</span>
                  <span className={`text-sm font-bold ${v3.froehlichPeakDischargeM3s > 0 ? 'text-purple-300' : 'text-slate-400'}`}>
                    {v3.froehlichPeakDischargeM3s} m³/s
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {v3.summary}
              </p>
            </div>

            {/* VECTOR 4: RESERVOIR RULE-CURVE */}
            <div
              onClick={() => setSelectedVectorIndex(4)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                v4.overallSpillwayStatus === 'EMERGENCY_SPILLWAY_ACTIVE'
                  ? 'bg-red-950/60 border-red-500'
                  : v4.overallSpillwayStatus === 'ELEVATED_RELEASE'
                  ? 'bg-amber-950/50 border-amber-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-blue-400 font-bold flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-400" />
                  VECTOR 4: RESERVOIR RULE-CURVES
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-blue-300">
                  5 MAJOR DAMS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">BUFFER TO RED ALERT</span>
                  <span className={`text-sm font-bold ${v4.hoursToRedAlertMin < 4 ? 'text-red-400' : 'text-slate-200'}`}>
                    {v4.hoursToRedAlertMin.toFixed(1)} hours
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">SPILLWAY STATUS</span>
                  <span className="text-sm font-bold text-blue-400">
                    {v4.overallSpillwayStatus}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {v4.summary}
              </p>
            </div>

            {/* VECTOR 5: 20-REACH FLUVIAL SURGE */}
            <div
              onClick={() => setSelectedVectorIndex(5)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                v5.status === 'EXTREME_FLIGHT_WARNING'
                  ? 'bg-red-950/60 border-red-500'
                  : v5.status === 'OVERBANK_DISCHARGE'
                  ? 'bg-amber-950/50 border-amber-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  VECTOR 5: FLUVIAL SURGE ROUTING
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300">
                  20 REACHES (50km)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">CREST CELERITY</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {v5.waveCelerityMs} m/s
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">PEAK SURGE Q</span>
                  <span className="text-sm font-bold text-white">
                    {v5.peakSurgeDischargeM3s.toLocaleString()} m³/s
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {v5.summary}
              </p>
            </div>

            {/* VECTOR 6: COASTAL TIDAL LOCKING */}
            <div
              onClick={() => setSelectedVectorIndex(6)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                v6.status === 'CATASTROPHIC_BACKWATER'
                  ? 'bg-red-950/60 border-red-500'
                  : v6.status === 'SEVERE_TIDAL_LOCKING'
                  ? 'bg-amber-950/50 border-amber-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-teal-400 font-bold flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-teal-400" />
                  VECTOR 6: COASTAL TIDAL LOCK
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-teal-300">
                  KUTTANAD / KOCHI
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">DRAINAGE BLOCKAGE</span>
                  <span className={`text-sm font-bold ${v6.tidalDrainageBlockageIndexPct > 65 ? 'text-red-400' : 'text-slate-200'}`}>
                    {v6.tidalDrainageBlockageIndexPct}%
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800/80">
                  <span className="text-slate-400 text-[10px] block">BACKWATER STAGNATION</span>
                  <span className="text-sm font-bold text-teal-300">
                    +{v6.backwaterStagnationDepthM}m MSL
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {v6.summary}
              </p>
            </div>
          </div>

          {/* =========================================================================
              CASCADING FAULT TREE / DIRECTED ACYCLIC GRAPH (DAG)
             ========================================================================= */}
          <div className="p-4 rounded-xl bg-[#080d1a] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                CASCADING MULTI-HAZARD FAULT TREE (DYNAMIC DISASTER COUPLING)
              </span>
              <span className="text-[10px] text-slate-400">
                ACTIVE COUPLING PROPAGATION
              </span>
            </div>

            {/* Interactive Fault Tree Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
              {faultNodes.map((node, i) => (
                <div
                  key={node.id}
                  className={`p-2.5 rounded-lg border text-center space-y-1 transition-all ${
                    node.active
                      ? 'bg-red-950/70 border-red-500 shadow-md shadow-red-950/50'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-cyan-400">V{node.vectorIndex}</span>
                    <span className={`px-1 py-0.2 rounded font-bold ${node.active ? 'bg-red-900 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      {node.leadTime}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white line-clamp-1">
                    {node.label.split(':')[1] || node.label}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    Prob: <span className="text-white font-bold">{Math.round(node.probability * 100)}%</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Cascade Flow Legend */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] font-mono text-slate-400">
              <span className="text-cyan-400">Cloudburst (V1)</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-amber-400">Urulpottal (V2)</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-purple-400">Gorge Dam Breach (V3)</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-blue-400">Fluvial Surge (V5)</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-teal-400">Tidal Backwater Lock (V6)</span>
            </div>
          </div>

          {/* =========================================================================
              KERALA 14 DISTRICTS MULTI-HAZARD MONITOR
             ========================================================================= */}
          <div className="p-3.5 rounded-xl bg-[#080d1a] border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                14 KERALA DISTRICTS MULTI-HAZARD RISK MATRIX
              </span>
              <span className="text-[10px] text-slate-400">
                REAL-TIME TELEMETRY SCAN
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs font-mono">
              {Object.entries(districtHazards).map(([district, hazard]) => (
                <div
                  key={district}
                  onClick={() => onSelectDistrict?.(district)}
                  className={`p-2 rounded-lg border cursor-pointer hover:border-cyan-500 transition-colors ${
                    hazard.hazardLevel === 'CRITICAL'
                      ? 'bg-red-950/60 border-red-600 text-red-200'
                      : hazard.hazardLevel === 'WARNING'
                      ? 'bg-amber-950/40 border-amber-700/70 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px] truncate">{district}</span>
                    <span className="text-[10px] font-bold">{hazard.overallRisk}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 truncate mt-0.5">
                    {hazard.primaryHazard}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
