import type { HydrologicalCorridor } from '../types/hydrology';

export const KERALA_CORRIDORS: HydrologicalCorridor[] = [
  {
    id: 'periyar',
    name: 'Periyar Basin Corridor',
    basin: 'Periyar River Basin',
    region: 'Central Kerala (Idukki - Ernakulam)',
    riverName: 'Periyar River',
    lengthKm: 244,
    catchmentAreaSqKm: 5398,
    upstreamNode: {
      name: 'Idukki / Cheruthoni & Idamalayar Highlands',
      lat: 9.8497,
      lon: 76.9720,
      elevationM: 1200,
      slopeDeg: 34,
      type: 'upstream_catchment',
      district: 'Idukki',
      description: 'Massive steep Western Ghats gorge system anchored by Idukki Arch Dam and Cheruthoni spillway. Severe debris-dam risk during high-intensity cloudbursts.',
      criticalFoSThreshold: 1.15,
      soilType: 'Laterite over Precambrian Gneiss',
      bedrockDepthM: 2.2,
      soilCohesionKpa: 15.0,
      frictionAngleDeg: 31.0,
      hydraulicConductivityKs: 2.4e-5, // m/s
      capillarySuctionPsif: 0.22, // m
      saturatedMoistureThetaS: 0.46,
      residualMoistureThetaR: 0.12
    },
    midstreamNode: {
      name: 'Kalady / Malayattoor Confluence Bottleneck',
      lat: 10.1682,
      lon: 76.4385,
      elevationM: 24,
      slopeDeg: 4,
      type: 'midstream_bottleneck',
      district: 'Ernakulam',
      description: 'Critical narrowing where Idamalayar discharge joins mainline Periyar flow before reaching Aluva plain.',
      damName: 'Cheruthoni Spillway Complex',
      fullReservoirLevelM: 732.4, // Idukki FRL in meters (2403 ft)
      currentLevelM: 729.8,
      crestSillElevationM: 720.0,
      totalShutters: 5,
      openShutters: 0,
      shutterWidthM: 12.0,
      damCapacityMcm: 1996
    },
    downstreamNode: {
      name: 'Aluva / Kochi Airport Floodplain',
      lat: 10.1076,
      lon: 76.3516,
      elevationM: 8,
      slopeDeg: 0.8,
      type: 'downstream_inundation',
      district: 'Ernakulam',
      description: 'High-density urban floodplain directly adjacent to Cochin International Airport (COK). Ground zero for 2018 catastrophic inundation.',
      dangerDischarge: 2800, // m3/s
      warningDischarge: 2100, // m3/s
      baseDischarge: 420,
      dangerStageM: 4.8,
      baseStageM: 1.2,
      populationAtRisk: 340000,
      vulnerableWards: ['Aluva Municipality Ward 1-12', 'Chengamanad', 'Nedumbassery CIAL Sector', 'Paravur Lowlands', 'Eloor Industrial Belt'],
      safeEvacuationCenters: [
        { name: 'UC College Aluva Relief Complex', capacity: 3500, lat: 10.1245, lon: 76.3421 },
        { name: 'St. Xavier College Higher Ground', capacity: 2200, lat: 10.1118, lon: 76.3562 },
        { name: 'Angamaly KSRTC Multi-Tier Terminal', capacity: 4000, lat: 10.1912, lon: 76.3860 }
      ]
    },
    flowPathGeoJSON: [
      [76.9720, 9.8497],
      [76.9412, 9.8654],
      [76.8835, 9.9123],
      [76.8120, 9.9678],
      [76.7154, 10.0345], // Neriamangalam Gorge
      [76.5890, 10.1230], // Bhoothathankettu Barrage
      [76.4385, 10.1682], // Kalady / Malayattoor
      [76.3820, 10.1340], // Chowwara
      [76.3516, 10.1076], // Aluva Town
      [76.2840, 10.0512], // Varapuzha
      [76.2300, 10.0150]  // Cochin Estuary Outlet
    ],
    emergencyContacts: [
      { agency: 'Kerala State Disaster Management Authority (KSDMA)', designation: 'State Emergency Operations Centre Chief', phone: '+91-471-2364424', channel: 'VHF CH-16 / SAT-NET' },
      { agency: 'Central Water Commission (CWC)', designation: 'Senior Hydrologist, Periyar Division', phone: '+91-484-2422001', channel: 'CWC Telemetry Uplink' },
      { agency: 'Ernakulam District Collectorate', designation: 'Incident Commander Aluva Sub-Division', phone: '+91-484-2423001', channel: 'Dial 1077 Emergency' }
    ]
  },
  {
    id: 'pamba',
    name: 'Pamba & Achankovil Basin Corridor',
    basin: 'Pamba River Basin',
    region: 'South Kerala (Pathanamthitta - Alappuzha)',
    riverName: 'Pamba River',
    lengthKm: 176,
    catchmentAreaSqKm: 2235,
    upstreamNode: {
      name: 'Sabarimala / Kakki Reservoir Catchment',
      lat: 9.3364,
      lon: 77.1472,
      elevationM: 980,
      slopeDeg: 31,
      type: 'upstream_catchment',
      district: 'Pathanamthitta',
      description: 'Densely forested Periyar Tiger Reserve flanks. High antecedent saturation triggers rapid spillway overflow into Holy River Pamba.',
      criticalFoSThreshold: 1.18,
      soilType: 'Forest Loam over Khondalite/Charnockite',
      bedrockDepthM: 2.0,
      soilCohesionKpa: 16.5,
      frictionAngleDeg: 30.5,
      hydraulicConductivityKs: 2.1e-5,
      capillarySuctionPsif: 0.24,
      saturatedMoistureThetaS: 0.45,
      residualMoistureThetaR: 0.11
    },
    midstreamNode: {
      name: 'Ranni Town / Vadasserikara Bridge Junction',
      lat: 9.3812,
      lon: 76.7845,
      elevationM: 32,
      slopeDeg: 3.5,
      type: 'midstream_bottleneck',
      district: 'Pathanamthitta',
      description: 'River narrows sharply between high riverbanks. Highly susceptible to sudden nocturnal flash wave peaks.',
      damName: 'Kakki - Anathode Dam Complex',
      fullReservoirLevelM: 981.4,
      currentLevelM: 978.2,
      crestSillElevationM: 970.0,
      totalShutters: 4,
      openShutters: 0,
      shutterWidthM: 10.5,
      damCapacityMcm: 453
    },
    downstreamNode: {
      name: 'Chengannur / Lower Kuttanad Polder Delta',
      lat: 9.3183,
      lon: 76.6111,
      elevationM: 2,
      slopeDeg: 0.3,
      type: 'downstream_inundation',
      district: 'Alappuzha',
      description: 'Below sea level paddy polders and backwater lake systems. Prolonged waterlogging due to tidal lock at Thanneermukkom Bund.',
      dangerDischarge: 1900, // m3/s
      warningDischarge: 1450, // m3/s
      baseDischarge: 280,
      dangerStageM: 5.2,
      baseStageM: 1.4,
      populationAtRisk: 285000,
      vulnerableWards: ['Ranni Grama Ward 1-8', 'Chengannur Town', 'Edathua Polder Ring', 'Champakulam', 'Kainakary Below-Sea-Level Wards'],
      safeEvacuationCenters: [
        { name: 'Chengannur Christian College Hilltop Camp', capacity: 2800, lat: 9.3245, lon: 76.6190 },
        { name: 'Thiruvalla Public Stadium Mega Center', capacity: 4500, lat: 9.3840, lon: 76.5740 },
        { name: 'Edathua St. Aloysius High Ground', capacity: 2000, lat: 9.3650, lon: 76.4710 }
      ]
    },
    flowPathGeoJSON: [
      [77.1472, 9.3364],
      [77.0850, 9.3510],
      [76.9920, 9.3680],
      [76.8950, 9.3890],
      [76.7845, 9.3812], // Ranni
      [76.6850, 9.3420], // Kozhencherry
      [76.6111, 9.3183], // Chengannur
      [76.5420, 9.3450], // Thiruvalla Outskirts
      [76.4650, 9.3720], // Kuttanad Lower Delta
      [76.3800, 9.4900]  // Vembanad Lake Basin
    ],
    emergencyContacts: [
      { agency: 'Pathanamthitta District Disaster Management Authority', designation: 'District Collector & Magistrate', phone: '+91-468-2222515', channel: 'VHF Emergency Net' },
      { agency: 'Kuttanad Water Drainage Directorate', designation: 'Executive Engineer Drainage', phone: '+91-477-2251732', channel: 'Direct Hot-Line' }
    ]
  },
  {
    id: 'chaliyar',
    name: 'Chaliyar Basin Corridor',
    basin: 'Chaliyar River Basin',
    region: 'North Kerala (Wayanad - Malappuram)',
    riverName: 'Chaliyar River',
    lengthKm: 169,
    catchmentAreaSqKm: 2923,
    upstreamNode: {
      name: "Mundakkai / Meppadi / Camel's Hump Escarpment",
      lat: 11.4886,
      lon: 76.1625,
      elevationM: 1550,
      slopeDeg: 39,
      type: 'upstream_catchment',
      district: 'Wayanad',
      description: 'Extremely vulnerable high-gradient escarpment (Chooralmala-Mundakkai axis). Epicenter of massive debris flows and landslide dam breaches.',
      criticalFoSThreshold: 1.12,
      soilType: 'Colluvial Granulitic Mantle over Fault Scarp',
      bedrockDepthM: 1.8,
      soilCohesionKpa: 11.0,
      frictionAngleDeg: 28.5,
      hydraulicConductivityKs: 3.2e-5,
      capillarySuctionPsif: 0.19,
      saturatedMoistureThetaS: 0.48,
      residualMoistureThetaR: 0.10
    },
    midstreamNode: {
      name: 'Vazhikkadavu / Edakkara Ghat Foothills',
      lat: 11.3810,
      lon: 76.3210,
      elevationM: 65,
      slopeDeg: 6.2,
      type: 'midstream_bottleneck',
      district: 'Malappuram',
      description: 'Entry point where high-velocity debris floods exit the Western Ghats defile into populated riverine lowlands.',
      damName: 'Run-of-the-River Natural Surge Channel',
      fullReservoirLevelM: 0,
      currentLevelM: 0,
      crestSillElevationM: 0,
      totalShutters: 0,
      openShutters: 0,
      shutterWidthM: 0,
      damCapacityMcm: 0
    },
    downstreamNode: {
      name: 'Nilambur / Vazhikkadavu Floodplain',
      lat: 11.2794,
      lon: 76.2255,
      elevationM: 42,
      slopeDeg: 1.1,
      type: 'downstream_inundation',
      district: 'Malappuram',
      description: 'Major junction of Chaliyar and tributaries (Punnappuzha, Karimpuzha). Flash flood wave causes catastrophic bank erosion within 90 minutes.',
      dangerDischarge: 1500, // m3/s
      warningDischarge: 1100, // m3/s
      baseDischarge: 210,
      dangerStageM: 6.5,
      baseStageM: 1.8,
      populationAtRisk: 195000,
      vulnerableWards: ['Nilambur Municipality Riverfront', 'Chungathara', 'Moothedam', 'Karuvarakundu', 'Mampad'],
      safeEvacuationCenters: [
        { name: 'Nilambur Government Manavedan High School', capacity: 1800, lat: 11.2820, lon: 76.2310 },
        { name: 'Chungathara College Campus Shelter', capacity: 2400, lat: 11.3140, lon: 76.2620 },
        { name: 'Amal College Higher Elevation Complex', capacity: 2100, lat: 11.2590, lon: 76.2080 }
      ]
    },
    flowPathGeoJSON: [
      [76.1625, 11.4886], // Mundakkai / Meppadi
      [76.1950, 11.4320], // Chooralmala Riverbed
      [76.2650, 11.3980], // Munderi Reserve Forest
      [76.3210, 11.3810], // Vazhikkadavu Ghat
      [76.2890, 11.3320], // Edakkara
      [76.2255, 11.2794], // Nilambur Town
      [76.1420, 11.2380], // Areekode
      [75.9810, 11.1890], // Feroke
      [75.8300, 11.1550]  // Beypore Estuary Arabian Sea
    ],
    emergencyContacts: [
      { agency: 'Wayanad District Collector & DDMA', designation: 'Emergency Operations Command Chief', phone: '+91-4936-204151', channel: 'HAM Radio 145.500 MHz' },
      { agency: 'Malappuram District Emergency Cell', designation: 'Incident Commander Nilambur', phone: '+91-483-2736920', channel: 'State Control Room 1077' }
    ]
  },
  {
    id: 'chalakudy',
    name: 'Chalakudy River Corridor',
    basin: 'Chalakudy River Basin',
    region: 'Central Kerala (Thrissur - Ernakulam Border)',
    riverName: 'Chalakudy River',
    lengthKm: 145,
    catchmentAreaSqKm: 1704,
    upstreamNode: {
      name: 'Peringalkuthu / Sholayar Highlands',
      lat: 10.3150,
      lon: 76.6540,
      elevationM: 820,
      slopeDeg: 29,
      type: 'upstream_catchment',
      district: 'Thrissur',
      description: 'Cascading hydropower dam chain (Upper Sholayar, Lower Sholayar, Peringalkuthu). Steep forested ravines with rapid hydraulic transfer.',
      criticalFoSThreshold: 1.16,
      soilType: 'Forest Lateritic Clay over Charnockite',
      bedrockDepthM: 2.1,
      soilCohesionKpa: 14.8,
      frictionAngleDeg: 30.0,
      hydraulicConductivityKs: 2.2e-5,
      capillarySuctionPsif: 0.23,
      saturatedMoistureThetaS: 0.46,
      residualMoistureThetaR: 0.12
    },
    midstreamNode: {
      name: 'Athirappilly / Vettilappara Gorge',
      lat: 10.2980,
      lon: 76.5380,
      elevationM: 78,
      slopeDeg: 8.5,
      type: 'midstream_bottleneck',
      district: 'Thrissur',
      description: 'Famous waterfall chasm where dam release creates extreme hydraulic jump and accelerating surging headwave.',
      damName: 'Peringalkuthu Hydro Dam',
      fullReservoirLevelM: 424.0,
      currentLevelM: 421.8,
      crestSillElevationM: 415.0,
      totalShutters: 7,
      openShutters: 0,
      shutterWidthM: 9.0,
      damCapacityMcm: 32
    },
    downstreamNode: {
      name: 'Chalakudy Town / Annamanada Floodplain',
      lat: 10.3007,
      lon: 76.3372,
      elevationM: 11,
      slopeDeg: 0.9,
      type: 'downstream_inundation',
      district: 'Thrissur',
      description: 'Densely inhabited commercial hub and National Highway 544 transit corridor. Completely submerged in 2018 when Peringalkuthu overtopped.',
      dangerDischarge: 1400, // m3/s
      warningDischarge: 1050, // m3/s
      baseDischarge: 190,
      dangerStageM: 5.0,
      baseStageM: 1.1,
      populationAtRisk: 210000,
      vulnerableWards: ['Chalakudy Municipality Wards 1-18', 'Pariaram', 'Meloor', 'Annamanada', 'Kadukutty'],
      safeEvacuationCenters: [
        { name: 'Panampilly Memorial Govt College', capacity: 2500, lat: 10.3110, lon: 76.3450 },
        { name: 'Carmel Higher Secondary School Camp', capacity: 1900, lat: 10.2950, lon: 76.3280 },
        { name: 'Koratty Infopark High Grounds', capacity: 3200, lat: 10.2640, lon: 76.3580 }
      ]
    },
    flowPathGeoJSON: [
      [76.6540, 10.3150], // Sholayar / Peringalkuthu
      [76.5980, 10.3110], // Vazhachal
      [76.5380, 10.2980], // Athirappilly Gorge
      [76.4520, 10.3060], // Vettilappara / Ezhattumugham
      [76.3372, 10.3007], // Chalakudy Town
      [76.2620, 10.2450], // Annamanada / Mala
      [76.1950, 10.2010], // Puthenvelikkara Confluence
      [76.1550, 10.1850]  // Munambam Arabian Sea Bar
    ],
    emergencyContacts: [
      { agency: 'Thrissur District Disaster Management Authority', designation: 'Collectorate Control Room', phone: '+91-487-2362424', channel: 'KSDMA Thrissur Ops' },
      { agency: 'Chalakudy Sub-Collector Office', designation: 'Assistant Collector & Flood Officer', phone: '+91-480-2701235', channel: 'Direct Police Control' }
    ]
  },
  {
    id: 'meenachil',
    name: 'Meenachil River Corridor',
    basin: 'Meenachil River Basin',
    region: 'South-Central Kerala (Kottayam High Ranges)',
    riverName: 'Meenachil River',
    lengthKm: 78,
    catchmentAreaSqKm: 1208,
    upstreamNode: {
      name: 'Vagamon / Erattupetta High Ranges',
      lat: 9.6862,
      lon: 76.9052,
      elevationM: 1100,
      slopeDeg: 32,
      type: 'upstream_catchment',
      district: 'Kottayam',
      description: 'Precipitous tea-estate slopes and rocky escarpments prone to sudden micro-cloudbursts and debris avalanches (Plassanal-Poovarani axis).',
      criticalFoSThreshold: 1.15,
      soilType: 'Residual Lateritic Sandy Clay',
      bedrockDepthM: 1.9,
      soilCohesionKpa: 13.5,
      frictionAngleDeg: 29.5,
      hydraulicConductivityKs: 2.8e-5,
      capillarySuctionPsif: 0.21,
      saturatedMoistureThetaS: 0.47,
      residualMoistureThetaR: 0.11
    },
    midstreamNode: {
      name: 'Erattupetta Confluence Node',
      lat: 9.6950,
      lon: 76.7820,
      elevationM: 38,
      slopeDeg: 4.8,
      type: 'midstream_bottleneck',
      district: 'Kottayam',
      description: 'Point where three torrential hill streams (Tikoy, Poonjar, Moonnilavu) converge rapidly into the single Meenachil channel.',
      damName: 'Unregulated Mountain Torrent Catchment',
      fullReservoirLevelM: 0,
      currentLevelM: 0,
      crestSillElevationM: 0,
      totalShutters: 0,
      openShutters: 0,
      shutterWidthM: 0,
      damCapacityMcm: 0
    },
    downstreamNode: {
      name: 'Pala / Kottayam Kumarakom Backwaters',
      lat: 9.7086,
      lon: 76.6830,
      elevationM: 14,
      slopeDeg: 1.0,
      type: 'downstream_inundation',
      district: 'Kottayam',
      description: 'Pala town market riverbank, continuing down through Kottayam town into the fragile Kumarakom backwater bird sanctuary ecosystem.',
      dangerDischarge: 950, // m3/s
      warningDischarge: 700, // m3/s
      baseDischarge: 135,
      dangerStageM: 4.5,
      baseStageM: 0.9,
      populationAtRisk: 165000,
      vulnerableWards: ['Pala Municipality Riverfront', 'Mutholy', 'Ettumanoor Lowlands', 'Kumarakom Backwater Ring', 'Thiruvarpu'],
      safeEvacuationCenters: [
        { name: 'St. Thomas College Pala Relief Camp', capacity: 2200, lat: 9.7120, lon: 76.6890 },
        { name: 'Alphonsa College High Grounds Pala', capacity: 1800, lat: 9.7040, lon: 76.6780 },
        { name: 'Ettumanoor Govt Model High Ground Center', capacity: 2600, lat: 9.6710, lon: 76.5640 }
      ]
    },
    flowPathGeoJSON: [
      [76.9052, 9.6862], // Vagamon High Ranges
      [76.8410, 9.6890], // Poonjar Stream
      [76.7820, 9.6950], // Erattupetta Confluence
      [76.6830, 9.7086], // Pala Town
      [76.6120, 9.6640], // Kidangoor
      [76.5450, 9.6120], // Ettumanoor Outer
      [76.4950, 9.5850], // Kottayam City Northern Bypass
      [76.4250, 9.6050]  // Kumarakom Vembanad Estuary
    ],
    emergencyContacts: [
      { agency: 'Kottayam District Disaster Management Authority', designation: 'District Collector & Head DDMA', phone: '+91-481-2562201', channel: 'DDMA VHF Radio' },
      { agency: 'Pala Municipality Emergency Cell', designation: 'Municipal Commissioner & Rescue Officer', phone: '+91-4822-212234', channel: 'Pala Toll-Free 1077' }
    ]
  }
];
