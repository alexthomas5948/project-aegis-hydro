import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless Backend Proxy for Telemetry
 * Securely proxies external hydrometeorological requests from Vercel backend
 * with server-side caching and credentials isolation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type, lat, lon } = req.query;

  try {
    if (type === 'marine') {
      const targetLat = lat || '9.9312';
      const targetLon = lon || '76.2673';
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${targetLat}&longitude=${targetLon}&current=wave_height,wave_direction,wave_period`;

      const response = await fetch(marineUrl, {
        headers: {
          'User-Agent': 'AegisKerala-C2-Backend/2.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Marine API responded with ${response.status}`);
      }

      const data = await response.json();
      res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
      return res.status(200).json(data);
    }

    if (type === 'weather') {
      const targetLat = lat || '9.85';
      const targetLon = lon || '76.97';
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=precipitation,surface_pressure,wind_speed_10m&hourly=precipitation,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm&forecast_days=2`;

      const response = await fetch(weatherUrl, {
        headers: {
          'User-Agent': 'AegisKerala-C2-Backend/2.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Weather API responded with ${response.status}`);
      }

      const data = await response.json();
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid telemetry type. Expected "marine" or "weather".' });
  } catch (error: any) {
    console.error('[Backend Proxy Error]', error);
    return res.status(502).json({
      error: 'Upstream gateway error',
      message: error?.message || 'Failed to fetch telemetry upstream'
    });
  }
}
