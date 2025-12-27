import { NextRequest, NextResponse } from 'next/server';
import { AVAILABLE_VOICES, VOICE_PREVIEW_TEXT } from '@/src/features/voice-agent/types';
import { rateLimit, createRateLimitResponse, getClientIdentifier } from '@/src/shared/lib/rate-limiter';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/voice-agent/preview
 *
 * Generates a voice preview using ElevenLabs API.
 * If no API key is configured, returns a fallback response.
 *
 * Body: { voice_id: string, text?: string }
 * Returns: { audio_url: string } or audio stream
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent abuse of ElevenLabs API credits (5 per minute)
    const clientId = getClientIdentifier(request);
    const rateLimitResult = rateLimit(`voice-preview:${clientId}`, { limit: 5, windowSizeInSeconds: 60 });
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    const { voice_id, text = VOICE_PREVIEW_TEXT } = body;

    if (!voice_id) {
      return NextResponse.json(
        { error: 'voice_id is required' },
        { status: 400 }
      );
    }

    // Validate voice_id is from our available voices
    const voice = AVAILABLE_VOICES.find(v => v.id === voice_id);
    if (!voice) {
      return NextResponse.json(
        { error: 'Invalid voice_id' },
        { status: 400 }
      );
    }

    // Check if ElevenLabs API key is configured
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      // Return a message indicating preview is not available
      // In production, you should configure ELEVENLABS_API_KEY
      console.log('[Voice Preview] ElevenLabs API key not configured, returning fallback');
      return NextResponse.json({
        success: false,
        message: 'Voice preview requires ElevenLabs API key configuration',
        voice_name: voice.name,
        voice_description: voice.description,
      });
    }

    // Generate audio using ElevenLabs Text-to-Speech API
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('[Voice Preview] ElevenLabs API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate voice preview' },
        { status: 500 }
      );
    }

    // Return the audio stream
    const audioBuffer = await elevenLabsResponse.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('[Voice Preview] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice-agent/preview?voice_id=xxx
 *
 * Returns voice info and a sample audio URL if available.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('voice_id');

  if (!voiceId) {
    return NextResponse.json(
      { error: 'voice_id query parameter is required' },
      { status: 400 }
    );
  }

  const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
  if (!voice) {
    return NextResponse.json(
      { error: 'Voice not found' },
      { status: 404 }
    );
  }

  // Check if we have API key configured
  const hasApiKey = !!process.env.ELEVENLABS_API_KEY;

  return NextResponse.json({
    success: true,
    voice: {
      id: voice.id,
      name: voice.name,
      gender: voice.gender,
      accent: voice.accent,
      description: voice.description,
      provider: voice.provider,
    },
    preview_available: hasApiKey,
    preview_endpoint: hasApiKey ? `/api/voice-agent/preview` : null,
  });
}
