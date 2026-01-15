# Patrones UI de Componentes - TIS TIS

## 1. Cards

### Card Estándar
```typescript
<div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-4">
      {/* Icon */}
      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-purple-600" />
      </div>

      {/* Content */}
      <div>
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-2">
      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
        <EditIcon />
      </button>
    </div>
  </div>
</div>
```

### Card Interactiva (con hover)
```typescript
<div className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer">
  {/* Content */}

  {/* Actions visibles on hover */}
  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
    <button>...</button>
  </div>
</div>
```

### Card con Badge
```typescript
<div className="p-5 bg-white rounded-xl border border-gray-200">
  <div className="flex items-center gap-2 mb-2">
    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
      {type}
    </span>
    {isHeadquarters && (
      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
        Matriz
      </span>
    )}
  </div>
  <h4 className="font-semibold text-gray-900">{title}</h4>
  {/* ... */}
</div>
```

---

## 2. Modales

### Modal Slide-Over (Recomendado)
```typescript
<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Panel */}
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
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-purple-100 text-sm mt-1">{subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer - Fixed */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave} isLoading={saving}>
            Guardar
          </Button>
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### Modal Centrado (Alternativo)
```typescript
<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
      >
        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={onSave}>Guardar</Button>
          </div>
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

## 3. Tabs Navigation

### Pills con Motion (Recomendado)
```typescript
<div className="p-1.5 bg-gray-100 rounded-xl inline-flex">
  {tabs.map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={cn(
        'relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
        activeTab === tab.key
          ? 'text-white'
          : 'text-gray-600 hover:text-gray-900'
      )}
    >
      {activeTab === tab.key && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <span className="relative z-10">{tab.icon}</span>
      <span className="relative z-10">{tab.label}</span>
      {tab.count !== undefined && (
        <span className={cn(
          'relative z-10 px-1.5 py-0.5 text-xs rounded-full',
          activeTab === tab.key
            ? 'bg-white/20 text-white'
            : 'bg-gray-200 text-gray-600'
        )}>
          {tab.count}
        </span>
      )}
    </button>
  ))}
</div>
```

### Tabs Underline (Alternativo)
```typescript
<div className="flex border-b border-gray-200">
  {tabs.map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={cn(
        'relative px-6 py-4 text-sm font-medium transition-colors',
        activeTab === tab.key
          ? 'text-purple-600'
          : 'text-gray-500 hover:text-gray-700'
      )}
    >
      {tab.label}
      {activeTab === tab.key && (
        <motion.div
          layoutId="tabIndicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
    </button>
  ))}
</div>
```

---

## 4. Forms

### Form Group
```typescript
<div className="space-y-6">
  {/* Single field */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Nombre del Campo *
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
      placeholder="Placeholder text"
    />
    <p className="text-xs text-gray-500 mt-1">
      Texto de ayuda explicativo
    </p>
  </div>

  {/* Grid de 2 columnas */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Campo 1
      </label>
      <input ... />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Campo 2
      </label>
      <input ... />
    </div>
  </div>
</div>
```

### Select Field
```typescript
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Tipo
  </label>
  <div className="relative">
    <select
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none pr-10"
    >
      <option value="">Seleccionar...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
    </div>
  </div>
</div>
```

### Textarea
```typescript
<div>
  <div className="flex items-center justify-between mb-1">
    <label className="block text-sm font-medium text-gray-700">
      Descripción
    </label>
    <span className="text-xs text-gray-400">
      {value.length}/500
    </span>
  </div>
  <textarea
    value={value}
    onChange={(e) => setValue(e.target.value)}
    rows={4}
    maxLength={500}
    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
    placeholder="Escribe aquí..."
  />
</div>
```

---

## 5. Empty States

### Standard Empty State
```typescript
<div className="text-center py-12 bg-gray-50 rounded-xl">
  <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-4">
    <Icon className="w-8 h-8 text-gray-400" />
  </div>
  <h4 className="font-medium text-gray-900 mb-1">
    No hay elementos
  </h4>
  <p className="text-sm text-gray-500 mb-4">
    Descripción de qué hacer para agregar elementos
  </p>
  <Button onClick={onAdd}>
    Agregar Elemento
  </Button>
</div>
```

