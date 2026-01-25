/**
 * TIS TIS Platform - Voice Agent v2.0
 * Template Prompt Compiler Service
 *
 * Compiles voice assistant prompts using Handlebars templates.
 * This is the first step in the hybrid prompt system:
 * 1. Template compilation (this service)
 * 2. Gemini enrichment with Knowledge Base (PromptGeneratorService)
 *
 * @example
 * ```typescript
 * const compiled = await TemplatePromptCompilerService.compileBasePrompt(
 *   tenantId,
 *   voiceConfig
 * );
 * console.log(compiled.basePrompt);
 * console.log(compiled.firstMessage);
 * ```
 */

import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

import type {
  CompiledBasePrompt,
  TemplateVariables,
  VoiceAssistantDbConfig,
  AssistantTypeDbConfig,
  TemplateBusinessContext,
  TemplateCompilerConfig,
} from './template-prompt-compiler.types';

import {
  DEFAULT_COMPILER_CONFIG,
  VERTICAL_TO_BUSINESS_TYPE,
  VERTICAL_TO_MAIN_TASK,
  getTemplateFileName,
  getPersonalityFileName,
} from './template-prompt-compiler.types';

import type { PersonalityType, Capability, Tool } from '../types';
import type { Vertical } from './template-prompt-compiler.types';

// =====================================================
// SERVICE
// =====================================================

export class TemplatePromptCompilerService {
  private static templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private static initialized = false;
  private static config: TemplateCompilerConfig = DEFAULT_COMPILER_CONFIG;

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initialize the compiler with templates
   */
  static async initialize(config?: Partial<TemplateCompilerConfig>): Promise<void> {
    if (this.initialized) return;

    this.config = { ...DEFAULT_COMPILER_CONFIG, ...config };
    await this.loadTemplates();
    this.initialized = true;
  }

  /**
   * Load all Handlebars templates from disk
   */
  private static async loadTemplates(): Promise<void> {
    const templatesPath = path.resolve(process.cwd(), this.config.templatesPath);

    try {
      await fs.access(templatesPath);
    } catch {
      console.warn(`[TemplateCompiler] Templates directory not found: ${templatesPath}`);
      return;
    }

    await this.loadTemplatesFromDir(templatesPath, '');
    console.log(`[TemplateCompiler] Loaded ${this.templates.size} templates`);
  }

