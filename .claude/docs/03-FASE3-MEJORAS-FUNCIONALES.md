# FASE 3: Mejoras Funcionales

## Objetivo
Implementar filtro por sucursal, variables dinámicas en plantillas, y otras mejoras funcionales.

---

## 1. Archivos a Modificar

| Archivo | Cambios | Prioridad |
|---------|---------|-----------|
| `KnowledgeBase.tsx` | Filtro por sucursal, variables dinámicas | Alta |
| `/api/knowledge-base/route.ts` | Soporte para branch_id filter | Alta |

---

## 2. Cambio 1: Filtro por Sucursal en Knowledge Base

### Contexto
Las tablas de KB ya tienen columna `branch_id` pero la UI no permite filtrar.

**Caso de uso**: Clínica con 3 sucursales donde:
- Sucursal Polanco tiene estacionamiento gratuito
- Sucursal Roma tiene estacionamiento con costo
- Sucursal Santa Fe tiene validación de estacionamiento

### Diseño de UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Brain Icon] Base de Conocimiento                                          │
│                                                                             │
│  Filtrar por: [Todas las sucursales ▾]  [Polanco] [Roma] [Santa Fe]        │
│                                                                             │
│  ℹ️ Los items sin sucursal aplican a todo el negocio                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Estado y Hook

```typescript
// KnowledgeBase.tsx

// Estado para sucursal seleccionada
const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

// Hook para obtener sucursales
const { branches } = useTenant();

// Filtrar datos por sucursal
const filteredData = useMemo(() => {
  if (!selectedBranchId) {
    return data; // Mostrar todos
  }

  return {
    instructions: data.instructions.filter(
      i => !i.branch_id || i.branch_id === selectedBranchId
    ),
    policies: data.policies.filter(
      p => !p.branch_id || p.branch_id === selectedBranchId
    ),
    articles: data.articles.filter(
      a => !a.branch_id || a.branch_id === selectedBranchId
    ),
    templates: data.templates.filter(
      t => !t.branch_id || t.branch_id === selectedBranchId
    ),
    competitors: data.competitors, // Competidores son globales
  };
}, [data, selectedBranchId]);
```

### Componente BranchFilter

```typescript
// Componente de filtro de sucursales
const BranchFilter = () => {
  if (!branches || branches.length <= 1) {
    return null; // No mostrar si solo hay una sucursal
  }

  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600 font-medium">Filtrar por:</span>

        {/* All branches button */}
        <button
          onClick={() => setSelectedBranchId(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            selectedBranchId === null
              ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-200'
          )}
        >
          Todas
        </button>

        {/* Individual branch buttons */}
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => setSelectedBranchId(branch.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              selectedBranchId === branch.id
                ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-200'
            )}
          >
            {branch.name}
            {branch.is_headquarters && (
              <span className="ml-1 text-xs text-purple-400">(Matriz)</span>
            )}
          </button>
        ))}
      </div>

      {/* Info hint */}
      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Los items sin sucursal asignada aplican a todo el negocio
      </p>
    </div>
  );
};
```

### Mostrar Badge de Sucursal en Items

```typescript
// En cada ItemCard, mostrar badge si tiene branch_id
{item.branch_id && (
  <Badge
    variant="outline"
    size="sm"
    className="bg-blue-50 text-blue-600 border-blue-200"
  >
    {branches.find(b => b.id === item.branch_id)?.name || 'Sucursal'}
  </Badge>
)}

// En el ItemCard completo:
<div className="group p-5 bg-white rounded-xl border ...">
  <div className="flex items-start justify-between">
    <div>
      <div className="flex items-center gap-2 mb-1">
        {/* Type Badge */}
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', typeBadge.color)}>
          {typeBadge.label}
        </span>

        {/* Branch Badge - NUEVO */}
        {item.branch_id && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            📍 {branches.find(b => b.id === item.branch_id)?.name}
          </span>
        )}
      </div>

      <h4 className="font-medium text-gray-900">{item.title}</h4>
      {/* ... resto del card */}
    </div>
  </div>
</div>
```

### Selector de Sucursal en Modal de Creación/Edición

