# FASE 03: Circuit Breaker y Resiliencia

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 03 |
| **Nombre** | Circuit Breaker |
| **Sprint** | 1 - Fundamentos |
| **Duracion Estimada** | 1 dia |
| **Dependencias** | Fase 01 (Base de Datos) |
| **Documento Referencia** | `06-SEGURIDAD-RESILIENCIA.md` |

---

## Objetivo

Implementar el patron Circuit Breaker para proteger el sistema de LangGraph contra fallos en cascada, con persistencia de estado en Supabase y respuestas de fallback para mantener la experiencia del usuario.

---

## Microfases

### MICROFASE 3.1: Crear Estructura de Archivos

**Archivos a crear:**
```
lib/voice-agent/
├── resilience/
│   ├── index.ts
│   ├── circuit-breaker.ts
│   ├── circuit-breaker-store.ts
│   ├── fallback-responses.ts
│   └── types.ts
```

**Que hacer:**
1. Crear carpeta `lib/voice-agent/resilience/`
2. Crear archivo `types.ts` con interfaces:
   - `CircuitBreakerState` (CLOSED, OPEN, HALF_OPEN)
   - `CircuitBreakerConfig`
   - `CircuitBreakerStoreState`
   - `ExecutionResult`
3. Crear archivo `index.ts` con exports

**Verificacion:**
- [ ] Estructura de carpetas creada
- [ ] Types definidos con estados correctos
- [ ] Exports funcionan

---

### MICROFASE 3.2: Implementar Circuit Breaker Store (Supabase)

**Archivo:** `lib/voice-agent/resilience/circuit-breaker-store.ts`

**Que hacer:**
1. Crear interfaz `CircuitBreakerStore`:
   ```typescript
   interface CircuitBreakerStore {
     getState(businessId: string): Promise<CircuitBreakerStoreState>;
     setState(businessId: string, state: CircuitBreakerStoreState): Promise<void>;
   }
   ```

2. Implementar clase `SupabaseCircuitBreakerStore`:
   - Conectar con tabla `voice_circuit_breaker_state`
   - Metodo `getState()` - obtener estado actual
   - Metodo `setState()` - actualizar estado
   - Crear estado inicial si no existe

3. Implementar cache en memoria (5 segundos) para reducir queries

**Verificacion:**
- [ ] Lee estado de Supabase correctamente
- [ ] Escribe estado correctamente
- [ ] Crea estado inicial si no existe
- [ ] Cache funciona

---

### MICROFASE 3.3: Implementar Circuit Breaker Core

**Archivo:** `lib/voice-agent/resilience/circuit-breaker.ts`

**Que hacer:**
1. Crear clase `VoiceCircuitBreaker` con:
   - Constructor que recibe config y store
   - Estado actual (from store)
   - Contador de fallos

2. Configuracion default:
   ```typescript
   {
     failureThreshold: 5,      // Abrir despues de 5 fallos
     recoveryTimeout: 30000,   // 30 segundos antes de half-open
     timeout: 8000,            // 8 segundos timeout por operacion
     volumeThreshold: 10       // Minimo de requests antes de abrir
   }
   ```

3. Implementar metodo principal `execute<T>(fn: () => Promise<T>): Promise<T>`

**Verificacion:**
- [ ] Configuracion cargada correctamente
- [ ] Estado leido de store
- [ ] Metodo execute funciona

---

### MICROFASE 3.4: Implementar Logica de Estados

**Archivo:** `lib/voice-agent/resilience/circuit-breaker.ts` (continuacion)

**Que hacer:**
1. Estado CLOSED (normal):
   - Ejecutar funcion normalmente
   - En exito: resetear contador de fallos
   - En fallo: incrementar contador
   - Si fallos >= threshold: cambiar a OPEN

2. Estado OPEN (circuit abierto):
   - NO ejecutar funcion
   - Retornar fallback inmediatamente
   - Si paso recoveryTimeout: cambiar a HALF_OPEN

3. Estado HALF_OPEN (probando):
   - Permitir UN request de prueba
   - En exito: cambiar a CLOSED
   - En fallo: volver a OPEN

**Verificacion:**
- [ ] CLOSED ejecuta y cuenta fallos
- [ ] OPEN retorna fallback sin ejecutar
- [ ] HALF_OPEN permite un request de prueba
- [ ] Transiciones funcionan correctamente

---

### MICROFASE 3.5: Implementar Timeout Handling

**Archivo:** `lib/voice-agent/resilience/circuit-breaker.ts` (continuacion)

**Que hacer:**
1. Implementar wrapper con timeout:
   ```typescript
   private async executeWithTimeout<T>(
     fn: () => Promise<T>,
     timeout: number
   ): Promise<T>
   ```

2. Usar `Promise.race()` con timer

3. Timeout cuenta como fallo para el circuit breaker

4. Limpiar timer si operacion completa antes

**Verificacion:**
- [ ] Operaciones rapidas completan normalmente
- [ ] Operaciones lentas hacen timeout
- [ ] Timeout cuenta como fallo
- [ ] No hay memory leaks

---

### MICROFASE 3.6: Implementar Fallback Responses

