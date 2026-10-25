import type {
  HydrologicalCorridor,
  HydroPhysicsCalculations,
  HazardTier,
  HourlyForecastPoint,
  TelemetryUpstream,
  TelemetryDownstream
} from '../types/hydrology';
import { solveGreenAmptInfiltration, solveIversonPorePressurePDE } from './geotechSolver';
import { solveMuskingumCungeRouting, optimizeDamSpillwayPreRelease } from './hydraulicRouter';

const WESTERN_GHATS_POROSITY = 0.52; // m3/m3 (Western Ghats lateritic mantle field porosity)
const WATER_UNIT_WEIGHT = 9.81; // kN/m3
const SOIL_DRY_UNIT_WEIGHT = 18.5; // kN/m3

/**
 * Converts multi-layer volumetric soil moisture (m3/m3) into Deep Soil Saturation Percentage
 * across the 0-100cm Western Ghats root and colluvial zone.
 */
export function calculateSoilSaturation(
  sm0to7: number,
  sm7to28: number,
  sm28to100: number,
  porosity = WESTERN_GHATS_POROSITY
): { saturationPct: number; weightedMoisture: number } {
  // Layer weighting: 15% topsoil, 35% subsoil, 50% deep colluvium
  const weightedMoisture = (sm0to7 * 0.15) + (sm7to28 * 0.35) + (sm28to100 * 0.50);
  const saturationPct = Math.min(100, Math.max(0, (weightedMoisture / porosity) * 100));
  return {
    saturationPct: Number(saturationPct.toFixed(1)),
    weightedMoisture: Number(weightedMoisture.toFixed(4))
  };
}

/**
 * Infinite Slope Factor of Safety (FoS) for Upstream Landslide Precursor
 * FoS = (c' + (gamma * z * cos²(theta) - u_w) * tan(phi')) / (gamma * z * sin(theta) * cos(theta))
 */
export function calculateFactorOfSafety(
  slopeDeg: number,
  soilSaturationPct: number,
  cohesionKpa: number,
  frictionAngleDeg: number,
  bedrockDepthM: number
): { fos: number; porePressureKpa: number; isLandslideRisk: boolean } {
  const thetaRad = (slopeDeg * Math.PI) / 180;
  const phiRad = (frictionAngleDeg * Math.PI) / 180;
  const z = Math.max(1.0, bedrockDepthM);

  // Bulk unit weight scales dynamically with water saturation
  const gamma = SOIL_DRY_UNIT_WEIGHT + ((soilSaturationPct / 100) * (WATER_UNIT_WEIGHT * WESTERN_GHATS_POROSITY));

  // Dynamic pore water pressure (u_w) in kPa:
  // Starts accumulating significantly above 60% saturation and surges exponentially near saturation
  let porePressureKpa = 0;
  if (soilSaturationPct > 60) {
    const excessRatio = (soilSaturationPct - 60) / 40;
    // hydrostatic head building along failure plane
    porePressureKpa = WATER_UNIT_WEIGHT * z * Math.pow(excessRatio, 1.4);
  }

  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);
  const cos2Theta = cosTheta * cosTheta;

  // Total normal stress at slip surface: sigma_n = gamma * z * cos²(theta)
  const totalNormalStress = gamma * z * cos2Theta;

  // Effective normal stress: sigma'_n = sigma_n - u_w
  const effectiveNormalStress = Math.max(0.1, totalNormalStress - porePressureKpa);

  // Resisting shear strength: tau_res = c' + sigma'_n * tan(phi')
  const resistingStrength = cohesionKpa + (effectiveNormalStress * Math.tan(phiRad));

  // Driving gravitational shear stress: tau_d = gamma * z * sin(theta) * cos(theta)
  const drivingStress = Math.max(0.5, gamma * z * sinTheta * cosTheta);

  const rawFos = resistingStrength / drivingStress;
  const fos = Number(Math.max(0.4, Math.min(3.5, rawFos)).toFixed(2));
  const isLandslideRisk = fos < 1.15;

  return {
    fos,
    porePressureKpa: Number(porePressureKpa.toFixed(2)),
    isLandslideRisk
  };
}

/**
 * SCS Curve Number (CN) Method for Effective Direct Runoff (Q)
 * Adjusts base CN for Antecedent Soil Moisture Condition (AMC)
 */
