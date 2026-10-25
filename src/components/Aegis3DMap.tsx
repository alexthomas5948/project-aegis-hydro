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
  buildEvacuationRoutesGeoJSON,
  buildActiveCorridorStreamlineGeoJSON,
  buildDiscretizedReachNodesGeoJSON,
  buildBridgeMarkersGeoJSON
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
  Activity,
  Play,
  Square
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
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
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
  const tourTimeoutsRef = useRef<number[]>([]);

  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [inundationVisible, setInundationVisible] = useState(true);
  const [reachesVisible, setReachesVisible] = useState(true);
  const [infrastructureVisible, setInfrastructureVisible] = useState(true);
  const [evacuationVisible, setEvacuationVisible] = useState(true);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTourPlaying, setIsTourPlaying] = useState(false);

  const selectedCorridor = KERALA_CORRIDORS.find(c => c.id === selectedCorridorId) || KERALA_CORRIDORS[0];

  // Helper to safely synchronize all GeoJSON data into MapLibre
  const syncAllGeoJSONSources = useCallback((map: MapLibreMap) => {
    if (!map) return;

    try {
      const activeCorridor = KERALA_CORRIDORS.find(c => c.id === selectedCorridorId) || KERALA_CORRIDORS[0];

      // 1. Inundation zones
      const inunSrc = map.getSource('inundation-zones') as GeoJSONSource | undefined;
      if (inunSrc) inunSrc.setData(buildInundationGeoJSON(KERALA_CORRIDORS, telemetryMap) as any);

      // 2. Statewide flow paths
      const flowSrc = map.getSource('flow-paths') as GeoJSONSource | undefined;
      if (flowSrc) flowSrc.setData(buildFlowPathsGeoJSON(KERALA_CORRIDORS, telemetryMap) as any);

      // 3. Upstream hazard nodes
      const hazSrc = map.getSource('hazard-nodes') as GeoJSONSource | undefined;
      if (hazSrc) hazSrc.setData(buildUpstreamHazardNodesGeoJSON(KERALA_CORRIDORS, telemetryMap) as any);

      // 4. Active Corridor Glowing Streamline (Upstream -> Midstream -> Downstream 20 points)
      const streamlineSrc = map.getSource('active-corridor-streamline') as GeoJSONSource | undefined;
      if (streamlineSrc) {
        streamlineSrc.setData(buildActiveCorridorStreamlineGeoJSON(activeCorridor, telemetryMap) as any);
      }

      // 5. 20 Discretized Reach Nodes (Circles with peak crest tag)
      const reachNodesSrc = map.getSource('muskingum-reach-nodes') as GeoJSONSource | undefined;
      if (reachNodesSrc) {
        reachNodesSrc.setData(buildDiscretizedReachNodesGeoJSON(activeCorridor, telemetryMap) as any);
      }

      // 6. Muskingum-Cunge Reach Line Segments
      const reachesSrc = map.getSource('muskingum-reaches') as GeoJSONSource | undefined;
      if (reachesSrc) {
        reachesSrc.setData(buildMuskingumReachesGeoJSON(telemetryMap, selectedCorridorId) as any);
      }

      // 7. Critical Infrastructure Assets
      const infraSrc = map.getSource('infrastructure-assets') as GeoJSONSource | undefined;
      if (infraSrc) {
        infraSrc.setData(buildInfrastructureMarkersGeoJSON(telemetryMap, selectedCorridorId) as any);
      }

      // 8. Evacuation Routes
      const evacSrc = map.getSource('evacuation-routes') as GeoJSONSource | undefined;
      if (evacSrc) {
        evacSrc.setData(buildEvacuationRoutesGeoJSON(telemetryMap, selectedCorridorId) as any);
      }

      // 9. Bridge Markers
      const bridgeSrc = map.getSource('bridge-markers') as GeoJSONSource | undefined;
      if (bridgeSrc) {
        bridgeSrc.setData(buildBridgeMarkersGeoJSON(telemetryMap, selectedCorridorId) as any);
      }
    } catch (err) {
      console.warn('GeoJSON update sync exception:', err);
    }
  }, [selectedCorridorId, telemetryMap]);

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

      const activeCorridor = KERALA_CORRIDORS.find(c => c.id === selectedCorridorId) || KERALA_CORRIDORS[0];

      // 2. Base Sources
      map.addSource('inundation-zones', {
        type: 'geojson',
        data: buildInundationGeoJSON(KERALA_CORRIDORS, telemetryMap) as any
      });

      map.addSource('flow-paths', {
        type: 'geojson',
        data: buildFlowPathsGeoJSON(KERALA_CORRIDORS, telemetryMap) as any
      });

      map.addSource('hazard-nodes', {
        type: 'geojson',
        data: buildUpstreamHazardNodesGeoJSON(KERALA_CORRIDORS, telemetryMap) as any
      });

      // Active River Corridor Streamline Source
      map.addSource('active-corridor-streamline', {
        type: 'geojson',
        data: buildActiveCorridorStreamlineGeoJSON(activeCorridor, telemetryMap) as any
      });

      // 20 Discretized Reach Nodes Source
      map.addSource('muskingum-reach-nodes', {
        type: 'geojson',
        data: buildDiscretizedReachNodesGeoJSON(activeCorridor, telemetryMap) as any
      });

      // Muskingum Cunge Reaches
      map.addSource('muskingum-reaches', {
        type: 'geojson',
        data: buildMuskingumReachesGeoJSON(telemetryMap, selectedCorridorId) as any
      });

      // Infrastructure Assets
      map.addSource('infrastructure-assets', {
        type: 'geojson',
        data: buildInfrastructureMarkersGeoJSON(telemetryMap, selectedCorridorId) as any
      });

      // Evacuation Routes
      map.addSource('evacuation-routes', {
        type: 'geojson',
        data: buildEvacuationRoutesGeoJSON(telemetryMap, selectedCorridorId) as any
      });

      // Bridge Markers
      map.addSource('bridge-markers', {
        type: 'geojson',
        data: buildBridgeMarkersGeoJSON(telemetryMap, selectedCorridorId) as any
      });

      // ----------------- LAYERS -----------------

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

      // Layer: Statewide Flow Paths Glow
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
          'line-width': 6,
          'line-opacity': 0.30,
          'line-blur': 4
        }
      });

      // Layer: Statewide Flow Paths Core
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
          'line-width': 2.5,
          'line-opacity': 0.75
        }
      });

      // --- UPGRADE 1: ACTIVE RIVER CORRIDOR STREAMLINE (DUAL-LAYER GLOWING GEOJSON) ---
      // Outer Glow Layer: line-width: 10, line-blur: 6, line-opacity: 0.45, color #06B6D4 (Normal) / #EF4444 (Critical/Surge)
      map.addLayer({
        id: 'active-streamline-glow',
        type: 'line',
        source: 'active-corridor-streamline',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'colorGlow'],
          'line-width': 10,
          'line-blur': 6,
          'line-opacity': 0.45
        }
      });

      // Core Streamline Layer: line-width: 3.5, high-contrast #22D3EE (Normal) / #F87171 (Alert)
      map.addLayer({
        id: 'active-streamline-core',
        type: 'line',
        source: 'active-corridor-streamline',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'colorCore'],
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });

      // Muskingum 20-Reach Celerity Streamlines
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
            1.0, 3.5,
            6.0, 7.5
          ],
          'line-opacity': 0.85
        }
      });

      // Evacuation Routes (Green Safe vs Red Severed Bridge)
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

      // --- 20 DISCRETIZED REACH NODES (CIRCLE LAYER ALONG RIVER PATH) ---
      map.addLayer({
        id: 'reach-nodes-glow',
        type: 'circle',
        source: 'muskingum-reach-nodes',
        paint: {
          'circle-radius': ['case', ['get', 'isCrestPeak'], 10, 6],
          'circle-color': [
            'case',
            ['get', 'isCrestPeak'], '#ef4444',
            ['get', 'isAlert'], '#f87171',
            '#06b6d4'
          ],
          'circle-opacity': 0.45,
          'circle-blur': 0.4
        }
      });

      map.addLayer({
        id: 'reach-nodes-core',
        type: 'circle',
        source: 'muskingum-reach-nodes',
        paint: {
          'circle-radius': ['case', ['get', 'isCrestPeak'], 6.5, 4.0],
          'circle-color': [
            'case',
            ['get', 'isCrestPeak'], '#ff0033',
            ['get', 'isAlert'], '#ef4444',
            '#22d3ee'
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });

      // --- PULSING PEAK FLOOD CREST NODE MARKER ---
      map.addLayer({
        id: 'peak-crest-node-pulse',
        type: 'circle',
        source: 'muskingum-reach-nodes',
        filter: ['==', ['get', 'isCrestPeak'], true],
        paint: {
          'circle-radius': 14,
          'circle-color': '#ef4444',
          'circle-opacity': 0.5,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ff4d4f'
        }
      });

      // --- BRIDGE CROSSING MARKERS ---
      map.addLayer({
        id: 'bridge-markers-halo',
        type: 'circle',
        source: 'bridge-markers',
        paint: {
          'circle-radius': 11,
          'circle-color': [
            'case',
            ['get', 'isBlocked'], '#ef4444',
            '#10b981'
          ],
          'circle-opacity': 0.4,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: 'bridge-markers-core',
        type: 'circle',
        source: 'bridge-markers',
        paint: {
          'circle-radius': 5.5,
          'circle-color': [
            'case',
            ['get', 'isBlocked'], '#ff2222',
            '#10b981'
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#050811'
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
          'circle-radius': 10,
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
          'circle-radius': 5,
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

      // Synchronize all data immediately upon load
      syncAllGeoJSONSources(map);

      // Interactions: Corridor clicks
      map.on('click', 'flow-paths-core', (e: any) => {
        if (e.features && e.features[0]) {
          const corridorId = e.features[0].properties?.corridorId;
          if (corridorId) onSelectCorridor(corridorId);
        }
      });

      map.on('click', 'inundation-fill-layer', (e: any) => {
        if (e.features && e.features[0]) {
          const corridorId = e.features[0].properties?.corridorId;
          if (corridorId) onSelectCorridor(corridorId);
        }
      });

      // Hover popup for 20 Discretized Reach Nodes
      map.on('mouseenter', 'reach-nodes-core', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const coords = (e.features[0].geometry as any).coordinates.slice();

          const popup = popupRef.current ?? new Popup({ closeButton: false, closeOnClick: false, offset: 15 });
          popupRef.current = popup;

          popup
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1 font-mono text-xs">
                <div class="text-[10px] ${props.isCrestPeak ? 'text-red-400 font-bold animate-pulse' : 'text-cyan-400 font-bold'} uppercase tracking-wider">
                  ${props.isCrestPeak ? '🚨 PEAK FLOOD CREST REACH' : 'MUSKINGUM-CUNGE REACH NODE'}
                </div>
                <div class="font-bold text-white">Reach #${props.reachNumber} (${props.distanceKm} km from Highland)</div>
                <div class="grid grid-cols-2 gap-x-2 text-[11px] pt-1 text-slate-300">
                  <div>Discharge: <span class="text-amber-400 font-bold">${props.flowDischargeM3s} m³/s</span></div>
                  <div>Wave Celerity: <span class="text-cyan-300 font-bold">${props.waveCelerityMs} m/s</span></div>
                  <div>Water Depth: <span class="text-white">${props.waterDepthM} m</span></div>
                  <div>Status: <span class="${props.isCrestPeak ? 'text-red-400 font-bold' : 'text-emerald-400'}">${props.isCrestPeak ? 'PEAK CREST' : 'PROPAGATING'}</span></div>
                </div>
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('mouseleave', 'reach-nodes-core', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
      });

      // Hover popup for Bridge Markers
      map.on('mouseenter', 'bridge-markers-core', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const coords = (e.features[0].geometry as any).coordinates.slice();

          const popup = popupRef.current ?? new Popup({ closeButton: false, closeOnClick: false, offset: 15 });
          popupRef.current = popup;

          popup
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1 font-mono text-xs">
                <div class="text-[10px] font-bold uppercase tracking-wider ${props.isBlocked ? 'text-red-400 animate-pulse' : 'text-emerald-400'}">
                  BRIDGE CROSSING // ${props.isBlocked ? 'SUBMERGED & SEVERED' : 'OPEN & SECURE'}
                </div>
                <div class="font-bold text-white">${props.name}</div>
                <div class="text-[11px] text-slate-300 pt-0.5">
                  Clearance Speed: <span class="text-cyan-300 font-bold">${props.clearanceSpeedKmh} km/h</span> | Elev: ${props.elevationM}m
                </div>
                ${props.isBlocked ? '<div class="text-[11px] text-red-400 font-bold">BREACHED BY RIVER SURGE — EVACUATION ROUTE DETOURED</div>' : ''}
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('mouseleave', 'bridge-markers-core', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
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
              <div class="space-y-1 font-mono text-xs">
                <div class="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">UPSTREAM CATCHMENT // PDE SOLVER</div>
                <div class="font-bold text-white">${props.nodeName}</div>
                <div class="grid grid-cols-2 gap-x-3 text-[11px] pt-1">
                  <div>Slope: <span class="text-amber-400">${props.slopeDeg}°</span></div>
                  <div>Elevation: <span class="text-cyan-300">${props.elevationM}m</span></div>
                  <div>Slope FoS: <span class="${Number(props.factorOfSafety) < 1.05 ? 'text-red-400 font-bold' : Number(props.factorOfSafety) < 1.25 ? 'text-amber-400 font-bold' : 'text-emerald-400'}">${Number(props.factorOfSafety).toFixed(2)} (${Number(props.factorOfSafety) < 1.05 ? 'CRITICAL SLIP' : Number(props.factorOfSafety) < 1.25 ? 'WATCH (MARGINAL)' : 'STABLE'})</span></div>
                  <div>Saturation: <span class="text-cyan-400">${props.saturationPct}%</span></div>
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
              <div class="space-y-1 font-mono text-xs">
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

      // Dynamic animation loop for river streamline dash offset and pulsing peak crest node
      let step = 0;
      const animateFlow = () => {
        step = (step + 1) % 120;

        // Animate Muskingum reaches
        if (map.getLayer('muskingum-reaches-layer')) {
          map.setPaintProperty('muskingum-reaches-layer', 'line-dasharray', [
            Math.max(1, (step % 12) / 2),
            2
          ]);
        }

        // Animate Active Streamline Core
        if (map.getLayer('active-streamline-core')) {
          const dash1 = 2 + (step % 8);
          map.setPaintProperty('active-streamline-core', 'line-dasharray', [dash1, 3]);
        }

        // Pulse Peak Flood Crest Node
        if (map.getLayer('peak-crest-node-pulse')) {
          const pulsePhase = (Date.now() % 1600) / 1600; // 0 to 1
          const pulseRadius = 8 + pulsePhase * 16; // 8 to 24px
          const pulseOpacity = 0.85 * (1 - pulsePhase);
          map.setPaintProperty('peak-crest-node-pulse', 'circle-radius', pulseRadius);
          map.setPaintProperty('peak-crest-node-pulse', 'circle-opacity', pulseOpacity);
        }

        animFrameRef.current = requestAnimationFrame(animateFlow);
      };
      animFrameRef.current = requestAnimationFrame(animateFlow);
    });

    mapRef.current = map;

    return () => {
      clearTimeout(resizeTimer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      tourTimeoutsRef.current.forEach(t => clearTimeout(t));
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update dynamic GeoJSON data whenever telemetryMap or selectedCorridorId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncAllGeoJSONSources(map);
  }, [telemetryMap, selectedCorridorId, syncAllGeoJSONSources]);

  // Handle Layer Visibility Toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('inundation-fill-layer') && map.getLayer('inundation-line-layer')) {
      const visibility = inundationVisible ? 'visible' : 'none';
      map.setLayoutProperty('inundation-fill-layer', 'visibility', visibility);
      map.setLayoutProperty('inundation-line-layer', 'visibility', visibility);
    }

    if (map.getLayer('active-streamline-glow') && map.getLayer('active-streamline-core')) {
      const vis = reachesVisible ? 'visible' : 'none';
      map.setLayoutProperty('active-streamline-glow', 'visibility', vis);
      map.setLayoutProperty('active-streamline-core', 'visibility', vis);
    }

    if (map.getLayer('reach-nodes-glow') && map.getLayer('reach-nodes-core') && map.getLayer('peak-crest-node-pulse')) {
      const vis = reachesVisible ? 'visible' : 'none';
      map.setLayoutProperty('reach-nodes-glow', 'visibility', vis);
      map.setLayoutProperty('reach-nodes-core', 'visibility', vis);
      map.setLayoutProperty('peak-crest-node-pulse', 'visibility', vis);
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

    if (map.getLayer('bridge-markers-core') && map.getLayer('bridge-markers-halo')) {
      const vis = evacuationVisible ? 'visible' : 'none';
      map.setLayoutProperty('bridge-markers-core', 'visibility', vis);
      map.setLayoutProperty('bridge-markers-halo', 'visibility', vis);
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
      map.setTerrain({ source: 'aws-terrain', exaggeration: 1.8 });
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

  // ----------------- UPGRADE 1: 3D RIVER CORRIDOR TOUR -----------------
  const startRiverCorridorTour = () => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous timeouts if already playing
    tourTimeoutsRef.current.forEach(t => clearTimeout(t));
    tourTimeoutsRef.current = [];

    if (isTourPlaying) {
      setIsTourPlaying(false);
      return;
    }

    setIsTourPlaying(true);
    const corridor = selectedCorridor;
    const up = corridor.upstreamNode;
    const down = corridor.downstreamNode;
    const mid = corridor.midstreamNode || {
      lat: (up.lat + down.lat) / 2,
      lon: (up.lon + down.lon) / 2
    };

    // Bearing from Upstream to Midstream
    const dLon1 = mid.lon - up.lon;
    const dLat1 = mid.lat - up.lat;
    const bearing1 = Math.round((Math.atan2(dLon1, dLat1) * 180) / Math.PI);

    // Bearing from Midstream to Downstream
    const dLon2 = down.lon - mid.lon;
    const dLat2 = down.lat - mid.lat;
    const bearing2 = Math.round((Math.atan2(dLon2, dLat2) * 180) / Math.PI);

    // Stage 1: Fly to Upstream Mountain Scarp (pitch: 72, zoom: 12.5)
    map.flyTo({
      center: [up.lon, up.lat],
      pitch: 72,
      zoom: 12.5,
      bearing: bearing1 - 10,
      speed: 0.9,
      curve: 1.3,
      essential: true
    });

    // Stage 2: Valley bottleneck
    const t1 = window.setTimeout(() => {
      map.flyTo({
        center: [mid.lon, mid.lat],
        pitch: 68,
        zoom: 12.0,
        bearing: bearing2 - 5,
        speed: 0.75,
        curve: 1.2,
        essential: true
      });
    }, 3800);

    // Stage 3: Downstream coastal floodplain (pitch: 60, zoom: 11.8)
    const t2 = window.setTimeout(() => {
      map.flyTo({
        center: [down.lon, down.lat],
        pitch: 60,
        zoom: 11.8,
        bearing: bearing2,
        speed: 0.65,
        curve: 1.1,
        essential: true
      });
    }, 7800);

    // Stage 4: Conclude tour
    const t3 = window.setTimeout(() => {
      setIsTourPlaying(false);
    }, 11500);

    tourTimeoutsRef.current = [t1, t2, t3];
  };

  const resetToStatewideView = () => {
    const map = mapRef.current;
    if (!map) return;

    tourTimeoutsRef.current.forEach(t => clearTimeout(t));
    tourTimeoutsRef.current = [];
    setIsTourPlaying(false);

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
      className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[#050811]' : 'h-[530px] rounded-lg'} overflow-hidden border border-slate-800 shadow-2xl`}
      style={{ height: isFullscreen ? '100vh' : '530px', width: '100%' }}
    >
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ height: isFullscreen ? '100vh' : '530px', width: '100%' }}
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

      {/* Top Right: Advanced Layer Toggles & 3D TOUR Button */}
      <div className="absolute top-3 right-14 flex items-center gap-1.5 z-10 pointer-events-auto">
        {/* UPGRADE 1: "FLY RIVER CORRIDOR (3D TOUR)" BUTTON */}
        <button
          onClick={startRiverCorridorTour}
          title="Fly River Corridor (3D Tour) from upstream mountain scarp down valley to downstream floodplain"
          className={`glass-panel px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-all shadow-md ${
            isTourPlaying
              ? 'bg-cyan-500 text-black border-cyan-300 animate-pulse glow-cyan'
              : 'bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border-cyan-500/60'
          }`}
        >
          {isTourPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="text-[10px]">STOP TOUR</span>
            </>
          ) : (
            <>
              <Navigation2 className="w-3.5 h-3.5 text-cyan-400 rotate-45" />
              <span className="text-[10px] hidden md:inline">FLY RIVER CORRIDOR (3D TOUR)</span>
              <span className="text-[10px] md:hidden">3D TOUR</span>
            </>
          )}
        </button>

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
          title="Toggle 20 Muskingum-Cunge Streamlines & Nodes"
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
          title="Toggle Autonomous Evacuation Routes & Bridge Crossings"
          className={`glass-panel p-2 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            evacuationVisible ? 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">EVAC / BRIDGES</span>
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

      {/* Bottom Left: Tactical Symbology Legend (UPGRADE 1: ALL 5 ITEMS RENDERED) */}
      <div className="absolute bottom-3 left-3 z-10 glass-panel px-3 py-2 rounded border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1 hidden sm:block">
        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-cyan-400" />
          PDE HYDRAULIC &amp; ASSET SYMBOLOGY
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-cyan-400 rounded-sm shadow-sm inline-block" />
            <span>Wave Celerity Streamline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-300 border border-white" />
            <span>20 Discretized Reach Nodes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-white" />
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

export default Aegis3DMap;
