/**
 * TIS TIS Platform - Voice Agent v2.0
 * Template Engine
 *
 * Handlebars-based template engine for generating dynamic voice prompts.
 * Features:
 * - Custom helpers for voice-friendly formatting
 * - Template caching
 * - i18n support
 * - Personality injection
 * - Dynamic context injection
 *
 * @example
 * ```typescript
 * const engine = new VoiceTemplateEngine();
 * await engine.initialize();
 *
 * const prompt = await engine.renderPrompt(config, businessContext);
 * console.log(prompt.content);
 * ```
 */

import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  BusinessContext,
  DynamicContext,
  VoiceAssistantConfig,
  RenderOptions,
  RenderedPrompt,
  PromptValidationResult,
  PromptValidationError,
  TemplateEngineConfig,
  I18nTranslations,
  TimeOfDay,
  SupportedLocale,
  DaySchedule,
  WeeklySchedule,
  TemplateHelperContext,
} from './types';
import {
  DEFAULT_TEMPLATE_ENGINE_CONFIG,
  DEFAULT_LOCALE,
} from './types';
import type { Capability, PersonalityType } from '../types';

// =====================================================
// TEMPLATE ENGINE CLASS
// =====================================================

/**
 * Voice Template Engine using Handlebars
 */
export class VoiceTemplateEngine {
  private readonly config: TemplateEngineConfig;
  private readonly handlebars: typeof Handlebars;
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private i18nCache: Map<SupportedLocale, I18nTranslations> = new Map();
  private initialized = false;

