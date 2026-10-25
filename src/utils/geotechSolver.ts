import type {
  GreenAmptResult,
  IversonPDEResult,
  SoilColumnNode,
  UpstreamNode
} from '../types/hydrology';

const GAMMA_W = 9.81; // Unit weight of water (kN/m3)
const GAMMA_DRY = 17.8; // Dry unit weight of lateritic soil (kN/m3)
const SPECIFIC_STORAGE = 2.5e-4; // m^-1 for fractured rock/laterite mantle

/**
 * Approximation of the complementary error function erfc(x) and its integral ierfc(x)
 * ierfc(x) = exp(-x^2) / sqrt(pi) - x * erfc(x)
 */
function erfcApprox(x: number): number {
  if (x < 0) return 2 - erfcApprox(-x);
  if (x > 4.5) return 0;
  // Abramowitz and Stegun formula 7.1.26
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1.0 / (1.0 + p * x);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  return poly * Math.exp(-x * x);
}

function ierfc(x: number): number {
  const sqrtPi = Math.sqrt(Math.PI);
  return Math.exp(-x * x) / sqrtPi - x * erfcApprox(x);
}

/**
 * UPGRADE 1.1: Green-Ampt Infiltration Solver
 * Solves infiltration capacity f(t) and wetting front depth Z_f(t)
 */
export function solveGreenAmptInfiltration(
  rainMmHr: number,
  durationHours: number,
  ks_m_s: number,
  psiF_m: number,
  thetaS: number,
  antecedentSaturationPct: number
): GreenAmptResult {
  const thetaI = 0.12 + (thetaS - 0.12) * (antecedentSaturationPct / 100);
  const deltaTheta = Math.max(0.04, thetaS - thetaI);

  // Convert rainfall intensity to m/s
  const i_m_s = (rainMmHr / 1000) / 3600;
  const t_sec = Math.max(60, durationHours * 3600);

  // Time to ponding (seconds)
  let t_pond_sec = Infinity;
  if (i_m_s > ks_m_s) {
    t_pond_sec = (ks_m_s * psiF_m * deltaTheta) / (i_m_s * (i_m_s - ks_m_s));
  }

  let F_m = 0; // Cumulative infiltration in meters
  let f_m_s = ks_m_s; // Infiltration capacity rate in m/s
  let surfacePonding = false;

  if (t_sec <= t_pond_sec) {
    // Pre-ponding: all rainfall infiltrates directly
    F_m = i_m_s * t_sec;
    f_m_s = i_m_s;
    surfacePonding = false;
  } else {
    surfacePonding = true;
    const F_pond = i_m_s * t_pond_sec;
    const dt_after = t_sec - t_pond_sec;

    // Newton-Raphson solver for implicit Green-Ampt equation:
    // g(F) = F - F_pond - psiF*deltaTheta*ln((F + psiF*deltaTheta)/(F_pond + psiF*deltaTheta)) - Ks*dt = 0
    let F_guess = F_pond + ks_m_s * dt_after * 1.2;
    const B = psiF_m * deltaTheta;
    const denomBase = F_pond + B;

    for (let iter = 0; iter < 12; iter++) {
      const g = F_guess - F_pond - B * Math.log((F_guess + B) / denomBase) - ks_m_s * dt_after;
      const g_prime = 1.0 - B / (F_guess + B);
      const step = g / Math.max(1e-6, g_prime);
      F_guess -= step;
      if (Math.abs(step) < 1e-6) break;
    }

    F_m = Math.max(F_pond, F_guess);
    // Instantaneous infiltration capacity rate: f(t) = Ks * (1 + B / F(t))
    f_m_s = ks_m_s * (1.0 + B / Math.max(1e-4, F_m));
  }

  // Wetting front depth Z_f = F / deltaTheta
  const Z_f_m = Number((F_m / deltaTheta).toFixed(3));
  const f_mm_hr = Number((f_m_s * 3600 * 1000).toFixed(1));
  const excessRainMmHr = Number(Math.max(0, rainMmHr - f_mm_hr).toFixed(1));

  return {
    cumulativeInfiltrationF_m: Number(F_m.toFixed(4)),
    infiltrationCapacityRate_mm_hr: f_mm_hr,
    wettingFrontDepthZf_m: Z_f_m,
    surfacePondingOccurred: surfacePonding,
    effectiveDirectRainfallExcessMmHr: excessRainMmHr
  };
}

