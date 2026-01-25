// =====================================================
// TIS TIS PLATFORM - Confirmation Message Templates
// Templates para mensajes de confirmación vía WhatsApp
// =====================================================
//
// SINCRONIZADO CON:
// - Types: src/features/secure-booking/types/index.ts
// - Sender: src/features/secure-booking/services/confirmation-sender.service.ts
// =====================================================

import type {
  ConfirmationType,
  ReferenceType,
} from '../types';

// ======================
// TEMPLATE DATA TYPES
// ======================

export interface ConfirmationTemplateData {
  // Customer info
  customerName: string;
  customerPhone: string;

  // Business info
  businessName: string;
  businessPhone?: string;
  branchName?: string;
  branchAddress?: string;

  // Booking details
  referenceType: ReferenceType;
  referenceId: string;
  confirmationCode: string;

  // Date/Time
  date: string; // Formatted: "Lunes 15 de Enero"
  time: string; // Formatted: "10:00 AM"
  dateTimeRaw: string; // ISO format for parsing

  // Service/Order details
  serviceName?: string;
  staffName?: string;
  partySize?: number;
  orderItems?: string[];
  totalAmount?: number;
  currency?: string;

  // Deposit info (if applicable)
  depositRequired?: boolean;
  depositAmount?: number;
  depositPaymentUrl?: string;

  // Expiration
  expiresAt: string; // ISO format
  expiresInHours: number;

  // Custom message
  customMessage?: string;
}

export interface TemplateResult {
  text: string;
  buttons?: Array<{
    id: string;
    title: string;
  }>;
  footer?: string;
}

// ======================
// TEMPLATE FUNCTIONS
// ======================

/**
 * Appointment confirmation template (Dental/Medical/Beauty)
 */
export function buildAppointmentConfirmationTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const lines: string[] = [
    `Hola ${data.customerName}! 👋`,
    '',
    '📋 *Confirmación de Cita*',
    '',
    `📅 *Fecha:* ${data.date}`,
    `🕐 *Hora:* ${data.time}`,
    `🏥 *Lugar:* ${data.businessName}`,
  ];

  if (data.branchName) {
    lines.push(`📍 *Sucursal:* ${data.branchName}`);
  }

  if (data.serviceName) {
    lines.push(`💉 *Servicio:* ${data.serviceName}`);
  }

  if (data.staffName) {
    lines.push(`👨‍⚕️ *Especialista:* ${data.staffName}`);
  }

  if (data.depositRequired && data.depositAmount) {
    lines.push('');
    lines.push(`💰 *Depósito requerido:* $${(data.depositAmount / 100).toFixed(2)} ${data.currency || 'MXN'}`);
    if (data.depositPaymentUrl) {
      lines.push(`🔗 Pagar aquí: ${data.depositPaymentUrl}`);
    }
  }

  lines.push('');
  lines.push('Por favor confirma tu asistencia:');
  lines.push('');
  lines.push('✅ Responde *SÍ* para confirmar');
  lines.push('❌ Responde *NO* para cancelar');
  lines.push('📅 Responde *CAMBIAR* si necesitas otro horario');
  lines.push('');
  lines.push(`⏰ Esta confirmación expira en ${data.expiresInHours} horas.`);

  if (data.customMessage) {
    lines.push('');
    lines.push(`📝 ${data.customMessage}`);
  }

  return {
    text: lines.join('\n'),
    buttons: [
      { id: 'confirm_yes', title: 'Sí, confirmo' },
      { id: 'confirm_no', title: 'No puedo' },
      { id: 'confirm_change', title: 'Cambiar horario' },
    ],
    footer: `Código: ${data.confirmationCode}`,
  };
}

/**
 * Reservation confirmation template (Restaurant)
 */
export function buildReservationConfirmationTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const lines: string[] = [
    `Hola ${data.customerName}! 👋`,
    '',
    '🍽️ *Confirmación de Reservación*',
    '',
    `📅 *Fecha:* ${data.date}`,
    `🕐 *Hora:* ${data.time}`,
    `🏪 *Restaurante:* ${data.businessName}`,
  ];

  if (data.branchName) {
    lines.push(`📍 *Ubicación:* ${data.branchName}`);
  }

  if (data.partySize) {
    lines.push(`👥 *Personas:* ${data.partySize}`);
  }

  if (data.depositRequired && data.depositAmount) {
    lines.push('');
    lines.push(`💰 *Depósito requerido:* $${(data.depositAmount / 100).toFixed(2)} ${data.currency || 'MXN'}`);
    lines.push('Este monto se descuenta de tu cuenta final.');
    if (data.depositPaymentUrl) {
      lines.push(`🔗 Pagar aquí: ${data.depositPaymentUrl}`);
    }
  }

  lines.push('');
  lines.push('Por favor confirma tu reservación:');
  lines.push('');
  lines.push('✅ Responde *SÍ* para confirmar');
  lines.push('❌ Responde *NO* para cancelar');
  lines.push('📅 Responde *CAMBIAR* si necesitas otro horario');
  lines.push('');
  lines.push(`⏰ Confirma antes de ${data.expiresInHours} horas o tu reservación será cancelada.`);

  return {
    text: lines.join('\n'),
    buttons: [
      { id: 'confirm_yes', title: 'Sí, confirmo' },
      { id: 'confirm_no', title: 'Cancelar' },
      { id: 'confirm_change', title: 'Cambiar horario' },
    ],
    footer: `Código: ${data.confirmationCode}`,
  };
}

