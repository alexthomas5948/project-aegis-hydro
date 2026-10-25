import React, { useState } from 'react';
import type { CriticalFacility, EvacuationGraphEdge } from '../types/hydrology';
import {
  AlertOctagon,
  AlertTriangle,
  Building,
  CheckCircle2,
  Compass,
  Hospital,
  MapPin,
  Navigation,
  School,
  ShieldAlert,
  Zap,
  Radio
} from 'lucide-react';

interface InfrastructureImpactMatrixProps {
  facilities: CriticalFacility[];
  routes: EvacuationGraphEdge[];
  corridorName: string;
}

export const InfrastructureImpactMatrix: React.FC<InfrastructureImpactMatrixProps> = ({
  facilities,
  routes,
  corridorName
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'facilities' | 'routes'>('facilities');

  const submergedCount = facilities.filter(f => f.status === 'SUBMERGED').length;
  const criticalIngressCount = facilities.filter(f => f.status === 'CRITICAL_INGRESS').length;
  const blockedBridges = routes.filter(r => r.isBlockedByFlood);

  return (
    <div className="glass-panel p-4 rounded-lg border border-slate-800 space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-950 border border-cyan-500 text-cyan-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide">
              SUBMERGED INFRASTRUCTURE &amp; EVACUATION GRAPH SOLVER
            </h3>
            <p className="text-[10px] text-slate-400">
              OPENSTREETMAP OVERPASS REGISTRY // AUTONOMOUS RE-ROUTING AROUND BREACHED BRIDGES
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-[#060a12] p-1 rounded border border-slate-800 text-[10px]">
          <button
            onClick={() => setActiveSubTab('facilities')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeSubTab === 'facilities' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            CRITICAL ASSETS ({facilities.length})
          </button>
          <button
            onClick={() => setActiveSubTab('routes')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
              activeSubTab === 'routes' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>EVACUATION GRAPH</span>
            {blockedBridges.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Summary Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">SUBMERGED ASSETS</div>
          <div className={`text-lg font-rajdhani font-bold ${submergedCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
            {submergedCount} <span className="text-[10px] font-normal text-slate-400">facilities</span>
          </div>
        </div>

        <div className="p-2 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">CRITICAL INGRESS RISK</div>
          <div className="text-lg font-rajdhani font-bold text-amber-400">
            {criticalIngressCount} <span className="text-[10px] font-normal text-slate-400">facilities</span>
          </div>
        </div>

        <div className="p-2 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">SEVERED BRIDGES</div>
          <div className={`text-lg font-rajdhani font-bold ${blockedBridges.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {blockedBridges.length} <span className="text-[10px] font-normal text-slate-400">crossings</span>
          </div>
        </div>

        <div className="p-2 rounded bg-[#060a12] border border-slate-800">
          <div className="text-[9px] text-slate-400 uppercase">SAFE RE-ROUTING</div>
          <div className="text-lg font-rajdhani font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab 1: Critical Facilities Table */}
      {activeSubTab === 'facilities' && (
        <div className="space-y-1.5">
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {facilities.map((facility) => {
              const isSubmerged = facility.status === 'SUBMERGED';
              const isIngress = facility.status === 'CRITICAL_INGRESS';

              return (
                <div
                  key={facility.id}
                  className={`p-2.5 rounded border flex items-center justify-between gap-3 text-[11px] ${
                    isSubmerged
                      ? 'bg-red-950/60 border-red-500/70 text-red-200'
                      : isIngress
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                      : 'bg-[#060a12] border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded ${
                      isSubmerged ? 'bg-red-900 text-red-300' : isIngress ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {facility.type === 'hospital' ? (
                        <Hospital className="w-3.5 h-3.5" />
                      ) : facility.type === 'school' ? (
                        <School className="w-3.5 h-3.5" />
                      ) : facility.type === 'bridge' ? (
                        <Navigation className="w-3.5 h-3.5" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{facility.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span>{facility.vicinity}</span>
                        <span>•</span>
                        <span>Elev: {facility.elevationM}m</span>
                        <span>•</span>
                        <span>Pop at Risk: {facility.populationImpact.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isSubmerged
                        ? 'bg-red-500 text-white font-extrabold animate-pulse'
                        : isIngress
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    }`}>
                      {facility.status.replace(/_/g, ' ')}
                    </span>
                    {facility.waterDepthM > 0 && (
                      <div className="text-[10px] text-red-400 font-bold mt-0.5">
                        Water Depth: +{facility.waterDepthM}m
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Autonomous Evacuation Route Graph Solver */}
      {activeSubTab === 'routes' && (
        <div className="space-y-2">
          {blockedBridges.length > 0 && (
            <div className="p-2.5 rounded bg-red-950/60 border border-red-500/70 text-red-200 flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <div className="font-bold text-red-300 uppercase">
                  ACTIVE BRIDGE CUTOFF: {blockedBridges.map(b => b.bridgeName).join(', ')}
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  River water level has overtopped bridge deck spans. Autonomous routing has severed these links and redirected civilian evacuation to safe elevated bypass corridors.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {routes.map(route => (
              <div
                key={route.id}
                className={`p-2.5 rounded border flex items-center justify-between gap-3 text-[11px] ${
                  route.isBlockedByFlood
                    ? 'bg-red-950/40 border-red-900/60 text-slate-400 line-through'
                    : 'bg-[#060a12] border-emerald-500/40 text-emerald-200'
                }`}
              >
                <div>
                  <div className={`font-bold ${route.isBlockedByFlood ? 'text-red-400' : 'text-white'}`}>
                    {route.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {route.fromName} $\to$ {route.toName}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    route.isBlockedByFlood
                      ? 'bg-red-500/20 text-red-400 border border-red-500/60'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60'
                  }`}>
                    {route.isBlockedByFlood ? 'BRIDGE SEVERED' : `OPEN // ${route.clearanceSpeedKmh} KM/H`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
