// =====================================================
// TIS TIS - Base Email Template
// Professional HTML email structure with TIS TIS branding
// =====================================================

export interface BaseTemplateParams {
  previewText: string;
  content: string;
  footerExtra?: string;
}

// TIS TIS Brand Colors
const BRAND = {
  primary: '#7C5CFC',      // Purple
  secondary: '#DF7373',    // Coral
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  dark: '#1a1a2e',
  light: '#f8f9fa',
  text: '#333333',
  textMuted: '#666666',
  border: '#e5e7eb',
};

export function baseEmailTemplate({ previewText, content, footerExtra }: BaseTemplateParams): string {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>TIS TIS</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f4f4f7;
    }
    a {
      color: ${BRAND.primary};
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .button {
      display: inline-block;
      padding: 16px 32px;
      background: ${BRAND.primary};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background: #6B4FE0;
      text-decoration: none;
    }
    .button-coral {
      background: ${BRAND.secondary};
    }
    .button-coral:hover {
      background: #C23350;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 0 16px !important;
      }
      .content {
        padding: 24px !important;
      }
      .button {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Preview text (hidden) -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${previewText}
  </div>

  <!-- Spacer for preview text -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Main container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 0;">

        <!-- Email content wrapper -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%;">

          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 0 0 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <!-- Brain Logo -->
                    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 24px;">🧠</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; font-weight: 700; color: ${BRAND.dark};">TIS TIS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main content card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td class="content" style="padding: 48px 40px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 0 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                ${footerExtra ? `
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    ${footerExtra}
                  </td>
                </tr>
                ` : ''}

                <!-- Social & Contact -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://instagram.com/tistis_mx" style="color: ${BRAND.textMuted}; text-decoration: none;">
                            Instagram
                          </a>
                        </td>
                        <td style="padding: 0 8px; color: ${BRAND.border};">|</td>
                        <td style="padding: 0 8px;">
                          <a href="https://linkedin.com/company/tistis" style="color: ${BRAND.textMuted}; text-decoration: none;">
                            LinkedIn
                          </a>
                        </td>
                        <td style="padding: 0 8px; color: ${BRAND.border};">|</td>
                        <td style="padding: 0 8px;">
                          <a href="mailto:hola@tistis.com" style="color: ${BRAND.textMuted}; text-decoration: none;">
                            hola@tistis.com
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Legal -->
                <tr>
                  <td align="center" style="color: ${BRAND.textMuted}; font-size: 12px; line-height: 1.6;">
                    <p style="margin: 0 0 8px 0;">
                      © ${currentYear} TIS TIS. Todos los derechos reservados.
                    </p>
                    <p style="margin: 0;">
                      El cerebro digital que tu negocio necesita.
                    </p>
                  </td>
                </tr>

                <!-- Unsubscribe -->
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; color: #999999; font-size: 11px;">
                      Recibes este correo porque tienes una cuenta en TIS TIS.<br>
                      <a href="{{{unsubscribe_url}}}" style="color: #999999; text-decoration: underline;">
                        Administrar preferencias de correo
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

// Helper function to create a primary CTA button
export function createButton(text: string, url: string, variant: 'primary' | 'coral' = 'primary'): string {
  const bgColor = variant === 'coral' ? BRAND.secondary : BRAND.primary;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td align="center" style="border-radius: 8px; background-color: ${bgColor};">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// Helper function to create a feature list
export function createFeatureList(features: string[]): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${features.map(feature => `
        <tr>
          <td style="padding: 8px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                  <span style="color: #10B981; font-size: 16px;">✓</span>
                </td>
                <td style="color: ${BRAND.text}; font-size: 15px; line-height: 1.5;">
                  ${feature}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `).join('')}
    </table>
  `;
}

// Helper function to create an info box
export function createInfoBox(content: string, bgColor: string = '#f0f9ff', borderColor: string = '#0ea5e9'): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px 20px; border-radius: 0 8px 8px 0;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}
