# FASE 4: Performance y Developer Experience

## Objetivo
Implementar optimistic updates, auto-save, skeleton loaders y otras mejoras de UX que hagan la aplicación más fluida.

---

## 1. Archivos a Modificar

| Archivo | Cambios | Prioridad |
|---------|---------|-----------|
| `KnowledgeBase.tsx` | Optimistic updates, skeletons | Alta |
| `AIConfiguration.tsx` | Optimistic updates, skeletons | Media |
| Nuevo: `skeletons/` | Componentes skeleton | Media |

---

## 2. Cambio 1: Optimistic Updates en KnowledgeBase

### Patrón Actual (Reload completo)

```typescript
// Actual - recarga toda la lista después de guardar
const handleSave = async () => {
  // ... save logic
  await fetchData();  // ← Recarga todo
  setShowModal(false);
};
```

### Patrón Propuesto (Optimistic Update)

```typescript
const handleSave = async () => {
  setSaving(true);

  try {
    const headers = await getAuthHeaders();
    const isEditing = !!editingItem;

    const response = await fetch('/api/knowledge-base', {
      method: isEditing ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify({
        type: modalType,
        ...formData,
        id: isEditing ? editingItem.id : undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error al guardar');
    }

    // OPTIMISTIC UPDATE - Actualizar estado local inmediatamente
    setData(prev => {
      const newData = { ...prev };
      const list = [...prev[modalType]];

      if (isEditing) {
        // Actualizar item existente
        const index = list.findIndex(item => item.id === editingItem.id);
        if (index !== -1) {
          list[index] = { ...list[index], ...formData, ...result.data };
        }
      } else {
        // Agregar nuevo item al inicio
        list.unshift(result.data);
      }

      newData[modalType] = list;
      return newData;
    });

    // Cerrar modal y limpiar
    setShowModal(false);
    setEditingItem(null);
    setFormData({});

    // Toast de éxito (opcional)
    showToast({
      type: 'success',
      message: isEditing ? 'Actualizado correctamente' : 'Creado correctamente'
    });

  } catch (error) {
    console.error('Error saving:', error);
    // En caso de error, recargar para sincronizar
    await fetchData();
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : 'Error al guardar'
    });
  } finally {
    setSaving(false);
  }
};

// Optimistic Delete
const handleDelete = async (type: TabType, id: string) => {
  // Guardar copia para rollback
  const previousData = { ...data };

  // OPTIMISTIC - Remover inmediatamente de la UI
  setData(prev => ({
    ...prev,
    [type]: prev[type].filter(item => item.id !== id)
  }));

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/knowledge-base?id=${id}&type=${type}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Error al eliminar');
    }

    showToast({ type: 'success', message: 'Eliminado correctamente' });

  } catch (error) {
    // ROLLBACK en caso de error
    setData(previousData);
    showToast({ type: 'error', message: 'Error al eliminar, intenta de nuevo' });
  }
};
```

---

## 3. Cambio 2: Debounced Auto-Save para Campos de Texto Largo

### Hook useDebounce

```typescript
// hooks/useDebounce.ts
import { useCallback, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}
```

### Uso en Form de Instrucciones/Políticas

```typescript
// Auto-save para campos largos
const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

const debouncedAutoSave = useDebouncedCallback(async (field: string, value: string) => {
  if (!editingItem?.id) return; // Solo para edición, no creación

  setAutoSaveStatus('saving');

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/knowledge-base', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        type: modalType,
        id: editingItem.id,
        [field]: value,
      }),
    });

    if (response.ok) {
      setAutoSaveStatus('saved');
      // Reset a idle después de 2 segundos
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } else {
      setAutoSaveStatus('error');
    }
  } catch {
    setAutoSaveStatus('error');
  }
}, 2000);

// En el textarea
<div className="relative">
  <textarea
    value={formData.instruction || ''}
    onChange={(e) => {
      setFormData({ ...formData, instruction: e.target.value });
      if (editingItem?.id) {
        debouncedAutoSave('instruction', e.target.value);
      }
    }}
    // ...
  />

  {/* Auto-save indicator */}
  {editingItem && (
    <div className="absolute bottom-2 right-2">
      {autoSaveStatus === 'saving' && (
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Guardando...
        </span>
      )}
      {autoSaveStatus === 'saved' && (
        <span className="text-xs text-green-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Guardado
        </span>
      )}
      {autoSaveStatus === 'error' && (
        <span className="text-xs text-red-600">Error al guardar</span>
      )}
    </div>
  )}
</div>
```

---

## 4. Cambio 3: Skeleton Loaders

### Componentes Skeleton Base

```typescript
// components/skeletons/index.tsx

// Skeleton base animado
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
);

// Skeleton para línea de texto
export const SkeletonText = ({ lines = 1, className }: { lines?: number; className?: string }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

// Skeleton para avatar/icono
export const SkeletonAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  return <Skeleton className={cn('rounded-full', sizes[size])} />;
};
```

### Skeleton para Knowledge Base Items

