import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource
} from 'maplibre-gl';
import { KERALA_CORRIDORS } from '../data/keralaCorridors';
import type { CorridorTelemetryState } from '../types/hydrology';
import {
  buildFlowPathsGeoJSON,
  buildInundationGeoJSON,
  buildUpstreamHazardNodesGeoJSON,
  buildMuskingumReachesGeoJSON,
  buildInfrastructureMarkersGeoJSON,
  buildEvacuationRoutesGeoJSON
} from '../utils/geoUtils';
import {
  Compass,
  Layers,
  Maximize2,
  Minimize2,
  Mountain,
  Navigation2,
  Radio,
  Eye,
  AlertTriangle,
  Hospital,
  Shield,
  Zap,
  Activity
} from 'lucide-react';

interface Aegis3DMapProps {
  telemetryMap: Record<string, CorridorTelemetryState>;
  selectedCorridorId: string;
  onSelectCorridor: (id: string) => void;
}

// Guaranteed-working zero-API-key 3D Satellite Terrain + Dark Tactical Carto Hybrid Style
const TACTICAL_SATELLITE_3D_STYLE = {
  version: 8 as const,
  sources: {
    'esri-satellite': {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    },
    'carto-dark-labels': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256
    },
    'aws-terrain': {
      type: 'raster-dem' as const,
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      encoding: 'terrarium' as const,
      maxzoom: 14
    }
  },
  terrain: {
    source: 'aws-terrain',
    exaggeration: 1.8
  },
  layers: [
    {
      id: 'satellite-base',
      type: 'raster' as const,
      source: 'esri-satellite',
      paint: {
        'raster-brightness-max': 0.55,
        'raster-contrast': 0.25,
        'raster-saturation': -0.35
      }
    },
    {
      id: 'dark-labels',
      type: 'raster' as const,
      source: 'carto-dark-labels',
      paint: {
        'raster-opacity': 0.9
      }
    }
  ]
};

