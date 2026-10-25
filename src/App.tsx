import React, { useEffect, useState } from 'react';
import { KERALA_CORRIDORS } from './data/keralaCorridors';
import { telemetryEngine } from './services/keralaTelemetryEngine';
import { voiceDispatchEngine } from './services/voiceDispatchEngine';
import { fieldSensorSync } from './services/fieldSensorSync';
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

  const [roomPin] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room') || '4092';
    }
    return '4092';
  });

  const [telemetryMap, setTelemetryMap] = useState<Record<string, CorridorTelemetryState>>({});
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('periyar');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [activeEmergencyAlert, setActiveEmergencyAlert] = useState<DispatchVoiceAlert | null>(null);

  // Live Smartphone HIL Sensor Node state
  const [fieldNodeTelemetry, setFieldNodeTelemetry] = useState<FieldNodeTelemetry | null>(null);
  const [isHILConnected, setIsHILConnected] = useState<boolean>(false);

  // Initialize telemetry engine & polling loop
  useEffect(() => {
    if (isMobileMode) return;

    // Start 60-second polling
    telemetryEngine.startPolling(60000);

    // Subscribe to telemetry state
    const unsubscribeTelemetry = telemetryEngine.subscribe((snapshot) => {
      setTelemetryMap(snapshot);

      // Check if any corridor has triggered a critical threshold (DRI >= 80 or FoS < 1.05)
      for (const corridor of KERALA_CORRIDORS) {
        const state = snapshot[corridor.id];
        if (state) {
          const alert = voiceDispatchEngine.evaluateStateForAlert(corridor, state);
          if (alert && !activeEmergencyAlert) {
            setActiveEmergencyAlert(alert);
          }
        }
      }
    });

    // Subscribe to voice dispatch alerts
    const unsubscribeVoice = voiceDispatchEngine.subscribe((alerts) => {
      if (alerts.length > 0 && !activeEmergencyAlert) {
        // Can optionally surface latest
      }
    });

    // Subscribe to Smartphone HIL Field Node sync bus
    fieldSensorSync.initReceiver(roomPin);
    const unsubscribeHIL = fieldSensorSync.subscribe((data) => {
      setFieldNodeTelemetry(data);
      setIsHILConnected(true);
    });

    const unsubscribeHILConn = fieldSensorSync.subscribeConnection((conn) => {
      setIsHILConnected(conn);
    });

    return () => {
      unsubscribeTelemetry();
      unsubscribeVoice();
      unsubscribeHIL();
      unsubscribeHILConn();
      telemetryEngine.stopPolling();
    };
  }, [isMobileMode, roomPin]);

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
  const selectedTelemetry = telemetryMap[selectedCorridorId];

  // Evaluate the 6-Vector Multi-Hazard Engine across all 14 Kerala districts
  const sixVectorHazardState: SixVectorHazardState = keralaMultiHazardEngine.evaluateMultiHazard(
    selectedTelemetry,
    telemetryMap,
    fieldNodeTelemetry
  );

  // Check if any corridor is currently in CRITICAL state
  const hasCriticalAlert = Object.values(telemetryMap).some(t => t.physics.hazardTier === 'CRITICAL') ||
    sixVectorHazardState.overallCascadeRiskIndex >= 75;

  // Trigger manual emergency dispatch from the UI
  const handleTriggerEmergencyDispatch = () => {
    if (selectedTelemetry) {
      const alert = voiceDispatchEngine.triggerManualEmergencyAlert(selectedCorridor, selectedTelemetry);
      setActiveEmergencyAlert(alert);
    }
  };

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
      window.open(`/?mode=field-node&room=${roomPin}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* 1. Tactical Command Topbar */}
      <CommandTopbar
        telemetryMap={telemetryMap}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenVoiceConsole={handleTriggerEmergencyDispatch}
        onOpenPairingModal={() => setIsPairingModalOpen(true)}
        hasCriticalAlert={hasCriticalAlert}
        isHILConnected={isHILConnected}
      />

      {/* 2. Statewide SDMA/CWC Live Alert Ticker */}
      <StatewideAlertTicker telemetryMap={telemetryMap} />

      {/* Main Command Operations Center */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-4 md:p-5 space-y-4">
        {/* 3. Five Real Kerala Corridors KPI Cards Grid */}
        <CorridorCardsGrid
          telemetryMap={telemetryMap}
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
            telemetryMap={telemetryMap}
            selectedCorridorId={selectedCorridorId}
            onSelectCorridor={(id) => setSelectedCorridorId(id)}
          />
        </section>

        {/* 6. Corridor Inspector & Multi-Curve Hydrograph Drawer */}
        {selectedTelemetry && (
          <section aria-label="Corridor Hydrograph and Civil Engineering Telemetry">
            <CorridorInspectorDrawer
              corridor={selectedCorridor}
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
      />

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
