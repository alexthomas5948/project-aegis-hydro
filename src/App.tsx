import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { KERALA_CORRIDORS } from './data/keralaCorridors';
import { telemetryEngine } from './services/keralaTelemetryEngine';
import { voiceDispatchEngine } from './services/voiceDispatchEngine';
import { fieldSensorSync } from './services/fieldSensorSync';
import { WirelessFieldBridge } from './services/wirelessFieldBridge';
import type { FieldNodeTelemetryPacket } from './services/wirelessFieldBridge';
import { keralaMultiHazardEngine } from './utils/keralaMultiHazardEngine';
import type {
  CorridorTelemetryState,
  DispatchVoiceAlert,
  FieldNodeTelemetry,
  SixVectorHazardState
} from './types/hydrology';
import { CommandTopbar } from './components/CommandTopbar';
import { StatewideAlertTicker } from './components/StatewideAlertTicker';
import { CorridorCardsGrid } from './components/CorridorCardsGrid';
import { Aegis3DMap } from './components/Aegis3DMap';
import { CorridorInspectorDrawer } from './components/CorridorInspectorDrawer';
import { MonsoonSimulatorModal } from './components/MonsoonSimulatorModal';
import { EmergencyVoiceDispatchModal } from './components/EmergencyVoiceDispatchModal';
import { SixVectorMultiHazardMatrix } from './components/SixVectorMultiHazardMatrix';
import { FieldNodePairingModal } from './components/FieldNodePairingModal';
import { KsdmaSitrepModal } from './components/KsdmaSitrepModal';
import { MobileFieldNode } from './components/MobileFieldNode';
import {
  AlertTriangle,
  Radio,
  Shield,
  Layers,
  Activity,
  Terminal,
  Cpu
} from 'lucide-react';

