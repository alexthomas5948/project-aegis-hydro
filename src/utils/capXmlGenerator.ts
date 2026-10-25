import type {
  BilingualBroadcastScript,
  CorridorTelemetryState,
  HydrologicalCorridor
} from '../types/hydrology';

/**
 * Generates an official ITU/NDMA Common Alerting Protocol (CAP v1.2) XML packet
 * along with bilingual (English + Malayalam) emergency voice scripts.
 */
export function generateBilingualAlertAndCAPXml(
  corridor: HydrologicalCorridor,
  state: CorridorTelemetryState
): BilingualBroadcastScript {
  const alertId = `AEGIS-KL-CAP-${corridor.id.toUpperCase()}-${Date.now()}`;
  const now = new Date();
  const sentIso = now.toISOString();
  const etaHours = Math.floor(state.physics.floodCrestEtaMinutes / 60);
  const etaMins = state.physics.floodCrestEtaMinutes % 60;
  const etaString = etaHours > 0 ? `${etaHours} hours ${etaMins} minutes` : `${etaMins} minutes`;
  const etaMalayalam = etaHours > 0 ? `${etaHours} മണിക്കൂർ ${etaMins} മിനിറ്റ്` : `${etaMins} മിനിറ്റ്`;

  const fos = state.physics.factorOfSafety;
  const discharge = state.downstream.dischargeM3s;
  const town = corridor.downstreamNode.name;
  const wards = corridor.downstreamNode.vulnerableWards.slice(0, 3).join(', ');

  // 1. English Broadcast Script
  const englishScript = `AEGIS-COMMAND PRIORITY 1 RED ALERT for ${corridor.name}. ` +
    `Upstream highland slope at ${corridor.upstreamNode.name} has breached stability threshold with Infinite Slope Factor of Safety ${fos}. ` +
    `Downstream flood wave at ${town} is surging at ${discharge} cubic meters per second. ` +
    `Peak flood wave arrival estimated in ${etaString} at ${state.physics.floodCrestClockTime}. ` +
    `Immediate Stage-3 evacuation ordered for riparian wards: ${wards}. Move to designated high-ground relief centers immediately.`;

  // 2. Malayalam Vernacular Broadcast Script (Official Kerala SDMA Format)
  const malayalamScript = `അടിയന്തര ദുരന്ത നിവാരണ മുന്നറിയിപ്പ്! ${corridor.name} തടത്തിൽ അതീവ ജാഗ്രതാ നിർദ്ദേശം. ` +
    `${corridor.upstreamNode.name} മേഖലയിലെ മലഞ്ചെരുവിൽ മണ്ണിടിച്ചിൽ സാധ്യത ഘടകം ${fos} ആയി കുറഞ്ഞു. ` +
    `${town} ഭാഗത്തേക്ക് നദിയിൽ ഒഴുക്ക് സെക്കൻഡിൽ ${discharge} ക്യുബിക് മീറ്ററായി ഉയർന്നു. ` +
    `അടുത്ത ${etaMalayalam}നുള്ളിൽ പ്രളയ ജലനിരപ്പ് അപകടകരമായ നിലയിലെത്തും. ` +
    `${wards} പ്രദേശങ്ങളിലെ തീരവാസികൾ ഉടൻ തന്നെ സുരക്ഷിത ദുരിതാശ്വാസ ക്യാമ്പുകളിലേക്ക് മാറുക.`;

  // 3. Phonetic Speech Synthesis Prompt
  const phoneticAudioPrompt = englishScript;

  // 4. ITU / NDMA Common Alerting Protocol (CAP v1.2) XML Schema
  const capXmlPacket = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${alertId}</identifier>
  <sender>seoc.ksdma@kerala.gov.in</sender>
  <sent>${sentIso}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <code>NDMA-CAP-V1.2</code>
  <code>AEGIS-AUTONOMOUS-C2</code>

  <!-- ENGLISH SEGMENT -->
  <info>
    <language>en-IN</language>
    <category>Met</category>
    <event>Flash Flood and Debris Flow Wave</event>
    <urgency>Immediate</urgency>
    <severity>Extreme</severity>
    <certainty>Observed</certainty>
    <eventCode>
      <valueName>IMD-Phenomena</valueName>
      <value>FLASH_FLOOD_LANDSLIDE_BREACH</value>
    </eventCode>
    <headline>CRITICAL RED FLOOD &amp; LANDSLIDE WARNING: ${corridor.name.toUpperCase()}</headline>
    <description>${englishScript.replace(/&/g, '&amp;')}</description>
    <instruction>Evacuate riparian lowlands immediately. Do not cross submerged bridges. Follow Incident Commander instructions.</instruction>
    <parameter>
      <valueName>InfiniteSlopeFactorOfSafety</valueName>
      <value>${fos}</value>
    </parameter>
    <parameter>
      <valueName>DownstreamDischargeM3s</valueName>
      <value>${discharge}</value>
    </parameter>
    <parameter>
      <valueName>FloodCrestEtaMinutes</valueName>
      <value>${state.physics.floodCrestEtaMinutes}</value>
    </parameter>
    <parameter>
      <valueName>DynamicRiskIndex</valueName>
      <value>${state.physics.dynamicRiskIndex}</value>
    </parameter>
    <parameter>
      <valueName>InundationRadiusKm</valueName>
      <value>${state.downstream.inundationRadiusKm}</value>
    </parameter>
    <area>
      <areaDesc>${corridor.downstreamNode.district} - ${corridor.downstreamNode.name}</areaDesc>
      <circle>${corridor.downstreamNode.lat},${corridor.downstreamNode.lon},${state.downstream.inundationRadiusKm}</circle>
    </area>
  </info>

  <!-- MALAYALAM VERNACULAR SEGMENT -->
  <info>
    <language>ml-IN</language>
    <category>Met</category>
    <event>തീവ്ര പ്രളയവും മലവെള്ളപ്പാച്ചിൽ മുന്നറിയിപ്പും</event>
    <urgency>Immediate</urgency>
    <severity>Extreme</severity>
    <certainty>Observed</certainty>
    <headline>അതീവ ജാഗ്രതാ നിർദ്ദേശം: ${corridor.name}</headline>
    <description>${malayalamScript.replace(/&/g, '&amp;')}</description>
    <instruction>തീരപ്രദേശങ്ങളിൽ നിന്ന് ഉടൻ സുരക്ഷിത ക്യാമ്പുകളിലേക്ക് മാറുക. പാലങ്ങളിലൂടെയുള്ള യാത്ര ഒഴിവാക്കുക.</instruction>
    <area>
      <areaDesc>${corridor.downstreamNode.district} ജില്ല - ${corridor.downstreamNode.name}</areaDesc>
      <circle>${corridor.downstreamNode.lat},${corridor.downstreamNode.lon},${state.downstream.inundationRadiusKm}</circle>
    </area>
  </info>
</alert>`;

  return {
    englishScript,
    malayalamScript,
    phoneticAudioPrompt,
    capXmlPacket
  };
}
