# FASE 2: Arquitectura de Información

## Objetivo
Reorganizar la navegación y labels para mayor claridad, agregar Quick Stats y tab de Competidores.

---

## 1. Archivos a Modificar

| Archivo | Cambios | Prioridad |
|---------|---------|-----------|
| `AIConfiguration.tsx` | Renombrar tabs | Alta |
| `KnowledgeBase.tsx` | Agregar tab Competidores, Quick Stats | Alta |

---

## 2. Cambio 1: Renombrar Tabs en AIConfiguration

### Justificación de Cambios

| Tab Actual | Tab Propuesto | Razón |
|------------|---------------|-------|
| "Clínica y Sucursales" | "Mi Negocio" | Universal para todas las verticales |
| "Instrucciones" | "Base de Conocimiento" | Describe mejor el contenido completo |
| "Clasificación" | "Leads y Prioridades" | Más descriptivo del propósito |
| "Catálogo de Servicios" | (sin cambio) | Ya es claro |

### Código
```typescript
// AIConfiguration.tsx - Tabs array
const tabs = [
  { key: 'clinic', label: 'Mi Negocio', icon: icons.clinic },
  { key: 'catalog', label: terms.catalogSection, icon: icons.catalog },  // Mantiene terminología por vertical
  { key: 'knowledge', label: 'Base de Conocimiento', icon: icons.brain },
  { key: 'scoring', label: 'Leads y Prioridades', icon: icons.check },
];
```

---

## 3. Cambio 2: Quick Stats en Header de KnowledgeBase

### Ubicación
`KnowledgeBase.tsx` - Antes del tab navigation

### Diseño Propuesto

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [Brain Icon]  Base de Conocimiento                                         │
│                                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │    12      │ │     5      │ │     8      │ │     3      │ │     2      ││
│  │ Instruc.   │ │ Políticas  │ │ Artículos  │ │ Plantillas │ │ Competid.  ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘│
│                                                                             │
│  Completitud: [██████████████░░░░░░] 72%        ⚠️ 3 secciones por completar│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Código Propuesto

```typescript
// Agregar después de los imports en KnowledgeBase.tsx
interface KBCompleteness {
  completed: number;
  total: number;
  percentage: number;
  missing: { key: string; label: string }[];
}

// Hook para calcular completitud
const kbCompleteness = useMemo((): KBCompleteness => {
  const checks = [
    {
      key: 'identity',
      label: 'Identidad del asistente',
      done: data.instructions.some(i => i.instruction_type === 'identity')
    },
    {
      key: 'greeting',
      label: 'Saludo configurado',
      done: data.templates.some(t => t.trigger_type === 'greeting')
    },
    {
      key: 'farewell',
      label: 'Despedida configurada',
      done: data.templates.some(t => t.trigger_type === 'farewell')
    },
    {
      key: 'cancellation',
      label: 'Política de cancelación',
      done: data.policies.some(p => p.policy_type === 'cancellation')
    },
    {
      key: 'payment',
      label: 'Política de pagos',
      done: data.policies.some(p => p.policy_type === 'payment')
    },
    {
      key: 'articles',
      label: 'Artículos de información',
      done: data.articles.length > 0
    },
    {
      key: 'competitors',
      label: 'Manejo de competencia',
      done: data.competitors?.length > 0
    },
  ];

  const completed = checks.filter(c => c.done).length;
  const total = checks.length;

  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    missing: checks.filter(c => !c.done).map(c => ({ key: c.key, label: c.label }))
  };
}, [data]);

// Componente QuickStats
const QuickStats = () => (
  <div className="mb-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
          {icons.brain}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Base de Conocimiento</h3>
          <p className="text-sm text-gray-500">
            Información que tu asistente usará para responder
          </p>
        </div>
      </div>

      {/* Completeness Badge */}
      <div className={cn(
        'px-3 py-1.5 rounded-full text-sm font-medium',
        kbCompleteness.percentage === 100
          ? 'bg-green-100 text-green-700'
          : kbCompleteness.percentage >= 70
          ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
      )}>
        {kbCompleteness.percentage}% completo
      </div>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-5 gap-3 mb-4">
      {[
        { key: 'instructions', label: 'Instrucciones', count: data.instructions.length, color: 'purple' },
        { key: 'policies', label: 'Políticas', count: data.policies.length, color: 'blue' },
        { key: 'articles', label: 'Artículos', count: data.articles.length, color: 'green' },
        { key: 'templates', label: 'Plantillas', count: data.templates.length, color: 'amber' },
        { key: 'competitors', label: 'Competidores', count: data.competitors?.length || 0, color: 'red' },
      ].map((stat) => (
        <button
          key={stat.key}
          onClick={() => setActiveTab(stat.key as TabType)}
          className={cn(
            'p-3 rounded-xl border transition-all text-center',
            activeTab === stat.key
              ? `bg-${stat.color}-50 border-${stat.color}-200`
              : 'bg-white border-gray-200 hover:border-gray-300'
          )}
        >
          <p className={cn(
            'text-2xl font-bold',
            activeTab === stat.key ? `text-${stat.color}-600` : 'text-gray-900'
          )}>
            {stat.count}
          </p>
          <p className="text-xs text-gray-500 truncate">{stat.label}</p>
        </button>
      ))}
    </div>

    {/* Progress Bar */}
    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${kbCompleteness.percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(
          'h-full rounded-full',
          kbCompleteness.percentage === 100
            ? 'bg-green-500'
            : kbCompleteness.percentage >= 70
            ? 'bg-amber-500'
            : 'bg-red-500'
        )}
      />
    </div>

    {/* Missing Items Hint */}
    {kbCompleteness.missing.length > 0 && kbCompleteness.percentage < 100 && (
      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Falta: {kbCompleteness.missing.slice(0, 3).map(m => m.label).join(', ')}
        {kbCompleteness.missing.length > 3 && ` y ${kbCompleteness.missing.length - 3} más`}
      </p>
    )}
  </div>
);
```