  constructor(config?: Partial<TemplateEngineConfig>) {
    this.config = { ...DEFAULT_TEMPLATE_ENGINE_CONFIG, ...config };
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initialize the template engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadTemplates();
    await this.loadI18n();
    this.initialized = true;
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // =====================================================
  // HANDLEBARS HELPERS
  // =====================================================

  /**
   * Register all custom Handlebars helpers
   */
  private registerHelpers(): void {
    const hbs = this.handlebars;

    // ===== formatSchedule =====
    // Formats a schedule for voice output
    hbs.registerHelper(
      'formatSchedule',
      function (schedule: WeeklySchedule | DaySchedule[], options) {
        const days = Array.isArray(schedule) ? schedule : schedule.days;
        if (!days || days.length === 0) return 'Horario no disponible';

        const openDays = days.filter((d) => d.isOpen);
        if (openDays.length === 0) return 'Cerrado';

        // Group consecutive days with same hours
        const groups: { days: string[]; hours: string }[] = [];
        let currentGroup: { days: string[]; hours: string } | null = null;

        for (const day of openDays) {
          const hours = `${day.openTime} a ${day.closeTime}`;
          if (currentGroup && currentGroup.hours === hours) {
            currentGroup.days.push(day.dayName);
          } else {
            if (currentGroup) groups.push(currentGroup);
            currentGroup = { days: [day.dayName], hours };
          }
        }
        if (currentGroup) groups.push(currentGroup);

        // Format groups
        const parts = groups.map((g) => {
          const daysStr =
            g.days.length === 1
              ? g.days[0]
              : g.days.length === 2
                ? `${g.days[0]} y ${g.days[1]}`
                : `${g.days[0]} a ${g.days[g.days.length - 1]}`;
          return `${daysStr} de ${g.hours}`;
        });

        return parts.join(', ');
      }
    );

    // ===== formatTodaySchedule =====
    // Formats today's schedule for voice
    hbs.registerHelper('formatTodaySchedule', function (day: DaySchedule) {
      if (!day || !day.isOpen) {
        return 'Hoy estamos cerrados';
      }

      const openFormatted = formatTimeForVoice(day.openTime || '');
      const closeFormatted = formatTimeForVoice(day.closeTime || '');

      if (day.breakStart && day.breakEnd) {
        const breakStartFormatted = formatTimeForVoice(day.breakStart);
        const breakEndFormatted = formatTimeForVoice(day.breakEnd);
        return `Hoy abrimos de ${openFormatted} a ${breakStartFormatted}, cerramos para descanso y reabrimos de ${breakEndFormatted} a ${closeFormatted}`;
      }

      return `Hoy abrimos de ${openFormatted} a ${closeFormatted}`;
    });

    // ===== listItems =====
    // Lists items naturally: "a, b y c"
    hbs.registerHelper('listItems', function (items: string[], options) {
      if (!items || items.length === 0) return '';
      if (items.length === 1) return items[0];
      if (items.length === 2) return `${items[0]} y ${items[1]}`;

      const last = items[items.length - 1];
      const rest = items.slice(0, -1);
      return `${rest.join(', ')} y ${last}`;
    });

    // ===== listItemsOr =====
    // Lists items with "or": "a, b o c"
    hbs.registerHelper('listItemsOr', function (items: string[], options) {
      if (!items || items.length === 0) return '';
      if (items.length === 1) return items[0];
      if (items.length === 2) return `${items[0]} o ${items[1]}`;

      const last = items[items.length - 1];
      const rest = items.slice(0, -1);
      return `${rest.join(', ')} o ${last}`;
    });

    // ===== formatPrice =====
    // Formats price for voice output
    hbs.registerHelper(
      'formatPrice',
      function (price: number, currency?: string) {
        if (typeof price !== 'number') return 'precio no disponible';

        const curr = currency || 'MXN';
        const rounded = Math.round(price);

        if (curr === 'MXN' || curr === 'pesos') {
          if (rounded === 1) return 'un peso';
          return `${rounded} pesos`;
        }
        if (curr === 'USD' || curr === 'dollars') {
          if (rounded === 1) return 'un dólar';
          return `${rounded} dólares`;
        }

        return `${rounded} ${curr}`;
      }
    );

    // ===== formatPriceRange =====
    // Formats a price range
    hbs.registerHelper(
      'formatPriceRange',
      function (from: number, to: number, currency?: string) {
        if (typeof from !== 'number') return 'precio no disponible';

        const curr = currency || 'pesos';
        if (!to || from === to) {
          return `${from} ${curr}`;
        }
        return `entre ${from} y ${to} ${curr}`;
      }
    );

    // ===== ifCapability =====
    // Conditional based on capability
    hbs.registerHelper(
      'ifCapability',
      function (this: TemplateHelperContext, cap: Capability, options) {
        const capabilities = this.config?.enabledCapabilities || [];
        if (capabilities.includes(cap)) {
          return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : '';
      }
    );

    // ===== unlessCapability =====
    // Inverse of ifCapability
    hbs.registerHelper(
      'unlessCapability',
      function (this: TemplateHelperContext, cap: Capability, options) {
        const capabilities = this.config?.enabledCapabilities || [];
        if (!capabilities.includes(cap)) {
          return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : '';
      }
    );

    // ===== relativeTime =====
    // Formats time relative to now
    hbs.registerHelper('relativeTime', function (date: Date | string) {
      const target = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffMs = target.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins < 0) {
        const absMins = Math.abs(diffMins);
        if (absMins < 60) return `hace ${absMins} minutos`;
        const hours = Math.round(absMins / 60);
        if (hours === 1) return 'hace una hora';
        return `hace ${hours} horas`;
      }

      if (diffMins < 60) {
        if (diffMins === 1) return 'en un minuto';
        return `en ${diffMins} minutos`;
      }

      const hours = Math.round(diffMins / 60);
      if (hours === 1) return 'en una hora';
      return `en ${hours} horas`;
    });

    // ===== formatDuration =====
    // Formats duration in minutes
    hbs.registerHelper('formatDuration', function (minutes: number) {
      if (typeof minutes !== 'number') return '';

      if (minutes < 60) {
        if (minutes === 1) return 'un minuto';
        return `${minutes} minutos`;
      }

      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;

      if (remainingMins === 0) {
        if (hours === 1) return 'una hora';
        return `${hours} horas`;
      }

      const hourPart = hours === 1 ? 'una hora' : `${hours} horas`;
      const minPart = remainingMins === 1 ? 'un minuto' : `${remainingMins} minutos`;
      return `${hourPart} y ${minPart}`;
    });

    // ===== greeting =====
    // Returns appropriate greeting for time of day
    hbs.registerHelper(
      'greeting',
      function (this: TemplateHelperContext, options) {
        const timeOfDay = this.timeOfDay || getTimeOfDay(new Date());
        const i18n = this.i18n;

        if (i18n?.greetings) {
          return i18n.greetings[timeOfDay] || i18n.greetings.generic;
        }

        // Fallback
        switch (timeOfDay) {
          case 'morning':
            return 'Buenos días';
          case 'afternoon':
            return 'Buenas tardes';
          case 'evening':
          case 'night':
            return 'Buenas noches';
          default:
            return 'Hola';
        }
      }
    );

    // ===== t (translate) =====
    // Translation helper
    hbs.registerHelper(
      't',
      function (this: TemplateHelperContext, key: string, options) {
        const i18n = this.i18n;
        if (!i18n) return key;

        // Navigate nested keys like "phrases.welcome"
        const keys = key.split('.');
        let value: unknown = i18n;

        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = (value as Record<string, unknown>)[k];
          } else {
            return key; // Key not found, return as-is
          }
        }

        return typeof value === 'string' ? value : key;
      }
    );

    // ===== ifEqual =====
    // Equality comparison
    hbs.registerHelper(
      'ifEqual',
      function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
        if (a === b) {
          return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : '';
      }
    );

    // ===== ifGreater =====
    // Greater than comparison
    hbs.registerHelper(
      'ifGreater',
      function (this: unknown, a: number, b: number, options: Handlebars.HelperOptions) {
        if (a > b) {
          return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : '';
      }
    );

    // ===== count =====
    // Returns count of array
    hbs.registerHelper('count', function (arr: unknown[]) {
      return Array.isArray(arr) ? arr.length : 0;
    });

    // ===== first =====
    // Returns first n items
    hbs.registerHelper('first', function (arr: unknown[], n: number) {
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, n || 1);
    });

    // ===== join =====
    // Joins array with separator
    hbs.registerHelper('join', function (arr: string[], sep: string) {
      if (!Array.isArray(arr)) return '';
      return arr.join(sep || ', ');
    });

    // ===== uppercase =====
    hbs.registerHelper('uppercase', function (str: string) {
      return typeof str === 'string' ? str.toUpperCase() : '';
    });

    // ===== lowercase =====
    hbs.registerHelper('lowercase', function (str: string) {
      return typeof str === 'string' ? str.toLowerCase() : '';
    });

    // ===== capitalize =====
    hbs.registerHelper('capitalize', function (str: string) {
      if (typeof str !== 'string' || str.length === 0) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
  }

  // =====================================================
  // TEMPLATE LOADING
  // =====================================================

  /**
   * Load all templates from disk
   */
  private async loadTemplates(): Promise<void> {
    const templatesPath = path.resolve(process.cwd(), this.config.templatesPath);

    // Check if templates directory exists
    try {
      await fs.access(templatesPath);
    } catch {
      console.warn(
        `[VoiceTemplateEngine] Templates directory not found: ${templatesPath}`
      );
      return;
    }

    // Load templates recursively
    await this.loadTemplatesFromDir(templatesPath, '');
  }

  /**
   * Recursively load templates from a directory
   */
  private async loadTemplatesFromDir(
    dirPath: string,
    prefix: string
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        await this.loadTemplatesFromDir(fullPath, newPrefix);
      } else if (entry.name.endsWith('.hbs')) {
        const templateName = this.extractTemplateName(entry.name, prefix);
        const content = await fs.readFile(fullPath, 'utf-8');

        try {
          const compiled = this.handlebars.compile(content);
          this.templates.set(templateName, compiled);
        } catch (err) {
          console.error(
            `[VoiceTemplateEngine] Failed to compile template ${templateName}:`,
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      }
    }
  }

  /**
   * Extract template name from file path
   */
  private extractTemplateName(fileName: string, prefix: string): string {
    const baseName = fileName.replace('.hbs', '');
    return prefix ? `${prefix}/${baseName}` : baseName;
  }

  /**
   * Get a compiled template by name
   */
  getTemplate(name: string): Handlebars.TemplateDelegate | null {
    return this.templates.get(name) ?? null;
  }

  /**
   * Check if a template exists
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Get all loaded template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  // =====================================================
  // I18N LOADING
  // =====================================================

  /**
   * Load i18n files
   */
  private async loadI18n(): Promise<void> {
    const i18nPath = path.resolve(
      process.cwd(),
      this.config.templatesPath,
      'i18n'
    );

    try {
      await fs.access(i18nPath);
    } catch {
      console.warn(`[VoiceTemplateEngine] i18n directory not found: ${i18nPath}`);
      return;
    }

    const entries = await fs.readdir(i18nPath);

    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        const locale = entry.replace('.json', '') as SupportedLocale;
        const content = await fs.readFile(path.join(i18nPath, entry), 'utf-8');

        try {
          const translations = JSON.parse(content) as I18nTranslations;
          this.i18nCache.set(locale, translations);
        } catch (err) {
          console.error(
            `[VoiceTemplateEngine] Failed to parse i18n file ${entry}:`,
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      }
    }
  }

  /**
   * Get i18n translations for a locale
   */
  getI18n(locale: SupportedLocale): I18nTranslations | null {
    return this.i18nCache.get(locale) ?? null;
  }

  // =====================================================
  // MAIN RENDER METHOD
  // =====================================================

  /**
   * Render a complete prompt for a voice assistant
   */
  async renderPrompt(
    config: VoiceAssistantConfig,
    context: BusinessContext,
    dynamicContext?: DynamicContext,
    options?: RenderOptions
  ): Promise<RenderedPrompt> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const opts = options || {};
    const startTime = Date.now();

    // Determine template name
    const templateName = this.getTemplateName(config.typeId);
    const template = this.getTemplate(templateName);

    if (!template) {
      throw new Error(
        `Template not found: ${templateName}. Available: ${this.getTemplateNames().join(', ')}`
      );
    }

    // Get personality partial
    const personalityTemplate = this.getTemplate(
      `personalities/${config.personality}`
    );

    // Get i18n
    const i18n = this.getI18n(config.locale) || this.getI18n(DEFAULT_LOCALE);

    // Build template context
    const now = new Date();
    const templateContext: TemplateHelperContext = {
      business: context,
      config,
      i18n: i18n!,
      dynamic: dynamicContext,
      now,
      timeOfDay: getTimeOfDay(now),
    };

    // Render personality section
    let personalitySection = '';
    if (personalityTemplate) {
      personalitySection = personalityTemplate(templateContext);
    }

    // Add personality to context
    const fullContext = {
      ...templateContext,
      personalitySection,
      personality: config.personality,
    };

    // Render main template
    let content: string;
    try {
      content = template(fullContext);
    } catch (err) {
      throw new Error(
        `Failed to render template ${templateName}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // Clean up output
    content = this.cleanOutput(content);

    // Validate if required
    let validationErrors: string[] = [];
    let isValid = true;

    if (this.config.validateOnRender || opts.validateLength) {
      const validation = this.validatePrompt(content);
      isValid = validation.valid;
      validationErrors = validation.errors.map((e) => e.message);
    }

    // Build result
    const result: RenderedPrompt = {
      content,
      templateName,
      templateVersion: '1.0',
      personality: config.personality,
      locale: config.locale,
      length: content.length,
      isValid,
      validationErrors,
      includedCapabilities: config.enabledCapabilities,
      renderedAt: new Date(),
      metadata: opts.debug
        ? {
            renderTimeMs: Date.now() - startTime,
            templateName,
            hasPersonality: !!personalityTemplate,
            hasDynamicContext: !!dynamicContext,
          }
        : undefined,
    };

    return result;
  }

  /**
   * Get template name for an assistant type
   */
  private getTemplateName(typeId: string): string {
    // Map type ID to template path
    const vertical = typeId.startsWith('rest_') ? 'restaurant' : 'dental';
    return `${vertical}/${typeId}_v1`;
  }

  /**
   * Clean up rendered output
   */
  private cleanOutput(content: string): string {
    return (
      content
        // Remove multiple consecutive newlines
        .replace(/\n{3,}/g, '\n\n')
        // Remove leading/trailing whitespace from lines
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        // Remove leading/trailing whitespace
        .trim()
    );
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  /**
   * Validate a rendered prompt
   */
  validatePrompt(content: string): PromptValidationResult {
    const errors: PromptValidationError[] = [];
    const warnings: string[] = [];
    const sectionsFound: string[] = [];

    // Check length
    if (content.length > this.config.maxPromptLength) {
      errors.push({
        code: 'PROMPT_TOO_LONG',
        message: `Prompt exceeds maximum length of ${this.config.maxPromptLength} characters (got ${content.length})`,
      });
    }

    if (content.length < this.config.minPromptLength) {
      errors.push({
        code: 'PROMPT_TOO_SHORT',
        message: `Prompt is below minimum length of ${this.config.minPromptLength} characters (got ${content.length})`,
      });
    }

    // Check for unresolved placeholders
    const placeholderMatch = content.match(/\{\{[^}]+\}\}/g);
    if (placeholderMatch) {
      errors.push({
        code: 'UNRESOLVED_PLACEHOLDER',
        message: `Unresolved placeholders found: ${placeholderMatch.join(', ')}`,
        location: placeholderMatch[0],
      });
    }

    // Check for required sections
    for (const section of this.config.requiredSections) {
      if (content.includes(section) || content.includes(section.toUpperCase())) {
        sectionsFound.push(section);
      } else {
        errors.push({
          code: 'MISSING_SECTION',
          message: `Required section not found: ${section}`,
        });
      }
    }

    // Check for invalid characters (non-printable, except newlines)
    const invalidChars = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
    if (invalidChars) {
      errors.push({
        code: 'INVALID_CHARACTER',
        message: `Invalid characters found in prompt`,
      });
    }

    // Warnings
    if (content.length > this.config.maxPromptLength * 0.9) {
      warnings.push(
        `Prompt is ${Math.round((content.length / this.config.maxPromptLength) * 100)}% of maximum length`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      length: content.length,
      sectionsFound,
    };
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Register a custom partial
   */
  registerPartial(name: string, content: string): void {
    this.handlebars.registerPartial(name, content);
  }

  /**
   * Register a custom helper
   */
  registerHelper(
    name: string,
    fn: Handlebars.HelperDelegate
  ): void {
    this.handlebars.registerHelper(name, fn);
  }

  /**
   * Compile a template string
   */
  compile(template: string): Handlebars.TemplateDelegate {
    return this.handlebars.compile(template);
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.templates.clear();
    this.initialized = false;
  }

  /**
   * Get template count
   */
  getTemplateCount(): number {
    return this.templates.size;
  }

  /**
   * Get i18n locale count
   */
  getLocaleCount(): number {
    return this.i18nCache.size;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get time of day from a date
 */
export function getTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Format time for voice output
 */
export function formatTimeForVoice(time: string): string {
  if (!time) return '';

  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours)) return time;

  const hourNum = hours % 12 || 12;
  const period = hours < 12 ? 'de la mañana' : hours < 18 ? 'de la tarde' : 'de la noche';

  if (minutes === 0) {
    if (hourNum === 12 && hours === 12) return 'mediodía';
    if (hourNum === 12 && hours === 0) return 'medianoche';
    return `${hourNum} ${period}`;
  }

  if (minutes === 30) {
    return `${hourNum} y media ${period}`;
  }

  if (minutes === 15) {
    return `${hourNum} y cuarto ${period}`;
  }

  if (minutes === 45) {
    return `${hourNum === 12 ? 1 : hourNum + 1} menos cuarto ${period}`;
  }

  return `${hourNum} con ${minutes} ${period}`;
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a new VoiceTemplateEngine
 */
export function createTemplateEngine(
  config?: Partial<TemplateEngineConfig>
): VoiceTemplateEngine {
  return new VoiceTemplateEngine(config);
}

/**
 * Create and initialize a template engine
 */
export async function createInitializedTemplateEngine(
  config?: Partial<TemplateEngineConfig>
): Promise<VoiceTemplateEngine> {
  const engine = new VoiceTemplateEngine(config);
  await engine.initialize();
  return engine;
}
