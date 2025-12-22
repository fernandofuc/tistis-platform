// =====================================================
// TIS TIS PLATFORM - Términos de Servicio
// Condiciones legales de uso de la plataforma
// =====================================================

import { Metadata } from 'next';
import { FileText, CheckCircle, XCircle, CreditCard, Shield, AlertTriangle, Scale, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Términos de Servicio | TIS TIS',
  description: 'Términos y condiciones de uso de TIS TIS. Conoce tus derechos y obligaciones al usar nuestra plataforma de automatización empresarial.',
  openGraph: {
    title: 'Términos de Servicio | TIS TIS',
    description: 'Términos y condiciones de uso de TIS TIS.',
  },
};

const sections = [
  {
    id: 'aceptacion',
    icon: CheckCircle,
    title: '1. Aceptación de los Términos',
    content: `
      <p>Al acceder o utilizar TIS TIS ("la Plataforma", "el Servicio"), aceptas estar legalmente vinculado por estos Términos de Servicio ("Términos"). Si no estás de acuerdo con alguna parte de estos términos, no podrás acceder al Servicio.</p>
      <p>Estos Términos aplican a todos los usuarios, visitantes y cualquier persona que acceda o use el Servicio.</p>
      <p><strong>Última actualización:</strong> Diciembre 2024</p>
    `,
  },
  {
    id: 'descripcion',
    icon: FileText,
    title: '2. Descripción del Servicio',
    content: `
      <p>TIS TIS es una plataforma SaaS (Software as a Service) que proporciona:</p>
      <ul>
        <li><strong>Gestión de Leads:</strong> Captura, clasificación y seguimiento automatizado de prospectos</li>
        <li><strong>Comunicación Multi-Canal:</strong> Integración con WhatsApp Business, Instagram, Facebook y TikTok</li>
        <li><strong>Inteligencia Artificial:</strong> Respuestas automáticas contextuales usando Claude AI</li>
        <li><strong>Agendamiento:</strong> Sistema de citas automatizado con recordatorios</li>
        <li><strong>CRM:</strong> Gestión de clientes, historial y seguimiento</li>
        <li><strong>Analytics:</strong> Reportes y métricas de rendimiento</li>
      </ul>
      <p>El Servicio está diseñado para negocios que buscan automatizar su atención al cliente y operaciones.</p>
    `,
  },
  {
    id: 'cuentas',
    icon: Shield,
    title: '3. Cuentas de Usuario',
    content: `
      <h4>3.1 Registro</h4>
      <ul>
        <li>Debes proporcionar información precisa y completa al registrarte</li>
        <li>Debes ser mayor de 18 años o tener capacidad legal para contratar</li>
        <li>Eres responsable de mantener la confidencialidad de tu contraseña</li>
        <li>Debes notificarnos inmediatamente sobre cualquier uso no autorizado</li>
      </ul>

      <h4>3.2 Tipos de Cuenta</h4>
      <ul>
        <li><strong>Administrador:</strong> Control total sobre el tenant y usuarios</li>
        <li><strong>Recepcionista:</strong> Gestión de leads, citas y pacientes</li>
        <li><strong>Especialista:</strong> Acceso limitado según configuración</li>
      </ul>

      <h4>3.3 Responsabilidad</h4>
      <p>Eres responsable de todas las actividades que ocurran bajo tu cuenta, incluyendo las acciones de tus empleados o colaboradores.</p>
    `,
  },
  {
    id: 'uso-aceptable',
    icon: CheckCircle,
    title: '4. Uso Aceptable',
    content: `
      <p>Al usar TIS TIS, te comprometes a:</p>
      <ul>
        <li>Cumplir con todas las leyes y regulaciones aplicables</li>
        <li>Obtener el consentimiento necesario de tus clientes para procesar sus datos</li>
        <li>No enviar spam ni mensajes no solicitados</li>
        <li>Respetar las políticas de las plataformas integradas (WhatsApp, Meta, etc.)</li>
        <li>No intentar acceder a datos de otros usuarios o tenants</li>
        <li>No realizar ingeniería inversa del software</li>
        <li>No sobrecargar los servidores con solicitudes excesivas</li>
        <li>Mantener información de contacto actualizada</li>
      </ul>
    `,
  },
  {
    id: 'uso-prohibido',
    icon: XCircle,
    title: '5. Uso Prohibido',
    content: `
      <p>Está estrictamente prohibido usar TIS TIS para:</p>
      <ul>
        <li>Actividades ilegales o fraudulentas</li>
        <li>Envío de contenido ilegal, difamatorio, obsceno o amenazante</li>
        <li>Suplantación de identidad</li>
        <li>Distribución de malware o código malicioso</li>
        <li>Violación de propiedad intelectual de terceros</li>
        <li>Acoso, intimidación o discriminación</li>
        <li>Recopilación de datos sin consentimiento</li>
        <li>Competencia desleal o espionaje comercial</li>
        <li>Venta o reventa no autorizada del Servicio</li>
      </ul>
      <p><strong>Consecuencia:</strong> La violación de estas prohibiciones resultará en la suspensión o terminación inmediata de tu cuenta sin reembolso.</p>
    `,
  },
  {
    id: 'pagos',
    icon: CreditCard,
    title: '6. Pagos y Suscripciones',
    content: `
      <h4>6.1 Planes y Precios</h4>
      <ul>
        <li><strong>Starter:</strong> $3,490 MXN/mes (1 sucursal)</li>
        <li><strong>Essentials:</strong> $7,490 MXN/mes (hasta 8 sucursales)</li>
        <li><strong>Growth:</strong> $12,490 MXN/mes (hasta 20 sucursales)</li>
        <li><strong>Enterprise:</strong> Contactar para cotización personalizada</li>
      </ul>
      <p>Los precios están sujetos a cambios con notificación previa de 30 días.</p>

      <h4>6.2 Facturación</h4>
      <ul>
        <li>La facturación es mensual y se cobra por adelantado</li>
        <li>Los cargos se realizan automáticamente a tu método de pago registrado</li>
        <li>Recibirás factura electrónica (CFDI) por cada pago</li>
      </ul>

      <h4>6.3 Política de Reembolsos</h4>
      <ul>
        <li>Ofrecemos prueba gratuita de 14 días sin compromiso</li>
        <li>No hay reembolsos por períodos parciales de suscripción</li>
        <li>En caso de error de facturación, contacta a soporte dentro de 7 días</li>
      </ul>

      <h4>6.4 Impago</h4>
      <p>Si el pago falla, tendrás un período de gracia de 7 días. Después de este período, el servicio será suspendido hasta regularizar el pago.</p>
    `,
  },
  {
    id: 'propiedad-intelectual',
    icon: Shield,
    title: '7. Propiedad Intelectual',
    content: `
      <h4>7.1 Nuestra Propiedad</h4>
      <p>TIS TIS, incluyendo su código, diseño, logos, marcas y documentación, es propiedad exclusiva de TIS TIS o sus licenciantes. No adquieres ningún derecho de propiedad sobre el Servicio.</p>

      <h4>7.2 Tu Contenido</h4>
      <p>Mantienes todos los derechos sobre los datos que ingresas a la plataforma (información de clientes, conversaciones, etc.). Nos otorgas una licencia limitada para procesar estos datos únicamente para prestarte el Servicio.</p>

      <h4>7.3 Feedback</h4>
      <p>Si proporcionas sugerencias o feedback sobre el Servicio, nos otorgas el derecho de usar esas ideas sin compensación ni atribución.</p>
    `,
  },
  {
    id: 'integraciones',
    icon: FileText,
    title: '8. Integraciones con Terceros',
    content: `
      <h4>8.1 Plataformas de Mensajería</h4>
      <p>El uso de integraciones con WhatsApp, Instagram, Facebook y TikTok está sujeto a los términos de servicio de cada plataforma:</p>
      <ul>
        <li><strong>WhatsApp:</strong> Debes cumplir con la Política de Mensajería Comercial de WhatsApp</li>
        <li><strong>Meta (Instagram/Facebook):</strong> Debes cumplir con las Políticas de la Plataforma de Meta</li>
        <li><strong>TikTok:</strong> Debes cumplir con los Términos de Servicio de TikTok Business</li>
      </ul>

      <h4>8.2 Responsabilidad</h4>
      <p>No somos responsables por cambios, interrupciones o terminación de servicios de terceros. Si una plataforma suspende tu cuenta, el servicio correspondiente dejará de funcionar.</p>

      <h4>8.3 Tokens de Acceso</h4>
      <p>Eres responsable de mantener seguros los tokens de acceso y credenciales de integración.</p>
    `,
  },
  {
    id: 'limitacion',
    icon: AlertTriangle,
    title: '9. Limitación de Responsabilidad',
    content: `
      <h4>9.1 Disponibilidad</h4>
      <p>Nos esforzamos por mantener el Servicio disponible 24/7, pero no garantizamos disponibilidad ininterrumpida. Pueden ocurrir interrupciones por mantenimiento, actualizaciones o circunstancias fuera de nuestro control.</p>

      <h4>9.2 Exclusión de Garantías</h4>
      <p>EL SERVICIO SE PROPORCIONA "TAL CUAL" Y "SEGÚN DISPONIBILIDAD". NO OFRECEMOS GARANTÍAS EXPRESAS O IMPLÍCITAS, INCLUYENDO GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR O NO INFRACCIÓN.</p>

      <h4>9.3 Limitación de Daños</h4>
      <p>EN NINGÚN CASO SEREMOS RESPONSABLES POR:</p>
      <ul>
        <li>Daños indirectos, incidentales, especiales o consecuentes</li>
        <li>Pérdida de beneficios, datos o oportunidades de negocio</li>
        <li>Daños que excedan el monto pagado en los últimos 12 meses</li>
      </ul>

      <h4>9.4 Excepciones</h4>
      <p>Estas limitaciones no aplican en casos de negligencia grave, dolo o donde la ley no permita tales limitaciones.</p>
    `,
  },
  {
    id: 'indemnizacion',
    icon: Scale,
    title: '10. Indemnización',
    content: `
      <p>Aceptas indemnizar, defender y mantener indemne a TIS TIS, sus directores, empleados y afiliados de cualquier reclamación, daño, pérdida o gasto (incluyendo honorarios legales) que surjan de:</p>
      <ul>
        <li>Tu uso del Servicio</li>
        <li>Tu violación de estos Términos</li>
        <li>Tu violación de derechos de terceros</li>
        <li>El contenido que proceses a través del Servicio</li>
        <li>Las acciones de tus empleados o colaboradores</li>
      </ul>
    `,
  },
  {
    id: 'terminacion',
    icon: XCircle,
    title: '11. Terminación',
    content: `
      <h4>11.1 Por tu Parte</h4>
      <p>Puedes cancelar tu suscripción en cualquier momento desde tu dashboard. La cancelación será efectiva al final del período de facturación actual.</p>

      <h4>11.2 Por Nuestra Parte</h4>
      <p>Podemos suspender o terminar tu acceso si:</p>
      <ul>
        <li>Violas estos Términos de Servicio</li>
        <li>No pagas las cuotas correspondientes</li>
        <li>Tu uso pone en riesgo la plataforma o a otros usuarios</li>
        <li>Recibimos una orden legal que lo requiera</li>
      </ul>

      <h4>11.3 Efectos de la Terminación</h4>
      <ul>
        <li>Perderás acceso inmediato al Servicio</li>
        <li>Tus datos serán retenidos por 90 días para posible reactivación</li>
        <li>Después de 90 días, los datos serán eliminados permanentemente</li>
        <li>Podrás solicitar exportación de datos antes de la eliminación</li>
      </ul>
    `,
  },
  {
    id: 'modificaciones',
    icon: FileText,
    title: '12. Modificaciones',
    content: `
      <h4>12.1 Cambios al Servicio</h4>
      <p>Nos reservamos el derecho de modificar, suspender o descontinuar cualquier aspecto del Servicio en cualquier momento, con o sin previo aviso.</p>

      <h4>12.2 Cambios a estos Términos</h4>
      <p>Podemos actualizar estos Términos periódicamente. Te notificaremos sobre cambios materiales mediante:</p>
      <ul>
        <li>Email a tu dirección registrada</li>
        <li>Aviso destacado en la plataforma</li>
        <li>Actualización de la fecha de modificación</li>
      </ul>
      <p>El uso continuado del Servicio después de los cambios constituye aceptación de los nuevos Términos.</p>
    `,
  },
  {
    id: 'general',
    icon: Scale,
    title: '13. Disposiciones Generales',
    content: `
      <h4>13.1 Ley Aplicable</h4>
      <p>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier disputa será resuelta en los tribunales competentes de la Ciudad de México.</p>

      <h4>13.2 Acuerdo Completo</h4>
      <p>Estos Términos, junto con la Política de Privacidad, constituyen el acuerdo completo entre tú y TIS TIS.</p>

      <h4>13.3 Cesión</h4>
      <p>No puedes ceder ni transferir estos Términos sin nuestro consentimiento previo por escrito. Nosotros podemos ceder nuestros derechos y obligaciones sin restricción.</p>

      <h4>13.4 Renuncia</h4>
      <p>El hecho de que no ejerzamos un derecho no constituye renuncia al mismo.</p>

      <h4>13.5 Divisibilidad</h4>
      <p>Si alguna disposición es declarada inválida, las demás disposiciones permanecerán en vigor.</p>
    `,
  },
  {
    id: 'contacto',
    icon: Mail,
    title: '14. Contacto',
    content: `
      <p>Para preguntas sobre estos Términos:</p>
      <ul>
        <li><strong>Email Legal:</strong> <a href="mailto:legal@tistis.com" class="text-tis-coral hover:underline">legal@tistis.com</a></li>
        <li><strong>Soporte:</strong> <a href="mailto:soporte@tistis.com" class="text-tis-coral hover:underline">soporte@tistis.com</a></li>
      </ul>
      <p>Respondemos a consultas legales en un máximo de 5 días hábiles.</p>
    `,
  },
];