export function App() {
  // Check if current view is dedicated Smartphone Field Node mode (?mode=field-node)
  const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'field-node';
    }
    return false;
  });

  // WebRTC Cross-Device Wireless Bridge
  const [bridge] = useState<WirelessFieldBridge>(() => new WirelessFieldBridge());
  const [roomPin, setRoomPin] = useState<string>(() => bridge.roomPin);
  const [livePhoneData, setLivePhoneData] = useState<FieldNodeTelemetryPacket | null>(null);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, CorridorTelemetryState>>({});
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('periyar');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isSitrepOpen, setIsSitrepOpen] = useState(false);
  const [activeEmergencyAlert, setActiveEmergencyAlert] = useState<DispatchVoiceAlert | null>(null);

  // Live Smartphone HIL Sensor Node state
  const [fieldNodeTelemetry, setFieldNodeTelemetry] = useState<FieldNodeTelemetry | null>(null);
  const [isHILConnected, setIsHILConnected] = useState<boolean>(false);

  // Direct live telemetry ingestion callback from physical smartphone
  const handleIncomingPhoneTelemetry = useCallback((packet: FieldNodeTelemetryPacket) => {
    setLivePhoneData(packet);
    setIsHILConnected(true);

    setFieldNodeTelemetry(prev => {
      const incomingCreep = packet.creepVelocity !== undefined 
        ? packet.creepVelocity 
        : (prev ? prev.creepVelocity : 0.0);
      const clampedCreep = Math.max(-180, Math.min(180, incomingCreep));

      return {
        roomId: bridge.roomPin,
        deviceId: 'HIL-PHONE-NODE-1',
        timestamp: packet.timestamp,
        pitch: packet.pitch,
        roll: packet.roll,
        pitchDelta: packet.tiltDeltaDeg,
        rollDelta: packet.roll,
        creepVelocity: parseFloat(clampedCreep.toFixed(1)),
        pga: packet.seismicPgaG,
        seismicRms: packet.seismicRmsMs2,
        accelX: parseFloat((packet.seismicPgaG * 9.8).toFixed(2)),
        accelY: parseFloat((packet.tiltDeltaDeg * 0.1).toFixed(2)),
        accelZ: 9.81,
        poreSaturation: packet.simulatedMoisturePct !== null ? packet.simulatedMoisturePct : (prev?.poreSaturation ?? 76.5),
        stationName: prev?.stationName || 'WAYANAD-CHOORALMALA-SLOPE-1',
        hazardLevel: Math.abs(packet.tiltDeltaDeg) > 4.5 || packet.seismicPgaG > 0.08 || Math.abs(clampedCreep) > 2.0 ? 'CRITICAL_FAILURE' : Math.abs(packet.tiltDeltaDeg) > 1.8 ? 'WARNING' : 'STABLE',
        isSimulated: packet.simulatedMoisturePct !== null
      };
    });
  }, [bridge.roomPin]);

  // Initialize telemetry engine & polling loop
  useEffect(() => {
    if (isMobileMode) return;

    // Start 60-second polling
    telemetryEngine.startPolling(60000);

    // Subscribe to telemetry state (Manual dispatch only: do not auto-open modal or auto-play voice on polling)
    const unsubscribeTelemetry = telemetryEngine.subscribe((snapshot) => {
      setTelemetryMap(snapshot);
    });

    // Subscribe to voice dispatch alerts
    const unsubscribeVoice = voiceDispatchEngine.subscribe((alerts) => {
      if (alerts.length > 0 && !activeEmergencyAlert) {
        // Can optionally surface latest
      }
    });

    // Start WebRTC Wireless Receiver for physical smartphone connection
    bridge.startPcReceiver(
      (packet: FieldNodeTelemetryPacket) => {
        handleIncomingPhoneTelemetry(packet);
      },
      (connected: boolean, pin: string) => {
        setIsHILConnected(connected);
        setRoomPin(pin);
      }
    );

    // Subscribe to Smartphone HIL Field Node BroadcastChannel sync bus (multi-tab backup)
    fieldSensorSync.initReceiver(roomPin);
    const unsubscribeHIL = fieldSensorSync.subscribe((data) => {
      setFieldNodeTelemetry(data);
      setIsHILConnected(true);
    });

    const unsubscribeHILConn = fieldSensorSync.subscribeConnection((conn) => {
      setIsHILConnected(conn);
    });

    return () => {
      bridge.destroy();
      unsubscribeTelemetry();
      unsubscribeVoice();
      unsubscribeHIL();
      unsubscribeHILConn();
      telemetryEngine.stopPolling();
    };
  }, [isMobileMode, roomPin, bridge, handleIncomingPhoneTelemetry]);

  // If in dedicated mobile hardware mode, render the full-screen tactical mobile UI
  if (isMobileMode) {
    return (
      <MobileFieldNode
        pin={roomPin}
        onExit={() => {
          if (typeof window !== 'undefined') {
            window.location.href = window.location.pathname;
          }
        }}
      />
    );
  }

  const selectedCorridor = KERALA_CORRIDORS.find(c => c.id === selectedCorridorId) || KERALA_CORRIDORS[0];

  // Effective Slope Angle: effectiveSlope = baseCorridorSlope + Math.abs(packet.tiltDeltaDeg)
  const effectiveSelectedCorridor = useMemo(() => {
    if (!livePhoneData) return selectedCorridor;
    const effectiveSlope = parseFloat((selectedCorridor.upstreamNode.slopeDeg + Math.abs(livePhoneData.tiltDeltaDeg)).toFixed(1));
    return {
      ...selectedCorridor,
      upstreamNode: {
        ...selectedCorridor.upstreamNode,
        slopeDeg: effectiveSlope
      }
    };
  }, [selectedCorridor, livePhoneData]);

  // Direct Live Override on PC Dashboard when Phone Packets Arrive
  const effectiveTelemetryMap = useMemo(() => {
    if (!livePhoneData) return telemetryMap;
    const current = telemetryMap[selectedCorridorId];
    if (!current) return telemetryMap;

    const calculatedSatelliteFoS = current.physics.factorOfSafety;
    // When tilt delta < 3° and pga < 0.03g, slopes remain completely nominal.
    // When tiltDeltaDeg > 6° or seismicPgaG > 0.05g, FoS drops below 1.05 (CRITICAL RED ALERT).
    const tiltPenalty = Math.abs(livePhoneData.tiltDeltaDeg) > 3.0
      ? (Math.abs(livePhoneData.tiltDeltaDeg) - 3.0) * 0.16
      : 0;
    const seismicPenalty = livePhoneData.seismicPgaG > 0.03
      ? (livePhoneData.seismicPgaG - 0.03) * 14.0
      : 0;
    const liveHardwareFoS = Math.max(0.35, Number((calculatedSatelliteFoS - tiltPenalty - seismicPenalty).toFixed(2)));

    const overrideSaturation = livePhoneData.simulatedMoisturePct !== null
      ? livePhoneData.simulatedMoisturePct
      : current.physics.deepSaturationPct;

    const isCritical = liveHardwareFoS < 1.05 || Math.abs(livePhoneData.tiltDeltaDeg) > 6.0 || livePhoneData.seismicPgaG > 0.05;
    const isWarning = !isCritical && (liveHardwareFoS < 1.25 || Math.abs(livePhoneData.tiltDeltaDeg) >= 3.0 || livePhoneData.seismicPgaG > 0.035);
    const hazardTier = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : current.physics.hazardTier;
    const dynamicRiskIndex = isCritical ? Math.max(88, current.physics.dynamicRiskIndex) : current.physics.dynamicRiskIndex;

    const updatedCorridorState: CorridorTelemetryState = {
      ...current,
      upstream: {
        ...current.upstream,
        soilSaturationPct: overrideSaturation,
      },
      physics: {
        ...current.physics,
        factorOfSafety: liveHardwareFoS,
        deepSaturationPct: overrideSaturation,
        hazardTier,
        dynamicRiskIndex,
        iversonPDE: {
          ...current.physics.iversonPDE,
          minFoS: liveHardwareFoS,
          stabilityStatus: isCritical ? 'CRITICAL_SHEAR_FAILURE' : isWarning ? 'MARGINAL_CREEP' : current.physics.iversonPDE.stabilityStatus
        }
      }
    };

    return {
      ...telemetryMap,
      [selectedCorridorId]: updatedCorridorState
    };
  }, [telemetryMap, selectedCorridorId, livePhoneData]);

  const selectedTelemetry = effectiveTelemetryMap[selectedCorridorId];

  // Evaluate the 6-Vector Multi-Hazard Engine across all 14 Kerala districts
  const sixVectorHazardState: SixVectorHazardState = keralaMultiHazardEngine.evaluateMultiHazard(
    selectedTelemetry,
    effectiveTelemetryMap,
    fieldNodeTelemetry,
    effectiveSelectedCorridor
  );

  // Check if any corridor is currently in CRITICAL state
  const hasCriticalAlert = Object.values(effectiveTelemetryMap).some(t => t.physics.hazardTier === 'CRITICAL') ||
    sixVectorHazardState.overallCascadeRiskIndex >= 75;

  // Trigger manual emergency dispatch from the UI for the selected corridor
  const handleTriggerEmergencyDispatch = () => {
    if (selectedTelemetry) {
      const alert = voiceDispatchEngine.triggerManualEmergencyAlert(effectiveSelectedCorridor, selectedTelemetry);
      setActiveEmergencyAlert(alert);
    }
  };

  // Re-sync open Voice Dispatch modal whenever selected corridor changes
  useEffect(() => {
    if (activeEmergencyAlert && selectedTelemetry) {
      const alert = voiceDispatchEngine.triggerManualEmergencyAlert(effectiveSelectedCorridor, selectedTelemetry);
      setActiveEmergencyAlert(alert);
    }
  }, [selectedCorridorId]);

  const handleSelectDistrict = (district: string) => {
    if (district === 'Wayanad' || district === 'Kozhikode' || district === 'Malappuram') {
      setSelectedCorridorId('chaliyar');
    } else if (district === 'Idukki' || district === 'Ernakulam') {
      setSelectedCorridorId('periyar');
    } else if (district === 'Pathanamthitta' || district === 'Alappuzha') {
      setSelectedCorridorId('pamba');
    } else if (district === 'Thrissur') {
      setSelectedCorridorId('chalakudy');
    } else if (district === 'Kottayam') {
      setSelectedCorridorId('meenachil');
    }
  };

  const handleLaunchMobileTab = () => {
    if (typeof window !== 'undefined') {
      window.open(`/?mode=field-node&pin=${roomPin}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* 1. Tactical Command Topbar */}
      <CommandTopbar
        telemetryMap={effectiveTelemetryMap}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenVoiceConsole={handleTriggerEmergencyDispatch}
        onOpenPairingModal={() => setIsPairingModalOpen(true)}
        onOpenSitrep={() => setIsSitrepOpen(true)}
        hasCriticalAlert={hasCriticalAlert}
        isHILConnected={isHILConnected}
        roomPin={roomPin}
      />

      {/* 2. Statewide SDMA/CWC Live Alert Ticker */}
      <StatewideAlertTicker telemetryMap={effectiveTelemetryMap} />

      {/* Main Command Operations Center */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-4 md:p-5 space-y-4">
        {/* 3. Five Real Kerala Corridors KPI Cards Grid */}
        <CorridorCardsGrid
          telemetryMap={effectiveTelemetryMap}
          selectedCorridorId={selectedCorridorId}
          onSelectCorridor={(id) => setSelectedCorridorId(id)}
        />

        {/* 4. The 6-Vector Total Kerala Multi-Hazard Early Detection Matrix */}
        <section aria-label="6-Vector Multi-Hazard Cascading Early Detection Matrix">
          <SixVectorMultiHazardMatrix
            hazardState={sixVectorHazardState}
            fieldNodeTelemetry={fieldNodeTelemetry}
            onOpenPairingModal={() => setIsPairingModalOpen(true)}
            onSelectDistrict={handleSelectDistrict}
          />
        </section>

        {/* 5. Interactive 3D Kerala Terrain Map (MapLibre GL JS) */}
        <section aria-label="3D Geospatial Digital Twin Map">
          <Aegis3DMap
            telemetryMap={effectiveTelemetryMap}
            selectedCorridorId={selectedCorridorId}
            onSelectCorridor={(id) => setSelectedCorridorId(id)}
          />
        </section>

        {/* 6. Corridor Inspector & Multi-Curve Hydrograph Drawer */}
        {selectedTelemetry && (
          <section aria-label="Corridor Hydrograph and Civil Engineering Telemetry">
            <CorridorInspectorDrawer
              corridor={effectiveSelectedCorridor}
              telemetry={selectedTelemetry}
              onTriggerEmergencyDispatch={handleTriggerEmergencyDispatch}
              onOpenSimulatorForCorridor={() => setIsSimulatorOpen(true)}
            />
          </section>
        )}
      </main>

      {/* 7. Extreme Monsoon Stress-Test Simulator Modal */}
      <MonsoonSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        selectedCorridorId={selectedCorridorId}
      />

      {/* 8. Autonomous Emergency Voice Dispatch Console Modal */}
      <EmergencyVoiceDispatchModal
        alert={activeEmergencyAlert}
        onClose={() => setActiveEmergencyAlert(null)}
      />

      {/* 9. Smartphone HIL Field Node Pairing HUD Modal */}
      <FieldNodePairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        pin={roomPin}
        onLaunchMobileTab={handleLaunchMobileTab}
        telemetry={fieldNodeTelemetry}
        isConnected={isHILConnected}
      />

      {/* 10. KSDMA Executive Situation Report (SITREP) Modal (UPGRADE 4) */}
      {selectedTelemetry && (
        <KsdmaSitrepModal
          isOpen={isSitrepOpen}
          onClose={() => setIsSitrepOpen(false)}
          corridor={effectiveSelectedCorridor}
          telemetry={selectedTelemetry}
          hazardState={sixVectorHazardState}
          telemetryMap={effectiveTelemetryMap}
        />
      )}

      {/* Tactical Footer */}
      <footer className="w-full border-t border-slate-900 bg-[#04060d] py-3 px-4 text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>AEGIS-KERALA // STATEWIDE AUTONOMOUS EARLY WARNING DIGITAL TWIN</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">ECMWF ERA5 &amp; COPERNICUS GLOFAS 4.0 TELEMETRY ENGINE</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" />
            PHYSICS: 6-VECTOR CASCADE + IVERSON PDE + MUSKINGUM-CUNGE + FROEHLICH LDOF
          </span>
          <span className="text-emerald-400 font-bold">24/7 AUTONOMOUS C2 ACTIVE</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
