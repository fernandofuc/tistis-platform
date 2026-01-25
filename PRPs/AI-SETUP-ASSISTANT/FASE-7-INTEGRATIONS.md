# FASE 7: Integration with Existing Modules

## Objetivo
Integrar el AI Setup Assistant con los modulos existentes de TIS TIS: Loyalty System, AI Learning, Knowledge Base, Services, y Business IA para crear una experiencia fluida de configuracion.

---

## Modulos a Integrar

| Modulo | Integracion | Prioridad |
|--------|-------------|-----------|
| **Loyalty** | Crear programas, tiers, rewards | Alta |
| **Services** | CRUD de servicios con precios | Alta |
| **Knowledge Base** | FAQs, documentos | Alta |
| **AI Agents** | Personalidad, comportamiento | Media |
| **AI Learning** | Feedback loop | Media |
| **Promotions** | Crear promociones | Media |
| **Branches** | Configurar sucursales | Baja |
| **Staff** | Roles y permisos | Baja |

---

## Microfases

### 7.1 Loyalty Integration

**Archivo:** `src/features/setup-assistant/integrations/loyalty.integration.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Loyalty Integration
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import type { MessageAction } from '../types';

export interface CreateLoyaltyProgramInput {
  tenantId: string;
  name: string;
  description?: string;
  pointsPerCurrency?: number;
  currencySymbol?: string;
}

export interface CreateLoyaltyTierInput {
  programId: string;
  name: string;
  minPoints: number;
  benefits: string[];
  sortOrder?: number;
}

export interface CreateLoyaltyRewardInput {
  programId: string;
  name: string;
  description?: string;
  pointsCost: number;
  type: 'discount' | 'product' | 'service' | 'experience';
  value?: number;
}

export class LoyaltyIntegration {
  private supabase = createServiceClient();

  /**
   * Create a complete loyalty program with tiers and rewards
   */
  async createLoyaltyProgram(
    input: CreateLoyaltyProgramInput
  ): Promise<{ programId: string; actions: MessageAction[] }> {
    const actions: MessageAction[] = [];

    try {
      // Create program
      const { data: program, error: programError } = await this.supabase
        .from('loyalty_programs')
        .insert({
          tenant_id: input.tenantId,
          name: input.name,
          description: input.description,
          points_per_currency: input.pointsPerCurrency || 1,
          currency_symbol: input.currencySymbol || '$',
          is_active: true,
        })
        .select('id')
        .single();

      if (programError) throw programError;

      actions.push({
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_program',
        entityId: program.id,
        status: 'success',
        details: { name: input.name },
      });

      return { programId: program.id, actions };
    } catch (error) {
      console.error('[LoyaltyIntegration] Error creating program:', error);
      actions.push({
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_program',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  /**
   * Create a tier for a loyalty program
   */
  async createTier(input: CreateLoyaltyTierInput): Promise<MessageAction> {
    try {
      const { data: tier, error } = await this.supabase
        .from('loyalty_tiers')
        .insert({
          program_id: input.programId,
          name: input.name,
          min_points: input.minPoints,
          benefits: { items: input.benefits },
          sort_order: input.sortOrder || 0,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_tier',
        entityId: tier.id,
        status: 'success',
        details: { name: input.name, minPoints: input.minPoints },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_tier',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Create a reward for a loyalty program
   */
  async createReward(input: CreateLoyaltyRewardInput): Promise<MessageAction> {
    try {
      const { data: reward, error } = await this.supabase
        .from('loyalty_rewards')
        .insert({
          program_id: input.programId,
          name: input.name,
          description: input.description,
          points_cost: input.pointsCost,
          reward_type: input.type,
          value: input.value,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_reward',
        entityId: reward.id,
        status: 'success',
        details: { name: input.name, pointsCost: input.pointsCost },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_reward',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Create a complete program with default tiers
   */
  async createCompleteProgram(
    tenantId: string,
    programName: string,
    vertical: 'restaurant' | 'dental'
  ): Promise<MessageAction[]> {
    const actions: MessageAction[] = [];

    // Create program
    const { programId, actions: programActions } = await this.createLoyaltyProgram({
      tenantId,
      name: programName,
      description: vertical === 'restaurant'
        ? 'Gana puntos con cada compra y canjéalos por recompensas'
        : 'Acumula puntos en tus consultas y obtén beneficios exclusivos',
      pointsPerCurrency: vertical === 'restaurant' ? 10 : 1,
    });

    actions.push(...programActions);

    // Create default tiers based on vertical
    const tiers = vertical === 'restaurant'
      ? [
          { name: 'Comensal', minPoints: 0, benefits: ['Bienvenida especial'] },
          { name: 'Frecuente', minPoints: 500, benefits: ['Postre gratis en cumpleaños', '5% descuento'] },
          { name: 'VIP', minPoints: 2000, benefits: ['Reserva prioritaria', '10% descuento', 'Bebida de cortesía'] },
        ]
      : [
          { name: 'Bronce', minPoints: 0, benefits: ['Newsletter exclusivo'] },
          { name: 'Plata', minPoints: 500, benefits: ['Limpieza dental gratis anual', '5% descuento'] },
          { name: 'Oro', minPoints: 2000, benefits: ['Blanqueamiento con 20% desc.', '10% en todo', 'Cita prioritaria'] },
        ];

    for (let i = 0; i < tiers.length; i++) {
      const tierAction = await this.createTier({
        programId,
        ...tiers[i],
        sortOrder: i,
      });
      actions.push(tierAction);
    }

    return actions;
  }
}

export const loyaltyIntegration = new LoyaltyIntegration();
```