/**
 * Order confirmation template (Restaurant pickup/delivery)
 */
export function buildOrderConfirmationTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const lines: string[] = [
    `Hola ${data.customerName}! 👋`,
    '',
    '🛍️ *Confirmación de Pedido*',
    '',
    `🏪 *Restaurante:* ${data.businessName}`,
  ];

  if (data.branchName) {
    lines.push(`📍 *Sucursal:* ${data.branchName}`);
  }

  if (data.orderItems && data.orderItems.length > 0) {
    lines.push('');
    lines.push('*Tu pedido:*');
    data.orderItems.forEach((item, index) => {
      lines.push(`  ${index + 1}. ${item}`);
    });
  }

  if (data.totalAmount) {
    lines.push('');
    lines.push(`💵 *Total:* $${(data.totalAmount / 100).toFixed(2)} ${data.currency || 'MXN'}`);
  }

  lines.push('');
  lines.push(`⏰ *Listo para recoger:* ${data.time}`);
  lines.push('');
  lines.push('⚠️ *Importante:* Si no recoges tu pedido en el tiempo indicado, podrías recibir una penalización en tu cuenta.');
  lines.push('');
  lines.push('Responde *OK* para confirmar que lo recogerás.');

  return {
    text: lines.join('\n'),
    buttons: [
      { id: 'confirm_yes', title: 'Ok, lo recojo' },
      { id: 'confirm_no', title: 'Cancelar pedido' },
    ],
    footer: `Pedido: ${data.confirmationCode}`,
  };
}

/**
 * 24-hour reminder template
 */
export function buildReminder24hTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const referenceLabel = data.referenceType === 'appointment'
    ? 'cita'
    : data.referenceType === 'reservation'
      ? 'reservación'
      : 'pedido';

  const lines: string[] = [
    `Hola ${data.customerName}! 🔔`,
    '',
    `*Recordatorio:* Tu ${referenceLabel} es mañana.`,
    '',
    `📅 *Fecha:* ${data.date}`,
    `🕐 *Hora:* ${data.time}`,
    `🏪 *Lugar:* ${data.businessName}`,
  ];

  if (data.branchName && data.branchAddress) {
    lines.push(`📍 ${data.branchName}`);
    lines.push(`   ${data.branchAddress}`);
  }

  if (data.serviceName) {
    lines.push(`💼 *Servicio:* ${data.serviceName}`);
  }

  if (data.partySize && data.referenceType === 'reservation') {
    lines.push(`👥 *Personas:* ${data.partySize}`);
  }

  lines.push('');
  lines.push('¿Sigues confirmado/a?');
  lines.push('');
  lines.push('✅ *SÍ* - Ahí estaré');
  lines.push('❌ *NO* - No podré asistir');

  return {
    text: lines.join('\n'),
    buttons: [
      { id: 'remind_yes', title: 'Sí, ahí estaré' },
      { id: 'remind_no', title: 'No podré ir' },
    ],
    footer: `Código: ${data.confirmationCode}`,
  };
}

/**
 * 2-hour reminder template
 */
export function buildReminder2hTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const referenceLabel = data.referenceType === 'appointment'
    ? 'cita'
    : data.referenceType === 'reservation'
      ? 'reservación'
      : 'pedido';

  const lines: string[] = [
    `⏰ *${data.customerName}*, tu ${referenceLabel} es en 2 horas.`,
    '',
    `🕐 *Hora:* ${data.time}`,
    `🏪 *Lugar:* ${data.businessName}`,
  ];

  if (data.branchAddress) {
    lines.push(`📍 ${data.branchAddress}`);
  }

  lines.push('');
  lines.push('¡Te esperamos!');

  if (data.businessPhone) {
    lines.push('');
    lines.push(`📞 Si tienes algún inconveniente, llámanos al ${data.businessPhone}`);
  }

  return {
    text: lines.join('\n'),
    footer: `Código: ${data.confirmationCode}`,
  };
}

/**
 * Deposit required template
 */
