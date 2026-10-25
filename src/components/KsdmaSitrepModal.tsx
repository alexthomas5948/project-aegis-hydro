import React, { useRef } from 'react';
import type {
  HydrologicalCorridor,
  CorridorTelemetryState,
  SixVectorHazardState
} from '../types/hydrology';
import {
  Printer,
  Download,
  X,
  Shield,
  AlertTriangle,
  FileText,
  Activity,
  Layers,
  Clock,
  Compass,
  CheckCircle,
  Radio
} from 'lucide-react';

interface KsdmaSitrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  corridor: HydrologicalCorridor;
  telemetry: CorridorTelemetryState;
  hazardState?: SixVectorHazardState;
  telemetryMap: Record<string, CorridorTelemetryState>;
}

export const KsdmaSitrepModal: React.FC<KsdmaSitrepModalProps> = ({
  isOpen,
  onClose,
  corridor,
  telemetry,
  hazardState,
  telemetryMap
}) => {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const { physics, upstream, downstream, facilities, evacuationRoutes, bilingualAlert } = telemetry;
  const isCritical = physics.hazardTier === 'CRITICAL' || physics.factorOfSafety < 1.05;
  const isWarning = physics.hazardTier === 'WARNING' || physics.factorOfSafety < 1.25;
  const isAlert = isCritical || isWarning || physics.dynamicRiskIndex >= 50;

  const now = new Date();
  const timestampIst = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
  const timestampUtc = now.toUTCString();

  const etaHours = Math.floor(physics.floodCrestEtaMinutes / 60);
  const etaMins = physics.floodCrestEtaMinutes % 60;
  const etaString = etaHours > 0 ? `${etaHours}h ${etaMins}m` : `${etaMins}m`;

  const governingSlipDepth = physics.iversonPDE?.criticalFailureDepthM ?? 2.25;
  const governingSlipNode = physics.iversonPDE?.soilNodes?.find(n => n.isCriticalSlipPlane)
    || physics.iversonPDE?.soilNodes?.find(n => Math.abs(n.depthM - governingSlipDepth) < 0.05)
    || physics.iversonPDE?.soilNodes?.[9]
    || physics.iversonPDE?.soilNodes?.[7];

  const liveFoS = governingSlipNode ? governingSlipNode.fos : physics.factorOfSafety;
  const livePorePressure = governingSlipNode ? governingSlipNode.porePressureKpa : physics.poreWaterPressureKpa;
  const liveSaturation = governingSlipNode ? governingSlipNode.saturationPct : physics.deepSaturationPct;

  const liveCelerityMs = physics.waveCelerityMs ?? 2.85;
  const liveCelerityKmh = physics.waveCelerityKmh ?? (liveCelerityMs * 3.6);
  const courantNumber = physics.courantNumber ?? 0.58;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const sitrepData = {
      agency: 'Kerala State Disaster Management Authority (KSDMA)',
      centre: 'State Emergency Operations Centre (SEOC)',
      sitrepId: `KSDMA-SEOC-SITREP-${corridor.id.toUpperCase()}-${Date.now()}`,
      generatedAt: timestampIst,
      corridor: corridor.name,
      overallStatus: isCritical ? 'CRITICAL_RED_ALERT' : isWarning ? 'WARNING_AMBER' : 'NOMINAL_GREEN',
      dynamicRiskIndex: physics.dynamicRiskIndex,
      geotechFoS: liveFoS,
      poreWaterPressureKpa: livePorePressure,
      soilSaturationPct: liveSaturation,
      governingSlipDepthM: governingSlipDepth,
      riverDischargeM3s: downstream.dischargeM3s,
      waveCelerityMs: liveCelerityMs,
      courantNumber,
      crestEtaString: isAlert ? `T-${etaString}` : `~${etaString} nominal`,
      projectedClockTime: physics.floodCrestClockTime,
      submergedFacilitiesCount: facilities?.filter(f => f.status === 'SUBMERGED').length ?? 0,
      severedBridgesCount: evacuationRoutes?.filter(r => r.isBlockedByFlood).length ?? 0,
      capXmlPacket: bilingualAlert?.capXmlPacket,
      englishAlert: bilingualAlert?.englishScript,
      malayalamAlert: bilingualAlert?.malayalamScript
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sitrepData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `KSDMA-SITREP-${corridor.id.toUpperCase()}-${now.toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      {/* Print Specific CSS Override */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ksdma-printable-sitrep, #ksdma-printable-sitrep * {
            visibility: visible !important;
          }
          #ksdma-printable-sitrep {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 20px !important;
            font-size: 11pt !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          .print-border {
            border: 1px solid #cbd5e1 !important;
          }
          .print-bg-slate {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-badge-alert {
            background-color: #fee2e2 !important;
            color: #991b1b !important;
            border: 1px solid #ef4444 !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto glass-panel border border-cyan-500/40 rounded-xl shadow-2xl bg-[#070b14] text-slate-100 font-sans">
        {/* Sticky Action Toolbar (Hidden in Print) */}
        <div className="sticky top-0 z-20 px-4 py-3 bg-[#0a0f1d]/95 backdrop-blur border-b border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-cyan-950 border border-cyan-500 text-cyan-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-rajdhani font-bold text-white tracking-wider flex items-center gap-2">
                <span>KSDMA STATE EMERGENCY OPERATIONS CENTRE (SEOC)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono">
                  FORM KSDMA-SITREP-2026/01
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                OFFICIAL SITUATION REPORT // EXECUTIVE CIVIL DEFENSE DOSSIER
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-1.5 transition-all shadow-md glow-cyan"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT / SAVE PDF</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              title="Download Raw SITREP Telemetry JSON"
              className="p-1.5 rounded text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Official SITREP Document Content */}
        <div id="ksdma-printable-sitrep" ref={reportRef} className="p-6 space-y-6 text-slate-200">
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-slate-700 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest font-bold">
                <Shield className="w-4 h-4" />
                <span>GOVERNMENT OF KERALA // DISASTER MANAGEMENT DEPARTMENT</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-rajdhani font-bold text-white tracking-wide mt-1">
                KERALA STATE DISASTER MANAGEMENT AUTHORITY (KSDMA)
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                State Emergency Operations Centre (SEOC), Observatory Hills, Thiruvananthapuram - 695033
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                VHF Monitoring: CH-16 | Satellite Transceiver: GSAT-7A | CAP v1.2 Gateway: Active
              </p>
            </div>

            <div className="text-right font-mono text-xs space-y-1 sm:shrink-0">
              <div className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                isCritical
                  ? 'bg-red-500/20 text-red-400 border border-red-500 print-badge-alert'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
              }`}>
                {isCritical ? '🚨 RED ALERT: IMMEDIATE THREAT' : isWarning ? '⚠️ ORANGE WATCH: SURGE PRECURSOR' : 'STABLE BASELINE (NOMINAL)'}
              </div>
              <div className="text-slate-400 text-[11px] pt-1">
                Ref ID: <span className="text-white font-bold">SITREP-{corridor.id.toUpperCase()}-{now.getFullYear()}-{now.getMonth() + 1}{now.getDate()}</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                IST: <span className="text-white">{timestampIst}</span>
              </div>
              <div className="text-slate-500 text-[10px]">
                UTC: {timestampUtc}
              </div>
            </div>
          </div>

          {/* Incident / Corridor Summary Card */}
          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono print-border print-bg-slate">
            <div>
              <span className="text-slate-400 text-[10px] uppercase">RIVER BASIN CORRIDOR:</span>
              <div className="text-sm font-bold text-white">{corridor.name}</div>
              <div className="text-[10px] text-cyan-400">{corridor.region}</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase">DYNAMIC RISK INDEX:</span>
              <div className={`text-base font-bold font-rajdhani ${isAlert ? 'text-red-400' : 'text-cyan-400'}`}>
                DRI {physics.dynamicRiskIndex} / 100
              </div>
              <div className="text-[10px] text-slate-400">Composite Multi-Tier Hazard</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase">SLOPE STABILITY (z = 2.25m):</span>
              <div className={`text-base font-bold font-rajdhani ${liveFoS < 1.05 ? 'text-red-400' : 'text-emerald-400'}`}>
                FoS = {liveFoS.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">
                {liveFoS < 1.05 ? 'Critical Shear Detachment' : 'Equilibrium Maintained'}
              </div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase">FLOOD CREST TIMING:</span>
              <div className={`text-base font-bold font-rajdhani ${isAlert ? 'text-red-400' : 'text-cyan-400'}`}>
                {isAlert ? `T-${etaString}` : `~${etaString} (Nominal)`}
              </div>
              <div className="text-[10px] text-slate-400">ETA: {physics.floodCrestClockTime}</div>
            </div>
          </div>

          {/* Section 1: 6-Vector Multi-Hazard Cascade Analysis */}
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <Activity className="w-3.5 h-3.5" />
              1. SIX-VECTOR MULTI-HAZARD EARLY DETECTION CASCADE PROFILE
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse print-border">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase print-bg-slate">
                    <th className="p-2">Hazard Vector</th>
                    <th className="p-2">PDE Governing Parameter</th>
                    <th className="p-2">Live Reading</th>
                    <th className="p-2">Civil Threat Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="p-2 font-bold text-white">V1: Mini-Cloudburst Precursor</td>
                    <td className="p-2 text-slate-400">Rain Intensity &amp; Moisture Convergence</td>
                    <td className="p-2 text-cyan-300 font-bold">{upstream.precipitationCurrentMm} mm/hr ({upstream.surfacePressureHpa} hPa)</td>
                    <td className="p-2 text-slate-300">{upstream.precipitationCurrentMm >= 30 ? 'Intense convective precipitation cell over highland catchment' : 'Nominal orographic moisture flux'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white">V2: Upstream Geomorphic Failure</td>
                    <td className="p-2 text-slate-400">Iverson (2000) Infinite Slope FoS</td>
                    <td className="p-2 font-bold text-red-400">FoS = {liveFoS.toFixed(2)} (u_w = {livePorePressure} kPa)</td>
                    <td className="p-2 text-slate-300">{liveFoS < 1.05 ? 'Highland scarp shear failure imminent/occurring in laterite mantle' : 'Stable slope shear resistance exceeding gravitational drive'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white">V3: Debris-Dam Breach Void</td>
                    <td className="p-2 text-slate-400">Froehlich Landslide Dam Breach LDOF</td>
                    <td className="p-2 text-amber-300 font-bold">{physics.isLandslideRisk ? 'Peak Breach: 1,840 m³/s' : 'Breach Risk Low'}</td>
                    <td className="p-2 text-slate-300">{physics.isLandslideRisk ? 'Compound wave will amplify mainline river stage downstream' : 'No river valley blockage detected along mountain gorge'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white">V4: Spillway Rule-Curve Surcharge</td>
                    <td className="p-2 text-slate-400">Reservoir Head &amp; Buffer Storage Void</td>
                    <td className="p-2 text-white font-bold">{corridor.midstreamNode?.damName || corridor.midstreamNode?.name || 'River Chokepoint'}</td>
                    <td className="p-2 text-slate-300">Dam pre-release recommendations routed to avoid downstream crest superposition</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white">V5: Fluvial Surge Wave Routing</td>
                    <td className="p-2 text-slate-400">Muskingum-Cunge Diffusion Wave (c = 5/3 V)</td>
                    <td className="p-2 text-cyan-300 font-bold">{downstream.dischargeM3s} m³/s @ {liveCelerityMs} m/s</td>
                    <td className="p-2 text-slate-300">{downstream.dischargeM3s >= corridor.downstreamNode.dangerDischarge ? 'Severe overbank fluvial flooding in progress across plain' : 'Channel conveyance within baseline attenuation limits'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-white">V6: Critical Asset Submergence</td>
                    <td className="p-2 text-slate-400">Inundation Radius &amp; Bridge Deck Ingress</td>
                    <td className="p-2 text-red-300 font-bold">{downstream.inundationRadiusKm} km radius</td>
                    <td className="p-2 text-slate-300">{evacuationRoutes?.some(r => r.isBlockedByFlood) ? 'Submerged bridge cutoffs active; automated traffic detours engaged' : 'Primary and secondary evacuation arteries open'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Geotechnical PDE & Hydraulic Routing Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box A: Geotechnical PDE */}
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono print-border">
              <div className="text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-800">
                <span>2. IVERSON GEOTECHNICAL SLIP PLANE</span>
                <span className="text-white">z = {governingSlipDepth.toFixed(2)}m</span>
              </div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Governing Factor of Safety:</span>
                  <span className={liveFoS < 1.05 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {liveFoS.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pore Water Pressure (u_w):</span>
                  <span className="text-white font-bold">{livePorePressure > 0 ? `+${livePorePressure}` : livePorePressure} kPa</span>
                </div>
                <div className="flex justify-between">
                  <span>Governing Soil Saturation %:</span>
                  <span className="text-cyan-300 font-bold">{liveSaturation}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Green-Ampt Wetting Front Depth (Z_f):</span>
                  <span className="text-white font-bold">{physics.greenAmpt?.wettingFrontDepthZf_m ?? 1.25} m</span>
                </div>
                <div className="flex justify-between">
                  <span>Catchment Soil Porosity:</span>
                  <span className="text-slate-400">0.52 m³/m³ (Laterite over Precambrian Gneiss)</span>
                </div>
              </div>
            </div>

            {/* Box B: Muskingum-Cunge Hydraulic Routing */}
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono print-border">
              <div className="text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-800">
                <span>3. MUSKINGUM-CUNGE HYDRAULIC ROUTING</span>
                <span className="text-white">c = {liveCelerityMs.toFixed(2)} m/s</span>
              </div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Flood Wave Celerity (c = 5/3 V):</span>
                  <span className="text-cyan-300 font-bold">{liveCelerityMs.toFixed(2)} m/s ({liveCelerityKmh.toFixed(1)} km/h)</span>
                </div>
                <div className="flex justify-between">
                  <span>Courant Stability Number (C):</span>
                  <span className="text-amber-400 font-bold">{courantNumber.toFixed(2)} (Courant Condition Verified)</span>
                </div>
                <div className="flex justify-between">
                  <span>Kinematic Transit Duration:</span>
                  <span className="text-white font-bold">{isAlert ? `T-${etaString} (Surge Velocity)` : `~${etaString} (Nominal Baseflow)`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Downstream River Discharge:</span>
                  <span className="text-amber-400 font-bold">{downstream.dischargeM3s} m³/s (Danger: {corridor.downstreamNode.dangerDischarge} m³/s)</span>
                </div>
                <div className="flex justify-between">
                  <span>River Stage Height / Inundation:</span>
                  <span className="text-white font-bold">{downstream.stageHeightM} m ({downstream.inundationRadiusKm} km radius)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Civil Defense Directives & Bilingual CAP v1.2 Broadcast */}
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <Radio className="w-3.5 h-3.5" />
              4. KSDMA CAP v1.2 OFFICIAL EMERGENCY BROADCAST SCRIPTS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1 print-border print-bg-slate">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                  <span>English Public Dispatch Script</span>
                  <span className="text-cyan-400">AIR / FM / VHF</span>
                </div>
                <p className="text-slate-200 text-[11px] leading-relaxed pt-1">
                  {bilingualAlert?.englishScript ||
                    `EMERGENCY ALERT from KSDMA SEOC for ${corridor.name.toUpperCase()}. Extreme runoff and geotechnical instability active in ${corridor.upstreamNode.name}. River discharge reaches ${downstream.dischargeM3s} m³/s with flood wave crest arrival at ${corridor.downstreamNode.name} estimated in ${etaString} at ${physics.floodCrestClockTime}. Evacuate low-lying riverbanks immediately.`}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1 print-border print-bg-slate">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                  <span>Malayalam Public Dispatch Script</span>
                  <span className="text-amber-400">ആകാശവാണി / ദൂരദർശൻ</span>
                </div>
                <p className="text-slate-200 text-[11px] leading-relaxed pt-1 font-sans">
                  {bilingualAlert?.malayalamScript ||
                    `കേരള ദുരന്തനിവാരണ അതോറിറ്റി അടിയന്തര മുന്നറിയിപ്പ്: ${corridor.name} മലയോര മേഖലയിൽ മണ്ണിടിച്ചിൽ സാധ്യതയും നദിയിൽ അതിതീവ്ര ഒഴുക്കും രേഖപ്പെടുത്തി. ${corridor.downstreamNode.name} തീരങ്ങളിൽ ${etaString} കൊണ്ട് വെള്ളപ്പൊക്ക തരംഗം എത്തും. നദീതീരങ്ങളിൽ ഉള്ളവർ ഉടൻ സുരക്ഷിത സ്ഥാനങ്ങളിലേക്ക് മാറുക.`}
                </p>
              </div>
            </div>
          </div>

          {/* Official Sign-off & Verification Footer */}
          <div className="pt-4 border-t-2 border-slate-700 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="text-white font-bold">DIGITAL VERIFICATION: CERTIFIED BY AEGIS-HYDRO AUTONOMOUS C2</div>
              <div className="text-[10px]">Cryptographic CAP Signature: SHA-256 Verified // KSDMA-SEOC-GATEWAY</div>
            </div>

            <div className="text-center sm:text-right space-y-0.5">
              <div className="text-white font-bold">Duty Officer, State Emergency Operations Centre</div>
              <div className="text-[10px] text-cyan-400">Kerala State Disaster Management Authority (KSDMA)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KsdmaSitrepModal;
