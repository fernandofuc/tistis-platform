# FASE 02: Seguridad - Security Gate

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 02 |
| **Nombre** | Security Gate |
| **Sprint** | 1 - Fundamentos |
| **Duracion Estimada** | 1-2 dias |
| **Dependencias** | Fase 01 (Base de Datos) |
| **Documento Referencia** | `06-SEGURIDAD-RESILIENCIA.md` |

---

## Objetivo

Implementar el Security Gate completo para validar todos los webhooks entrantes de VAPI con 5 capas de seguridad: IP Whitelist, HMAC Signature, Timestamp, Rate Limiting y Content Validation.

---

## Microfases

### MICROFASE 2.1: Crear Estructura de Archivos

**Archivos a crear:**
```
lib/voice-agent/
├── security/
│   ├── index.ts
│   ├── webhook-security-gate.ts
│   ├── ip-whitelist.ts
│   ├── rate-limiter.ts
│   └── types.ts
```

**Que hacer:**
1. Crear carpeta `lib/voice-agent/security/`
2. Crear archivo `types.ts` con interfaces:
   - `SecurityValidationResult`
   - `SecurityGateConfig`
   - `ValidationLayer`
3. Crear archivo `index.ts` con exports

**Verificacion:**
- [ ] Estructura de carpetas creada
- [ ] Types definidos correctamente
- [ ] Exports funcionan

---

### MICROFASE 2.2: Implementar IP Whitelist

**Archivo:** `lib/voice-agent/security/ip-whitelist.ts`

**Que hacer:**
1. Crear clase `IPWhitelist` con:
   - Lista de IPs de VAPI (rangos CIDR)
   - Metodo `isAllowed(ip: string): boolean`
   - Soporte para IPv4 e IPv6
   - Manejo de `x-forwarded-for` header

2. IPs de VAPI a incluir:
   ```
   54.172.60.0/24
   54.244.51.0/24
   52.2.4.0/24
   3.129.67.0/24
   ```

3. Metodo para convertir IPv6 a IPv4 si es `::ffff:`

**Verificacion:**
- [ ] IPs de VAPI son permitidas
- [ ] IPs externas son bloqueadas
- [ ] IPv6 manejado correctamente
- [ ] x-forwarded-for parseado correctamente

---

### MICROFASE 2.3: Implementar Rate Limiter

**Archivo:** `lib/voice-agent/security/rate-limiter.ts`

**Que hacer:**
1. Crear clase `RateLimiter` con:
   - Almacenamiento en memoria (Map)
   - Configuracion: requests por ventana de tiempo
   - Metodo `checkLimit(key: string): { allowed: boolean, remaining: number }`
   - Limpieza automatica de entradas expiradas

2. Configuracion default:
   - 100 requests por minuto por IP
   - 1000 requests por minuto por tenant

3. Implementar sliding window algorithm

**Verificacion:**
- [ ] Permite requests dentro del limite
- [ ] Bloquea requests que exceden limite
- [ ] Reset despues de ventana de tiempo
- [ ] Limpieza de memoria funciona

---

### MICROFASE 2.4: Implementar HMAC Validation

**Archivo:** `lib/voice-agent/security/webhook-security-gate.ts` (parte 1)

**Que hacer:**
1. Implementar metodo `validateHmacSignature()`:
   - Obtener secret de env `VAPI_SECRET_KEY`
   - Leer header `x-vapi-signature`
   - Leer header `x-vapi-timestamp`
   - Calcular HMAC-SHA256 de `timestamp.payload`
   - Comparar con signature recibida

2. Usar `crypto.timingSafeEqual()` para comparacion

**Verificacion:**
- [ ] Signature valida es aceptada
- [ ] Signature invalida es rechazada
- [ ] Timing-safe comparison usado
- [ ] Error descriptivo en logs

---

### MICROFASE 2.5: Implementar Timestamp Validation

**Archivo:** `lib/voice-agent/security/webhook-security-gate.ts` (parte 2)

**Que hacer:**
1. Implementar metodo `validateTimestamp()`:
   - Leer header `x-vapi-timestamp`
   - Convertir a Date
   - Calcular diferencia con `Date.now()`
   - Rechazar si diferencia > 5 minutos

2. Manejar casos edge:
   - Timestamp en futuro (clock skew)
   - Timestamp muy viejo (replay attack)

**Verificacion:**
- [ ] Timestamp reciente es aceptado
- [ ] Timestamp > 5 min es rechazado
- [ ] Clock skew tolerance de 30 segundos
- [ ] Replay attacks prevenidos

---

### MICROFASE 2.6: Implementar Content Validation

**Archivo:** `lib/voice-agent/security/webhook-security-gate.ts` (parte 3)

**Que hacer:**
1. Implementar metodo `validateContent()`:
   - Verificar Content-Type es `application/json`
   - Verificar body no excede limite (1MB)
   - Verificar JSON es valido
   - Verificar estructura basica del webhook VAPI

