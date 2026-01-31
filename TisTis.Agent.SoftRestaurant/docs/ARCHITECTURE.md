# TIS TIS Agent - Architecture Documentation

## Version: 1.0.0

This document describes the technical architecture of the TIS TIS Local Agent for Soft Restaurant, including system design, component interactions, data flow, and design patterns.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Design Patterns](#design-patterns)
6. [Dependency Injection](#dependency-injection)
7. [Module Reference](#module-reference)
8. [Deployment Architecture](#deployment-architecture)

---

## System Overview

The TIS TIS Agent is a Windows Service application that synchronizes data between Soft Restaurant POS systems and the TIS TIS Platform. It runs locally on customer servers, automatically detects the SR database, and performs incremental data synchronization.

### Key Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Runtime** | .NET 8.0 Windows Service |
| **Host Platform** | Windows 10/11, Windows Server 2016+ |
| **Database** | SQL Server (Soft Restaurant) |
| **Communication** | HTTPS REST API to TIS TIS Platform |
| **Security** | DPAPI encryption, SSL pinning, constant-time comparison |
| **Monitoring** | Health checks, metrics, alerting, diagnostics |

### Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    TIS TIS Platform                     │
│                 (Cloud - app.tistis.com)                │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTPS/REST
                            │ (TLS 1.2+)
                            ▼
┌─────────────────────────────────────────────────────────┐
│              TIS TIS Agent (Windows Service)            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              .NET 8.0 Runtime                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐          │   │
│  │  │ Serilog │ │ Polly   │ │ SQL Data │          │   │
│  │  │ Logging │ │ Retry   │ │ Client   │          │   │
│  │  └─────────┘ └─────────┘ └──────────┘          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ Windows Auth
                            │ (SQL Server)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                SQL Server Instance                       │
│            (DVSOFT / SOFTRESTAURANT Database)           │
└─────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

### System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Customer Premises                                │
│                                                                          │
│  ┌─────────────────┐    ┌────────────────────┐    ┌─────────────────┐  │
│  │  Soft Restaurant │    │   TIS TIS Agent    │    │  SQL Server     │  │
│  │      POS         │───▶│  Windows Service   │◀───│  (SR Database)  │  │
│  │  (Punto de Venta)│    │                    │    │                 │  │
│  └─────────────────┘    └────────────────────┘    └─────────────────┘  │
│                                   │                                      │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │   TIS TIS Platform   │
                         │  (Cloud SaaS)        │
                         │  • Dashboard         │
                         │  • Analytics         │
                         │  • AI Agents         │
                         └──────────────────────┘
```

### Solution Structure

```
TisTis.Agent.SoftRestaurant.sln
│
├── src/
│   ├── TisTis.Agent.Core/           # Core library (net8.0)
│   │   ├── Api/                     # TIS TIS API client
│   │   ├── Configuration/           # Agent configuration
│   │   ├── Database/                # SQL Server repository
│   │   ├── Detection/               # SR auto-detection
│   │   ├── Logging/                 # Secure logging
│   │   ├── Monitoring/              # Health & metrics
│   │   ├── Security/                # Cryptography & credentials
│   │   └── Sync/                    # Synchronization engine
│   │
│   └── TisTis.Agent.Service/        # Windows Service (net8.0-windows)
│       ├── Program.cs               # Entry point, DI setup
│       └── AgentWorker.cs           # Background service worker
│
├── tests/
│   ├── TisTis.Agent.Core.Tests/     # Unit tests (xUnit)
│   └── TisTis.Agent.Integration.Tests/
│
└── installer/
    ├── TisTis.Agent.Installer/      # WiX MSI project
    └── TisTis.Agent.Installer.CustomActions/
```

---

## Component Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          HOSTING LAYER                                   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   TisTis.Agent.Service                            │  │
│  │  ┌─────────────┐                                                  │  │
│  │  │ AgentWorker │ ← BackgroundService                              │  │
│  │  └─────────────┘                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CORE LAYER                                      │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  SyncEngine │  │ ApiClient   │  │  Monitoring │  │  Security   │   │
│  │             │  │             │  │             │  │             │   │
│  │ • Sales     │  │ • Register  │  │ • Health    │  │ • DPAPI     │   │
│  │ • Menu      │  │ • Heartbeat │  │ • Metrics   │  │ • Tokens    │   │
│  │ • Inventory │  │ • Sync      │  │ • Alerts    │  │ • SSL Pin   │   │
│  │ • Tables    │  │ • Ping      │  │ • Diag      │  │ • Logging   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│         │                │                │                │           │
│         ▼                ▼                ▼                ▼           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Repository  │  │ HttpClient  │  │  Services   │  │ Credential  │   │
│  │ (SQL Server)│  │ (REST)      │  │  (DI)       │  │ Store       │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE LAYER                              │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ SQL Server  │  │ HTTPS/TLS   │  │ File System │  │ Win Registry│   │
│  │ (SR Data)   │  │ (TIS TIS)   │  │ (Logs/Creds)│  │ (Detection) │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. SyncEngine

The heart of the agent, responsible for orchestrating data synchronization.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SyncEngine                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  State Machine:                                                      │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐        │
│  │ Stopped │───▶│ Starting │───▶│ Running │───▶│ Syncing │        │
│  └─────────┘    └──────────┘    └─────────┘    └─────────┘        │
│       ▲              │               │              │              │
│       │              ▼               ▼              ▼              │
│       │         ┌─────────┐    ┌──────────┐                       │
│       └─────────│  Error  │◀───│ Stopping │                       │
│                 └─────────┘    └──────────┘                       │
│                                                                      │
│  Sync Types:                                                         │
│  • Sales     - Every 30 seconds (incremental)                       │
│  • Menu      - Every 5 minutes                                       │
│  • Inventory - Every 5 minutes                                       │
│  • Tables    - Every 1 minute                                        │
│  • Full      - On-demand                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. Data Transformers

Transform Soft Restaurant data models to TIS TIS format.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       IDataTransformer<TSource, TTarget>             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Implementations:                                                    │
│                                                                      │
│  ┌────────────────────┐     ┌────────────────────┐                 │
│  │ VentasTransformer  │     │ ProductosTransformer│                 │
│  │                    │     │                    │                 │
│  │ SRVenta     ───▶   │     │ SRProducto   ───▶  │                 │
│  │ TisTisSale         │     │ TisTisProduct      │                 │
│  └────────────────────┘     └────────────────────┘                 │
│                                                                      │
│  ┌────────────────────┐     ┌────────────────────┐                 │
│  │InventarioTransformer│     │  MesasTransformer  │                 │
│  │                    │     │                    │                 │
│  │ SRInventario ───▶  │     │ SRMesa      ───▶   │                 │
│  │ TisTisInventory    │     │ TisTisTable        │                 │
│  └────────────────────┘     └────────────────────┘                 │
│                                                                      │
│  Pattern: Transform() + TransformMany()                             │
│  Features: Unit mapping, Status mapping, Metadata injection         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3. Security Module

Provides comprehensive security features.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Security Module                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │ SecureUtilities │    │ CredentialStore │                        │
│  │                 │    │                 │                        │
│  │ • ConstantTime  │    │ • DPAPI Store   │                        │
│  │ • ClearMemory   │    │ • Thread-Safe   │                        │
│  │ • Redact        │    │ • Secure Delete │                        │
│  │ • Validate      │    │ • IDisposable   │                        │
│  └─────────────────┘    └─────────────────┘                        │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │  TokenManager   │    │CertificateValid.│                        │
│  │                 │    │                 │                        │
│  │ • Rotation      │    │ • SSL Pinning   │                        │
│  │ • Expiration    │    │ • Key Strength  │                        │
│  │ • Atomic Update │    │ • Chain Valid   │                        │
│  │ • IDisposable   │    │ • SHA-1 Detect  │                        │
│  └─────────────────┘    └─────────────────┘                        │
│                                                                      │
│  ┌─────────────────┐                                                │
│  │SecureLogEnricher│                                                │
│  │                 │                                                │
│  │ • Auto-Redact   │                                                │
│  │ • Pattern Match │                                                │
│  │ • Nested Support│                                                │
│  └─────────────────┘                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4. Monitoring Module

Provides observability and alerting capabilities.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Monitoring Module                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                  ┌─────────────────────────┐                        │
│                  │ MonitoringOrchestrator  │                        │
│                  │   (BackgroundService)   │                        │
│                  └───────────┬─────────────┘                        │
│                              │                                       │
│       ┌──────────────────────┼──────────────────────┐               │
│       │                      │                      │               │
│  ┌────▼─────┐          ┌─────▼─────┐         ┌─────▼─────┐         │
│  │  Health  │          │  Metrics  │         │ Alerting  │         │
│  │  Checks  │          │ Collector │         │  Service  │         │
│  │          │          │           │         │           │         │
│  │ 6 Subsys │          │ Counters  │         │ Thresholds│         │
│  │ 30s Cycle│          │ Gauges    │         │ Cooldown  │         │
│  │ Caching  │          │ Histograms│         │ Events    │         │
│  └──────────┘          └───────────┘         └───────────┘         │
│       │                      │                      │               │
│       └──────────────────────┼──────────────────────┘               │
│                              │                                       │
│                   ┌──────────▼──────────┐                           │
│                   │   Diagnostics       │                           │
│                   │     Service         │                           │
│                   │                     │                           │
│                   │ • Report Gen        │                           │
│                   │ • Log Buffer        │                           │
│                   │ • Auto-Redaction    │                           │
│                   └─────────────────────┘                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Sync Operation Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            SYNC OPERATION FLOW                              │
└────────────────────────────────────────────────────────────────────────────┘

1. TRIGGER (Timer or Manual)
   │
   ▼
2. ┌─────────────────────────────────────────────────────────────────────┐
   │                        SyncEngine.SyncNowAsync()                     │
   │  • Validate state (must be Running)                                  │
   │  • Transition to Syncing state                                       │
   │  • Start timing                                                      │
   └─────────────────────────────────────────────────────────────────────┘
   │
   ▼
3. ┌─────────────────────────────────────────────────────────────────────┐
   │                     Repository.GetXxxAsync()                         │
   │  • Execute SQL query against SR database                             │
   │  • Apply incremental filter (LastSyncAt)                             │
   │  • Return List<SRModel>                                              │
   └─────────────────────────────────────────────────────────────────────┘
   │
   ▼
4. ┌─────────────────────────────────────────────────────────────────────┐
   │                    Transformer.TransformMany()                       │
   │  • Map SR fields → TIS TIS fields                                    │
   │  • Convert units (KG → kg, PZA → unit)                               │
   │  • Map statuses (Libre → available)                                  │
   │  • Inject metadata (source, sr_codigo)                               │
   │  • Return IEnumerable<TisTisModel>                                   │
   └─────────────────────────────────────────────────────────────────────┘
   │
   ▼
5. ┌─────────────────────────────────────────────────────────────────────┐
   │                   ApiClient.SendSyncDataAsync()                      │
   │  • Serialize to JSON                                                 │
   │  • Add auth header (Bearer token)                                    │
   │  • POST to /api/agent/sync                                           │
   │  • Retry with exponential backoff (Polly)                            │
   │  • Return SyncResponse                                               │
   └─────────────────────────────────────────────────────────────────────┘
   │
   ▼
6. ┌─────────────────────────────────────────────────────────────────────┐
   │                        Update Statistics                             │
   │  • Increment counters (Total, Success/Failed)                        │
   │  • Update LastSyncAt timestamp                                       │
   │  • Record metrics (duration, record count)                           │
   │  • Reset/Increment consecutive errors                                │
   │  • Transition back to Running state                                  │
   └─────────────────────────────────────────────────────────────────────┘
   │
   ▼
7. RESULT: SyncResult { Success, RecordsProcessed, Duration, ... }
```

### Heartbeat Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           HEARTBEAT FLOW                                    │
└────────────────────────────────────────────────────────────────────────────┘

Every 30 seconds:

  AgentWorker                 ApiClient                 TIS TIS Platform
       │                          │                            │
       │   SendHeartbeatAsync()   │                            │
       │─────────────────────────▶│                            │
       │                          │   POST /api/agent/heartbeat│
       │                          │───────────────────────────▶│
       │                          │                            │
       │                          │   { status, timestamp,     │
       │                          │     version, health }      │
       │                          │                            │
       │                          │◀───────────────────────────│
       │                          │   200 OK / Commands        │
       │◀─────────────────────────│                            │
       │                          │                            │
       │   Process commands       │                            │
       │   (if any)               │                            │
       │                          │                            │
```

---

## Design Patterns

### Patterns Used

| Pattern | Component | Purpose |
|---------|-----------|---------|
| **Repository** | `ISoftRestaurantRepository` | Abstracts SQL Server data access |
| **Strategy** | `IDataTransformer<T,U>` | Pluggable transformation algorithms |
| **Composite** | `SoftRestaurantDetector` | Combines multiple detection strategies |
| **Orchestrator** | `MonitoringOrchestrator` | Coordinates monitoring services |
| **Singleton** | DI Services | Single instance per service lifetime |
| **Worker Service** | `AgentWorker` | Background processing pattern |
| **Decorator** | `SecureLogEnricher` | Adds redaction to Serilog |
| **Circular Buffer** | `HistogramBuffer` | O(1) sliding window for metrics |
| **Template Method** | Detectors | Common detection flow with variants |
| **Dispose Pattern** | Security classes | Proper resource cleanup |

### Repository Pattern

```csharp
// Interface defines the contract
public interface ISoftRestaurantRepository
{
    Task<IList<SRVenta>> GetVentasAsync(DateTime? since, CancellationToken ct);
    Task<IList<SRProducto>> GetProductosAsync(CancellationToken ct);
    Task<IList<SRInventario>> GetInventarioAsync(CancellationToken ct);
    Task<IList<SRMesa>> GetMesasAsync(CancellationToken ct);
    Task<bool> TestConnectionAsync(CancellationToken ct);
}

// Implementation handles SQL Server specifics
public class SoftRestaurantRepository : ISoftRestaurantRepository
{
    // Uses Microsoft.Data.SqlClient
    // Implements Windows Authentication
    // Handles connection pooling
}
```

### Strategy Pattern (Transformers)

```csharp
// Generic interface for all transformers
public interface IDataTransformer<TSource, TTarget>
{
    TTarget Transform(TSource source);
    IEnumerable<TTarget> TransformMany(IEnumerable<TSource> sources);
}

// Concrete implementations
public class VentasTransformer : IDataTransformer<SRVenta, TisTisSale> { ... }
public class ProductosTransformer : IDataTransformer<SRProducto, TisTisProduct> { ... }
public class InventarioTransformer : IDataTransformer<SRInventario, TisTisInventoryItem> { ... }
public class MesasTransformer : IDataTransformer<SRMesa, TisTisTable> { ... }
```

---

## Dependency Injection

### Service Registration

```csharp
// Configuration (Singleton)
builder.Services.AddSingleton(agentConfig);
builder.Services.AddSingleton(agentConfig.Api);
builder.Services.AddSingleton(agentConfig.Sync);
builder.Services.AddSingleton(agentConfig.Security);

// Security Services (Singleton)
builder.Services.AddSingleton<CredentialStore>();
builder.Services.AddSingleton<TokenManager>();
builder.Services.AddSingleton<CertificateValidator>();

// Detection Services (Singleton)
builder.Services.AddSingleton<RegistryDetector>();
builder.Services.AddSingleton<ServiceDetector>();
builder.Services.AddSingleton<SqlInstanceDetector>();
builder.Services.AddSingleton<ISoftRestaurantDetector, SoftRestaurantDetector>();

// Data Services (Singleton)
builder.Services.AddSingleton<ISoftRestaurantRepository, SoftRestaurantRepository>();
builder.Services.AddSingleton<ITisTisApiClient, TisTisApiClient>();
builder.Services.AddSingleton<ISyncEngine, SyncEngine>();

// Monitoring (via Extension Method)
builder.Services.AddTisTisMonitoring();

// Background Worker (Hosted Service)
builder.Services.AddHostedService<AgentWorker>();
```

### Dependency Graph

```
AgentWorker
├── ISyncEngine
│   ├── ISoftRestaurantRepository
│   ├── ITisTisApiClient
│   │   ├── AgentConfiguration
│   │   ├── CertificateValidator
│   │   │   └── SecurityOptions
│   │   └── ILogger<TisTisApiClient>
│   ├── VentasTransformer
│   ├── ProductosTransformer
│   ├── InventarioTransformer
│   └── MesasTransformer
├── ITisTisApiClient (same as above)
├── CredentialStore
│   └── SecurityOptions
├── TokenManager
│   ├── CredentialStore
│   └── AgentConfiguration
├── IMonitoringOrchestrator
│   ├── IHealthCheckService
│   ├── IMetricsCollector
│   ├── IAlertingService
│   └── IDiagnosticsService
└── ILogger<AgentWorker>
```

---

## Module Reference

### TisTis.Agent.Core

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **Api** | TIS TIS Platform communication | `ITisTisApiClient.cs`, `TisTisApiClient.cs` |
| **Configuration** | Agent settings | `AgentConfiguration.cs` |
| **Database** | SQL Server access | `ISoftRestaurantRepository.cs`, Models/ |
| **Detection** | SR auto-discovery | `SoftRestaurantDetector.cs`, Detectors/ |
| **Logging** | Secure logging | `AgentLogger.cs`, `SecureLogEnricher.cs` |
| **Monitoring** | Health & metrics | See [MONITORING.md](MONITORING.md) |
| **Security** | Cryptography | See [SECURITY.md](SECURITY.md) |
| **Sync** | Data synchronization | `SyncEngine.cs`, Transformers/ |

### TisTis.Agent.Service

| File | Purpose |
|------|---------|
| `Program.cs` | Entry point, DI configuration, host setup |
| `AgentWorker.cs` | BackgroundService implementation |

---

## Deployment Architecture

### Installation Layout

```
C:\Program Files\TisTis\Agent\           # Application binaries
├── TisTis.Agent.Service.exe             # Main executable
├── TisTis.Agent.Core.dll                # Core library
├── appsettings.json                     # Configuration
└── [.NET dependencies]

C:\ProgramData\TisTis\Agent\             # Application data
├── Logs\                                # Log files
│   └── agent-YYYYMMDD.log
├── Config\                              # Additional config
└── Credentials\
    └── credentials.dat                  # DPAPI encrypted

HKLM\SOFTWARE\TisTis\Agent\              # Registry
├── InstallPath
├── DataPath
├── Version
├── AgentId
└── SyncInterval
```

### Network Requirements

| Direction | Protocol | Port | Destination | Purpose |
|-----------|----------|------|-------------|---------|
| Outbound | HTTPS | 443 | app.tistis.com | API communication |
| Inbound | TCP | 1433 | localhost | SQL Server connection |

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 | Windows Server 2022 |
| .NET | 8.0 Runtime | 8.0 Runtime |
| RAM | 256 MB | 512 MB |
| Disk | 100 MB | 500 MB |
| Network | 1 Mbps | 10 Mbps |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial architecture documentation |

---

*For additional support, contact: soporte@tistis.com*
