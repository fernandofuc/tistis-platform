# FASE 1: Mejoras Visuales

## Objetivo
Unificar cards, modales y tabs al estándar Apple/TIS TIS adoptando los mejores patrones existentes.

---

## 1. Archivos a Modificar

| Archivo | Cambios | Prioridad |
|---------|---------|-----------|
| `AIConfiguration.tsx` | Tabs, modales de Branch/Staff | Alta |
| `BranchManagement.tsx` | Modal slide-over (si se usa separado) | Media |
| Componentes inline en AIConfiguration | BranchCard, StaffCard | Alta |

---

## 2. Cambio 1: Unificar Tabs Navigation

### Ubicación
`AIConfiguration.tsx` líneas 856-879

### Código Actual
```typescript
{/* Tab Navigation */}
<div className="flex border-b border-gray-100 overflow-x-auto">
  {[
    { key: 'clinic', label: terms.clinicSection, icon: icons.clinic },
    { key: 'catalog', label: terms.catalogSection, icon: icons.catalog },
    { key: 'knowledge', label: 'Instrucciones', icon: icons.brain },
    { key: 'scoring', label: 'Clasificación', icon: icons.check },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveSection(tab.key as typeof activeSection)}
      className={cn(
        'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
        activeSection === tab.key
          ? 'border-purple-600 text-purple-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      )}
    >
      <span className={cn(activeSection === tab.key ? 'text-purple-600' : 'text-gray-400')}>
        {tab.icon}
      </span>
      {tab.label}
    </button>
  ))}
</div>
```

### Código Propuesto (Adoptar patrón KnowledgeBase)
```typescript
import { motion } from 'framer-motion';

{/* Tab Navigation - Estilo Pills con Motion */}
<div className="p-1.5 bg-gray-100 rounded-xl inline-flex">
  {[
    { key: 'clinic', label: terms.clinicSection, icon: icons.clinic },
    { key: 'catalog', label: terms.catalogSection, icon: icons.catalog },
    { key: 'knowledge', label: 'Base de Conocimiento', icon: icons.brain },
    { key: 'scoring', label: 'Clasificación', icon: icons.check },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveSection(tab.key as typeof activeSection)}
      className={cn(
        'relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
        activeSection === tab.key
          ? 'text-white'
          : 'text-gray-600 hover:text-gray-900'
      )}
    >
      {activeSection === tab.key && (
        <motion.div
          layoutId="activeConfigTab"
          className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <span className="relative z-10">{tab.icon}</span>
      <span className="relative z-10">{tab.label}</span>
    </button>
  ))}
</div>
```

---

## 3. Cambio 2: Modal de Branch → Slide-Over

### Ubicación
`AIConfiguration.tsx` - BranchModal (actualmente inline ~líneas 1200+)

### Patrón Actual (Modal Centrado)
```typescript
{showBranchModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold">
          {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
        </h3>
      </div>
      {/* Form content */}
    </div>
  </div>
)}
```

### Patrón Propuesto (Slide-Over)
```typescript
import { AnimatePresence, motion } from 'framer-motion';

<AnimatePresence>
  {showBranchModal && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          setShowBranchModal(false);
          setEditingBranch(null);
        }}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Slide-over Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* Header con gradiente */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">
                {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                {editingBranch
                  ? 'Modifica la información de esta sucursal'
                  : 'Agrega una nueva ubicación para tu negocio'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowBranchModal(false);
                setEditingBranch(null);
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Form fields */}
        </div>

        {/* Footer - Fixed */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setShowBranchModal(false);
              setEditingBranch(null);
            }}
          >
            Cancelar
          </Button>
          <Button onClick={() => saveBranch(branchForm)} isLoading={saving}>
            {editingBranch ? 'Guardar Cambios' : 'Crear Sucursal'}
          </Button>
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

## 4. Cambio 3: Modal de Staff → Slide-Over

### Ubicación
`AIConfiguration.tsx` - StaffModal (similar estructura a BranchModal)

### Mismo patrón que Branch
Aplicar exactamente el mismo patrón slide-over, cambiando:
- Título: "Nuevo {terms.staffSingular}" / "Editar {terms.staffSingular}"
- Descripción: Usando terminología del vertical

---

## 5. Cambio 4: Unificar BranchCard

### Patrón Actual (Inline en AIConfiguration)
```typescript
// BranchCard actual - estilo básico
<div className="p-4 bg-gray-50 rounded-xl">
  {/* Contenido */}
