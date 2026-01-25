# FASE 4: Gemini Vision Integration

## Objetivo
Implementar la capacidad de analizar imágenes (fotos de menús, folletos, documentos) usando Gemini Vision para extraer información y configurar automáticamente el sistema.

---

## Casos de Uso

| Caso | Input | Output |
|------|-------|--------|
| **Menú POS** | Foto de menú impreso | Lista de platillos con precios |
| **Lista de precios** | Foto de lista de servicios | Catálogo de servicios |
| **Folleto promocional** | Imagen de promoción | Datos de promoción |
| **Documento** | PDF/imagen de políticas | FAQs extraídas |

---

## Microfases

### 4.1 Vision Service

**Archivo:** `src/features/setup-assistant/services/vision.service.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Vision Analysis Service
// Uses Gemini Vision to analyze images
// =====================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisionAnalysis } from '../types';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// =====================================================
// ANALYSIS PROMPTS BY CONTEXT
// =====================================================

const MENU_ANALYSIS_PROMPT = `Analiza esta imagen de menú de restaurante.

Extrae TODOS los platillos, bebidas y productos que puedas identificar.

Para cada item, extrae:
- Nombre del platillo/producto
- Precio (si está visible)
- Categoría (Entradas, Platos Fuertes, Bebidas, Postres, etc.)
- Descripción corta (si está visible)

Responde SOLO con JSON válido:
{
  "type": "menu",
  "confidence": 0.0-1.0,
  "description": "Breve descripción de lo que ves",
  "items": [
    {
      "name": "Nombre del platillo",
      "price": 150.00,
      "category": "Platos Fuertes",
      "description": "Descripción si está disponible"
    }
  ],
  "suggestions": ["Sugerencia 1", "Sugerencia 2"]
}`;

const SERVICES_ANALYSIS_PROMPT = `Analiza esta imagen de lista de servicios/precios.

Extrae TODOS los servicios que puedas identificar.

Para cada servicio, extrae:
- Nombre del servicio
- Precio (si está visible)
- Duración (si está indicada)
- Categoría

Responde SOLO con JSON válido:
{
  "type": "services",
  "confidence": 0.0-1.0,
  "description": "Breve descripción de lo que ves",
  "items": [
    {
      "name": "Nombre del servicio",
      "price": 500.00,
      "duration": 60,
      "category": "Tratamientos"
    }
  ],
  "suggestions": ["Sugerencia 1"]
}`;

const PROMOTION_ANALYSIS_PROMPT = `Analiza esta imagen de promoción/folleto.

Extrae la información de la promoción:
- Título de la promoción
- Descripción
- Descuento o beneficio
- Condiciones
- Fechas de vigencia (si están visibles)

Responde SOLO con JSON válido:
{
  "type": "promotion",
  "confidence": 0.0-1.0,
  "description": "Breve descripción de la promoción",
  "promotion": {
    "title": "Título",
    "description": "Descripción completa",
    "discount": "20% de descuento",
    "conditions": "Válido en compras mayores a $500",
    "validFrom": "2024-01-01",
    "validTo": "2024-01-31"
  },
  "suggestions": ["Sugerencia 1"]
}`;

const GENERAL_ANALYSIS_PROMPT = `Analiza esta imagen y extrae cualquier información útil para configurar un negocio.

Puede ser:
- Información de contacto
- Horarios de operación
- Políticas del negocio
- Cualquier dato relevante

Responde SOLO con JSON válido:
{
  "type": "general",
  "confidence": 0.0-1.0,
  "description": "Descripción de lo que ves",
  "extractedData": {
    // Datos extraídos
  },
  "suggestions": ["Sugerencia 1"]
}`;

// =====================================================
// VISION SERVICE CLASS
// =====================================================

export type AnalysisContext = 'menu' | 'services' | 'promotion' | 'general';

export interface AnalyzeImageInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType: string;
  context: AnalysisContext;
  additionalContext?: string;
}

export class VisionService {
  private static instance: VisionService;
  private model: ReturnType<typeof genAI.getGenerativeModel>;

  private constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',  // or 'gemini-pro-vision'
    });
  }

  static getInstance(): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService();
    }
    return VisionService.instance;
  }

  /**
   * Analyze an image and extract structured data
   */
  async analyzeImage(input: AnalyzeImageInput): Promise<VisionAnalysis> {
    const { imageUrl, imageBase64, mimeType, context, additionalContext } = input;

    // Get appropriate prompt
    let prompt = this.getPromptForContext(context);
    if (additionalContext) {
      prompt += `\n\nCONTEXTO ADICIONAL: ${additionalContext}`;
    }

    try {
      // Prepare image part
      let imagePart: { inlineData: { data: string; mimeType: string } };

      if (imageBase64) {
        imagePart = {
          inlineData: {
            data: imageBase64,
            mimeType,
          },
        };
      } else if (imageUrl) {
        // Fetch image and convert to base64
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        imagePart = {
          inlineData: {
            data: base64,
            mimeType,
          },
        };
      } else {
        throw new Error('Either imageUrl or imageBase64 is required');
      }

      // Generate content
      const result = await this.model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in vision response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        description: parsed.description || 'Imagen analizada',
        extractedData: this.normalizeExtractedData(parsed),
        confidence: parsed.confidence || 0.7,
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      console.error('[VisionService] Error analyzing image:', error);

      return {
        description: 'No se pudo analizar la imagen completamente',
        extractedData: {},
        confidence: 0,
        suggestions: ['Intenta con una imagen más clara', 'Asegúrate de que el texto sea legible'],
      };
    }
  }

  /**
   * Analyze menu image specifically
   */
  async analyzeMenu(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    return this.analyzeImage({
      imageUrl,
      mimeType,
      context: 'menu',
    });
  }

  /**
   * Analyze services list
   */
  async analyzeServices(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    return this.analyzeImage({
      imageUrl,
      mimeType,
      context: 'services',
    });
  }

  /**
   * Auto-detect context and analyze
   */
  async autoAnalyze(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    // First, do a quick analysis to detect type
    const detectPrompt = `Mira esta imagen y determina qué tipo de contenido es:
