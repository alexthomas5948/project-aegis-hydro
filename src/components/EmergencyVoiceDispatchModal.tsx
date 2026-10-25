import React, { useState } from 'react';
import type { DispatchVoiceAlert } from '../types/hydrology';
import { voiceDispatchEngine } from '../services/voiceDispatchEngine';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileCode,
  Globe,
  Mic,
  PhoneCall,
  Radio,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';

interface EmergencyVoiceDispatchModalProps {
  alert: DispatchVoiceAlert | null;
  onClose: () => void;
}

export const EmergencyVoiceDispatchModal: React.FC<EmergencyVoiceDispatchModalProps> = ({
  alert,
  onClose
}) => {
  const [selectedLang, setSelectedLang] = useState<'english' | 'malayalam'>('english');
  const [activePayloadTab, setActivePayloadTab] = useState<'capXml' | 'webhook'>('capXml');
  const [isCopied, setIsCopied] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(voiceDispatchEngine.getIsMuted());

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!alert) return null;

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    voiceDispatchEngine.setMuted(nextMuted);
  };

  const handleReplayVoice = () => {
    const textToSpeak = selectedLang === 'malayalam' && alert.malayalamBroadcastMessage
      ? alert.malayalamBroadcastMessage
      : alert.broadcastMessage;
    voiceDispatchEngine.speakAlert(textToSpeak);
  };

  const handleStopVoice = () => {
    voiceDispatchEngine.stopSpeaking();
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadCAPXml = () => {
    const dataStr = 'data:text/xml;charset=utf-8,' + encodeURIComponent(alert.capXml || '');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${alert.id}-NDMA-CAP-v1.2.xml`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDispatchOutboundCall = async () => {
    setIsDispatching(true);
    try {
      const res = await voiceDispatchEngine.dispatchWebhook(alert.id);
      if (res.success) {
        setDispatchReceipt(res.receiptId);
      }
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl glass-panel rounded-xl border border-red-500/60 shadow-2xl p-5 overflow-hidden scanline-effect text-slate-200 glow-red"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-red-500/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-red-950 border border-red-500 text-red-400 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white rounded uppercase tracking-wider">
                  PRIORITY 1 // RED EMERGENCY
                </span>
                <span className="text-xs font-mono text-red-400 font-bold">
                  {alert.id}
                </span>
              </div>
              <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide mt-0.5">
                BILINGUAL VOICE DISPATCH &amp; ITU/NDMA CAP v1.2 CONSOLE
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Broadcast Panel with Language Switcher */}
        <div className="my-3.5 p-3.5 rounded-lg bg-red-950/40 border border-red-500/50 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-400 animate-ping" />
              <span className="text-xs font-mono font-bold text-red-300 uppercase tracking-wider">
                SYNTHESIZED EMERGENCY VOICE BROADCAST
              </span>
            </div>

            {/* Language Toggle & Controls */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <div className="bg-[#060a12] p-0.5 rounded border border-red-800 flex items-center">
                <button
                  onClick={() => setSelectedLang('english')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    selectedLang === 'english' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ENGLISH
                </button>
                <button
                  onClick={() => setSelectedLang('malayalam')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    selectedLang === 'malayalam' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  മലയാളം (MALAYALAM)
                </button>
              </div>

              <button
                onClick={handleToggleMute}
                className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                onClick={handleReplayVoice}
                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1 shadow-sm"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>SPEAK</span>
              </button>

              <button
                onClick={handleStopVoice}
                className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                STOP
              </button>
            </div>
          </div>

          {/* Broadcast Transcript Box */}
          <div className="p-3 bg-[#060a12] rounded border border-red-900/60 font-mono text-xs text-red-200 leading-relaxed min-h-[56px]">
            {selectedLang === 'malayalam' ? (
              <span className="font-sans leading-loose text-[13px] text-amber-200">
                "{alert.malayalamBroadcastMessage || alert.broadcastMessage}"
              </span>
            ) : (
              <span>"{alert.broadcastMessage}"</span>
            )}
          </div>
        </div>

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs font-mono">
          <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase">DYNAMIC RISK INDEX</div>
            <div className="text-xl font-rajdhani font-bold text-red-400">
              {Math.max(alert.hazardTier === 'CRITICAL' || alert.fos <= 1.05 ? 86 : alert.dri, alert.dri)} / 100
            </div>
          </div>
          <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase">SLOPE STABILITY FoS</div>
            <div className="text-xl font-rajdhani font-bold text-red-400">
              {(typeof alert.fos === 'number' ? alert.fos : Number(alert.fos)).toFixed(2)} (CRITICAL)
            </div>
          </div>
          <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase">CREST ARRIVAL ETA</div>
            <div className="text-xl font-rajdhani font-bold text-amber-400">{alert.etaString}</div>
          </div>
          <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase">IMPACT TARGET</div>
            <div className="text-sm font-rajdhani font-bold text-white truncate">{alert.targetTown}</div>
          </div>
        </div>

        {/* Protocol Payloads: CAP v1.2 XML & Webhook JSON */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-xs font-mono">
            {/* Tab switch between CAP XML and Webhook JSON */}
            <div className="flex items-center gap-1 bg-[#060a12] p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setActivePayloadTab('capXml')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  activePayloadTab === 'capXml' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>NDMA / ITU CAP v1.2 XML</span>
              </button>
              <button
                onClick={() => setActivePayloadTab('webhook')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  activePayloadTab === 'webhook' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>REST WEBHOOK JSON</span>
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(activePayloadTab === 'capXml' ? alert.capXml : JSON.stringify(alert.webhookPayload, null, 2))}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-mono flex items-center gap-1 border border-slate-700 transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>{isCopied ? 'COPIED' : 'COPY'}</span>
              </button>

              {activePayloadTab === 'capXml' && (
                <button
                  onClick={handleDownloadCAPXml}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-mono flex items-center gap-1 border border-slate-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>DOWNLOAD .XML</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto p-2.5 rounded-lg bg-[#050811] border border-slate-800 font-mono text-[10px] text-cyan-300">
            <pre>
              {activePayloadTab === 'capXml'
                ? alert.capXml
                : JSON.stringify(alert.webhookPayload, null, 2)}
            </pre>
          </div>
        </div>

        {/* Outbound AI Voice Dispatch Action */}
        <div className="pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            {dispatchReceipt ? (
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Bilingual Dispatch Disseminated! Receipt: <strong>{dispatchReceipt}</strong> (Status 202 Accepted)</span>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-slate-400">
                Uplinks official CAP v1.2 to KSDMA SEOC and initiates automated AI voice calls to incident commanders.
              </div>
            )}
          </div>

          <button
            onClick={handleDispatchOutboundCall}
            disabled={isDispatching}
            className={`px-4 py-1.5 rounded-lg font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
              dispatchReceipt
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            }`}
          >
            {isDispatching ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>BROADCASTING BILINGUAL C2...</span>
              </>
            ) : dispatchReceipt ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>DISPATCH LOGGED &amp; TRANSMITTED</span>
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4" />
                <span>DISPATCH BILINGUAL VOICE &amp; CAP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
