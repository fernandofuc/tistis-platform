import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';

export const runtime = 'edge';

// OpenAI client para Chat Discovery
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

// Tipos de negocio soportados
type BusinessType = 'dental' | 'restaurant' | 'otro';

// Interface para el análisis de la IA
interface AIAnalysis {
  business_type: BusinessType;
  business_subtype?: string;
  primary_pain: string;
  financial_impact: number;
  time_impact: number;
  urgency_score: number;
  recommended_plan: 'starter' | 'essentials' | 'growth' | 'enterprise';
  requires_consultation: boolean;
  reasoning: string;
  contact_info?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
}

// Parse AI analysis from response
function parseAIAnalysis(content: string): AIAnalysis | null {
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

// System prompt profesional - Estilo consultor ejecutivo
const DISCOVERY_SYSTEM_PROMPT = `Eres un consultor senior de negocios de TIS TIS. Tu rol es diagnosticar con precision los problemas operativos de empresas y determinar si podemos ayudarles.

## VERTICALES QUE ATENDEMOS

Solo trabajamos con tres tipos de negocio:
1. **Clinica Dental** - Consultorios, clinicas dentales, ortodoncistas
2. **Restaurante** - Restaurantes, cafeterias, bares, dark kitchens
3. **Otro** - Cualquier otro tipo de negocio (requiere evaluacion personalizada)

## TU MISION

Identificar rapidamente:
1. El tipo de negocio del prospecto
2. Sus problemas operativos criticos
3. El impacto financiero de esos problemas
4. Si somos la solucion correcta para ellos

## REGLAS DE COMUNICACION

- Respuestas concisas: 2-3 oraciones maximo
- Tono ejecutivo y profesional
- Sin emojis ni lenguaje coloquial
- Enfocado en numeros y resultados
- Empatico pero directo

## FLUJO DE CONVERSACION

**PASO 1 - Identificacion del negocio:**
Pregunta que tipo de negocio tiene. Clasifica internamente como: dental, restaurant, u otro.

**PASO 2 - Problema principal:**
Identifica el problema operativo que mas le esta costando dinero o tiempo.

**PASO 3 - Cuantificacion:**
Obtiene numeros concretos: cuanto dinero pierde, cuantas horas desperdicia, cuantos clientes no atiende.

**PASO 4 - Contexto:**
Pregunta sobre numero de sucursales, empleados, y sistemas actuales que usa.

**PASO 5 - Urgencia:**
Evalua que tan critico es resolver esto para el negocio.

## MANEJO SEGUN TIPO DE NEGOCIO

### Si es CLINICA DENTAL o RESTAURANTE:
- Profundiza en sus problemas especificos
- Cuantifica el impacto financiero
- Al tener suficiente informacion (4-6 intercambios), genera el analisis

### Si es OTRO tipo de negocio:
- Escucha sus problemas con atencion
- Recopila informacion de contacto (nombre, email, telefono, empresa)
- Explica que evaluaremos su caso personalmente
- Genera analisis con requires_consultation: true

## ANALISIS FINAL

Cuando tengas suficiente informacion, genera un JSON con el prefijo exacto "ANALYSIS_COMPLETE::" seguido de:

ANALYSIS_COMPLETE::{
  "business_type": "dental|restaurant|otro",
  "business_subtype": "descripcion especifica si aplica",
  "primary_pain": "problema principal identificado",
  "financial_impact": numero_en_pesos_mensuales,
  "time_impact": horas_semanales_perdidas,
  "urgency_score": 1-10,
  "recommended_plan": "starter|essentials|growth|enterprise",
  "requires_consultation": true_si_es_otro_o_caso_complejo,
  "reasoning": "explicacion breve de tu recomendacion",
  "contact_info": {
    "name": "nombre si lo proporcionaron",
    "email": "email si lo proporcionaron",
    "phone": "telefono si lo proporcionaron",
    "company": "nombre de empresa si lo proporcionaron"
  }
}

## RECOMENDACION DE PLANES

- **Starter**: 1 sucursal, operacion simple, menos de $50,000 MXN impacto mensual
- **Essentials**: 2-3 sucursales, operacion moderada, $50,000-$150,000 MXN impacto
- **Growth**: 4-8 sucursales, operacion compleja, $150,000-$500,000 MXN impacto
- **Enterprise**: +8 sucursales o casos que requieren evaluacion personalizada

## IMPORTANTE

- Nunca menciones el JSON al usuario, solo generalo silenciosamente cuando corresponda
- Si el negocio es "otro", SIEMPRE marca requires_consultation: true
- Mantén la conversacion natural y profesional
- Si el usuario no responde con claridad, reformula la pregunta`;

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionToken } = await req.json();

    console.log('Chat Discovery request:', { messageCount: messages.length, sessionToken });

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY no configurada');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Llamada a la IA
    const response_ai = await openai.chat.completions.create({
      model: DEFAULT_MODELS.CHAT_DISCOVERY,
      max_tokens: OPENAI_CONFIG.defaultMaxTokens,
      temperature: OPENAI_CONFIG.defaultTemperature,
      messages: [
        { role: 'system', content: DISCOVERY_SYSTEM_PROMPT },
        ...messages,
      ],
    });

    const accumulatedText = response_ai.choices[0]?.message?.content || '';

    console.log('AI Response:', accumulatedText.substring(0, 200));
    console.log('Tokens used:', response_ai.usage);

    // Guardar en base de datos
    if (sessionToken && accumulatedText) {
      try {
        const updatedHistory = [
          ...messages,
          { role: 'assistant', content: accumulatedText }
        ];

        const aiAnalysis = parseAIAnalysis(accumulatedText);
        const isComplete = aiAnalysis !== null;

        const supabase = getSupabaseClient();
        const { data: existingSession } = await supabase
          .from('discovery_sessions')
          .select('id')
          .eq('session_token', sessionToken)
          .single();

        const sessionData = {
          conversation_history: updatedHistory,
          ai_analysis: aiAnalysis,
          status: isComplete ? 'completed' : 'active',
          completed_at: isComplete ? new Date().toISOString() : null,
          business_type: aiAnalysis?.business_type || null,
          updated_at: new Date().toISOString(),
        };

        if (existingSession) {
          await supabase
            .from('discovery_sessions')
            .update(sessionData)
            .eq('session_token', sessionToken);
        } else {
          await supabase
            .from('discovery_sessions')
            .insert({
              session_token: sessionToken,
              ...sessionData,
            });
        }

        console.log('Session saved:', { sessionToken, isComplete, businessType: aiAnalysis?.business_type });
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Retornar respuesta
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
    console.error('API Route Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Error desconocido',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
