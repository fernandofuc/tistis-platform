# FASE 2: API Routes Architecture

## Objetivo
Disenar e implementar los endpoints de API para el AI Setup Assistant, siguiendo patrones existentes del proyecto.

---

## Estructura de Endpoints

```
/api/setup-assistant/
├── route.ts                    # GET (listar), POST (crear conversación)
├── [conversationId]/
│   ├── route.ts                # GET (detalle), PATCH (actualizar), DELETE
│   └── messages/
│       └── route.ts            # GET (mensajes), POST (enviar mensaje)
├── upload/
│   └── route.ts                # POST (subir archivo para análisis)
├── analyze/
│   └── route.ts                # POST (análisis de imagen con Vision)
└── usage/
    └── route.ts                # GET (obtener uso actual)
```

---

## Microfases

### 2.1 Types Definition

**Archivo:** `src/features/setup-assistant/types/index.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Types
// =====================================================

export type ConversationStatus = 'active' | 'completed' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system';
export type SetupModule =
  | 'general'
  | 'loyalty'
  | 'agents'
  | 'knowledge_base'
  | 'services'
  | 'promotions'
  | 'staff'
  | 'branches';

// =====================================================
// DATABASE TYPES
// =====================================================

export interface SetupConversation {
  id: string;
  tenantId: string;
  userId: string;
  status: ConversationStatus;
  currentModule: SetupModule | null;
  setupProgress: Record<SetupModule, 'pending' | 'in_progress' | 'completed'>;
  title: string | null;
  summary: string | null;
  startedAt: string;
  lastMessageAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetupMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  role: MessageRole;
  content: string;
  attachments: MessageAttachment[];
  actionsTaken: MessageAction[];
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

export interface MessageAttachment {
  type: 'image' | 'document' | 'file';
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  analysis?: VisionAnalysis;
}

export interface MessageAction {
  type: 'create' | 'update' | 'delete' | 'configure';
  module: SetupModule;
  entityType: string;
  entityId?: string;
  status: 'success' | 'failure';
  details?: Record<string, unknown>;
}

export interface VisionAnalysis {
  description: string;
  extractedData: Record<string, unknown>;
  confidence: number;
  suggestions: string[];
}

// =====================================================
// API TYPES
// =====================================================

export interface CreateConversationRequest {
  initialMessage?: string;
  module?: SetupModule;
}

export interface CreateConversationResponse {
  conversation: SetupConversation;
  initialResponse?: SetupMessage;
}

export interface SendMessageRequest {
  content: string;
  attachments?: string[];  // URLs de archivos ya subidos
}

export interface SendMessageResponse {
  userMessage: SetupMessage;
  assistantMessage: SetupMessage;
  usage: UsageInfo;
}

export interface UsageInfo {
  messagesCount: number;
  messagesLimit: number;
  filesUploaded: number;
  filesLimit: number;
  visionRequests: number;
  visionLimit: number;
  planId: string;
  isAtLimit: boolean;
}

export interface UploadResponse {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface AnalyzeImageRequest {
  imageUrl: string;
  context?: string;  // Contexto adicional para el análisis
  module?: SetupModule;
}

export interface AnalyzeImageResponse {
  analysis: VisionAnalysis;
  usage: UsageInfo;
}
```

**Criterios de aceptación:**
- [ ] Tipos completos y documentados
- [ ] Alineados con schema de BD
- [ ] Exportados desde index.ts

---

### 2.2 Conversations Endpoint (GET/POST)

**Archivo:** `app/api/setup-assistant/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant API
// GET: List conversations
// POST: Create new conversation
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { aiLimiter } from '@/src/shared/lib/rate-limit';
import type {
  CreateConversationRequest,
  CreateConversationResponse,
  SetupConversation,
} from '@/src/features/setup-assistant/types';

// GET: List user's conversations
export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId, userId } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error } = await supabase
      .from('setup_assistant_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', status)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      conversations: data || [],
      pagination: { limit, offset, hasMore: (data?.length || 0) === limit },
    });
  } catch (error) {
    console.error('[SetupAssistant] Error listing conversations:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

// POST: Create new conversation
export async function POST(request: NextRequest) {
  // Rate limiting
  const limiterResult = await aiLimiter(request);
  if (limiterResult) return limiterResult;

  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId, userId } = authResult;

  try {
    const body: CreateConversationRequest = await request.json();

    // Check usage limits
    const { data: usageData } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (usageData && usageData[0]) {
      const usage = usageData[0];
      if (usage.messages_count >= usage.messages_limit) {
        return NextResponse.json(
          { error: 'Daily message limit reached', code: 'LIMIT_REACHED' },
          { status: 429 }
        );
      }
    }

    // Create conversation
    const { data: conversation, error } = await supabase
      .from('setup_assistant_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        current_module: body.module || null,
        setup_progress: {},
      })
      .select()
      .single();

    if (error) throw error;

    // If initial message provided, process it
    let initialResponse = null;
    if (body.initialMessage) {
      // TODO: Process with LangGraph agent (Phase 3)
      // For now, return conversation only
    }

    const response: CreateConversationResponse = {
      conversation,
      initialResponse,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SetupAssistant] Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
```

