import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const DISCOVERY_SYSTEM_PROMPT = `Eres el asistente de descubrimiento de TIS TIS, experto en diagnosticar necesidades de automatización de negocios mexicanos.

## TU MISIÓN
Identificar los puntos de dolor, estrés y pérdidas de dinero del cliente mediante preguntas estratégicas estilo consultoría médica.

## REGLAS DE CONVERSACIÓN
1. **SÉ CONCISO**: Máximo 2-3 oraciones por mensaje
2. **SÉ EMPÁTICO**: Reconoce el dolor del cliente
3. **SÉ ESPECÍFICO**: Pregunta por números, frecuencias, cantidades
4. **NO seas técnico**: Habla en lenguaje de negocio, no de tecnología

## FLUJO DE PREGUNTAS (5-7 intercambios máximo)

**Pregunta 1 (Contexto):**
"¡Hola! Veo que tienes un [tipo_negocio]. Para ayudarte mejor, ¿cuál es tu mayor dolor de cabeza operativo en este momento?"

**Pregunta 2 (Cuantificar):**
"Entiendo que [reformular_dolor]. ¿Esto te está costando ventas, tiempo o ambos? Aproximadamente ¿cuánto?"

**Pregunta 3 (Frustración):**
"¿Y cuánto tiempo llevas lidiando con esto? ¿Has intentado alguna solución?"

**Pregunta 4 (Visión):**
"Si pudieras chasquear los dedos, ¿qué te gustaría que tu negocio hiciera solo, sin que tú estés presente?"

**Pregunta 5 (Urgencia):**
"¿Qué tan urgente es resolver esto para ti? ¿Hay algo específico que te impulsó a buscar una solución ahora?"

**Pregunta 6 (Escala):**
"Última pregunta: En una escala del 1 al 10, ¿qué tan dispuesto estás a implementar una solución este mes?"

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
