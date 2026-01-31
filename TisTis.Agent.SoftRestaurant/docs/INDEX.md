# TIS TIS Agent - Documentation Index

## Version: 1.0.0 | Updated: 2026-01-30

Welcome to the TIS TIS Local Agent documentation. This index provides quick access to all available documentation.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [README](../README.md) | Project overview and quick start |
| [ARCHITECTURE](ARCHITECTURE.md) | System design and components |
| [CONFIGURATION](CONFIGURATION.md) | Configuration guide |
| [TROUBLESHOOTING](TROUBLESHOOTING.md) | Problem solving guide |

---

## Documentation Map

### Getting Started

| Document | Purpose | Audience |
|----------|---------|----------|
| [README](../README.md) | Overview, features, quick start | All |
| [CONFIGURATION](CONFIGURATION.md) | Setup and configuration | Admins, Developers |
| [TROUBLESHOOTING](TROUBLESHOOTING.md) | Problem diagnosis | Support, Admins |

### Technical Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [ARCHITECTURE](ARCHITECTURE.md) | System design, patterns, data flow | Developers, Architects |
| [API](API.md) | API client, endpoints, models | Developers |
| [SYNC_ENGINE](SYNC_ENGINE.md) | Sync logic, state machine | Developers |
| [TRANSFORMERS](TRANSFORMERS.md) | Data transformation, mappings | Developers |

### Operations

| Document | Purpose | Audience |
|----------|---------|----------|
| [SECURITY](SECURITY.md) | Security features, best practices | Security, Admins |
| [MONITORING](MONITORING.md) | Health checks, metrics, alerting | DevOps, Admins |

### Development

| Document | Purpose | Audience |
|----------|---------|----------|
| [DEVELOPMENT](DEVELOPMENT.md) | Dev environment, building, debugging | Developers |
| [TESTING](TESTING.md) | Test framework, writing tests | Developers, QA |
| [CHANGELOG](CHANGELOG.md) | Version history, changes | All |

### Quick Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [SECURITY_QUICK_REFERENCE](SECURITY_QUICK_REFERENCE.md) | Security cheat sheet | Developers |
| [MONITORING_QUICK_REFERENCE](MONITORING_QUICK_REFERENCE.md) | Monitoring cheat sheet | DevOps |
| [Installer README](../installer/README.md) | Installer build guide | DevOps |

---

## By Topic

### Configuration & Setup

