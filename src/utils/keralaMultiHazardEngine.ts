import type {
  SixVectorHazardState,
  Vector1CloudburstState,
  Vector2UrulpottalState,
  Vector3LDOFState,
  Vector4ReservoirState,
  Vector5FluvialSurgeState,
  Vector6CoastalTidalState,
  ReservoirRuleState,
  CascadingFaultNode,
  CascadingFaultEdge,
  KeralaDistrict,
  HazardTier,
  FieldNodeTelemetry,
  CorridorTelemetryState,
  HydrologicalCorridor
} from '../types/hydrology';
import { KERALA_CORRIDORS } from '../data/keralaCorridors';

/**
 * 5 Strategic Kerala Reservoirs Baseline Data
 */
const KERALA_RESERVOIRS_CONFIG: Omit<ReservoirRuleState, 'currentLevelM' | 'storageMcm' | 'storagePercent' | 'inflowM3s' | 'currentReleaseM3s' | 'recommendedReleaseM3s' | 'hoursToFRL' | 'ruleCurveStatus'>[] = [
  {
    damId: 'idukki_cheruthoni',
    name: 'Idukki (Cheruthoni)',
    riverBasin: 'Periyar',
    district: 'Idukki',
    fullReservoirLevelM: 732.43, // 2403 ft
    sillElevationM: 720.0,
    capacityMcm: 1996.0,
  },
  {
    damId: 'mullaperiyar',
    name: 'Mullaperiyar Dam',
    riverBasin: 'Periyar / Mullayar',
    district: 'Idukki',
    fullReservoirLevelM: 43.28, // 142 ft
    sillElevationM: 38.5,
    capacityMcm: 443.0,
  },
  {
    damId: 'idamalayar',
    name: 'Idamalayar Dam',
    riverBasin: 'Periyar (Idamalayar Tributary)',
    district: 'Ernakulam',
    fullReservoirLevelM: 169.0,
    sillElevationM: 150.0,
    capacityMcm: 1090.0,
  },
  {
    damId: 'kakki_sabarigiri',
    name: 'Kakki Dam (Sabarigiri)',
    riverBasin: 'Pamba',
    district: 'Pathanamthitta',
    fullReservoirLevelM: 981.45,
    sillElevationM: 960.0,
    capacityMcm: 454.0,
  },
  {
    damId: 'banasura_sagar',
    name: 'Banasura Sagar Dam',
    riverBasin: 'Kabini / Chaliyar Tributary',
    district: 'Wayanad',
    fullReservoirLevelM: 775.6,
    sillElevationM: 760.0,
    capacityMcm: 209.0,
  }
];

class KeralaMultiHazardEngine {
  private lastMarineData: {
    waveHeight: number;
    wavePeriod: number;
    tideLevel: number;
    lastUpdated: number;
  } = {
    waveHeight: 1.65,
    wavePeriod: 11.2,
    tideLevel: 0.85,
    lastUpdated: Date.now()
  };

  constructor() {
    this.pollMarineApi();
  }

