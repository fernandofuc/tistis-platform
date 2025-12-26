# TIS TIS Platform - Checklist de Testing Completo

> **Instrucciones**: Marca cada item con [x] cuando lo hayas probado y verificado.
> Documenta cualquier bug encontrado al final de cada sección.

---

## 1. AUTENTICACIÓN Y ACCESO

### 1.1 Login
- [ ] Login con email/password válidos → Redirige a /dashboard
- [ ] Login con email incorrecto → Muestra error "Credenciales inválidas"
- [ ] Login con password incorrecto → Muestra error "Credenciales inválidas"
- [ ] Login con campos vacíos → Validación de formulario
- [ ] Botón "Olvidé mi contraseña" → Abre flujo de reset
- [ ] Login con Google OAuth → Funciona correctamente
- [ ] Sesión persiste al refrescar página
- [ ] Sesión expira correctamente después de tiempo de inactividad

### 1.2 Registro
- [ ] Registro de nuevo usuario → Email de confirmación enviado
- [ ] Registro con email ya existente → Error apropiado
- [ ] Validación de password (mínimo caracteres, complejidad)
- [ ] Confirmación de email → Activa cuenta correctamente

### 1.3 Reset de Password
- [ ] Solicitar reset → Email enviado con link
- [ ] Link de reset funciona → Permite cambiar password
- [ ] Link expira después de 24 horas
- [ ] Nuevo password funciona para login

### 1.4 Cambio de Password (Autenticado)
- [ ] Cambiar password con password actual correcto → Funciona
- [ ] Cambiar password con password actual incorrecto → Error
- [ ] Validación de nuevo password (complejidad)

### 1.5 Logout
- [ ] Logout limpia sesión completamente
- [ ] No se puede acceder a /dashboard sin sesión
- [ ] Redirect a /auth/login al intentar acceder rutas protegidas

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 2. ONBOARDING Y TRIAL

### 2.1 Discovery Chat
- [ ] Chat responde correctamente a mensajes
- [ ] Streaming de respuesta funciona (texto aparece progresivamente)
- [ ] Identifica tipo de negocio (dental, restaurante, otro)
- [ ] Genera análisis al final de la conversación
- [ ] Redirige a pricing/checkout con datos pre-llenados

### 2.2 Activación de Trial
- [ ] Nuevo usuario puede activar trial de 10 días
- [ ] Banner de trial aparece en dashboard
- [ ] Contador de días restantes es correcto
- [ ] Usuario no puede activar trial dos veces
- [ ] Acceso a features limitadas durante trial

### 2.3 Checkout
- [ ] Seleccionar plan → Abre checkout de Stripe
- [ ] Pago exitoso → Activa suscripción
- [ ] Pago fallido → Muestra error apropiado
- [ ] Cupones/descuentos funcionan (si aplica)

### 2.4 Welcome/Onboarding Post-Signup
- [ ] Página de bienvenida aparece después de primer login
- [ ] Wizard de configuración inicial funciona
- [ ] Puede saltar pasos opcionales
- [ ] Progreso de onboarding se guarda

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 3. DASHBOARD PRINCIPAL

### 3.1 Layout y Navegación
- [ ] Sidebar muestra todos los módulos correctamente
- [ ] Navegación entre páginas funciona sin errores
- [ ] Responsive: sidebar se colapsa en móvil
- [ ] Header muestra usuario actual y notificaciones
- [ ] Logo redirige a dashboard

### 3.2 Stats y Widgets
- [ ] Cards de estadísticas cargan datos correctos
- [ ] Datos se actualizan al cambiar filtros de fecha
- [ ] Skeleton loading aparece mientras carga
- [ ] Manejo de error si API falla

### 3.3 Realtime Updates
- [ ] Dashboard se actualiza cuando hay nuevos datos
- [ ] Notificaciones en tiempo real funcionan

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 4. GESTIÓN DE LEADS

### 4.1 Lista de Leads
- [ ] Lista carga correctamente
- [ ] Paginación funciona
- [ ] Filtros funcionan (status, fecha, fuente)
- [ ] Búsqueda por nombre/email/teléfono
- [ ] Ordenamiento por columnas

### 4.2 Crear Lead
- [ ] Formulario de nuevo lead abre correctamente
- [ ] Validación de campos requeridos
- [ ] Lead se guarda y aparece en lista
- [ ] Asignación de sucursal funciona

### 4.3 Editar Lead
- [ ] Click en lead → Abre detalles
- [ ] Puede editar todos los campos
- [ ] Cambios se guardan correctamente
- [ ] Historial de cambios se registra

### 4.4 Eliminar Lead
- [ ] Confirmación antes de eliminar
- [ ] Lead eliminado desaparece de lista
- [ ] No se puede recuperar lead eliminado (o sí, según diseño)

