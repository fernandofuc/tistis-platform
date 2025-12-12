// =====================================================
// TIS TIS - Credentials Email Template
// Sent when a new client is provisioned with access credentials
// =====================================================

import { baseEmailTemplate } from '../base-template';
import type { CredentialsEmailData } from '../types';

export const credentialsEmailSubject = (customerName: string): string => {
  return `${customerName}, tus credenciales de acceso a TIS TIS`;
};

export const credentialsEmailTemplate = (data: CredentialsEmailData): string => {
  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        width: 80px;
        height: 80px;
        line-height: 80px;
        margin-bottom: 20px;
      ">
        <span style="font-size: 40px; color: white;">🔑</span>
      </div>
      <h1 style="color: #1a1a1a; font-size: 28px; margin: 0 0 10px 0; font-weight: 700;">
        ¡Tu cuenta está lista!
      </h1>
      <p style="color: #666; font-size: 16px; margin: 0;">
        Aquí están tus credenciales de acceso
      </p>
    </div>

    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
      Hola <strong>${data.customerName}</strong>,
    </p>

    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
      Tu cuenta de TIS TIS ha sido creada exitosamente. A continuación encontrarás tus credenciales de acceso para ingresar a tu dashboard.
    </p>

    <!-- Credentials Box -->
    <div style="
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
      border: 2px solid #667eea;
      border-radius: 12px;
      padding: 25px;
      margin: 25px 0;
    ">
      <h3 style="color: #667eea; font-size: 18px; margin: 0 0 20px 0; font-weight: 600;">
        🔐 Credenciales de Acceso
      </h3>

      <div style="margin-bottom: 15px;">
        <p style="color: #666; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Correo electrónico
        </p>
        <p style="
          color: #1a1a1a;
          font-size: 16px;
          margin: 0;
          padding: 12px 15px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          font-family: monospace;
        ">
          ${data.email}
        </p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="color: #666; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Contraseña temporal
        </p>
        <p style="
          color: #1a1a1a;
          font-size: 16px;
          margin: 0;
          padding: 12px 15px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          font-family: monospace;
          letter-spacing: 1px;
        ">
          ${data.tempPassword}
        </p>
      </div>

      <div style="
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 12px 15px;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <span style="font-size: 20px;">⚠️</span>
        <p style="color: #856404; font-size: 14px; margin: 0;">
          <strong>Importante:</strong> Te recomendamos cambiar tu contraseña en tu primer inicio de sesión.
        </p>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 35px 0;">
      <a href="${data.dashboardUrl}" style="
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 40px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 16px;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.35);
        transition: all 0.3s ease;
      ">
        Acceder a mi Dashboard →
      </a>
    </div>

    <!-- Next Steps -->
    <div style="
      background: #f8f9fa;
      border-radius: 12px;
      padding: 25px;
      margin: 25px 0;
    ">
      <h3 style="color: #1a1a1a; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">
        📋 Próximos pasos
      </h3>
      <ol style="color: #666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Ingresa con tus credenciales al dashboard</li>
        <li>Cambia tu contraseña por una segura</li>
        <li>Configura los datos de tu negocio</li>
        <li>Conecta tu WhatsApp Business</li>
        <li>¡Empieza a recibir clientes con tu asistente IA!</li>
      </ol>
    </div>

    <!-- Support -->
    <div style="
      text-align: center;
      padding-top: 25px;
      border-top: 1px solid #eee;
    ">
      <p style="color: #999; font-size: 14px; margin: 0 0 10px 0;">
        ¿Necesitas ayuda para empezar?
      </p>
      <p style="color: #666; font-size: 14px; margin: 0;">
        Responde a este correo o escríbenos a <a href="mailto:soporte@tistis.com" style="color: #667eea; text-decoration: none;">soporte@tistis.com</a>
      </p>
    </div>
  `;

  return baseEmailTemplate({
    previewText: 'Tus credenciales de acceso a TIS TIS están listas',
    content,
  });
};
