# TIS TIS Agent - Configuration Guide

## Version: 1.0.0

This document provides a comprehensive guide to configuring the TIS TIS Local Agent for Soft Restaurant.

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration Files](#configuration-files)
3. [Configuration Sections](#configuration-sections)
   - [Agent Identity](#agent-identity)
   - [API Options](#api-options)
   - [Soft Restaurant Options](#soft-restaurant-options)
   - [Sync Options](#sync-options)
   - [Logging Options](#logging-options)
   - [Security Options](#security-options)
4. [Serilog Configuration](#serilog-configuration)
5. [Environment Variables](#environment-variables)
6. [Validation](#validation)
7. [Configuration Examples](#configuration-examples)

---

## Overview

The TIS TIS Agent uses a layered configuration system:

1. **appsettings.json** - Base configuration
2. **appsettings.{Environment}.json** - Environment-specific overrides
3. **Environment variables** - Runtime overrides (prefix: `TISTIS_`)
4. **Installer** - Sets agent identity during installation

### Configuration Loading Order

```
1. appsettings.json (base)
2. appsettings.Development.json (if env = Development)
3. Environment variables (TISTIS_*)
4. Credential store (encrypted credentials)
```

---

## Configuration Files

### File Locations

| File | Location | Purpose |
|------|----------|---------|
| `appsettings.json` | `C:\Program Files\TisTis\Agent\` | Main configuration |
| `appsettings.Development.json` | Same as above | Development overrides |
| `credentials.dat` | `C:\ProgramData\TisTis\Agent\` | Encrypted credentials |

### Configuration Structure

```json
{
  "TisTisAgent": {
    "AgentId": "...",
    "TenantId": "...",
    "Api": { ... },
    "SoftRestaurant": { ... },
    "Sync": { ... },
    "Logging": { ... },
    "Security": { ... }
  },
  "Serilog": { ... }
}
```

---

## Configuration Sections

### Agent Identity

Core identification settings set during installation.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `AgentId` | string | Yes | Unique agent identifier |
| `TenantId` | string | Yes | TIS TIS tenant ID |
| `IntegrationId` | string | Yes | Integration instance ID |
| `BranchId` | string | No | Multi-branch support |
| `Version` | string | No | Agent version (default: `1.0.0`) |

```json
{
  "TisTisAgent": {
    "AgentId": "tis-agent-abc123def456",
    "TenantId": "tenant-xyz789",
    "IntegrationId": "int-sr-001",
    "BranchId": "branch-main",
    "Version": "1.0.0"
  }
}
```

---

### API Options

TIS TIS Platform API connection settings.

| Property | Type | Default | Valid Range | Description |
|----------|------|---------|-------------|-------------|
| `BaseUrl` | string | `https://app.tistis.com` | Valid URL | API base URL |
| `RegisterEndpoint` | string | `/api/agent/register` | - | Registration endpoint |
| `HeartbeatEndpoint` | string | `/api/agent/heartbeat` | - | Heartbeat endpoint |
| `SyncEndpoint` | string | `/api/agent/sync` | - | Sync data endpoint |
| `TimeoutSeconds` | int | `30` | 5-120 | HTTP request timeout |
| `MaxRetries` | int | `3` | 0-10 | Retry attempts |
| `RetryDelayMs` | int | `1000` | - | Base retry delay |
| `ValidateSsl` | bool | `true` | - | SSL validation |

```json
{
  "Api": {
    "BaseUrl": "https://app.tistis.com",
    "RegisterEndpoint": "/api/agent/register",
    "HeartbeatEndpoint": "/api/agent/heartbeat",
    "SyncEndpoint": "/api/agent/sync",
    "TimeoutSeconds": 30,
    "MaxRetries": 3,
    "RetryDelayMs": 1000,
    "ValidateSsl": true
  }
}
```

**Security Note:** Never set `ValidateSsl: false` in production.

---

### Soft Restaurant Options

Database connection settings (typically auto-detected).

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ConnectionString` | string | - | SQL Server connection string |
| `SqlInstance` | string | - | SQL instance name |
| `DatabaseName` | string | - | Database name (e.g., DVSOFT) |
| `Version` | string | - | Detected SR version |
| `EmpresaId` | string | - | SR empresa ID |
| `StoreCode` | string | `""` | Multi-branch store code (CodigoTienda/Almacen) |
| `QueryTimeoutSeconds` | int | `60` | SQL query timeout |
| `MinPoolSize` | int | `1` | Min connection pool size |
| `MaxPoolSize` | int | `10` | Max connection pool size |

```json
{
  "SoftRestaurant": {
    "ConnectionString": "Server=SERVER01\\SQLEXPRESS;Database=DVSOFT;Integrated Security=True;TrustServerCertificate=True",
    "SqlInstance": "SERVER01\\SQLEXPRESS",
    "DatabaseName": "DVSOFT",
    "Version": "10.5",
    "EmpresaId": "EMP001",
    "StoreCode": "",
    "QueryTimeoutSeconds": 60,
    "MinPoolSize": 1,
    "MaxPoolSize": 10
  }
}
```

#### Multi-Branch Configuration (StoreCode)

For restaurants with multiple locations using a single Soft Restaurant database, configure the `StoreCode` to filter data:

```json
{
  "SoftRestaurant": {
    "StoreCode": "TIENDA01"
  }
}
```

**How it works:**
- When `StoreCode` is set, all SQL queries filter by `Almacen = @StoreCode`
- Only sales and inventory from this specific store are synchronized
- Leave empty for single-store installations

**Finding your StoreCode:**
1. In Soft Restaurant, go to **Catálogos → Almacenes** or **Tiendas**
2. Note the **Código** field for your store
3. Common values: `TIENDA01`, `SUC_CENTRO`, `ALM001`

**Example Multi-Branch Setup:**
```
Branch 1: StoreCode = "TIENDA01" → TIS TIS Branch "Sucursal Centro"
Branch 2: StoreCode = "TIENDA02" → TIS TIS Branch "Sucursal Norte"
Branch 3: StoreCode = "TIENDA03" → TIS TIS Branch "Sucursal Sur"
```
```

---

### Sync Options

Data synchronization behavior settings.

| Property | Type | Default | Valid Range | Description |
|----------|------|---------|-------------|-------------|
| `IntervalSeconds` | int | `30` | 10-300 | Sync cycle interval |
| `SyncSales` | bool | `true` | - | Enable sales sync |
| `SyncMenu` | bool | `true` | - | Enable menu sync |
| `SyncInventory` | bool | `true` | - | Enable inventory sync |
| `SyncTables` | bool | `false` | - | Enable table status sync |
| `BatchSize` | int | `100` | 10-1000 | Records per API batch |
| `MaxRecordsPerQuery` | int | `1000` | - | Max DB query results |
| `HeartbeatIntervalSeconds` | int | `60` | 30-300 | Heartbeat frequency |
| `FullSyncIntervalMinutes` | int | `60` | 0 = disabled | Full sync frequency |
| `MaxConsecutiveErrors` | int | `5` | - | Errors before pause |
| `ErrorPauseSeconds` | int | `300` | - | Pause duration |

```json
{
  "Sync": {
    "IntervalSeconds": 30,
    "SyncSales": true,
    "SyncMenu": true,
    "SyncInventory": true,
    "SyncTables": false,
    "BatchSize": 100,
    "MaxRecordsPerQuery": 1000,
    "HeartbeatIntervalSeconds": 60,
    "FullSyncIntervalMinutes": 60,
    "MaxConsecutiveErrors": 5,
    "ErrorPauseSeconds": 300
  }
}
```

**Performance Tips:**
- Increase `IntervalSeconds` for lower server load
- Decrease `BatchSize` for slower networks
- Set `SyncTables: true` only if using floor plan features

---

### Logging Options

Log file and event log settings.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `LogDirectory` | string | `C:\ProgramData\TisTis\Agent\Logs` | Log file directory |
| `MinimumLevel` | string | `Information` | Min log level |
| `RetainDays` | int | `30` | Log retention days |
| `MaxFileSizeMb` | int | `10` | Max file size before roll |
| `WriteToEventLog` | bool | `true` | Write to Windows Event Log |
| `EventLogSource` | string | `TisTis.Agent` | Event Log source name |

```json
{
  "Logging": {
    "LogDirectory": "C:\\ProgramData\\TisTis\\Agent\\Logs",
    "MinimumLevel": "Information",
    "RetainDays": 30,
    "MaxFileSizeMb": 10,
    "WriteToEventLog": true,
    "EventLogSource": "TisTis.Agent"
  }
}
```

**Log Levels:**
- `Verbose` - Most detailed, for troubleshooting
- `Debug` - Debugging information
- `Information` - Normal operation (default)
- `Warning` - Potential issues
- `Error` - Errors requiring attention
- `Fatal` - Critical failures

---

### Security Options

Security and encryption settings.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `UseDataProtection` | bool | `true` | DPAPI encryption |
| `CredentialStorePath` | string | `C:\ProgramData\TisTis\Agent\credentials.dat` | Credential file |
| `MinTlsVersion` | string | `Tls12` | Minimum TLS version |
| `UseCertificatePinning` | bool | `false` | Certificate pinning |
| `CertificateThumbprint` | string | null | Pinned cert thumbprint |

```json
{
  "Security": {
    "UseDataProtection": true,
    "CredentialStorePath": "C:\\ProgramData\\TisTis\\Agent\\credentials.dat",
    "MinTlsVersion": "Tls12",
    "UseCertificatePinning": false,
    "CertificateThumbprint": null
  }
}
```

**Security Recommendations:**
- Always use `UseDataProtection: true` in production
- Enable `UseCertificatePinning` for high-security deployments
- Use `Tls12` or higher

---

## Serilog Configuration

Advanced logging configuration using Serilog.

```json
{
  "Serilog": {
    "Using": [
      "Serilog.Sinks.File",
      "Serilog.Sinks.Console",
      "Serilog.Sinks.EventLog"
    ],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning",
        "Microsoft.Hosting.Lifetime": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "File",
        "Args": {
          "path": "C:\\ProgramData\\TisTis\\Agent\\Logs\\agent-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 30,
          "fileSizeLimitBytes": 10485760,
          "rollOnFileSizeLimit": true,
          "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}"
        }
      },
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"
        }
      }
    ],
    "Enrich": [
      "FromLogContext",
      "WithMachineName",
      "WithProcessId",
      "WithThreadId"
    ]
  }
}
```

---

## Environment Variables

Override configuration with environment variables (prefix: `TISTIS_`):

| Variable | Maps To |
|----------|---------|
| `TISTIS_AgentId` | `TisTisAgent:AgentId` |
| `TISTIS_TenantId` | `TisTisAgent:TenantId` |
| `TISTIS_Api__BaseUrl` | `TisTisAgent:Api:BaseUrl` |
| `TISTIS_Sync__IntervalSeconds` | `TisTisAgent:Sync:IntervalSeconds` |

**Note:** Use `__` (double underscore) for nested properties.

### Example

```powershell
$env:TISTIS_AgentId = "tis-agent-custom"
$env:TISTIS_Api__BaseUrl = "https://staging.tistis.com"
```

---

## Validation

The configuration is validated at startup:

### Required Fields

- `AgentId` - Non-empty
- `TenantId` - Non-empty
- `IntegrationId` - Non-empty
- `Api.BaseUrl` - Valid HTTP(S) URL

### Range Validation

| Property | Valid Range |
|----------|-------------|
| `Api.TimeoutSeconds` | 5-120 |
| `Api.MaxRetries` | 0-10 |
| `Sync.IntervalSeconds` | 10-300 |
| `Sync.BatchSize` | 10-1000 |
| `Sync.HeartbeatIntervalSeconds` | 30-300 |

### Logical Validation

- At least one sync type must be enabled
- `Api.BaseUrl` must be a valid URL

### Programmatic Validation

```csharp
var config = new AgentConfiguration();
builder.Configuration.GetSection("TisTisAgent").Bind(config);

var result = config.Validate();
if (!result.IsValid)
{
    foreach (var error in result.Errors)
    {
        Console.WriteLine($"Config error: {error}");
    }
    return 1; // Exit with error
}
```

---

## Configuration Examples

### Production

```json
{
  "TisTisAgent": {
    "AgentId": "tis-agent-prod-001",
    "TenantId": "tenant-restaurant-abc",
    "IntegrationId": "int-sr-main",
    "Api": {
      "BaseUrl": "https://app.tistis.com",
      "ValidateSsl": true
    },
    "Sync": {
      "IntervalSeconds": 30,
      "SyncSales": true,
      "SyncMenu": true,
      "SyncInventory": true
    },
    "Security": {
      "UseDataProtection": true,
      "UseCertificatePinning": true,
      "CertificateThumbprint": "AA:BB:CC:DD:..."
    }
  }
}
```

### Development

```json
{
  "TisTisAgent": {
    "AgentId": "tis-agent-dev-001",
    "TenantId": "tenant-dev",
    "IntegrationId": "int-sr-dev",
    "Api": {
      "BaseUrl": "https://localhost:5001",
      "ValidateSsl": false
    },
    "Sync": {
      "IntervalSeconds": 60
    },
    "Logging": {
      "MinimumLevel": "Debug"
    }
  }
}
```

### High-Volume Restaurant

```json
{
  "TisTisAgent": {
    "Sync": {
      "IntervalSeconds": 15,
      "BatchSize": 200,
      "MaxRecordsPerQuery": 2000,
      "SyncTables": true
    },
    "SoftRestaurant": {
      "MaxPoolSize": 20
    }
  }
}
```

### Low-Bandwidth Location

```json
{
  "TisTisAgent": {
    "Sync": {
      "IntervalSeconds": 120,
      "BatchSize": 25,
      "FullSyncIntervalMinutes": 240
    },
    "Api": {
      "TimeoutSeconds": 60,
      "MaxRetries": 5
    }
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial configuration documentation |

---

*For additional support, contact: soporte@tistis.com*