```typescript
// KnowledgeBaseItemSkeleton.tsx
export const KnowledgeBaseItemSkeleton = () => (
  <div className="p-5 bg-white rounded-xl border border-gray-200">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        {/* Type badge skeleton */}
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Title skeleton */}
        <Skeleton className="h-5 w-3/4 mb-2" />

        {/* Content preview skeleton */}
        <SkeletonText lines={2} className="mt-2" />
      </div>

      {/* Action buttons skeleton */}
      <div className="flex gap-2">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  </div>
);

// Lista de skeletons
export const KnowledgeBaseListSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <KnowledgeBaseItemSkeleton key={i} />
    ))}
  </div>
);
```

### Skeleton para Branch Cards

```typescript
// BranchCardSkeleton.tsx
export const BranchCardSkeleton = () => (
  <div className="p-5 bg-white rounded-xl border border-gray-200">
    <div className="flex items-start gap-4">
      {/* Icon skeleton */}
      <Skeleton className="w-12 h-12 rounded-xl" />

      <div className="flex-1">
        {/* Name and badge */}
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Address */}
        <Skeleton className="h-4 w-48 mb-1" />
        <Skeleton className="h-4 w-32" />

        {/* Staff avatars */}
        <div className="flex items-center gap-1 mt-3">
          <div className="flex -space-x-2">
            <SkeletonAvatar size="sm" />
            <SkeletonAvatar size="sm" />
            <SkeletonAvatar size="sm" />
          </div>
          <Skeleton className="h-3 w-16 ml-2" />
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);
```

### Skeleton para Quick Stats

```typescript
// QuickStatsSkeleton.tsx
export const QuickStatsSkeleton = () => (
  <div className="mb-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div>
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-7 w-28 rounded-full" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-5 gap-3 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 bg-white rounded-xl border border-gray-200">
          <Skeleton className="h-8 w-8 mx-auto mb-1" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>

    {/* Progress bar */}
    <Skeleton className="h-2 w-full rounded-full" />
  </div>
);
```

### Uso en Componentes

```typescript
// En KnowledgeBase.tsx
if (loading) {
  return (
    <div className="space-y-6">
      <QuickStatsSkeleton />
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-lg" />
        ))}
      </div>
      <KnowledgeBaseListSkeleton count={4} />
    </div>
  );
}

// En AIConfiguration.tsx - Tab Clinic
{loading ? (
  <div className="space-y-6">
    {/* Identity skeleton */}
    <div className="p-4 bg-white rounded-xl border border-gray-200">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>

    {/* Branches skeleton */}
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <BranchCardSkeleton key={i} />
      ))}
    </div>
  </div>
) : (
  // Actual content
)}
```

---

## 5. Cambio 4: Toast Notifications

### Hook useToast

```typescript
// hooks/useToast.tsx
import { useState, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

const ToastContext = createContext<{
  showToast: (toast: Omit<Toast, 'id'>) => void;
} | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    // Auto remove
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={cn(
                'px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px]',
                {
                  'bg-green-50 border border-green-200 text-green-800': toast.type === 'success',
                  'bg-red-50 border border-red-200 text-red-800': toast.type === 'error',
                  'bg-blue-50 border border-blue-200 text-blue-800': toast.type === 'info',
                  'bg-amber-50 border border-amber-200 text-amber-800': toast.type === 'warning',
                }
              )}
            >
              {/* Icon */}
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}

              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
```

---

## 6. Checklist de Implementación

### Optimistic Updates
- [ ] Implementar en handleSave de KnowledgeBase
- [ ] Implementar en handleDelete de KnowledgeBase
- [ ] Implementar en saveBranch de AIConfiguration
- [ ] Implementar en saveStaff de AIConfiguration

### Auto-Save
- [ ] Crear hook useDebouncedCallback
- [ ] Implementar en textarea de instrucciones
- [ ] Implementar en textarea de políticas
- [ ] Agregar indicador de estado de guardado

### Skeleton Loaders
- [ ] Crear componentes base (Skeleton, SkeletonText, SkeletonAvatar)
- [ ] Crear KnowledgeBaseItemSkeleton
- [ ] Crear BranchCardSkeleton
- [ ] Crear QuickStatsSkeleton
- [ ] Reemplazar spinners en KnowledgeBase
- [ ] Reemplazar spinners en AIConfiguration

### Toast Notifications
- [ ] Crear ToastProvider
- [ ] Agregar ToastProvider al layout
- [ ] Usar showToast en operaciones de guardado
- [ ] Usar showToast en operaciones de eliminación
- [ ] Usar showToast en errores

### Verificación
- [ ] Updates son instantáneos visualmente
- [ ] Rollback funciona en caso de error
- [ ] Auto-save no interfiere con save manual
- [ ] Skeletons se muestran durante carga
- [ ] Toasts aparecen y desaparecen correctamente

---

## 7. Notas de Implementación

1. **Optimistic updates requieren manejo de errores robusto** - siempre guardar estado anterior para rollback
2. **Auto-save solo en edición** - no en creación para evitar items vacíos
3. **Debounce de 2 segundos** - balance entre responsividad y reducción de llamadas API
4. **Skeletons deben coincidir con el layout real** - evitar "saltos" cuando carga el contenido
5. **Toasts no deben bloquear interacción** - posicionados en esquina, auto-dismiss
