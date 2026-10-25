export type HazardTier = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';

export interface NodeLocation {
  name: string;
  lat: number;
  lon: number;
  elevationM: number;
  slopeDeg: number;
  type: 'upstream_catchment' | 'midstream_bottleneck' | 'downstream_inundation';
  district: string;
  description: string;
}

export interface UpstreamNode extends NodeLocation {
  criticalFoSThreshold: number;
  soilType: string;
  bedrockDepthM: number;
  soilCohesionKpa: number;
  frictionAngleDeg: number;
  hydraulicConductivityKs: number; // m/s
  capillarySuctionPsif: number; // m
  saturatedMoistureThetaS: number;
  residualMoistureThetaR: number;
}

export interface MidstreamNode extends NodeLocation {
  damName?: string;
  fullReservoirLevelM?: number;
  currentLevelM?: number;
  crestSillElevationM?: number;
  totalShutters?: number;
  openShutters?: number;
  shutterWidthM?: number;
  damCapacityMcm?: number;
}

export interface DownstreamNode extends NodeLocation {
  dangerDischarge: number; // m3/s
  warningDischarge: number; // m3/s
  baseDischarge: number; // m3/s
  dangerStageM: number; // m above datum
  baseStageM: number;
  populationAtRisk: number;
  vulnerableWards: string[];
  safeEvacuationCenters: { name: string; capacity: number; lat: number; lon: number }[];
}

export interface HydrologicalCorridor {
  id: string;
  name: string;
  basin: string;
  region: string;
  riverName: string;
  lengthKm: number;
  catchmentAreaSqKm: number;
  upstreamNode: UpstreamNode;
  midstreamNode?: MidstreamNode;
  downstreamNode: DownstreamNode;
  flowPathGeoJSON: [number, number][]; // [lon, lat] points
  emergencyContacts: {
    agency: string;
    designation: string;
    phone: string;
    channel: string;
  }[];
}

export interface TelemetryUpstream {
  precipitationCurrentMm: number;
  rainHourlyMm: number[];
  soilMoisture0to7cm: number;
  soilMoisture7to28cm: number;
  soilMoisture28to100cm: number;
  weightedMoisture: number;
  soilSaturationPct: number;
  surfacePressureHpa: number;
  windSpeedKmh: number;
  damDischargeReleaseM3s: number;
}

export interface TelemetryDownstream {
  dischargeM3s: number;
  dischargeMedianM3s: number;
  dischargeMaxM3s: number;
  stageHeightM: number;
  inundationRadiusKm: number;
  dischargeCapacityRatio: number;
}

/* =========================================================================
   UPGRADE 1: GEOTECHNICAL PDE & TRANSIENT PORE PRESSURE SOLVER
   ========================================================================= */

export interface SoilColumnNode {
  depthM: number; // 0.00 to 3.00 in 0.25m increments
  volumetricMoisture: number;
  saturationPct: number;
  porePressureKpa: number; // positive = excess pore pressure, negative = matric suction head
  effectiveNormalStressKpa: number;
  shearStrengthKpa: number;
  drivingShearStressKpa: number;
  fos: number;
  isWettingFront: boolean;
  isCriticalSlipPlane: boolean;
}

export interface GreenAmptResult {
  cumulativeInfiltrationF_m: number;
  infiltrationCapacityRate_mm_hr: number;
  wettingFrontDepthZf_m: number;
  surfacePondingOccurred: boolean;
  effectiveDirectRainfallExcessMmHr: number;
}

export interface IversonPDEResult {
  soilNodes: SoilColumnNode[];
  criticalFailureDepthM: number;
  minFoS: number;
  hydraulicDiffusivityD0: number; // m2/s
  transientPorePressureSurgeKpa: number;
  shearStressRatio: number;
  stabilityStatus: 'STABLE' | 'MARGINAL_CREEP' | 'CRITICAL_SHEAR_FAILURE';
}

/* =========================================================================
   UPGRADE 2: MUSKINGUM-CUNGE 20-REACH ROUTER & DAM OPTIMIZER
   ========================================================================= */

export interface RiverReachNode {
  reachIndex: number; // 0 to 19
  distanceKm: number;
  coordinates: [number, number]; // [lon, lat]
  bedElevationM: number;
  bedSlope: number;
  flowDischargeM3s: number;
  waterDepthM: number;
  flowAreaM2: number;
  flowVelocityMs: number;
  waveCelerityMs: number;
  courantNumber: number;
  cellReynoldsD: number;
  isCrestPeak: boolean;
}

export interface MuskingumCungeWaveResult {
  reaches: RiverReachNode[];
  peakDischargeM3s: number;
  peakReachIndex: number;
  peakDistanceKm: number;
  waveFrontArrivalTimeHours: number;
  waveFrontClockTime: string;
  totalAttenuationRatio: number;
}

export interface DamRuleCurvePoint {
  hourOffset: number;
  timeLabel: string;
  unmitigatedDischargeM3s: number;
  optimizedDischargeM3s: number;
  downstreamStageUnmitigatedM: number;
  downstreamStageOptimizedM: number;
}