export function calculateSCSRunoff(
  precipitationMm: number,
  soilSaturationPct: number,
  baseCN = 82
): { directRunoffQ: number; retentionS: number; adjustedCN: number } {
  let adjustedCN = baseCN;

  // Adjust for AMC based on deep soil saturation
  if (soilSaturationPct >= 75) {
    // AMC III: Wet conditions
    adjustedCN = baseCN / (0.427 + (0.00573 * baseCN));
  } else if (soilSaturationPct <= 45) {
    // AMC I: Dry conditions
    adjustedCN = baseCN / (2.281 - (0.01281 * baseCN));
  } else {
    // Linear interpolation between AMC I and AMC III
    const weight = (soilSaturationPct - 45) / 30;
    const cnI = baseCN / (2.281 - (0.01281 * baseCN));
    const cnIII = baseCN / (0.427 + (0.00573 * baseCN));
    adjustedCN = cnI + weight * (cnIII - cnI);
  }

  adjustedCN = Math.min(99, Math.max(50, adjustedCN));

  // Potential maximum retention S in mm
  const retentionS = (25400 / adjustedCN) - 254;

  // Initial abstraction Ia = 0.2 * S
  const initialAbstraction = 0.2 * retentionS;

  let directRunoffQ = 0;
  if (precipitationMm > initialAbstraction) {
    directRunoffQ = Math.pow(precipitationMm - initialAbstraction, 2) / (precipitationMm + (0.8 * retentionS));
  }

  return {
    directRunoffQ: Number(directRunoffQ.toFixed(2)),
    retentionS: Number(retentionS.toFixed(1)),
    adjustedCN: Number(adjustedCN.toFixed(1))
  };
}

/**
 * Hydraulic Wave Celerity & Crest Arrival Time (Seddon's Law & Manning's Scaling)
 * Higher discharge Q -> faster flow velocity V -> faster wave celerity c -> shorter arrival ETA
 */
export function calculateTimeOfConcentrationAndEta(
  corridor: HydrologicalCorridor,
  soilSaturationPct: number,
  currentDischargeM3s: number,
  referenceDate = new Date()
): { tcHours: number; etaMinutes: number; clockTime: string } {
  // 1. Flow velocity V increases with discharge Q (Manning's relation V ∝ Q^0.4)
  const dangerDischarge = (corridor as any).dangerDischargeM3s ?? corridor.downstreamNode?.dangerDischarge ?? 1500;
  const dischargeRatio = Math.max(0.2, currentDischargeM3s / dangerDischarge);
  const saturationBoost = 1.0 + (soilSaturationPct / 100.0) * 0.45;
  const meanChannelVelocityMs = 1.15 * Math.pow(dischargeRatio, 0.38) * saturationBoost;

  // 2. Seddon's Law flood wave celerity: c = (5/3) * V
  const waveCelerityMs = Math.min(7.5, Math.max(1.2, (5.0 / 3.0) * meanChannelVelocityMs));
  const waveCelerityKmH = waveCelerityMs * 3.6;

  // 3. Crest ETA in minutes = (Corridor Length km / Wave Celerity km/h) * 60
  // Example for Meenachil (78 km):
  // - At calm 108 m³/s -> c ≈ 8.2 km/h -> ETA ≈ T-9h 30m
  // - At extreme cloudburst surge (1,450 m³/s) -> c ≈ 21.5 km/h -> ETA shrinks to T-3h 37m!
  const crestEtaMinutes = Math.round((corridor.lengthKm / waveCelerityKmH) * 60);
  const tcHours = Number((crestEtaMinutes / 60).toFixed(2));

  // Projected clock time in Indian Standard Time (IST)
  const targetTime = new Date(referenceDate.getTime() + (crestEtaMinutes * 60 * 1000));
  const hours = targetTime.getHours().toString().padStart(2, '0');
  const minutes = targetTime.getMinutes().toString().padStart(2, '0');
  const clockTime = `${hours}:${minutes} IST`;

  return {
    tcHours,
    etaMinutes: crestEtaMinutes,
    clockTime
  };
}

/**
 * Dynamic Risk Index (DRI 0-100)
 * Weighted composite:
 * - Upstream Soil Saturation: 35%
 * - Slope Instability (1 / FoS): 20%
 * - Downstream River Discharge Ratio: 25%
 * - Rainfall Intensity: 20%
 */