- "menu": Menú de restaurante con platillos y precios
- "services": Lista de servicios con precios
- "promotion": Folleto o publicidad de promoción
- "general": Otro tipo de documento

Responde SOLO con: {"type": "menu|services|promotion|general"}`;

    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const result = await this.model.generateContent([
        detectPrompt,
        {
          inlineData: {
            data: base64,
            mimeType,
          },
        },
      ]);

      const text = result.response.text();
      const match = text.match(/"type":\s*"(\w+)"/);
      const detectedType = (match?.[1] || 'general') as AnalysisContext;

      // Now do full analysis with detected context
      return this.analyzeImage({
        imageBase64: base64,
        mimeType,
        context: detectedType,
      });
    } catch (error) {
      console.error('[VisionService] Error in auto-analyze:', error);
      return this.analyzeImage({
        imageUrl,
        mimeType,
        context: 'general',
      });
    }
  }

  private getPromptForContext(context: AnalysisContext): string {
    switch (context) {
      case 'menu':
        return MENU_ANALYSIS_PROMPT;
      case 'services':
        return SERVICES_ANALYSIS_PROMPT;
      case 'promotion':
        return PROMOTION_ANALYSIS_PROMPT;
      case 'general':
      default:
        return GENERAL_ANALYSIS_PROMPT;
    }
  }

  private normalizeExtractedData(parsed: Record<string, unknown>): Record<string, unknown> {
    // Normalize different response formats into a consistent structure
    const data: Record<string, unknown> = {
      type: parsed.type,
    };

    if (parsed.items && Array.isArray(parsed.items)) {
      data.items = parsed.items;
    }

    if (parsed.promotion) {
      data.promotion = parsed.promotion;
    }

    if (parsed.extractedData) {
      Object.assign(data, parsed.extractedData);
    }

    return data;
  }
}

export const visionService = VisionService.getInstance();
```

**Criterios de aceptación:**
- [ ] Análisis de menú funciona
- [ ] Análisis de servicios funciona
- [ ] Auto-detección de contexto
- [ ] Manejo de errores

---

### 4.2 Analyze API Endpoint

**Archivo:** `app/api/setup-assistant/analyze/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Image Analysis
// POST: Analyze uploaded image with Gemini Vision
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { createServiceClient } from '@/src/shared/lib/supabase';
import { visionService, type AnalysisContext } from '@/src/features/setup-assistant/services/vision.service';
import type { AnalyzeImageRequest, AnalyzeImageResponse, UsageInfo } from '@/src/features/setup-assistant/types';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export async function POST(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId } = authResult;

  try {
    const body: AnalyzeImageRequest = await request.json();

    // Validate image URL
    if (!body.imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Check vision request limit
    const supabaseAdmin = createServiceClient();
    const { data: usageData } = await supabaseAdmin.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    const usage = usageData?.[0];
    if (usage && usage.vision_requests >= usage.vision_limit) {
      return NextResponse.json(
        {
          error: 'Daily vision analysis limit reached',
          code: 'LIMIT_REACHED',
          usage: {
            visionRequests: usage.vision_requests,
            visionLimit: usage.vision_limit,
          },
        },
        { status: 429 }
      );
    }

    // Determine context for analysis
    const context: AnalysisContext = (body.module as AnalysisContext) || 'general';

    // Perform analysis
    const analysis = await visionService.analyzeImage({
      imageUrl: body.imageUrl,
      mimeType: 'image/jpeg',  // Will be detected from URL
      context,
      additionalContext: body.context,
    });

    // Increment vision usage
    await supabaseAdmin.rpc('increment_setup_usage', {
      p_tenant_id: tenantId,
      p_vision: 1,
    });

    // Get updated usage
    const { data: updatedUsage } = await supabaseAdmin.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    const currentUsage = updatedUsage?.[0] || usage;

    const response: AnalyzeImageResponse = {
      analysis,
      usage: {
        messagesCount: currentUsage?.messages_count || 0,
        messagesLimit: currentUsage?.messages_limit || 20,
        filesUploaded: currentUsage?.files_uploaded || 0,
        filesLimit: currentUsage?.files_limit || 3,
        visionRequests: (currentUsage?.vision_requests || 0),
        visionLimit: currentUsage?.vision_limit || 2,
        planId: currentUsage?.plan_id || 'starter',
        isAtLimit: (currentUsage?.vision_requests || 0) >= (currentUsage?.vision_limit || 2),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[SetupAssistant] Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
```