**Criterios de aceptación:**
- [ ] Crear programa completo
- [ ] Crear tiers con beneficios
- [ ] Crear rewards
- [ ] Templates por vertical

---

### 7.2 Services Integration

**Archivo:** `src/features/setup-assistant/integrations/services.integration.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Services Integration
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import type { MessageAction, VisionAnalysis } from '../types';

export interface CreateServiceInput {
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  duration?: number;  // in minutes
  category?: string;
}

export interface BulkCreateServicesInput {
  tenantId: string;
  services: Array<{
    name: string;
    price: number;
    category?: string;
    description?: string;
  }>;
}

export class ServicesIntegration {
  private supabase = createServiceClient();

  /**
   * Create a single service
   */
  async createService(input: CreateServiceInput): Promise<MessageAction> {
    try {
      const { data: service, error } = await this.supabase
        .from('services')
        .insert({
          tenant_id: input.tenantId,
          name: input.name,
          description: input.description,
          price: input.price,
          duration: input.duration || 30,
          category: input.category || 'general',
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'services',
        entityType: 'service',
        entityId: service.id,
        status: 'success',
        details: { name: input.name, price: input.price },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'services',
        entityType: 'service',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Bulk create services (e.g., from Vision analysis)
   */
  async bulkCreateServices(input: BulkCreateServicesInput): Promise<MessageAction[]> {
    const actions: MessageAction[] = [];

    for (const service of input.services) {
      const action = await this.createService({
        tenantId: input.tenantId,
        ...service,
      });
      actions.push(action);
    }

    return actions;
  }

  /**
   * Create services from Vision analysis result
   */
  async createFromVisionAnalysis(
    tenantId: string,
    analysis: VisionAnalysis
  ): Promise<MessageAction[]> {
    const items = (analysis.extractedData.items as Array<{
      name: string;
      price: number;
      category?: string;
      description?: string;
    }>) || [];

    if (items.length === 0) {
      return [];
    }

    return this.bulkCreateServices({
      tenantId,
      services: items,
    });
  }

  /**
   * Update service price
   */
  async updateServicePrice(
    tenantId: string,
    serviceId: string,
    newPrice: number
  ): Promise<MessageAction> {
    try {
      const { error } = await this.supabase
        .from('services')
        .update({ price: newPrice })
        .eq('id', serviceId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      return {
        type: 'update',
        module: 'services',
        entityType: 'service',
        entityId: serviceId,
        status: 'success',
        details: { newPrice },
      };
    } catch (error) {
      return {
        type: 'update',
        module: 'services',
        entityType: 'service',
        entityId: serviceId,
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

export const servicesIntegration = new ServicesIntegration();
```

**Criterios de aceptación:**
- [ ] Crear servicio individual
- [ ] Bulk create desde Vision
- [ ] Update de precios

---

### 7.3 Knowledge Base Integration

