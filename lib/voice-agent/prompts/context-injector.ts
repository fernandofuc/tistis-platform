/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dynamic Context Injector
 *
 * Generates and injects real-time context into voice assistant prompts.
 * This includes current time, business status, wait times, and other
 * dynamic information that changes frequently.
 */

import type {
  BusinessContext,
  DynamicContext,
  VoiceAssistantConfig,
  TimeOfDay,
  SupportedLocale,
  I18nTranslations,
  DaySchedule,
} from './types';

// =====================================================
// CONTEXT INJECTION TYPES
// =====================================================

/**
 * Options for context injection
 */
export interface ContextInjectionOptions {
  /** Include current time context */
  includeTimeContext?: boolean;
  /** Include business status context */
  includeBusinessStatus?: boolean;
  /** Include wait time information */
  includeWaitTime?: boolean;
  /** Include availability alerts */
  includeAvailabilityAlerts?: boolean;
  /** Include promotional context */
  includePromotionalContext?: boolean;
  /** Custom timezone override */
  timezone?: string;
  /** Format for voice output */
  voiceOptimized?: boolean;
}

/**
 * Default injection options
 */
export const DEFAULT_INJECTION_OPTIONS: ContextInjectionOptions = {
  includeTimeContext: true,
  includeBusinessStatus: true,
  includeWaitTime: true,
  includeAvailabilityAlerts: true,
  includePromotionalContext: true,
  voiceOptimized: true,
};

/**
 * Generated context block
 */
export interface InjectedContext {
  /** The formatted context text */
  text: string;
  /** Sections included */
  sections: string[];
  /** Timestamp when generated */
  generatedAt: Date;
  /** Locale used */
  locale: SupportedLocale;
  /** Any alerts that should be prioritized */
  priorityAlerts: string[];
}

// =====================================================
// DYNAMIC CONTEXT INJECTOR CLASS
// =====================================================

/**
 * Generates dynamic context blocks for injection into prompts
 */
export class DynamicContextInjector {
  private readonly defaultTimezone: string;

  constructor(defaultTimezone: string = 'America/Mexico_City') {
    this.defaultTimezone = defaultTimezone;
  }

  /**
   * Generate a complete context block for injection
   */
  generateContextBlock(
    business: BusinessContext,
    config: VoiceAssistantConfig,
    dynamic?: DynamicContext,
    i18n?: I18nTranslations,
    options: ContextInjectionOptions = DEFAULT_INJECTION_OPTIONS
  ): InjectedContext {
    const now = new Date();
    const sections: string[] = [];
    const priorityAlerts: string[] = [];
    const parts: string[] = [];

    // Time context
    if (options.includeTimeContext) {
      const timeContext = this.generateTimeContext(now, config.locale, i18n);
      if (timeContext) {
        parts.push(timeContext);
        sections.push('time');
      }
    }

    // Business status
    if (options.includeBusinessStatus) {
      const statusContext = this.generateBusinessStatusContext(
        business,
        now,
        config.locale,
        i18n
      );
      if (statusContext.text) {
        parts.push(statusContext.text);
        sections.push('business_status');
        if (statusContext.alert) {
          priorityAlerts.push(statusContext.alert);
        }
      }
    }

    // Wait time
    if (options.includeWaitTime && dynamic?.waitTimeMinutes !== undefined) {
      const waitContext = this.generateWaitTimeContext(
        dynamic.waitTimeMinutes,
        config.locale,
        i18n
      );
      if (waitContext.text) {
        parts.push(waitContext.text);
        sections.push('wait_time');
        if (waitContext.alert) {
          priorityAlerts.push(waitContext.alert);
        }
      }
    }

    // Availability alerts
    if (options.includeAvailabilityAlerts && dynamic) {
      const alertsContext = this.generateAvailabilityAlerts(
        dynamic,
        config.locale,
        i18n
      );
      if (alertsContext.length > 0) {
        parts.push(...alertsContext);
        sections.push('availability');
      }
    }

    // Promotional context
    if (options.includePromotionalContext && business.promotions?.length) {
      const promoContext = this.generatePromotionalContext(
        business,
        config.locale,
        i18n
      );
      if (promoContext) {
        parts.push(promoContext);
        sections.push('promotions');
      }
    }

    // Custom message from dynamic context
    if (dynamic?.customMessage) {
      parts.push(`**Mensaje especial:** ${dynamic.customMessage}`);
      sections.push('custom_message');
    }

    return {
      text: parts.length > 0 ? parts.join('\n\n') : '',
      sections,
      generatedAt: now,
      locale: config.locale,
      priorityAlerts,
    };
  }