export interface DamSpillwayOptimizerResult {
  damName: string;
  currentLevelM: number;
  fullReservoirLevelM: number;
  headAboveSillM: number;
  totalGates: number;
  recommendedActiveGates: number;
  recommendedGateOpeningHeightCm: number;
  preReleaseDischargeM3s: number;
  unmitigatedPeakInundationStageM: number;
  optimizedPeakInundationStageM: number;
  crestShavedReductionM: number;
  actionRecommendation: string;
  ruleCurveSeries: DamRuleCurvePoint[];
}

/* =========================================================================
   UPGRADE 3: CRITICAL INFRASTRUCTURE & EVACUATION GRAPH
   ========================================================================= */

export interface CriticalFacility {
  id: string;
  name: string;
  type: 'hospital' | 'school' | 'bridge' | 'substation' | 'telecom' | 'transit';
  coordinates: [number, number];
  elevationM: number;
  waterDepthM: number;
  status: 'SUBMERGED' | 'CRITICAL_INGRESS' | 'OPERATIONAL_HIGH_GROUND';
  populationImpact: number;
  vicinity: string;
}

export interface EvacuationGraphEdge {
  id: string;
  name: string;
  fromName: string;
  toName: string;
  coordinates: [number, number][];
  isBridgeCrossing: boolean;
  bridgeName?: string;
  isBlockedByFlood: boolean;
  clearanceSpeedKmh: number;
}

/* =========================================================================
   UPGRADE 4: BILINGUAL VOICE & CAP v1.2 XML
   ========================================================================= */

export interface BilingualBroadcastScript {
  englishScript: string;
  malayalamScript: string;
  phoneticAudioPrompt: string;
  capXmlPacket: string;
}

/* =========================================================================
   CORE STATE ENVELOPES
   ========================================================================= */

export interface HydroPhysicsCalculations {
  deepSaturationPct: number;
  poreWaterPressureKpa: number;
  factorOfSafety: number; // FoS
  isLandslideRisk: boolean;
  scsCurveNumber: number;
  scsRetentionS: number; // mm
  scsDirectRunoffQ: number; // mm
  timeOfConcentrationHours: number; // Tc
  floodCrestEtaMinutes: number; // in minutes
  floodCrestClockTime: string; // e.g. "15:20 IST"
  dynamicRiskIndex: number; // 0 - 100
  hazardTier: HazardTier;

  // Upgraded PDE models
  greenAmpt: GreenAmptResult;
  iversonPDE: IversonPDEResult;
  muskingumCunge: MuskingumCungeWaveResult;
  damOptimizer?: DamSpillwayOptimizerResult;
}

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
  precipitationMm: number;
  soilSaturationPct: number;
  porePressureKpa: number;
  factorOfSafety: number;
  dischargeM3s: number;
  dangerLevelM3s: number;
}

export interface CorridorTelemetryState {
  corridorId: string;
  timestamp: string;
  isSimulated: boolean;
  activeScenario?: string;
  upstream: TelemetryUpstream;
  downstream: TelemetryDownstream;
  physics: HydroPhysicsCalculations;
  hourlySeries: HourlyForecastPoint[];
  facilities: CriticalFacility[];
  evacuationRoutes: EvacuationGraphEdge[];
  bilingualAlert: BilingualBroadcastScript;
}

export interface SimulationOverrides {
  active: boolean;
  scenarioId: string;
  scenarioName: string;
  targetCorridorId: string; // 'all' or specific corridor
  cloudburstRateMmHr: number;
  damReleaseM3s: number;
  antecedentSoilMoisturePct: number;
  slopeRainDurationHours: number;
}

export interface DispatchVoiceAlert {
  id: string;
  corridorId: string;
  corridorName: string;
  timestamp: string;
  hazardTier: HazardTier;
  dri: number;
  fos: number;
  etaString: string;
  targetTown: string;
  affectedWards: string[];
  broadcastMessage: string;
  malayalamBroadcastMessage: string;
  capXml: string;
  webhookPayload: Record<string, unknown>;
  dispatchedAt?: string;
  status: 'PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED';
}

/* =========================================================================
   6-VECTOR TOTAL KERALA MULTI-HAZARD EARLY DETECTION ENGINE TYPES
   ========================================================================= */

export type KeralaDistrict =
  | 'Wayanad'
  | 'Idukki'
  | 'Pathanamthitta'
  | 'Ernakulam'
  | 'Alappuzha'
  | 'Kottayam'
  | 'Thrissur'
  | 'Palakkad'
  | 'Malappuram'
  | 'Kozhikode'
  | 'Kannur'
  | 'Kasaragod'
  | 'Kollam'
  | 'Thiruvananthapuram';

export interface Vector1CloudburstState {
  pressureTendencyHpaHr: number; // dP/dt
  surfacePressureHpa: number;
  moistureConvergenceIndex: number; // 0 - 100
  precipitationRateMmHr: number;
  leadTimeHours: number;
  status: 'NORMAL' | 'ELEVATED' | 'CRITICAL_PRECURSOR' | 'BURST_ACTIVE';
  convectiveUpdraftFlag: boolean;
  summary: string;
}