  /**
   * Recursively load templates from directory
   */
  private static async loadTemplatesFromDir(dirPath: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        await this.loadTemplatesFromDir(fullPath, newPrefix);
      } else if (entry.name.endsWith('.hbs')) {
        const templateName = prefix
          ? `${prefix}/${entry.name.replace('.hbs', '')}`
          : entry.name.replace('.hbs', '');
        const content = await fs.readFile(fullPath, 'utf-8');

        try {
          const compiled = Handlebars.compile(content);
          this.templates.set(templateName, compiled);
        } catch (err) {
          console.error(`[TemplateCompiler] Failed to compile ${templateName}:`, err);
        }
      }
    }
  }

  // =====================================================
  // MAIN COMPILE METHOD
  // =====================================================

  /**
   * Compile a base prompt using templates
   *
   * @param tenantId - The tenant ID
   * @param voiceConfig - Voice assistant configuration from DB
   * @returns Compiled base prompt with first message
   */
  static async compileBasePrompt(
    tenantId: string,
    voiceConfig?: VoiceAssistantDbConfig
  ): Promise<CompiledBasePrompt> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    // 1. Load voice config if not provided
    const config = voiceConfig || await this.loadVoiceConfig(tenantId);
    if (!config) {
      throw new Error(`Voice config not found for tenant ${tenantId}`);
    }

    // 2. Load assistant type (with fallback if specified type not found)
    let assistantType: AssistantTypeDbConfig;
    if (config.assistant_type_id) {
      try {
        assistantType = await this.loadAssistantType(config.assistant_type_id);
      } catch (error) {
        console.warn(`[TemplateCompiler] Assistant type ${config.assistant_type_id} not found, using default for tenant`);
        assistantType = await this.loadDefaultAssistantType(tenantId);
      }
    } else {
      assistantType = await this.loadDefaultAssistantType(tenantId);
    }

    // 3. Load business context
    const businessContext = await this.loadBusinessContext(tenantId);

    // 4. Build template variables
    const templateVars = this.buildTemplateVariables(config, assistantType, businessContext);

    // 5. Get template name
    const templateName = getTemplateFileName(assistantType.vertical, assistantType.name);
    const template = this.templates.get(templateName);

    if (!template) {
      console.error(`[TemplateCompiler] Template not found: ${templateName}`);
      console.error(`[TemplateCompiler] Available templates:`, Array.from(this.templates.keys()));
      throw new Error(`Template not found: ${templateName}. Available: ${Array.from(this.templates.keys()).join(', ')}`);
    }

    // 6. Load and compile personality section
    const personalityName = getPersonalityFileName(config.personality_type);
    const personalityTemplate = this.templates.get(personalityName);
    if (personalityTemplate) {
      templateVars.personalityStyle = personalityTemplate(templateVars);
    }

    // 7. Render template
    let basePrompt: string;
    try {
      basePrompt = template(templateVars);
    } catch (err) {
      throw new Error(`Failed to render template ${templateName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // 8. Clean output
    basePrompt = this.cleanOutput(basePrompt);

    // 9. Generate first message
    const firstMessage = this.generateFirstMessage(templateVars);

    const compileTime = Date.now() - startTime;
    console.log(`[TemplateCompiler] Compiled prompt in ${compileTime}ms using template ${templateName}`);

    return {
      basePrompt,
      firstMessage,
      capabilities: assistantType.enabled_capabilities,
      tools: assistantType.available_tools,
      templateVersion: `${assistantType.template_version}`,
      compiledAt: new Date().toISOString(),
      templateName,
      personality: config.personality_type,
    };
  }

  // =====================================================
  // DATA LOADING
  // =====================================================

  /**
   * Load voice assistant config from DB
   */
  private static async loadVoiceConfig(tenantId: string): Promise<VoiceAssistantDbConfig | null> {
    const supabase = this.createServiceClient();

    const { data, error } = await supabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn(`[TemplateCompiler] No active voice config for tenant ${tenantId}`);
      return null;
    }

    return data as VoiceAssistantDbConfig;
  }

  /**
   * Load assistant type from DB
   */
  private static async loadAssistantType(typeId: string): Promise<AssistantTypeDbConfig> {
    const supabase = this.createServiceClient();

    const { data, error } = await supabase
      .from('voice_assistant_types')
      .select('*')
      .eq('id', typeId)
      .single();

    if (error || !data) {
      throw new Error(`Assistant type not found: ${typeId}`);
    }

    return data as AssistantTypeDbConfig;
  }

  /**
   * Load default assistant type for tenant's vertical
   */
  private static async loadDefaultAssistantType(tenantId: string): Promise<AssistantTypeDbConfig> {
    const supabase = this.createServiceClient();

    // Get tenant vertical
    const { data: tenant } = await supabase
      .from('tenants')
      .select('vertical')
      .eq('id', tenantId)
      .single();

    const vertical = (tenant?.vertical || 'general') as Vertical;

    // Get default type for vertical
    const { data, error } = await supabase
      .from('voice_assistant_types')
      .select('*')
      .eq('vertical', vertical)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Fallback to any active type for this vertical
      const { data: fallback } = await supabase
        .from('voice_assistant_types')
        .select('*')
        .eq('vertical', vertical)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (fallback) {
        return fallback as AssistantTypeDbConfig;
      }

      // Ultimate fallback: create a minimal type based on vertical
      // Map vertical to template name - only restaurant and dental have specific templates
      const getTemplateName = (v: Vertical): string => {
        if (v === 'restaurant') return 'rest_basic';
        if (v === 'dental') return 'dental_basic';
        return 'general_basic';
      };

      // Use 'general' vertical for unsupported verticals
      const normalizedVertical: Vertical = (vertical === 'restaurant' || vertical === 'dental')
        ? vertical
        : 'general';

      return {
        id: 'default',
        vertical: normalizedVertical,
        name: getTemplateName(vertical),
        display_name: 'Básico',
        description: null,
        enabled_capabilities: ['business_hours', 'business_info', 'human_transfer'] as Capability[],
        available_tools: ['get_business_hours', 'transfer_to_human'] as Tool[],
        template_version: 1,
        is_default: true,
        is_active: true,
      };
    }

    return data as AssistantTypeDbConfig;
  }

  /**
   * Load business context for templates
   */
  private static async loadBusinessContext(tenantId: string): Promise<TemplateBusinessContext> {
    const supabase = this.createServiceClient();

    // Load tenant, branches, services, and staff in parallel
    const [tenantResult, branchesResult, servicesResult, staffResult] = await Promise.all([
      supabase.from('tenants').select('name, vertical, service_options').eq('id', tenantId).single(),
      supabase.from('branches')
        .select('name, address, city, phone, operating_hours, is_headquarters')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false })
        .limit(5),
      supabase.from('services')
        .select('name, description, ai_description, price_min, price_max, duration_minutes, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(20),
      supabase.from('staff')
        .select('first_name, last_name, display_name, role, specialty')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('role', ['dentist', 'specialist', 'owner', 'manager', 'doctor'])
        .limit(10),
    ]);

    const tenant = tenantResult.data;
    const branches = branchesResult.data || [];
    const services = servicesResult.data || [];
    const staff = staffResult.data || [];

    // Extract delivery configuration from service_options (Migration 156)
    const serviceOptions = tenant?.service_options as {
      delivery_enabled?: boolean;
      delivery_config?: {
        max_radius_km?: number;
        delivery_fee?: number;
        minimum_order_amount?: number;
        estimated_time_minutes?: number;
      };
    } | null;

    const deliveryEnabled = serviceOptions?.delivery_enabled ?? false;
    const deliveryConfig = serviceOptions?.delivery_config;

    return {
      tenantId,
      tenantName: tenant?.name || 'Negocio',
      vertical: (tenant?.vertical || 'general') as Vertical,
      branches: branches.map(b => ({
        name: b.name,
        address: b.address || undefined,
        city: b.city || undefined,
        phone: b.phone || undefined,
        operatingHours: b.operating_hours as Record<string, { open: string; close: string }> | undefined,
        isHeadquarters: b.is_headquarters || false,
      })),
      services: services.map(s => ({
        name: s.name,
        description: s.ai_description || s.description || undefined,
        priceMin: s.price_min || undefined,
        priceMax: s.price_max || undefined,
        durationMinutes: s.duration_minutes || undefined,
        category: s.category || undefined,
      })),
      staff: staff.map(s => ({
        name: s.display_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Staff',
        role: s.role || undefined,
        specialty: s.specialty || undefined,
        title: this.getRoleTitle(s.role),
      })),
      // Delivery configuration (added in v2.1 - Migration 156)
      deliveryEnabled,
      deliveryConfig: deliveryEnabled && deliveryConfig ? {
        maxRadiusKm: deliveryConfig.max_radius_km ?? 5,
        deliveryFee: deliveryConfig.delivery_fee ?? 0,
        minimumOrderAmount: deliveryConfig.minimum_order_amount,
        estimatedTimeMinutes: deliveryConfig.estimated_time_minutes ?? 30,
      } : undefined,
    };
  }

  // =====================================================
  // TEMPLATE VARIABLE BUILDING
  // =====================================================

  /**
   * Build template variables from config and context
   */
  private static buildTemplateVariables(
    config: VoiceAssistantDbConfig,
    assistantType: AssistantTypeDbConfig,
    businessContext: TemplateBusinessContext
  ): TemplateVariables {
    const now = new Date();
    const businessType = VERTICAL_TO_BUSINESS_TYPE[assistantType.vertical] || 'negocio';

    // Get primary branch info
    const primaryBranch = businessContext.branches.find(b => b.isHeadquarters) || businessContext.branches[0];

    // Format operating hours
    const operatingHoursStr = this.formatOperatingHours(primaryBranch?.operatingHours);

    // Generate first message
    const firstMessage = config.first_message ||
      `Hola, soy ${config.assistant_name} del ${businessType} ${businessContext.tenantName}. ¿Cómo puedo ayudarte el día de hoy?`;

    // Map staff to doctors format for dental
    const doctors = businessContext.staff.map(s => ({
      title: s.title || 'Dr.',
      name: s.name,
      specialty: s.specialty,
      availableDays: undefined, // Would need to load from schedule
    }));

    // Map services with price ranges
    const services = businessContext.services.map(s => ({
      name: s.name,
      description: s.description,
      priceRange: s.priceMin && s.priceMax
        ? `$${s.priceMin} - $${s.priceMax}`
        : s.priceMin
          ? `desde $${s.priceMin}`
          : undefined,
    }));

    return {
      // Identity
      assistantName: config.assistant_name,
      businessName: businessContext.tenantName,
      businessType,
      accent: 'mexicano',

      // First message
      firstMessage,

      // Business info
      businessAddress: primaryBranch?.address,
      businessPhone: primaryBranch?.phone,
      operatingDays: operatingHoursStr.days,
      operatingHours: operatingHoursStr.hours,

      // Time context
      currentDate: this.formatDate(now),
      currentTime: this.formatTime(now),

      // Booking policy (defaults)
      bookingPolicy: {
        minAdvanceHours: 2,
        maxAdvanceDays: 30,
        maxPartySize: assistantType.vertical === 'restaurant' ? 10 : undefined,
        defaultDurationMinutes: assistantType.vertical === 'dental' ? 60 : undefined,
        cancellationPolicy: 'Se recomienda cancelar con al menos 4 horas de anticipación.',
      },

      // Special instructions
      specialInstructions: config.special_instructions || undefined,

      // Vertical-specific
      doctors: assistantType.vertical === 'dental' ? doctors : undefined,
      services: assistantType.vertical === 'dental' ? services : undefined,

      // Delivery configuration (added in v2.1 - Migration 156)
      deliveryEnabled: businessContext.deliveryEnabled,
      deliveryConfig: businessContext.deliveryConfig,
      currency: 'MXN',
    };
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Generate first message for the assistant
   */
  private static generateFirstMessage(vars: TemplateVariables): string {
    return vars.firstMessage;
  }

  /**
   * Clean rendered output
   */
  private static cleanOutput(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  /**
   * Format operating hours for display
   */
  private static formatOperatingHours(
    hours?: Record<string, { open: string; close: string }>
  ): { days: string; hours: string } {
    if (!hours || Object.keys(hours).length === 0) {
      return { days: 'Lunes a Viernes', hours: 'de 9:00 a 18:00' };
    }

    const dayNames: Record<string, string> = {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo',
    };

    const openDays = Object.keys(hours).filter(day => hours[day]);
    if (openDays.length === 0) {
      return { days: '', hours: '' };
    }

    // Get first day's hours as representative
    const firstDay = openDays[0];
    const firstHours = hours[firstDay];

    // Format days
    let daysStr = '';
    if (openDays.length === 7) {
      daysStr = 'todos los días';
    } else if (openDays.length >= 5 && openDays.includes('monday') && openDays.includes('friday')) {
      daysStr = openDays.includes('saturday')
        ? 'Lunes a Sábado'
        : 'Lunes a Viernes';
    } else {
      daysStr = openDays.map(d => dayNames[d] || d).join(', ');
    }

    return {
      days: daysStr,
      hours: firstHours ? `de ${firstHours.open} a ${firstHours.close}` : '',
    };
  }

  /**
   * Format date in Spanish
   */
  private static formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('es-MX', options);
  }

  /**
   * Format time in Spanish
   */
  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get role title in Spanish
   */
  private static getRoleTitle(role?: string): string {
    const titles: Record<string, string> = {
      dentist: 'Dr.',
      doctor: 'Dr.',
      specialist: 'Esp.',
      owner: '',
      manager: '',
    };
    return titles[role || ''] || '';
  }

  /**
   * Create Supabase service client
   */
  private static createServiceClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Check if compiler is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get loaded template names
   */
  static getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Clear template cache
   */
  static clearCache(): void {
    this.templates.clear();
    this.initialized = false;
  }

  /**
   * Check if a template exists
   */
  static hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create and initialize the template compiler
 */
export async function createTemplateCompiler(
  config?: Partial<TemplateCompilerConfig>
): Promise<typeof TemplatePromptCompilerService> {
  await TemplatePromptCompilerService.initialize(config);
  return TemplatePromptCompilerService;
}
