# TIS TIS Local Agent for Soft Restaurant

A Windows Service that synchronizes data between Soft Restaurant POS and TIS TIS Platform.

## Version: 1.0.0 | Updated: 2026-01-30

## Overview

The TIS TIS Local Agent runs as a Windows Service on the customer's server where Soft Restaurant is installed. It automatically detects the SR database, reads sales, menu, and inventory data, and sends it to the TIS TIS Platform.

> **Quick Start:** See [Configuration Guide](docs/CONFIGURATION.md) for setup instructions.
>
> **Full Documentation:** See [Documentation Index](docs/INDEX.md) for complete reference.

## Features

- **Automatic Detection**: Discovers SQL Server instances and Soft Restaurant databases
- **Real-time Sync**: Incrementally syncs new sales data every 30 seconds
- **Menu & Inventory**: Periodically syncs menu items and inventory levels
- **Multi-Branch Support**: Filter by StoreCode (CodigoTienda) for multi-location restaurants
- **Secure**: Credentials encrypted with DPAPI, all communication over HTTPS
- **Security Hardened**: FASE 6 security enhancements (see [Security Documentation](docs/SECURITY.md))
- **Comprehensive Monitoring**: FASE 7 health checks, metrics, alerting, and diagnostics (see [Monitoring Documentation](docs/MONITORING.md))
- **Resilient**: Automatic retry with exponential backoff, graceful error handling
- **Monitored**: Heartbeat system with status reporting to TIS TIS dashboard

## Requirements

- Windows 10/11 or Windows Server 2016+
- .NET 8.0 Runtime
- SQL Server with Soft Restaurant database
- Network access to app.tistis.com

## Project Structure

```
TisTis.Agent.SoftRestaurant/
├── docs/
│   ├── INDEX.md                     # Documentation index (start here)
│   ├── ARCHITECTURE.md              # System design and components
│   ├── API.md                       # API client documentation
│   ├── SYNC_ENGINE.md               # Sync engine reference
│   ├── TRANSFORMERS.md              # Data transformers
│   ├── CONFIGURATION.md             # Configuration guide
│   ├── DEVELOPMENT.md               # Developer guide
│   ├── TESTING.md                   # Testing framework
│   ├── TROUBLESHOOTING.md           # Problem solving guide
│   ├── CHANGELOG.md                 # Version history
│   ├── SECURITY.md                  # Security documentation (FASE 6)
│   ├── SECURITY_QUICK_REFERENCE.md  # Security quick reference
│   ├── MONITORING.md                # Monitoring documentation (FASE 7)
│   └── MONITORING_QUICK_REFERENCE.md # Monitoring quick reference
│
├── installer/
│   └── README.md                    # Installer build guide
│
├── src/
│   ├── TisTis.Agent.Core/           # Core library
│   │   ├── Configuration/           # Agent configuration
│   │   ├── Detection/               # SR detection logic
│   │   ├── Database/                # SR data access
│   │   ├── Sync/                    # Sync engine
│   │   ├── Api/                     # TIS TIS API client
│   │   ├── Security/                # Security components (FASE 6 hardened)
│   │   ├── Logging/                 # Secure logging with auto-redaction
│   │   └── Monitoring/              # Monitoring system (FASE 7)
│   │       ├── Types/               # Monitoring type definitions
│   │       ├── HealthCheck/         # Health check service
│   │       ├── Metrics/             # Metrics collector
│   │       ├── Alerting/            # Alerting service
│   │       └── Diagnostics/         # Diagnostics service
│   │
│   └── TisTis.Agent.Service/        # Windows Service
│       ├── Program.cs               # Entry point
│       └── AgentWorker.cs           # Main worker
│
├── tests/
│   ├── TisTis.Agent.Core.Tests/     # Unit tests
│   └── TisTis.Agent.Integration.Tests/
│
└── TisTis.Agent.SoftRestaurant.sln
```

## Building

