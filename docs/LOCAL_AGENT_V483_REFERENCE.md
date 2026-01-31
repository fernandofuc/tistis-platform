# TIS TIS Local Agent v4.8.3 - Referencia Rapida

**Version:** 4.8.3
**Fecha:** 30 de Enero, 2026

---

## Resumen de Mejoras

Esta version incluye tres mejoras criticas al TIS TIS Local Agent para Soft Restaurant:

| FASE | Nombre | Descripcion |
|------|--------|-------------|
| 1 | Validacion de Schema | Validacion automatica del schema de BD antes de sync |
| 2 | Guia de Credenciales | UI interactiva para obtener credenciales SQL Server |
| 3 | Fallbacks por Version | Queries adaptativas segun version de SR |

---

## FASE 1: Validacion de Schema

### Archivos Creados/Modificados

```
src/features/integrations/
├── types/
│   └── schema-validation.types.ts    # NUEVO: Tipos y constantes
├── services/
│   └── schema-validator.service.ts   # NUEVO: Servicio singleton
├── components/
│   ├── SchemaValidationStatus.tsx    # NUEVO: UI de estado
│   └── LocalAgentSetupWizard.tsx     # MODIFICADO: Step 5

app/api/agent/
├── validate-schema/
│   └── route.ts                      # NUEVO: POST endpoint
└── status/
    └── route.ts                      # NUEVO: GET endpoint

TisTis.Agent.SoftRestaurant/src/TisTis.Agent.Core/Database/
├── ISchemaValidator.cs               # NUEVO: Interface
└── SchemaValidator.cs                # NUEVO: Implementacion
```

### Schema Esperado (12 Tablas)

| Tabla | Requerida | Modulo |
|-------|-----------|--------|
| Ventas | Si | sales |
| DetalleVentas | Si | sales |
| Productos | Si | menu, sales |
| PagosVenta | No | sales |
| FormasPago | No | sales |
| Categorias | No | menu |
| Inventario | No | inventory |
| CategoriasInventario | No | inventory |
| Proveedores | No | inventory |
| Mesas | No | tables |
| Clientes | No | sales |
| Empleados | No | sales |

### API: POST /api/agent/validate-schema

**Headers:**
```
Authorization: Bearer {agent_id}:{auth_token}
Content-Type: application/json
```

**Request:**
```json
{
  "agent_id": "tis-agent-abc123",
  "database_name": "SoftRestaurant",
  "sql_server_version": "Microsoft SQL Server 2019",
  "tables": [
    {
      "table_name": "Ventas",
      "schema_name": "dbo",
      "columns": [
        { "column_name": "IdVenta", "data_type": "bigint", "is_nullable": false }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "validatedAt": "2026-01-30T12:00:00Z",
    "databaseName": "SoftRestaurant",
    "srVersionDetected": "SR 10.x",
    "tablesFound": 12,
    "tablesMissing": 0,
    "canSyncSales": true,
    "canSyncMenu": true,
    "canSyncInventory": true,
    "canSyncTables": true
  },
  "summary": {
    "status": "success",
    "title": "Schema validado correctamente"
  }
}
```

### API: GET /api/agent/status

**Query:**
```
GET /api/agent/status?agent_id=tis-agent-abc123
```

**Response incluye:**
```json
{
  "schema_validation": {
    "success": true,
    "validated_at": "2026-01-30T12:00:00Z",
    "sr_version": "SR 10.x",
    "can_sync_sales": true,
    "can_sync_menu": true,
    "can_sync_inventory": true,
    "can_sync_tables": true
  }
}
```

---

## FASE 2: Guia de Credenciales

### Archivo Creado

```
src/features/integrations/components/CredentialsGuide.tsx
```

### Metodos de Autenticacion

| ID | Nombre | Descripcion |
|----|--------|-------------|
| `sql` | SQL Server Authentication | Usuario y contrasena SQL |
| `windows` | Windows Authentication | Credenciales de Windows |
| `unknown` | No se que metodo tengo | Guia para identificar |

### Scripts SQL Incluidos