export function calculateDynamicRiskIndex(
  soilSaturationPct: number,
  fos: number,
  dischargeM3s: number,
  dangerDischargeM3s: number,
  rainIntensityMmHr: number
): { dri: number; hazardTier: HazardTier } {
  // 1. Upstream Soil Saturation Component (0-100)
  const satScore = Math.min(100, Math.max(0, soilSaturationPct));

  // 2. Slope Instability Component (0-100)
  // FoS >= 1.5 -> 0 points, FoS <= 1.0 -> 100 points
  const instabilityScore = Math.min(100, Math.max(0, ((1.5 - fos) / 0.5) * 100));

  // 3. Downstream River Discharge Ratio (0-100)
  const dischargeRatio = (dischargeM3s / Math.max(100, dangerDischargeM3s));
  const dischargeScore = Math.min(100, Math.max(0, dischargeRatio * 100));

  // 4. Rainfall Intensity Component (0-100)
  // 0 to 80 mm/hr
  const rainScore = Math.min(100, Math.max(0, (rainIntensityMmHr / 70) * 100));

  const compositeDRI = (0.35 * satScore) + (0.20 * instabilityScore) + (0.25 * dischargeScore) + (0.20 * rainScore);
  let dri = Math.round(Math.min(100, Math.max(0, compositeDRI)));

  let hazardTier: HazardTier = 'NORMAL';
  if (dri >= 80 || fos < 1.05 || dischargeRatio >= 1.0) {
    hazardTier = 'CRITICAL';
  } else if (dri >= 60 || fos < 1.15 || dischargeRatio >= 0.75) {
    hazardTier = 'WARNING';
  } else if (dri >= 40 || fos < 1.30 || dischargeRatio >= 0.50) {
    hazardTier = 'ADVISORY';
  }

  // Consistent Dynamic Risk Index (DRI) vs. Priority 1 Red Alert:
  // Whenever fos <= 1.05 or a Stage-3 evacuation is triggered (CRITICAL), boost DRI to at least 86 / 100
  if (hazardTier === 'CRITICAL' || fos <= 1.05 || dischargeRatio >= 1.0) {
    dri = Math.max(86, dri);
  }

  return { dri, hazardTier };
}

/**
 * Dynamic Downstream Inundation Radius calculation
 * Base radius expands dynamically as water discharge exceeds warning and danger levels
 */
export function calculateInundationRadiusKm(
  currentDischargeM3s: number,
  warningDischargeM3s: number,
  dangerDischargeM3s: number
): number {
  // Fix Inundation Radius: When currentDischargeM3s < corridor.dangerDischargeM3s * 0.7, set inundationRadiusKm to 0.0 km (CONTAINED IN BANK)
  if (currentDischargeM3s < dangerDischargeM3s * 0.7) {
    return 0.0;
  }

  const baseRadiusKm = 1.2;
  if (currentDischargeM3s <= warningDischargeM3s) {
    const ratio = (currentDischargeM3s - dangerDischargeM3s * 0.7) / Math.max(1, warningDischargeM3s - dangerDischargeM3s * 0.7);
    return Number((baseRadiusKm * (0.4 + 0.6 * ratio)).toFixed(2));
  }
  
  if (currentDischargeM3s <= dangerDischargeM3s) {
    const excess = (currentDischargeM3s - warningDischargeM3s) / Math.max(1, dangerDischargeM3s - warningDischargeM3s);
    return Number((baseRadiusKm + (excess * 2.5)).toFixed(2)); // up to ~3.7 km
  }

  // Extreme breach over danger threshold
  const extremeExcess = (currentDischargeM3s - dangerDischargeM3s) / dangerDischargeM3s;
  return Number((3.7 + Math.min(4.5, extremeExcess * 5.0)).toFixed(2)); // up to ~8.2 km
}

/**
 * Full Corridor Telemetry Physics Evaluation
 */