  /**
   * Generate time-based context
   */
  private generateTimeContext(
    now: Date,
    locale: SupportedLocale,
    i18n?: I18nTranslations
  ): string {
    const timeOfDay = this.getTimeOfDay(now);
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const dayNames =
      locale === 'es-MX'
        ? [
            'domingo',
            'lunes',
            'martes',
            'miércoles',
            'jueves',
            'viernes',
            'sábado',
          ]
        : [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ];

    const periodNames =
      locale === 'es-MX'
        ? {
            morning: 'la mañana',
            afternoon: 'la tarde',
            evening: 'la noche',
            night: 'la noche',
          }
        : {
            morning: 'the morning',
            afternoon: 'the afternoon',
            evening: 'the evening',
            night: 'night',
          };

    const dayName = dayNames[dayOfWeek];
    const period = periodNames[timeOfDay];

    // Format time for voice
    const formattedTime = this.formatTimeForVoice(hour, minute, locale);

    if (locale === 'es-MX') {
      return `**Momento actual:** ${dayName}, ${formattedTime} de ${period}`;
    } else {
      return `**Current time:** ${dayName}, ${formattedTime} in ${period}`;
    }
  }

  /**
   * Generate business status context
   */
  private generateBusinessStatusContext(
    business: BusinessContext,
    now: Date,
    locale: SupportedLocale,
    i18n?: I18nTranslations
  ): { text: string; alert?: string } {
    const isOpen = business.isCurrentlyOpen;

    if (isOpen) {
      // Check if closing soon (within 1 hour)
      const closingTime = this.parseTime(business.todaySchedule.closeTime);
      if (closingTime) {
        const minutesUntilClose = this.minutesBetween(now, closingTime);
        if (minutesUntilClose > 0 && minutesUntilClose <= 60) {
          const alert =
            locale === 'es-MX'
              ? `Cerramos en ${minutesUntilClose} minutos`
              : `Closing in ${minutesUntilClose} minutes`;

          return {
            text:
              locale === 'es-MX'
                ? `**Estado:** Abierto (cerramos en ${minutesUntilClose} minutos)`
                : `**Status:** Open (closing in ${minutesUntilClose} minutes)`,
            alert,
          };
        }
      }

      return {
        text: locale === 'es-MX' ? '**Estado:** Abierto' : '**Status:** Open',
      };
    } else {
      // Currently closed
      if (business.nextOpenTime) {
        return {
          text:
            locale === 'es-MX'
              ? `**Estado:** Cerrado. Abrimos ${business.nextOpenTime}`
              : `**Status:** Closed. Opening ${business.nextOpenTime}`,
          alert:
            locale === 'es-MX'
              ? 'Actualmente estamos cerrados'
              : 'We are currently closed',
        };
      }

      return {
        text:
          locale === 'es-MX'
            ? '**Estado:** Cerrado'
            : '**Status:** Closed',
        alert:
          locale === 'es-MX'
            ? 'Actualmente estamos cerrados'
            : 'We are currently closed',
      };
    }
  }

  /**
   * Generate wait time context
   */
  private generateWaitTimeContext(
    waitTimeMinutes: number,
    locale: SupportedLocale,
    i18n?: I18nTranslations
  ): { text: string; alert?: string } {
    const formattedTime = this.formatDuration(waitTimeMinutes, locale);

    // High wait time alert (over 30 minutes)
    if (waitTimeMinutes > 30) {
      return {
        text:
          locale === 'es-MX'
            ? `**Tiempo de espera actual:** ${formattedTime} (alto)`
            : `**Current wait time:** ${formattedTime} (high)`,
        alert:
          locale === 'es-MX'
            ? `El tiempo de espera es de ${formattedTime}`
            : `Wait time is ${formattedTime}`,
      };
    }

    // Moderate wait time (15-30 minutes)
    if (waitTimeMinutes > 15) {
      return {
        text:
          locale === 'es-MX'
            ? `**Tiempo de espera actual:** ${formattedTime}`
            : `**Current wait time:** ${formattedTime}`,
      };
    }

    // Low wait time
    return {
      text:
        locale === 'es-MX'
          ? `**Tiempo de espera actual:** ${formattedTime}`
          : `**Current wait time:** ${formattedTime}`,
    };
  }

