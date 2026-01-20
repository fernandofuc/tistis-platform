# FASE 10: Wizard UI de Configuracion

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 10 |
| **Nombre** | Wizard UI |
| **Sprint** | 3 - UX y Testing |
| **Duracion Estimada** | 2 dias |
| **Dependencias** | Fases 01-09 (Backend completo) |
| **Documento Referencia** | `10-UX-COMPONENTES.md` |

---

## Objetivo

Implementar el wizard de configuracion paso a paso para que los usuarios configuren su Voice Agent de forma guiada e intuitiva.

---

## Microfases

### MICROFASE 10.1: Crear Estructura de Componentes
```
components/voice-agent/
├── wizard/
│   ├── VoiceAgentWizard.tsx
│   ├── WizardProgress.tsx
│   ├── WizardNavigation.tsx
│   └── steps/
│       ├── StepSelectType.tsx
│       ├── StepSelectVoice.tsx
│       ├── StepCustomize.tsx
│       ├── StepTest.tsx
│       └── StepActivate.tsx
```

### MICROFASE 10.2: Implementar VoiceAgentWizard (Container)
- Estado del wizard (paso actual, datos)
- Navegacion entre pasos
- Persistencia de datos
- Animaciones de transicion

### MICROFASE 10.3: Implementar StepSelectType
- Cards para cada tipo de asistente
- Badge "Recomendado" en estandar
- Features list por tipo
- Seleccion visual

### MICROFASE 10.4: Implementar StepSelectVoice (Se detalla en Fase 11)

### MICROFASE 10.5: Implementar StepCustomize
- Campo para instrucciones especiales
- Preview del prompt generado
- Toggle de capacidades opcionales

### MICROFASE 10.6: Implementar StepTest (Se detalla en Fase 12)

### MICROFASE 10.7: Implementar StepActivate
- Resumen de configuracion
- Boton de activacion
- Provisioning de numero
- Confirmacion de exito

### MICROFASE 10.8: Crear Pagina del Wizard
- `app/dashboard/voice-agent/setup/page.tsx`
- Proteccion de ruta
- Loading states

### MICROFASE 10.9: Tests E2E del Wizard
- Flujo completo
- Navegacion back/forward
- Validaciones

---

## Criterios de Exito
- [ ] 5 pasos implementados
- [ ] Navegacion fluida
- [ ] Validaciones por paso
- [ ] Responsive design
- [ ] Tests E2E pasan
