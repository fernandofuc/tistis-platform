/**
 * TIS TIS Platform - Messaging Agent v2.0
 * Template Messaging Compiler Service
 *
 * Compiles messaging assistant prompts using Handlebars templates.
 * This is the first step in the hybrid prompt system for MESSAGING:
 * 1. Template compilation (this service)
 * 2. Gemini enrichment with Knowledge Base (HybridMessagingPromptService)
 *
 * KEY DIFFERENCES FROM VOICE:
 * - Uses templates from 'templates/prompts/messaging/' directory
 * - Personality templates allow emojis and markdown
 * - No muletillas (voice filler phrases)
 * - Responses can be more detailed (user can re-read)
 *
 * @example
 * ```typescript
 * const compiled = await TemplateMessagingCompilerService.compileBasePrompt(
 *   tenantId,
 *   assistantConfig
 * );
 * console.log(compiled.basePrompt);
 * console.log(compiled.greetingMessage);
 * ```
 */

import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

import type {
  CompiledMessagingPrompt,
  MessagingTemplateVariables,
  MessagingAssistantConfig,
  MessagingAssistantTypeConfig,
  MessagingBusinessContext,
  MessagingCompilerConfig,
  Vertical,
} from './template-messaging-compiler.types';

import {
  DEFAULT_MESSAGING_COMPILER_CONFIG,
  VERTICAL_TO_BUSINESS_TYPE,
  getMessagingTemplateFileName,
  getMessagingPersonalityFileName,
} from './template-messaging-compiler.types';

import type { PersonalityType, Capability, Tool } from '@/lib/voice-agent/types';

// =====================================================
// SERVICE
// =====================================================

export class TemplateMessagingCompilerService {
  private static templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private static initialized = false;
  private static config: MessagingCompilerConfig = DEFAULT_MESSAGING_COMPILER_CONFIG;

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initialize the compiler with templates
   */
  static async initialize(config?: Partial<MessagingCompilerConfig>): Promise<void> {
    if (this.initialized) return;

    this.config = { ...DEFAULT_MESSAGING_COMPILER_CONFIG, ...config };
    await this.loadTemplates();
    this.initialized = true;
  }