---

## 4. Cambio 3: Agregar Tab de Competidores

### Actualizar Tabs Array

```typescript
// KnowledgeBase.tsx - Actualizar tabs
const tabs = [
  { id: 'instructions', label: 'Instrucciones', icon: icons.list, count: data.instructions.length },
  { id: 'policies', label: 'Políticas', icon: icons.shield, count: data.policies.length },
  { id: 'articles', label: 'Información', icon: icons.book, count: data.articles.length },
  { id: 'templates', label: 'Plantillas', icon: icons.template, count: data.templates.length },
  // NUEVO
  { id: 'competitors', label: 'Competencia', icon: icons.competitors, count: data.competitors?.length || 0 },
];

// Agregar tipo
type TabType = 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors';
```

### Icono de Competidores

```typescript
// Agregar a icons object
const icons = {
  // ... otros iconos
  competitors: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};
```

### Agregar Estado para Competidores

```typescript
// Actualizar interface de data
const [data, setData] = useState<{
  instructions: CustomInstruction[];
  policies: BusinessPolicy[];
  articles: KnowledgeArticle[];
  templates: ResponseTemplate[];
  competitors: CompetitorHandling[];  // NUEVO
}>({
  instructions: [],
  policies: [],
  articles: [],
  templates: [],
  competitors: [],  // NUEVO
});

// Interface para competidores
interface CompetitorHandling {
  id: string;
  tenant_id: string;
  competitor_name: string;
  competitor_aliases?: string[];
  response_strategy: string;
  talking_points?: string[];
  avoid_saying?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### UI para Tab de Competidores

```typescript
{/* Competitors Tab Content */}
{activeTab === 'competitors' && (
  <div className="space-y-4">
    {/* Info Banner */}
    <div className="p-4 bg-red-50 rounded-xl border border-red-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
          {icons.competitors}
        </div>
        <div>
          <h4 className="font-medium text-red-900 mb-1">Manejo de Competencia</h4>
          <p className="text-sm text-red-700">
            Define cómo tu asistente debe responder cuando un cliente mencione a la competencia.
            Incluye puntos diferenciadores y qué evitar decir.
          </p>
        </div>
      </div>
    </div>

    {/* Empty State */}
    {data.competitors.length === 0 ? (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          {icons.competitors}
        </div>
        <h4 className="font-medium text-gray-900 mb-1">
          No hay competidores configurados
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Agrega información sobre tu competencia para que el asistente responda adecuadamente
        </p>
        <Button
          onClick={() => {
            setModalType('competitors');
            setEditingItem(null);
            setShowModal(true);
          }}
        >
          Agregar Competidor
        </Button>
      </div>
    ) : (
      /* Competitors List */
      <div className="space-y-3">
        {data.competitors.map((competitor) => (
          <div
            key={competitor.id}
            className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-red-200 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900">
                    {competitor.competitor_name}
                  </h4>
                  {competitor.competitor_aliases?.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({competitor.competitor_aliases.join(', ')})
                    </span>
                  )}
                </div>

                {/* Strategy */}
                <p className="text-sm text-gray-600 mb-3">
                  <strong className="text-gray-700">Estrategia:</strong>{' '}
                  {competitor.response_strategy}
                </p>

                {/* Talking Points */}
                {competitor.talking_points?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-green-700 mb-1">
                      Puntos a destacar:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {competitor.talking_points.map((point, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avoid Saying */}
                {competitor.avoid_saying?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-700 mb-1">
                      Evitar decir:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {competitor.avoid_saying.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setModalType('competitors');
                    setEditingItem(competitor);
                    setShowModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  {icons.edit}
                </button>
                <button
                  onClick={() => handleDelete('competitors', competitor.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {icons.trash}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

### Modal Form para Competidores

```typescript
{/* Competitor Form Fields (dentro del modal) */}
{modalType === 'competitors' && (
  <div className="space-y-6">
    {/* Competitor Name */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Nombre del Competidor *
      </label>
      <Input
        value={formData.competitor_name || ''}
        onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })}
        placeholder="Ej: Dental Fix, Clínica Sonrisa"
      />
    </div>

    {/* Aliases */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Nombres Alternativos
      </label>
      <Input
        value={formData.competitor_aliases?.join(', ') || ''}
        onChange={(e) => setFormData({
          ...formData,
          competitor_aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
        })}
        placeholder="Ej: DentalFix, Dental-Fix (separados por coma)"
      />
      <p className="text-xs text-gray-500 mt-1">
        Otras formas en que los clientes podrían referirse a este competidor
      </p>
    </div>

    {/* Response Strategy */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Estrategia de Respuesta *
      </label>
      <textarea
        value={formData.response_strategy || ''}
        onChange={(e) => setFormData({ ...formData, response_strategy: e.target.value })}
        placeholder="Ej: Destacar nuestra garantía de 10 años y la experiencia de nuestros especialistas"
        rows={3}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>

    {/* Talking Points */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Puntos Diferenciadores
      </label>
      <textarea
        value={formData.talking_points?.join('\n') || ''}
        onChange={(e) => setFormData({
          ...formData,
          talking_points: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
        })}
        placeholder="Uno por línea:&#10;15 años de experiencia&#10;Garantía de 10 años&#10;Tecnología de punta"
        rows={4}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      <p className="text-xs text-gray-500 mt-1">
        Ventajas de tu negocio que el asistente puede mencionar (una por línea)
      </p>
    </div>

    {/* Avoid Saying */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Evitar Decir
      </label>
      <textarea
        value={formData.avoid_saying?.join('\n') || ''}
        onChange={(e) => setFormData({
          ...formData,
          avoid_saying: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
        })}
        placeholder="Uno por línea:&#10;No mencionar sus precios&#10;No hacer comparaciones directas&#10;No hablar mal de su servicio"
        rows={3}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      <p className="text-xs text-gray-500 mt-1">
        Temas que el asistente debe evitar (una por línea)
      </p>
    </div>
  </div>
)}
```

---

## 5. Actualizar fetchData para incluir Competidores

```typescript
const fetchData = async () => {
  // ... código existente

  // Fetch competitors
  const { data: competitors } = await supabase
    .from('ai_competitor_handling')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('competitor_name');

  setData({
    instructions: instructions || [],
    policies: policies || [],
    articles: articles || [],
    templates: templates || [],
    competitors: competitors || [],  // NUEVO
  });
};
```

---

## 6. Actualizar tableMap en API

```typescript
// /api/knowledge-base/route.ts
const tableMap: Record<string, string> = {
  instructions: 'ai_custom_instructions',
  policies: 'ai_business_policies',
  articles: 'ai_knowledge_articles',
  templates: 'ai_response_templates',
  competitors: 'ai_competitor_handling',  // NUEVO
};
```

---

## 7. Checklist de Implementación

### AIConfiguration.tsx
- [ ] Renombrar tabs según tabla
- [ ] Verificar que no hay hardcoded strings

### KnowledgeBase.tsx
- [ ] Agregar QuickStats component
- [ ] Agregar kbCompleteness hook
- [ ] Agregar tab 'competitors'
- [ ] Agregar estado para competitors
- [ ] Agregar icono competitors
- [ ] Agregar UI de lista de competitors
- [ ] Agregar form fields en modal
- [ ] Actualizar fetchData

### API
- [ ] Agregar 'competitors' a tableMap

### Verificación
- [ ] Quick Stats muestra conteos correctos
- [ ] Barra de progreso se actualiza
- [ ] Tab de competidores funcional
- [ ] CRUD de competidores funciona
- [ ] Responsive correcto

---

## 8. Notas de Diseño

1. **Colores por tab**:
   - Instrucciones: Purple
   - Políticas: Blue
   - Artículos: Green
   - Plantillas: Amber
   - Competidores: Red

2. **Quick Stats**: Clickeables para navegar al tab correspondiente

3. **Progress bar**:
   - Verde: 100%
   - Amber: 70-99%
   - Rojo: <70%