export function buildDepositRequiredTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  if (!data.depositAmount || !data.depositPaymentUrl) {
    throw new Error('Deposit amount and payment URL are required');
  }

  const referenceLabel = data.referenceType === 'appointment'
    ? 'cita'
    : data.referenceType === 'reservation'
      ? 'reservación'
      : 'pedido';

  const lines: string[] = [
    `Hola ${data.customerName}! 👋`,
    '',
    `💳 *Depósito Requerido*`,
    '',
    `Para confirmar tu ${referenceLabel}, necesitamos un depósito de:`,
    '',
    `💰 *$${(data.depositAmount / 100).toFixed(2)} ${data.currency || 'MXN'}*`,
    '',
    `📅 *Fecha:* ${data.date}`,
    `🕐 *Hora:* ${data.time}`,
    `🏪 *Lugar:* ${data.businessName}`,
  ];

  if (data.serviceName) {
    lines.push(`💼 *Servicio:* ${data.serviceName}`);
  }

  lines.push('');
  lines.push('👇 Haz clic aquí para pagar de forma segura:');
  lines.push(data.depositPaymentUrl);
  lines.push('');
  lines.push(`⏰ Tienes ${data.expiresInHours} horas para completar el pago.`);
  lines.push('');
  lines.push('Este monto se descuenta del total de tu servicio.');

  return {
    text: lines.join('\n'),
    buttons: [
      { id: 'pay_now', title: 'Pagar ahora' },
      { id: 'cancel_booking', title: 'Cancelar' },
    ],
    footer: `Código: ${data.confirmationCode}`,
  };
}

/**
 * Confirmation success response template
 */
export function buildConfirmationSuccessTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const referenceLabel = data.referenceType === 'appointment'
    ? 'cita'
    : data.referenceType === 'reservation'
      ? 'reservación'
      : 'pedido';

  const lines: string[] = [
    `✅ *¡Confirmado!*`,
    '',
    `Gracias ${data.customerName}, tu ${referenceLabel} está confirmada.`,
    '',
    `📅 *Fecha:* ${data.date}`,
    `🕐 *Hora:* ${data.time}`,
    `🏪 *Lugar:* ${data.businessName}`,
  ];

  if (data.branchAddress) {
    lines.push(`📍 ${data.branchAddress}`);
  }

  lines.push('');
  lines.push('¡Te esperamos! 🎉');

  if (data.businessPhone) {
    lines.push('');
    lines.push(`📞 Cualquier duda: ${data.businessPhone}`);
  }

  return {
    text: lines.join('\n'),
    footer: `Código: ${data.confirmationCode}`,
  };
}

/**
 * Cancellation confirmation template
 */
export function buildCancellationTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const referenceLabel = data.referenceType === 'appointment'
    ? 'cita'
    : data.referenceType === 'reservation'
      ? 'reservación'
      : 'pedido';

  const lines: string[] = [
    `❌ *${referenceLabel.charAt(0).toUpperCase() + referenceLabel.slice(1)} Cancelada*`,
    '',
    `${data.customerName}, tu ${referenceLabel} ha sido cancelada.`,
    '',
    `📅 *Fecha:* ${data.date}`,
    `🕐 *Hora:* ${data.time}`,
    '',
    `Si deseas reagendar, puedes escribirnos o llamarnos.`,
  ];

  if (data.businessPhone) {
    lines.push('');
    lines.push(`📞 ${data.businessPhone}`);
  }

  return {
    text: lines.join('\n'),
    footer: data.businessName,
  };
}

/**
 * Need change acknowledgment template
 */
export function buildNeedChangeTemplate(
  data: ConfirmationTemplateData
): TemplateResult {
  const referenceLabel = data.referenceType === 'appointment'
    ? 'cita'
    : data.referenceType === 'reservation'
      ? 'reservación'
      : 'pedido';

  const lines: string[] = [
    `📅 *Solicitud de Cambio*`,
    '',
    `Entendido ${data.customerName}, vamos a ayudarte a cambiar tu ${referenceLabel}.`,
    '',
    `Tu ${referenceLabel} actual:`,
    `📅 ${data.date} a las ${data.time}`,
    '',
    `¿Para qué fecha y hora te gustaría cambiarla?`,
  ];

  return {
    text: lines.join('\n'),
  };
}

// ======================
// TEMPLATE SELECTOR
// ======================

/**
 * Get the appropriate template builder based on type
 */
export function getTemplateBuilder(
  confirmationType: ConfirmationType,
  referenceType: ReferenceType
): (data: ConfirmationTemplateData) => TemplateResult {
  switch (confirmationType) {
    case 'voice_to_message':
      switch (referenceType) {
        case 'appointment':
          return buildAppointmentConfirmationTemplate;
        case 'reservation':
          return buildReservationConfirmationTemplate;
        case 'order':
          return buildOrderConfirmationTemplate;
        default:
          return buildAppointmentConfirmationTemplate;
      }

    case 'reminder_24h':
      return buildReminder24hTemplate;

    case 'reminder_2h':
      return buildReminder2hTemplate;

    case 'deposit_required':
      return buildDepositRequiredTemplate;

    case 'custom':
    default:
      // For custom, use the reference type to determine base template
      switch (referenceType) {
        case 'appointment':
          return buildAppointmentConfirmationTemplate;
        case 'reservation':
          return buildReservationConfirmationTemplate;
        case 'order':
          return buildOrderConfirmationTemplate;
        default:
          return buildAppointmentConfirmationTemplate;
      }
  }
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Generate a short confirmation code
 */
export function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Format date for display (Spanish)
 */
export function formatDateSpanish(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];

  return `${dayName} ${dayNum} de ${monthName}`;
}

/**
 * Format time for display
 */
export function formatTimeSpanish(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Calculate hours until expiration
 */
export function calculateHoursUntilExpiration(expiresAt: Date | string): number {
  const expires = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
}