**Criterios de aceptación:**
- [ ] GET lista conversaciones con paginación
- [ ] POST crea nueva conversación
- [ ] Rate limiting aplicado
- [ ] Verificación de límites de uso

---

### 2.3 Conversation Detail Endpoint

**Archivo:** `app/api/setup-assistant/[conversationId]/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Conversation Detail
// GET: Get conversation with recent messages
// PATCH: Update conversation status/metadata
// DELETE: Archive conversation
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params;

  if (!UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId } = authResult;

  try {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('setup_assistant_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get recent messages (last 50)
    const { data: messages } = await supabase
      .from('setup_assistant_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    return NextResponse.json({
      conversation,
      messages: messages || [],
    });
  } catch (error) {
    console.error('[SetupAssistant] Error getting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params;

  if (!UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId } = authResult;

  try {
    const body = await request.json();
    const allowedFields = ['status', 'title', 'current_module', 'setup_progress'];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If completing, set completed_at
    if (body.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('setup_assistant_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error('[SetupAssistant] Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params;

  if (!UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId } = authResult;

  try {
    // Archive instead of delete
    const { error } = await supabase
      .from('setup_assistant_conversations')
      .update({ status: 'archived' })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SetupAssistant] Error archiving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to archive conversation' },
      { status: 500 }
    );
  }
}
```

**Criterios de aceptación:**
- [ ] GET retorna conversación con mensajes
- [ ] PATCH actualiza campos permitidos
- [ ] DELETE archiva (no elimina)

---

### 2.4 Messages Endpoint

**Archivo:** `app/api/setup-assistant/[conversationId]/messages/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Messages
// GET: List messages with pagination
// POST: Send new message (triggers AI response)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { aiLimiter } from '@/src/shared/lib/rate-limit';
import type { SendMessageRequest, SendMessageResponse } from '@/src/features/setup-assistant/types';
// import { setupAssistantAgent } from '@/src/features/setup-assistant/services/agent';

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params;

  if (!UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId } = authResult;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const before = searchParams.get('before');  // Cursor for pagination

  try {
    let query = supabase
      .from('setup_assistant_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      messages: (data || []).reverse(),  // Return in chronological order
      hasMore: (data?.length || 0) === limit,
    });
  } catch (error) {
    console.error('[SetupAssistant] Error listing messages:', error);
    return NextResponse.json(
      { error: 'Failed to list messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { conversationId } = await params;

  if (!UUID_REGEX.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  // Rate limiting
  const limiterResult = await aiLimiter(request);
  if (limiterResult) return limiterResult;

  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId, userId } = authResult;

  try {
    const body: SendMessageRequest = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // 1. Verify conversation exists and belongs to tenant
    const { data: conversation } = await supabase
      .from('setup_assistant_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.status !== 'active') {
      return NextResponse.json(
        { error: 'Conversation is not active' },
        { status: 400 }
      );
    }

    // 2. Check usage limits
    const { data: usageData } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    const usage = usageData?.[0];
    if (usage && usage.messages_count >= usage.messages_limit) {
      return NextResponse.json(
        {
          error: 'Daily message limit reached',
          code: 'LIMIT_REACHED',
          usage: {
            messagesCount: usage.messages_count,
            messagesLimit: usage.messages_limit,
            planId: usage.plan_id,
          },
        },
        { status: 429 }
      );
    }

    // 3. Save user message
    const { data: userMessage, error: userMsgError } = await supabase
      .from('setup_assistant_messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        role: 'user',
        content: body.content,
        attachments: body.attachments || [],
      })
      .select()
      .single();

    if (userMsgError) throw userMsgError;

    // 4. Process with LangGraph Agent (Phase 3)
    // TODO: Replace with actual agent call
    const assistantResponse = {
      content: `[Setup Assistant] Procesando: "${body.content.substring(0, 50)}..."`,
      actionsTaken: [],
      inputTokens: 0,
      outputTokens: 0,
    };

    // 5. Save assistant message
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from('setup_assistant_messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        role: 'assistant',
        content: assistantResponse.content,
        actions_taken: assistantResponse.actionsTaken,
        input_tokens: assistantResponse.inputTokens,
        output_tokens: assistantResponse.outputTokens,
      })
      .select()
      .single();

    if (assistantMsgError) throw assistantMsgError;

    // 6. Update conversation last_message_at
    await supabase
      .from('setup_assistant_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // 7. Increment usage
    await supabase.rpc('increment_setup_usage', {
      p_tenant_id: tenantId,
      p_messages: 1,
      p_input_tokens: assistantResponse.inputTokens,
      p_output_tokens: assistantResponse.outputTokens,
    });

    // 8. Return response
    const response: SendMessageResponse = {
      userMessage,
      assistantMessage,
      usage: {
        messagesCount: (usage?.messages_count || 0) + 1,
        messagesLimit: usage?.messages_limit || 20,
        filesUploaded: usage?.files_uploaded || 0,
        filesLimit: usage?.files_limit || 3,
        visionRequests: usage?.vision_requests || 0,
        visionLimit: usage?.vision_limit || 2,
        planId: usage?.plan_id || 'starter',
        isAtLimit: (usage?.messages_count || 0) + 1 >= (usage?.messages_limit || 20),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SetupAssistant] Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
```