### 4.5 Conversión de Lead
- [ ] Convertir lead a paciente/cliente funciona
- [ ] Datos se transfieren correctamente
- [ ] Lead cambia de status a "convertido"

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 5. PACIENTES/CLIENTES

### 5.1 Lista de Pacientes
- [ ] Lista carga correctamente
- [ ] Paginación funciona
- [ ] Filtros funcionan
- [ ] Búsqueda funciona

### 5.2 CRUD de Pacientes
- [ ] Crear nuevo paciente → Funciona
- [ ] Editar paciente → Cambios se guardan
- [ ] Eliminar paciente → Confirmación y eliminación
- [ ] Ver detalles de paciente → Toda la info visible

### 5.3 Historial Clínico (si aplica a dental)
- [ ] Ver historial clínico de paciente
- [ ] Agregar nueva entrada al historial
- [ ] Adjuntar archivos/imágenes
- [ ] Historial ordenado cronológicamente

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 6. CITAS Y CALENDARIO

### 6.1 Vista de Calendario
- [ ] Calendario carga correctamente
- [ ] Vista por día/semana/mes funciona
- [ ] Citas aparecen en fecha/hora correcta
- [ ] Colores diferencian status de citas

### 6.2 Crear Cita
- [ ] Click en calendario → Abre modal de nueva cita
- [ ] Seleccionar paciente existente o crear nuevo
- [ ] Seleccionar servicio → Duración se auto-llena
- [ ] Seleccionar staff/doctor
- [ ] Seleccionar sucursal
- [ ] Validación de disponibilidad
- [ ] Cita aparece en calendario después de guardar

### 6.3 Editar Cita
- [ ] Click en cita → Panel de detalles
- [ ] Puede cambiar fecha/hora
- [ ] Puede cambiar status (pendiente, confirmada, completada, cancelada)
- [ ] Notificación al paciente (si configurado)

### 6.4 Cancelar Cita
- [ ] Cancelar cita → Confirmación
- [ ] Razón de cancelación (opcional)
- [ ] Cita marcada como cancelada
- [ ] Slot queda disponible nuevamente

### 6.5 Recordatorios
- [ ] Recordatorio automático 24h antes
- [ ] Recordatorio automático 1h antes (si configurado)
- [ ] Paciente recibe WhatsApp/SMS

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 7. COTIZACIONES

### 7.1 Lista de Cotizaciones
- [ ] Lista carga correctamente
- [ ] Filtros por status (borrador, enviada, aceptada, rechazada)
- [ ] Búsqueda por paciente/número

### 7.2 Crear Cotización
- [ ] Nueva cotización → Formulario abre
- [ ] Seleccionar paciente
- [ ] Agregar servicios/items con precios
- [ ] Cálculo automático de total
- [ ] Aplicar descuentos
- [ ] Notas/términos adicionales

### 7.3 Enviar Cotización
- [ ] Enviar por WhatsApp funciona
- [ ] Enviar por email funciona
- [ ] PDF generado correctamente
- [ ] Status cambia a "enviada"

### 7.4 Convertir a Cita
- [ ] Cotización aceptada → Crear cita automáticamente
- [ ] Datos de servicios se transfieren

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 8. INBOX / CONVERSACIONES

### 8.1 Lista de Conversaciones
- [ ] Conversaciones cargan ordenadas por última actividad
- [ ] Badge de mensajes no leídos
- [ ] Filtro por canal (WhatsApp, Instagram, etc.)
- [ ] Búsqueda funciona

### 8.2 Ver Conversación
- [ ] Historial de mensajes carga completo
- [ ] Mensajes del cliente vs agente diferenciados
- [ ] Scroll infinito para conversaciones largas
- [ ] Timestamps correctos

### 8.3 Enviar Mensaje
- [ ] Escribir y enviar mensaje funciona
- [ ] Mensaje aparece inmediatamente en UI
- [ ] Mensaje llega al cliente (verificar en WhatsApp)
- [ ] Indicador de "enviado" / "entregado" / "leído"

### 8.4 Asignación
- [ ] Asignar conversación a staff específico
- [ ] Transferir conversación a otro staff
- [ ] Marcar como resuelta

### 8.5 AI Handling
- [ ] Toggle AI on/off funciona
- [ ] Cuando AI está ON, responde automáticamente
- [ ] Cuando AI está OFF, no responde
- [ ] Escalación a humano funciona

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 9. CONFIGURACIÓN DE IA

### 9.1 Prompt del Agente
- [ ] Ver prompt actual del agente
- [ ] Editar prompt manualmente
- [ ] Regenerar prompt automáticamente
- [ ] Preview de cómo respondería el agente

