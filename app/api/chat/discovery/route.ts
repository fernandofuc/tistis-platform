import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
    const { messages } = await req.json();

    console.log('📨 Chat request received:', { messageCount: messages.length });

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY no está configurada');
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY no está configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Iniciando stream con Claude...');

    // Crear stream con Anthropic
    const stream = await anthropic.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: DISCOVERY_SYSTEM_PROMPT,
      messages: messages as any,
    });

    // Convertir el stream de Anthropic a un ReadableStream web
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
          console.log('✅ Stream completado exitosamente');
        } catch (streamError) {
          console.error('❌ Error en stream:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