**Criterios de aceptación:**
- [ ] GET lista mensajes con paginación cursor
- [ ] POST guarda mensaje y genera respuesta
- [ ] Verificación de límites
- [ ] Incremento de uso

---

### 2.5 File Upload Endpoint

**Archivo:** `app/api/setup-assistant/upload/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant File Upload
// POST: Upload file for analysis
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { createServiceClient } from '@/src/shared/lib/supabase';
import type { UploadResponse } from '@/src/features/setup-assistant/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/json',
];

export async function POST(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId, userId } = authResult;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed', allowedTypes: ALLOWED_TYPES },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', maxSize: MAX_FILE_SIZE },
        { status: 400 }
      );
    }

    // Check file upload limit
    const supabaseAdmin = createServiceClient();
    const { data: usageData } = await supabaseAdmin.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    const usage = usageData?.[0];
    if (usage && usage.files_uploaded >= usage.files_limit) {
      return NextResponse.json(
        { error: 'Daily file upload limit reached', code: 'LIMIT_REACHED' },
        { status: 429 }
      );
    }

    // Generate unique filename
    const extension = file.name.split('.').pop() || 'bin';
    const filename = `${tenantId}/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    // Upload to Supabase Storage
    const buffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[SetupAssistant] Upload error:', uploadError);
      throw new Error('Failed to upload file');
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .getPublicUrl(filename);

    // Increment file usage
    await supabaseAdmin.rpc('increment_setup_usage', {
      p_tenant_id: tenantId,
      p_files: 1,
    });

    const response: UploadResponse = {
      url: urlData.publicUrl,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SetupAssistant] Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
```

**Criterios de aceptación:**
- [ ] Validación de tipo de archivo
- [ ] Validación de tamaño
- [ ] Verificación de límites
- [ ] Upload a Supabase Storage

---

### 2.6 Usage Endpoint

**Archivo:** `app/api/setup-assistant/usage/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Usage
// GET: Get current usage and limits
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type { UsageInfo } from '@/src/features/setup-assistant/types';

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);
  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId } = authResult;

  try {
    const { data, error } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (error) throw error;

    const usage = data?.[0] || {
      messages_count: 0,
      messages_limit: 20,
      files_uploaded: 0,
      files_limit: 3,
      vision_requests: 0,
      vision_limit: 2,
      plan_id: 'starter',
    };

    const response: UsageInfo = {
      messagesCount: usage.messages_count,
      messagesLimit: usage.messages_limit,
      filesUploaded: usage.files_uploaded,
      filesLimit: usage.files_limit,
      visionRequests: usage.vision_requests,
      visionLimit: usage.vision_limit,
      planId: usage.plan_id,
      isAtLimit:
        usage.messages_count >= usage.messages_limit ||
        usage.files_uploaded >= usage.files_limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[SetupAssistant] Error getting usage:', error);
    return NextResponse.json(
      { error: 'Failed to get usage' },
      { status: 500 }
    );
  }
}
```

**Criterios de aceptación:**
- [ ] Retorna uso actual
- [ ] Incluye límites del plan
- [ ] Indica si está en límite

---

## Estructura Final de Archivos

```
app/api/setup-assistant/
├── route.ts                          # 2.2
├── [conversationId]/
│   ├── route.ts                      # 2.3
│   └── messages/
│       └── route.ts                  # 2.4
├── upload/
│   └── route.ts                      # 2.5
└── usage/
    └── route.ts                      # 2.6

src/features/setup-assistant/
├── types/
│   └── index.ts                      # 2.1
└── index.ts                          # Barrel export
```

---

## Validación de Fase 2

```bash
# Verificar sintaxis TypeScript
npm run typecheck

# Test endpoints con curl (después de auth)
curl -X GET /api/setup-assistant/usage
curl -X POST /api/setup-assistant -d '{"initialMessage": "Hola"}'
curl -X GET /api/setup-assistant/[id]
curl -X POST /api/setup-assistant/[id]/messages -d '{"content": "Test"}'
```

---

## Checklist de Fase 2

- [ ] 2.1 Types definidos y exportados
- [ ] 2.2 Conversations endpoint funcional
- [ ] 2.3 Conversation detail endpoint funcional
- [ ] 2.4 Messages endpoint funcional
- [ ] 2.5 Upload endpoint funcional
- [ ] 2.6 Usage endpoint funcional
- [ ] Typecheck pasa sin errores
- [ ] Rate limiting configurado
- [ ] Validación de límites implementada

---

## Siguiente Fase

→ [FASE-3-LANGGRAPH.md](./FASE-3-LANGGRAPH.md)