**Archivo:** `src/features/setup-assistant/integrations/knowledge-base.integration.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Knowledge Base Integration
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import type { MessageAction } from '../types';

export interface CreateFAQInput {
  tenantId: string;
  question: string;
  answer: string;
  category?: string;
}

export interface BulkCreateFAQsInput {
  tenantId: string;
  faqs: Array<{
    question: string;
    answer: string;
    category?: string;
  }>;
}

export class KnowledgeBaseIntegration {
  private supabase = createServiceClient();

  /**
   * Create a single FAQ
   */
  async createFAQ(input: CreateFAQInput): Promise<MessageAction> {
    try {
      const { data: faq, error } = await this.supabase
        .from('faqs')
        .insert({
          tenant_id: input.tenantId,
          question: input.question,
          answer: input.answer,
          category: input.category || 'general',
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'faq',
        entityId: faq.id,
        status: 'success',
        details: { question: input.question.substring(0, 50) },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'faq',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Bulk create FAQs
   */
  async bulkCreateFAQs(input: BulkCreateFAQsInput): Promise<MessageAction[]> {
    const actions: MessageAction[] = [];

    for (const faq of input.faqs) {
      const action = await this.createFAQ({
        tenantId: input.tenantId,
        ...faq,
      });
      actions.push(action);
    }

    return actions;
  }

  /**
   * Create common FAQs for a vertical
   */
  async createDefaultFAQs(
    tenantId: string,
    vertical: 'restaurant' | 'dental',
    businessInfo: { name: string; phone?: string; address?: string }
  ): Promise<MessageAction[]> {
    const commonFaqs = vertical === 'restaurant'
      ? [
          {
            question: '¿Cuál es su horario de atención?',
            answer: 'Estamos abiertos de lunes a domingo. Consulta nuestros horarios específicos.',
            category: 'horarios',
          },
          {
            question: '¿Tienen servicio a domicilio?',
            answer: 'Sí, contamos con servicio a domicilio. El tiempo de entrega varía según tu ubicación.',
            category: 'servicios',
          },
          {
            question: '¿Cómo puedo hacer una reservación?',
            answer: 'Puedes reservar por WhatsApp o llamando a nuestro número.',
            category: 'reservaciones',
          },
          {
            question: '¿Aceptan pagos con tarjeta?',
            answer: 'Sí, aceptamos todas las tarjetas de crédito y débito.',
            category: 'pagos',
          },
        ]
      : [
          {
            question: '¿Cuál es el costo de una consulta?',
            answer: 'El costo de la consulta de valoración es de $500. En esta revisamos tu caso y te damos un diagnóstico completo.',
            category: 'precios',
          },
          {
            question: '¿Trabajan con seguros dentales?',
            answer: 'Sí, trabajamos con la mayoría de los seguros dentales. Consulta si tu seguro está en nuestra lista.',
            category: 'seguros',
          },
          {
            question: '¿Cómo puedo agendar una cita?',
            answer: 'Puedes agendar tu cita por WhatsApp o llamando a nuestro número. Te confirmaremos disponibilidad.',
            category: 'citas',
          },
          {
            question: '¿Qué debo hacer en caso de emergencia dental?',
            answer: 'Para emergencias, contáctanos inmediatamente. Tenemos espacios reservados para urgencias.',
            category: 'emergencias',
          },
        ];

    return this.bulkCreateFAQs({
      tenantId,
      faqs: commonFaqs,
    });
  }

  /**
   * Add knowledge document
   */
  async addDocument(
    tenantId: string,
    title: string,
    content: string,
    type: 'policy' | 'procedure' | 'info'
  ): Promise<MessageAction> {
    try {
      const { data: doc, error } = await this.supabase
        .from('knowledge_documents')
        .insert({
          tenant_id: tenantId,
          title,
          content,
          document_type: type,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'document',
        entityId: doc.id,
        status: 'success',
        details: { title },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'document',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

export const knowledgeBaseIntegration = new KnowledgeBaseIntegration();
```

**Criterios de aceptación:**
- [ ] Crear FAQs individuales
- [ ] FAQs predeterminadas por vertical
- [ ] Documentos de conocimiento

---

### 7.4 AI Learning Integration

