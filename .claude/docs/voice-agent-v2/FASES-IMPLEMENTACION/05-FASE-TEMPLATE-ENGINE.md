# FASE 05: Motor de Templates y Prompts

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 05 |
| **Nombre** | Template Engine |
| **Sprint** | 1 - Fundamentos |
| **Duracion Estimada** | 1-2 dias |
| **Dependencias** | Fase 04 (Tipos de Asistente) |
| **Documento Referencia** | `09-PROMPTS-TEMPLATES.md` |

---

## Objetivo

Implementar el motor de templates basado en Handlebars que genera prompts dinamicos para cada tipo de asistente, incluyendo soporte para personalidades, internacionalizacion y contexto dinamico del negocio.

---

## Microfases

### MICROFASE 5.1: Crear Estructura de Archivos

**Archivos a crear:**
```
lib/voice-agent/
├── prompts/
│   ├── index.ts
│   ├── template-engine.ts
│   ├── context-injector.ts
│   ├── i18n-formatter.ts
│   └── types.ts

templates/
├── base/
│   └── common-helpers.hbs
├── restaurant/
│   ├── rest_basic_v1.hbs
│   ├── rest_standard_v1.hbs
│   └── rest_complete_v1.hbs
├── dental/
│   ├── dental_basic_v1.hbs
│   ├── dental_standard_v1.hbs
│   └── dental_complete_v1.hbs
├── personalities/
│   ├── professional.hbs
│   ├── friendly.hbs
│   ├── energetic.hbs
│   └── calm.hbs
└── i18n/
    ├── es-MX.json
    └── en-US.json
```

**Que hacer:**
1. Crear estructura de carpetas
2. Instalar dependencia: `npm install handlebars`
3. Crear archivo de types

**Verificacion:**
- [ ] Estructura creada
- [ ] Handlebars instalado
- [ ] Types definidos

---

### MICROFASE 5.2: Configurar Handlebars y Helpers

**Archivo:** `lib/voice-agent/prompts/template-engine.ts`

**Que hacer:**
1. Importar y configurar Handlebars
2. Registrar helpers personalizados:
   ```typescript
   // formatSchedule - Formatea horarios para voz
   Handlebars.registerHelper('formatSchedule', (schedule) => {...});

   // listItems - Lista items naturalmente (a, b y c)
   Handlebars.registerHelper('listItems', (items) => {...});

   // formatPrice - Formatea precios para voz
   Handlebars.registerHelper('formatPrice', (price, currency) => {...});

   // ifCapability - Condicional por capacidad
   Handlebars.registerHelper('ifCapability', function(cap, options) {...});

   // relativeTime - Tiempo relativo (en 2 horas)
   Handlebars.registerHelper('relativeTime', (date) => {...});
   ```

**Verificacion:**
- [ ] Handlebars configurado
- [ ] 5+ helpers registrados
- [ ] Helpers funcionan correctamente

---

### MICROFASE 5.3: Implementar Carga de Templates

**Archivo:** `lib/voice-agent/prompts/template-engine.ts` (continuacion)

**Que hacer:**
1. Crear metodo para cargar templates:
   ```typescript
   private async loadTemplates(): Promise<void> {
     const templatePaths = await glob('templates/**/*.hbs');
     for (const path of templatePaths) {
       const name = extractTemplateName(path);
       const content = await fs.readFile(path, 'utf-8');
       this.templates.set(name, Handlebars.compile(content));
     }
   }
   ```

2. Implementar cache de templates compilados
3. Manejar templates no encontrados

**Verificacion:**
- [ ] Templates se cargan correctamente
- [ ] Cache funciona
- [ ] Error handling para templates faltantes

---

### MICROFASE 5.4: Crear Template Base Restaurant Basico

**Archivo:** `templates/restaurant/rest_basic_v1.hbs`