</div>
```

### Patrón Propuesto (Estilo KnowledgeBase)
```typescript
// BranchCard mejorado
<div className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-md transition-all">
  <div className="flex items-start justify-between">
    {/* Info Principal */}
    <div className="flex items-start gap-4">
      {/* Icon con estado */}
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center',
        branch.is_headquarters
          ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
          : 'bg-gray-100 text-gray-600'
      )}>
        {icons.clinic}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900">{branch.name}</h4>
          {branch.is_headquarters && (
            <Badge variant="purple" size="sm">Matriz</Badge>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{branch.address}</p>
        <p className="text-sm text-gray-500">{branch.city}, {branch.state}</p>

        {/* Staff asignado */}
        {branchStaff.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <div className="flex -space-x-2">
              {branchStaff.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-600 border-2 border-white"
                >
                  {s.first_name?.[0]}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">
              {branchStaff.length} {branchStaff.length === 1 ? terms.staffSingular.toLowerCase() : terms.staffTitle.toLowerCase()}
            </span>
          </div>
        )}
      </div>
    </div>

    {/* Actions - Visible on hover */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onEdit(branch)}
        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title="Editar"
      >
        {icons.edit}
      </button>
      {!branch.is_headquarters && (
        <button
          onClick={() => onDelete(branch)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar"
        >
          {icons.trash}
        </button>
      )}
    </div>
  </div>

  {/* Operating Hours Summary */}
  <div className="mt-4 pt-4 border-t border-gray-100">
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5 text-gray-500">
        {icons.clock}
        <span>{formatOperatingHoursSummary(branch.operating_hours)}</span>
      </div>
      {branch.whatsapp_number && (
        <div className="flex items-center gap-1.5 text-green-600">
          {icons.whatsapp}
          <span>{branch.whatsapp_number}</span>
        </div>
      )}
    </div>
  </div>
</div>
```

---

## 6. Cambio 5: Unificar StaffCard

### Patrón Propuesto
```typescript
// StaffCard mejorado
<div className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-sm transition-all">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className="w-11 h-11 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
        <span className="text-purple-600 font-semibold">
          {member.first_name?.[0]}{member.last_name?.[0]}
        </span>
      </div>

      <div>
        <p className="font-medium text-gray-900">
          {terms.staffPrefix}{terms.staffPrefix ? ' ' : ''}
          {member.display_name || `${member.first_name} ${member.last_name}`}
        </p>
        {member.specialty && (
          <p className="text-sm text-gray-500">{member.specialty}</p>
        )}
        {memberBranches.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
              {memberBranches[0]}
            </span>
            {memberBranches.length > 1 && (
              <span className="text-xs text-gray-400">
                +{memberBranches.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onEdit(member)}
        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        {icons.edit}
      </button>
      <button
        onClick={() => onDelete(member)}
        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        {icons.trash}
      </button>
    </div>
  </div>
</div>
```

---

## 7. Checklist de Implementación

### Preparación
- [ ] Verificar que `framer-motion` está importado en AIConfiguration.tsx
- [ ] Backup del archivo actual

### Cambios a Realizar
- [ ] **Tabs**: Reemplazar border-b por pills con motion
- [ ] **BranchModal**: Convertir a slide-over
- [ ] **StaffModal**: Convertir a slide-over
- [ ] **BranchCard**: Aplicar nuevo estilo con hover effects
- [ ] **StaffCard**: Aplicar nuevo estilo con hover effects

### Verificación
- [ ] Tabs funcionales con animación suave
- [ ] Modales se abren/cierran correctamente
- [ ] Cards muestran hover effects
- [ ] Responsive en móvil
- [ ] No hay regresiones en funcionalidad

---

## 8. Dependencias

```typescript
// Imports necesarios
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
```

---

## 9. Notas Importantes

1. **NO modificar funcionalidad de billing** en BranchManagement
2. **Mantener todas las validaciones** de formularios
3. **Preservar estados** de loading y error
4. **Testear en móvil** - los slide-over deben ser full-width en pantallas pequeñas
