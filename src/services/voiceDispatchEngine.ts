import type { DispatchVoiceAlert, HydrologicalCorridor, CorridorTelemetryState } from '../types/hydrology';

type AlertListener = (alerts: DispatchVoiceAlert[]) => void;

class VoiceDispatchEngine {
  private static instance: VoiceDispatchEngine;
  private alerts: DispatchVoiceAlert[] = [];
  private listeners: Set<AlertListener> = new Set();
  private isMuted = false;
  private isSpeaking = false;
  private recentAnnouncedCorridors: Map<string, number> = new Map(); // corridorId -> timestamp

  private constructor() {
    // Check speech synthesis support
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Warm up voices
        window.speechSynthesis.getVoices();
      };
    }
  }

  public static getInstance(): VoiceDispatchEngine {
    if (!VoiceDispatchEngine.instance) {
      VoiceDispatchEngine.instance = new VoiceDispatchEngine();
    }
    return VoiceDispatchEngine.instance;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    listener([...this.alerts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.alerts]);
    }
  }

  /**
   * Check corridor state and automatically generate emergency dispatch alert if DRI >= 80 or FoS < 1.05
   */
  public evaluateStateForAlert(corridor: HydrologicalCorridor, state: CorridorTelemetryState): DispatchVoiceAlert | null {
    const isCritical = state.physics.dynamicRiskIndex >= 80 || state.physics.factorOfSafety < 1.05 || state.physics.hazardTier === 'CRITICAL';
    if (!isCritical) return null;

    // Throttle automated repeat voice broadcasts to once per 2 minutes per corridor
    const now = Date.now();
    const lastSpoken = this.recentAnnouncedCorridors.get(corridor.id) || 0;
    const shouldSpeak = now - lastSpoken > 120000;

    const alert = this.createAlertObject(corridor, state);

    // Keep up to 20 historical alerts
    const existingIndex = this.alerts.findIndex(a => a.corridorId === corridor.id && a.status === 'PENDING');
    if (existingIndex >= 0) {
      this.alerts[existingIndex] = alert;
    } else {
      this.alerts.unshift(alert);
      if (this.alerts.length > 20) this.alerts.pop();
    }

    this.notify();

    if (shouldSpeak && !this.isMuted) {
      this.speakAlert(alert.broadcastMessage);
      this.recentAnnouncedCorridors.set(corridor.id, now);
    }

    return alert;
  }

  /**
   * Manual trigger from user for live hackathon demonstration
   */
  public triggerManualEmergencyAlert(corridor: HydrologicalCorridor, state: CorridorTelemetryState): DispatchVoiceAlert {
    const alert = this.createAlertObject(corridor, state);
    this.alerts.unshift(alert);
    if (this.alerts.length > 20) this.alerts.pop();
    this.notify();

    if (!this.isMuted) {
      this.speakAlert(alert.broadcastMessage);
    }

    return alert;
  }

  private createAlertObject(corridor: HydrologicalCorridor, state: CorridorTelemetryState): DispatchVoiceAlert {
    const id = `AEGIS-ALERT-${corridor.id.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const etaHours = Math.floor(state.physics.floodCrestEtaMinutes / 60);
    const etaMins = state.physics.floodCrestEtaMinutes % 60;
    const etaStr = etaHours > 0 ? `${etaHours} hours ${etaMins} minutes` : `${etaMins} minutes`;

    // 1. 2-Decimal Geotechnical Precision for Factor of Safety (FoS)
    const fosRaw = state.physics.factorOfSafety;
    const fosFormatted = (typeof fosRaw === 'number' ? fosRaw : Number(fosRaw)).toFixed(2);

    // 2. Consistent Dynamic Risk Index (DRI) vs. Priority 1 Red Alert
    let dri = state.physics.dynamicRiskIndex;
    if (state.physics.factorOfSafety <= 1.05 || state.physics.hazardTier === 'CRITICAL' || dri >= 80) {
      dri = Math.max(86, dri);
    }

    // 3. Realistic Peak Flood Surge Discharge
    const dangerDischarge = (corridor as any).dangerDischargeM3s ?? corridor.downstreamNode.dangerDischarge ?? 1500;
    const currentDischarge = Math.round(state.downstream.dischargeM3s);
    const peakSurgeDischarge = Math.round(Math.max(dangerDischarge * 1.12, currentDischarge));

    // High impact phonetically clear C2 voice broadcast script
    const broadcastMessage = `AEGIS-COMMAND PRIORITY 1 RED ALERT for ${corridor.name}. ` +
      `Upstream highland slope at ${corridor.upstreamNode.name} has breached stability threshold with Infinite Slope Factor of Safety ${fosFormatted}. ` +
      `Approaching downstream peak flood surge at ${corridor.downstreamNode.name} is projected at ${peakSurgeDischarge.toLocaleString()} cubic meters per second, with current baseline flow at ${currentDischarge.toLocaleString()} cubic meters per second. ` +
      `Peak flood wave arrival estimated in ${etaStr} at ${state.physics.floodCrestClockTime}. ` +
      `Immediate Stage-3 evacuation ordered for riparian wards: ${corridor.downstreamNode.vulnerableWards.slice(0, 3).join(', ')}. ` +
      `Move to designated high-ground relief centers immediately.`;

    const webhookPayload = {
      event_type: 'STATEWIDE_HYDRO_GEOMORPHIC_CRITICAL_BREACH',
      protocol_version: 'AEGIS-C2-V3.2',
      alert_id: id,
      timestamp_utc: new Date().toISOString(),
      timestamp_ist: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      corridor_id: corridor.id,
      corridor_name: corridor.name,
      basin: corridor.basin,
      district_zones: [corridor.upstreamNode.district, corridor.downstreamNode.district],
      severity: {
        hazard_tier: state.physics.hazardTier,
        dynamic_risk_index: dri,
        landslide_debris_dam_risk: state.physics.isLandslideRisk
      },
      upstream_physics: {
        catchment_node: corridor.upstreamNode.name,
        slope_angle_degrees: corridor.upstreamNode.slopeDeg,
        infinite_slope_fos: Number(fosFormatted),
        pore_water_pressure_kpa: state.physics.poreWaterPressureKpa,
        soil_saturation_pct: state.physics.deepSaturationPct,
        current_rainfall_mm_hr: state.upstream.precipitationCurrentMm,
        scs_effective_runoff_q_mm: state.physics.scsDirectRunoffQ
      },
      downstream_hydraulics: {
        floodplain_zone: corridor.downstreamNode.name,
        danger_discharge_threshold_m3s: dangerDischarge,
        live_discharge_m3s: currentDischarge,
        predicted_peak_surge_discharge_m3s: peakSurgeDischarge,
        discharge_danger_ratio: state.downstream.dischargeCapacityRatio,
        river_stage_height_m: state.downstream.stageHeightM,
        dynamic_inundation_radius_km: state.downstream.inundationRadiusKm,
        flood_crest_eta_minutes: state.physics.floodCrestEtaMinutes,
        flood_crest_projected_time_ist: state.physics.floodCrestClockTime
      },
      evacuation_orders: {
        priority: 'IMMEDIATE_LIFE_SAFETY_EVACUATION',
        vulnerable_wards: corridor.downstreamNode.vulnerableWards,
        population_at_risk: corridor.downstreamNode.populationAtRisk,
        designated_shelters: corridor.downstreamNode.safeEvacuationCenters
      },
      telephony_voice_agent_dispatch: {
        outbound_tts_prompt: broadcastMessage,
        recommended_recipients: corridor.emergencyContacts
      }
    };

    return {
      id,
      corridorId: corridor.id,
      corridorName: corridor.name,
      timestamp: new Date().toLocaleTimeString(),
      hazardTier: state.physics.hazardTier,
      dri: dri,
      fos: Number(fosFormatted),
      etaString: etaStr,
      targetTown: corridor.downstreamNode.name,
      affectedWards: corridor.downstreamNode.vulnerableWards,
      broadcastMessage: state.bilingualAlert?.englishScript || broadcastMessage,
      malayalamBroadcastMessage: state.bilingualAlert?.malayalamScript || '',
      capXml: state.bilingualAlert?.capXmlPacket || '',
      webhookPayload,
      status: 'PENDING'
    };
  }

  /**
   * Speak broadcast message using Web Speech API
   */
  public speakAlert(text: string) {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.volume = 1.0;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.lang.startsWith('en')));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
      };
      utterance.onend = () => {
        this.isSpeaking = false;
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
      this.isSpeaking = false;
    }
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
  }

  /**
   * Dispatch webhook to outbound AI voice agent / incident management endpoint
   */
  public async dispatchWebhook(alertId: string): Promise<{ success: boolean; responseCode: number; receiptId: string }> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return { success: false, responseCode: 404, receiptId: '' };

    // Simulate real webhook round-trip with high fidelity
    await new Promise(resolve => setTimeout(resolve, 800));

    alert.status = 'DISPATCHED';
    alert.dispatchedAt = new Date().toLocaleTimeString();
    this.notify();

    const receiptId = `ACK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    return {
      success: true,
      responseCode: 202,
      receiptId
    };
  }

  public getAlerts(): DispatchVoiceAlert[] {
    return [...this.alerts];
  }

  public dismissAlert(alertId: string) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.notify();
  }
}

export const voiceDispatchEngine = VoiceDispatchEngine.getInstance();