### Empty State con Ilustración
```typescript
<div className="text-center py-16">
  <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
    <Icon className="w-12 h-12 text-purple-600" />
  </div>
  <h3 className="text-xl font-semibold text-gray-900 mb-2">
    Título del empty state
  </h3>
  <p className="text-gray-500 max-w-md mx-auto mb-6">
    Descripción más detallada de la situación y qué puede hacer el usuario
  </p>
  <div className="flex justify-center gap-3">
    <Button variant="outline">Acción Secundaria</Button>
    <Button>Acción Principal</Button>
  </div>
</div>
```

---

## 6. Loading States

### Spinner Simple
```typescript
<div className="flex items-center justify-center py-12">
  <div className="w-8 h-8 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
</div>
```

### Loading con Texto
```typescript
<div className="flex items-center justify-center py-12 gap-3">
  <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
  <span className="text-gray-600">Cargando...</span>
</div>
```

### Skeleton Loader
```typescript
<div className="space-y-4 animate-pulse">
  {/* Skeleton Card */}
  <div className="p-5 bg-white rounded-xl border border-gray-200">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-gray-200 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  </div>
</div>
```

---

## 7. Feedback Components

### Toast Notification
```typescript
<motion.div
  initial={{ opacity: 0, y: 20, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: -20, scale: 0.95 }}
  className={cn(
    'px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px]',
    type === 'success' && 'bg-green-50 border border-green-200 text-green-800',
    type === 'error' && 'bg-red-50 border border-red-200 text-red-800',
    type === 'info' && 'bg-blue-50 border border-blue-200 text-blue-800',
  )}
>
  <Icon className="w-5 h-5" />
  <span className="text-sm font-medium">{message}</span>
</motion.div>
```

### Info Banner
```typescript
<div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
  <div className="flex items-start gap-3">
    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <InfoIcon className="w-5 h-5 text-blue-600" />
    </div>
    <div>
      <h4 className="font-medium text-blue-900 mb-1">{title}</h4>
      <p className="text-sm text-blue-700">{description}</p>
    </div>
  </div>
</div>
```

### Warning Banner
```typescript
<div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
  <div className="flex items-start gap-3">
    <AlertIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-medium text-amber-900">{title}</p>
      <p className="text-sm text-amber-700 mt-1">{description}</p>
    </div>
  </div>
</div>
```

---

## 8. Action Buttons Pattern

### Sticky Save Bar
```typescript
<AnimatePresence>
  {hasChanges && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="sticky bottom-4 flex justify-center"
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-center gap-4">
        <p className="text-sm text-gray-600">
          <strong>{changesCount}</strong> cambio{changesCount > 1 ? 's' : ''} pendiente{changesCount > 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDiscard} disabled={saving}>
            Descartar
          </Button>
          <Button onClick={onSave} isLoading={saving}>
            Guardar Cambios
          </Button>
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### Inline Actions (visible on hover)
```typescript
<div className="group">
  {/* Content */}
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    <button
      onClick={onEdit}
      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      title="Editar"
    >
      <EditIcon className="w-4 h-4" />
    </button>
    <button
      onClick={onDelete}
      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      title="Eliminar"
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  </div>
</div>
```

---

## 9. Responsive Patterns

### Mobile-First Card Grid
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Responsive Modal
```typescript
// Modal que es full-screen en móvil, slide-over en desktop
className={cn(
  'fixed z-50 bg-white shadow-2xl',
  // Móvil: full screen
  'inset-0',
  // Desktop: slide-over desde derecha
  'md:inset-y-0 md:right-0 md:left-auto md:max-w-2xl md:w-full'
)}
```

### Responsive Tabs
```typescript
// Scroll horizontal en móvil
<div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
  {tabs.map(tab => (
    <button className="flex-shrink-0 md:flex-shrink ...">
      {tab.label}
    </button>
  ))}
</div>
```