**Archivo:** `src/features/setup-assistant/integrations/ai-learning.integration.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - AI Learning Integration
// Feedback loop for improving setup assistant responses
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import { logAudit } from '@/src/shared/lib/audit';

export interface SetupFeedback {
  conversationId: string;
  messageId: string;
  tenantId: string;
  rating: 'positive' | 'negative';
  feedback?: string;
  actionsTaken?: Array<{ type: string; success: boolean }>;
}

export interface SetupPattern {
  intent: string;
  successRate: number;
  commonFollowUps: string[];
  avgActionsPerMessage: number;
}

export class AILearningIntegration {
  private supabase = createServiceClient();

  /**
   * Record feedback for a setup assistant interaction
   */
  async recordFeedback(feedback: SetupFeedback): Promise<void> {
    try {
      // Log to audit for tracking
      await logAudit({
        tenantId: feedback.tenantId,
        action: 'AI_RESPONSE',
        entityType: 'setup_assistant_message',
        entityId: feedback.messageId,
        metadata: {
          conversationId: feedback.conversationId,
          rating: feedback.rating,
          feedback: feedback.feedback,
          actionsTaken: feedback.actionsTaken,
        },
        status: feedback.rating === 'positive' ? 'success' : 'failure',
      });

      // Store in AI learning queue for analysis
      await this.supabase.from('ai_learning_queue').insert({
        tenant_id: feedback.tenantId,
        source: 'setup_assistant',
        interaction_type: 'feedback',
        data: {
          conversationId: feedback.conversationId,
          messageId: feedback.messageId,
          rating: feedback.rating,
          feedback: feedback.feedback,
          actionsTaken: feedback.actionsTaken,
        },
        status: 'pending',
      });
    } catch (error) {
      console.error('[AILearningIntegration] Error recording feedback:', error);
    }
  }

  /**
   * Get setup patterns for a tenant (what works well)
   */
  async getSetupPatterns(tenantId: string): Promise<SetupPattern[]> {
    try {
      // Analyze successful setup interactions
      const { data: successfulInteractions } = await this.supabase
        .from('setup_assistant_messages')
        .select('content, actions_taken')
        .eq('tenant_id', tenantId)
        .eq('role', 'assistant')
        .not('actions_taken', 'is', null)
        .limit(100);

      if (!successfulInteractions || successfulInteractions.length === 0) {
        return [];
      }

      // Aggregate patterns (simplified)
      const patterns = new Map<string, { success: number; total: number; followUps: string[] }>();

      for (const interaction of successfulInteractions) {
        const actions = interaction.actions_taken as Array<{ type: string; status: string }>;

        for (const action of actions) {
          const key = action.type;
          const existing = patterns.get(key) || { success: 0, total: 0, followUps: [] };

          existing.total++;
          if (action.status === 'success') {
            existing.success++;
          }

          patterns.set(key, existing);
        }
      }

      return Array.from(patterns.entries()).map(([intent, data]) => ({
        intent,
        successRate: data.success / data.total,
        commonFollowUps: data.followUps.slice(0, 5),
        avgActionsPerMessage: data.total / successfulInteractions.length,
      }));
    } catch (error) {
      console.error('[AILearningIntegration] Error getting patterns:', error);
      return [];
    }
  }

  /**
   * Update business insights based on setup completion
   */
  async updateBusinessInsights(
    tenantId: string,
    setupProgress: Record<string, string>
  ): Promise<void> {
    try {
      const completedModules = Object.entries(setupProgress)
        .filter(([_, status]) => status === 'completed')
        .map(([module]) => module);

      // Update or create business insight
      await this.supabase.from('ai_business_insights').upsert({
        tenant_id: tenantId,
        insight_type: 'setup_completion',
        data: {
          completedModules,
          completionPercentage: (completedModules.length / Object.keys(setupProgress).length) * 100,
          lastUpdated: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,insight_type',
      });
    } catch (error) {
      console.error('[AILearningIntegration] Error updating insights:', error);
    }
  }
}

export const aiLearningIntegration = new AILearningIntegration();
```

**Criterios de aceptación:**
- [ ] Feedback se registra
- [ ] Patrones se analizan
- [ ] Insights se actualizan

---

### 7.5 Integration Hub Connection

