# Análisis Detallado de Componentes - Base de Conocimiento

## 1. AIConfiguration.tsx

### Información General

| Campo | Valor |
|-------|-------|
| **Ruta** | `src/features/settings/components/AIConfiguration.tsx` |
| **Líneas** | ~1,400 |
| **Responsabilidad** | Componente principal de configuración de agentes IA |

### Estructura del Componente

```typescript
export function AIConfiguration() {
  // Estado principal
  const [activeSection, setActiveSection] = useState<'clinic' | 'knowledge' | 'scoring' | 'catalog'>('clinic');

  // Estados de datos
  const [config, setConfig] = useState<AIConfig>({...});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);

  // Estados de modales
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  // ... más estados de modales
}
```

### Tabs del Componente

| Tab | Key | Componente Hijo | Descripción |
|-----|-----|-----------------|-------------|
| Clínica y Sucursales | `clinic` | Inline (BranchCard, StaffCard) | Identidad, sucursales, staff |
| Catálogo de Servicios | `catalog` | `<ServiceCatalogConfig />` | Precios y duración de servicios |
| Instrucciones | `knowledge` | `<KnowledgeBase />` | KB completa |
| Clasificación | `scoring` | `<ServicePriorityConfig />` | HOT/WARM/COLD |

### Terminología Multi-Vertical

```typescript
const verticalTerms = {
  dental: {
    clinicSection: 'Clínica y Sucursales',
    staffTitle: 'Doctores / Especialistas',
    staffPrefix: 'Dr.',
    // ...
  },
  restaurant: {
    clinicSection: 'Restaurante y Sucursales',
    staffTitle: 'Personal de Servicio',
    staffPrefix: '',
    // ...
  },
  // gym, beauty, veterinary, clinic...
};
```

### Puntos de Mejora Identificados

1. **Tabs**: Navegación con border-b simple, sin animación de indicador
2. **Modales de Branch/Staff**: Centrados, no slide-over
3. **Cards de Branch**: Estilo diferente a KnowledgeBase
4. **Label "Instrucciones"**: No describe todo el contenido de KnowledgeBase

---

## 2. KnowledgeBase.tsx

### Información General

| Campo | Valor |
|-------|-------|
| **Ruta** | `src/features/settings/components/KnowledgeBase.tsx` |
| **Líneas** | 1,481 |
| **Responsabilidad** | UI para gestionar las 5 tablas de KB |

### Estructura del Componente

```typescript
export function KnowledgeBase() {
  // Estados de datos
  const [data, setData] = useState<{
    instructions: CustomInstruction[];
    policies: BusinessPolicy[];
    articles: KnowledgeArticle[];
    templates: ResponseTemplate[];
  }>({...});

  // Estados de UI
  const [activeTab, setActiveTab] = useState<'instructions' | 'policies' | 'articles' | 'templates'>('instructions');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<TabType>('instructions');
  const [editingItem, setEditingItem] = useState<any>(null);
}
```

### Tabs Internos

| Tab | Key | Tabla | Campos Principales |
|-----|-----|-------|-------------------|
| Instrucciones | `instructions` | ai_custom_instructions | instruction_type, title, instruction, examples |
| Políticas | `policies` | ai_business_policies | policy_type, title, policy_text, short_version |
| Información | `articles` | ai_knowledge_articles | category, title, content, summary |
| Plantillas | `templates` | ai_response_templates | trigger_type, name, template_text, variables |

### UI Destacada (Buen Patrón)

```typescript
// Tabs con animación - BUEN PATRÓN A REPLICAR
<div className="flex p-1 bg-gray-100 rounded-xl">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        'relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg...',
        activeTab === tab.id ? 'text-white' : 'text-gray-600'
      )}
    >
      {activeTab === tab.id && (
        <motion.div
          layoutId="activeTabBg"
          className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg"
        />
      )}
      <span className="relative z-10">{tab.icon}</span>
      <span className="relative z-10">{tab.label}</span>
    </button>
  ))}
</div>
```

### Modal Slide-Over (Buen Patrón)

