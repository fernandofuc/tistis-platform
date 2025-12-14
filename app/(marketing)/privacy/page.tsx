// =====================================================
// TIS TIS PLATFORM - Política de Privacidad
// Página legal con información sobre manejo de datos
// =====================================================

import { Metadata } from 'next';
import { Shield, Lock, Eye, Server, Users, Mail, AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidad | TIS TIS',
  description: 'Conoce cómo TIS TIS protege y maneja tus datos. Política de privacidad, seguridad de información y derechos de los usuarios.',
  openGraph: {
    title: 'Política de Privacidad | TIS TIS',
    description: 'Conoce cómo TIS TIS protege y maneja tus datos.',
  },
};

// Secciones de la política de privacidad
const sections = [
  {
    id: 'introduccion',
    icon: Shield,
    title: '1. Introducción',
    content: `
      <p>En TIS TIS ("nosotros", "nuestro" o "la Plataforma"), nos comprometemos a proteger la privacidad de nuestros usuarios y sus clientes. Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos la información cuando utilizas nuestra plataforma de automatización empresarial.</p>
      <p>TIS TIS es una plataforma SaaS (Software as a Service) multi-tenant que proporciona herramientas de gestión de leads, comunicación automatizada, agendamiento de citas e inteligencia artificial para negocios.</p>
      <p><strong>Última actualización:</strong> Diciembre 2024</p>
    `,
  },
  {
    id: 'datos-recopilados',
    icon: Eye,
    title: '2. Información que Recopilamos',
    content: `
      <h4>2.1 Información de Cuenta</h4>
      <ul>
        <li>Nombre completo y datos de contacto</li>
        <li>Correo electrónico</li>
        <li>Información de la empresa (nombre, dirección, industria)</li>
        <li>Información de facturación y pago</li>
      </ul>

      <h4>2.2 Información de tus Clientes (Leads y Pacientes)</h4>
      <ul>
        <li>Nombres y datos de contacto</li>
        <li>Historial de conversaciones (WhatsApp, Instagram, Facebook, TikTok)</li>
        <li>Historial de citas y servicios</li>
        <li>Información clínica (solo para verticales de salud, con consentimiento explícito)</li>
        <li>Preferencias y notas de seguimiento</li>
      </ul>

      <h4>2.3 Información Técnica</h4>
      <ul>
        <li>Dirección IP y datos de ubicación aproximada</li>
        <li>Tipo de dispositivo y navegador</li>
        <li>Cookies y tecnologías similares</li>
        <li>Logs de actividad y uso de la plataforma</li>
      </ul>

      <h4>2.4 Información de Integraciones</h4>
      <ul>
        <li>Tokens de acceso a WhatsApp Business API</li>
        <li>Credenciales de integración con Meta (Instagram, Facebook)</li>
        <li>Webhooks y configuraciones de automatización</li>
      </ul>
    `,
  },
  {
    id: 'uso-datos',
    icon: Server,
    title: '3. Cómo Usamos tu Información',
    content: `
      <p>Utilizamos la información recopilada para:</p>

      <h4>3.1 Prestación del Servicio</h4>
      <ul>
        <li>Gestionar tu cuenta y suscripción</li>
        <li>Procesar y responder mensajes de tus clientes mediante IA</li>
        <li>Agendar y gestionar citas automáticamente</li>
        <li>Clasificar y puntuar leads según su interés</li>
        <li>Generar reportes y analytics de tu negocio</li>
      </ul>

      <h4>3.2 Inteligencia Artificial</h4>
      <ul>
        <li>Nuestro sistema utiliza Claude AI (Anthropic) para procesar conversaciones</li>
        <li>La IA analiza mensajes para generar respuestas contextuales</li>
        <li>El scoring de leads se basa en análisis de intención de compra</li>
        <li><strong>Importante:</strong> No usamos tus datos para entrenar modelos de IA externos</li>
      </ul>

      <h4>3.3 Mejora del Servicio</h4>
      <ul>
        <li>Analizar patrones de uso para mejorar la plataforma</li>
        <li>Identificar y corregir errores técnicos</li>
        <li>Desarrollar nuevas funcionalidades</li>
      </ul>

      <h4>3.4 Comunicaciones</h4>
      <ul>
        <li>Enviarte actualizaciones importantes del servicio</li>
        <li>Notificarte sobre cambios en términos o políticas</li>
        <li>Responder a tus consultas de soporte</li>
      </ul>
    `,
  },
  {
    id: 'compartir-datos',
    icon: Users,
    title: '4. Compartición de Datos',
    content: `
      <p><strong>No vendemos tu información personal ni la de tus clientes.</strong></p>

      <p>Compartimos información únicamente con:</p>

      <h4>4.1 Proveedores de Servicios</h4>
      <ul>
        <li><strong>Supabase:</strong> Almacenamiento de base de datos (PostgreSQL)</li>
        <li><strong>Anthropic (Claude AI):</strong> Procesamiento de lenguaje natural</li>
        <li><strong>Meta (WhatsApp/Instagram/Facebook):</strong> APIs de mensajería</li>
        <li><strong>Vercel:</strong> Hosting y despliegue de la aplicación</li>
        <li><strong>Stripe:</strong> Procesamiento de pagos (no almacenamos datos de tarjetas)</li>
      </ul>

      <h4>4.2 Requerimientos Legales</h4>
      <p>Podemos divulgar información cuando sea requerido por ley, orden judicial, o para proteger nuestros derechos legales.</p>

      <h4>4.3 Transferencias de Negocio</h4>
      <p>En caso de fusión, adquisición o venta de activos, la información puede ser transferida al nuevo propietario, quien estará sujeto a esta política.</p>
    `,
  },
  {
    id: 'seguridad',
    icon: Lock,
    title: '5. Seguridad de Datos',
    content: `
      <p>Implementamos medidas de seguridad robustas:</p>

      <h4>5.1 Seguridad Técnica</h4>
      <ul>
        <li><strong>Encriptación:</strong> Datos en tránsito (TLS 1.3) y en reposo (AES-256)</li>
        <li><strong>Row Level Security (RLS):</strong> Aislamiento de datos entre tenants</li>
        <li><strong>Autenticación segura:</strong> JWT con expiración, refresh tokens</li>
        <li><strong>Advisory Locks:</strong> Prevención de race conditions</li>
      </ul>

      <h4>5.2 Seguridad Organizacional</h4>
      <ul>
        <li>Acceso basado en roles (RBAC)</li>
        <li>Auditoría de acceso a datos sensibles</li>
        <li>Políticas de contraseñas seguras</li>
        <li>Monitoreo continuo de amenazas</li>
      </ul>

      <h4>5.3 Arquitectura Multi-Tenant</h4>
      <ul>
        <li>Cada negocio (tenant) tiene sus datos completamente aislados</li>
        <li>Los empleados solo pueden acceder a datos de su propio negocio</li>
        <li>Validación de tenant en cada operación de base de datos</li>
      </ul>
    `,
  },
  {
    id: 'derechos',
    icon: Users,
    title: '6. Tus Derechos',
    content: `
      <p>Como usuario de TIS TIS, tienes derecho a:</p>

      <h4>6.1 Acceso</h4>
      <p>Solicitar una copia de todos los datos personales que tenemos sobre ti.</p>

      <h4>6.2 Rectificación</h4>
      <p>Corregir datos inexactos o incompletos en cualquier momento desde tu dashboard.</p>

      <h4>6.3 Eliminación</h4>
      <p>Solicitar la eliminación de tu cuenta y todos los datos asociados. Procesamos estas solicitudes en un máximo de 30 días.</p>

      <h4>6.4 Portabilidad</h4>
      <p>Exportar tus datos en formato estructurado (CSV, JSON).</p>

      <h4>6.5 Oposición</h4>
      <p>Oponerte al procesamiento de tus datos para fines específicos.</p>

      <h4>6.6 Limitación</h4>
      <p>Solicitar la restricción del procesamiento de tus datos en ciertas circunstancias.</p>

      <p><strong>Para ejercer estos derechos:</strong> Contacta a <a href="mailto:privacidad@tistis.com" class="text-tis-coral hover:underline">privacidad@tistis.com</a></p>
    `,
  },
  {
    id: 'retencion',
    icon: Server,
    title: '7. Retención de Datos',
    content: `
      <h4>7.1 Datos de Cuenta</h4>
      <p>Mantenemos tus datos mientras tu cuenta esté activa. Tras la cancelación, retenemos datos por 90 días para permitir reactivación, luego se eliminan permanentemente.</p>

      <h4>7.2 Datos de Clientes (Leads/Pacientes)</h4>
      <p>Los datos de tus clientes se mantienen según tus preferencias de configuración. Puedes eliminarlos manualmente en cualquier momento.</p>

      <h4>7.3 Logs y Analytics</h4>
      <p>Los registros de actividad se mantienen por 12 meses para análisis y seguridad.</p>

      <h4>7.4 Datos de Facturación</h4>
      <p>Retenemos información de facturación por 7 años según requerimientos fiscales.</p>

      <h4>7.5 Backups</h4>
      <p>Los backups automáticos se mantienen por 30 días y luego se eliminan.</p>
    `,
  },
  {
    id: 'cookies',
    icon: Eye,
    title: '8. Cookies y Tecnologías Similares',
    content: `
      <p>Utilizamos cookies para:</p>

      <h4>8.1 Cookies Esenciales</h4>
      <ul>
        <li>Mantener tu sesión iniciada</li>
        <li>Recordar tus preferencias de configuración</li>
        <li>Garantizar la seguridad de la plataforma</li>
      </ul>

      <h4>8.2 Cookies de Analytics</h4>
      <ul>
        <li>Entender cómo usas la plataforma</li>
        <li>Identificar áreas de mejora</li>
        <li>Medir el rendimiento del servicio</li>
      </ul>

      <p><strong>Control de Cookies:</strong> Puedes gestionar las cookies desde la configuración de tu navegador. Ten en cuenta que deshabilitar cookies esenciales puede afectar el funcionamiento de la plataforma.</p>
    `,
  },
  {
    id: 'menores',
    icon: AlertCircle,
    title: '9. Menores de Edad',
    content: `
      <p>TIS TIS no está dirigido a menores de 18 años. No recopilamos intencionalmente información de menores.</p>
      <p>Si eres padre o tutor y crees que tu hijo nos ha proporcionado información personal, contacta a <a href="mailto:privacidad@tistis.com" class="text-tis-coral hover:underline">privacidad@tistis.com</a> para solicitar su eliminación.</p>
    `,
  },
  {
    id: 'internacional',
    icon: Server,
    title: '10. Transferencias Internacionales',
    content: `
      <p>Tus datos pueden ser procesados en servidores ubicados en:</p>
      <ul>
        <li><strong>Estados Unidos:</strong> Supabase, Vercel, Anthropic</li>
        <li><strong>Unión Europea:</strong> Algunos servicios de backup</li>
      </ul>
      <p>Nos aseguramos de que todos nuestros proveedores cumplan con estándares de protección de datos equivalentes o superiores a los de tu jurisdicción.</p>
    `,
  },
  {
    id: 'cambios',
    icon: AlertCircle,
    title: '11. Cambios a esta Política',
    content: `
      <p>Podemos actualizar esta política periódicamente. Te notificaremos sobre cambios significativos mediante:</p>
      <ul>
        <li>Email a la dirección asociada a tu cuenta</li>
        <li>Aviso destacado en la plataforma</li>
        <li>Actualización de la fecha de "última modificación"</li>
      </ul>
      <p>El uso continuado de la plataforma después de los cambios constituye aceptación de la nueva política.</p>
    `,
  },
  {
    id: 'contacto',
    icon: Mail,
    title: '12. Contacto',
    content: `
      <p>Para preguntas sobre privacidad o ejercer tus derechos:</p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:privacidad@tistis.com" class="text-tis-coral hover:underline">privacidad@tistis.com</a></li>
        <li><strong>Soporte:</strong> <a href="mailto:soporte@tistis.com" class="text-tis-coral hover:underline">soporte@tistis.com</a></li>
      </ul>
      <p>Respondemos a todas las solicitudes en un máximo de 30 días hábiles.</p>
    `,
  },
];

export default function PrivacyPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-tis-bg-primary to-white">
        <div className="absolute top-20 left-10 w-72 h-72 bg-tis-purple/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-tis-coral/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-card border border-slate-100 mb-6">
            <Shield className="w-5 h-5 text-tis-coral" />
            <span className="text-sm font-medium text-slate-700">Tu privacidad es nuestra prioridad</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Política de Privacidad
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            En TIS TIS nos tomamos muy en serio la protección de tus datos y los de tus clientes.
            Aquí explicamos cómo manejamos tu información.
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
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-tis-coral hover:bg-white rounded-lg transition-colors"
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
                  <div className="w-10 h-10 rounded-xl bg-tis-coral/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-tis-coral" />
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
                    prose-a:text-tis-coral prose-a:no-underline hover:prose-a:underline"
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
            ¿Tienes preguntas sobre privacidad?
          </h2>
          <p className="text-slate-600 mb-6">
            Nuestro equipo está disponible para resolver cualquier duda sobre el manejo de tus datos.
          </p>
          <a
            href="mailto:privacidad@tistis.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-coral text-white font-semibold rounded-xl shadow-coral hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <Mail className="w-5 h-5" />
            Contactar sobre Privacidad
          </a>
        </div>
      </section>
    </div>
  );
}
