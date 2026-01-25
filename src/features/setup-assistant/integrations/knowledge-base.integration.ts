// =====================================================
// TIS TIS PLATFORM - Knowledge Base Integration
// Sprint 5: Setup Assistant module integrations
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { MessageAction } from '../types';

// =====================================================
// TYPES
// =====================================================

export interface CreateFAQInput {
  tenantId: string;
  question: string;
  answer: string;
  shortAnswer?: string;
  category?: string;
  keywords?: string[];
}

export interface BulkCreateFAQsInput {
  tenantId: string;
  faqs: Array<{
    question: string;
    answer: string;
    shortAnswer?: string;
    category?: string;
  }>;
}

export interface CreateKnowledgeArticleInput {
  tenantId: string;
  title: string;
  content: string;
  summary?: string;
  category: 'about_us' | 'differentiators' | 'certifications' | 'technology' |
            'materials' | 'process' | 'aftercare' | 'preparation' | 'promotions' |
            'events' | 'testimonials' | 'awards' | 'partnerships' | 'custom';
}

export interface CreateBusinessPolicyInput {
  tenantId: string;
  title: string;
  policyText: string;
  shortVersion?: string;
  policyType: 'cancellation' | 'rescheduling' | 'payment' | 'insurance' |
              'warranty' | 'pricing' | 'late_arrival' | 'deposits' | 'refunds' |
              'emergency' | 'custom';
}

// =====================================================
// KNOWLEDGE BASE INTEGRATION CLASS
// =====================================================

export class KnowledgeBaseIntegration {
  private supabase = createServerClient();

  // ======================
  // CREATE FAQ
  // ======================

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
          short_answer: input.shortAnswer,
          category: input.category || 'general',
          keywords: input.keywords || [],
          is_active: true,
          is_public: true,
          language: 'es',
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

  // ======================
  // BULK CREATE FAQs
  // ======================

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

  // ======================
  // CREATE DEFAULT FAQs
  // ======================

  /**
   * Create common FAQs for a vertical
   */
  async createDefaultFAQs(
    tenantId: string,
    vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym',
    _businessInfo?: { name?: string; phone?: string; address?: string } // TODO: Use to personalize FAQ answers
  ): Promise<MessageAction[]> {
    const faqsByVertical: Record<string, Array<{
      question: string;
      answer: string;
      category: string;
    }>> = {
      restaurant: [
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
      ],
      dental: [
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
      ],
      clinic: [
        {
          question: '¿Cuánto cuesta la consulta?',
          answer: 'La consulta general tiene un costo de $600. Te daremos un diagnóstico completo.',
          category: 'precios',
        },
        {
          question: '¿Aceptan mi seguro de gastos médicos?',
          answer: 'Trabajamos con las principales aseguradoras. Consulta si tu seguro está en nuestra lista.',
          category: 'seguros',
        },
        {
          question: '¿Cómo agendo una cita?',
          answer: 'Puedes agendar tu cita por WhatsApp, teléfono o en línea.',
          category: 'citas',
        },
        {
          question: '¿Atienden urgencias?',
          answer: 'Sí, contamos con servicio de urgencias. Contáctanos inmediatamente.',
          category: 'emergencias',
        },
      ],
      beauty: [
        {
          question: '¿Cuáles son sus horarios?',
          answer: 'Atendemos de lunes a sábado. Consulta nuestros horarios específicos.',
          category: 'horarios',
        },
        {
          question: '¿Necesito cita previa?',
          answer: 'Sí, recomendamos agendar cita para garantizar disponibilidad.',
          category: 'citas',
        },
        {
          question: '¿Qué formas de pago aceptan?',
          answer: 'Aceptamos efectivo, tarjetas de crédito y débito.',
          category: 'pagos',
        },
        {
          question: '¿Tienen promociones?',
          answer: 'Sí, tenemos promociones especiales. Pregunta por nuestras ofertas del mes.',
          category: 'promociones',
        },
      ],
      veterinary: [
        {
          question: '¿Atienden emergencias?',
          answer: 'Sí, contamos con servicio de urgencias veterinarias. Contáctanos de inmediato.',
          category: 'emergencias',
        },
        {
          question: '¿Cuánto cuesta una consulta?',
          answer: 'La consulta general tiene un costo de $400. Incluye revisión completa de tu mascota.',
          category: 'precios',
        },
        {
          question: '¿Qué vacunas necesita mi mascota?',
          answer: 'Depende de la especie y edad. En la consulta te daremos un esquema de vacunación personalizado.',
          category: 'vacunas',
        },
        {
          question: '¿Ofrecen baño y estética?',
          answer: 'Sí, tenemos servicio de baño, corte de pelo y estética para mascotas.',
          category: 'servicios',
        },
      ],
      gym: [
        {
          question: '¿Cuánto cuesta la membresía?',
          answer: 'Tenemos diferentes planes de membresía. Desde $800/mes. Pregunta por nuestros paquetes.',
          category: 'precios',
        },
        {
          question: '¿Cuáles son sus horarios?',
          answer: 'Estamos abiertos de lunes a viernes de 6am a 10pm, sábados y domingos de 8am a 2pm.',
          category: 'horarios',
        },
        {
          question: '¿Tienen clases grupales?',
          answer: 'Sí, ofrecemos clases de spinning, yoga, zumba y más. Consulta nuestro horario de clases.',
          category: 'clases',
        },
        {
          question: '¿Hay entrenadores personales?',
          answer: 'Sí, contamos con entrenadores certificados para sesiones personalizadas.',
          category: 'servicios',
        },
      ],
    };

    const faqs = faqsByVertical[vertical] || faqsByVertical.dental;

    return this.bulkCreateFAQs({
      tenantId,
      faqs,
    });
  }

