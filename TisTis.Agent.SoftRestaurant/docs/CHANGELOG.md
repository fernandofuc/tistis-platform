# TIS TIS Agent - Changelog

All notable changes to the TIS TIS Local Agent for Soft Restaurant will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Remote diagnostics via TIS TIS dashboard
- Webhook support for real-time events
- Multi-branch support enhancements
- Performance optimizations for high-volume restaurants

---

## [1.0.0] - 2026-01-30

### Added

#### Core Features
- **Sync Engine** - Automated data synchronization with TIS TIS Platform
  - Incremental sales sync (position-based)
  - Full menu/inventory sync
  - Table status sync
  - Configurable intervals and batch sizes
  - State persistence across restarts

- **Data Transformers** - Convert Soft Restaurant data to TIS TIS format
  - `VentasTransformer` - Sales/orders
  - `ProductosTransformer` - Menu items
  - `InventarioTransformer` - Inventory
  - `MesasTransformer` - Tables
  - Unit and status mapping (Spanish → English)

- **Auto-Detection** - Automatic Soft Restaurant discovery
  - Registry detection
  - SQL Server service detection
  - SQL instance detection
  - Multiple database name support

- **API Client** - Communication with TIS TIS Platform
  - Agent registration
  - Heartbeat reporting
  - Batch data synchronization
  - Retry with exponential backoff (Polly)

#### FASE 6: Security Hardening
- **SecureUtilities** - Cryptographic utilities
  - Constant-time string comparison (timing attack prevention)
  - Secure memory clearing (ClearBytes, ClearChars)
  - Data redaction for logging
  - Hash prefix computation
  - Secure random generation

- **CredentialStore** - Secure credential storage
  - DPAPI encryption (machine scope)
  - Thread-safe file operations
  - Secure deletion (overwrite before delete)
  - File permission hardening

- **TokenManager** - Auth token lifecycle
  - Atomic token updates
  - Proactive expiration monitoring
  - Token rotation support
  - Secure comparison

- **CertificateValidator** - SSL/TLS security
  - Certificate pinning (thumbprint/public key)
  - Key strength validation (RSA 2048+, ECDSA 256+)
  - Chain validation
  - SHA-1 deprecation warnings

- **SecureLogEnricher** - Log security
  - Automatic sensitive data redaction
  - Pattern-based detection
  - Nested structure support

#### FASE 7: Monitoring System
- **HealthCheckService** - Subsystem health monitoring
  - Agent, SyncEngine, Database, ApiClient checks
  - CredentialStore, Security checks
  - Cached results (30s)
  - Recommendations generation

- **MetricsCollector** - Performance metrics
  - Counters, Gauges, Histograms
  - Thread-safe circular buffer (1000 samples)
  - Percentile calculation (P50, P90, P99)
  - Timer scope pattern

- **AlertingService** - Threshold monitoring
  - Configurable thresholds
  - Cooldown and deduplication
  - Event system for new alerts
  - Statistics tracking

- **DiagnosticsService** - Debug information
  - Comprehensive diagnostic reports
  - Log buffer (500 entries)
  - Automatic data redaction
  - Quick summary access

- **MonitoringOrchestrator** - Background coordination
  - Health checks every 30s
  - Alert evaluation every 15s
  - Process metrics every 60s
  - Alert cleanup every 1h

#### Infrastructure
- Windows Service hosting
- Serilog logging (File, Console, EventLog)
- Configuration via appsettings.json
- Environment variable overrides
- WiX MSI installer

#### Testing
- 410 unit tests (100% pass rate)
- xUnit 2.8.1 + FluentAssertions 6.12.0
- Moq 4.20.70 for mocking
- Coverlet for code coverage

#### Documentation
- ARCHITECTURE.md - System architecture
- API.md - API client reference
- CONFIGURATION.md - Configuration guide
- DEVELOPMENT.md - Developer guide
- MONITORING.md - Monitoring system
- SECURITY.md - Security features
- SYNC_ENGINE.md - Sync engine
- TRANSFORMERS.md - Data transformers
- TESTING.md - Testing guide
- TROUBLESHOOTING.md - Problem solving
- INDEX.md - Documentation index

### Security Fixes

| ID | Component | Description |
|----|-----------|-------------|
| SEC-01 | CredentialStore | Secure memory clearing |
| SEC-02 | TokenManager, AgentLogger | Secure logging (no token exposure) |
| SEC-03 | SecureUtilities | Constant-time comparison |
| SEC-04 | CertificateValidator | SSL Certificate pinning |
| SEC-05 | TokenManager | Proactive token expiration |
| SEC-06 | Multiple | IDisposable implementation |
| AUDIT-01 | CertificateValidator | X509Certificate memory leak fix |
| AUDIT-02 | CertificateValidator | Race condition fix |
| AUDIT-03 | SecureUtilities | Null comparison constant-time |
| AUDIT-06 | CertificateValidator | HashSet race condition |
| AUDIT-09 | CertificateValidator | Certificate chain validation |
| AUDIT-10 | CertificateValidator | Key strength validation |

### Quality Fixes

| ID | Component | Description |
|----|-----------|-------------|
| ITER1-A1 | MonitoringOrchestrator | Thread-safe health status |
| ITER1-A2 | MonitoringOrchestrator | Atomic check-and-set |
| ITER1-B1 | MetricsCollector | Histogram lock optimization |
| ITER1-B2 | MetricsCollector | Circular buffer optimization |
| ITER1-C1 | AlertingService | Metrics caching |
| ITER1-D1 | DiagnosticsService | Static pattern allocation |

### Dependencies

| Package | Version |
|---------|---------|
| Microsoft.Data.SqlClient | 5.2.0 |
| Azure.Identity | 1.13.2 |
| Microsoft.Identity.Client | 4.69.1 |
| System.Text.Json | 8.0.5 |
| Serilog | 3.1.1 |
| Polly | 8.4.1 |

---

## Version Numbering

- **MAJOR** - Breaking changes or major features
- **MINOR** - New features, backward compatible
- **PATCH** - Bug fixes, backward compatible

### FASE Versions

| FASE | Focus | Version |
|------|-------|---------|
| FASE 6 | Security Hardening | 1.0.0 |
| FASE 7 | Monitoring System | 1.0.0 |
| FASE 8 | Performance (planned) | 1.1.0 |
| FASE 9 | Documentation | 1.0.0 |

---

*For additional support, contact: soporte@tistis.com*

[Unreleased]: https://github.com/tistis/tistis-platform/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tistis/tistis-platform/releases/tag/v1.0.0
