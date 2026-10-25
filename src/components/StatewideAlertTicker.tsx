import React from 'react';
import { AlertCircle, Radio, ShieldAlert } from 'lucide-react';
import type { CorridorTelemetryState } from '../types/hydrology';
import { KERALA_CORRIDORS } from '../data/keralaCorridors';

interface StatewideAlertTickerProps {
  telemetryMap: Record<string, CorridorTelemetryState>;
}

export const StatewideAlertTicker: React.FC<StatewideAlertTickerProps> = ({ telemetryMap }) => {
  // Build active alerts based on corridor states
  const alerts: string[] = [];

  for (const c of KERALA_CORRIDORS) {
    const state = telemetryMap[c.id];
    if (!state) continue;

    if (state.physics.hazardTier === 'CRITICAL') {
      alerts.push(
        `🚨 RED ALERT [${c.name.toUpperCase()}]: Upstream FoS ${state.physics.factorOfSafety.toFixed(2)} breached. River Discharge ${state.downstream.dischargeM3s} m³/s. Inundation radius ${state.downstream.inundationRadiusKm}km active at ${c.downstreamNode.name}. Crest ETA: T-${Math.floor(state.physics.floodCrestEtaMinutes / 60)}h ${state.physics.floodCrestEtaMinutes % 60}m.`
      );
    } else if (state.physics.hazardTier === 'WARNING') {
      alerts.push(
        `⚠️ ORANGE ADVISORY [${c.name.toUpperCase()}]: High saturation ${state.physics.deepSaturationPct}%. River discharge surging to ${state.downstream.dischargeM3s} m³/s towards ${c.downstreamNode.name}.`
      );
    } else {
      alerts.push(
        `🟢 NOMINAL [${c.name}]: Baseflow ${state.downstream.dischargeM3s} m³/s, Slope FoS ${state.physics.factorOfSafety.toFixed(2)}.`
      );
    }
  }

  // Official authority feeds
  alerts.push('📡 CWC TELEMETRY: Western Ghats rainfall monitoring stations active across Idukki, Wayanad, and Pathanamthitta sectors.');
  alerts.push('🌊 KSDMA DISPATCH: All emergency relief centers and taluk control rooms on standby. VHF Ch-16 active.');

  return (
    <div className="w-full bg-[#080d1a] border-b border-slate-800 py-1.5 px-3 flex items-center overflow-hidden text-xs font-mono text-slate-300">
      <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-slate-800 text-cyan-400 font-bold tracking-wider">
        <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span>SDMA LIVE FEED:</span>
      </div>

      <div className="overflow-hidden whitespace-nowrap w-full pl-3 relative">
        <div className="inline-block animate-marquee hover:pause">
          {alerts.map((alertText, index) => (
            <span key={index} className="inline-block mx-4 text-slate-300">
              {alertText}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