```typescript
{/* Branch Selector - En el modal form */}
{branches && branches.length > 1 && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Aplica a
    </label>
    <select
      value={formData.branch_id || ''}
      onChange={(e) => setFormData({
        ...formData,
        branch_id: e.target.value || null
      })}
      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
    >
      <option value="">Todas las sucursales (global)</option>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name} {branch.is_headquarters ? '(Matriz)' : ''}
        </option>
      ))}
    </select>
    <p className="text-xs text-gray-500 mt-1">
      Selecciona una sucursal si esta {getTypeLabel(modalType).toLowerCase()} aplica solo a una ubicación específica
    </p>
  </div>
)}
```

---

## 3. Cambio 2: Variables Dinámicas en Plantillas

### Contexto Actual
Las variables están hardcoded:

```typescript
// Actual
{['{nombre}', '{servicio}', '{fecha}', '{hora}', '{sucursal}'].map(...)}
```

### Propuesta
Cargar variables dinámicamente según el contexto del tenant.

### Variables Disponibles

```typescript
// Definición de variables disponibles
const AVAILABLE_VARIABLES = [
  // Variables de cliente
  { key: '{nombre}', description: 'Nombre del cliente', category: 'Cliente' },
  { key: '{telefono}', description: 'Teléfono del cliente', category: 'Cliente' },

  // Variables de cita
  { key: '{fecha}', description: 'Fecha de la cita', category: 'Cita' },
  { key: '{hora}', description: 'Hora de la cita', category: 'Cita' },
  { key: '{servicio}', description: 'Nombre del servicio', category: 'Cita' },
  { key: '{precio}', description: 'Precio del servicio', category: 'Cita' },
  { key: '{duracion}', description: 'Duración estimada', category: 'Cita' },

  // Variables de negocio
  { key: '{negocio}', description: 'Nombre del negocio', category: 'Negocio' },
  { key: '{sucursal}', description: 'Nombre de la sucursal', category: 'Negocio' },
  { key: '{direccion}', description: 'Dirección de la sucursal', category: 'Negocio' },
  { key: '{telefono_negocio}', description: 'Teléfono del negocio', category: 'Negocio' },
  { key: '{whatsapp}', description: 'WhatsApp del negocio', category: 'Negocio' },

  // Variables de staff (según vertical)
  { key: '{doctor}', description: 'Nombre del especialista', category: 'Staff' },
  { key: '{especialidad}', description: 'Especialidad del doctor', category: 'Staff' },

  // Variables de tiempo
  { key: '{hora_actual}', description: 'Hora actual', category: 'Tiempo' },
  { key: '{dia_semana}', description: 'Día de la semana', category: 'Tiempo' },
  { key: '{saludo_tiempo}', description: 'Buenos días/tardes/noches', category: 'Tiempo' },
];

// Agrupar por categoría
const VARIABLES_BY_CATEGORY = AVAILABLE_VARIABLES.reduce((acc, variable) => {
  if (!acc[variable.category]) {
    acc[variable.category] = [];
  }
  acc[variable.category].push(variable);
  return acc;
}, {} as Record<string, typeof AVAILABLE_VARIABLES>);
```

### Componente VariableSelector Mejorado