  /**
   * Load all Handlebars templates from the messaging directory
   */
  private static async loadTemplates(): Promise<void> {
    const templatesPath = path.resolve(process.cwd(), this.config.templatesPath);

    try {
      await fs.access(templatesPath);
    } catch {
      console.warn(`[MessagingCompiler] Templates directory not found: ${templatesPath}`);
      return;
    }

    await this.loadTemplatesFromDir(templatesPath, '');
    console.log(`[MessagingCompiler] Loaded ${this.templates.size} messaging templates`);
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
          console.error(`[MessagingCompiler] Failed to compile ${templateName}:`, err);
        }
      }
    }
  }

  // =====================================================
  // MAIN COMPILE METHOD
  // =====================================================

  /**
   * Compile a base prompt using messaging templates
   *
   * @param tenantId - The tenant ID
   * @param assistantConfig - Assistant configuration (optional, will be loaded if not provided)
   * @returns Compiled messaging prompt with greeting message
   */
  static async compileBasePrompt(
    tenantId: string,
    assistantConfig?: MessagingAssistantConfig
  ): Promise<CompiledMessagingPrompt> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    // 1. Load or use provided config
    const config = assistantConfig || await this.loadAssistantConfig(tenantId);
    if (!config) {
      throw new Error(`Messaging assistant config not found for tenant ${tenantId}`);
    }

    // 2. Load assistant type (with fallback if specified type not found)
    let assistantType: MessagingAssistantTypeConfig;
    if (config.assistant_type_id) {
      try {
        assistantType = await this.loadAssistantType(config.assistant_type_id);
      } catch (error) {
        console.warn(`[MessagingCompiler] Assistant type ${config.assistant_type_id} not found, using default for tenant`);
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
    const templateName = getMessagingTemplateFileName(assistantType.vertical, assistantType.name);
    const template = this.templates.get(templateName);

    if (!template) {
      // Fallback to general_basic if specific template not found
      console.warn(`[MessagingCompiler] Template not found: ${templateName}, trying general fallback`);
      const fallbackTemplate = this.templates.get('general/general_basic');

      if (!fallbackTemplate) {
        console.error(`[MessagingCompiler] Available templates:`, Array.from(this.templates.keys()));
        throw new Error(`Template not found: ${templateName}. Available: ${Array.from(this.templates.keys()).join(', ')}`);
      }

      // Use fallback template
      return this.compileWithTemplate(fallbackTemplate, 'general/general_basic', config, assistantType, templateVars, startTime);
    }

    return this.compileWithTemplate(template, templateName, config, assistantType, templateVars, startTime);
  }

  /**
   * Compile template with given parameters
   */
  private static compileWithTemplate(
    template: Handlebars.TemplateDelegate,
    templateName: string,
    config: MessagingAssistantConfig,
    assistantType: MessagingAssistantTypeConfig,
    templateVars: MessagingTemplateVariables,
    startTime: number
  ): CompiledMessagingPrompt {
    // Load and compile personality section
    const personalityName = getMessagingPersonalityFileName(config.personality_type);
    const personalityTemplate = this.templates.get(personalityName);
    if (personalityTemplate) {
      templateVars.personalityStyle = personalityTemplate(templateVars);
    }

    // Render template
    let basePrompt: string;
    try {
      basePrompt = template(templateVars);
    } catch (err) {
      throw new Error(`Failed to render template ${templateName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Clean output
    basePrompt = this.cleanOutput(basePrompt);

    // Generate greeting message (messaging-specific)
    const greetingMessage = this.generateGreetingMessage(templateVars);

    const compileTime = Date.now() - startTime;
    console.log(`[MessagingCompiler] Compiled messaging prompt in ${compileTime}ms using template ${templateName}`);

    return {
      basePrompt,
      greetingMessage,
      capabilities: assistantType.enabled_capabilities,
      tools: assistantType.available_tools,
      templateVersion: `${assistantType.template_version}`,
      compiledAt: new Date().toISOString(),
      templateName,
      personality: config.personality_type,
      channel: 'messaging',
    };
  }

  // =====================================================
  // DATA LOADING
  // =====================================================

  /**
   * Load messaging assistant config from DB
   * Falls back to voice_assistant_configs if dedicated messaging config doesn't exist
   */
  private static async loadAssistantConfig(tenantId: string): Promise<MessagingAssistantConfig | null> {
    const supabase = this.createServiceClient();

    // First try to find a dedicated messaging config
    const { data: messagingConfig } = await supabase
      .from('messaging_assistant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (messagingConfig) {
      return messagingConfig as MessagingAssistantConfig;
    }

    // Fallback to voice config if no dedicated messaging config exists
    const { data: voiceConfig, error } = await supabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !voiceConfig) {
      console.warn(`[MessagingCompiler] No assistant config for tenant ${tenantId}`);
      return null;
    }

    // Convert voice config to messaging config format
    return {
      id: voiceConfig.id,
      tenant_id: voiceConfig.tenant_id,
      assistant_type_id: voiceConfig.assistant_type_id,
      assistant_name: voiceConfig.assistant_name,
      personality_type: voiceConfig.personality_type,
      special_instructions: voiceConfig.special_instructions,
      is_active: voiceConfig.is_active,
      compiled_prompt: null,
      compiled_prompt_at: null,
    } as MessagingAssistantConfig;
  }

  /**
   * Load assistant type from DB
   */
  private static async loadAssistantType(typeId: string): Promise<MessagingAssistantTypeConfig> {
    const supabase = this.createServiceClient();

    const { data, error } = await supabase
      .from('voice_assistant_types') // Same types table for now
      .select('*')
      .eq('id', typeId)
      .single();

    if (error || !data) {
      throw new Error(`Assistant type not found: ${typeId}`);
    }

    return data as MessagingAssistantTypeConfig;
  }

  /**
   * Load default assistant type for tenant's vertical
   */
  private static async loadDefaultAssistantType(tenantId: string): Promise<MessagingAssistantTypeConfig> {
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
        return fallback as MessagingAssistantTypeConfig;
      }

      // Ultimate fallback: create a minimal type based on vertical
      const getTemplateName = (v: Vertical): string => {
        if (v === 'restaurant') return 'rest_basic';
        if (v === 'dental') return 'dental_basic';
        return 'general_basic';
      };

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

    return data as MessagingAssistantTypeConfig;
  }

  /**
   * Load business context for templates
   */
  private static async loadBusinessContext(tenantId: string): Promise<MessagingBusinessContext> {
    const supabase = this.createServiceClient();

    // Load tenant, branches, services, and staff in parallel
    const [tenantResult, branchesResult, servicesResult, staffResult] = await Promise.all([
      supabase.from('tenants').select('name, vertical').eq('id', tenantId).single(),
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
    };
  }

  // =====================================================
  // TEMPLATE VARIABLE BUILDING
  // =====================================================

  /**
   * Build template variables from config and context
   */
  private static buildTemplateVariables(
    config: MessagingAssistantConfig,
    assistantType: MessagingAssistantTypeConfig,
    businessContext: MessagingBusinessContext
  ): MessagingTemplateVariables {
    const now = new Date();
    const businessType = VERTICAL_TO_BUSINESS_TYPE[assistantType.vertical] || 'negocio';

    // Get primary branch info
    const primaryBranch = businessContext.branches.find(b => b.isHeadquarters) || businessContext.branches[0];

    // Format operating hours
    const operatingHoursStr = this.formatOperatingHours(primaryBranch?.operatingHours);

    // Map staff to doctors format for dental
    const doctors = businessContext.staff.map(s => ({
      title: s.title || 'Dr.',
      name: s.name,
      specialty: s.specialty,
      availableDays: undefined,
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
    };
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Generate greeting message for messaging channel
   * Unlike voice, this can include emojis
   */
  private static generateGreetingMessage(vars: MessagingTemplateVariables): string {
    return `¡Hola! 👋 Soy ${vars.assistantName} de **${vars.businessName}**. ¿En qué puedo ayudarte?`;
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

    const firstDay = openDays[0];
    const firstHours = hours[firstDay];

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
 * Create and initialize the messaging template compiler
 */
export async function createMessagingTemplateCompiler(
  config?: Partial<MessagingCompilerConfig>
): Promise<typeof TemplateMessagingCompilerService> {
  await TemplateMessagingCompilerService.initialize(config);
  return TemplateMessagingCompilerService;
}