**Archivo:** `lib/voice-agent/resilience/fallback-responses.ts`

**Que hacer:**
1. Crear objeto con fallbacks por idioma:
   ```typescript
   const FALLBACK_RESPONSES = {
     'es-MX': {
       systemError: "Lo siento, estoy teniendo problemas...",
       timeout: "La operacion tomo demasiado tiempo...",
       circuitOpen: "Estamos experimentando dificultades..."
     },
     'en-US': { ... }
   }
   ```

2. Crear funcion `getFallbackResponse(type, language)`

3. Fallback responses deben ser:
   - Amigables y no tecnicos
   - Cortos para voz
   - Ofrecer alternativa (llamar directamente)

**Verificacion:**
- [ ] Fallbacks definidos para es-MX y en-US
- [ ] Funcion retorna fallback correcto
- [ ] Mensajes son apropiados para voz

---

### MICROFASE 3.7: Implementar Eventos y Logging

**Archivo:** `lib/voice-agent/resilience/circuit-breaker.ts` (continuacion)

**Que hacer:**
1. Emitir eventos en cambios de estado:
   - `onStateChange(from, to, reason)`
   - `onFailure(error)`
   - `onSuccess()`
   - `onFallback()`

2. Integrar con logger:
   ```typescript
   logger.warn('Circuit breaker opened', {
     businessId,
     failureCount,
     lastError
   });
   ```

3. NO loguear datos sensibles de llamadas

**Verificacion:**
- [ ] Eventos emitidos en cambios de estado
- [ ] Logs informativos sin datos sensibles
- [ ] Facil de debugear

---

### MICROFASE 3.8: Implementar Metricas

**Archivo:** `lib/voice-agent/resilience/circuit-breaker.ts` (continuacion)

**Que hacer:**
1. Trackear metricas:
   - Total de executions
   - Successful executions
   - Failed executions
   - Timeouts
   - Fallbacks served
   - State changes

2. Exponer metodo `getMetrics()`:
   ```typescript
   {
     totalExecutions: number;
     successRate: number;
     failureRate: number;
     currentState: CircuitBreakerState;
     lastStateChange: Date;
   }
   ```

**Verificacion:**
- [ ] Metricas se acumulan correctamente
- [ ] getMetrics() retorna datos utiles
- [ ] Metricas reseteables

---

### MICROFASE 3.9: Tests de Circuit Breaker

**Archivo:** `__tests__/voice-agent/resilience/circuit-breaker.test.ts`

**Que hacer:**
1. Tests de estado CLOSED:
   - Ejecuta funcion normalmente
   - Incrementa fallos en error
   - Resetea en exito

2. Tests de estado OPEN:
   - No ejecuta funcion
   - Retorna fallback
   - Cambia a HALF_OPEN despues de timeout

3. Tests de estado HALF_OPEN:
   - Permite un request
   - Cierra en exito
   - Abre en fallo

4. Tests de timeout:
   - Timeout funciona
   - Cuenta como fallo

5. Tests de persistencia:
   - Estado se guarda en Supabase
   - Estado se recupera correctamente

**Verificacion:**
- [ ] Coverage > 90%
- [ ] Todos los estados testeados
- [ ] Transiciones testeadas
- [ ] Timeout testeado

---

### MICROFASE 3.10: Verificacion Final de Circuit Breaker

**Que hacer:**
1. Revisar implementacion completa
2. Probar escenario de fallos en cascada
3. Verificar que fallbacks son amigables
4. Verificar persistencia de estado
5. Documentar configuracion

**Verificacion:**
- [ ] Circuit Breaker completo
- [ ] Persistencia funciona
- [ ] Fallbacks apropiados
- [ ] Tests pasan
- [ ] Documentado

---

## Archivos a Crear

```
lib/voice-agent/resilience/
├── index.ts                    # Exports
├── types.ts                    # Interfaces y enums
├── circuit-breaker.ts          # Clase principal
├── circuit-breaker-store.ts    # Persistencia Supabase
└── fallback-responses.ts       # Respuestas de fallback

__tests__/voice-agent/resilience/
└── circuit-breaker.test.ts
```

---

## Configuracion

```typescript
// Configuracion recomendada para Voice Agent
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // 5 fallos para abrir
  recoveryTimeout: 30000,     // 30 segundos recovery
  timeout: 8000,              // 8 segundos max por operacion
  volumeThreshold: 10         // Minimo 10 requests antes de abrir
};
```

---

## Criterios de Exito

- [ ] 3 estados implementados (CLOSED, OPEN, HALF_OPEN)
- [ ] Transiciones funcionan correctamente
- [ ] Timeout de 8 segundos funciona
- [ ] Fallbacks en espanol e ingles
- [ ] Persistencia en Supabase
- [ ] Tests con coverage > 90%
- [ ] Metricas expuestas

---

## Notas Importantes

1. **Timeout de 8 segundos** - Critico para voz, usuarios no esperan mas
2. **Fallbacks amigables** - No mensajes tecnicos al usuario
3. **Persistencia** - Estado debe sobrevivir restarts
4. **Volume threshold** - No abrir con pocos requests (puede ser ruido)
