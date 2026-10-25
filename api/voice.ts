import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless ElevenLabs AI Emergency Voice Dispatch Gateway
 * Locks the ElevenLabs API key on the server, streaming authentic broadcast audio.
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

  const { text, voiceId: customVoiceId } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid text parameter.' });
  }

  // Server-side locked ElevenLabs credentials
  const apiKey = process.env.ELEVENLABS_API_KEY || 'sk_40719fbd6b76aa2225310a5f07c72c2e5c4f095511607fcb';

  // Adam (pNInz6obpgDQGcFmaJgB) is the authoritative deep-voiced emergency broadcaster
  const voiceId = customVoiceId || 'pNInz6obpgDQGcFmaJgB';

  try {
    const elevenResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text.slice(0, 1000), // Limit character length for crisp emergency broadcasts
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.60,
            similarity_boost: 0.75,
            style: 0.20,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!elevenResponse.ok) {
      const errText = await elevenResponse.text();
      console.warn('[ElevenLabs API Error]', elevenResponse.status, errText);
      return res.status(elevenResponse.status).json({
        error: `ElevenLabs API error (${elevenResponse.status})`,
        details: errText
      });
    }

    const audioBuffer = await elevenResponse.arrayBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(audioBuffer));
  } catch (err: any) {
    console.error('[ElevenLabs Gateway Exception]', err);
    return res.status(500).json({
      error: 'Failed to synthesize speech via ElevenLabs gateway.',
      message: err.message || 'Internal server error'
    });
  }
}
