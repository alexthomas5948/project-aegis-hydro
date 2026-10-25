import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless Emergency Voice Dispatch & CAP v1.2 Gateway
 * Locks all external webhook tokens, API keys, and signing credentials on the server.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. POST required.' });
  }

  const { alertId, corridorId, hazardTier, capXml, webhookPayload } = req.body || {};

  if (!corridorId || !capXml) {
    return res.status(400).json({ error: 'Missing required dispatch parameters (corridorId, capXml).' });
  }

  // Server-side locked credentials
  const webhookUrl = process.env.DISPATCH_WEBHOOK_URL;
  const webhookSecret = process.env.DISPATCH_WEBHOOK_SECRET;

  let outboundDelivered = false;
  let externalStatus = 'LOCAL_SIMULATED_DISPATCH';

  // If a real webhook endpoint is configured in Vercel environment variables, forward with signature
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Aegis-Secret': webhookSecret || '',
          'User-Agent': 'AegisKerala-Secure-Dispatch/1.0'
        },
        body: JSON.stringify({
          alertId,
          corridorId,
          hazardTier,
          capXml,
          webhookPayload,
          dispatchedAt: new Date().toISOString()
        })
      });

      outboundDelivered = response.ok;
      externalStatus = response.ok ? 'DELIVERED_TO_EXTERNAL_GATEWAY' : `GATEWAY_HTTP_${response.status}`;
    } catch (err: any) {
      console.warn('[Dispatch Backend Error]', err);
      externalStatus = 'GATEWAY_CONNECTION_FAILED';
    }
  }

  return res.status(200).json({
    success: true,
    dispatchId: `DISPATCH-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    corridorId,
    hazardTier,
    externalStatus,
    outboundDelivered,
    capStandard: 'ITU/NDMA CAP v1.2',
    timestamp: new Date().toISOString(),
    lockedBackendActive: true
  });
}