/**
 * UPGRADE 1.2: Iverson (2000) Transient Pore-Pressure PDE Solver
 * Evaluates transient pore pressure and depth-resolved Factor of Safety FoS(z)
 * across 0m to 3.0m discretized in 0.25m nodes.
 */
export function solveIversonPorePressurePDE(
  upstream: UpstreamNode,
  rainMmHr: number,
  durationHours: number,
  antecedentSaturationPct: number,
  greenAmpt: GreenAmptResult
): IversonPDEResult {
  const Ks = upstream.hydraulicConductivityKs || 2.4e-5; // m/s
  const D0 = Ks / SPECIFIC_STORAGE; // Hydraulic diffusivity (m2/s) ~ 0.096 m2/s
  const thetaDeg = upstream.slopeDeg;
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const phiRad = (upstream.frictionAngleDeg * Math.PI) / 180;
  const c_prime = upstream.soilCohesionKpa; // kPa
  const z_bedrock = upstream.bedrockDepthM || 2.2; // meters

  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);
  const cos2Theta = cosTheta * cosTheta;

  // Normalized time parameter t* = t / t0 where t0 = z_bedrock^2 / D0
  const t_sec = Math.max(300, durationHours * 3600);
  const t0 = (z_bedrock * z_bedrock) / D0;
  const t_star = Math.max(0.01, t_sec / t0);

  // Downward infiltration flux Iz (m/s) normalized by vertical hydraulic conductivity Kz
  const Iz_m_s = Math.min(Ks, (rainMmHr / 1000) / 3600);
  const fluxRatio = Math.min(1.8, Iz_m_s / Ks);

  // Discretize vertical soil column: 0.00m to 3.00m in 0.25m steps (13 nodes)
  const depths: number[] = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];
  const soilNodes: SoilColumnNode[] = [];

  let minFoS = 999.0;
  let criticalDepthM = 1.75;
  let maxTransientHeadKpa = 0;

  // Wetting front location from Green-Ampt
  const Z_f = greenAmpt.wettingFrontDepthZf_m;

  for (const z of depths) {
    // 1. Volumetric Moisture Profile
    const isWetted = z <= Z_f;
    let moisture = 0;
    if (isWetted) {
      // Saturated to transmission zone above wetting front
      moisture = upstream.saturatedMoistureThetaS - 0.02 * (z / Math.max(0.5, Z_f));
    } else {
      // Below wetting front: antecedent moisture
      const thetaI = upstream.residualMoistureThetaR + (upstream.saturatedMoistureThetaS - upstream.residualMoistureThetaR) * (antecedentSaturationPct / 100);
      moisture = thetaI;
    }
    moisture = Math.max(upstream.residualMoistureThetaR, Math.min(upstream.saturatedMoistureThetaS, moisture));
    const satPct = Number(((moisture / upstream.saturatedMoistureThetaS) * 100).toFixed(1));

    // 2. Transient Pore-Water Pressure head psi(z, t) via Iverson PDE
    // z* = z / z_bedrock
    const z_star = z / z_bedrock;
    const diffusionArg = z_star / (2 * Math.sqrt(t_star));
    const R_response = 2 * Math.sqrt(t_star) * ierfc(diffusionArg);

    // Dynamic transient pressure head (meters of water)
    let psi_trans_m = fluxRatio * z_bedrock * R_response;

    // Steady background groundwater head: rises only when antecedent saturation > 78% or rain >= 20 mm/hr
    let psi_0_m = 0;
    if (antecedentSaturationPct > 78 || rainMmHr >= 20) {
      const satExcess = Math.max(0, (antecedentSaturationPct - 75) / 25);
      const rainExcess = Math.max(0, (rainMmHr - 15) / 35);
      const waterTableRatio = Math.min(0.9, (satExcess * 0.6) + (rainExcess * 0.4));
      const initialWaterTableDepth = Math.max(0.4, z_bedrock * (1.0 - waterTableRatio));
      if (z > initialWaterTableDepth) {
        psi_0_m = (z - initialWaterTableDepth) * cos2Theta;
      }
    }

    let porePressureKpa = 0;
    if (antecedentSaturationPct > 78 || rainMmHr >= 20) {
      const totalHeadM = psi_0_m + psi_trans_m;
      porePressureKpa = Number((totalHeadM * GAMMA_W).toFixed(2));
      if (porePressureKpa > maxTransientHeadKpa) maxTransientHeadKpa = porePressureKpa;
    } else {
      // Matric suction head (negative pore pressure) in calm unsaturated laterite
      const suctionRatio = (upstream.saturatedMoistureThetaS - moisture) / Math.max(0.05, upstream.saturatedMoistureThetaS - upstream.residualMoistureThetaR);
      const suctionHeadM = -upstream.capillarySuctionPsif * Math.pow(Math.max(0, suctionRatio), 1.6);
      porePressureKpa = Number((suctionHeadM * GAMMA_W).toFixed(2));
    }

    // 3. Stresses & Infinite Slope Factor of Safety FoS(z)
    const gamma_bulk = GAMMA_DRY + moisture * GAMMA_W;
    const totalNormalStress = gamma_bulk * Math.max(0.1, z) * cos2Theta;
    // Effective normal stress: positive pore water pressure reduces effective stress
    const chi = Math.min(1.0, Math.max(0.0, satPct / 100));
    const effectiveNormalStress = Math.max(0.1, totalNormalStress - (chi * Math.max(0, porePressureKpa)));

    const shearStrength = c_prime + effectiveNormalStress * Math.tan(phiRad);
    const drivingShearStress = Math.max(0.5, gamma_bulk * Math.max(0.1, z) * sinTheta * cosTheta);

    const fosRaw = z === 0 ? 3.5 : shearStrength / drivingShearStress;
    const fos = Number(Math.max(0.3, Math.min(4.0, fosRaw)).toFixed(2));

    // Slip planes occur within the soil mantle above or at the bedrock plane
    if (z > 0 && z <= z_bedrock + 0.1 && fos < minFoS) {
      minFoS = fos;
      criticalDepthM = z;
    }

    soilNodes.push({
      depthM: z,
      volumetricMoisture: Number(moisture.toFixed(3)),
      saturationPct: satPct,
      porePressureKpa,
      effectiveNormalStressKpa: Number(effectiveNormalStress.toFixed(1)),
      shearStrengthKpa: Number(shearStrength.toFixed(1)),
      drivingShearStressKpa: Number(drivingShearStress.toFixed(1)),
      fos,
      isWettingFront: Math.abs(z - Z_f) < 0.25,
      isCriticalSlipPlane: false
    });
  }

  // Tag critical slip node
  for (const node of soilNodes) {
    if (Math.abs(node.depthM - criticalDepthM) < 0.01) {
      node.isCriticalSlipPlane = true;
    }
  }

  let stabilityStatus: 'STABLE' | 'MARGINAL_CREEP' | 'CRITICAL_SHEAR_FAILURE' = 'STABLE';
  if (minFoS < 1.0) {
    stabilityStatus = 'CRITICAL_SHEAR_FAILURE';
  } else if (minFoS < 1.15) {
    stabilityStatus = 'MARGINAL_CREEP';
  }

  return {
    soilNodes,
    criticalFailureDepthM: criticalDepthM,
    minFoS,
    hydraulicDiffusivityD0: Number(D0.toFixed(4)),
    transientPorePressureSurgeKpa: Number(maxTransientHeadKpa.toFixed(1)),
    shearStressRatio: Number((1.0 / Math.max(0.1, minFoS)).toFixed(2)),
    stabilityStatus
  };
}
