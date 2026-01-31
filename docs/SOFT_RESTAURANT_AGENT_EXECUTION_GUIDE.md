# Guia de Ejecucion: TIS TIS Local Agent para Soft Restaurant

**Version:** 1.1.0
**Ultima Actualizacion:** 30 de Enero, 2026

---

## Novedades v1.1.0 (FASE 10-12)

Esta version incluye tres nuevas fases criticas:

| Fase | Nombre | Descripcion | Estado |
|------|--------|-------------|--------|
| **10** | Validacion de Schema | Sistema de validacion automatica del schema de BD | Completado |
| **11** | Guia de Credenciales | UI interactiva para obtener credenciales SQL | Completado |
| **12** | Fallbacks por Version | Queries adaptativas segun version de SR | Completado |

Ver detalles completos en `CLAUDE.md` seccion "TIS TIS Local Agent - Mejoras v4.8.3".

---

## Como Usar Este Documento

Este documento es la guía práctica para ejecutar cada fase de la especificación maestra. Cuando estés listo para comenzar una fase, dile a Claude:

```
Procede con FASE X
```

Claude ejecutará todas las microfases de esa fase en orden.

---

## Resumen de Fases

| Fase | Nombre | Duracion Est. | Dependencias | Estado |
|------|--------|---------------|--------------|--------|
| **1** | UI/UX en Dashboard TIS TIS | 3-4 dias | Ninguna | Completado |
| **2** | Infraestructura Backend | 2-3 dias | Fase 1 | Completado |
| **3** | Agente Windows Core | 5-7 dias | Fase 2 | Completado |
| **4** | Instalador Windows | 3-4 dias | Fase 3 | En progreso |
| **5** | Sincronizacion | 4-5 dias | Fases 3, 4 | En progreso |
| **6** | Seguridad | 2-3 dias | Fases 2, 3 | Parcial |
| **7** | Monitoreo | 2-3 dias | Fases 3, 5 | Pendiente |
| **8** | Testing | 3-5 dias | Todas | Pendiente |
| **9** | Documentacion | 2-3 dias | Todas | Parcial |
| **10** | Validacion de Schema | 1-2 dias | Fases 2, 3 | **Completado** |
| **11** | Guia de Credenciales | 1 dia | Fase 1 | **Completado** |
| **12** | Fallbacks por Version | 1-2 dias | Fases 3, 10 | **Completado** |

---

## FASE 1: UI/UX en Dashboard TIS TIS

### Comando de Ejecución
```
Procede con FASE 1
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 1.1 | Selector de Método | `SoftRestaurantConfigModal.tsx` | Modificar para agregar selector Webhook vs Agente Local |
| 1.2 | Wizard de Setup | `LocalAgentSetupWizard.tsx` | Nuevo componente con 5 pasos |
| 1.3 | Card de Estado | `AgentStatusCard.tsx` | Nuevo componente para mostrar estado del agente |
| 1.4 | Integración Hub | `IntegrationHub.tsx` | Modificar para integrar nuevos componentes |
| 1.5 | Tipos TypeScript | `integration.types.ts` | Agregar tipos para agente |

### Verificación

```bash
# Verificar que compila
npm run typecheck

# Verificar linting
npm run lint

# Verificar visualmente en navegador
npm run dev
# Navegar a: /dashboard/settings → Integraciones → Soft Restaurant
```

### Criterios de Completitud

- [ ] Selector de método aparece al configurar SR
- [ ] Opción "Agente Local" es seleccionable
- [ ] Wizard de 5 pasos funciona correctamente
- [ ] Paso de descarga genera y muestra credenciales
- [ ] UI es responsive en mobile
- [ ] Dark mode funciona correctamente

---

## FASE 2: Infraestructura Backend

### Comando de Ejecución
```
Procede con FASE 2
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 2.1 | Migración BD | `supabase/migrations/XXX_AGENT_INSTANCES.sql` | Crear tablas y funciones |
| 2.2 | API Register | `app/api/agent/register/route.ts` | Endpoint de registro |
| 2.3 | API Heartbeat | `app/api/agent/heartbeat/route.ts` | Endpoint de heartbeat |
| 2.4 | API Sync | `app/api/agent/sync/route.ts` | Endpoint de sincronización |
| 2.5 | API Installer | `app/api/agent/installer/route.ts` | Generador de instalador |
| 2.6 | Service | `agent-manager.service.ts` | Servicio de gestión |

