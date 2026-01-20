# FASE 04: Sistema de Tipos de Asistente

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 04 |
| **Nombre** | Tipos de Asistente |
| **Sprint** | 1 - Fundamentos |
| **Duracion Estimada** | 1 dia |
| **Dependencias** | Fase 01 (Base de Datos) |
| **Documento Referencia** | `07-TIPOS-ASISTENTE.md` |

---

## Objetivo

Implementar el sistema de tipos de asistente predefinidos que permite a los clientes seleccionar entre diferentes niveles de funcionalidad (basico, estandar, completo) para cada vertical (restaurante, dental).

---

## Microfases

### MICROFASE 4.1: Crear Estructura de Archivos

**Archivos a crear:**
```
lib/voice-agent/
├── types/
│   ├── index.ts
│   ├── assistant-types.ts
│   ├── assistant-type-manager.ts
│   ├── capability-definitions.ts
│   └── types.ts
```

**Que hacer:**
1. Crear carpeta `lib/voice-agent/types/`
2. Crear archivo `types.ts` con interfaces principales
3. Crear archivo `index.ts` con exports

**Verificacion:**
- [ ] Estructura creada
- [ ] Types basicos definidos
- [ ] Exports funcionan

---

### MICROFASE 4.2: Definir Interfaces de Tipos

**Archivo:** `lib/voice-agent/types/types.ts`

**Que hacer:**
1. Definir interfaces principales:
   ```typescript
   interface AssistantType {
     id: string;
     name: string;
     displayName: string;
     description: string;
     vertical: 'restaurant' | 'dental';
     enabledCapabilities: Capability[];
     availableTools: string[];
     defaultVoiceId: string;
     defaultPersonality: PersonalityType;
     promptTemplateName: string;
     templateVersion: string;
     maxCallDurationSeconds: number;
     isActive: boolean;
   }

   type Capability =
     | 'reservations' | 'orders' | 'menu_info' | 'promotions'
     | 'appointments' | 'services_info' | 'doctor_info' | 'insurance_info'
     | 'business_hours' | 'human_transfer' | 'faq';

   type PersonalityType = 'professional' | 'friendly' | 'energetic' | 'calm';
   ```

2. Definir interface para configuracion de asistente

**Verificacion:**
- [ ] Todas las interfaces definidas
- [ ] Capabilities cubren ambos verticales
- [ ] Types exportados correctamente

---

### MICROFASE 4.3: Definir Capacidades por Tipo

**Archivo:** `lib/voice-agent/types/capability-definitions.ts`

**Que hacer:**
1. Definir capacidades para Restaurant:
   ```typescript
   const RESTAURANT_CAPABILITIES = {
     rest_basic: ['reservations', 'business_hours'],
     rest_standard: ['reservations', 'orders', 'menu_info', 'business_hours'],
     rest_complete: ['reservations', 'orders', 'menu_info', 'promotions',
                     'business_hours', 'human_transfer', 'faq']
   };
   ```

2. Definir capacidades para Dental:
   ```typescript
   const DENTAL_CAPABILITIES = {
     dental_basic: ['appointments', 'business_hours'],
     dental_standard: ['appointments', 'services_info', 'doctor_info', 'business_hours', 'faq'],
     dental_complete: ['appointments', 'services_info', 'doctor_info',
                       'insurance_info', 'business_hours', 'human_transfer', 'faq']
   };
   ```

3. Definir tools disponibles por capacidad

**Verificacion:**
- [ ] 3 niveles para restaurant
- [ ] 3 niveles para dental
- [ ] Tools mapeados a capacidades

---

### MICROFASE 4.4: Definir Tipos de Asistente Completos

**Archivo:** `lib/voice-agent/types/assistant-types.ts`

**Que hacer:**
1. Definir los 6 tipos completos:

**Restaurant:**
```typescript
const REST_BASIC: AssistantType = {
  id: 'rest_basic',
  name: 'rest_basic',
  displayName: 'Reservaciones',
  description: 'Solo manejo de reservaciones',
  vertical: 'restaurant',
  enabledCapabilities: ['reservations', 'business_hours'],
  availableTools: ['check_availability', 'create_reservation',
                   'modify_reservation', 'cancel_reservation', 'get_business_hours'],
  defaultVoiceId: 'elevenlabs-maria',
  defaultPersonality: 'friendly',
  promptTemplateName: 'rest_basic_v1',
  templateVersion: '1',
  maxCallDurationSeconds: 300,
  isActive: true
};
```

2. Repetir para rest_standard, rest_complete
3. Repetir para dental_basic, dental_standard, dental_complete

**Verificacion:**
- [ ] 6 tipos definidos completamente
- [ ] Tools correctos por tipo
- [ ] Templates correctos por tipo

---

### MICROFASE 4.5: Implementar AssistantTypeManager

**Archivo:** `lib/voice-agent/types/assistant-type-manager.ts`

**Que hacer:**
1. Crear clase `AssistantTypeManager`:
   ```typescript
   class AssistantTypeManager {
     // Obtener todos los tipos disponibles
     getAvailableTypes(vertical?: string): AssistantType[]

     // Obtener tipo por ID
     getTypeById(typeId: string): AssistantType | null

     // Obtener capacidades de un tipo
     getCapabilitiesForType(typeId: string): Capability[]

     // Obtener tools de un tipo
     getToolsForType(typeId: string): string[]

     // Validar si un tipo soporta una capacidad
     typeSupportsCapability(typeId: string, capability: Capability): boolean

     // Obtener tipo recomendado
     getRecommendedType(vertical: string): AssistantType
   }
   ```