  /**
   * Periodically poll Open-Meteo Marine API for live Arabian Sea swell & tides
   */
  private async pollMarineApi() {
    try {
      const url = 'https://marine-api.open-meteo.com/v1/marine?latitude=9.9312&longitude=76.2673&current=wave_height,wave_direction,wave_period';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.current) {
          const waveH = json.current.wave_height ?? 1.8;
          const waveP = json.current.wave_period ?? 10.5;

          // Semidiurnal astronomical tide model for Cochin Port (12.42h period)
          const nowHrs = Date.now() / (1000 * 3600);
          const tide = 0.55 + 0.65 * Math.sin((2 * Math.PI * nowHrs) / 12.42);

          this.lastMarineData = {
            waveHeight: waveH,
            wavePeriod: waveP,
            tideLevel: parseFloat(tide.toFixed(2)),
            lastUpdated: Date.now()
          };
        }
      }
    } catch {
      // Retain robust fallback
    }
  }

  /**
   * Main Evaluation Function: Computes the complete 6-Vector Total Kerala Multi-Hazard Matrix
   */
  public evaluateMultiHazard(
    activeCorridorState: CorridorTelemetryState | undefined,
    allCorridorStates: Record<string, CorridorTelemetryState>,
    fieldNodeTelemetry: FieldNodeTelemetry | null,
    selectedCorridorParam?: HydrologicalCorridor
  ): SixVectorHazardState {
    const corridor = selectedCorridorParam ||
      KERALA_CORRIDORS.find(c => c.id === activeCorridorState?.corridorId) ||
      KERALA_CORRIDORS[0];

    const upstream = activeCorridorState?.upstream;
    const downstream = activeCorridorState?.downstream;
    const physics = activeCorridorState?.physics;

    // Current simulation / environmental scalars
    const rainfallMmHr = upstream?.precipitationCurrentMm ?? 22.5;
    const surfacePressure = upstream?.surfacePressureHpa ?? 1008.2;
    const riverDischarge = downstream?.dischargeM3s ?? 1250;
    const baseFoS = physics?.factorOfSafety ?? 1.35;
    const soilSaturation = upstream?.soilSaturationPct ?? 72.0;

    // -----------------------------------------------------------------------
    // VECTOR 1: MINI-CLOUDBURST & OROGRAPHIC FLASH PRECURSOR
    // -----------------------------------------------------------------------
    // Pressure tendency: if heavy rain is active, simulate sharp mesoscale dP/dt
    let dPdt = -0.4; // hPa/hr baseline
    if (rainfallMmHr > 60) {
      dPdt = -2.8;
    } else if (rainfallMmHr > 35) {
      dPdt = -1.9;
    } else if (rainfallMmHr > 15) {
      dPdt = -1.1;
    }

    const moistureConvergence = Math.min(100, Math.round(52 + (rainfallMmHr * 0.65) + (upstream?.windSpeedKmh ? upstream.windSpeedKmh * 0.4 : 5)));
    const convectiveUpdraftFlag = dPdt <= -1.8 && moistureConvergence >= 70;

    let v1Status: Vector1CloudburstState['status'] = 'NORMAL';
    let v1LeadTime = 4.0;
    let v1Summary = 'Atmospheric barometric pressure stable across Western Ghats ridges.';

    if (rainfallMmHr >= 50) {
      v1Status = 'BURST_ACTIVE';
      v1LeadTime = 0.0;
      v1Summary = `CONVECTIVE MINI-CLOUDBURST IN PROGRESS: ${rainfallMmHr.toFixed(1)} mm/hr extreme rainfall dumping over high-altitude ridge!`;
    } else if (convectiveUpdraftFlag || dPdt <= -2.0) {
      v1Status = 'CRITICAL_PRECURSOR';
      v1LeadTime = 2.2;
      v1Summary = `CRITICAL MINI-CLOUDBURST PRECURSOR: Barometric pressure plummeting at ${dPdt.toFixed(1)} hPa/hr with severe moisture convergence (${moistureConvergence}%). High-intensity storm cell forming in T-2.2h!`;
    } else if (dPdt <= -1.0 || moistureConvergence > 75) {
      v1Status = 'ELEVATED';
      v1LeadTime = 3.2;
      v1Summary = `Elevated orographic updraft detected. Pressure gradient tightening (${dPdt.toFixed(1)} hPa/hr).`;
    }

    const vector1Cloudburst: Vector1CloudburstState = {
      pressureTendencyHpaHr: dPdt,
      surfacePressureHpa: surfacePressure,
      moistureConvergenceIndex: moistureConvergence,
      precipitationRateMmHr: rainfallMmHr,
      leadTimeHours: v1LeadTime,
      status: v1Status,
      convectiveUpdraftFlag,
      summary: v1Summary
    };

    // -----------------------------------------------------------------------
    // VECTOR 2: DEEP URULPOTTAL (DEBRIS FLOW) & SEISMIC TREMOR PRECURSOR
    // -----------------------------------------------------------------------
    const livePga = fieldNodeTelemetry ? fieldNodeTelemetry.pga : 0.012;
    const slopeCreep = fieldNodeTelemetry ? Math.abs(fieldNodeTelemetry.creepVelocity) : 0.02;
    const tremorRms = fieldNodeTelemetry ? fieldNodeTelemetry.seismicRms : 0.08;
    const fieldDeltaPitch = fieldNodeTelemetry ? Math.abs(fieldNodeTelemetry.pitchDelta) : 0.0;

    // Tilting the phone by > 6° or shaking it (PGA > 0.05g) drives FoS below 1.05
    const tiltPenalty = fieldNodeTelemetry && Math.abs(fieldNodeTelemetry.pitchDelta) > 3.0
      ? (Math.abs(fieldNodeTelemetry.pitchDelta) - 3.0) * 0.16
      : 0;
    const seismicPenalty = fieldNodeTelemetry && livePga > 0.03
      ? (livePga - 0.03) * 14.0
      : 0;
    const dynamicFoS = Math.max(0.35, Number((baseFoS - tiltPenalty - seismicPenalty).toFixed(2)));

    const acousticRumbling = (livePga > 0.05 || tremorRms > 0.45 || slopeCreep > 0.25) && soilSaturation > 80;

    let v2Status: Vector2UrulpottalState['status'] = 'STABLE_EQUILIBRIUM';
    let v2Summary = `${corridor.upstreamNode.name} geotechnical shear stress in stable equilibrium (FoS: ${dynamicFoS.toFixed(2)}).`;

    if (dynamicFoS < 1.05) {
      v2Status = 'FAILURE_OCCURRED';
      v2Summary = `CRITICAL URULPOTTAL (DEBRIS FLOW) INITIATED: ${corridor.upstreamNode.name} FoS = ${dynamicFoS.toFixed(2)} < 1.05! Catastrophic shear failure at z = 1.75m. Rapid mass wasting descending into gorge!`;
    } else if (dynamicFoS < 1.15 || acousticRumbling || (rainfallMmHr >= 20 && dynamicFoS < 1.25)) {
      v2Status = 'IMMINENT_DETACHMENT';
      v2Summary = `WATCH (MARGINAL) DETACHMENT ALERT for ${corridor.upstreamNode.name}: Subsurface shear strain detected. FoS: ${dynamicFoS.toFixed(2)}.`;
    } else {
      v2Status = 'STABLE_EQUILIBRIUM';
      v2Summary = `${corridor.upstreamNode.name} slope stability nominal in stable equilibrium with Infinite Slope FoS = ${dynamicFoS.toFixed(2)}.`;
    }

    const vector2Urulpottal: Vector2UrulpottalState = {
      depthFailureM: physics?.iversonPDE?.criticalFailureDepthM ?? 1.75,
      staticFoS: baseFoS,
      dynamicFoS,
      livePgaG: livePga,
      slopeCreepDegHr: slopeCreep,
      seismicTremorRms: tremorRms,
      status: v2Status,
      acousticRumblingDetected: acousticRumbling,
      summary: v2Summary
    };

    // -----------------------------------------------------------------------
    // VECTOR 3: LANDSLIDE DAM OUTBURST FLOOD (LDOF) PREDICTOR
    // -----------------------------------------------------------------------
    const gorgeName = corridor.id === 'chaliyar'
      ? 'Mundakkai-Chooralmala Gorge'
      : corridor.id === 'meenachil'
      ? 'Vagamon-Erattupetta Mountain Chasm'
      : corridor.id === 'periyar'
      ? 'Idukki-Cheruthoni Gorge Bottleneck'
      : corridor.id === 'chalakudy'
      ? 'Athirappilly-Vettilappara Gorge'
      : 'Sabarimala Forest Gorge Bottleneck';

    const channelWidthM = corridor.id === 'meenachil' ? 28.0 : corridor.id === 'chaliyar' ? 34.0 : 42.0;
    let blockageProb = 0.0;
    let debrisDamHeight = 0.0;
    let impoundmentVolume = 0;
    let froehlichPeak = 0.0;
    let downstreamEta = 0;

    let v3Status: Vector3LDOFState['status'] = 'NORMAL';
    let v3Summary = `${gorgeName} gorge channel clear and unobstructed at 0% blockage probability (0.0 m³/s breach flux).`;

    if (dynamicFoS < 1.05) {
      blockageProb = 95.0;
      debrisDamHeight = 18.5;
      impoundmentVolume = Math.round(250000 + (rainfallMmHr * 2500));
      froehlichPeak = parseFloat((0.607 * Math.pow(impoundmentVolume, 0.295) * Math.pow(debrisDamHeight, 1.24)).toFixed(1));
      downstreamEta = Math.round(physics?.floodCrestEtaMinutes ? physics.floodCrestEtaMinutes * 0.4 : 24);
      v3Status = 'CATASTROPHIC_BREACH_ALERT';
      v3Summary = `LDOF BREACH ALERT for ${corridor.name}: 18.5m debris dam in ${gorgeName} impounding ${impoundmentVolume.toLocaleString()} m³ has initiated overtopping breach! Froehlich peak outburst: ${froehlichPeak} m³/s hitting ${corridor.downstreamNode.name} in T+${downstreamEta}m!`;
    } else if (dynamicFoS < 1.15 || (rainfallMmHr >= 20 && dynamicFoS < 1.25)) {
      blockageProb = Math.min(75, Math.round((1.25 - dynamicFoS) * 350));
      debrisDamHeight = 6.0;
      impoundmentVolume = 25000;
      froehlichPeak = parseFloat((0.607 * Math.pow(impoundmentVolume, 0.295) * Math.pow(debrisDamHeight, 1.24)).toFixed(1));
      downstreamEta = 65;
      v3Status = 'IMPOUNDMENT_FORMING';
      v3Summary = `Gorge choking underway at ${gorgeName} (W=${channelWidthM}m). Impoundment volume climbing.`;
    } else {
      blockageProb = 0.0;
      debrisDamHeight = 0.0;
      impoundmentVolume = 0;
      froehlichPeak = 0.0;
      downstreamEta = 0;
      v3Status = 'NORMAL';
      v3Summary = `${gorgeName} gorge channel free-flowing at 0% blockage probability (0.0 m³/s breach flux); no landslide detachment present.`;
    }

    const vector3LDOF: Vector3LDOFState = {
      gorgeName,
      channelWidthM,
      blockageProbabilityPct: blockageProb,
      impoundmentVolumeM3: impoundmentVolume,
      debrisDamHeightM: debrisDamHeight,
      froehlichPeakDischargeM3s: froehlichPeak,
      downstreamImpactEtaMin: downstreamEta,
      status: v3Status,
      summary: v3Summary
    };

    // -----------------------------------------------------------------------
    // VECTOR 4: RESERVOIR RULE-CURVE & MODIFIED PULS DAM ROUTING
    // -----------------------------------------------------------------------
    // Calculate live dynamic levels for Kerala's 5 major reservoirs
    const reservoirs: ReservoirRuleState[] = KERALA_RESERVOIRS_CONFIG.map((cfg) => {
      // Inflow driven by rainfall & catchment
      const catchmentScale = cfg.capacityMcm / 1500;
      const inflow = Math.round(180 + rainfallMmHr * 18 * catchmentScale);

      // Current level simulated based on rainfall stress
      const fillRatio = Math.min(0.99, 0.76 + (rainfallMmHr > 40 ? 0.21 : rainfallMmHr * 0.003));
      const storageMcm = parseFloat((cfg.capacityMcm * fillRatio).toFixed(1));
      const currentLevel = parseFloat((cfg.sillElevationM + (cfg.fullReservoirLevelM - cfg.sillElevationM) * fillRatio).toFixed(2));
      const storagePct = Math.round(fillRatio * 100);

      // Outflow & pre-release optimization
      const currentRelease = rainfallMmHr > 50 ? Math.round(inflow * 0.85) : Math.round(inflow * 0.4);
      const recommendedRelease = Math.round(inflow * 0.95);

      // Hours until FRL
      const remainingStorageM3 = (cfg.capacityMcm - storageMcm) * 1e6;
      const netFillRate = Math.max(10, inflow - currentRelease);
      const hoursToFRL = parseFloat((remainingStorageM3 / (netFillRate * 3600)).toFixed(1));

      let ruleStatus: ReservoirRuleState['ruleCurveStatus'] = 'NORMAL';
      if (storagePct >= 95 || hoursToFRL < 3.0) {
        ruleStatus = 'RED_ALERT';
      } else if (storagePct >= 88 || hoursToFRL < 6.0) {
        ruleStatus = 'ORANGE_ALERT';
      } else if (storagePct >= 80) {
        ruleStatus = 'BLUE_ALERT';
      }

      return {
        ...cfg,
        currentLevelM: currentLevel,
        storageMcm,
        storagePercent: storagePct,
        inflowM3s: inflow,
        currentReleaseM3s: currentRelease,
        recommendedReleaseM3s: recommendedRelease,
        hoursToFRL,
        ruleCurveStatus: ruleStatus
      };
    });

    const minHoursToRed = Math.min(...reservoirs.map(r => r.hoursToFRL));
    const hasRedAlertDam = reservoirs.some(r => r.ruleCurveStatus === 'RED_ALERT');

    let v4Status: Vector4ReservoirState['overallSpillwayStatus'] = 'OPTIMAL';
    let v4Summary = 'Kerala 5 major reservoir storage buffers within upper rule curves. Normal generation release.';

    if (hasRedAlertDam) {
      v4Status = 'EMERGENCY_SPILLWAY_ACTIVE';
      v4Summary = `EMERGENCY SPILLWAY RELEASE ACTIVE: Critical buffer breach approaching in ${minHoursToRed.toFixed(1)}h. Modified Puls routing recommends pre-releasing shutters to preserve flood cushion.`;
    } else if (reservoirs.some(r => r.ruleCurveStatus === 'ORANGE_ALERT')) {
      v4Status = 'ELEVATED_RELEASE';
      v4Summary = `Elevated spillway discharge underway. Buffer cushion narrowing (${minHoursToRed.toFixed(1)}h to FRL).`;
    }

    const vector4Reservoir: Vector4ReservoirState = {
      reservoirs,
      overallSpillwayStatus: v4Status,
      hoursToRedAlertMin: minHoursToRed,
      summary: v4Summary
    };

    // -----------------------------------------------------------------------
    // VECTOR 5: 20-REACH FLUVIAL SURGE ROUTING
    // -----------------------------------------------------------------------
    const peakDischarge = physics?.muskingumCunge?.peakDischargeM3s ?? riverDischarge;
    const totalHeadwaterSurge = peakDischarge;
    const dangerDischarge = corridor.downstreamNode.dangerDischarge;
    const waveCelerity = parseFloat((
      physics?.muskingumCunge?.reaches?.[0]?.waveCelerityMs
        ? physics.muskingumCunge.reaches.reduce((acc, r) => acc + r.waveCelerityMs, 0) / physics.muskingumCunge.reaches.length
        : Math.min(7.5, Math.max(1.2, 1.15 * Math.pow(Math.max(0.2, riverDischarge / dangerDischarge), 0.38) * (1.0 + (soilSaturation / 100.0) * 0.45) * (5.0 / 3.0)))
    ).toFixed(2));
    const crestTravelTimeHours = Number(((physics?.floodCrestEtaMinutes ?? 180) / 60).toFixed(1));

    let v5Status: Vector5FluvialSurgeState['status'] = 'FLOW_STEADY';
    let v5Summary = `${corridor.name} flowing within natural banks. Wave celerity: ${waveCelerity} m/s.`;

    if (peakDischarge >= dangerDischarge * 1.15) {
      v5Status = 'EXTREME_FLIGHT_WARNING';
      v5Summary = `EXTREME FLUVIAL SURGE in ${corridor.name}: Crest discharge ${peakDischarge.toLocaleString()} m³/s traveling at ${waveCelerity} m/s! Catastrophic overbank flooding across ${corridor.downstreamNode.name} in T+${crestTravelTimeHours}h!`;
    } else if (peakDischarge >= dangerDischarge * 0.85) {
      v5Status = 'OVERBANK_DISCHARGE';
      v5Summary = `Overbank flood stage reached along lower reaches of ${corridor.name}. Crest ETA: T+${crestTravelTimeHours}h.`;
    } else if (peakDischarge >= dangerDischarge * 0.6) {
      v5Status = 'CREST_PROPAGATING';
      v5Summary = `Muskingum-Cunge diffusion wave crest actively propagating through reaches 1–20 of ${corridor.name}.`;
    }

    const gaugeStationsByCorridor: Record<string, { town: string; offsetFraction: number }[]> = {
      meenachil: [
        { town: 'Pala Town Riverbank', offsetFraction: 1.0 },
        { town: 'Erattupetta Confluence', offsetFraction: 0.5 },
        { town: 'Ettumanoor / Kumarakom', offsetFraction: 1.2 }
      ],
      periyar: [
        { town: 'Aluva Manappuram', offsetFraction: 1.0 },
        { town: 'Kalady Bridge', offsetFraction: 0.65 },
        { town: 'Kochi Airport Floodplain', offsetFraction: 1.1 }
      ],
      chaliyar: [
        { town: 'Nilambur Chaliyar Bridge', offsetFraction: 0.7 },
        { town: 'Feroke Estuary', offsetFraction: 1.0 },
        { town: 'Mundakkai Valley Crossing', offsetFraction: 0.3 }
      ],
      pamba: [
        { town: 'Chengannur Enathu Bridge', offsetFraction: 1.0 },
        { town: 'Ranni Town Riverfront', offsetFraction: 0.6 },
        { town: 'Upper Kuttanad Polders', offsetFraction: 1.3 }
      ],
      chalakudy: [
        { town: 'Chalakudy Town Market', offsetFraction: 1.0 },
        { town: 'Athirappilly Waterfall Gorge', offsetFraction: 0.4 },
        { town: 'Puthenvelikkara Confluence', offsetFraction: 1.2 }
      ]
    };

    const corridorGauges = gaugeStationsByCorridor[corridor.id] || gaugeStationsByCorridor.periyar;
    const keyGaugeStages = corridorGauges.map(g => ({
      town: g.town,
      stageM: parseFloat((corridor.downstreamNode.baseStageM + (corridor.downstreamNode.dangerStageM - corridor.downstreamNode.baseStageM) * (peakDischarge / dangerDischarge) * g.offsetFraction).toFixed(2)),
      dangerM: corridor.downstreamNode.dangerStageM,
      etaHours: parseFloat((crestTravelTimeHours * g.offsetFraction).toFixed(1))
    }));

    const vector5FluvialSurge: Vector5FluvialSurgeState = {
      reachesCount: 20,
      peakSurgeDischargeM3s: Math.round(peakDischarge),
      waveCelerityMs: waveCelerity,
      crestTravelTimeHours,
      keyGaugeStages,
      status: v5Status,
      summary: v5Summary
    };

    // -----------------------------------------------------------------------
    // VECTOR 6: COASTAL TIDAL LOCKING & ESTUARINE BACKWATER SURGE
    // -----------------------------------------------------------------------
    const tideH = this.lastMarineData.tideLevel;
    const waveH = this.lastMarineData.waveHeight;
    const waveP = this.lastMarineData.wavePeriod;

    // Tidal Drainage Blockage Index (TDBI 0 - 100%):
    // Occurs when high Arabian Sea astronomical tide + storm swell wave setup
    // blocks the gravity discharge of fluvial floodwaters at Cochin Barmouth & Thottappally Spillway
    const seaLevelRiseM = tideH + 0.35 * waveH;
    const blockageIndex = Math.min(100, Math.round(
      Math.max(10, ((seaLevelRiseM / 2.2) * 60) + ((totalHeadwaterSurge / 3500) * 40))
    ));

    // Stagnation backwater depth in below-sea-level Kuttanad polders (-0.5m to -2.0m MSL) and Kochi lowlands
    const backwaterDepth = parseFloat(Math.max(0.1, (seaLevelRiseM - 0.4) * (blockageIndex / 100)).toFixed(2));

    let v6Status: Vector6CoastalTidalState['status'] = 'FREE_DRAINAGE';
    let v6Summary = 'Tidal egress clear through Cochin Barmouth & Thottappally spillway. Minimal backwater ponding.';

    if (blockageIndex >= 75) {
      v6Status = 'CATASTROPHIC_BACKWATER';
      v6Summary = `CATASTROPHIC TIDAL LOCKING ACTIVE: Arabian Sea high spring tide (+${tideH}m) + ${waveH}m swell completely barricading river discharge! Backwater stagnation depth: +${backwaterDepth}m across Kuttanad & Kochi low-lying polders!`;
    } else if (blockageIndex >= 50) {
      v6Status = 'SEVERE_TIDAL_LOCKING';
      v6Summary = `Severe tidal resistance: Estuarine gravity drainage choked (${blockageIndex}% blocked). Lowland water logging escalating.`;
    } else if (blockageIndex >= 30) {
      v6Status = 'PARTIAL_BLOCKAGE';
      v6Summary = `Partial tidal impedance during coastal high tide phase. Drainage slowed in Vembanad Lake.`;
    }

    const vector6CoastalTidal: Vector6CoastalTidalState = {
      tideLevelM: tideH,
      marineWaveHeightM: waveH,
      marineWavePeriodS: waveP,
      incomingRiverDischargeM3s: Math.round(totalHeadwaterSurge),
      tidalDrainageBlockageIndexPct: blockageIndex,
      backwaterStagnationDepthM: backwaterDepth,
      affectedZones: ['Kuttanad Below-Sea-Level Polders', 'Kochi Estuary / Marine Drive', 'Chellanam Coastal Belt', 'Vypin Lowlands'],
      status: v6Status,
      summary: v6Summary
    };

    // -----------------------------------------------------------------------
    // CASCADING FAULT TREE & DAG NODES / EDGES
    // -----------------------------------------------------------------------
    const faultNodes: CascadingFaultNode[] = [
      {
        id: 'node_cloudburst',
        label: 'V1: Orographic Cloudburst',
        vectorIndex: 1,
        active: v1Status === 'CRITICAL_PRECURSOR' || v1Status === 'BURST_ACTIVE',
        probability: v1Status === 'BURST_ACTIVE' ? 1.0 : v1Status === 'CRITICAL_PRECURSOR' ? 0.88 : 0.05,
        leadTime: v1Status === 'BURST_ACTIVE' ? 'NOW' : v1Status === 'CRITICAL_PRECURSOR' ? 'T-2.2h' : 'NOMINAL',
        severity: v1Status === 'BURST_ACTIVE' ? 'CRITICAL' : v1Status === 'CRITICAL_PRECURSOR' ? 'HIGH' : 'LOW',
        statusText: v1Status
      },
      {
        id: 'node_urulpottal',
        label: 'V2: Deep Urulpottal (Debris Flow)',
        vectorIndex: 2,
        active: v2Status === 'IMMINENT_DETACHMENT' || v2Status === 'FAILURE_OCCURRED',
        probability: v2Status === 'FAILURE_OCCURRED' ? 1.0 : v2Status === 'IMMINENT_DETACHMENT' ? 0.92 : 0.04,
        leadTime: v2Status === 'FAILURE_OCCURRED' ? 'ACTIVE' : v2Status === 'IMMINENT_DETACHMENT' ? 'T-15min' : 'NOMINAL',
        severity: v2Status === 'FAILURE_OCCURRED' ? 'CRITICAL' : v2Status === 'IMMINENT_DETACHMENT' ? 'HIGH' : 'LOW',
        statusText: v2Status
      },
      {
        id: 'node_ldof',
        label: 'V3: Gorge Dam Breach (LDOF)',
        vectorIndex: 3,
        active: v3Status === 'CATASTROPHIC_BREACH_ALERT' || v3Status === 'IMPOUNDMENT_FORMING',
        probability: v3Status === 'CATASTROPHIC_BREACH_ALERT' ? 0.95 : v3Status === 'IMPOUNDMENT_FORMING' ? 0.70 : 0.0,
        leadTime: v3Status === 'CATASTROPHIC_BREACH_ALERT' ? `T+${downstreamEta}m` : 'NONE',
        severity: v3Status === 'CATASTROPHIC_BREACH_ALERT' ? 'CRITICAL' : v3Status === 'IMPOUNDMENT_FORMING' ? 'MEDIUM' : 'LOW',
        statusText: v3Status
      },
      {
        id: 'node_dam_spill',
        label: 'V4: Reservoir Rule Spillway',
        vectorIndex: 4,
        active: v4Status === 'EMERGENCY_SPILLWAY_ACTIVE',
        probability: hasRedAlertDam ? 0.90 : 0.08,
        leadTime: hasRedAlertDam ? `T+${minHoursToRed.toFixed(1)}h` : 'SAFE CUSHION',
        severity: hasRedAlertDam ? 'HIGH' : 'LOW',
        statusText: v4Status
      },
      {
        id: 'node_fluvial_surge',
        label: 'V5: 20-Reach Fluvial Surge',
        vectorIndex: 5,
        active: v5Status === 'EXTREME_FLIGHT_WARNING' || v5Status === 'OVERBANK_DISCHARGE',
        probability: totalHeadwaterSurge > dangerDischarge * 0.9 ? 0.94 : 0.10,
        leadTime: `T+${crestTravelTimeHours}h`,
        severity: totalHeadwaterSurge > dangerDischarge ? 'CRITICAL' : totalHeadwaterSurge > dangerDischarge * 0.7 ? 'HIGH' : 'LOW',
        statusText: v5Status
      },
      {
        id: 'node_tidal_lock',
        label: 'V6: Estuarine Tidal Lock',
        vectorIndex: 6,
        active: v6Status === 'CATASTROPHIC_BACKWATER' || v6Status === 'SEVERE_TIDAL_LOCKING',
        probability: blockageIndex >= 65 ? 0.88 : 0.12,
        leadTime: 'HIGH TIDE PHASE',
        severity: blockageIndex >= 70 ? 'CRITICAL' : blockageIndex >= 45 ? 'MEDIUM' : 'LOW',
        statusText: v6Status
      }
    ];

    const faultEdges: CascadingFaultEdge[] = [
      { from: 'node_cloudburst', to: 'node_urulpottal', label: 'Infiltration Pore Surge', probability: 0.88, active: v1Status === 'BURST_ACTIVE' || v1Status === 'CRITICAL_PRECURSOR' },
      { from: 'node_urulpottal', to: 'node_ldof', label: 'Narrow Gorge Choke (W<45m)', probability: blockageProb / 100, active: dynamicFoS < 1.05 },
      { from: 'node_cloudburst', to: 'node_dam_spill', label: 'Inflow Surpassing Rule Curve', probability: 0.75, active: rainfallMmHr > 40 },
      { from: 'node_ldof', to: 'node_fluvial_surge', label: 'Outburst Peak Froehlich Wave', probability: 0.95, active: v3Status === 'CATASTROPHIC_BREACH_ALERT' },
      { from: 'node_dam_spill', to: 'node_fluvial_surge', label: 'Spillway Gate Pre-Release', probability: 0.85, active: v4Status === 'EMERGENCY_SPILLWAY_ACTIVE' },
      { from: 'node_fluvial_surge', to: 'node_tidal_lock', label: 'Drainage Barricade by Sea Surge', probability: blockageIndex / 100, active: blockageIndex > 60 }
    ];

    // Compute Overall Composite Cascading Risk Index (0 - 100)
    let cascadeScore = 15;
    if (v1Status === 'BURST_ACTIVE') cascadeScore += 25;
    else if (v1Status === 'CRITICAL_PRECURSOR') cascadeScore += 18;

    if (v2Status === 'FAILURE_OCCURRED') cascadeScore += 30;
    else if (v2Status === 'IMMINENT_DETACHMENT') cascadeScore += 20;

    if (v3Status === 'CATASTROPHIC_BREACH_ALERT') cascadeScore += 20;
    else if (v3Status === 'IMPOUNDMENT_FORMING') cascadeScore += 10;

    if (v4Status === 'EMERGENCY_SPILLWAY_ACTIVE') cascadeScore += 10;
    if (v5Status === 'EXTREME_FLIGHT_WARNING') cascadeScore += 15;
    if (v6Status === 'CATASTROPHIC_BACKWATER') cascadeScore += 12;

    const overallCascadeRiskIndex = Math.min(100, cascadeScore);

    // -----------------------------------------------------------------------
    // 14 KERALA DISTRICTS MULTI-HAZARD RISK ASSIGNMENT
    // -----------------------------------------------------------------------
    const calcDistrictTier = (risk: number, isCriticalTrigger: boolean): HazardTier => {
      if (isCriticalTrigger || risk >= 75) return 'CRITICAL';
      if (risk >= 55) return 'WARNING';
      if (risk >= 35) return 'ADVISORY';
      return 'NORMAL';
    };

    const districtHazards: Record<string, { overallRisk: number; primaryHazard: string; hazardLevel: HazardTier }> = {
      'Wayanad': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 1.15)),
        primaryHazard: 'Urulpottal Debris Flow & Gorge Damming',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 1.15), dynamicFoS < 1.05)
      },
      'Idukki': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 1.10)),
        primaryHazard: 'Steep Slope Slip & Spillway Overtopping',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 1.10), dynamicFoS < 1.05 || hasRedAlertDam)
      },
      'Pathanamthitta': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.95)),
        primaryHazard: 'Pamba Fluvial Surge & Sabarimala Gorge Choke',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.95), totalHeadwaterSurge > dangerDischarge)
      },
      'Ernakulam': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.90)),
        primaryHazard: 'Aluva Floodplain Inundation & Kochi Backwater',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.90), totalHeadwaterSurge > dangerDischarge || blockageIndex > 75)
      },
      'Alappuzha': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.92)),
        primaryHazard: 'Kuttanad Below-Sea-Level Tidal Locking',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.92), blockageIndex > 75)
      },
      'Kottayam': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.82)),
        primaryHazard: 'Meenachil River Surge & Polder Stagnation',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.82), false)
      },
      'Thrissur': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.78)),
        primaryHazard: 'Chalakudy River Lowland Inundation',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.78), false)
      },
      'Malappuram': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.85)),
        primaryHazard: 'Chaliyar Highland Slope Failure',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.85), dynamicFoS < 1.05)
      },
      'Kozhikode': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.75)),
        primaryHazard: 'Feroke Estuary High Tide Inundation',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.75), false)
      },
      'Palakkad': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.65)),
        primaryHazard: 'Bharathapuzha Basin Runoff',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.65), false)
      },
      'Kannur': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.60)),
        primaryHazard: 'Highland Flash Floods',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.60), false)
      },
      'Kasaragod': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.55)),
        primaryHazard: 'Coastal River Egress Slowdown',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.55), false)
      },
      'Kollam': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.68)),
        primaryHazard: 'Kallada River Surge',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.68), false)
      },
      'Thiruvananthapuram': {
        overallRisk: Math.min(100, Math.round(overallCascadeRiskIndex * 0.58)),
        primaryHazard: 'Neyyar River & Lowland Waterlogging',
        hazardLevel: calcDistrictTier(Math.round(overallCascadeRiskIndex * 0.58), false)
      }
    };

    return {
      timestamp: new Date().toISOString(),
      districtHazards,
      vector1Cloudburst,
      vector2Urulpottal,
      vector3LDOF,
      vector4Reservoir,
      vector5FluvialSurge,
      vector6CoastalTidal,
      faultNodes,
      faultEdges,
      overallCascadeRiskIndex
    };
  }
}

export const keralaMultiHazardEngine = new KeralaMultiHazardEngine();