**Que hacer:**
1. Crear template con secciones:
   - IDENTIDAD - Quien es el asistente
   - CAPACIDADES - Que puede hacer
   - RESTRICCIONES - Que NO puede hacer
   - INFORMACION - Datos del negocio
   - POLITICAS - Reglas de reservacion
   - FLUJOS - Como manejar conversaciones
   - ESTILO - Tono de comunicacion

2. Usar helpers para formatear datos
3. Incluir partial de personalidad

**Verificacion:**
- [ ] Template completo y estructurado
- [ ] Helpers usados correctamente
- [ ] Renderiza sin errores

---

### MICROFASE 5.5: Crear Templates Restaurant Estandar y Completo

**Archivos:**
- `templates/restaurant/rest_standard_v1.hbs`
- `templates/restaurant/rest_complete_v1.hbs`

**Que hacer:**
1. rest_standard_v1:
   - Todo de basico
   - Agregar seccion de MENU
   - Agregar flujo de PEDIDOS
   - Agregar tecnicas de venta sugerida

2. rest_complete_v1:
   - Todo de estandar
   - Agregar FAQ
   - Agregar PROMOCIONES
   - Agregar manejo de TRANSFERENCIA
   - Agregar escenarios especiales

**Verificacion:**
- [ ] Templates completos
- [ ] Incrementales (cada uno agrega al anterior)
- [ ] Renderizan correctamente

---

### MICROFASE 5.6: Crear Templates Dental

**Archivos:**
- `templates/dental/dental_basic_v1.hbs`
- `templates/dental/dental_standard_v1.hbs`
- `templates/dental/dental_complete_v1.hbs`

**Que hacer:**
1. dental_basic_v1:
   - Identidad de clinica dental
   - Solo manejo de citas
   - Informacion de doctores basica

2. dental_standard_v1:
   - Agregar informacion de servicios
   - Agregar FAQ dental
   - Agregar info de doctores completa

3. dental_complete_v1:
   - Agregar seguros
   - Agregar transferencia
   - Agregar manejo de urgencias

**Verificacion:**
- [ ] 3 templates dentales creados
- [ ] Terminologia dental correcta
- [ ] Renderizan correctamente

---

### MICROFASE 5.7: Crear Templates de Personalidad

**Archivos:**
- `templates/personalities/professional.hbs`
- `templates/personalities/friendly.hbs`
- `templates/personalities/energetic.hbs`
- `templates/personalities/calm.hbs`

**Que hacer:**
1. Cada personalidad define:
   - Nivel de formalidad (tu/usted)
   - Tipo de expresiones
   - Ritmo de habla
   - Ejemplos de frases

2. professional.hbs:
   - Usa "usted"
   - Formal y eficiente
   - Sin coloquialismos

3. friendly.hbs:
   - Usa "tu"
   - Calido y cercano
   - Expresiones amigables

4. energetic.hbs y calm.hbs similares

**Verificacion:**
- [ ] 4 personalidades definidas
- [ ] Diferencias claras entre ellas
- [ ] Integrables con templates principales

---

### MICROFASE 5.8: Crear Archivos de Internacionalizacion

**Archivos:**
- `templates/i18n/es-MX.json`
- `templates/i18n/en-US.json`

**Que hacer:**
1. Definir traducciones para:
   - Saludos (manana, tarde, noche)
   - Dias de la semana
   - Meses
   - Expresiones de tiempo
   - Frases comunes
   - Terminos de dominio (reservacion, cita, etc)

2. Crear formateador i18n:
   ```typescript
   class VoiceI18nFormatter {
     getGreeting(): string
     formatDateForVoice(date: Date): string
     formatTimeForVoice(time: string): string
     formatPriceForVoice(amount: number): string
   }
   ```

**Verificacion:**
- [ ] es-MX completo
- [ ] en-US completo
- [ ] Formatter funciona

---

### MICROFASE 5.9: Implementar Context Injector

**Archivo:** `lib/voice-agent/prompts/context-injector.ts`