> **More Details:** See [DEVELOPMENT.md](docs/DEVELOPMENT.md#building) for advanced build options.

```bash
# Restore packages
dotnet restore

# Build solution
dotnet build

# Run tests (410 unit tests)
dotnet test

# Publish release
dotnet publish src/TisTis.Agent.Service -c Release -o ./publish
```

## Installation

1. Download the installer from the TIS TIS dashboard
2. Run the MSI installer as Administrator
3. The installer will:
   - Detect Soft Restaurant installation
   - Configure the Windows Service
   - Start syncing automatically

## Configuration

> **Complete Guide:** See [CONFIGURATION.md](docs/CONFIGURATION.md) for all options.

Configuration is stored in `appsettings.json`:

```json
{
  "TisTisAgent": {
    "AgentId": "tis-agent-xxxx",
    "Api": {
      "BaseUrl": "https://app.tistis.com"
    },
    "Sync": {
      "IntervalSeconds": 30,
      "SyncSales": true,
      "SyncMenu": true,
      "SyncInventory": true
    }
  }
}
```

For environment-specific configuration, see [Configuration Guide](docs/CONFIGURATION.md#environment-variables).

## Logging

Logs are written to:
- `C:\ProgramData\TisTis\Agent\Logs\agent-YYYYMMDD.log`
- Windows Event Log (warnings and errors)

## Service Management

```powershell
# Start service
Start-Service TisTis.Agent.SoftRestaurant

# Stop service
Stop-Service TisTis.Agent.SoftRestaurant

# Check status
Get-Service TisTis.Agent.SoftRestaurant

# View recent logs
Get-EventLog -LogName Application -Source TisTis.Agent -Newest 20
```

## Security

The agent implements comprehensive security measures (FASE 6):

| Feature | Description |
|---------|-------------|
| **DPAPI Encryption** | Credentials encrypted at machine scope |
| **Constant-Time Comparison** | Prevents timing attacks on token validation |
| **Secure Memory Clearing** | Sensitive data cleared from memory after use |
| **SSL Certificate Pinning** | Validates server certificates against known pins |
| **Automatic Log Redaction** | Sensitive data automatically redacted in logs |
| **Token Rotation** | Proactive token expiration management |

For detailed documentation, see:
- [SECURITY.md](docs/SECURITY.md) - Full security guide
- [SECURITY_QUICK_REFERENCE.md](docs/SECURITY_QUICK_REFERENCE.md) - Developer cheat sheet
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Security layer design

## Monitoring

The agent includes a comprehensive monitoring system (FASE 7):

| Feature | Description |
|---------|-------------|
| **Health Checks** | Monitors Agent, SyncEngine, Database, ApiClient, CredentialStore, Security |
| **Metrics Collection** | Counters, Gauges, Histograms with thread-safe circular buffer |
| **Alerting** | Threshold-based alerts with cooldown and deduplication |
| **Diagnostics** | Comprehensive diagnostic reports with secure redaction |
| **Background Service** | Orchestrator runs periodic checks automatically |

Quick access to monitoring:

```csharp
// Injected via DI
public AgentWorker(IMonitoringOrchestrator? monitoring)
{
    // Record operations
    _monitoring?.RecordSyncOperation(success: true, duration, recordCount: 150);
    _monitoring?.RecordApiCall(success: true, duration, endpoint: "heartbeat");

    // Check health
    var report = await _monitoring?.ForceHealthCheckAsync();

    // Get quick summary
    var summary = _monitoring?.Diagnostics.GetQuickSummary();
}
```

For detailed documentation, see:
- [MONITORING.md](docs/MONITORING.md) - Full monitoring guide
- [MONITORING_QUICK_REFERENCE.md](docs/MONITORING_QUICK_REFERENCE.md) - Developer cheat sheet
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Monitoring layer design

## Troubleshooting

> **Complete Guide:** See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed solutions.

### Quick Diagnostics

| Issue | Quick Check |
|-------|-------------|
| Agent doesn't detect SR database | SQL Server Browser running? Windows Auth enabled? |
| Connection errors | Network to app.tistis.com? Port 443 open? |
| Sync errors | Check logs, verify subscription active |
| Certificate errors | System date correct? TLS 1.2+ enabled? |

### Agent doesn't detect SR database

1. Ensure SQL Server Browser service is running
2. Verify Windows Authentication is enabled
3. Check that the SR database exists (DVSOFT, SOFTRESTAURANT, etc.)

### Connection errors

1. Check network connectivity to app.tistis.com
2. Verify firewall allows outbound HTTPS (port 443)
3. Check credentials haven't expired in TIS TIS dashboard

### Sync errors

1. Check agent logs for detailed error messages
2. Verify TIS TIS subscription is active
3. Ensure database tables match expected SR schema

### Certificate errors

1. Verify system date/time is correct
2. Check if certificate pinning is blocking valid certificates
3. Ensure TLS 1.2+ is enabled on the system
4. Review logs for certificate validation details (thumbprint shown partially)

For more troubleshooting scenarios, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Development

> **Complete Guide:** See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for full developer documentation.
>
> **Testing:** See [TESTING.md](docs/TESTING.md) for test framework and 410 unit tests.

### Running locally

```bash
cd src/TisTis.Agent.Service
dotnet run
```

### Running as console (debug mode)

```bash
dotnet run --environment Development
```

### Running tests

```bash
dotnet test --verbosity normal
```

For debugging, IDE setup, and code style guidelines, see [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Documentation

For complete documentation, see the [Documentation Index](docs/INDEX.md).

### Quick Links

| Document | Description |
|----------|-------------|
| [INDEX](docs/INDEX.md) | Master documentation index |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System design, patterns, data flow |
| [CONFIGURATION](docs/CONFIGURATION.md) | Setup and configuration guide |
| [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) | Problem diagnosis and solutions |

### Technical Reference

| Document | Description |
|----------|-------------|
| [API](docs/API.md) | HTTP client, endpoints, retry policies |
| [SYNC_ENGINE](docs/SYNC_ENGINE.md) | Sync orchestration, state machine |
| [TRANSFORMERS](docs/TRANSFORMERS.md) | Data transformation, mappings |

### Operations

| Document | Description |
|----------|-------------|
| [SECURITY](docs/SECURITY.md) | Security features and best practices |
| [MONITORING](docs/MONITORING.md) | Health checks, metrics, alerting |

### Development

| Document | Description |
|----------|-------------|
| [DEVELOPMENT](docs/DEVELOPMENT.md) | Dev environment, building, debugging |
| [TESTING](docs/TESTING.md) | Test framework, writing tests |
| [CHANGELOG](docs/CHANGELOG.md) | Version history |

---

## License

Copyright (c) 2026 TIS TIS. All rights reserved.
Proprietary software - unauthorized distribution prohibited.

## Support

For support, contact:
- Email: soporte@tistis.com
- Dashboard: app.tistis.com/support