```typescript
// Componente de selección de variables
const VariableSelector = ({
  onInsert,
  currentValue
}: {
  onInsert: (variable: string) => void;
  currentValue: string;
}) => {
  const [showSelector, setShowSelector] = useState(false);

  // Detectar variables ya usadas
  const usedVariables = AVAILABLE_VARIABLES
    .filter(v => currentValue.includes(v.key))
    .map(v => v.key);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowSelector(!showSelector)}
        className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Insertar variable
      </button>

      {showSelector && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Variables disponibles</p>
            <p className="text-xs text-gray-500">Click para insertar en la plantilla</p>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {Object.entries(VARIABLES_BY_CATEGORY).map(([category, variables]) => (
              <div key={category} className="mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">
                  {category}
                </p>
                <div className="space-y-1">
                  {variables.map((variable) => {
                    const isUsed = usedVariables.includes(variable.key);
                    return (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => {
                          onInsert(variable.key);
                          setShowSelector(false);
                        }}
                        disabled={isUsed}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                          isUsed
                            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'hover:bg-purple-50 text-gray-700'
                        )}
                      >
                        <div>
                          <code className={cn(
                            'text-sm font-mono',
                            isUsed ? 'text-gray-400' : 'text-purple-600'
                          )}>
                            {variable.key}
                          </code>
                          <p className="text-xs text-gray-500">{variable.description}</p>
                        </div>
                        {isUsed && (
                          <span className="text-xs text-green-600">✓ Usado</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### Uso en Form de Plantillas

```typescript
{/* Template Text Field - Con Variable Selector */}
<div>
  <div className="flex items-center justify-between mb-1">
    <label className="block text-sm font-medium text-gray-700">
      Texto de la Plantilla *
    </label>
    <VariableSelector
      onInsert={(variable) => {
        // Insertar variable en la posición del cursor o al final
        const textarea = document.getElementById('template-text') as HTMLTextAreaElement;
        const start = textarea?.selectionStart || formData.template_text?.length || 0;
        const before = (formData.template_text || '').substring(0, start);
        const after = (formData.template_text || '').substring(start);

        setFormData({
          ...formData,
          template_text: before + variable + after
        });
      }}
      currentValue={formData.template_text || ''}
    />
  </div>

  <textarea
    id="template-text"
    value={formData.template_text || ''}
    onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
    placeholder="Ej: ¡Hola {nombre}! Te confirmamos tu cita para {servicio} el {fecha} a las {hora}."
    rows={4}
    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
  />

  {/* Preview de variables detectadas */}
  {formData.template_text && (
    <div className="mt-2 flex flex-wrap gap-1">
      {AVAILABLE_VARIABLES
        .filter(v => formData.template_text?.includes(v.key))
        .map(v => (
          <span
            key={v.key}
            className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full"
          >
            {v.key}
          </span>
        ))
      }
    </div>
  )}
</div>
```

---

## 4. Cambio 3: Guardar variables_available Automáticamente

```typescript
// En handleSave, detectar y guardar variables usadas
const handleSave = async () => {
  let dataToSave = { ...formData };

  // Si es plantilla, detectar variables usadas
  if (modalType === 'templates' && formData.template_text) {
    const detectedVariables = AVAILABLE_VARIABLES
      .filter(v => formData.template_text.includes(v.key))
      .map(v => v.key);

    dataToSave.variables_available = detectedVariables;
  }

  // ... resto del save
};
```

---

## 5. Actualizar API para Soportar branch_id Filter

```typescript
// /api/knowledge-base/route.ts - GET
export async function GET(request: NextRequest) {
  // ... auth code

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'instructions';
  const branchId = searchParams.get('branch_id'); // NUEVO

  const tableName = tableMap[type];

  let query = supabase
    .from(tableName)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // Filtrar por sucursal si se especifica
  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  // ... resto
}
```

---

## 6. Checklist de Implementación

### KnowledgeBase.tsx
- [ ] Agregar estado `selectedBranchId`
- [ ] Importar `useTenant` hook
- [ ] Crear hook `filteredData` con useMemo
- [ ] Crear componente `BranchFilter`
- [ ] Agregar badge de sucursal en ItemCards
- [ ] Agregar selector de sucursal en modal form
- [ ] Crear `AVAILABLE_VARIABLES` constante
- [ ] Crear componente `VariableSelector`
- [ ] Integrar VariableSelector en form de plantillas
- [ ] Auto-detectar variables en handleSave

### API
- [ ] Agregar soporte para `branch_id` query param
- [ ] Actualizar queries para filtrar por sucursal

### Verificación
- [ ] Filtro de sucursales funciona
- [ ] Items se filtran correctamente
- [ ] Badge de sucursal visible
- [ ] Selector de sucursal en modal funciona
- [ ] Variables se insertan correctamente
- [ ] Variables se detectan automáticamente
- [ ] Preview de variables funciona

---

## 7. Notas Importantes

1. **branch_id = null** significa "aplica a todas las sucursales"
2. **Filtro incluye items globales** cuando se selecciona una sucursal específica
3. **Competidores son siempre globales** - no tienen branch_id
4. **Variables son sugerencias** - el usuario puede escribir custom variables