### 9.2 Base de Conocimiento
- [ ] Agregar FAQ → Se guarda
- [ ] Editar FAQ → Cambios se guardan
- [ ] Eliminar FAQ
- [ ] Información del negocio (horarios, ubicación, etc.)

### 9.3 Configuración por Canal
- [ ] Configurar AI diferente por canal
- [ ] Habilitar/deshabilitar AI por canal
- [ ] Personalizar respuestas por canal

### 9.4 Escalación
- [ ] Configurar palabras clave para escalación
- [ ] Configurar a quién escalar
- [ ] Probar que escalación funciona

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 10. AGENTE DE VOZ

### 10.1 Configuración General
- [ ] Habilitar/deshabilitar agente de voz
- [ ] Configurar voz (idioma, velocidad, tono)
- [ ] Configurar horarios de atención

### 10.2 Números de Teléfono
- [ ] Solicitar nuevo número → Request creado
- [ ] Ver números asignados
- [ ] Asignar número a sucursal
- [ ] Liberar número

### 10.3 Llamadas
- [ ] Ver historial de llamadas
- [ ] Reproducir grabación (si disponible)
- [ ] Ver transcripción
- [ ] Métricas de llamadas (duración, resolución)

### 10.4 Probar Agente
- [ ] Llamar al número configurado
- [ ] Agente responde correctamente
- [ ] Puede reservar cita por voz
- [ ] Escalación a humano funciona

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 11. PROGRAMA DE LEALTAD

### 11.1 Configuración del Programa
- [ ] Habilitar/deshabilitar programa
- [ ] Configurar nombre del programa
- [ ] Configurar valor de tokens

### 11.2 Reglas de Tokens
- [ ] Crear regla (ej: 1 token por $100 gastados)
- [ ] Editar regla
- [ ] Eliminar regla
- [ ] Múltiples reglas funcionan correctamente

### 11.3 Recompensas
- [ ] Crear recompensa (ej: 10% descuento por 100 tokens)
- [ ] Editar recompensa
- [ ] Eliminar recompensa
- [ ] Recompensa aparece para clientes elegibles

### 11.4 Miembros
- [ ] Ver lista de miembros
- [ ] Ver balance de tokens de cada miembro
- [ ] Historial de transacciones
- [ ] Agregar/restar tokens manualmente

### 11.5 Membresías Premium
- [ ] Crear plan de membresía
- [ ] Editar plan
- [ ] Cliente puede suscribirse a membresía
- [ ] Beneficios se aplican automáticamente

### 11.6 Redenciones
- [ ] Cliente puede redimir recompensa
- [ ] Tokens se descuentan correctamente
- [ ] Historial de redenciones

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 12. ANALYTICS Y REPORTES

### 12.1 Dashboard de Analytics
- [ ] Gráficos cargan correctamente
- [ ] Filtros de fecha funcionan
- [ ] Datos son consistentes con otras vistas
- [ ] Export de datos funciona

### 12.2 Business Insights (IA)
- [ ] Insights se generan correctamente
- [ ] Recomendaciones son relevantes
- [ ] Puede solicitar nuevos insights

### 12.3 Métricas Específicas
- [ ] Leads por fuente
- [ ] Conversiones por período
- [ ] Ingresos por servicio
- [ ] Performance por staff
- [ ] Satisfacción de clientes

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 13. CONFIGURACIÓN GENERAL

### 13.1 Perfil de Negocio
- [ ] Editar nombre del negocio
- [ ] Editar logo
- [ ] Editar información de contacto
- [ ] Editar dirección

### 13.2 Sucursales
- [ ] Crear nueva sucursal
- [ ] Editar sucursal existente
- [ ] Eliminar sucursal (si no tiene datos)
- [ ] Configurar horarios por sucursal

### 13.3 Staff/Equipo
- [ ] Agregar nuevo staff
- [ ] Asignar rol (admin, staff, viewer)
- [ ] Asignar a sucursal(es)
- [ ] Desactivar staff
- [ ] Eliminar staff

### 13.4 Servicios
- [ ] Crear nuevo servicio
- [ ] Configurar precio y duración
- [ ] Asignar categoría
- [ ] Desactivar servicio
- [ ] Ordenar servicios por prioridad

### 13.5 Canales
- [ ] Conectar WhatsApp Business
- [ ] Conectar Instagram
- [ ] Conectar Facebook Messenger
- [ ] Conectar TikTok
- [ ] Desconectar canal
- [ ] Ver status de conexión

### 13.6 Pagos
- [ ] Conectar Stripe
- [ ] Ver métodos de pago guardados
- [ ] Configurar facturación

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 14. SUSCRIPCIÓN Y FACTURACIÓN

### 14.1 Ver Suscripción
- [ ] Plan actual visible
- [ ] Fecha de próximo cobro
- [ ] Monto a cobrar
- [ ] Features incluidas