### Verificación

```bash
# Aplicar migración (local)
npx supabase db push

# Verificar tablas creadas
npx supabase db diff

# Probar endpoints con curl
curl -X POST http://localhost:3000/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "...", "agent_id": "test-agent"}'

# Verificar build
npm run build
```

### Criterios de Completitud

- [ ] Migración ejecuta sin errores
- [ ] Tablas `agent_instances` y `agent_sync_logs` existen
- [ ] RLS policies funcionan correctamente
- [ ] Endpoint /register valida y crea instancias
- [ ] Endpoint /heartbeat actualiza estado
- [ ] Endpoint /sync procesa datos
- [ ] Rate limiting funciona

---

## FASE 3: Agente Windows Core

### Comando de Ejecución
```
Procede con FASE 3
```

### Prerrequisitos
- .NET 8.0 SDK instalado
- Visual Studio 2022 o VS Code con extensión C#
- SQL Server instalado (para testing)

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 3.1 | Solución | `TisTis.Agent.SoftRestaurant.sln` | Solución .NET |
| 3.2 | Core Library | `TisTis.Agent.Core/*.cs` | Biblioteca principal |
| 3.3 | Detector | `Detection/*.cs` | Detectores de SR |
| 3.4 | Repositorio | `Database/*.cs` | Acceso a datos SR |
| 3.5 | Sync Engine | `Sync/*.cs` | Motor de sincronización |
| 3.6 | Service | `TisTis.Agent.Service/` | Windows Service |

### Verificación

```bash
# Compilar solución
dotnet build TisTis.Agent.SoftRestaurant.sln

# Ejecutar tests
dotnet test

# Ejecutar servicio localmente
dotnet run --project TisTis.Agent.Service

# Verificar detección
# (requiere SQL Server con BD de prueba)
```

### Criterios de Completitud

- [ ] Solución compila sin errores
- [ ] Detector encuentra instalaciones de SR
- [ ] Repositorio lee datos de tablas SR
- [ ] Transformadores generan JSON correcto
- [ ] API Client se conecta a TIS TIS
- [ ] Servicio se ejecuta como proceso
- [ ] Logs se generan correctamente

---

## FASE 4: Instalador Windows

### Comando de Ejecución
```
Procede con FASE 4
```

### Prerrequisitos
- WiX Toolset v4 instalado
- .NET 8.0 SDK

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 4.1 | Proyecto WiX | `TisTis.Agent.Installer/` | Proyecto instalador |
| 4.2 | Diálogos UI | `UI/*.wxs` | Diálogos personalizados |
| 4.3 | Custom Actions | `CustomActions/*.cs` | Acciones de detección |
| 4.4 | Servicio | `Product.wxs` | Instalación de servicio |
| 4.5 | Desinstalación | Cleanup actions | Limpieza completa |

### Verificación

```bash
# Compilar instalador
dotnet build TisTis.Agent.Installer.wixproj

# Verificar MSI generado
ls -la TisTis.Agent.Installer/bin/Release/*.msi

# Probar instalación en VM
# (requiere VM Windows con SR instalado)
```

### Criterios de Completitud

- [ ] MSI se genera correctamente
- [ ] Diálogo de bienvenida aparece
- [ ] Detección de SR funciona en UI
- [ ] Configuración se guarda
- [ ] Servicio se instala y arranca
- [ ] Desinstalación limpia todo

---

## FASE 5: Sincronización y Transformación