export default function TermsPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-tis-bg-primary to-white">
        <div className="absolute top-20 left-10 w-72 h-72 bg-tis-green/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-tis-purple/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-card border border-slate-100 mb-6">
            <FileText className="w-5 h-5 text-tis-purple" />
            <span className="text-sm font-medium text-slate-700">Documento legal</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Términos de Servicio
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Estos términos regulan el uso de TIS TIS. Por favor, léelos cuidadosamente
            antes de usar nuestra plataforma.
          </p>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Contenido</h2>
          <nav className="grid sm:grid-cols-2 gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-tis-purple hover:bg-white rounded-lg transition-colors"
              >
                <section.icon className="w-4 h-4" />
                {section.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Content Sections */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="space-y-12">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-24"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-tis-purple/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-tis-purple" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 pt-1">
                    {section.title}
                  </h2>
                </div>

                <div
                  className="prose prose-slate max-w-none pl-14
                    prose-headings:text-slate-900 prose-headings:font-semibold prose-headings:text-base prose-headings:mt-6 prose-headings:mb-3
                    prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-4
                    prose-ul:text-slate-600 prose-ul:my-3
                    prose-li:my-1
                    prose-strong:text-slate-900
                    prose-a:text-tis-purple prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </article>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            ¿Tienes preguntas sobre estos términos?
          </h2>
          <p className="text-slate-600 mb-6">
            Nuestro equipo legal está disponible para aclarar cualquier duda.
          </p>
          <a
            href="mailto:legal@tistis.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-primary text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          >
            <Mail className="w-5 h-5" />
            Contactar al Equipo Legal
          </a>
        </div>
      </section>
    </div>
  );
}
