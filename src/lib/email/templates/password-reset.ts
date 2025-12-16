// =====================================================
// TIS TIS - Password Reset Email Template
// Sent when user requests password recovery
// =====================================================

import { baseEmailTemplate, createButton, createInfoBox } from '../base-template';

export interface PasswordResetEmailData {
  customerName: string;
  resetUrl: string;
  expiresIn: string; // e.g., "1 hora"
}

export function passwordResetEmailSubject(): string {
  return '🔐 Restablecer tu contraseña - TIS TIS';
}

export function passwordResetEmailTemplate(data: PasswordResetEmailData): string {
  const { customerName, resetUrl, expiresIn } = data;

  const content = `
    <!-- Header -->
    <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #1a1a2e;">
      Restablecer Contraseña
    </h1>
    <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666; line-height: 1.6;">
      Hola ${customerName}, recibimos una solicitud para restablecer tu contraseña.
    </p>

    <!-- Icon -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #7C5CFC 0%, #9F7AFF 100%); border-radius: 50%; line-height: 80px;">
        <span style="font-size: 40px;">🔐</span>
      </div>
    </div>

    <!-- Message -->
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #333333; line-height: 1.7;">
      Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace
      <strong>expirará en ${expiresIn}</strong>.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0;">
      ${createButton('Restablecer Contraseña', resetUrl)}
    </div>

    <!-- Security Info -->
    ${createInfoBox(`
      <p style="margin: 0; font-size: 14px; color: #0369a1; line-height: 1.5;">
        <strong>🛡️ Consejo de seguridad:</strong><br>
        Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña
        actual seguirá funcionando y nadie ha tenido acceso a tu cuenta.
      </p>
    `, '#f0f9ff', '#0ea5e9')}

    <!-- Alternative link -->
    <p style="margin: 32px 0 0 0; font-size: 13px; color: #666666; line-height: 1.6;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin: 8px 0 0 0; font-size: 12px; color: #7C5CFC; word-break: break-all;">
      ${resetUrl}
    </p>

    <!-- Footer note -->
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    <p style="margin: 0; font-size: 13px; color: #999999; line-height: 1.6;">
      Este correo fue enviado a tu dirección registrada en TIS TIS. Si tienes
      problemas para acceder a tu cuenta, contacta a
      <a href="mailto:soporte@tistis.com" style="color: #7C5CFC;">soporte@tistis.com</a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `Restablece tu contraseña de TIS TIS - El enlace expira en ${expiresIn}`,
    content,
  });
}
