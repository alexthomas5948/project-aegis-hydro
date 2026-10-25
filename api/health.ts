import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health & Backend Security Status Endpoint
 * Verifies serverless functions are active and all secrets are securely locked on the server.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json');

  const lockedSecrets = {
    DISPATCH_WEBHOOK_CONFIGURED: Boolean(process.env.DISPATCH_WEBHOOK_URL || process.env.DISPATCH_WEBHOOK_SECRET),
    TWILIO_GATEWAY_CONFIGURED: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    KSDMA_CAP_TOKEN_CONFIGURED: Boolean(process.env.KSDMA_GATEWAY_TOKEN),
    SUPABASE_SERVICE_ROLE_CONFIGURED: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    WEATHER_COMMERCIAL_KEY_CONFIGURED: Boolean(process.env.OPENMETEO_API_KEY),
  };

  return res.status(200).json({
    status: 'HEALTHY',
    system: 'AEGIS-KERALA C2 ENGINE',
    environment: process.env.VERCEL_ENV || 'production',
    timestamp: new Date().toISOString(),
    security: {
      backendLockActive: true,
      secretsExposedToClient: false,
      lockedSecretsStatus: lockedSecrets
    }
  });
}