**Crear usuario de solo lectura:**
```sql
CREATE LOGIN TisTisAgent WITH PASSWORD = 'TuContrasenaSegura123!';
USE SoftRestaurant;
CREATE USER TisTisAgent FOR LOGIN TisTisAgent;
EXEC sp_addrolemember 'db_datareader', 'TisTisAgent';
```

**Encontrar base de datos:**
```sql
SELECT name FROM sys.databases
WHERE name LIKE '%Soft%' OR name LIKE '%Restaurant%' OR name LIKE '%SR%';
```

### Integracion en Wizard

```tsx
// LocalAgentSetupWizard.tsx, Step 1
<ExpandableSection
  title="Necesitas ayuda con las credenciales?"
  icon={KeyIcon}
  defaultOpen={false}
>
  <CredentialsGuide compact />
</ExpandableSection>
```

---

## FASE 3: Fallbacks por Version

### Archivo Creado

```
TisTis.Agent.SoftRestaurant/src/TisTis.Agent.Core/Database/SRVersionQueryProvider.cs
```

### Versiones Soportadas

| Version | Enum | Soportado | Caracteristicas |
|---------|------|-----------|-----------------|
| SR 10.x | `V10` | Si | Moneda, TipoOrden, NumeroComensales, PagosVenta |
| SR 9.x | `V9` | Si | NumeroComensales, PagosVenta |
| SR 8.x | `V8` | No | Legacy |
| Unknown | `Unknown` | Si | Queries conservadoras |

### Deteccion de Version

```csharp
public static SRVersion DetectVersion(
    bool hasMoneda,
    bool hasTipoOrden,
    bool hasNumeroComensales,
    bool hasPagosVenta)
{
    if (hasMoneda && hasTipoOrden && hasNumeroComensales && hasPagosVenta)
        return SRVersion.V10;

    if (!hasMoneda && !hasTipoOrden && hasNumeroComensales && hasPagosVenta)
        return SRVersion.V9;

    if (!hasNumeroComensales && !hasPagosVenta)
        return SRVersion.V8;

    return SRVersion.Unknown;
}
```

### Queries Adaptativas

El `SRVersionQueryProvider` genera queries que se adaptan automaticamente:

```csharp
// Para columnas que pueden no existir
var monedaColumn = _capabilities.HasMonedaColumn
    ? "ISNULL(v.Moneda, 'MXN') AS Moneda"
    : "'MXN' AS Moneda";

// Para tablas opcionales
public string? GetInventarioQuery()
{
    if (!_capabilities.HasInventarioTable)
        return null;
    // ...
}
```

### Uso en AgentWorker

```csharp
// Obtener proveedor de queries segun version detectada
var queryProvider = new SRVersionQueryProvider(
    _config.SoftRestaurant.DetectedVersion,
    _config.SoftRestaurant.StoreCode
);

// Usar queries adaptadas
var ventasQuery = queryProvider.GetVentasQuery();
var inventarioQuery = queryProvider.GetInventarioQuery(); // puede ser null
```

---

## Checklist de Verificacion

### Backend (Next.js)

- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run lint` pasa sin errores
- [ ] API `/api/agent/validate-schema` responde correctamente
- [ ] API `/api/agent/status` incluye schema_validation

### Frontend (React)

- [ ] SchemaValidationStatus muestra estados correctamente
- [ ] CredentialsGuide tiene botones de copiar funcionales
- [ ] LocalAgentSetupWizard Step 1 tiene seccion de ayuda
- [ ] LocalAgentSetupWizard Step 5 muestra estado de schema

### Agente Windows (C#)

- [ ] `dotnet build` compila sin errores
- [ ] SchemaValidator detecta version correctamente
- [ ] SRVersionQueryProvider genera queries validas
- [ ] Queries con ISNULL funcionan en SR 9.x

---

## Referencias

- **CLAUDE.md** - Seccion "TIS TIS Local Agent - Mejoras v4.8.3"
- **docs/SOFT_RESTAURANT_AGENT_EXECUTION_GUIDE.md** - Fases 10-12
- **src/features/integrations/types/schema-validation.types.ts** - Schema esperado completo

---

*Documento generado automaticamente - TIS TIS Platform v4.8.3*
