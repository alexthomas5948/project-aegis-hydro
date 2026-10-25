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

