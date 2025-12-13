import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';

export const runtime = 'edge';

// OpenAI client para GPT-5 Nano (Chat Discovery)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Create Supabase client lazily to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Parse AI analysis from response
function parseAIAnalysis(content: string): any | null {
  const analysisMatch = content.match(/ANALYSIS_COMPLETE::({[\s\S]*})/);
  if (analysisMatch) {
    try {
      return JSON.parse(analysisMatch[1]);
    } catch (e) {
      console.error('Error parsing AI analysis:', e);
      return null;
    }
  }
  return null;
}

const DISCOVERY_SYSTEM_PROMPT = `Eres un consultor de negocios de TIS TIS, especializado en identificar ineficiencias operativas y puntos de dolor en empresas.

## TU MISIÓN
Diagnosticar los problemas operativos más críticos del negocio mediante preguntas estratégicas y directas, cuantificando el impacto real en dinero y tiempo.

## REGLAS DE CONVERSACIÓN
1. **SÉ DIRECTO Y PROFESIONAL**: Máximo 2-3 oraciones por mensaje, sin emojis ni lenguaje informal
2. **CUANTIFICA TODO**: Pregunta siempre por números, costos, horas perdidas, impacto financiero
3. **SÉ EMPÁTICO PERO FIRME**: Reconoce el dolor pero mantén el enfoque en soluciones medibles
4. **HABLA COMO CONSULTOR DE NEGOCIO**: Usa lenguaje ejecutivo, no técnico ni amigable

## FLUJO DE DESCUBRIMIENTO (5-7 intercambios)

**Pregunta 1 (Identificación del problema principal):**
"Entiendo que tienes un [tipo_negocio]. ¿Cuál es el problema operativo que más dinero te está costando ahora mismo?"

**Pregunta 2 (Cuantificación del impacto):**
"[Reformular problema]. ¿Cuánto te está costando esto mensualmente en ventas perdidas, tiempo desperdiciado o recursos mal utilizados? Dame cifras aproximadas."

**Pregunta 3 (Duración y soluciones intentadas):**
"¿Cuánto tiempo llevas con este problema? ¿Qué soluciones has intentado implementar y por qué no funcionaron?"

**Pregunta 4 (Visión de automatización):**
"Si este problema desapareciera mañana, ¿qué procesos específicos de tu negocio querrías que funcionaran sin tu intervención directa?"

**Pregunta 5 (Urgencia y motivación):**
"En una escala del 1 al 10, ¿qué tan urgente es resolver esto? ¿Qué te motivó a buscar una solución justo ahora?"

**Pregunta 6 (Capacidad de implementación):**
"¿Qué tan dispuesto estás a implementar cambios operativos en las próximas 2-4 semanas para resolver esto definitivamente?"

## OUTPUT FINAL
Después de 5-7 intercambios, cuando tengas suficiente información, genera un JSON con el prefijo "ANALYSIS_COMPLETE::" seguido de:

ANALYSIS_COMPLETE::{
  "business_type": "restaurante|retail|clinica|farmacia|industrial|otro",
  "primary_pain": "string",
  "financial_impact": number (estimado mensual en MXN),
  "time_impact": number (horas semanales perdidas),
  "urgency_score": 1-10,
  "recommended_plan": "starter|essentials|growth|scale",
  "recommended_addons": ["addon_id"],
  "recommended_especialidad": "restaurante|retail|salud|industrial|null",
  "reasoning": "Por qué recomendaste este plan (2-3 oraciones)"
}

Envía este JSON cuando detectes que tienes suficiente información para hacer una recomendación sólida.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionToken } = await req.json();

    console.log('📨 Chat request received:', { messageCount: messages.length, sessionToken });

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY no está configurada');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY no está configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Iniciando llamada a GPT-5 Nano (Discovery)...');
    console.log('📝 Messages enviados:', JSON.stringify(messages, null, 2));

    // Usar GPT-5 Nano para chat discovery (ultra rapido y economico)
    const response_ai = await openai.chat.completions.create({
      model: DEFAULT_MODELS.CHAT_DISCOVERY, // gpt-5-nano
      max_tokens: OPENAI_CONFIG.defaultMaxTokens,
      temperature: OPENAI_CONFIG.defaultTemperature,
      messages: [
        { role: 'system', content: DISCOVERY_SYSTEM_PROMPT },
        ...messages,
      ],
    });

    console.log('✅ Respuesta de GPT-5 Nano recibida');

    // Extraer texto de la respuesta
    const accumulatedText = response_ai.choices[0]?.message?.content || '';

    console.log(`✅ Texto extraído: ${accumulatedText.length} chars`);
    console.log('📄 Contenido:', accumulatedText.substring(0, 200));
    console.log('💰 Tokens usados:', response_ai.usage);

    // Save to database if sessionToken provided
    if (sessionToken && accumulatedText) {
      try {
        // Build conversation history with the new assistant message
        const updatedHistory = [
          ...messages,
          { role: 'assistant', content: accumulatedText }
        ];

        // Check if analysis is complete
        const aiAnalysis = parseAIAnalysis(accumulatedText);
        const isComplete = aiAnalysis !== null;

        // Update or create session
        const supabase = getSupabaseClient();
        const { data: existingSession } = await supabase
          .from('discovery_sessions')
          .select('id')
          .eq('session_token', sessionToken)
          .single();

        if (existingSession) {
          // Update existing session
          await supabase
            .from('discovery_sessions')
            .update({
              conversation_history: updatedHistory,
              ai_analysis: aiAnalysis,
              status: isComplete ? 'completed' : 'active',
              completed_at: isComplete ? new Date().toISOString() : null,
              business_type: aiAnalysis?.business_type || null,
              updated_at: new Date().toISOString(),
            })
            .eq('session_token', sessionToken);
        } else {
          // Create new session
          await supabase
            .from('discovery_sessions')
            .insert({
              session_token: sessionToken,
              conversation_history: updatedHistory,
              ai_analysis: aiAnalysis,
              status: isComplete ? 'completed' : 'active',
              completed_at: isComplete ? new Date().toISOString() : null,
              business_type: aiAnalysis?.business_type || null,
            });
        }

        console.log('💾 Session saved to database:', { sessionToken, isComplete });
      } catch (dbError) {
        console.error('❌ Error saving to database:', dbError);
        // Don't fail the request if DB save fails
      }
    }

    // Retornar el texto
    const encoder = new TextEncoder();
    const textBuffer = encoder.encode(accumulatedText);

    return new Response(textBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('❌ API Route Error:', error);
    console.error('Stack trace:', error.stack);

    return new Response(
      JSON.stringify({
        error: error.message || 'Error desconocido',
        details: error.toString(),
        type: error.constructor.name
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