### Comando de Ejecución
```
Procede con FASE 5
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 5.1 | Queries | `Queries/*.cs` | Queries optimizadas SR |
| 5.2 | Transformers | `Transformers/*.cs` | Transformadores de datos |
| 5.3 | Batching | `Batching/*.cs` | Procesamiento por lotes |
| 5.4 | Retry Logic | `SyncEngine.cs` | Manejo de errores |
| 5.5 | Incremental | `SyncEngine.cs` | Sync incremental |

### Verificación

```bash
# Ejecutar tests de sync
dotnet test --filter "Category=Sync"

# Verificar transformación
# (revisar logs de prueba)

# Probar sync completo
# (requiere BD SR de prueba)
```

### Criterios de Completitud

- [ ] Queries retornan datos correctos
- [ ] JSON generado es válido
- [ ] Batching funciona para datos grandes
- [ ] Errores se manejan y retryan
- [ ] Sync incremental solo envía nuevos

---

## FASE 6: Seguridad y Autenticación

### Comando de Ejecución
```
Procede con FASE 6
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 6.1 | DPAPI | `Security/CredentialStore.cs` | Almacenamiento seguro |
| 6.2 | Token Rotation | `Security/TokenManager.cs` | Rotación de tokens |
| 6.3 | TLS | `Api/TisTisApiClient.cs` | Configuración TLS |
| 6.4 | Audit | `Logging/AuditLogger.cs` | Logging de seguridad |

### Verificación

```bash
# Verificar encriptación
dotnet test --filter "Category=Security"

# Verificar certificado TLS
# (revisar conexiones HTTPS)

# Revisar logs de auditoría
```

### Criterios de Completitud

- [ ] Credenciales se encriptan con DPAPI
- [ ] Tokens se rotan antes de expirar
- [ ] Conexiones usan TLS 1.2+
- [ ] Eventos de seguridad se registran

---

## FASE 7: Monitoreo y Observabilidad

### Comando de Ejecución
```
Procede con FASE 7
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 7.1 | Dashboard UI | `AgentStatusCard.tsx` | Métricas en dashboard |
| 7.2 | Alertas | `agent-alerts.service.ts` | Sistema de alertas |
| 7.3 | Métricas | `agent-metrics.ts` | Métricas de sync |
| 7.4 | Event Viewer | `EventLogWriter.cs` | Integración Windows |

### Verificación

```bash
# Verificar UI de métricas
npm run dev
# Navegar a dashboard de integraciones

# Verificar alertas
# (simular desconexión de agente)

# Revisar Event Viewer en Windows
```

### Criterios de Completitud

- [ ] Dashboard muestra estado del agente
- [ ] Alertas se disparan al desconectarse
- [ ] Métricas de sync son precisas
- [ ] Eventos aparecen en Event Viewer

---

## FASE 8: Testing y QA

### Comando de Ejecución
```
Procede con FASE 8
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 8.1 | Unit Tests C# | `*.Tests/*.cs` | Tests unitarios .NET |
| 8.2 | Unit Tests TS | `*.test.ts` | Tests unitarios React |
| 8.3 | Integration | `Integration.Tests/` | Tests de integración |
| 8.4 | E2E | `e2e/*.spec.ts` | Tests end-to-end |
| 8.5 | Load | `load-tests/` | Tests de carga |

### Verificación

```bash
# Ejecutar todos los tests
dotnet test
npm run test

# Ejecutar E2E
npm run test:e2e

# Ejecutar load tests
# (configurar Artillery o k6)
```

### Criterios de Completitud

- [ ] Cobertura > 80% en código crítico
- [ ] Todos los tests pasan
- [ ] E2E cubre flujo principal
- [ ] Load test soporta 1000 req/min

---

## FASE 9: Documentación y Rollout

### Comando de Ejecución
```
Procede con FASE 9
```

### Entregables

| # | Microfase | Archivo(s) | Descripción |
|---|-----------|------------|-------------|
| 9.1 | Docs Técnicos | `docs/AGENT_TECHNICAL.md` | Documentación técnica |
| 9.2 | Guía Usuario | `docs/AGENT_USER_GUIDE.md` | Guía de instalación |
| 9.3 | Release | `CHANGELOG.md`, tags | Preparar release |

### Verificación

```bash
# Verificar documentación
# (revisar markdown renderizado)

# Crear release tag
git tag -a v1.0.0-agent -m "TIS TIS Agent v1.0.0"

# Publicar MSI en CDN
# (proceso manual o CI/CD)
```

### Criterios de Completitud

- [ ] Documentación técnica completa
- [ ] Guía de usuario clara
- [ ] CHANGELOG actualizado
- [ ] Release tag creado
- [ ] MSI disponible para descarga

---

## FASE 10: Validacion de Schema (COMPLETADO)

### Descripcion

Sistema de validacion automatica del schema de la base de datos Soft Restaurant que se ejecuta antes de la primera sincronizacion. Detecta tablas faltantes, columnas requeridas y determina funcionalidades disponibles.

### Entregables

| # | Microfase | Archivo(s) | Descripcion | Estado |
|---|-----------|------------|-------------|--------|
| 10.1 | Tipos Schema | `schema-validation.types.ts` | Definicion de 12 tablas esperadas, SR_KNOWN_VERSIONS | Completado |
| 10.2 | Servicio Next.js | `schema-validator.service.ts` | Validador singleton con generateSummary() | Completado |
| 10.3 | API Validate | `app/api/agent/validate-schema/route.ts` | POST endpoint para validacion | Completado |
| 10.4 | API Status | `app/api/agent/status/route.ts` | GET endpoint con schema validation data | Completado |
| 10.5 | Interface C# | `ISchemaValidator.cs` | Interface con DetectedVersion | Completado |
| 10.6 | Validador C# | `SchemaValidator.cs` | Implementacion con DetectSRVersion() | Completado |
| 10.7 | UI Status | `SchemaValidationStatus.tsx` | Componente visual de estado | Completado |
| 10.8 | Wizard Update | `LocalAgentSetupWizard.tsx` | Step 5 con SchemaValidationStatus | Completado |

### Verificacion

```bash
# Verificar que compila
npm run typecheck

# Verificar endpoint manualmente
curl -X GET "http://localhost:3000/api/agent/validate-schema"
# Debe retornar schema esperado

# Verificar UI
npm run dev
# Navegar a wizard de setup, Step 5 debe mostrar estado de validacion
```

### Criterios de Completitud

- [x] Tipos de schema definidos con 12 tablas
- [x] Servicio valida schema contra SR_EXPECTED_SCHEMA
- [x] API POST recibe schema y retorna validacion
- [x] API GET retorna estado del agente con schema validation
- [x] Agente C# detecta version de SR
- [x] UI muestra estado de validacion en wizard

---

## FASE 11: Guia de Credenciales (COMPLETADO)

### Descripcion

Componente UI interactivo que guia al usuario para obtener las credenciales de SQL Server necesarias para conectar el agente a Soft Restaurant.

### Entregables

| # | Microfase | Archivo(s) | Descripcion | Estado |
|---|-----------|------------|-------------|--------|
| 11.1 | Componente Guide | `CredentialsGuide.tsx` | Guia completa con 3 metodos de auth | Completado |
| 11.2 | SQL Scripts | Incluidos en componente | Scripts para crear usuario, encontrar BD | Completado |
| 11.3 | Wizard Integration | `LocalAgentSetupWizard.tsx` | Seccion expandible en Step 1 | Completado |

### Verificacion

```bash
# Verificar que compila
npm run typecheck

# Verificar visualmente
npm run dev
# Navegar a wizard, Step 1 debe tener seccion expandible de ayuda

# Verificar copy buttons
# Click en boton de copiar en bloques de codigo
```

### Criterios de Completitud

- [x] Selector de metodo de autenticacion (SQL, Windows, Unknown)
- [x] Instrucciones para SQL Server Authentication
- [x] Instrucciones para Windows Authentication
- [x] Guia para identificar metodo de auth
- [x] Scripts SQL copiables
- [x] Integracion en Step 1 del wizard

---

## FASE 12: Fallbacks por Version (COMPLETADO)

### Descripcion

Sistema que detecta automaticamente la version de Soft Restaurant y adapta las queries SQL segun las capacidades del schema.

### Entregables

| # | Microfase | Archivo(s) | Descripcion | Estado |
|---|-----------|------------|-------------|--------|
| 12.1 | Enum SRVersion | `SRVersionQueryProvider.cs` | V10, V9, V8, Unknown | Completado |
| 12.2 | Capabilities | `SRVersionCapabilities` | Struct con features por version | Completado |
| 12.3 | Query Provider | `SRVersionQueryProvider.cs` | Queries adaptativas | Completado |
| 12.4 | Deteccion | `DetectVersion()` | Logica de deteccion basada en columnas | Completado |
| 12.5 | Validator Update | `SchemaValidator.cs` | Llamada a DetectSRVersion() | Completado |
| 12.6 | Config Update | `AgentConfiguration.cs` | Campo DetectedVersion | Completado |
| 12.7 | Worker Update | `AgentWorker.cs` | Guardar version detectada | Completado |

### Verificacion

```bash
# Compilar solucion C#
cd TisTis.Agent.SoftRestaurant
dotnet build

# Ejecutar tests de version detection
dotnet test --filter "Category=Version"

# Verificar queries generadas
# Revisar logs de agente al conectar a diferentes versiones de SR
```

### Criterios de Completitud

- [x] Enum SRVersion con 4 valores
- [x] Deteccion basada en columnas Moneda, TipoOrden, NumeroComensales, PagosVenta
- [x] Queries adaptativas que usan ISNULL para columnas faltantes
- [x] GetInventarioQuery() retorna null si no hay tabla
- [x] GetMesasQuery() retorna null si no hay tabla
- [x] Version detectada se guarda en configuracion
- [x] Version detectada se muestra en UI (via SchemaValidationStatus)

---

## Troubleshooting

### Errores Comunes por Fase

#### FASE 1
- **Error:** Componente no se renderiza
- **Solución:** Verificar imports y exports en index.ts

#### FASE 2
- **Error:** Migración falla
- **Solución:** Verificar sintaxis SQL y dependencias de tablas

#### FASE 3
- **Error:** No detecta SQL Server
- **Solución:** Verificar que SQL Browser service está corriendo

#### FASE 4
- **Error:** MSI no se genera
- **Solucion:** Verificar instalacion de WiX Toolset

#### FASE 10
- **Error:** API validate-schema retorna 401
- **Solucion:** Verificar que agent_id y auth_token estan en headers
- **Error:** Schema validation siempre falla
- **Solucion:** Verificar que la query a INFORMATION_SCHEMA incluye las tablas correctas

#### FASE 11
- **Error:** Botones de copiar no funcionan
- **Solucion:** Verificar permisos de clipboard en el navegador

#### FASE 12
- **Error:** Version detectada siempre es Unknown
- **Solucion:** Verificar que las columnas Moneda, TipoOrden existen en tabla Ventas
- **Error:** Queries fallando en versiones antiguas de SR
- **Solucion:** Verificar que ISNULL() esta siendo usado para columnas opcionales

---

## Comandos Utiles

```bash
# Desarrollo frontend
npm run dev                    # Iniciar servidor dev
npm run typecheck             # Verificar tipos
npm run lint                  # Linting
npm run build                 # Build producción

# Base de datos
npx supabase db push          # Aplicar migraciones
npx supabase db diff          # Ver cambios pendientes
npx supabase db reset         # Reset completo

# Agente .NET
dotnet build                  # Compilar
dotnet test                   # Tests
dotnet run                    # Ejecutar
dotnet publish -c Release     # Publicar

# Instalador WiX
dotnet build TisTis.Agent.Installer.wixproj
```

---

## Contacto y Soporte

Para preguntas sobre este documento o la implementación:

1. Revisa la documentación en `/docs/`
2. Consulta el archivo `CLAUDE.md` para contexto del proyecto
3. Abre un issue en el repositorio si encuentras problemas

---

*Fin del Documento*