**Criterios de aceptación:**
- [ ] Endpoint procesa imágenes
- [ ] Verifica límites de Vision
- [ ] Incrementa contador de uso
- [ ] Retorna análisis estructurado

---

### 4.3 Integration with Chat Flow

**Actualizar servicio para incluir Vision en el flujo:**

**Archivo:** `src/features/setup-assistant/services/setup-assistant.service.ts`

```typescript
// Agregar método para procesar mensaje con imagen

import { visionService } from './vision.service';

// En la clase SetupAssistantService, agregar:

/**
 * Process message that may include image attachments
 */
async processMessageWithAttachments(
  input: ProcessMessageInput & { imageUrls?: string[] }
): Promise<ProcessMessageOutput> {
  let visionAnalysis: VisionAnalysis | undefined;

  // If there are image attachments, analyze the first one
  if (input.imageUrls && input.imageUrls.length > 0) {
    try {
      // Determine context based on vertical and current module
      let analysisContext: AnalysisContext = 'general';

      if (input.context.vertical === 'restaurant') {
        analysisContext = 'menu';
      } else if (input.context.vertical === 'dental') {
        analysisContext = 'services';
      }

      visionAnalysis = await visionService.analyzeImage({
        imageUrl: input.imageUrls[0],
        mimeType: 'image/jpeg',
        context: analysisContext,
        additionalContext: input.currentMessage,
      });
    } catch (error) {
      console.error('[SetupAssistantService] Vision analysis failed:', error);
      // Continue without vision analysis
    }
  }

  // Process with agent, including vision analysis
  return this.processMessage({
    ...input,
    visionAnalysis,
  });
}
```

**Criterios de aceptación:**
- [ ] Detección automática de imágenes
- [ ] Análisis integrado en flujo
- [ ] Contexto de análisis por vertical

---

### 4.4 Update API to Use Vision

**Actualizar:** `app/api/setup-assistant/[conversationId]/messages/route.ts`

```typescript
// En el POST handler, después de validar el mensaje:

// Check for image attachments
let visionAnalysis: VisionAnalysis | undefined;
const imageAttachments = (body.attachments || []).filter((url: string) =>
  /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
);

if (imageAttachments.length > 0) {
  // Check vision limit before analyzing
  if (usage && usage.vision_requests < usage.vision_limit) {
    try {
      const { visionService } = await import('@/src/features/setup-assistant/services/vision.service');

      // Auto-analyze the first image
      visionAnalysis = await visionService.autoAnalyze(
        imageAttachments[0],
        'image/jpeg'
      );

      // Increment vision usage
      await supabaseAdmin.rpc('increment_setup_usage', {
        p_tenant_id: tenantId,
        p_vision: 1,
      });
    } catch (error) {
      console.error('[SetupAssistant] Vision analysis failed:', error);
      // Continue without vision analysis
    }
  }
}

// Pass visionAnalysis to the agent
const agentResult = await setupAssistantService.processMessage({
  conversationId,
  context,
  messages: (previousMessages || []).map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
    attachments: m.attachments,
  })),
  currentMessage: body.content,
  attachments: body.attachments,
  visionAnalysis,  // Now included
});

// Save attachments with analysis
const attachmentsWithAnalysis = (body.attachments || []).map((url: string) => {
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  return {
    type: isImage ? 'image' : 'file',
    url,
    analysis: isImage && visionAnalysis ? visionAnalysis : undefined,
  };
});

// Include in user message
const { data: userMessage } = await supabase
  .from('setup_assistant_messages')
  .insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    role: 'user',
    content: body.content,
    attachments: attachmentsWithAnalysis,
  })
  .select()
  .single();
```

**Criterios de aceptación:**
- [ ] Detecta imágenes en attachments
- [ ] Analiza antes de procesar mensaje
- [ ] Guarda análisis con el mensaje
- [ ] Respeta límites de Vision

---

## Validación de Fase 4

```bash
# Verificar tipos
npm run typecheck

# Test manual con imagen
# 1. Subir imagen via /api/setup-assistant/upload
# 2. Analizar via /api/setup-assistant/analyze
# 3. O enviar mensaje con attachment

# curl ejemplo
curl -X POST /api/setup-assistant/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://...", "module": "menu"}'
```

---

## Checklist de Fase 4

- [ ] 4.1 VisionService implementado
- [ ] 4.2 Endpoint /analyze funcional
- [ ] 4.3 Integración con chat flow
- [ ] 4.4 API actualizada para usar Vision
- [ ] Análisis de menú funciona
- [ ] Análisis de servicios funciona
- [ ] Auto-detección funciona
- [ ] Límites respetados
- [ ] Typecheck pasa

---

## Siguiente Fase

→ [FASE-5-UI.md](./FASE-5-UI.md)
