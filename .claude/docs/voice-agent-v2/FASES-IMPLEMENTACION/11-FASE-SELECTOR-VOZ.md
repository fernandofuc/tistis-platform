# FASE 11: Selector de Voz con Preview

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 11 |
| **Nombre** | Selector de Voz |
| **Sprint** | 3 - UX y Testing |
| **Duracion Estimada** | 1 dia |
| **Dependencias** | Fase 10 (Wizard UI) |
| **Documento Referencia** | `10-UX-COMPONENTES.md` |

---

## Objetivo

Implementar el componente de seleccion de voz con previews de audio, control de velocidad y feedback visual.

---

## Microfases

### MICROFASE 11.1: Crear Componente StepSelectVoice
```tsx
// components/voice-agent/wizard/steps/StepSelectVoice.tsx
- Lista de voces disponibles
- Cards con info de cada voz
- Boton de play/pause
- Control de velocidad
```

### MICROFASE 11.2: Implementar Audio Player
- Reproduccion de previews
- Solo un audio a la vez
- Indicador de reproduccion
- Manejo de errores de audio

### MICROFASE 11.3: Implementar Control de Velocidad
- Slider de 0.8x a 1.3x
- Preview en tiempo real
- Persistencia de seleccion

### MICROFASE 11.4: Crear Cards de Voz
- Nombre y descripcion
- Icono de genero
- Tags de personalidad
- Estado de seleccion

### MICROFASE 11.5: Cargar Voces desde API
- Fetch de voice_catalog
- Filtrar por disponibilidad
- Manejo de loading

### MICROFASE 11.6: Tests del Selector
- Seleccion funciona
- Audio reproduce
- Velocidad cambia

---

## Criterios de Exito
- [ ] Previews de audio funcionan
- [ ] Control de velocidad funciona
- [ ] Seleccion visual clara
- [ ] Mobile friendly
- [ ] Tests pasan