**Archivo:** `src/features/setup-assistant/integrations/hub.integration.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Integration Hub Connection
// Connect setup assistant with external integrations
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import type { MessageAction } from '../types';

export interface IntegrationSuggestion {
  name: string;
  type: string;
  description: string;
  benefits: string[];
  setupDifficulty: 'easy' | 'medium' | 'hard';
}

export class HubIntegration {
  private supabase = createServiceClient();

  /**
   * Get integration suggestions based on tenant's vertical and setup
   */
  async getIntegrationSuggestions(
    tenantId: string,
    vertical: 'restaurant' | 'dental'
  ): Promise<IntegrationSuggestion[]> {
    // Check existing integrations
    const { data: existingIntegrations } = await this.supabase
      .from('integration_connections')
      .select('connector_type')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected');

    const existingTypes = new Set(existingIntegrations?.map(i => i.connector_type) || []);

    // Suggestions based on vertical
    const allSuggestions: IntegrationSuggestion[] = vertical === 'restaurant'
      ? [
          {
            name: 'Google Calendar',
            type: 'google_calendar',
            description: 'Sincroniza reservaciones con tu calendario',
            benefits: ['Ver disponibilidad en tiempo real', 'Notificaciones automáticas'],
            setupDifficulty: 'easy',
          },
          {
            name: 'Square POS',
            type: 'square',
            description: 'Conecta tu punto de venta',
            benefits: ['Sincronizar productos', 'Ventas en tiempo real'],
            setupDifficulty: 'medium',
          },
        ]
      : [
          {
            name: 'Google Calendar',
            type: 'google_calendar',
            description: 'Sincroniza citas con tu calendario',
            benefits: ['Gestión de citas automática', 'Recordatorios'],
            setupDifficulty: 'easy',
          },
          {
            name: 'HubSpot CRM',
            type: 'hubspot',
            description: 'Gestiona tus pacientes como leads',
            benefits: ['Seguimiento automatizado', 'Pipeline de pacientes'],
            setupDifficulty: 'medium',
          },
        ];

    // Filter out existing integrations
    return allSuggestions.filter(s => !existingTypes.has(s.type));
  }

  /**
   * Initiate integration setup (redirect to settings)
   */
  async initiateIntegration(
    tenantId: string,
    integrationType: string
  ): Promise<{ redirectUrl: string; action: MessageAction }> {
    return {
      redirectUrl: `/dashboard/settings/integrations?setup=${integrationType}`,
      action: {
        type: 'configure',
        module: 'agents',
        entityType: 'integration_redirect',
        status: 'success',
        details: { integrationType, action: 'redirect_to_settings' },
      },
    };
  }
}

export const hubIntegration = new HubIntegration();
```

**Criterios de aceptación:**
- [ ] Sugerencias por vertical
- [ ] Filtro de existentes
- [ ] Redirect a settings

---

### 7.6 Unified Action Executor

**Actualizar:** `src/features/setup-assistant/nodes/executor.ts`

```typescript
// Agregar imports
import { loyaltyIntegration } from '../integrations/loyalty.integration';
import { servicesIntegration } from '../integrations/services.integration';
import { knowledgeBaseIntegration } from '../integrations/knowledge-base.integration';
import { aiLearningIntegration } from '../integrations/ai-learning.integration';

// Actualizar executeAction para usar integrations:

async function executeAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  action: MessageAction
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  const { module, entityType, type, details } = action;

  try {
    switch (module) {
      case 'services': {
        if (type === 'create' && entityType === 'service') {
          const result = await servicesIntegration.createService({
            tenantId,
            name: details?.name as string,
            price: details?.price as number,
            category: details?.category as string,
            description: details?.description as string,
          });
          return { success: result.status === 'success', entityId: result.entityId };
        }
        break;
      }

      case 'loyalty': {
        if (type === 'create' && entityType === 'loyalty_program') {
          const { programId, actions } = await loyaltyIntegration.createLoyaltyProgram({
            tenantId,
            name: details?.name as string,
            description: details?.description as string,
          });
          return { success: true, entityId: programId };
        }

        if (type === 'create' && entityType === 'loyalty_tier') {
          const result = await loyaltyIntegration.createTier({
            programId: details?.programId as string,
            name: details?.name as string,
            minPoints: details?.minPoints as number,
            benefits: details?.benefits as string[],
          });
          return { success: result.status === 'success', entityId: result.entityId };
        }
        break;
      }

      case 'knowledge_base': {
        if (type === 'create' && entityType === 'faq') {
          const result = await knowledgeBaseIntegration.createFAQ({
            tenantId,
            question: details?.question as string,
            answer: details?.answer as string,
            category: details?.category as string,
          });
          return { success: result.status === 'success', entityId: result.entityId };
        }
        break;
      }

      // ... otros módulos
    }

    return { success: false, error: `Unknown action: ${module}/${type}/${entityType}` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Criterios de aceptación:**
- [ ] Executor usa integrations
- [ ] Manejo de errores unificado
- [ ] Logging de acciones

---

## Validación de Fase 7

```bash
# Verificar tipos
npm run typecheck

# Test de integrations
# 1. Crear programa de lealtad via chat
# 2. Crear servicios via Vision
# 3. Crear FAQs predeterminadas
# 4. Verificar feedback loop
```

---

## Checklist de Fase 7

- [ ] 7.1 Loyalty integration funciona
- [ ] 7.2 Services integration funciona
- [ ] 7.3 Knowledge base integration funciona
- [ ] 7.4 AI Learning feedback funciona
- [ ] 7.5 Hub integration suggestions
- [ ] 7.6 Executor unificado
- [ ] Todas las acciones se ejecutan correctamente
- [ ] Feedback se registra en AI Learning

---

## Siguiente Fase

→ [FASE-8-TESTING.md](./FASE-8-TESTING.md)
