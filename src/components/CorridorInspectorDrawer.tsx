import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import type { HydrologicalCorridor, CorridorTelemetryState } from '../types/hydrology';
import {
  AlertTriangle,
  Clock,
  Compass,
  Droplets,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  PhoneCall,
  ShieldAlert,
  Sliders,
  TrendingDown,
  TrendingUp,
  Waves,
  Building,
  Activity
} from 'lucide-react';
import { SoilColumnCrossSectionWidget } from './SoilColumnCrossSectionWidget';
import { DamRuleCurveOptimizerPanel } from './DamRuleCurveOptimizerPanel';
import { InfrastructureImpactMatrix } from './InfrastructureImpactMatrix';

interface CorridorInspectorDrawerProps {
  corridor: HydrologicalCorridor;
  telemetry: CorridorTelemetryState;
  onTriggerEmergencyDispatch: () => void;
  onOpenSimulatorForCorridor: () => void;
}

export const CorridorInspectorDrawer: React.FC<CorridorInspectorDrawerProps> = ({
  corridor,
  telemetry,
  onTriggerEmergencyDispatch,
  onOpenSimulatorForCorridor
}) => {
  const [activeTab, setActiveTab] = useState<'hydrograph' | 'geotech' | 'dam' | 'infrastructure' | 'physics' | 'contacts'>('hydrograph');
  const [isExpanded, setIsExpanded] = useState(false);

  const { upstream, downstream, physics, hourlySeries } = telemetry;
  const isCritical = physics.hazardTier === 'CRITICAL';
  const isWarning = physics.hazardTier === 'WARNING';

  // Format ETA string & alert state (UPGRADE 2: Realistic Transit Time vs Crest ETA)
  const etaHours = Math.floor(physics.floodCrestEtaMinutes / 60);
  const etaMins = physics.floodCrestEtaMinutes % 60;
  const etaString = etaHours > 0 ? `${etaHours}h ${etaMins}m` : `${etaMins}m`;
  const isAlert = isCritical || isWarning || physics.dynamicRiskIndex >= 50 || physics.factorOfSafety < 1.05;

  // UPGRADE 3: Governing slip plane synchronization with SoilColumnCrossSectionWidget (z = 2.25m)
  const governingSlipDepth = physics.iversonPDE?.criticalFailureDepthM ?? 2.25;
  const governingSlipNode = physics.iversonPDE?.soilNodes?.find(n => n.isCriticalSlipPlane)
    || physics.iversonPDE?.soilNodes?.find(n => Math.abs(n.depthM - governingSlipDepth) < 0.05)
    || physics.iversonPDE?.soilNodes?.[9]
    || physics.iversonPDE?.soilNodes?.[7];

  const liveGoverningFoS = governingSlipNode ? governingSlipNode.fos : physics.factorOfSafety;
  const liveGoverningPorePressure = governingSlipNode ? governingSlipNode.porePressureKpa : physics.poreWaterPressureKpa;
  const liveGoverningSaturation = governingSlipNode ? governingSlipNode.saturationPct : physics.deepSaturationPct;

  // Live wave celerity & Courant number
  const liveCelerityMs = physics.waveCelerityMs ?? 2.85;
  const liveCelerityKmh = physics.waveCelerityKmh ?? (liveCelerityMs * 3.6);
  const courantNumber = physics.courantNumber ?? 0.58;
  const transitHours = physics.timeOfConcentrationHours ?? 11.33;

  return (
    <div className={`glass-panel border-t md:border border-slate-800 rounded-lg p-4 transition-all duration-300 ${
      isExpanded ? 'h-[720px]' : 'h-auto'
    }`}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${
            isCritical
              ? 'bg-red-950/80 border-red-500 text-red-400 glow-red animate-pulse'
              : isWarning
              ? 'bg-amber-950/80 border-amber-500 text-amber-400 glow-amber'
              : 'bg-cyan-950/80 border-cyan-500 text-cyan-400 glow-cyan'
          }`}>
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-rajdhani font-bold text-white tracking-wide">
                {corridor.name}
              </h2>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                isCritical
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              }`}>
                {physics.hazardTier}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {corridor.region} // Corridor: {corridor.lengthKm} km // Catchment: {corridor.catchmentAreaSqKm} km²
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSimulatorForCorridor}
            className="px-2.5 py-1.5 text-xs font-mono rounded bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-amber-500/20 flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>STRESS-TEST</span>
          </button>

          <button
            onClick={onTriggerEmergencyDispatch}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-all shadow-md ${
              isCritical
                ? 'bg-red-600 hover:bg-red-500 text-white animate-bounce'
                : 'bg-slate-800 hover:bg-red-900/60 text-red-300 border border-red-700/60'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>DISPATCH VOICE C2</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800/80 border border-slate-700"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Real-time KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 my-3">
        {/* Metric 1: Dynamic Risk Index */}
        <div className="glass-panel-subtle p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center justify-between">
            <span>Dynamic Risk (DRI)</span>
            <Activity className="w-3 h-3 text-cyan-400" />
          </div>
          <div className={`text-xl font-rajdhani font-bold mt-1 ${
            physics.dynamicRiskIndex >= 80 ? 'text-red-400' : physics.dynamicRiskIndex >= 60 ? 'text-amber-400' : 'text-cyan-400'
          }`}>
            {physics.dynamicRiskIndex} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
        </div>

        {/* Metric 2: Factor of Safety */}
        <div className="glass-panel-subtle p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center justify-between">
            <span>Infinite Slope FoS</span>
            <TrendingDown className={`w-3 h-3 ${physics.factorOfSafety < 1.05 ? 'text-red-400' : physics.factorOfSafety < 1.25 ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-xl font-rajdhani font-bold mt-1 ${
            physics.factorOfSafety < 1.05 ? 'text-red-400 font-extrabold' : physics.factorOfSafety < 1.25 ? 'text-amber-400 font-bold' : 'text-emerald-400'
          }`}>
            {physics.factorOfSafety.toFixed(2)}
            <span className="text-[10px] font-mono font-normal ml-1 text-slate-400">
              {physics.factorOfSafety < 1.05 ? 'CRITICAL SLIP' : physics.factorOfSafety < 1.25 ? 'WATCH (MARGINAL)' : 'STABLE'}
            </span>
          </div>
        </div>

        {/* Metric 3: Soil Saturation */}
        <div className="glass-panel-subtle p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center justify-between">
            <span>Soil Saturation</span>
            <Droplets className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-cyan-300 mt-1">
            {physics.deepSaturationPct}%
            <span className="text-[10px] font-mono font-normal ml-1 text-slate-400">0-100cm</span>
          </div>
        </div>

        {/* Metric 4: Downstream Discharge */}
        <div className="glass-panel-subtle p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center justify-between">
            <span>River Discharge</span>
            <TrendingUp className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-amber-300 mt-1">
            {downstream.dischargeM3s} <span className="text-xs font-normal text-slate-400">m³/s</span>
          </div>
        </div>

        {/* Metric 5: Flood Crest ETA vs Transit Baseline */}
        <div className={`p-2.5 rounded border transition-all ${
          isAlert
            ? 'bg-red-950/40 border-red-500/60 shadow-lg glow-red'
            : 'glass-panel-subtle border-slate-800'
        }`}>
          <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center justify-between">
            <span>{isAlert ? 'Active Flood Crest ETA' : 'Kinematic Wave Transit'}</span>
            <Clock className={`w-3 h-3 ${isAlert ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`} />
          </div>
          <div className={`text-xl font-rajdhani font-bold mt-1 ${isAlert ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>
            {isAlert ? `CREST ETA: T-${etaString}` : `TRANSIT: ~${etaString} (NOMINAL)`}
          </div>
        </div>

        {/* Metric 6: Inundation Buffer */}
        <div className="glass-panel-subtle p-2.5 rounded border border-slate-800">
          <div className="text-[10px] text-slate-400 font-mono uppercase flex items-center justify-between">
            <span>Inundation Radius</span>
            <ShieldAlert className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-xl font-rajdhani font-bold text-amber-400 mt-1">
            {downstream.inundationRadiusKm} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 text-xs font-mono mb-3 gap-y-1">
        <button
          onClick={() => setActiveTab('hydrograph')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'hydrograph'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>SYNCHRONIZED HYDROGRAPH (24H)</span>
        </button>

        <button
          onClick={() => setActiveTab('geotech')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'geotech'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>SOIL COLUMN PDE &amp; FoS(z)</span>
        </button>

        {corridor.midstreamNode?.damName && (
          <button
            onClick={() => setActiveTab('dam')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'dam'
                ? 'border-amber-400 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>AI DAM RULE-CURVE</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('infrastructure')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'infrastructure'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>SUBMERGED ASSETS &amp; EVACUATION</span>
        </button>

        <button
          onClick={() => setActiveTab('physics')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'physics'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>EQUATIONS &amp; MATH</span>
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'contacts'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>CONTACTS</span>
        </button>
      </div>

      {/* Tab 1: Synchronized Dual Hydrograph Chart */}
      {activeTab === 'hydrograph' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <div>
              <span className="text-cyan-400 font-bold">UPSTREAM SATURATION & PORE PRESSURE</span>
              <span className="mx-2">vs</span>
              <span className="text-amber-400 font-bold">DOWNSTREAM RIVER DISCHARGE WAVE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-sm" />
              <span>Danger Level: {corridor.downstreamNode.dangerDischarge} m³/s</span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full bg-[#080d1a] p-2 rounded border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourlySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="saturationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="dischargeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hourLabel" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  stroke="#06b6d4"
                  fontSize={10}
                  domain={[0, 100]}
                  unit="%"
                  tickLine={false}
                  label={{ value: 'Saturation %', angle: -90, position: 'insideLeft', fill: '#06b6d4', fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f59e0b"
                  fontSize={10}
                  domain={[0, Math.max(corridor.downstreamNode.dangerDischarge * 1.3, 3000)]}
                  unit=" m³/s"
                  tickLine={false}
                  label={{ value: 'Discharge m³/s', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090e1a',
                    borderColor: '#1e293b',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }} />
                
                {/* Danger discharge threshold line */}
                <ReferenceLine
                  yAxisId="right"
                  y={corridor.downstreamNode.dangerDischarge}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'DANGER THRESHOLD', fill: '#ef4444', fontSize: 10, position: 'top' }}
                />

                {/* Primary Data Series */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="soilSaturationPct"
                  name="Soil Saturation %"
                  stroke="#06b6d4"
                  fill="url(#saturationGrad)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="dischargeM3s"
                  name="Discharge (m³/s)"
                  stroke="#f59e0b"
                  fill="url(#dischargeGrad)"
                  strokeWidth={2.5}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="factorOfSafety"
                  name="Slope FoS"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Bar
                  yAxisId="left"
                  dataKey="precipitationMm"
                  name="Precip (mm)"
                  fill="#38bdf8"
                  opacity={0.3}
                  barSize={12}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
            <div>
              <span className="text-white font-bold">Hydrograph Diagnosis: </span>
              {physics.factorOfSafety < 1.15
                ? 'High risk of landslide dam breach compounding downstream river discharge crest wave.'
                : 'Hydraulic routing active. Overland runoff transfer within anticipated attenuation limits.'}
            </div>
            <div className={isAlert ? 'text-red-400 font-bold' : 'text-cyan-400'}>
              {isAlert ? 'Projected Peak Crest Arrival: ' : 'Kinematic Wave Arrival: '}
              <span className="font-bold text-white">{physics.floodCrestClockTime}</span>
              <span className="ml-1 text-[10px]">({isAlert ? `T-${etaString}` : `~${etaString} nominal`})</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Hydro-Geomorphic Physics Engine Equations */}
      {activeTab === 'physics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          {/* Box 1: Upstream Infinite Slope FoS (SYNCHRONIZED WITH SOIL COLUMN PDE z = 2.25m) */}
          <div className="glass-panel-subtle p-3 rounded border border-slate-800 space-y-2">
            <div className="text-cyan-400 font-bold uppercase flex items-center justify-between">
              <span>1. Infinite Slope Stability (FoS)</span>
              <span className={liveGoverningFoS < 1.05 ? 'text-red-400 font-bold animate-pulse' : liveGoverningFoS < 1.25 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                FoS = {liveGoverningFoS.toFixed(2)} ({liveGoverningFoS < 1.05 ? 'CRITICAL SLIP' : liveGoverningFoS < 1.25 ? 'WATCH (MARGINAL)' : 'STABLE'})
              </span>
            </div>
            <div className="p-2 bg-[#060a12] rounded border border-slate-900 text-[11px] text-slate-300">
              <code>FoS = [c' + (γ·z·cos²θ - u_w)·tan φ'] / [γ·z·sin θ·cos θ] (Governing Slip z = {governingSlipDepth.toFixed(2)}m)</code>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>Slope Angle (θ): <span className="text-white">{corridor.upstreamNode.slopeDeg}°</span></div>
              <div>Soil Cohesion (c'): <span className="text-white">{corridor.upstreamNode.soilCohesionKpa} kPa</span></div>
              <div>Friction Angle (φ'): <span className="text-white">{corridor.upstreamNode.frictionAngleDeg}°</span></div>
              <div>Governing Slip Depth (z): <span className="text-white font-bold">{governingSlipDepth.toFixed(2)} m</span></div>
              <div>Pore Water Pressure (u_w): <span className={`font-bold ${liveGoverningPorePressure > 0 ? 'text-amber-400' : 'text-cyan-400'}`}>{liveGoverningPorePressure > 0 ? `+${liveGoverningPorePressure}` : liveGoverningPorePressure} kPa</span></div>
              <div>Soil Saturation %: <span className="text-cyan-300 font-bold">{liveGoverningSaturation}%</span></div>
              <div>Infinite Slope FoS: <span className={`font-bold ${liveGoverningFoS < 1.05 ? 'text-red-400' : 'text-emerald-400'}`}>{liveGoverningFoS.toFixed(2)}</span></div>
              <div>Debris Dam Breach Risk: <span className={physics.isLandslideRisk ? 'text-red-400 font-bold' : 'text-emerald-400'}>{physics.isLandslideRisk ? 'HIGH' : 'LOW'}</span></div>
            </div>
          </div>

          {/* Box 2: SCS Direct Runoff */}
          <div className="glass-panel-subtle p-3 rounded border border-slate-800 space-y-2">
            <div className="text-cyan-400 font-bold uppercase flex items-center justify-between">
              <span>2. SCS-CN Effective Runoff</span>
              <span className="text-amber-400 font-bold">Q = {physics.scsDirectRunoffQ} mm</span>
            </div>
            <div className="p-2 bg-[#060a12] rounded border border-slate-900 text-[11px] text-slate-300">
              <code>Q = (P - 0.2S)² / (P + 0.8S) | S = (25400/CN) - 254</code>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>Current Rain (P): <span className="text-white">{upstream.precipitationCurrentMm} mm/hr</span></div>
              <div>Adjusted CN (AMC-III): <span className="text-white">{physics.scsCurveNumber}</span></div>
              <div>Max Retention (S): <span className="text-white">{physics.scsRetentionS} mm</span></div>
              <div>Initial Abstraction (Ia): <span className="text-white">{(0.2 * physics.scsRetentionS).toFixed(1)} mm</span></div>
              <div>Runoff Yield Ratio: <span className="text-amber-400 font-bold">{upstream.precipitationCurrentMm > 0 ? ((physics.scsDirectRunoffQ / upstream.precipitationCurrentMm) * 100).toFixed(0) : 0}%</span></div>
              <div>Antecedent Saturation: <span className="text-cyan-400 font-bold">{physics.deepSaturationPct}%</span></div>
            </div>
          </div>

          {/* Box 3: Muskingum-Cunge & Seddon Wave Celerity (UPGRADE 3: REPLACED KIRPICH WITH LIVE SEDDON CELERITY) */}
          <div className="glass-panel-subtle p-3 rounded border border-slate-800 space-y-2">
            <div className="text-cyan-400 font-bold uppercase flex items-center justify-between">
              <span>3. MUSKINGUM-CUNGE &amp; SEDDON WAVE CELERITY (c = 5/3 V)</span>
              <span className="text-cyan-300 font-bold">c = {liveCelerityMs.toFixed(2)} m/s ({liveCelerityKmh.toFixed(1)} km/h)</span>
            </div>
            <div className="p-2 bg-[#060a12] rounded border border-slate-900 text-[11px] text-slate-300">
              <code>c = (5/3)·V | Courant C = c·(Δt/Δx) ≤ 1.0 | Transit T = L / c (Kinematic Wave)</code>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>Corridor Length (L): <span className="text-white">{corridor.lengthKm} km</span></div>
              <div>Wave Celerity (c = 5/3 V): <span className="text-cyan-300 font-bold">{liveCelerityMs.toFixed(2)} m/s</span> ({liveCelerityKmh.toFixed(1)} km/h)</div>
              <div>Courant Number (C): <span className="text-amber-400 font-bold">{courantNumber.toFixed(2)}</span> ({courantNumber <= 1.0 ? 'Courant-Stable' : 'Advective Sub-stepped'})</div>
              <div>Mean Flow Velocity (V): <span className="text-white">{(liveCelerityMs / 1.667).toFixed(2)} m/s</span></div>
              <div>Reach Transit Time: <span className="text-white font-bold">{transitHours.toFixed(1)} hrs (~{etaString})</span></div>
              <div>Projected Arrival: <span className="text-white font-bold">{physics.floodCrestClockTime}</span></div>
              <div className="col-span-2 pt-1 border-t border-slate-900 flex items-center justify-between">
                <span>Operational Wave Status:</span>
                <span className={isAlert ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
                  {isAlert ? `CREST ETA: T-${etaString}` : `TRANSIT BASELINE: ~${etaString} (NOMINAL)`}
                </span>
              </div>
            </div>
          </div>

          {/* Box 4: Multi-Layer Porosity & Soil Moisture */}
          <div className="glass-panel-subtle p-3 rounded border border-slate-800 space-y-2">
            <div className="text-cyan-400 font-bold uppercase flex items-center justify-between">
              <span>4. Western Ghats Soil Porosity Model</span>
              <span className="text-cyan-400 font-bold">Porosity = 0.52 m³/m³</span>
            </div>
            <div className="p-2 bg-[#060a12] rounded border border-slate-900 text-[11px] text-slate-300">
              <code>Sat% = [0.15·SM_top + 0.35·SM_mid + 0.50·SM_deep] / 0.52</code>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>Topsoil (0-7cm): <span className="text-white">{upstream.soilMoisture0to7cm} m³/m³</span></div>
              <div>Subsoil (7-28cm): <span className="text-white">{upstream.soilMoisture7to28cm} m³/m³</span></div>
              <div>Colluvium (28-100cm): <span className="text-white">{upstream.soilMoisture28to100cm} m³/m³</span></div>
              <div>Weighted Volumetric: <span className="text-cyan-300 font-bold">{upstream.weightedMoisture} m³/m³</span></div>
              <div>Atmospheric Pressure: <span className="text-white">{upstream.surfacePressureHpa} hPa</span></div>
              <div>Wind Speed: <span className="text-white">{upstream.windSpeedKmh} km/h</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Geotechnical Soil Column PDE */}
      {activeTab === 'geotech' && (
        <SoilColumnCrossSectionWidget
          iversonPDE={physics.iversonPDE}
          greenAmpt={physics.greenAmpt}
          upstreamNode={corridor.upstreamNode}
        />
      )}

      {/* Tab 3: AI Dam Rule-Curve Optimizer */}
      {activeTab === 'dam' && physics.damOptimizer && (
        <DamRuleCurveOptimizerPanel
          damOptimizer={physics.damOptimizer}
          corridor={corridor}
          dri={physics.dynamicRiskIndex}
        />
      )}

      {/* Tab 4: Submerged Assets & Evacuation Graph */}
      {activeTab === 'infrastructure' && (
        <InfrastructureImpactMatrix
          facilities={telemetry.facilities || []}
          routes={telemetry.evacuationRoutes || []}
          corridorName={corridor.name}
        />
      )}

      {/* Tab 4: Inter-Agency Emergency Contact Directory */}
      {activeTab === 'contacts' && (
        <div className="space-y-2 text-xs font-mono">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-2">
            24/7 RAPID RESPONSE INCIDENT COMMANDERS & HOTLINES
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {corridor.emergencyContacts.map((contact, idx) => (
              <div key={idx} className="glass-panel-subtle p-3 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">{contact.agency}</div>
                  <div className="text-[11px] text-cyan-400">{contact.designation}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Channel: {contact.channel}</div>
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="px-3 py-1.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-800/80 transition-colors flex items-center gap-1 text-[11px] font-bold"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>{contact.phone}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