  /**
   * Generate availability alerts
   */
  private generateAvailabilityAlerts(
    dynamic: DynamicContext,
    locale: SupportedLocale,
    i18n?: I18nTranslations
  ): string[] {
    const alerts: string[] = [];

    // Unavailable items
    if (dynamic.unavailableItems.length > 0) {
      const items = dynamic.unavailableItems.slice(0, 5).join(', ');
      const moreCount = Math.max(0, dynamic.unavailableItems.length - 5);

      if (locale === 'es-MX') {
        let alert = `**No disponible:** ${items}`;
        if (moreCount > 0) {
          alert += ` y ${moreCount} más`;
        }
        alerts.push(alert);
      } else {
        let alert = `**Unavailable:** ${items}`;
        if (moreCount > 0) {
          alert += ` and ${moreCount} more`;
        }
        alerts.push(alert);
      }
    }

    // Not accepting bookings
    if (!dynamic.acceptingBookings) {
      alerts.push(
        locale === 'es-MX'
          ? '**AVISO:** No estamos aceptando reservaciones/citas en este momento'
          : '**NOTICE:** We are not accepting bookings at this time'
      );
    }

    // High occupancy
    if (dynamic.occupancyPercent !== undefined && dynamic.occupancyPercent > 80) {
      alerts.push(
        locale === 'es-MX'
          ? `**Ocupación alta:** ${dynamic.occupancyPercent}%`
          : `**High occupancy:** ${dynamic.occupancyPercent}%`
      );
    }

    // Today's announcements
    if (dynamic.todayAnnouncements.length > 0) {
      for (const announcement of dynamic.todayAnnouncements) {
        alerts.push(`**Anuncio:** ${announcement}`);
      }
    }

    return alerts;
  }

  /**
   * Generate promotional context
   */
  private generatePromotionalContext(
    business: BusinessContext,
    locale: SupportedLocale,
    i18n?: I18nTranslations
  ): string | null {
    if (!business.promotions || business.promotions.length === 0) {
      return null;
    }

    const activePromos = business.promotions.filter((p) => {
      if (!p.validUntil) return true;
      return new Date(p.validUntil) > new Date();
    });

    if (activePromos.length === 0) {
      return null;
    }

    const promoNames = activePromos.map((p) => p.name).slice(0, 3);

    if (locale === 'es-MX') {
      return `**Promociones activas:** ${promoNames.join(', ')}. Menciona si el cliente pregunta por ofertas.`;
    } else {
      return `**Active promotions:** ${promoNames.join(', ')}. Mention if customer asks about offers.`;
    }
  }