2. Implementar cache de tipos (cargar de DB una vez)

**Verificacion:**
- [ ] Todos los metodos implementados
- [ ] Cache funciona
- [ ] Retorna datos correctos

---

### MICROFASE 4.6: Integrar con Supabase

**Archivo:** `lib/voice-agent/types/assistant-type-manager.ts` (continuacion)

**Que hacer:**
1. Cargar tipos desde `voice_assistant_types` table
2. Implementar metodo `loadTypes()`:
   ```typescript
   private async loadTypes(): Promise<void> {
     const { data } = await supabase
       .from('voice_assistant_types')
       .select('*')
       .eq('is_active', true);

     this.types = data || [];
   }
   ```

3. Implementar refresh periodico (cada 5 minutos)

**Verificacion:**
- [ ] Carga de Supabase funciona
- [ ] Fallback a tipos hardcoded si falla
- [ ] Refresh funciona

---

### MICROFASE 4.7: Crear Validadores de Tipo

**Archivo:** `lib/voice-agent/types/assistant-type-manager.ts` (continuacion)

**Que hacer:**
1. Implementar validacion de configuracion:
   ```typescript
   validateTypeConfig(config: Partial<AssistantConfig>): ValidationResult {
     // Verificar que tipo existe
     // Verificar que capabilities son validas para el tipo
     // Verificar que tools son validos para el tipo
     // Verificar que voice existe
   }
   ```

2. Retornar errores descriptivos

**Verificacion:**
- [ ] Valida tipo existe
- [ ] Valida capabilities
- [ ] Valida tools
- [ ] Errores descriptivos

---

### MICROFASE 4.8: Crear Helpers de UI

**Archivo:** `lib/voice-agent/types/assistant-type-manager.ts` (continuacion)

**Que hacer:**
1. Metodos para UI:
   ```typescript
   // Para mostrar en selector
   getTypesForDisplay(vertical: string): {
     id: string;
     name: string;
     description: string;
     features: string[];
     recommended: boolean;
   }[]

   // Comparar tipos
   compareTypes(typeA: string, typeB: string): {
     addedCapabilities: Capability[];
     addedTools: string[];
   }
   ```

**Verificacion:**
- [ ] Formato para UI correcto
- [ ] Comparacion funciona
- [ ] Recomendado marcado

---

### MICROFASE 4.9: Tests de Tipos de Asistente

**Archivo:** `__tests__/voice-agent/types/assistant-type-manager.test.ts`

**Que hacer:**
1. Tests de getAvailableTypes:
   - Retorna todos los tipos
   - Filtra por vertical

2. Tests de getTypeById:
   - Encuentra tipo existente
   - Retorna null para inexistente

3. Tests de capabilities:
   - Retorna capabilities correctas
   - typeSupportsCapability funciona

4. Tests de validacion:
   - Config valida pasa
   - Config invalida falla con error descriptivo

**Verificacion:**
- [ ] Coverage > 90%
- [ ] Todos los metodos testeados
- [ ] Edge cases cubiertos

---

### MICROFASE 4.10: Verificacion Final

**Que hacer:**
1. Verificar que los 6 tipos estan correctos
2. Verificar integracion con Supabase
3. Verificar que validaciones funcionan
4. Documentar como agregar nuevos tipos

**Verificacion:**
- [ ] 6 tipos funcionando
- [ ] Manager completo
- [ ] Tests pasan
- [ ] Documentado

---

## Archivos a Crear

```
lib/voice-agent/types/
├── index.ts                    # Exports
├── types.ts                    # Interfaces
├── assistant-types.ts          # Definiciones de tipos
├── capability-definitions.ts   # Capabilities y tools
└── assistant-type-manager.ts   # Manager principal

__tests__/voice-agent/types/
└── assistant-type-manager.test.ts
```

---

## Los 6 Tipos de Asistente

| ID | Vertical | Nivel | Capabilities |
|----|----------|-------|--------------|
| rest_basic | Restaurant | Basico | reservations, business_hours |
| rest_standard | Restaurant | Estandar | + orders, menu_info |
| rest_complete | Restaurant | Completo | + promotions, human_transfer, faq |
| dental_basic | Dental | Basico | appointments, business_hours |
| dental_standard | Dental | Estandar | + services_info, doctor_info, faq |
| dental_complete | Dental | Completo | + insurance_info, human_transfer |

---

## Criterios de Exito

- [ ] 6 tipos definidos y funcionales
- [ ] AssistantTypeManager completo
- [ ] Integracion con Supabase
- [ ] Validaciones funcionando
- [ ] Tests con coverage > 90%
- [ ] Documentado como extender

---

## Notas Importantes

1. **Tipos inmutables** - Los tipos base no deben cambiar frecuentemente
2. **Extensible** - Facil agregar nuevos verticales en el futuro
3. **Cache** - Cargar tipos una vez, no en cada request
4. **Validacion estricta** - No permitir configs invalidas
