# FASE 12: Dashboard de Metricas y Testing

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 12 |
| **Nombre** | Dashboard y Testing UI |
| **Sprint** | 3 - UX y Testing |
| **Duracion Estimada** | 2 dias |
| **Dependencias** | Fases 01-09 (Backend completo) |
| **Documento Referencia** | `10-UX-COMPONENTES.md` |

---

## Objetivo

Implementar el dashboard de metricas del Voice Agent y el simulador de llamadas para testing.

---

## Microfases

### MICROFASE 12.1: Crear Estructura de Dashboard
```
components/voice-agent/
├── dashboard/
│   ├── MetricsDashboard.tsx
│   ├── MetricCard.tsx
│   ├── CallsChart.tsx
│   ├── LatencyChart.tsx
│   ├── RecentCallsTable.tsx
│   └── CallDetailsModal.tsx
├── testing/
│   ├── CallSimulator.tsx
│   ├── ValidationChecklist.tsx
│   └── TestScenarios.tsx
```

### MICROFASE 12.2: Implementar Metric Cards
- Total de llamadas
- Tasa de exito
- Latencia promedio
- Duracion promedio
- Cambio vs periodo anterior

### MICROFASE 12.3: Implementar Charts
- Llamadas por dia (area chart)
- Latencia p50/p95 (line chart)
- Distribucion de outcomes (bar chart)
- Usar Recharts o similar

### MICROFASE 12.4: Implementar Recent Calls Table
- Lista de llamadas recientes
- Paginacion
- Click para ver detalles
- Filtros basicos

### MICROFASE 12.5: Implementar Call Simulator
- UI de telefono
- Mensajes en tiempo real
- Escenarios de prueba predefinidos
- Metricas de la llamada

### MICROFASE 12.6: Implementar Validation Checklist
- Validaciones automaticas
- Status por validacion
- Progreso visual

### MICROFASE 12.7: Crear APIs de Metricas
```
app/api/voice-agent/
├── metrics/route.ts
├── metrics/calls/route.ts
└── metrics/realtime/route.ts
```

### MICROFASE 12.8: Crear Pagina de Dashboard
- `app/dashboard/voice-agent/page.tsx`
- Selector de rango de fechas
- Export de datos

### MICROFASE 12.9: Tests de Dashboard
- Metricas correctas
- Charts renderizan
- Filtros funcionan

---

## Criterios de Exito
- [ ] 4 metric cards
- [ ] 3 charts
- [ ] Tabla de llamadas
- [ ] Simulador funcional
- [ ] APIs de metricas
- [ ] Tests pasan
