import { REGIONAL_CRITICAL_FACILITIES, REGIONAL_EVACUATION_ROUTES } from './infrastructureSolver';
/**
 * Generates a GeoJSON polygon ring approximating a circle with a given radius in kilometers
 */
export function generateCircleCoordinates(centerLon: number, centerLat: number, radiusKm: number, points = 48): [number, number][] {
  const coords: [number, number][] = [];
  const kmToLat = 1 / 110.574;
  const kmToLon = 1 / (111.320 * Math.cos((centerLat * Math.PI) / 180));

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dx = radiusKm * Math.sin(angle) * kmToLon;
    const dy = radiusKm * Math.cos(angle) * kmToLat;
    coords.push([Number((centerLon + dx).toFixed(6)), Number((centerLat + dy).toFixed(6))]);
  }

  return coords;
}

/**
 * Creates a GeoJSON FeatureCollection representing dynamic downstream inundation zones
 */
export function buildInundationGeoJSON(
  corridors: Array<{
    id: string;
    downstreamNode: { lat: number; lon: number; name: string };
  }>,
  telemetryMap: Record<string, { downstream: { inundationRadiusKm: number; dischargeM3s: number; stageHeightM: number }; physics: { hazardTier: string } }>
) {
  const features = corridors.map(c => {
    const telemetry = telemetryMap[c.id];
    const radius = telemetry?.downstream.inundationRadiusKm ?? 1.5;
    const tier = telemetry?.physics.hazardTier ?? 'NORMAL';
    const discharge = telemetry?.downstream.dischargeM3s ?? 0;
    const stage = telemetry?.downstream.stageHeightM ?? 1.0;

    const ring = generateCircleCoordinates(c.downstreamNode.lon, c.downstreamNode.lat, radius);

    return {
      type: 'Feature' as const,
      properties: {
        corridorId: c.id,
        townName: c.downstreamNode.name,
        radiusKm: radius,
        hazardTier: tier,
        dischargeM3s: discharge,
        stageHeightM: stage
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring]
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Creates a GeoJSON FeatureCollection for river corridor flow paths
 */
export function buildFlowPathsGeoJSON(
  corridors: Array<{
    id: string;
    name: string;
    riverName: string;
    flowPathGeoJSON: [number, number][];
  }>,
  telemetryMap: Record<string, { physics: { hazardTier: string; dynamicRiskIndex: number }; downstream: { dischargeM3s: number } }>
) {
  const features = corridors.map(c => {
    const telemetry = telemetryMap[c.id];
    const tier = telemetry?.physics.hazardTier ?? 'NORMAL';
    const dri = telemetry?.physics.dynamicRiskIndex ?? 30;
    const discharge = telemetry?.downstream.dischargeM3s ?? 300;

    return {
      type: 'Feature' as const,
      properties: {
        corridorId: c.id,
        corridorName: c.name,
        riverName: c.riverName,
        hazardTier: tier,
        dri,
        discharge
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: c.flowPathGeoJSON
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Creates GeoJSON points for upstream catchments with 3D hazard extrusion properties
 */
export function buildUpstreamHazardNodesGeoJSON(
  corridors: Array<{
    id: string;
    upstreamNode: { lat: number; lon: number; name: string; elevationM: number; slopeDeg: number };
  }>,
  telemetryMap: Record<string, { physics: { factorOfSafety: number; hazardTier: string; deepSaturationPct: number; isLandslideRisk: boolean }; upstream: { precipitationCurrentMm: number } }>
) {
  const features = corridors.map(c => {
    const telemetry = telemetryMap[c.id];
    const fos = telemetry?.physics.factorOfSafety ?? 1.5;
    const tier = telemetry?.physics.hazardTier ?? 'NORMAL';
    const sat = telemetry?.physics.deepSaturationPct ?? 50;
    const rain = telemetry?.upstream.precipitationCurrentMm ?? 0;
    const isLandslide = telemetry?.physics.isLandslideRisk ?? false;

    // Extrusion height proportional to risk (meters)
    const height = Math.max(150, Math.min(1800, (2.0 - Math.min(2.0, fos)) * 1200));

    return {
      type: 'Feature' as const,
      properties: {
        corridorId: c.id,
        nodeName: c.upstreamNode.name,
        elevationM: c.upstreamNode.elevationM,
        slopeDeg: c.upstreamNode.slopeDeg,
        factorOfSafety: fos,
        hazardTier: tier,
        saturationPct: sat,
        precipitationMm: rain,
        isLandslideRisk: isLandslide,
        extrusionHeight: height
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [c.upstreamNode.lon, c.upstreamNode.lat]
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Creates GeoJSON LineStrings for 20 Muskingum-Cunge reaches with wave celerity & discharge
 */
export function buildMuskingumReachesGeoJSON(
  telemetryMap: Record<string, any>,
  selectedCorridorId: string
) {
  const telemetry = telemetryMap[selectedCorridorId];
  const reaches = telemetry?.physics?.muskingumCunge?.reaches || [];
  if (reaches.length < 2) return { type: 'FeatureCollection' as const, features: [] };

  const features = [];
  for (let i = 0; i < reaches.length - 1; i++) {
    const r1 = reaches[i];
    const r2 = reaches[i + 1];
    const celerity = (r1.waveCelerityMs + r2.waveCelerityMs) / 2;
    const discharge = (r1.flowDischargeM3s + r2.flowDischargeM3s) / 2;
    const isPeak = r1.isCrestPeak || r2.isCrestPeak;

    features.push({
      type: 'Feature' as const,
      properties: {
        reachIndex: i,
        celerityMs: celerity,
        dischargeM3s: discharge,
        waterDepthM: r1.waterDepthM,
        isCrestPeak: isPeak,
        speedFactor: Math.min(3.5, Math.max(0.5, celerity / 2.0))
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [r1.coordinates, r2.coordinates]
      }
    });
  }

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Creates GeoJSON points for critical infrastructure facilities
 */
export function buildInfrastructureMarkersGeoJSON(
  telemetryMap: Record<string, any>,
  selectedCorridorId: string
) {
  const telemetry = telemetryMap[selectedCorridorId];
  const facilities = telemetry?.facilities || [];

  const features = facilities.map((f: any) => ({
    type: 'Feature' as const,
    properties: {
      id: f.id,
      name: f.name,
      facilityType: f.type,
      status: f.status,
      waterDepthM: f.waterDepthM,
      elevationM: f.elevationM,
      populationImpact: f.populationImpact,
      vicinity: f.vicinity
    },
    geometry: {
      type: 'Point' as const,
      coordinates: f.coordinates
    }
  }));

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Creates GeoJSON LineStrings for safe vs. severed evacuation routes
 */
export function buildEvacuationRoutesGeoJSON(
  telemetryMap: Record<string, any>,
  selectedCorridorId: string
) {
  const telemetry = telemetryMap[selectedCorridorId];
  const routes = telemetry?.evacuationRoutes || [];

  const features = routes.map((r: any) => ({
    type: 'Feature' as const,
    properties: {
      id: r.id,
      name: r.name,
      isBlocked: r.isBlockedByFlood,
      isBridge: r.isBridgeCrossing,
      bridgeName: r.bridgeName || '',
      speedKmh: r.clearanceSpeedKmh
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: r.coordinates
    }
  }));

  return {
    type: 'FeatureCollection' as const,
    features
  };
}



/**
 * Interpolates [lon, lat] along a polyline to create 20 equidistant points
 */
export function interpolate20Coordinates(pathCoords: [number, number][]): [number, number][] {
  if (!pathCoords || pathCoords.length < 2) return Array(20).fill([76.5, 10.0]);
  const result: [number, number][] = [];
  const totalSegments = pathCoords.length - 1;

  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const globalPos = t * totalSegments;
    const segIndex = Math.min(totalSegments - 1, Math.floor(globalPos));
    const localT = globalPos - segIndex;

    const p1 = pathCoords[segIndex];
    const p2 = pathCoords[segIndex + 1] || p1;

    const lon = p1[0] + (p2[0] - p1[0]) * localT;
    const lat = p1[1] + (p2[1] - p1[1]) * localT;
    result.push([Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
  }

  return result;
}

/**
 * Builds the glowing dual-layer Active River Corridor Streamline GeoJSON LineString
 * connecting Upstream Highland GPS -> Midstream Bottleneck -> Downstream Floodplain
 * along 20 interpolated reach waypoints.
 */
export function buildActiveCorridorStreamlineGeoJSON(
  corridor: {
    id: string;
    name: string;
    flowPathGeoJSON: [number, number][];
    upstreamNode: { lat: number; lon: number; name: string };
    midstreamNode?: { lat: number; lon: number; name?: string };
    downstreamNode: { lat: number; lon: number; name: string };
  },
  telemetryMap: Record<string, any>
) {
  const telemetry = telemetryMap[corridor.id];
  const reaches = telemetry?.physics?.muskingumCunge?.reaches;
  
  let waypoints: [number, number][];
  if (reaches && reaches.length === 20) {
    waypoints = reaches.map((r: any) => r.coordinates);
  } else {
    waypoints = interpolate20Coordinates(corridor.flowPathGeoJSON);
  }

  if (waypoints.length > 0) {
    waypoints[0] = [corridor.upstreamNode.lon, corridor.upstreamNode.lat];
    waypoints[waypoints.length - 1] = [corridor.downstreamNode.lon, corridor.downstreamNode.lat];
  }

  const fos = telemetry?.physics?.factorOfSafety ?? 1.5;
  const dri = telemetry?.physics?.dynamicRiskIndex ?? 28;
  const hazardTier = telemetry?.physics?.hazardTier ?? 'NORMAL';
  const isAlert = hazardTier === 'CRITICAL' || hazardTier === 'WARNING' || fos < 1.05 || dri >= 50;

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          corridorId: corridor.id,
          corridorName: corridor.name,
          isAlert,
          hazardTier,
          colorGlow: isAlert ? '#EF4444' : '#06B6D4',
          colorCore: isAlert ? '#F87171' : '#22D3EE',
          celerityMs: telemetry?.physics?.waveCelerityMs ?? 2.8,
          celerityKmh: telemetry?.physics?.waveCelerityKmh ?? 10.1,
          dischargeM3s: telemetry?.downstream?.dischargeM3s ?? 320
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: waypoints
        }
      }
    ]
  };
}

/**
 * Builds GeoJSON points for the 20 Discretized Muskingum-Cunge Reach Nodes along the river path
 * including peak flood crest tagging.
 */
export function buildDiscretizedReachNodesGeoJSON(
  corridor: {
    id: string;
    flowPathGeoJSON: [number, number][];
    upstreamNode: { lat: number; lon: number; elevationM: number };
    downstreamNode: { lat: number; lon: number; elevationM: number };
  },
  telemetryMap: Record<string, any>
) {
  const telemetry = telemetryMap[corridor.id];
  const reaches = telemetry?.physics?.muskingumCunge?.reaches;
  const waypoints = reaches && reaches.length === 20
    ? reaches.map((r: any) => r.coordinates)
    : interpolate20Coordinates(corridor.flowPathGeoJSON);

  const fos = telemetry?.physics?.factorOfSafety ?? 1.5;
  const dri = telemetry?.physics?.dynamicRiskIndex ?? 28;
  const isAlert = (telemetry?.physics?.hazardTier === 'CRITICAL') || fos < 1.05 || dri >= 50;
  const peakIndex = telemetry?.physics?.muskingumCunge?.peakReachIndex ?? (isAlert ? 6 : 4);

  const features = waypoints.map((coords: [number, number], i: number) => {
    const reachData = reaches?.[i];
    const isPeak = reachData ? Boolean(reachData.isCrestPeak) : (i === peakIndex);
    const distanceKm = reachData?.distanceKm ?? Number((i * 4.2).toFixed(1));
    const discharge = reachData?.flowDischargeM3s ?? (telemetry?.downstream?.dischargeM3s ?? 320);
    const celerity = reachData?.waveCelerityMs ?? (telemetry?.physics?.waveCelerityMs ?? 2.8);
    const depth = reachData?.waterDepthM ?? 2.1;

    return {
      type: 'Feature' as const,
      properties: {
        reachIndex: i,
        reachNumber: i + 1,
        distanceKm,
        flowDischargeM3s: discharge,
        waveCelerityMs: celerity,
        waterDepthM: depth,
        isCrestPeak: isPeak,
        isAlert
      },
      geometry: {
        type: 'Point' as const,
        coordinates: coords
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Builds GeoJSON points for Bridge Crossings (both open and submerged)
 */
export function buildBridgeMarkersGeoJSON(
  telemetryMap: Record<string, any>,
  selectedCorridorId: string
) {
  const telemetry = telemetryMap[selectedCorridorId];
  const routes = (telemetry?.evacuationRoutes && telemetry.evacuationRoutes.length > 0)
    ? telemetry.evacuationRoutes
    : (REGIONAL_EVACUATION_ROUTES[selectedCorridorId] || []);

  const facilities = (telemetry?.facilities && telemetry.facilities.length > 0)
    ? telemetry.facilities
    : (REGIONAL_CRITICAL_FACILITIES[selectedCorridorId] || []);

  const bridgeFeatures = [];
  const seenNames = new Set();

  for (const r of routes) {
    if (r.isBridgeCrossing || r.bridgeName) {
      const bridgeName = r.bridgeName || r.name;
      if (seenNames.has(bridgeName)) continue;
      seenNames.add(bridgeName);

      const coords = r.coordinates;
      const midCoord = coords.length >= 3 ? coords[Math.floor(coords.length / 2)] : (coords[0] || [76.5, 10.0]);

      bridgeFeatures.push({
        type: 'Feature',
        properties: {
          id: r.id,
          name: bridgeName,
          isBlocked: Boolean(r.isBlockedByFlood),
          isBridge: true,
          clearanceSpeedKmh: r.clearanceSpeedKmh,
          elevationM: 14.5,
          waterDepthM: r.isBlockedByFlood ? 0.65 : 0
        },
        geometry: {
          type: 'Point',
          coordinates: midCoord
        }
      });
    }
  }

  for (const f of facilities) {
    if (f.type === 'bridge' && !seenNames.has(f.name)) {
      seenNames.add(f.name);
      const isSubmerged = f.status === 'SUBMERGED' || f.status === 'CRITICAL_INGRESS';
      bridgeFeatures.push({
        type: 'Feature',
        properties: {
          id: f.id,
          name: f.name,
          isBlocked: isSubmerged,
          isBridge: true,
          clearanceSpeedKmh: isSubmerged ? 0 : 45,
          elevationM: f.elevationM,
          waterDepthM: f.waterDepthM || 0
        },
        geometry: {
          type: 'Point',
          coordinates: f.coordinates
        }
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features: bridgeFeatures
  };
}