export interface Vector2UrulpottalState {
  depthFailureM: number;
  staticFoS: number;
  dynamicFoS: number;
  livePgaG: number;
  slopeCreepDegHr: number;
  seismicTremorRms: number;
  status: 'STABLE' | 'PRE_RUPTURE_WARNING' | 'IMMINENT_DETACHMENT' | 'FAILURE_OCCURRED';
  acousticRumblingDetected: boolean;
  summary: string;
}

export interface Vector3LDOFState {
  gorgeName: string;
  channelWidthM: number;
  blockageProbabilityPct: number;
  impoundmentVolumeM3: number;
  debrisDamHeightM: number;
  froehlichPeakDischargeM3s: number;
  downstreamImpactEtaMin: number;
  status: 'NORMAL' | 'POTENTIAL_DAMMING' | 'IMPOUNDMENT_FORMING' | 'CATASTROPHIC_BREACH_ALERT';
  summary: string;
}

export interface ReservoirRuleState {
  damId: string;
  name: string;
  riverBasin: string;
  district: KeralaDistrict;
  currentLevelM: number;
  fullReservoirLevelM: number;
  sillElevationM: number;
  storageMcm: number;
  capacityMcm: number;
  storagePercent: number;
  inflowM3s: number;
  currentReleaseM3s: number;
  recommendedReleaseM3s: number;
  hoursToFRL: number;
  ruleCurveStatus: 'NORMAL' | 'BLUE_ALERT' | 'ORANGE_ALERT' | 'RED_ALERT' | 'RULE_CURVE_BREACH';
}

export interface Vector4ReservoirState {
  reservoirs: ReservoirRuleState[];
  overallSpillwayStatus: 'OPTIMAL' | 'ELEVATED_RELEASE' | 'EMERGENCY_SPILLWAY_ACTIVE';
  hoursToRedAlertMin: number;
  summary: string;
}

export interface Vector5FluvialSurgeState {
  reachesCount: number;
  peakSurgeDischargeM3s: number;
  waveCelerityMs: number;
  crestTravelTimeHours: number;
  keyGaugeStages: { town: string; stageM: number; dangerM: number; etaHours: number }[];
  status: 'FLOW_STEADY' | 'CREST_PROPAGATING' | 'OVERBANK_DISCHARGE' | 'EXTREME_FLIGHT_WARNING';
  summary: string;
}

export interface Vector6CoastalTidalState {
  tideLevelM: number;
  marineWaveHeightM: number;
  marineWavePeriodS: number;
  incomingRiverDischargeM3s: number;
  tidalDrainageBlockageIndexPct: number; // 0 - 100%
  backwaterStagnationDepthM: number;
  affectedZones: string[];
  status: 'FREE_DRAINAGE' | 'PARTIAL_BLOCKAGE' | 'SEVERE_TIDAL_LOCKING' | 'CATASTROPHIC_BACKWATER';
  summary: string;
}

export interface CascadingFaultNode {
  id: string;
  label: string;
  vectorIndex: number;
  active: boolean;
  probability: number;
  leadTime: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  statusText: string;
}

export interface CascadingFaultEdge {
  from: string;
  to: string;
  label: string;
  probability: number;
  active: boolean;
}

export interface SixVectorHazardState {
  timestamp: string;
  districtHazards: Record<string, { overallRisk: number; primaryHazard: string; hazardLevel: HazardTier }>;
  vector1Cloudburst: Vector1CloudburstState;
  vector2Urulpottal: Vector2UrulpottalState;
  vector3LDOF: Vector3LDOFState;
  vector4Reservoir: Vector4ReservoirState;
  vector5FluvialSurge: Vector5FluvialSurgeState;
  vector6CoastalTidal: Vector6CoastalTidalState;
  faultNodes: CascadingFaultNode[];
  faultEdges: CascadingFaultEdge[];
  overallCascadeRiskIndex: number; // 0 - 100
}

/* =========================================================================
   HARDWARE-IN-THE-LOOP (HIL) FIELD NODE TELEMETRY TYPES
   ========================================================================= */

export interface FieldNodeTelemetry {
  roomId: string;
  deviceId: string;
  timestamp: number;
  pitch: number;          // deg (slope angle)
  roll: number;           // deg (cross-slope)
  pitchDelta: number;     // deg from tare baseline
  rollDelta: number;      // deg from tare baseline
  creepVelocity: number;  // deg/hr
  pga: number;            // Peak Ground Acceleration (in g)
  seismicRms: number;     // Linear vibration RMS (m/s^2)
  accelX: number;         // m/s^2
  accelY: number;         // m/s^2
  accelZ: number;         // m/s^2
  poreSaturation: number; // 0-100%
  stationName: string;    // e.g. "WAYANAD-MEPPADI-FN1"
  hazardLevel: 'STABLE' | 'WARNING' | 'CRITICAL_FAILURE';
  isSimulated?: boolean;
}