  // ======================
  // CREATE KNOWLEDGE ARTICLE
  // ======================

  /**
   * Add a knowledge article
   */
  async createKnowledgeArticle(input: CreateKnowledgeArticleInput): Promise<MessageAction> {
    try {
      const { data: article, error } = await this.supabase
        .from('ai_knowledge_articles')
        .insert({
          tenant_id: input.tenantId,
          title: input.title,
          content: input.content,
          summary: input.summary,
          category: input.category,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'article',
        entityId: article.id,
        status: 'success',
        details: { title: input.title },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'article',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ======================
  // CREATE BUSINESS POLICY
  // ======================

  /**
   * Add a business policy
   */
  async createBusinessPolicy(input: CreateBusinessPolicyInput): Promise<MessageAction> {
    try {
      const { data: policy, error } = await this.supabase
        .from('ai_business_policies')
        .insert({
          tenant_id: input.tenantId,
          title: input.title,
          policy_text: input.policyText,
          short_version: input.shortVersion,
          policy_type: input.policyType,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'policy',
        entityId: policy.id,
        status: 'success',
        details: { title: input.title, type: input.policyType },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'knowledge_base',
        entityType: 'policy',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ======================
  // CREATE DEFAULT POLICIES
  // ======================

  /**
   * Create common policies for a vertical
   */
  async createDefaultPolicies(
    tenantId: string,
    vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym'
  ): Promise<MessageAction[]> {
    const actions: MessageAction[] = [];

    const policiesByVertical: Record<string, Array<{
      title: string;
      policyText: string;
      shortVersion: string;
      policyType: CreateBusinessPolicyInput['policyType'];
    }>> = {
      restaurant: [
        {
          title: 'Política de reservaciones',
          policyText: 'Las reservaciones se confirman con 2 horas de anticipación. En caso de no poder asistir, favor de cancelar con al menos 1 hora de anticipación.',
          shortVersion: 'Cancela con 1 hora de anticipación',
          policyType: 'cancellation',
        },
        {
          title: 'Política de pagos',
          policyText: 'Aceptamos efectivo, tarjetas de crédito y débito. No aceptamos cheques.',
          shortVersion: 'Efectivo y tarjetas',
          policyType: 'payment',
        },
      ],
      dental: [
        {
          title: 'Política de cancelación',
          policyText: 'Las citas pueden cancelarse o reprogramarse hasta 24 horas antes sin penalización. Cancelaciones con menos tiempo pueden generar un cargo.',
          shortVersion: 'Cancela 24 horas antes sin cargo',
          policyType: 'cancellation',
        },
        {
          title: 'Política de pagos',
          policyText: 'Ofrecemos planes de pago para tratamientos mayores. Aceptamos efectivo, tarjetas y algunos seguros dentales.',
          shortVersion: 'Planes de pago disponibles',
          policyType: 'payment',
        },
      ],
      clinic: [
        {
          title: 'Política de cancelación',
          policyText: 'Favor de cancelar o reprogramar citas con al menos 24 horas de anticipación.',
          shortVersion: 'Cancela 24 horas antes',
          policyType: 'cancellation',
        },
        {
          title: 'Política de seguros',
          policyText: 'Trabajamos con las principales aseguradoras. Consulta si tu seguro está en nuestra lista de convenios.',
          shortVersion: 'Principales aseguradoras aceptadas',
          policyType: 'insurance',
        },
      ],
      beauty: [
        {
          title: 'Política de cancelación',
          policyText: 'Cancelaciones con menos de 2 horas de anticipación pueden generar un cargo del 50%.',
          shortVersion: 'Cancela 2 horas antes',
          policyType: 'cancellation',
        },
      ],
      veterinary: [
        {
          title: 'Política de emergencias',
          policyText: 'Atendemos urgencias veterinarias. El costo de consulta de emergencia es de $600.',
          shortVersion: 'Emergencias: $600',
          policyType: 'emergency',
        },
      ],
      gym: [
        {
          title: 'Política de membresía',
          policyText: 'Las membresías son personales e intransferibles. Se requiere un contrato mínimo de 3 meses.',
          shortVersion: 'Mínimo 3 meses',
          policyType: 'payment',
        },
      ],
    };

    const policies = policiesByVertical[vertical] || [];

    for (const policy of policies) {
      const action = await this.createBusinessPolicy({
        tenantId,
        ...policy,
      });
      actions.push(action);
    }

    return actions;
  }

  // ======================
  // GET COUNTS
  // ======================

  /**
   * Get knowledge base counts for a tenant
   */
  async getKnowledgeBaseCounts(tenantId: string): Promise<{
    faqs: number;
    articles: number;
    policies: number;
  }> {
    try {
      const [faqsResult, articlesResult, policiesResult] = await Promise.all([
        this.supabase
          .from('faqs')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        this.supabase
          .from('ai_knowledge_articles')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        this.supabase
          .from('ai_business_policies')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
      ]);

      return {
        faqs: faqsResult.count || 0,
        articles: articlesResult.count || 0,
        policies: policiesResult.count || 0,
      };
    } catch {
      return { faqs: 0, articles: 0, policies: 0 };
    }
  }
}

// Singleton instance export
export const knowledgeBaseIntegration = new KnowledgeBaseIntegration();