  /**
   * Get time of day classification
   */
  private getTimeOfDay(date: Date): TimeOfDay {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Format time for voice output
   */
  private formatTimeForVoice(
    hour: number,
    minute: number,
    locale: SupportedLocale
  ): string {
    if (locale === 'es-MX') {
      // Spanish voice-friendly format
      const hour12 = hour % 12 || 12;

      if (minute === 0) {
        return hour12 === 1 ? 'la una en punto' : `las ${hour12} en punto`;
      } else if (minute === 15) {
        return hour12 === 1
          ? 'la una y cuarto'
          : `las ${hour12} y cuarto`;
      } else if (minute === 30) {
        return hour12 === 1
          ? 'la una y media'
          : `las ${hour12} y media`;
      } else if (minute === 45) {
        const nextHour = (hour12 % 12) + 1;
        return nextHour === 1
          ? 'un cuarto para la una'
          : `un cuarto para las ${nextHour}`;
      } else {
        return hour12 === 1
          ? `la una y ${minute}`
          : `las ${hour12} y ${minute}`;
      }
    } else {
      // English voice-friendly format
      const hour12 = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';

      if (minute === 0) {
        return `${hour12} ${period}`;
      } else if (minute === 15) {
        return `quarter past ${hour12} ${period}`;
      } else if (minute === 30) {
        return `half past ${hour12} ${period}`;
      } else if (minute === 45) {
        const nextHour = (hour12 % 12) + 1;
        return `quarter to ${nextHour} ${period}`;
      } else {
        return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
      }
    }
  }

  /**
   * Format duration for voice output
   */
  private formatDuration(minutes: number, locale: SupportedLocale): string {
    if (minutes < 60) {
      if (locale === 'es-MX') {
        return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
      } else {
        return minutes === 1 ? '1 minute' : `${minutes} minutes`;
      }
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      if (locale === 'es-MX') {
        return hours === 1 ? '1 hora' : `${hours} horas`;
      } else {
        return hours === 1 ? '1 hour' : `${hours} hours`;
      }
    }

    if (locale === 'es-MX') {
      const hourPart = hours === 1 ? '1 hora' : `${hours} horas`;
      const minPart =
        remainingMinutes === 1 ? '1 minuto' : `${remainingMinutes} minutos`;
      return `${hourPart} y ${minPart}`;
    } else {
      const hourPart = hours === 1 ? '1 hour' : `${hours} hours`;
      const minPart =
        remainingMinutes === 1 ? '1 minute' : `${remainingMinutes} minutes`;
      return `${hourPart} and ${minPart}`;
    }
  }

  /**
   * Parse time string to Date
   */
  private parseTime(timeStr?: string): Date | null {
    if (!timeStr) return null;

    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const [, hours, minutes] = match;
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return date;
  }

  /**
   * Calculate minutes between two times
   */
  private minutesBetween(from: Date, to: Date): number {
    const now = new Date();
    const toDate = new Date(now);
    toDate.setHours(to.getHours(), to.getMinutes(), 0, 0);

    const diff = toDate.getTime() - from.getTime();
    return Math.floor(diff / 60000);
  }

  /**
   * Inject context into an existing prompt
   */
  injectIntoPrompt(
    prompt: string,
    contextBlock: InjectedContext,
    position: 'start' | 'end' | 'after-identity' = 'after-identity'
  ): string {
    if (!contextBlock.text) {
      return prompt;
    }

    const contextSection = `
---

# CONTEXTO EN TIEMPO REAL

${contextBlock.text}

---
`;

    switch (position) {
      case 'start':
        return contextSection + '\n' + prompt;

      case 'end':
        return prompt + '\n' + contextSection;

      case 'after-identity':
      default:
        // Try to insert after the IDENTIDAD section
        const identityEndMarker = /^---\s*$/m;
        const match = prompt.match(identityEndMarker);

        if (match && match.index !== undefined) {
          // Find the first --- after IDENTIDAD
          const firstSection = prompt.indexOf('# IDENTIDAD');
          if (firstSection !== -1) {
            const afterIdentity = prompt.indexOf('---', firstSection + 10);
            if (afterIdentity !== -1) {
              return (
                prompt.slice(0, afterIdentity + 3) +
                '\n' +
                contextSection +
                prompt.slice(afterIdentity + 3)
              );
            }
          }
        }

        // Fallback to start if no identity section found
        return contextSection + '\n' + prompt;
    }
  }

  /**
   * Generate a minimal context update (for mid-call updates)
   */
  generateMinimalUpdate(
    dynamic: DynamicContext,
    locale: SupportedLocale
  ): string {
    const parts: string[] = [];

    if (dynamic.waitTimeMinutes !== undefined) {
      const formattedTime = this.formatDuration(dynamic.waitTimeMinutes, locale);
      parts.push(
        locale === 'es-MX'
          ? `Tiempo de espera: ${formattedTime}`
          : `Wait time: ${formattedTime}`
      );
    }

    if (dynamic.unavailableItems.length > 0) {
      parts.push(
        locale === 'es-MX'
          ? `No disponible: ${dynamic.unavailableItems.join(', ')}`
          : `Unavailable: ${dynamic.unavailableItems.join(', ')}`
      );
    }

    if (!dynamic.acceptingBookings) {
      parts.push(
        locale === 'es-MX'
          ? 'No aceptamos reservaciones'
          : 'Not accepting bookings'
      );
    }

    return parts.join(' | ');
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a new DynamicContextInjector instance
 */
export function createContextInjector(
  timezone?: string
): DynamicContextInjector {
  return new DynamicContextInjector(timezone);
}

/**
 * Quick helper to generate a context block
 */
export function generateContextBlock(
  business: BusinessContext,
  config: VoiceAssistantConfig,
  dynamic?: DynamicContext,
  i18n?: I18nTranslations,
  options?: ContextInjectionOptions
): InjectedContext {
  const injector = createContextInjector();
  return injector.generateContextBlock(business, config, dynamic, i18n, options);
}

/**
 * Quick helper to inject context into a prompt
 */
export function injectContextIntoPrompt(
  prompt: string,
  business: BusinessContext,
  config: VoiceAssistantConfig,
  dynamic?: DynamicContext,
  i18n?: I18nTranslations,
  options?: ContextInjectionOptions
): string {
  const injector = createContextInjector();
  const contextBlock = injector.generateContextBlock(
    business,
    config,
    dynamic,
    i18n,
    options
  );
  return injector.injectIntoPrompt(prompt, contextBlock);
}
