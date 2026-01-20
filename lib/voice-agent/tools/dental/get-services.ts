/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tool: Get Services
 *
 * Lists available dental services with simple descriptions.
 * Does NOT provide exact prices (per specification).
 */

import type {
  ToolDefinition,
  ToolContext,
  ServicesResult,
  GetServicesParams,
} from '../types';
import { formatListForVoice } from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getServices: ToolDefinition<GetServicesParams> = {
  name: 'get_services',
  description: 'Lista los servicios dentales disponibles',
  category: 'info',

  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Categoría de servicios (preventivo, restaurativo, cosmetico, etc.)',
      },
      specialty: {
        type: 'string',
        description: 'Especialidad (ortodoncia, endodoncia, periodoncia, etc.)',
      },
    },
    required: [],
  },

  requiredCapabilities: [],
  requiresConfirmation: false,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 8000,

  handler: async (params, context): Promise<ServicesResult> => {
    const { category, specialty } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Build query for services
      let query = supabase
        .from('services')
        .select('id, name, description, category, duration_minutes, price_range')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      if (category) {
        query = query.ilike('category', `%${category}%`);
      }

      if (specialty) {
        query = query.ilike('specialty', `%${specialty}%`);
      }

      const { data: services, error: queryError } = await query;

      if (queryError) {
        console.error('[GetServices] Query error:', queryError);
      }

      // If no services found, try business_knowledge fallback
      if (!services || services.length === 0) {
        return await getServicesFromKnowledge(supabase, tenantId, category, locale);
      }

      // Format services for voice
      const formattedServices = formatServicesForVoice(services, category, locale);

      return {
        success: true,
        voiceMessage: formattedServices.voiceMessage,
        data: {
          services: formattedServices.services,
          categories: formattedServices.categories,
        },
      };
    } catch (error) {
      console.error('[GetServices] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble getting the services list. Please try again."
          : 'Tengo problemas para obtener la lista de servicios. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  duration_minutes?: number | null;
  price_range?: string | null;
}

interface FormattedServices {
  voiceMessage: string;
  services: Array<{
    name: string;
    description: string;
    category: string;
    duration?: number;
    priceRange?: string;
  }>;
  categories: string[];
}

/**
 * Format services for voice response
 * IMPORTANT: Does NOT include exact prices, only general ranges if available
 */
function formatServicesForVoice(
  services: ServiceItem[],
  requestedCategory: string | undefined,
  locale: string
): FormattedServices {
  // Group by category
  const byCategory = new Map<string, ServiceItem[]>();

  for (const service of services) {
    const cat = service.category || 'general';
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(service);
  }

  const categories = Array.from(byCategory.keys());
  const formattedServicesList: FormattedServices['services'] = [];

  // Build voice message
  let voiceMessage = '';

  if (requestedCategory) {
    // Specific category requested
    const categoryServices = byCategory.get(requestedCategory) || services;

    if (categoryServices.length === 0) {
      voiceMessage = locale === 'en'
        ? `We don't have services in the ${requestedCategory} category. Would you like to know about our other services?`
        : `No tenemos servicios en la categoría de ${requestedCategory}. ¿Le gustaría conocer nuestros otros servicios?`;
    } else {
      const serviceNames = categoryServices.slice(0, 5).map(s => s.name);
      const servicesList = formatListForVoice(serviceNames, locale);

      voiceMessage = locale === 'en'
        ? `In ${requestedCategory}, we offer ${servicesList}. Would you like more details about any of these?`
        : `En ${requestedCategory} ofrecemos ${servicesList}. ¿Le gustaría más detalles sobre alguno de estos?`;

      for (const service of categoryServices) {
        formattedServicesList.push({
          name: service.name,
          description: getSimpleDescription(service, locale),
          category: service.category || 'general',
          duration: service.duration_minutes || undefined,
          priceRange: service.price_range || undefined,
        });
      }
    }
  } else {
    // All services - group by category
    if (categories.length === 1) {
      const allServices = services.slice(0, 6);
      const serviceNames = allServices.map(s => s.name);
      const servicesList = formatListForVoice(serviceNames, locale);

      voiceMessage = locale === 'en'
        ? `We offer ${servicesList}. Would you like details about any service?`
        : `Ofrecemos ${servicesList}. ¿Le gustaría detalles sobre algún servicio?`;
    } else {
      // Multiple categories - summarize
      const categoryList = formatListForVoice(categories.slice(0, 4), locale);

      // Pick top services from each category
      const topServices: string[] = [];
      for (const [, catServices] of byCategory) {
        if (topServices.length < 4) {
          topServices.push(catServices[0].name);
        }
      }

      voiceMessage = locale === 'en'
        ? `We have services in ${categoryList}. Some popular services include ${formatListForVoice(topServices, locale)}. What type of service are you interested in?`
        : `Tenemos servicios de ${categoryList}. Algunos servicios populares incluyen ${formatListForVoice(topServices, locale)}. ¿Qué tipo de servicio le interesa?`;
    }

    // Add all services to list
    for (const service of services) {
      formattedServicesList.push({
        name: service.name,
        description: getSimpleDescription(service, locale),
        category: service.category || 'general',
        duration: service.duration_minutes || undefined,
        priceRange: service.price_range || undefined,
      });
    }
  }

  return {
    voiceMessage,
    services: formattedServicesList,
    categories,
  };
}

/**
 * Get simple, non-technical description for voice
 */
function getSimpleDescription(service: ServiceItem, locale: string): string {
  // If service has a description, simplify it
  if (service.description) {
    // Return first sentence or first 100 chars
    const firstSentence = service.description.split('.')[0];
    if (firstSentence.length <= 100) {
      return firstSentence + '.';
    }
    return firstSentence.substring(0, 97) + '...';
  }

  // Generate simple description based on name
  const name = service.name.toLowerCase();

  // Common dental service descriptions (simple, voice-friendly)
  const descriptions: Record<string, { en: string; es: string }> = {
    limpieza: {
      en: 'Professional dental cleaning to remove plaque and tartar.',
      es: 'Limpieza profesional para remover placa y sarro.',
    },
    consulta: {
      en: 'General consultation and dental evaluation.',
      es: 'Consulta general y evaluación dental.',
    },
    blanqueamiento: {
      en: 'Treatment to whiten and brighten your teeth.',
      es: 'Tratamiento para blanquear y dar brillo a sus dientes.',
    },
    ortodoncia: {
      en: 'Treatment to align and straighten teeth.',
      es: 'Tratamiento para alinear y enderezar los dientes.',
    },
    extraccion: {
      en: 'Tooth extraction procedure.',
      es: 'Procedimiento de extracción dental.',
    },
    endodoncia: {
      en: 'Root canal treatment to save damaged teeth.',
      es: 'Tratamiento de conducto para salvar dientes dañados.',
    },
    implante: {
      en: 'Dental implant to replace missing teeth.',
      es: 'Implante dental para reemplazar dientes perdidos.',
    },
    corona: {
      en: 'Dental crown to restore damaged teeth.',
      es: 'Corona dental para restaurar dientes dañados.',
    },
    carilla: {
      en: 'Dental veneers for a perfect smile.',
      es: 'Carillas dentales para una sonrisa perfecta.',
    },
    radiografia: {
      en: 'X-ray for dental diagnosis.',
      es: 'Radiografía para diagnóstico dental.',
    },
  };

  for (const [key, desc] of Object.entries(descriptions)) {
    if (name.includes(key)) {
      return locale === 'en' ? desc.en : desc.es;
    }
  }

  // Default description
  return locale === 'en'
    ? 'Professional dental service.'
    : 'Servicio dental profesional.';
}

/**
 * Fallback: Get services from business_knowledge table
 */
async function getServicesFromKnowledge(
  supabase: ToolContext['supabase'],
  tenantId: string,
  category: string | undefined,
  locale: string
): Promise<ServicesResult> {
  const { data: knowledge, error } = await supabase
    .from('business_knowledge')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('category', 'services')
    .single();

  if (error || !knowledge?.content) {
    return {
      success: false,
      error: 'No services found',
      voiceMessage: locale === 'en'
        ? "I don't have information about services available right now. Would you like me to connect you with someone who can help?"
        : 'No tengo información sobre servicios disponibles en este momento. ¿Le gustaría que lo comunique con alguien que pueda ayudarle?',
    };
  }

  // Parse knowledge content (could be JSON or text)
  let servicesList: string[] = [];

  try {
    const parsed = JSON.parse(knowledge.content);
    if (Array.isArray(parsed)) {
      servicesList = parsed.map((s: unknown) =>
        typeof s === 'string' ? s : (s as { name?: string })?.name || ''
      ).filter(Boolean);
    } else if (parsed.services) {
      servicesList = parsed.services;
    }
  } catch {
    // Not JSON, try to extract from text
    const lines = knowledge.content.split('\n').filter((l: string) => l.trim());
    servicesList = lines.slice(0, 6);
  }

  if (servicesList.length === 0) {
    return {
      success: false,
      error: 'No services found',
      voiceMessage: locale === 'en'
        ? "I couldn't find service information. Would you like me to connect you with someone who can help?"
        : 'No encontré información de servicios. ¿Le gustaría que lo comunique con alguien que pueda ayudarle?',
    };
  }

  const servicesListStr = formatListForVoice(servicesList.slice(0, 5), locale);

  return {
    success: true,
    voiceMessage: locale === 'en'
      ? `We offer ${servicesListStr}. Would you like more details about any service?`
      : `Ofrecemos ${servicesListStr}. ¿Le gustaría más detalles sobre algún servicio?`,
    data: {
      services: servicesList.map(name => ({
        name,
        description: '',
        category: category || 'general',
      })),
      categories: [category || 'general'],
    },
  };
}

export default getServices;
