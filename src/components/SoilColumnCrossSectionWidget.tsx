import React, { useState } from 'react';
import type { IversonPDEResult, GreenAmptResult, UpstreamNode } from '../types/hydrology';
import {
  AlertTriangle,
  ArrowDown,
  Compass,
  Droplets,
  Layers,
  ShieldAlert,
  TrendingDown,
  Info
} from 'lucide-react';

interface SoilColumnCrossSectionWidgetProps {
  iversonPDE: IversonPDEResult;
  greenAmpt: GreenAmptResult;
  upstreamNode: UpstreamNode;
}

export const SoilColumnCrossSectionWidget: React.FC<SoilColumnCrossSectionWidgetProps> = ({
  iversonPDE,
  greenAmpt,
  upstreamNode
}) => {
  const [selectedDepth, setSelectedDepth] = useState<number | null>(iversonPDE.criticalFailureDepthM);
  const criticalNode = iversonPDE.soilNodes.find(n => n.isCriticalSlipPlane) || iversonPDE.soilNodes[7];
  const activeNode = iversonPDE.soilNodes.find(n => n.depthM === selectedDepth) || criticalNode;

  const isFailed = iversonPDE.stabilityStatus === 'CRITICAL_SHEAR_FAILURE';
  const isCreep = iversonPDE.stabilityStatus === 'MARGINAL_CREEP';

  return (
    <div className="glass-panel p-4 rounded-lg border border-slate-800 space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${isFailed ? 'bg-red-950 border border-red-500 text-red-400 animate-pulse' : isCreep ? 'bg-amber-950 border border-amber-500 text-amber-400' : 'bg-cyan-950 border border-cyan-500 text-cyan-400'}`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide">
              VERTICAL SOIL COLUMN CROSS-SECTION ANALYZER
            </h3>
            <p className="text-[10px] text-slate-400">
              GREEN-AMPT WETTING FRONT &amp; IVERSON (2000) TRANSIENT PORE-PRESSURE PDE
            </p>
          </div>
        </div>

        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
          isFailed
            ? 'bg-red-500/20 text-red-400 border border-red-500/60 animate-pulse'
            : isCreep
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/60'
            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/60'
        }`}>
          {iversonPDE.stabilityStatus.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Critical Shear Slip Plane Banner */}
      <div className={`p-2.5 rounded border flex items-start gap-2 ${
        isFailed
          ? 'bg-red-950/50 border-red-500/70 text-red-200'
          : isCreep
          ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
          : 'bg-slate-900/60 border-slate-800 text-slate-300'
      }`}>
        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isFailed ? 'text-red-400 animate-bounce' : 'text-amber-400'}`} />
        <div className="text-[11px] leading-snug">
          <span className="font-bold">
            {isFailed ? 'CRITICAL SLIP PLANE DETECTED AT' : 'GOVERNING SLIP PLANE AT'} z = {iversonPDE.criticalFailureDepthM}m
          </span>
          <span className="mx-1.5 text-slate-500">|</span>
          <span>Infinite Slope FoS = </span>
          <span className={`font-bold font-rajdhani text-sm ${isFailed ? 'text-red-400' : isCreep ? 'text-amber-400' : 'text-emerald-400'}`}>
            {iversonPDE.minFoS}
          </span>
          <span className="mx-1.5 text-slate-500">|</span>
          <span>Wetting Front Depth: </span>
          <span className="text-cyan-300 font-bold">Z_f = {greenAmpt.wettingFrontDepthZf_m}m</span>
        </div>
      </div>

      {/* Main 2-Column Layout: Visual Soil Column & Stress Tensor Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
        {/* Left Column: Visual 13-Node Soil Column (0.00m to 3.00m) */}
        <div className="md:col-span-7 bg-[#060a12] p-2.5 rounded border border-slate-900 space-y-1">
          <div className="text-[10px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-900">
            <span>DEPTH (z)</span>
            <span>VOLUMETRIC MOISTURE θ(z) &amp; PORE PRESSURE u_w</span>
            <span>FoS(z)</span>
          </div>

          <div className="space-y-1">
            {iversonPDE.soilNodes.map((node) => {
              const isSelected = selectedDepth === node.depthM;
              const isWetting = node.isWettingFront;
              const isCritical = node.isCriticalSlipPlane;

              return (
                <div
                  key={node.depthM}
                  onClick={() => setSelectedDepth(node.depthM)}
                  className={`p-1.5 rounded cursor-pointer transition-all flex items-center justify-between gap-2 text-[11px] ${
                    isCritical
                      ? 'bg-red-950/80 border border-red-500/80 shadow-sm'
                      : isSelected
                      ? 'bg-cyan-950/50 border border-cyan-500/60'
                      : 'hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  {/* Depth Indicator */}
                  <div className="w-14 shrink-0 flex items-center gap-1 font-bold">
                    <span className={isCritical ? 'text-red-400' : 'text-slate-300'}>
                      {node.depthM.toFixed(2)}m
                    </span>
                    {isWetting && (
                      <span className="text-[9px] px-1 rounded bg-cyan-900 text-cyan-300 border border-cyan-700" title="Green-Ampt Wetting Front">
                        Z_f
                      </span>
                    )}
                  </div>

                  {/* Horizontal Bar for Saturation / Moisture */}
                  <div className="flex-1 px-1">
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div
                        className={`h-full transition-all ${
                          node.saturationPct > 85 ? 'bg-red-500' : node.saturationPct > 65 ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${node.saturationPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>θ = {node.volumetricMoisture}</span>
                      <span>
                        u_w = <strong className={node.porePressureKpa > 0 ? 'text-amber-300' : 'text-cyan-400'}>
                          {node.porePressureKpa > 0 ? `+${node.porePressureKpa}` : node.porePressureKpa} kPa
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* FoS Badge */}
                  <div className="w-16 shrink-0 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      node.fos < 1.0
                        ? 'bg-red-500 text-white font-extrabold animate-pulse'
                        : node.fos < 1.15
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {node.fos.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-1 text-[9px] text-slate-500 flex items-center justify-between border-t border-slate-900">
            <span>Bedrock Interface at z = {upstreamNode.bedrockDepthM}m</span>
            <span>Diffusivity D0 = {iversonPDE.hydraulicDiffusivityD0} m²/s</span>
          </div>
        </div>

        {/* Right Column: Node Geotechnical Stress State Inspector */}
        <div className="md:col-span-5 glass-panel-subtle p-3 rounded border border-slate-800 space-y-2">
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>NODE STRESS TENSOR (z = {activeNode.depthM}m)</span>
            <span className={activeNode.fos < 1.15 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              FoS = {activeNode.fos}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div className="flex justify-between py-0.5 border-b border-slate-900">
              <span className="text-slate-400">Total Normal Stress (σ_n):</span>
              <span className="font-bold text-white">{activeNode.effectiveNormalStressKpa + Math.max(0, activeNode.porePressureKpa)} kPa</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-900">
              <span className="text-slate-400">Pore Pressure (u_w):</span>
              <span className={activeNode.porePressureKpa > 0 ? 'text-red-400 font-bold' : 'text-cyan-400'}>
                {activeNode.porePressureKpa} kPa
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-900">
              <span className="text-slate-400">Effective Stress (σ'_n):</span>
              <span className="font-bold text-cyan-300">{activeNode.effectiveNormalStressKpa} kPa</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-900">
              <span className="text-slate-400">Resisting Shear (τ_res):</span>
              <span className="font-bold text-emerald-400">{activeNode.shearStrengthKpa} kPa</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-900">
              <span className="text-slate-400">Driving Gravitational (τ_d):</span>
              <span className="font-bold text-amber-400">{activeNode.drivingShearStressKpa} kPa</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-900">
              <span className="text-slate-400">Soil Saturation:</span>
              <span className="font-bold text-white">{activeNode.saturationPct}%</span>
            </div>
          </div>

          {/* Green-Ampt Cumulative Infiltration Status */}
          <div className="p-2 rounded bg-[#060a12] border border-slate-800 space-y-1 text-[10px] text-slate-400">
            <div className="text-cyan-300 font-bold uppercase">GREEN-AMPT FLUX DIAGNOSTICS:</div>
            <div>Cumulative Infiltration: <span className="text-white font-bold">{greenAmpt.cumulativeInfiltrationF_m * 1000} mm</span></div>
            <div>Infiltration Rate: <span className="text-white font-bold">{greenAmpt.infiltrationCapacityRate_mm_hr} mm/hr</span></div>
            <div>Surface Ponding: <span className={greenAmpt.surfacePondingOccurred ? 'text-red-400 font-bold' : 'text-emerald-400'}>{greenAmpt.surfacePondingOccurred ? 'PONDING ACTIVE' : 'COMPLETE INFILTRATION'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