```typescript
// Modal slide-over desde la derecha - BUEN PATRÓN
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', damping: 25 }}
  className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50"
>
  {/* Header con gradiente */}
  <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
    ...
  </div>
  {/* Contenido */}
  <div className="p-6">
    ...
  </div>
</motion.div>
```

### Puntos de Mejora Identificados

1. **Tab "Competidores" faltante**: La tabla ai_competitor_handling existe pero no hay UI
2. **Filtro por sucursal**: branch_id existe en tablas pero no se usa en UI
3. **Variables hardcoded**: En plantillas, variables como `{nombre}` están hardcoded
4. **Quick Stats**: No hay visualización rápida del estado del KB

---

## 3. ServiceCatalogConfig.tsx (NO MODIFICAR)

### Información General

| Campo | Valor |
|-------|-------|
| **Ruta** | `src/features/settings/components/ServiceCatalogConfig.tsx` |
| **Líneas** | 558 |
| **Responsabilidad** | Configurar precios y duración de servicios |
| **Estado** | **APROBADO - NO MODIFICAR** |

### Estructura del Componente

```typescript
interface Service {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  price_min: number | null;
  price_max: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  lead_priority: 'hot' | 'warm' | 'cold';
  currency: string;
}

export function ServiceCatalogConfig() {
  const [services, setServices] = useState<Service[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<Service>>>(new Map());
  // Agrupa servicios por categoría
  // Permite edición inline con pending changes
  // Guarda cambios en batch
}
```

### Características UI Aprobadas

- Agrupación por categoría con secciones colapsables
- Edición inline de precios y duración
- Sistema de pending changes con contador
- Botón sticky de guardar cambios
- Feedback visual de cambios no guardados

---

## 4. ServicePriorityConfig.tsx

### Información General

| Campo | Valor |
|-------|-------|
| **Ruta** | `src/features/settings/components/ServicePriorityConfig.tsx` |
| **Líneas** | 434 |
| **Responsabilidad** | Clasificar servicios por prioridad de lead |

### Sistema de Prioridades

```typescript
const priorityConfig = {
  hot: {
    label: 'HOT',
    description: 'Alta prioridad - Servicios de alto valor',
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    icon: icons.fire,
    examples: 'Implantes, Ortodoncia, Rehabilitaciones',
  },
  warm: {
    label: 'WARM',
    description: 'Prioridad media - Servicios moderados',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    icon: icons.sun,
    examples: 'Coronas, Endodoncia, Blanqueamiento',
  },
  cold: {
    label: 'COLD',
    description: 'Prioridad baja - Servicios básicos',
    color: 'bg-blue-400',
    bgColor: 'bg-blue-50',
    icon: icons.snowflake,
    examples: 'Limpieza, Consulta, Radiografías',
  },
};
```

### Selector de Prioridad

```typescript
// Selector visual de prioridad por servicio
<div className="flex items-center gap-1">
  {(['hot', 'warm', 'cold'] as const).map((priority) => (
    <button
      onClick={() => handlePriorityChange(service.id, priority)}
      className={cn(
        'relative p-2 rounded-lg transition-all',
        isSelected ? cn(config.bgColor, config.borderColor, 'border-2') : 'hover:bg-gray-100'
      )}
    >
      {config.icon}
      {isSelected && (
        <motion.div
          layoutId={`priority-indicator-${service.id}`}
          className={cn('absolute -bottom-1 w-1.5 h-1.5 rounded-full', config.color)}
        />
      )}
    </button>
  ))}
</div>
```

### Puntos de Mejora Identificados

1. **Cards de resumen**: Buen diseño, mantener
2. **Animaciones**: Usa motion correctamente
3. **Sticky save button**: Buen patrón, similar a ServiceCatalogConfig

---

## 5. BranchManagement.tsx

### Información General

| Campo | Valor |
|-------|-------|
| **Ruta** | `src/features/settings/components/BranchManagement.tsx` |
| **Líneas** | 903 |
| **Responsabilidad** | CRUD de sucursales con sistema de billing |

### Estructura del Componente