export const Aegis3DMap: React.FC<Aegis3DMapProps> = ({
  telemetryMap,
  selectedCorridorId,
  onSelectCorridor
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [inundationVisible, setInundationVisible] = useState(true);
  const [reachesVisible, setReachesVisible] = useState(true);
  const [infrastructureVisible, setInfrastructureVisible] = useState(true);
  const [evacuationVisible, setEvacuationVisible] = useState(true);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: TACTICAL_SATELLITE_3D_STYLE as any,
      center: [76.55, 10.15],
      zoom: 7.8,
      pitch: 58,
      bearing: -22,
      maxPitch: 75
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

    // Ensure WebGL initializes with correct dimensions 200ms after mount
    const resizeTimer = setTimeout(() => {
      map.resize();
    }, 200);

    map.on('load', () => {
      // 1. Ensure 3D Elevation Terrain is active
      try {
        if (!map.getSource('aws-terrain')) {
          map.addSource('aws-terrain', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            encoding: 'terrarium',
            maxzoom: 14
          });
        }
        map.setTerrain({
          source: 'aws-terrain',
          exaggeration: 1.8
        });
      } catch (e) {
        console.warn('MapLibre 3D terrain loading:', e);
      }

      // 2. Base Sources
      map.addSource('inundation-zones', {
        type: 'geojson',
        data: buildInundationGeoJSON(KERALA_CORRIDORS, telemetryMap)
      });

      map.addSource('flow-paths', {
        type: 'geojson',
        data: buildFlowPathsGeoJSON(KERALA_CORRIDORS, telemetryMap)
      });

      map.addSource('hazard-nodes', {
        type: 'geojson',
        data: buildUpstreamHazardNodesGeoJSON(KERALA_CORRIDORS, telemetryMap)
      });

      // UPGRADE 3.1 & 3.2 Sources: Muskingum reaches, infrastructure assets, evacuation routes
      map.addSource('muskingum-reaches', {
        type: 'geojson',
        data: buildMuskingumReachesGeoJSON(telemetryMap, selectedCorridorId)
      });

      map.addSource('infrastructure-assets', {
        type: 'geojson',
        data: buildInfrastructureMarkersGeoJSON(telemetryMap, selectedCorridorId)
      });

      map.addSource('evacuation-routes', {
        type: 'geojson',
        data: buildEvacuationRoutesGeoJSON(telemetryMap, selectedCorridorId)
      });

      // Layer: Inundation Polygons Fill
      map.addLayer({
        id: 'inundation-fill-layer',
        type: 'fill',
        source: 'inundation-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'hazardTier'],
            'CRITICAL', 'rgba(239, 68, 68, 0.45)',
            'WARNING', 'rgba(245, 158, 11, 0.40)',
            'ADVISORY', 'rgba(6, 182, 212, 0.35)',
            'rgba(16, 185, 129, 0.25)'
          ],
          'fill-opacity': 0.85
        }
      });

      // Layer: Inundation Outline
      map.addLayer({
        id: 'inundation-line-layer',
        type: 'line',
        source: 'inundation-zones',
        paint: {
          'line-color': [
            'match',
            ['get', 'hazardTier'],
            'CRITICAL', '#ef4444',
            'WARNING', '#f59e0b',
            'ADVISORY', '#06b6d4',
            '#10b981'
          ],
          'line-width': 2.5,
          'line-dasharray': [3, 2]
        }
      });

      // Layer: Flow Paths Outer Glow
      map.addLayer({
        id: 'flow-paths-glow',
        type: 'line',
        source: 'flow-paths',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'hazardTier'],
            'CRITICAL', '#ef4444',
            'WARNING', '#f59e0b',
            'ADVISORY', '#06b6d4',
            '#00f2fe'
          ],
          'line-width': 8,
          'line-opacity': 0.35,
          'line-blur': 4
        }
      });

      // Layer: Flow Paths Main Line
      map.addLayer({
        id: 'flow-paths-core',
        type: 'line',
        source: 'flow-paths',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'hazardTier'],
            'CRITICAL', '#ff4d4f',
            'WARNING', '#fbbf24',
            'ADVISORY', '#22d3ee',
            '#38bdf8'
          ],
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });

      // Layer: Muskingum 20-Reach Celerity Streamlines
      map.addLayer({
        id: 'muskingum-reaches-layer',
        type: 'line',
        source: 'muskingum-reaches',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'case',
            ['get', 'isCrestPeak'], '#ff0055',
            '#00ffff'
          ],
          'line-width': [
            'interpolate', ['linear'], ['get', 'celerityMs'],
            1.0, 4.0,
            6.0, 9.0
          ],
          'line-opacity': 0.95
        }
      });

      // Layer: Evacuation Routes (Green Safe vs Red Severed Bridge)
      map.addLayer({
        id: 'evacuation-routes-layer',
        type: 'line',
        source: 'evacuation-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'case',
            ['get', 'isBlocked'], '#ef4444',
            '#10b981'
          ],
          'line-width': [
            'case',
            ['get', 'isBlocked'], 3.5,
            4.0
          ],
          'line-dasharray': [
            'case',
            ['get', 'isBlocked'], ['literal', [2, 2]],
            ['literal', [1, 0]]
          ]
        }
      });

      // Layer: Upstream Hazard Points
      map.addLayer({
        id: 'hazard-points-halo',
        type: 'circle',
        source: 'hazard-nodes',
        paint: {
          'circle-radius': 14,
          'circle-color': [
            'match',
            ['get', 'hazardTier'],
            'CRITICAL', '#ef4444',
            'WARNING', '#f59e0b',
            'ADVISORY', '#06b6d4',
            '#10b981'
          ],
          'circle-opacity': 0.35,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: 'hazard-points-core',
        type: 'circle',
        source: 'hazard-nodes',
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['get', 'hazardTier'],
            'CRITICAL', '#ff1a1a',
            'WARNING', '#f59e0b',
            'ADVISORY', '#06b6d4',
            '#10b981'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#050811'
        }
      });

      // Layer: Infrastructure Assets Markers
      map.addLayer({
        id: 'infrastructure-assets-halo',
        type: 'circle',
        source: 'infrastructure-assets',
        paint: {
          'circle-radius': 11,
          'circle-color': [
            'match',
            ['get', 'status'],
            'SUBMERGED', '#ef4444',
            'CRITICAL_INGRESS', '#f59e0b',
            '#10b981'
          ],
          'circle-opacity': 0.35,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: 'infrastructure-assets-core',
        type: 'circle',
        source: 'infrastructure-assets',
        paint: {
          'circle-radius': 5.5,
          'circle-color': [
            'match',
            ['get', 'status'],
            'SUBMERGED', '#ff2222',
            'CRITICAL_INGRESS', '#f59e0b',
            '#10b981'
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#050811'
        }
      });

      // Click flow path or inundation zone to select corridor
      map.on('click', 'flow-paths-core', (e: any) => {
        if (e.features && e.features[0]) {
          const corridorId = e.features[0].properties?.corridorId;
          if (corridorId) {
            onSelectCorridor(corridorId);
          }
        }
      });

      map.on('click', 'inundation-fill-layer', (e: any) => {
        if (e.features && e.features[0]) {
          const corridorId = e.features[0].properties?.corridorId;
          if (corridorId) {
            onSelectCorridor(corridorId);
          }
        }
      });

      // Hover popup for Upstream Hazard Nodes
      map.on('mouseenter', 'hazard-points-core', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const coords = (e.features[0].geometry as any).coordinates.slice();

          const popup = popupRef.current ?? new Popup({ closeButton: false, closeOnClick: false, offset: 15 });
          popupRef.current = popup;

          popup
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1">
                <div class="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">UPSTREAM CATCHMENT // PDE SOLVER</div>
                <div class="font-bold text-white">${props.nodeName}</div>
                <div class="grid grid-cols-2 gap-x-3 text-[11px] pt-1">
                  <div>Slope: <span class="text-amber-400 font-mono">${props.slopeDeg}°</span></div>
                  <div>Elevation: <span class="text-cyan-300 font-mono">${props.elevationM}m</span></div>
                  <div>Slope FoS: <span class="${Number(props.factorOfSafety) < 1.05 ? 'text-red-400 font-bold' : Number(props.factorOfSafety) < 1.25 ? 'text-amber-400 font-bold' : 'text-emerald-400'} font-mono">${Number(props.factorOfSafety).toFixed(2)} (${Number(props.factorOfSafety) < 1.05 ? 'CRITICAL SLIP' : Number(props.factorOfSafety) < 1.25 ? 'WATCH (MARGINAL)' : 'STABLE'})</span></div>
                  <div>Saturation: <span class="text-cyan-400 font-mono">${props.saturationPct}%</span></div>
                </div>
                ${props.isLandslideRisk ? '<div class="text-[10px] text-red-400 font-bold mt-1 animate-pulse">CRITICAL LANDSLIDE / DEBRIS-DAM RISK</div>' : ''}
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('mouseleave', 'hazard-points-core', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
      });

      // Hover popup for Infrastructure Assets
      map.on('mouseenter', 'infrastructure-assets-core', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const coords = (e.features[0].geometry as any).coordinates.slice();

          const popup = popupRef.current ?? new Popup({ closeButton: false, closeOnClick: false, offset: 15 });
          popupRef.current = popup;

          const isSub = props.status === 'SUBMERGED';
          popup
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1">
                <div class="text-[10px] font-bold uppercase tracking-wider ${isSub ? 'text-red-400' : 'text-emerald-400'}">
                  ${props.facilityType?.toUpperCase()} // STATUS: ${props.status}
                </div>
                <div class="font-bold text-white">${props.name}</div>
                <div class="text-[10px] text-slate-300 pt-0.5">
                  Elevation: <span class="text-cyan-300 font-mono">${props.elevationM}m</span> | Pop At Risk: <span class="text-white font-mono">${props.populationImpact?.toLocaleString()}</span>
                </div>
                ${props.waterDepthM > 0 ? `<div class="text-[11px] text-red-400 font-bold">Submergence Depth: +${props.waterDepthM}m</div>` : ''}
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('mouseleave', 'infrastructure-assets-core', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
      });

      // Track cursor position
      map.on('mousemove', (e: any) => {
        setCursorCoords({
          lat: Number(e.lngLat.lat.toFixed(4)),
          lon: Number(e.lngLat.lng.toFixed(4))
        });
      });

      // Continuous animated dash offset for Muskingum river particle wave simulation
      let step = 0;
      const animateFlow = () => {
        step = (step + 1) % 100;
        if (map.getLayer('muskingum-reaches-layer')) {
          map.setPaintProperty('muskingum-reaches-layer', 'line-dasharray', [
            Math.max(1, (step % 12) / 2),
            2
          ]);
        }
        animFrameRef.current = requestAnimationFrame(animateFlow);
      };
      animFrameRef.current = requestAnimationFrame(animateFlow);
    });

    mapRef.current = map;

    return () => {
      clearTimeout(resizeTimer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []); // Run once on mount

  // Update dynamic GeoJSON data whenever telemetryMap or selectedCorridorId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      const inundationSource = map.getSource('inundation-zones') as GeoJSONSource | undefined;
      if (inundationSource) {
        inundationSource.setData(buildInundationGeoJSON(KERALA_CORRIDORS, telemetryMap));
      }

      const flowSource = map.getSource('flow-paths') as GeoJSONSource | undefined;
      if (flowSource) {
        flowSource.setData(buildFlowPathsGeoJSON(KERALA_CORRIDORS, telemetryMap));
      }

      const hazardSource = map.getSource('hazard-nodes') as GeoJSONSource | undefined;
      if (hazardSource) {
        hazardSource.setData(buildUpstreamHazardNodesGeoJSON(KERALA_CORRIDORS, telemetryMap));
      }

      const reachesSource = map.getSource('muskingum-reaches') as GeoJSONSource | undefined;
      if (reachesSource) {
        reachesSource.setData(buildMuskingumReachesGeoJSON(telemetryMap, selectedCorridorId));
      }

      const infraSource = map.getSource('infrastructure-assets') as GeoJSONSource | undefined;
      if (infraSource) {
        infraSource.setData(buildInfrastructureMarkersGeoJSON(telemetryMap, selectedCorridorId));
      }

      const evacSource = map.getSource('evacuation-routes') as GeoJSONSource | undefined;
      if (evacSource) {
        evacSource.setData(buildEvacuationRoutesGeoJSON(telemetryMap, selectedCorridorId));
      }
    } catch (e) {
      console.warn('GeoJSON update sync:', e);
    }
  }, [telemetryMap, selectedCorridorId]);

  // Handle Layer Visibility Toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('inundation-fill-layer') && map.getLayer('inundation-line-layer')) {
      const visibility = inundationVisible ? 'visible' : 'none';
      map.setLayoutProperty('inundation-fill-layer', 'visibility', visibility);
      map.setLayoutProperty('inundation-line-layer', 'visibility', visibility);
    }

    if (map.getLayer('muskingum-reaches-layer')) {
      map.setLayoutProperty('muskingum-reaches-layer', 'visibility', reachesVisible ? 'visible' : 'none');
    }

    if (map.getLayer('infrastructure-assets-core') && map.getLayer('infrastructure-assets-halo')) {
      const vis = infrastructureVisible ? 'visible' : 'none';
      map.setLayoutProperty('infrastructure-assets-core', 'visibility', vis);
      map.setLayoutProperty('infrastructure-assets-halo', 'visibility', vis);
    }

    if (map.getLayer('evacuation-routes-layer')) {
      map.setLayoutProperty('evacuation-routes-layer', 'visibility', evacuationVisible ? 'visible' : 'none');
    }
  }, [inundationVisible, reachesVisible, infrastructureVisible, evacuationVisible]);

  // Toggle 3D Terrain
  const toggleTerrain = () => {
    const map = mapRef.current;
    if (!map) return;

    const nextState = !terrainEnabled;
    setTerrainEnabled(nextState);

    if (nextState) {
      if (!map.getSource('aws-terrain')) {
        map.addSource('aws-terrain', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 14
        });
      }
      map.setTerrain({ source: 'aws-terrain', exaggeration: 1.6 });
    } else {
      map.setTerrain(null);
    }
  };

  // Fly camera along selected corridor
  const flyToCorridor = useCallback((corridorId: string) => {
    const map = mapRef.current;
    if (!map) return;

    const corridor = KERALA_CORRIDORS.find(c => c.id === corridorId);
    if (!corridor) return;

    const up = corridor.upstreamNode;
    const down = corridor.downstreamNode;
    const midLon = (up.lon + down.lon) / 2;
    const midLat = (up.lat + down.lat) / 2;

    const dLon = down.lon - up.lon;
    const dLat = down.lat - up.lat;
    const angleRad = Math.atan2(dLon, dLat);
    const bearingDeg = (angleRad * 180) / Math.PI;

    map.flyTo({
      center: [midLon, midLat],
      zoom: 9.8,
      pitch: 62,
      bearing: Math.round(bearingDeg - 15),
      speed: 1.1,
      curve: 1.3,
      essential: true
    });
  }, []);

  useEffect(() => {
    if (selectedCorridorId) {
      flyToCorridor(selectedCorridorId);
    }
  }, [selectedCorridorId, flyToCorridor]);

  const resetToStatewideView = () => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [76.55, 10.15],
      zoom: 7.8,
      pitch: 58,
      bearing: -22,
      speed: 1.0,
      curve: 1.2,
      essential: true
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      mapRef.current?.resize();
    }, 200);
  };

  return (
    <div
      className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[#050811]' : 'h-[520px] rounded-lg'} overflow-hidden border border-slate-800 shadow-2xl`}
      style={{ height: isFullscreen ? '100vh' : '520px', width: '100%' }}
    >
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ height: isFullscreen ? '100vh' : '520px', width: '100%' }}
      />

      {/* Top Left: Tactical Overlay & Quick Presets */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 pointer-events-auto">
        <div className="glass-panel px-3 py-2 rounded border border-cyan-500/30 flex items-center gap-2 shadow-lg">
          <div className="relative flex items-center justify-center">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="absolute w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div>
            <div className="text-[10px] font-chakra font-semibold text-cyan-300 tracking-wider">
              AEGIS-3D MUSKINGUM-CUNGE PDE TWIN
            </div>
            <div className="text-[9px] text-slate-400 font-mono">
              20 REACH DISCRETIZATION // SPEED &amp; CELERITY STREAMLINES
            </div>
          </div>
        </div>

        <div className="glass-panel-subtle p-1.5 rounded border border-slate-700/80 flex flex-wrap gap-1 max-w-[440px]">
          <button
            onClick={resetToStatewideView}
            className="px-2 py-1 text-[10px] font-mono rounded bg-slate-800/90 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 border border-slate-700 transition-colors"
          >
            STATEWIDE
          </button>
          {KERALA_CORRIDORS.map(c => {
            const isSelected = selectedCorridorId === c.id;
            const telemetry = telemetryMap[c.id];
            const isCritical = telemetry?.physics.hazardTier === 'CRITICAL';
            return (
              <button
                key={c.id}
                onClick={() => onSelectCorridor(c.id)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-cyan-500 text-black font-bold shadow-md'
                    : isCritical
                    ? 'bg-red-950/80 text-red-300 border border-red-500/60 hover:bg-red-900'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {isCritical && <AlertTriangle className="w-2.5 h-2.5 text-red-400 animate-pulse" />}
                {c.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Right: Advanced Layer Toggles */}
      <div className="absolute top-3 right-14 flex items-center gap-1.5 z-10 pointer-events-auto">
        <button
          onClick={toggleTerrain}
          title="Toggle 3D Elevation Terrain"
          className={`glass-panel p-2 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            terrainEnabled ? 'text-cyan-300 border-cyan-500/50 bg-cyan-950/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          <Mountain className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">3D DEM</span>
        </button>

        <button
          onClick={() => setReachesVisible(!reachesVisible)}
          title="Toggle 20 Muskingum-Cunge Streamlines"
          className={`glass-panel p-2 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            reachesVisible ? 'text-cyan-300 border-cyan-500/50 bg-cyan-950/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">20 REACHES</span>
        </button>

        <button
          onClick={() => setInfrastructureVisible(!infrastructureVisible)}
          title="Toggle Critical Assets"
          className={`glass-panel p-2 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            infrastructureVisible ? 'text-amber-300 border-amber-500/50 bg-amber-950/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          <Hospital className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">ASSETS</span>
        </button>

        <button
          onClick={() => setEvacuationVisible(!evacuationVisible)}
          title="Toggle Autonomous Evacuation Routes"
          className={`glass-panel p-2 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            evacuationVisible ? 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">EVAC ROUTES</span>
        </button>

        <button
          onClick={() => setInundationVisible(!inundationVisible)}
          title="Toggle Inundation Polygon Buffers"
          className={`glass-panel p-2 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            inundationVisible ? 'text-red-300 border-red-500/50 bg-red-950/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">INUNDATION</span>
        </button>

        <button
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          className="glass-panel p-2 rounded text-xs font-mono text-slate-300 border border-slate-700 hover:text-white"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Bottom Left: Tactical Symbology Legend */}
      <div className="absolute bottom-3 left-3 z-10 glass-panel px-3 py-2 rounded border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1 hidden sm:block">
        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-cyan-400" />
          PDE HYDRAULIC &amp; ASSET SYMBOLOGY
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm" />
            <span>Wave Celerity Streamline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span>Peak Flood Crest Node</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400 inline-block" />
            <span>Open Evacuation Route</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-red-500 border border-dashed border-red-300 inline-block" />
            <span>Submerged Bridge Crossing</span>
          </div>
        </div>
      </div>

      {/* Bottom Right: Cursor Coordinates */}
      <div className="absolute bottom-3 right-3 z-10 glass-panel px-2.5 py-1.5 rounded border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-2">
        <Compass className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '20s' }} />
        <span>WGS84:</span>
        <span className="text-cyan-300">
          {cursorCoords ? `${cursorCoords.lat}° N, ${cursorCoords.lon}° E` : '76.5500° E, 10.1500° N'}
        </span>
      </div>
    </div>
  );
};