**Que hacer:**
1. Crear clase `DynamicContextInjector`:
   ```typescript
   class DynamicContextInjector {
     async getDynamicContext(businessId: string): Promise<DynamicContext> {
       // Obtener:
       // - Horario de hoy (con excepciones)
       // - Promociones activas
       // - Items agotados
       // - Anuncios especiales
       // - Tiempo de espera actual
     }
   }
   ```

2. Generar bloque de contexto para inyectar en prompt

**Verificacion:**
- [ ] Obtiene contexto dinamico
- [ ] Genera bloque formateado
- [ ] Maneja casos sin datos

---

### MICROFASE 5.10: Implementar Metodo Principal de Renderizado

**Archivo:** `lib/voice-agent/prompts/template-engine.ts` (final)

**Que hacer:**
1. Implementar metodo principal:
   ```typescript
   async renderPrompt(
     config: VoiceAssistantConfig,
     context: BusinessContext,
     options?: RenderOptions
   ): Promise<RenderedPrompt> {
     // 1. Obtener template correcto
     // 2. Obtener contexto dinamico
     // 3. Cargar i18n
     // 4. Cargar personalidad
     // 5. Renderizar template
     // 6. Validar resultado
     // 7. Retornar prompt completo
   }
   ```

2. Implementar validacion de prompt:
   - Longitud < 8000 chars
   - Secciones requeridas presentes
   - Sin placeholders sin resolver

**Verificacion:**
- [ ] Renderizado funciona
- [ ] Validacion funciona
- [ ] Retorna prompt completo

---

### MICROFASE 5.11: Tests de Template Engine

**Archivo:** `__tests__/voice-agent/prompts/template-engine.test.ts`

**Que hacer:**
1. Tests de helpers:
   - formatSchedule
   - listItems
   - formatPrice

2. Tests de carga de templates:
   - Carga correctamente
   - Cache funciona

3. Tests de renderizado:
   - Cada tipo de template
   - Con diferentes contextos
   - Con diferentes personalidades

4. Tests de validacion:
   - Prompt valido pasa
   - Prompt muy largo falla
   - Placeholder sin resolver falla

**Verificacion:**
- [ ] Coverage > 85%
- [ ] Todos los templates testeados
- [ ] Helpers testeados

---

### MICROFASE 5.12: Verificacion Final

**Que hacer:**
1. Renderizar todos los templates con datos de prueba
2. Verificar que prompts son apropiados para voz
3. Verificar longitudes
4. Documentar como crear nuevos templates

**Verificacion:**
- [ ] 6 templates funcionando
- [ ] 4 personalidades funcionando
- [ ] i18n funciona
- [ ] Context injection funciona
- [ ] Documentado

---

## Archivos a Crear

```
lib/voice-agent/prompts/
├── index.ts
├── template-engine.ts
├── context-injector.ts
├── i18n-formatter.ts
└── types.ts

templates/
├── restaurant/
│   ├── rest_basic_v1.hbs
│   ├── rest_standard_v1.hbs
│   └── rest_complete_v1.hbs
├── dental/
│   ├── dental_basic_v1.hbs
│   ├── dental_standard_v1.hbs
│   └── dental_complete_v1.hbs
├── personalities/
│   ├── professional.hbs
│   ├── friendly.hbs
│   ├── energetic.hbs
│   └── calm.hbs
└── i18n/
    ├── es-MX.json
    └── en-US.json

__tests__/voice-agent/prompts/
└── template-engine.test.ts
```

---

## Criterios de Exito

- [ ] 6 templates de asistente creados
- [ ] 4 personalidades creadas
- [ ] i18n en espanol e ingles
- [ ] Context injection dinamico
- [ ] Validacion de prompts
- [ ] Tests con coverage > 85%

---

## Notas Importantes

1. **Prompts para VOZ** - Frases cortas, naturales, sin jerga
2. **Limite de 8000 chars** - VAPI tiene limite de prompt
3. **Personalidad consistente** - No mezclar formalidades
4. **Contexto dinamico** - Promociones, horarios especiales