```typescript
interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  operating_hours: OperatingHours;
}

interface SubscriptionInfo {
  plan: string;
  max_branches: number;        // Sucursales contratadas
  current_branches: number;    // Sucursales actuales
  plan_limit: number;          // Límite absoluto del plan
  can_add_branch: boolean;
  can_add_extra: boolean;      // Puede agregar extra con cargo
  next_branch_price: number;
  currency: string;
}
```

### Sistema de Billing de Sucursales

```typescript
// Lógica de límites
const isAtContractedLimit = subscriptionInfo &&
  subscriptionInfo.current_branches >= subscriptionInfo.contracted_branches;

const isAtPlanLimit = subscriptionInfo &&
  subscriptionInfo.current_branches >= subscriptionInfo.plan_limit;

// Flujo:
// 1. Si current < contracted → Agregar gratis
// 2. Si current >= contracted && current < plan_limit → Agregar con cargo extra
// 3. Si current >= plan_limit → Debe subir de plan
```

### Modal de Branch (A MEJORAR)

```typescript
// Modal actual: centrado tradicional
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    {/* Contenido */}
  </div>
</div>

// PROPUESTA: Cambiar a slide-over como KnowledgeBase
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50"
>
  {/* ... */}
</motion.div>
```

### Puntos de Mejora Identificados

1. **Modal**: Cambiar de centrado a slide-over
2. **BranchCard**: Unificar estilo con KnowledgeBase cards
3. **Funcionalidad de billing**: **NO TOCAR** - crítica para facturación

---

## 6. Comparativa de Patrones UI

### Tabs Navigation

| Componente | Estilo Actual | Propuesto |
|------------|---------------|-----------|
| AIConfiguration | Border-b simple | Adoptar estilo KnowledgeBase |
| KnowledgeBase | Pills con motion | **Mantener (buen patrón)** |

### Modales

| Componente | Estilo Actual | Propuesto |
|------------|---------------|-----------|
| AIConfiguration (Branch) | Centrado | Slide-over |
| AIConfiguration (Staff) | Centrado | Slide-over |
| KnowledgeBase | Slide-over | **Mantener (buen patrón)** |

### Cards

| Componente | Estilo Actual | Propuesto |
|------------|---------------|-----------|
| AIConfiguration BranchCard | Custom inline | Unificar con patrón KB |
| KnowledgeBase ItemCard | Rounded-xl con hover | **Mantener (buen patrón)** |
| ServicePriorityConfig | Agrupado por categoría | Mantener |

### Save Buttons

| Componente | Estilo Actual | Propuesto |
|------------|---------------|-----------|
| ServiceCatalogConfig | Sticky bottom con counter | **Mantener (buen patrón)** |
| ServicePriorityConfig | Sticky bottom con counter | **Mantener (buen patrón)** |
| KnowledgeBase | Modal actions | Mantener |

---

## 7. Resumen de Patrones a Adoptar

### Del KnowledgeBase.tsx (Buen Patrón):

1. **Tabs con motion**:
```typescript
<motion.div layoutId="activeTabBg" className="absolute inset-0 bg-gradient-to-r..." />
```

2. **Modal slide-over**:
```typescript
<motion.div initial={{ x: '100%' }} animate={{ x: 0 }} className="fixed inset-y-0 right-0..." />
```

3. **Header con gradiente**:
```typescript
<div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
```

4. **Cards con hover y transición**:
```typescript
<div className="p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-md transition-all">
```

### Del ServiceCatalogConfig.tsx (Buen Patrón):

1. **Sticky save con contador**:
```typescript
<motion.div className="sticky bottom-4 flex justify-center">
  <div className="bg-white rounded-xl shadow-lg p-4">
    <strong>{pendingChanges.size}</strong> cambios pendientes
    <Button onClick={saveChanges}>Guardar</Button>
  </div>
</motion.div>
```

2. **Optimistic updates** (parcial):
```typescript
// Update local state immediately
setServices(prev => prev.map(s => s.id === id ? {...s, ...changes} : s));
// Track pending for batch save
setPendingChanges(prev => new Map(prev).set(id, changes));
```