export function evaluateCorridorPhysics(
  corridor: HydrologicalCorridor,
  upstream: TelemetryUpstream,
  downstream: TelemetryDownstream,
  referenceDate = new Date()
): HydroPhysicsCalculations {
  const { saturationPct } = calculateSoilSaturation(
    upstream.soilMoisture0to7cm,
    upstream.soilMoisture7to28cm,
    upstream.soilMoisture28to100cm
  );

  const greenAmpt = solveGreenAmptInfiltration(
    upstream.precipitationCurrentMm,
    3.0,
    corridor.upstreamNode.hydraulicConductivityKs || 2.4e-5,
    corridor.upstreamNode.capillarySuctionPsif || 0.22,
    corridor.upstreamNode.saturatedMoistureThetaS || 0.52,
    saturationPct
  );

  const iversonPDE = solveIversonPorePressurePDE(
    corridor.upstreamNode,
    upstream.precipitationCurrentMm,
    3.0,
    saturationPct,
    greenAmpt
  );

  // Governing FoS is the minimum FoS computed across the vertical soil column
  const governingFoS = iversonPDE.minFoS;
  const isLandslideRisk = governingFoS < corridor.upstreamNode.criticalFoSThreshold;

  const { directRunoffQ, retentionS, adjustedCN } = calculateSCSRunoff(
    upstream.precipitationCurrentMm,
    saturationPct
  );

  const { tcHours, etaMinutes, clockTime } = calculateTimeOfConcentrationAndEta(
    corridor,
    saturationPct,
    downstream.dischargeM3s,
    referenceDate
  );

  const { dri, hazardTier } = calculateDynamicRiskIndex(
    saturationPct,
    governingFoS,
    downstream.dischargeM3s,
    corridor.downstreamNode.dangerDischarge,
    upstream.precipitationCurrentMm
  );

  const muskingumCunge = solveMuskingumCungeRouting(
    corridor,
    Math.max(downstream.dischargeM3s, downstream.dischargeMaxM3s * 0.9),
    corridor.downstreamNode.baseDischarge
  );

  const damOptimizer = optimizeDamSpillwayPreRelease(
    corridor,
    downstream.dischargeM3s,
    upstream.precipitationCurrentMm
  );

  return {
    deepSaturationPct: saturationPct,
    poreWaterPressureKpa: iversonPDE.transientPorePressureSurgeKpa,
    factorOfSafety: governingFoS,
    isLandslideRisk,
    scsCurveNumber: adjustedCN,
    scsRetentionS: retentionS,
    scsDirectRunoffQ: directRunoffQ,
    timeOfConcentrationHours: tcHours,
    floodCrestEtaMinutes: etaMinutes,
    floodCrestClockTime: clockTime,
    dynamicRiskIndex: dri,
    hazardTier,
    greenAmpt,
    iversonPDE,
    muskingumCunge,
    damOptimizer
  };
}

/**
 * Generate 24-Hour Synced Hydrograph Points
 */
export function generate24HourHydrograph(
  corridor: HydrologicalCorridor,
  basePhysics: HydroPhysicsCalculations,
  currentRainMm: number,
  currentDischargeM3s: number
): HourlyForecastPoint[] {
  const points: HourlyForecastPoint[] = [];
  const now = new Date();
  const danger = corridor.downstreamNode.dangerDischarge;

  for (let i = -12; i <= 12; i++) {
    const pointDate = new Date(now.getTime() + (i * 3600 * 1000));
    const hourLabel = `${pointDate.getHours().toString().padStart(2, '0')}:00`;
    
    // Hydrograph wave shape: peaks near the estimated crest arrival time
    const crestPeakOffsetHours = Math.round(basePhysics.timeOfConcentrationHours);
    const distFromPeak = Math.abs(i - crestPeakOffsetHours);
    const attenuation = Math.exp(-Math.pow(distFromPeak / 4.5, 2));

    let rain = currentRainMm;
    if (i < 0) {
      rain = Math.max(0, currentRainMm * (0.6 + 0.4 * Math.sin(i / 2)));
    } else if (i === 0) {
      rain = currentRainMm;
    } else {
      rain = Math.max(0, currentRainMm * (1 - (i / 15)));
    }

    // Saturation progression
    const sat = Math.min(100, Math.max(25, basePhysics.deepSaturationPct + (i > 0 ? (i * 0.8 * (currentRainMm / 30)) : (i * 0.5))));
    
    // Pore pressure curve
    const pore = sat > 60 ? Number((18 * Math.pow((sat - 60) / 40, 1.4)).toFixed(1)) : 0;
    
    // FoS inversely tracks saturation and pore pressure
    const fos = Number(Math.max(0.65, Math.min(2.4, basePhysics.factorOfSafety - (i > 0 && currentRainMm > 20 ? (i * 0.04) : 0))).toFixed(2));

    // Discharge hydrograph: baseline + wave pulse
    const baseFlow = corridor.downstreamNode.baseDischarge;
    const peakSurge = Math.max(150, (currentDischargeM3s - baseFlow) * 1.3);
    const discharge = Math.round(baseFlow + (peakSurge * attenuation) + (i < 0 ? (i + 12) * 15 : 0));

    points.push({
      time: pointDate.toISOString(),
      hourLabel,
      precipitationMm: Number(rain.toFixed(1)),
      soilSaturationPct: Number(sat.toFixed(1)),
      porePressureKpa: pore,
      factorOfSafety: fos,
      dischargeM3s: Math.max(corridor.downstreamNode.baseDischarge, discharge),
      dangerLevelM3s: danger
    });
  }

  return points;
}