### 14.2 Cambiar Plan
- [ ] Upgrade de plan → Checkout
- [ ] Downgrade de plan → Confirmación
- [ ] Cambio se refleja inmediatamente

### 14.3 Cancelar Suscripción
- [ ] Flujo de cancelación
- [ ] Encuesta de salida
- [ ] Acceso hasta fin de período
- [ ] Confirmación de cancelación

### 14.4 Historial de Pagos
- [ ] Ver todos los pagos
- [ ] Descargar factura PDF
- [ ] Status de cada pago

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 15. PÁGINAS PÚBLICAS

### 15.1 Home Page
- [ ] Carga correctamente
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Links funcionan
- [ ] CTAs llevan a destino correcto

### 15.2 Pricing
- [ ] Planes visibles con precios correctos
- [ ] Comparativa de features
- [ ] Botones de "Empezar" funcionan
- [ ] Toggle mensual/anual

### 15.3 Discovery
- [ ] Chat funciona
- [ ] Responsive
- [ ] Redirige a checkout al completar

### 15.4 Enterprise
- [ ] Formulario de contacto funciona
- [ ] Validación de campos
- [ ] Mensaje de confirmación
- [ ] Lead guardado en sistema

### 15.5 Legal
- [ ] /privacy carga
- [ ] /terms carga
- [ ] Contenido completo

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 16. SEGURIDAD Y EDGE CASES

### 16.1 Rate Limiting
- [ ] Enviar +5 requests a /api/enterprise-contact → 429 Too Many Requests
- [ ] Enviar +100 requests/min a /api/webhook → 429

### 16.2 Autenticación de APIs
- [ ] Request sin token → 401 Unauthorized
- [ ] Request con token expirado → 401
- [ ] Request con token de otro tenant → 403

### 16.3 Validación de Datos
- [ ] Campos requeridos vacíos → Error de validación
- [ ] Email mal formado → Error de validación
- [ ] Números negativos donde no aplica → Error
- [ ] SQL injection intentado → Bloqueado

### 16.4 Permisos por Rol
- [ ] Admin puede hacer todo
- [ ] Staff no puede eliminar otros staff
- [ ] Viewer solo puede ver, no editar

### 16.5 Multi-tenancy
- [ ] Usuario solo ve datos de su tenant
- [ ] No puede acceder a datos de otro tenant manipulando IDs

### 16.6 Páginas de Error
- [ ] /ruta-inexistente → 404 page
- [ ] Error de servidor → 500 page con opción de retry

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 17. PERFORMANCE Y UX

### 17.1 Tiempos de Carga
- [ ] Dashboard carga en < 3 segundos
- [ ] Listas grandes (1000+ items) no bloquean UI
- [ ] Imágenes optimizadas

### 17.2 Responsive Design
- [ ] Mobile (375px): Todo funciona
- [ ] Tablet (768px): Todo funciona
- [ ] Desktop (1920px): Todo funciona
- [ ] Textos legibles en todos los tamaños

### 17.3 Accessibility
- [ ] Navegación con teclado funciona
- [ ] Labels en formularios
- [ ] Contraste de colores adecuado
- [ ] Alt text en imágenes

### 17.4 Offline/Errores de Red
- [ ] Mensaje apropiado cuando no hay conexión
- [ ] Retry automático o manual

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## 18. INTEGRACIONES EXTERNAS

### 18.1 WhatsApp Business API
- [ ] Webhook recibe mensajes
- [ ] Mensajes se guardan en BD
- [ ] Respuesta automática funciona
- [ ] Enviar mensaje funciona

### 18.2 Stripe
- [ ] Checkout funciona
- [ ] Webhook recibe eventos
- [ ] Suscripción se crea/actualiza/cancela

### 18.3 VAPI (Voice)
- [ ] Webhook recibe llamadas
- [ ] Transcripciones se guardan
- [ ] Respuestas de voz funcionan

### 18.4 Email (Resend)
- [ ] Emails de confirmación llegan
- [ ] Emails de recordatorio llegan
- [ ] Formato HTML correcto

**Bugs encontrados:**
```
(Documenta aquí)
```

---

## RESUMEN DE BUGS ENCONTRADOS

| # | Módulo | Descripción | Severidad | Status |
|---|--------|-------------|-----------|--------|
| 1 |        |             |           |        |
| 2 |        |             |           |        |
| 3 |        |             |           |        |

**Severidad**: Crítico (bloquea uso), Alto (funcionalidad rota), Medio (inconveniente), Bajo (cosmético)

---

## NOTAS ADICIONALES

```
(Observaciones generales, sugerencias de mejora, etc.)
```

---

**Fecha de testing**: _______________
**Realizado por**: _______________
**Versión testeada**: _______________
**Ambiente**: [ ] Local [ ] Staging [ ] Producción
