# TIS TIS Agent - Monitoring System Documentation

## Version: FASE 7 Monitoring Implementation

This document describes the comprehensive monitoring system implemented in the TIS TIS Local Agent for Soft Restaurant. The monitoring system provides health checks, metrics collection, alerting, and diagnostics capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
   - [MonitoringTypes](#monitoringtypes)
   - [HealthCheckService](#healthcheckservice)
   - [MetricsCollector](#metricscollector)
   - [AlertingService](#alertingservice)
   - [DiagnosticsService](#diagnosticsservice)
   - [MonitoringOrchestrator](#monitoringorchestrator)
4. [Integration](#integration)
5. [Configuration](#configuration)
6. [Quality Fixes Reference](#quality-fixes-reference)
7. [Best Practices](#best-practices)
8. [API Reference](#api-reference)

---

## Overview

FASE 7 implements a comprehensive monitoring system for the TIS TIS Agent:

| Feature | Description |
|---------|-------------|
| **Health Checks** | Monitors all subsystems: Agent, SyncEngine, Database, ApiClient, CredentialStore, Security |
| **Metrics Collection** | Counters, Gauges, and Histograms with thread-safe circular buffer |
| **Alerting** | Threshold-based alerts with cooldown and deduplication |
| **Diagnostics** | Comprehensive diagnostic information with secure redaction |
| **Orchestration** | Background service that coordinates all monitoring activities |

---

## Architecture

```
                    +-------------------------+
                    |  MonitoringOrchestrator |
                    |   (BackgroundService)   |
                    +------------+------------+
                                 |
          +----------------------+----------------------+
          |                      |                      |
+---------v--------+  +----------v---------+  +--------v---------+
| HealthCheckService|  | MetricsCollector   |  | AlertingService  |
| (Subsystem checks)|  | (Counters/Gauges)  |  | (Threshold eval) |
+------------------+  +--------------------+  +------------------+
          |                      |                      |
          +----------------------+----------------------+
                                 |
                    +------------v------------+
                    |   DiagnosticsService    |
                    | (Reports & Log buffer)  |
                    +-------------------------+
```

### Data Flow

1. **MonitoringOrchestrator** runs as a BackgroundService
2. Periodically triggers **HealthCheckService** (every 30s)
3. **MetricsCollector** accumulates metrics from all operations
4. **AlertingService** evaluates metrics against thresholds (every 15s)
5. **DiagnosticsService** collects and formats diagnostic reports
6. **AgentWorker** integrates with monitoring via `IMonitoringOrchestrator`

---

## Components

### MonitoringTypes

**File:** `src/TisTis.Agent.Core/Monitoring/Types/MonitoringTypes.cs`

Core type definitions for the monitoring system.

#### Enums

| Enum | Values | Description |
|------|--------|-------------|
| `HealthStatus` | Healthy, Degraded, Unhealthy, Unknown | Overall health status |
| `AlertSeverity` | Info, Warning, Error, Critical | Alert severity levels |
| `MetricType` | Counter, Gauge, Histogram, Rate | Types of metrics |
| `SubsystemType` | Agent, SyncEngine, Database, ApiClient, CredentialStore, Logging, Security | Monitored subsystems |

#### Data Classes

```csharp
// Health check result for a subsystem
public class SubsystemHealthResult
{
    public SubsystemType Subsystem { get; init; }
    public HealthStatus Status { get; init; }
    public string Message { get; init; }
    public TimeSpan CheckDuration { get; init; }
    public DateTime CheckedAt { get; init; }
    public Dictionary<string, object>? Metadata { get; init; }
    public string? ErrorDetails { get; init; }
}

// Complete health report
public class AgentHealthReport
{
    public HealthStatus OverallStatus { get; init; }
    public string Version { get; init; }
    public DateTime GeneratedAt { get; init; }
    public TimeSpan Uptime { get; init; }
    public List<SubsystemHealthResult> Subsystems { get; init; }
    public List<string> Issues { get; init; }
    public string? Recommendation { get; init; }
}

// Monitoring alert
public class MonitoringAlert
{
    public string Id { get; init; }           // 16-char unique ID
    public AlertSeverity Severity { get; init; }
    public SubsystemType Source { get; init; }
    public string Title { get; init; }
    public string Message { get; init; }
    public DateTime RaisedAt { get; init; }
    public string? MetricName { get; init; }
    public double? Threshold { get; init; }
    public double? ActualValue { get; init; }
    public bool Acknowledged { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
}
```

#### Thresholds Configuration

```csharp
public class MonitoringThresholds
{
    public int MaxConsecutiveErrors { get; init; } = 5;
    public int MaxSyncDurationSeconds { get; init; } = 300;
    public int MaxApiResponseTimeMs { get; init; } = 5000;
    public int MaxDbQueryTimeMs { get; init; } = 10000;
    public int MaxMemoryUsageMb { get; init; } = 500;
    public int MinDiskSpaceMb { get; init; } = 100;
    public int MaxTimeSinceLastSyncMinutes { get; init; } = 10;
}
```

---

### HealthCheckService

**File:** `src/TisTis.Agent.Core/Monitoring/HealthCheck/HealthCheckService.cs`

Performs comprehensive health checks on all agent subsystems.

#### Features

- **Subsystem Checks**: Agent, SyncEngine, Database, ApiClient, CredentialStore, Security
- **Caching**: Results cached for 30 seconds to prevent excessive checking
- **Metadata Collection**: Each check collects relevant metrics
- **Recommendation Generation**: Provides actionable recommendations based on status

#### Interface

```csharp
public interface IHealthCheckService
{
    Task<AgentHealthReport> CheckHealthAsync(CancellationToken cancellationToken = default);
    Task<SubsystemHealthResult> CheckSubsystemAsync(SubsystemType subsystem, CancellationToken cancellationToken = default);
    AgentHealthReport? GetLastHealthReport();
    DateTime StartTime { get; }
}
```

#### Subsystem Checks

| Subsystem | Checks Performed |
|-----------|------------------|
| **Agent** | Memory usage, process info, uptime |
| **SyncEngine** | State, consecutive errors, time since last sync |
| **Database** | Connection test, response time |
| **ApiClient** | Ping test, response time |
| **CredentialStore** | Existence check, DPAPI status |
| **Security** | SSL validation status, certificate pinning |

#### Usage

```csharp
var healthReport = await _healthCheckService.CheckHealthAsync(cancellationToken);

if (healthReport.OverallStatus == HealthStatus.Unhealthy)
{
    foreach (var issue in healthReport.Issues)
    {
        _logger.LogWarning("Health issue: {Issue}", issue);
    }
}
```

---

### MetricsCollector

**File:** `src/TisTis.Agent.Core/Monitoring/Metrics/MetricsCollector.cs`

Thread-safe metrics collection with support for counters, gauges, and histograms.

#### Features

- **Thread-Safe**: Uses `ConcurrentDictionary` for all collections
- **Circular Buffer**: Histograms use O(1) circular buffer (1000 samples max)
- **Timer Scope**: Disposable pattern for timing operations
- **Percentile Calculation**: P50, P90, P99 for histograms

#### Interface

```csharp
public interface IMetricsCollector : IDisposable
{
    void IncrementCounter(string name, long value = 1, Dictionary<string, string>? tags = null);
    void RecordGauge(string name, double value, string? unit = null, Dictionary<string, string>? tags = null);
    void RecordHistogram(string name, double value, string? unit = null, Dictionary<string, string>? tags = null);
    IDisposable StartTimer(string metricName, Dictionary<string, string>? tags = null);
    IReadOnlyList<MetricDataPoint> GetMetrics();
    HistogramMetric? GetHistogram(string name);
    IReadOnlyList<HistogramMetric> GetAllHistograms();
    void Reset();
    MetricsSummary GetSummary();
}
```

#### Well-Known Metric Names

```csharp
public static class MetricNames
{
    // Sync metrics
    public const string SyncTotal = "agent.sync.total";
    public const string SyncSuccessful = "agent.sync.successful";
    public const string SyncFailed = "agent.sync.failed";
    public const string SyncDurationMs = "agent.sync.duration_ms";
    public const string RecordsSynced = "agent.sync.records_synced";

    // API metrics
    public const string ApiRequestsTotal = "agent.api.requests_total";
    public const string ApiRequestDurationMs = "agent.api.request_duration_ms";
    public const string ApiErrors = "agent.api.errors";

    // Database metrics
    public const string DbQueriesTotal = "agent.db.queries_total";
    public const string DbQueryDurationMs = "agent.db.query_duration_ms";
    public const string DbErrors = "agent.db.errors";

    // Heartbeat metrics
    public const string HeartbeatsTotal = "agent.heartbeat.total";
    public const string HeartbeatDurationMs = "agent.heartbeat.duration_ms";

    // Process metrics
    public const string MemoryUsageMb = "agent.process.memory_mb";
    public const string ThreadCount = "agent.process.thread_count";
    public const string UptimeSeconds = "agent.process.uptime_seconds";

    // Error metrics
    public const string ErrorsTotal = "agent.errors.total";
    public const string ConsecutiveErrors = "agent.errors.consecutive";
}
```

#### Usage

```csharp
// Counter
_metrics.IncrementCounter(MetricNames.SyncTotal);

// Gauge
_metrics.RecordGauge(MetricNames.MemoryUsageMb, 256.5, "MB");

// Histogram
_metrics.RecordHistogram(MetricNames.SyncDurationMs, 1500, "ms");

// Timer (automatically records to histogram)
using (_metrics.StartTimer("agent.operation.duration"))
{
    await PerformOperation();
}

// Get histogram stats
var syncStats = _metrics.GetHistogram(MetricNames.SyncDurationMs);
if (syncStats != null)
{
    _logger.LogInformation(
        "Sync P99: {P99}ms, Mean: {Mean}ms",
        syncStats.P99,
        syncStats.Mean);
}
```

#### Circular Buffer Implementation

The histogram uses an optimized circular buffer:

```csharp
// O(1) add operation
// Fixed 1000 sample buffer
// Thread-safe with dedicated lock
// No memory allocation on add
```

---

### AlertingService

**File:** `src/TisTis.Agent.Core/Monitoring/Alerting/AlertingService.cs`

Evaluates metrics against thresholds and generates alerts with deduplication.

#### Features

- **Threshold Evaluation**: Checks all configured thresholds
- **Cooldown Period**: 5-minute cooldown prevents alert spam
- **Deduplication**: Same alert type won't fire during cooldown
- **Event System**: Raises events for new alerts and acknowledgments
- **Statistics**: Provides alert statistics summary

#### Interface

```csharp
public interface IAlertingService : IDisposable
{
    Task<IReadOnlyList<MonitoringAlert>> EvaluateAsync(CancellationToken cancellationToken = default);
    IReadOnlyList<MonitoringAlert> GetActiveAlerts();
    IReadOnlyList<MonitoringAlert> GetAllAlerts();
    bool AcknowledgeAlert(string alertId);
    int ClearOldAlerts(TimeSpan maxAge);
    MonitoringAlert RaiseAlert(AlertSeverity severity, SubsystemType source, string title, string message, ...);
    AlertStatistics GetStatistics();
    event EventHandler<AlertEventArgs>? AlertRaised;
    event EventHandler<AlertEventArgs>? AlertAcknowledged;
}
```

#### Evaluated Thresholds

| Threshold | Warning Level | Critical Level |
|-----------|---------------|----------------|
| Consecutive Errors | >= MaxErrors/2 | >= MaxErrors |
| Sync Duration | P90 > MaxSyncDuration | P99 > MaxSyncDuration*2 |
| API Response Time | P90 > MaxApiTime | P99 > MaxApiTime*2 |
| DB Query Time | P90 > MaxDbTime | P99 > MaxDbTime*2 |
| Memory Usage | >= MaxMemory | >= MaxMemory*1.5 |
| Time Since Sync | >= MaxTimeSinceSync | >= MaxTimeSinceSync*2 |

#### Usage

```csharp
// Subscribe to alert events
_alerting.AlertRaised += (sender, args) =>
{
    _logger.LogWarning("Alert: {Title}", args.Alert.Title);
};

// Evaluate thresholds
var newAlerts = await _alerting.EvaluateAsync(cancellationToken);

// Acknowledge alert
_alerting.AcknowledgeAlert(alertId);

// Get statistics
var stats = _alerting.GetStatistics();
_logger.LogInformation(
    "Alerts - Active: {Active}, Critical: {Critical}",
    stats.ActiveAlerts,
    stats.CriticalAlerts);

// Programmatic alert
_alerting.RaiseAlert(
    AlertSeverity.Warning,
    SubsystemType.SyncEngine,
    "Custom Alert",
    "Something needs attention");
```

---

### DiagnosticsService

**File:** `src/TisTis.Agent.Core/Monitoring/Diagnostics/DiagnosticsService.cs`

Collects comprehensive diagnostic information with secure data redaction.

#### Features

- **Diagnostic Collection**: Process info, health status, metrics, recent logs
- **Report Generation**: Formatted text report for troubleshooting
- **Log Buffer**: Circular buffer (500 entries) with automatic redaction
- **Secure Redaction**: Sensitive data automatically redacted

#### Interface

```csharp
public interface IDiagnosticsService : IDisposable
{
    Task<DiagnosticInfo> CollectDiagnosticsAsync(CancellationToken cancellationToken = default);
    Task<string> GenerateReportAsync(CancellationToken cancellationToken = default);
    DiagnosticQuickSummary GetQuickSummary();
    IReadOnlyList<string> GetRecentLogs(int maxEntries = 50);
    void AddLogEntry(string entry);
}
```

#### Redacted Configuration Keys

| Pattern | Redaction Type |
|---------|----------------|
| AuthToken, Token, Password, Secret | Full redaction |
| ApiKey, ConnectionString, Key | Full redaction |
| Credential, Certificate, PrivateKey | Full redaction |
| AgentId, TenantId, BranchId | Partial (first/last chars) |
| URLs | Scheme + host only |

#### Redacted Log Patterns

```csharp
// Automatically redacted in logs:
"Bearer " -> "Bearer [REDACTED]"
"Authorization:" -> "Authorization: [REDACTED]"
"auth_token=" -> "auth_token=[REDACTED]"
"access_token=" -> "access_token=[REDACTED]"
"password=" -> "password=[REDACTED]"
"secret=" -> "secret=[REDACTED]"
"api_key=" -> "api_key=[REDACTED]"
```

#### Usage

```csharp
// Quick summary
var summary = _diagnostics.GetQuickSummary();
_logger.LogInformation(
    "Health: {Health}, Uptime: {Uptime}",
    summary.HealthStatus,
    summary.Uptime);

// Full diagnostic report
var report = await _diagnostics.GenerateReportAsync(cancellationToken);
File.WriteAllText("diagnostic-report.txt", report);

// Add log entry (auto-redacted)
_diagnostics.AddLogEntry("Processing token: Bearer xyz123...");
// Stored as: "[12:30:45.123] Processing token: Bearer [REDACTED]"
```

#### Sample Diagnostic Report

```
================================================================
        TIS TIS AGENT - DIAGNOSTIC REPORT
================================================================

Generated At:      2026-01-30 14:30:00 UTC
Agent Version:     1.0.0
Machine Name:      SERVER01
OS Version:        Microsoft Windows NT 10.0.19045.0
Process ID:        12345

--- HEALTH SUMMARY ---
Overall Status:    Healthy
Uptime:            02:30:15.234

--- SUBSYSTEM STATUS ---
  Agent           Healthy    (5ms)
  SyncEngine      Healthy    (2ms)
  Database        Healthy    (45ms)
  ApiClient       Healthy    (120ms)
  CredentialStore Healthy    (1ms)
  Security        Healthy    (0ms)

--- RESOURCE USAGE ---
Memory (Working Set): 156.2 MB
Thread Count:         24
Process Start:        2026-01-30 12:00:00 UTC

--- SYNC STATUS ---
Sync Engine State:    Running
Last Successful Sync: 2026-01-30 14:29:55 UTC
Consecutive Errors:   0

--- ALERT STATISTICS ---
Total Alerts:     5
Active Alerts:    0
Critical:         0
Errors:           1
Warnings:         4
Last Alert:       2026-01-30 13:15:00 UTC

--- METRICS SUMMARY ---
Collection Period:  02:30:15.234
Total Metrics:      25
  Counters:         10
  Gauges:           8
  Histograms:       7

Key Metrics:
  agent.sync.total: 150.00
  agent.sync.successful: 148.00
  agent.sync.failed: 2.00
  agent.sync.duration_ms.mean: 1234.56
  agent.sync.duration_ms.p99: 3500.00

--- CONFIGURATION (REDACTED) ---
  AgentId: tis-***[20 chars]***xxxx
  TenantId: ten-***[16 chars]***yyyy
  Version: 1.0.0
  ServerUrl: https://app.tistis.com/*
  AuthToken: [SET - Hash: a1b2c3d4e5f6g7h8]

================================================================
                    END OF REPORT
================================================================
```

---

### MonitoringOrchestrator

**File:** `src/TisTis.Agent.Core/Monitoring/MonitoringOrchestrator.cs`

Coordinates all monitoring services as a background hosted service.

#### Features

- **BackgroundService**: Runs continuously in the background
- **Periodic Checks**: Health (30s), Alerts (15s), Metrics (60s), Cleanup (1h)
- **Convenience Methods**: Record sync, API, and DB operations
- **Health Status Events**: Notifies on status changes
- **Proper Disposal**: Handles cleanup of all services

#### Interface

```csharp
public interface IMonitoringOrchestrator : IHostedService, IDisposable
{
    HealthStatus CurrentHealthStatus { get; }
    IHealthCheckService HealthChecks { get; }
    IMetricsCollector Metrics { get; }
    IAlertingService Alerts { get; }
    IDiagnosticsService Diagnostics { get; }

    Task<AgentHealthReport> ForceHealthCheckAsync(CancellationToken cancellationToken = default);
    void RecordSyncOperation(bool success, TimeSpan duration, int recordCount = 0);
    void RecordApiCall(bool success, TimeSpan duration, string? endpoint = null);
    void RecordDbQuery(bool success, TimeSpan duration, string? queryType = null);
    void UpdateConsecutiveErrors(int count);
    void RecordLastSuccessfulSync();

    event EventHandler<HealthStatusChangedEventArgs>? HealthStatusChanged;
}
```

#### Timing Configuration

| Operation | Interval |
|-----------|----------|
| Health Check | 30 seconds |
| Alert Evaluation | 15 seconds |
| Process Metrics | 60 seconds |
| Alert Cleanup | 1 hour |
| Max Alert Age | 7 days |

#### Usage

```csharp
// Access via DI
public class AgentWorker
{
    private readonly IMonitoringOrchestrator? _monitoring;

    // Record operations
    _monitoring?.RecordSyncOperation(success: true, duration, recordCount: 150);
    _monitoring?.RecordApiCall(success: true, duration, endpoint: "register");
    _monitoring?.RecordDbQuery(success: true, duration, queryType: "SELECT");

    // Update error state
    _monitoring?.UpdateConsecutiveErrors(consecutiveErrors);

    // Record successful sync
    _monitoring?.RecordLastSuccessfulSync();

    // Force health check
    var report = await _monitoring?.ForceHealthCheckAsync(cancellationToken);

    // Subscribe to health changes
    _monitoring.HealthStatusChanged += (sender, args) =>
    {
        _logger.LogWarning(
            "Health changed: {Old} -> {New} ({Reason})",
            args.PreviousStatus,
            args.NewStatus,
            args.Reason);
    };
}
```

---

## Integration

### DI Registration

**File:** `src/TisTis.Agent.Core/Monitoring/MonitoringServiceExtensions.cs`

```csharp
// In Program.cs
builder.Services.AddTisTisMonitoring(thresholds =>
{
    // Optional: customize thresholds
    thresholds.MaxConsecutiveErrors = 10;
    thresholds.MaxMemoryUsageMb = 1024;
});
```

### Service Registration Order

```csharp
// 1. MonitoringThresholds (singleton)
// 2. IMetricsCollector -> MetricsCollector (singleton)
// 3. IHealthCheckService -> HealthCheckService (singleton)
// 4. IAlertingService -> AlertingService (singleton)
// 5. IDiagnosticsService -> DiagnosticsService (singleton)
// 6. IMonitoringOrchestrator -> MonitoringOrchestrator (singleton)
// 7. MonitoringOrchestrator as IHostedService (background service)
```

### Minimal Registration

For testing or lightweight deployments:

```csharp
builder.Services.AddTisTisMonitoringMinimal();
// Only registers: MonitoringThresholds, IMetricsCollector
```

### AgentWorker Integration

```csharp
// In AgentWorker.cs
public AgentWorker(..., IMonitoringOrchestrator? monitoring = null)
{
    _monitoring = monitoring;
}

protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    // Log monitoring status
    if (_monitoring != null)
    {
        _logger.LogInformation("Monitoring system active: Health={Health}",
            _monitoring.CurrentHealthStatus);
    }

    // Record operations throughout the worker lifecycle
    var stopwatch = Stopwatch.StartNew();
    var response = await _apiClient.RegisterAsync(request, cancellationToken);
    stopwatch.Stop();
    _monitoring?.RecordApiCall(response.Success, stopwatch.Elapsed, "register");
}

public override async Task StopAsync(CancellationToken cancellationToken)
{
    // Log final diagnostics
    if (_monitoring != null)
    {
        var summary = _monitoring.Diagnostics.GetQuickSummary();
        _logger.LogInformation(
            "Final diagnostics - Uptime: {Uptime}, Health: {Health}",
            summary.Uptime,
            summary.HealthStatus);
    }
}
```

---

## Configuration

### appsettings.json

```json
{
  "TisTisAgent": {
    "Monitoring": {
      "Thresholds": {
        "MaxConsecutiveErrors": 5,
        "MaxSyncDurationSeconds": 300,
        "MaxApiResponseTimeMs": 5000,
        "MaxDbQueryTimeMs": 10000,
        "MaxMemoryUsageMb": 500,
        "MinDiskSpaceMb": 100,
        "MaxTimeSinceLastSyncMinutes": 10
      }
    }
  }
}
```

### Threshold Descriptions

| Threshold | Default | Description |
|-----------|---------|-------------|
| `MaxConsecutiveErrors` | 5 | Critical alert when reached |
| `MaxSyncDurationSeconds` | 300 | Warning at P90, Critical at P99*2 |
| `MaxApiResponseTimeMs` | 5000 | Warning at P90, Critical at P99*2 |
| `MaxDbQueryTimeMs` | 10000 | Warning at P90, Critical at P99*2 |
| `MaxMemoryUsageMb` | 500 | Warning at threshold, Critical at 150% |
| `MinDiskSpaceMb` | 100 | Reserved for future use |
| `MaxTimeSinceLastSyncMinutes` | 10 | Warning at threshold, Critical at 2x |

---

## Quality Fixes Reference

### Fix Categories

| Category | ID Range | Description |
|----------|----------|-------------|
| ITER1-A | 1-6 | MonitoringOrchestrator fixes |
| ITER1-B | 1-3 | MetricsCollector fixes |
| ITER1-C | 1-5 | AlertingService fixes |
| ITER1-D | 1-3 | DiagnosticsService fixes |

### Complete Fix List

| Fix ID | Component | Description |
|--------|-----------|-------------|
| ITER1-A1 | MonitoringOrchestrator | Use dedicated lock for thread-safe health status |
| ITER1-A2 | MonitoringOrchestrator | Thread-safe health status with atomic check-and-set |
| ITER1-A3 | MonitoringOrchestrator | Added disposal check to event handlers |
| ITER1-A4 | MonitoringOrchestrator | Safe event invocation with copied delegate |
| ITER1-A5 | MonitoringOrchestrator | Proper dispose pattern for BackgroundService |
| ITER1-A6 | MonitoringOrchestrator | Null-safe event unsubscription |
| ITER1-B1 | MetricsCollector | Dedicated lock object for histogram values |
| ITER1-B2 | MetricsCollector | Optimized circular buffer via AddValue method |
| ITER1-B3 | MetricsCollector | Use GetValuesCopy to minimize lock duration |
| ITER1-C1 | AlertingService | Cache metrics once per evaluation |
| ITER1-C2 | AlertingService | Accept cached metrics in EvaluateConsecutiveErrors |
| ITER1-C3 | AlertingService | Accept cached metrics in EvaluateMemoryUsage |
| ITER1-C4 | AlertingService | Accept cached metrics in EvaluateTimeSinceLastSync |
| ITER1-C5 | AlertingService | Safe event invocation with copied delegate |
| ITER1-D1 | DiagnosticsService | Static patterns to avoid allocation |
| ITER1-D2 | DiagnosticsService | Static array for value delimiters |
| ITER1-D3 | DiagnosticsService | Use static patterns in RedactLogEntry |

---

## Best Practices

### DO

1. **Always use the `IMonitoringOrchestrator`** for recording operations
2. **Check for null** when monitoring is optional dependency
3. **Use `Stopwatch`** for accurate timing measurements
4. **Subscribe to `HealthStatusChanged`** for reactive monitoring
5. **Include endpoint/query type tags** for better metric granularity
6. **Call `RecordLastSuccessfulSync()`** after each successful sync
7. **Use `GetQuickSummary()`** for fast status checks

### DON'T

1. **Don't call `EvaluateAsync()` manually** - orchestrator handles this
2. **Don't dispose services individually** - orchestrator manages lifecycle
3. **Don't log sensitive data** - DiagnosticsService auto-redacts
4. **Don't ignore health status changes** - they indicate real issues
5. **Don't set thresholds too low** - causes alert fatigue
6. **Don't skip recording failed operations** - they're critical for alerting

### Code Examples

#### Recording Operations

```csharp
// GOOD - includes timing and endpoint
var sw = Stopwatch.StartNew();
var result = await _api.CallEndpoint();
sw.Stop();
_monitoring?.RecordApiCall(result.Success, sw.Elapsed, "endpoint_name");

// BAD - no timing or context
_monitoring?.RecordApiCall(true, TimeSpan.Zero, null);
```

#### Handling Optional Monitoring

```csharp
// GOOD - null-safe access
_monitoring?.RecordSyncOperation(success, duration, count);

// ALSO GOOD - explicit check with logging
if (_monitoring != null)
{
    _monitoring.RecordSyncOperation(success, duration, count);
}
else
{
    _logger.LogDebug("Monitoring not available, skipping metrics");
}
```

#### Shutdown Diagnostics

```csharp
// GOOD - capture final state
public override async Task StopAsync(CancellationToken ct)
{
    try
    {
        var summary = _monitoring?.Diagnostics.GetQuickSummary();
        if (summary != null)
        {
            _logger.LogInformation("Final state: {Summary}", summary);
        }
    }
    catch (Exception ex)
    {
        _logger.LogDebug(ex, "Failed to collect final diagnostics");
    }

    await base.StopAsync(ct);
}
```

---

## API Reference

### Quick Reference

| Service | Method | Description |
|---------|--------|-------------|
| `IMonitoringOrchestrator` | `RecordSyncOperation()` | Record sync metrics |
| `IMonitoringOrchestrator` | `RecordApiCall()` | Record API call metrics |
| `IMonitoringOrchestrator` | `RecordDbQuery()` | Record database query metrics |
| `IMonitoringOrchestrator` | `UpdateConsecutiveErrors()` | Update error gauge |
| `IMonitoringOrchestrator` | `RecordLastSuccessfulSync()` | Update last sync timestamp |
| `IMonitoringOrchestrator` | `ForceHealthCheckAsync()` | Trigger immediate health check |
| `IHealthCheckService` | `CheckHealthAsync()` | Get full health report |
| `IHealthCheckService` | `GetLastHealthReport()` | Get cached report |
| `IMetricsCollector` | `IncrementCounter()` | Increment a counter metric |
| `IMetricsCollector` | `RecordGauge()` | Record a gauge value |
| `IMetricsCollector` | `RecordHistogram()` | Record a histogram value |
| `IMetricsCollector` | `StartTimer()` | Start a timing scope |
| `IMetricsCollector` | `GetSummary()` | Get metrics summary |
| `IAlertingService` | `EvaluateAsync()` | Evaluate all thresholds |
| `IAlertingService` | `GetActiveAlerts()` | Get unacknowledged alerts |
| `IAlertingService` | `AcknowledgeAlert()` | Acknowledge an alert |
| `IAlertingService` | `RaiseAlert()` | Raise a custom alert |
| `IDiagnosticsService` | `GetQuickSummary()` | Get quick status summary |
| `IDiagnosticsService` | `GenerateReportAsync()` | Generate full text report |
| `IDiagnosticsService` | `AddLogEntry()` | Add entry to log buffer |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| FASE 7 | 2026-01-30 | Initial monitoring system release |

---

*For additional support, contact: soporte@tistis.com*