2. Estructura esperada de VAPI webhook:
   ```typescript
   {
     message: {
       type: string; // 'assistant-request' | 'function-call' | etc
       call?: object;
       // ... otros campos segun tipo
     }
   }
   ```

**Verificacion:**
- [ ] Content-Type validado
- [ ] Payload size validado
- [ ] JSON valido aceptado
- [ ] JSON invalido rechazado
- [ ] Estructura basica verificada

---

### MICROFASE 2.7: Integrar Security Gate Completo

**Archivo:** `lib/voice-agent/security/webhook-security-gate.ts` (completo)

**Que hacer:**
1. Crear clase `WebhookSecurityGate` que integre todo:
   - Constructor con config
   - Metodo principal `validate(request: Request)`
   - Ejecutar validaciones en orden:
     1. IP Whitelist
     2. Rate Limit
     3. Timestamp
     4. HMAC Signature
     5. Content

2. Implementar fail-fast: parar en primera falla

3. Retornar resultado detallado:
   ```typescript
   {
     valid: boolean;
     failedAt?: 'ip' | 'rateLimit' | 'timestamp' | 'signature' | 'content';
     reason?: string;
     validations: {
       ip: boolean;
       rateLimit: boolean;
       timestamp: boolean;
       signature: boolean;
       content: boolean;
     }
   }
   ```

**Verificacion:**
- [ ] Todas las validaciones ejecutan en orden
- [ ] Fail-fast funciona
- [ ] Resultado detallado retornado
- [ ] Logging de seguridad funciona

---

### MICROFASE 2.8: Crear Logger de Seguridad

**Archivo:** `lib/voice-agent/security/security-logger.ts`

**Que hacer:**
1. Crear funcion `logSecurityEvent()`:
   - Tipo de evento (allowed, blocked, suspicious)
   - IP, timestamp, reason
   - Request ID para tracing

2. Integrar con sistema de logging existente

3. NO loguear datos sensibles (signatures, payloads completos)

**Verificacion:**
- [ ] Eventos de seguridad logueados
- [ ] No hay datos sensibles en logs
- [ ] Request ID incluido
- [ ] Formato estructurado (JSON)

---

### MICROFASE 2.9: Tests de Security Gate

**Archivo:** `__tests__/voice-agent/security/webhook-security-gate.test.ts`

**Que hacer:**
1. Tests para IP Whitelist:
   - IP de VAPI permitida
   - IP externa bloqueada
   - IPv6 manejado

2. Tests para Rate Limiter:
   - Dentro de limite
   - Excede limite
   - Reset despues de ventana

3. Tests para HMAC:
   - Signature valida
   - Signature invalida
   - Sin signature

4. Tests para Timestamp:
   - Timestamp valido
   - Timestamp expirado
   - Sin timestamp

5. Tests de integracion:
   - Request completamente valido
   - Fail en cada capa

**Verificacion:**
- [ ] Coverage > 90%
- [ ] Todos los tests pasan
- [ ] Edge cases cubiertos

---

### MICROFASE 2.10: Verificacion Final de Seguridad

**Que hacer:**
1. Revisar que todas las validaciones funcionan
2. Probar con request real de VAPI (si es posible)
3. Verificar logs de seguridad
4. Documentar configuracion requerida (env vars)

**Verificacion:**
- [ ] Security Gate completo y funcional
- [ ] Tests pasan
- [ ] Documentacion de env vars
- [ ] Logs funcionando

---

## Archivos a Crear

```
lib/voice-agent/security/
├── index.ts                    # Exports
├── types.ts                    # Interfaces
├── webhook-security-gate.ts    # Clase principal
├── ip-whitelist.ts             # IP validation
├── rate-limiter.ts             # Rate limiting
└── security-logger.ts          # Logging

__tests__/voice-agent/security/
└── webhook-security-gate.test.ts
```

---

## Variables de Entorno Requeridas

```env
VAPI_SECRET_KEY=your-vapi-secret-key
SECURITY_RATE_LIMIT_REQUESTS=100
SECURITY_RATE_LIMIT_WINDOW_MS=60000
SECURITY_TIMESTAMP_TOLERANCE_MS=300000
```

---

## Criterios de Exito

- [ ] 5 capas de validacion implementadas
- [ ] IP Whitelist con IPs de VAPI
- [ ] HMAC-SHA256 validation funcional
- [ ] Rate limiting funcional
- [ ] Tests con coverage > 90%
- [ ] Logging de seguridad activo
- [ ] No hay vulnerabilidades conocidas

---

## Notas Importantes

1. **Nunca loguear secrets** - VAPI_SECRET_KEY nunca debe aparecer en logs
2. **Timing-safe comparison** - Usar crypto.timingSafeEqual para HMAC
3. **Fail-fast** - Detener en primera falla para eficiencia
4. **Rate limit por IP y tenant** - Doble capa de proteccion
