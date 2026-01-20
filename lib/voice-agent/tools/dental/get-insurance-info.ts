/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tool: Get Insurance Info
 *
 * Retrieves information about accepted dental insurance plans
 * and general coverage information.
 *
 * Note: This tool provides GENERAL information only.
 * Specific coverage verification requires contacting the insurance company.
 */

import type {
  ToolDefinition,
  ToolContext,
  InsuranceInfoResult,
  GetInsuranceInfoParams,
} from '../types';
import { formatListForVoice } from '../formatters';

// =====================================================
// COMMON INSURANCE COMPANIES (Mexico)
// =====================================================

const COMMON_INSURANCES: Record<string, { fullName: string; category: string }> = {
  gnp: { fullName: 'GNP Seguros', category: 'major' },
  metlife: { fullName: 'MetLife', category: 'major' },
  axa: { fullName: 'AXA Seguros', category: 'major' },
  mapfre: { fullName: 'MAPFRE', category: 'major' },
  allianz: { fullName: 'Allianz', category: 'major' },
  zurich: { fullName: 'Zurich Seguros', category: 'major' },
  monterrey: { fullName: 'Seguros Monterrey New York Life', category: 'major' },
  inbursa: { fullName: 'Seguros Inbursa', category: 'major' },
  banorte: { fullName: 'Seguros Banorte', category: 'major' },
  cigna: { fullName: 'Cigna', category: 'international' },
  bupa: { fullName: 'BUPA', category: 'international' },
  imss: { fullName: 'IMSS (Instituto Mexicano del Seguro Social)', category: 'public' },
  issste: { fullName: 'ISSSTE', category: 'public' },
};

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getInsuranceInfo: ToolDefinition<GetInsuranceInfoParams> = {
  name: 'get_insurance_info',
  description: 'Obtiene información sobre seguros dentales aceptados en el consultorio',
  category: 'info',

  parameters: {
    type: 'object',
    properties: {
      insuranceName: {
        type: 'string',
        description: 'Nombre del seguro a consultar (ej: GNP, MetLife, AXA)',
      },
      checkAccepted: {
        type: 'boolean',
        description: 'Verificar si un seguro específico es aceptado',
        default: false,
      },
      includeCoverage: {
        type: 'boolean',
        description: 'Incluir información general de cobertura',
        default: true,
      },
    },
    required: [],
  },

  requiredCapabilities: ['insurance_info'],
  requiresConfirmation: false,
  enabledFor: ['dental_standard', 'dental_complete'],
  timeout: 8000,

  handler: async (params, context): Promise<InsuranceInfoResult> => {
    const { insuranceName, checkAccepted = false, includeCoverage = true } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Build query for accepted insurances
      let query = supabase
        .from('accepted_insurances')
        .select(`
          id,
          insurance_name,
          insurance_code,
          coverage_types,
          notes,
          contact_phone,
          is_active,
          verification_required
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('insurance_name');

      // Filter by branch if applicable
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      // Filter by specific insurance if checking
      if (insuranceName && checkAccepted) {
        const normalizedName = normalizeInsuranceName(insuranceName);
        query = query.or(`insurance_name.ilike.%${normalizedName}%,insurance_code.ilike.%${normalizedName}%`);
      }

      const { data: insurances, error: queryError } = await query;

      if (queryError) {
        console.error('[GetInsuranceInfo] Query error:', queryError);
        // Try fallback to business_knowledge
        return await getInsurancesFromKnowledge(supabase, tenantId, insuranceName, locale);
      }

      // If checking specific insurance
      if (insuranceName && checkAccepted) {
        return handleSpecificInsuranceCheck(insurances || [], insuranceName, includeCoverage, locale);
      }

      // No insurances found - try knowledge base
      if (!insurances || insurances.length === 0) {
        return await getInsurancesFromKnowledge(supabase, tenantId, insuranceName, locale);
      }

      // Format all accepted insurances
      const formattedInsurances = formatInsurances(insurances, includeCoverage, locale);

      return {
        success: true,
        voiceMessage: formattedInsurances.voiceMessage,
        data: {
          insurances: formattedInsurances.insurances,
          totalAccepted: insurances.length,
        },
      };
    } catch (error) {
      console.error('[GetInsuranceInfo] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble getting insurance information. Please try again or ask our front desk."
          : 'Tengo problemas para obtener la información de seguros. Por favor intente de nuevo o pregunte en recepción.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface InsuranceRow {
  id: string;
  insurance_name: string;
  insurance_code: string | null;
  coverage_types: string[] | null;
  notes: string | null;
  contact_phone: string | null;
  is_active: boolean;
  verification_required: boolean | null;
}

interface FormattedInsurance {
  id: string;
  name: string;
  accepted: boolean;
  coverageTypes?: string[];
  notes?: string;
  contactPhone?: string;
}

/**
 * Handle check for a specific insurance
 */
function handleSpecificInsuranceCheck(
  insurances: InsuranceRow[],
  insuranceName: string,
  includeCoverage: boolean,
  locale: string
): InsuranceInfoResult {
  const normalizedSearch = normalizeInsuranceName(insuranceName);

  // Check if insurance was found
  const found = insurances.find(ins => {
    const normalizedName = normalizeInsuranceName(ins.insurance_name);
    const normalizedCode = ins.insurance_code ? normalizeInsuranceName(ins.insurance_code) : '';
    return normalizedName.includes(normalizedSearch) || normalizedCode.includes(normalizedSearch);
  });

  if (found) {
    // Insurance is accepted
    let coverageInfo = '';
    if (includeCoverage && found.coverage_types && found.coverage_types.length > 0) {
      const coverageList = formatListForVoice(found.coverage_types.slice(0, 3), locale);
      coverageInfo = locale === 'en'
        ? ` Coverage typically includes ${coverageList}.`
        : ` La cobertura típicamente incluye ${coverageList}.`;
    }

    const verificationNote = found.verification_required
      ? (locale === 'en'
          ? ' Please bring your insurance card so we can verify your specific coverage.'
          : ' Por favor traiga su tarjeta de seguro para que podamos verificar su cobertura específica.')
      : '';

    const voiceMessage = locale === 'en'
      ? `Yes, we accept ${found.insurance_name}.${coverageInfo}${verificationNote} Would you like to schedule an appointment?`
      : `Sí, aceptamos ${found.insurance_name}.${coverageInfo}${verificationNote} ¿Le gustaría agendar una cita?`;

    return {
      success: true,
      voiceMessage,
      data: {
        insurances: [{
          id: found.id,
          name: found.insurance_name,
          accepted: true,
          coverageTypes: found.coverage_types || undefined,
          notes: found.notes || undefined,
          contactPhone: found.contact_phone || undefined,
        }],
        totalAccepted: 1,
      },
    };
  } else {
    // Insurance not in accepted list
    const fullName = COMMON_INSURANCES[normalizedSearch]?.fullName || insuranceName;

    const voiceMessage = locale === 'en'
      ? `I'm not seeing ${fullName} in our list of accepted insurances. However, I recommend contacting our front desk to verify, as we may have recently added new insurances. Would you like me to transfer you to the front desk?`
      : `No veo ${fullName} en nuestra lista de seguros aceptados. Sin embargo, le recomiendo contactar a recepción para verificar, ya que podríamos haber agregado nuevos seguros recientemente. ¿Le gustaría que lo transfiera a recepción?`;

    return {
      success: true,
      voiceMessage,
      data: {
        insurances: [{
          id: 'not-found',
          name: fullName,
          accepted: false,
        }],
        totalAccepted: 0,
      },
    };
  }
}

/**
 * Format list of accepted insurances
 */
function formatInsurances(
  insurances: InsuranceRow[],
  includeCoverage: boolean,
  locale: string
): { voiceMessage: string; insurances: FormattedInsurance[] } {
  const formattedList: FormattedInsurance[] = insurances.map(ins => ({
    id: ins.id,
    name: ins.insurance_name,
    accepted: true,
    coverageTypes: ins.coverage_types || undefined,
    notes: ins.notes || undefined,
    contactPhone: ins.contact_phone || undefined,
  }));

  // Generate voice message
  let voiceMessage: string;

  if (formattedList.length === 0) {
    voiceMessage = locale === 'en'
      ? "I don't have our insurance list available at the moment. Would you like me to connect you with the front desk to verify?"
      : 'No tengo disponible nuestra lista de seguros en este momento. ¿Le gustaría que lo comunique con recepción para verificar?';
  } else if (formattedList.length <= 5) {
    // List all insurances
    const names = formattedList.map(i => i.name);
    const insuranceList = formatListForVoice(names, locale);

    voiceMessage = locale === 'en'
      ? `We accept the following dental insurances: ${insuranceList}. Do you have any of these insurances?`
      : `Aceptamos los siguientes seguros dentales: ${insuranceList}. ¿Cuenta con alguno de estos seguros?`;
  } else {
    // List top insurances and mention there are more
    const topNames = formattedList.slice(0, 5).map(i => i.name);
    const insuranceList = formatListForVoice(topNames, locale);
    const remaining = formattedList.length - 5;

    voiceMessage = locale === 'en'
      ? `We accept many dental insurances including ${insuranceList}, and ${remaining} more. Which insurance do you have so I can verify if we accept it?`
      : `Aceptamos varios seguros dentales incluyendo ${insuranceList}, y ${remaining} más. ¿Cuál seguro tiene para verificar si lo aceptamos?`;
  }

  return { voiceMessage, insurances: formattedList };
}

/**
 * Fallback: Get insurances from business_knowledge table
 */
async function getInsurancesFromKnowledge(
  supabase: ToolContext['supabase'],
  tenantId: string,
  insuranceName: string | undefined,
  locale: string
): Promise<InsuranceInfoResult> {
  try {
    const { data: knowledge, error } = await supabase
      .from('business_knowledge')
      .select('content, metadata')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .or('category.eq.insurance,category.eq.seguros,category.eq.insurances')
      .limit(1);

    if (error || !knowledge || knowledge.length === 0) {
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? "I don't have our insurance list available. Please ask our front desk about accepted insurances, and they'll be happy to help you verify your coverage."
          : 'No tengo disponible nuestra lista de seguros. Por favor pregunte en recepción sobre los seguros aceptados, con gusto le ayudarán a verificar su cobertura.',
        data: {
          insurances: [],
          totalAccepted: 0,
        },
      };
    }

    // Try to parse insurances from knowledge content
    const entry = knowledge[0];
    const insurances: FormattedInsurance[] = [];

    if (entry.metadata?.insurances && Array.isArray(entry.metadata.insurances)) {
      for (const ins of entry.metadata.insurances) {
        insurances.push({
          id: ins.id || `kb-${Math.random().toString(36).slice(2, 8)}`,
          name: ins.name,
          accepted: true,
          coverageTypes: ins.coverage_types,
          notes: ins.notes,
        });
      }
    }

    if (insurances.length === 0 && entry.content) {
      // Raw text fallback
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `Here's our insurance information: ${entry.content.substring(0, 250)}...`
          : `Aquí está nuestra información de seguros: ${entry.content.substring(0, 250)}...`,
        data: {
          insurances: [],
          totalAccepted: 0,
        },
      };
    }

    // If checking for specific insurance
    if (insuranceName) {
      const normalizedSearch = normalizeInsuranceName(insuranceName);
      const found = insurances.find(ins =>
        normalizeInsuranceName(ins.name).includes(normalizedSearch)
      );

      if (found) {
        return {
          success: true,
          voiceMessage: locale === 'en'
            ? `Yes, we accept ${found.name}. Would you like to schedule an appointment?`
            : `Sí, aceptamos ${found.name}. ¿Le gustaría agendar una cita?`,
          data: {
            insurances: [found],
            totalAccepted: 1,
          },
        };
      } else {
        return {
          success: true,
          voiceMessage: locale === 'en'
            ? `I'm not sure if we accept ${insuranceName}. I recommend verifying with our front desk. Would you like me to connect you?`
            : `No estoy seguro si aceptamos ${insuranceName}. Le recomiendo verificar con recepción. ¿Le gustaría que lo comunique?`,
          data: {
            insurances: [],
            totalAccepted: 0,
          },
        };
      }
    }

    const names = insurances.slice(0, 5).map(i => i.name);
    const insuranceList = formatListForVoice(names, locale);

    return {
      success: true,
      voiceMessage: locale === 'en'
        ? `We accept insurances including: ${insuranceList}. Which insurance do you have?`
        : `Aceptamos seguros incluyendo: ${insuranceList}. ¿Cuál seguro tiene usted?`,
      data: {
        insurances,
        totalAccepted: insurances.length,
      },
    };
  } catch (error) {
    console.error('[GetInsuranceInfo] Knowledge base error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voiceMessage: locale === 'en'
        ? "I couldn't retrieve insurance information. Please ask our front desk."
        : 'No pude obtener la información de seguros. Por favor pregunte en recepción.',
    };
  }
}

/**
 * Normalize insurance name for comparison
 */
function normalizeInsuranceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric
}

export default getInsuranceInfo;