- [Configuration Guide](CONFIGURATION.md) - All configuration options
- [API Options](CONFIGURATION.md#api-options) - API connection settings
- [Sync Options](CONFIGURATION.md#sync-options) - Sync behavior settings
- [Security Options](CONFIGURATION.md#security-options) - Security settings
- [Logging Options](CONFIGURATION.md#logging-options) - Log settings
- [Environment Variables](CONFIGURATION.md#environment-variables) - Runtime overrides

### Security

- [Security Overview](SECURITY.md) - All security features
- [SecureUtilities](SECURITY.md#secureutilities) - Cryptographic helpers
- [CredentialStore](SECURITY.md#credentialstore) - DPAPI credential storage
- [TokenManager](SECURITY.md#tokenmanager) - Token lifecycle
- [CertificateValidator](SECURITY.md#certificatevalidator) - SSL pinning
- [SecureLogEnricher](SECURITY.md#securelogenricher) - Log redaction
- [Security Fixes](SECURITY.md#security-fixes-reference) - All security fixes

### Monitoring

- [Monitoring Overview](MONITORING.md) - All monitoring features
- [Health Checks](MONITORING.md#healthcheckservice) - Subsystem health
- [Metrics](MONITORING.md#metricscollector) - Performance metrics
- [Alerting](MONITORING.md#alertingservice) - Threshold alerts
- [Diagnostics](MONITORING.md#diagnosticsservice) - Debug reports
- [Orchestrator](MONITORING.md#monitoringorchestrator) - Background service

### Synchronization

- [Sync Engine](SYNC_ENGINE.md) - Sync orchestration
- [State Machine](SYNC_ENGINE.md#state-machine) - Engine states
- [Incremental Sync](SYNC_ENGINE.md#incremental-sync) - Position-based sync
- [Data Transformers](TRANSFORMERS.md) - Data conversion
- [VentasTransformer](TRANSFORMERS.md#ventastransformer) - Sales mapping
- [ProductosTransformer](TRANSFORMERS.md#productostransformer) - Products mapping
- [InventarioTransformer](TRANSFORMERS.md#inventariotransformer) - Inventory mapping
- [MesasTransformer](TRANSFORMERS.md#mesastransformer) - Tables mapping

### API

- [API Client](API.md) - HTTP client
- [Endpoints](API.md#api-endpoints) - Available endpoints
- [Request/Response Models](API.md#requestresponse-models) - Data models
- [Error Handling](API.md#error-handling) - Error codes
- [Retry Policy](API.md#retry-policy) - Polly configuration

### Troubleshooting

- [Quick Diagnostics](TROUBLESHOOTING.md#quick-diagnostics) - First steps
- [Installation Issues](TROUBLESHOOTING.md#installation-issues) - Install problems
- [Detection Issues](TROUBLESHOOTING.md#detection-issues) - SR not found
- [Connection Issues](TROUBLESHOOTING.md#connection-issues) - Network problems
- [Sync Issues](TROUBLESHOOTING.md#sync-issues) - Data not syncing
- [Security Issues](TROUBLESHOOTING.md#security-issues) - Auth problems
- [Performance Issues](TROUBLESHOOTING.md#performance-issues) - Slow operations
- [Log Analysis](TROUBLESHOOTING.md#log-analysis) - Reading logs
- [Error Codes](TROUBLESHOOTING.md#common-error-codes) - Error reference

### Development

- [Getting Started](DEVELOPMENT.md#getting-started) - Setup dev environment
- [Building](DEVELOPMENT.md#building) - Compile the project
- [Running Locally](DEVELOPMENT.md#running-locally) - Debug locally
- [Code Style](DEVELOPMENT.md#code-style) - Coding conventions
- [Contributing](DEVELOPMENT.md#contributing) - PR process

### Testing

- [Test Framework](TESTING.md#testing-framework) - xUnit, FluentAssertions
- [Test Categories](TESTING.md#test-categories) - Test types
- [Running Tests](TESTING.md#running-tests) - Test execution
- [Writing Tests](TESTING.md#writing-tests) - Test patterns
- [Best Practices](TESTING.md#best-practices) - Testing guidelines

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| README | Current | 2026-01-30 |
| ARCHITECTURE | Current | 2026-01-30 |
| API | Current | 2026-01-30 |
| CONFIGURATION | Current | 2026-01-30 |
| DEVELOPMENT | Current | 2026-01-30 |
| SECURITY | Current | 2026-01-30 |
| SECURITY_QUICK_REFERENCE | Current | 2026-01-30 |
| MONITORING | Current | 2026-01-30 |
| MONITORING_QUICK_REFERENCE | Current | 2026-01-30 |
| SYNC_ENGINE | Current | 2026-01-30 |
| TRANSFORMERS | Current | 2026-01-30 |
| TESTING | Current | 2026-01-30 |
| TROUBLESHOOTING | Current | 2026-01-30 |
| CHANGELOG | Current | 2026-01-30 |
| Installer README | Current | 2026-01-30 |

---

## External Resources

- **TIS TIS Dashboard:** [app.tistis.com](https://app.tistis.com)
- **Support:** soporte@tistis.com
- **Soft Restaurant:** [softrestaurant.com.mx](https://www.softrestaurant.com.mx)
- **.NET 8.0 Runtime:** [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0)

---

## Feedback

Found an issue with the documentation? Contact us:
- **Email:** soporte@tistis.com
- **Dashboard:** app.tistis.com/support

---

*TIS TIS Platform - 2026*
