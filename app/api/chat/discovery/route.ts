import { NextRequest, NextResponse } from 'next/server';
import { sendDiscoveryMessage } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Llamar a Claude API
    const response = await sendDiscoveryMessage(messages);

    // Verificar si la IA completó el análisis (detectar JSON)
    let analysis = null;
    if (response.includes('ANALYSIS_COMPLETE::')) {
      try {
        const jsonStr = response.split('ANALYSIS_COMPLETE::')[1];
        analysis = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Error parsing analysis JSON:', e);
      }
    }

    return NextResponse.json({
      message: response,
      analysis: analysis
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);

    return NextResponse.json(
      { error: 'Error processing chat message', details: error.message },
      { status: 500 }
    );
  }
}
