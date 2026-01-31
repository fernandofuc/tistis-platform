# TIS TIS Agent - Monitoring Quick Reference

## FASE 7 - Monitoring System Cheat Sheet

Quick reference for developers implementing monitoring in the TIS TIS Agent.

---

## DI Registration

```csharp
// Program.cs - Full monitoring
builder.Services.AddTisTisMonitoring(thresholds =>
{
    thresholds.MaxConsecutiveErrors = 5;
    thresholds.MaxMemoryUsageMb = 500;
});

// Minimal (metrics only)
builder.Services.AddTisTisMonitoringMinimal();
```

---

## IMonitoringOrchestrator

Main entry point for all monitoring operations.

```csharp
public class MyService
{
    private readonly IMonitoringOrchestrator? _monitoring;

    public MyService(IMonitoringOrchestrator? monitoring = null)
    {
        _monitoring = monitoring;
    }

    public async Task DoWork()
    {
        // Record sync operation
        var sw = Stopwatch.StartNew();
        var records = await SyncData();
        sw.Stop();
        _monitoring?.RecordSyncOperation(success: true, sw.Elapsed, records.Count);

        // Record API call
        var apiSw = Stopwatch.StartNew();
        var response = await _api.Call();
        apiSw.Stop();
        _monitoring?.RecordApiCall(response.Success, apiSw.Elapsed, "endpoint");

        // Record DB query
        var dbSw = Stopwatch.StartNew();
        var data = await _db.Query();
        dbSw.Stop();
        _monitoring?.RecordDbQuery(success: true, dbSw.Elapsed, "SELECT");

        // Update errors
        _monitoring?.UpdateConsecutiveErrors(errorCount);

        // Mark successful sync
        _monitoring?.RecordLastSuccessfulSync();

        // Force health check
        var report = await _monitoring?.ForceHealthCheckAsync();

        // Get current health
        var status = _monitoring?.CurrentHealthStatus;
    }
}
```

---

## Health Status Events

```csharp
_monitoring.HealthStatusChanged += (sender, args) =>
{
    Console.WriteLine($"Health: {args.PreviousStatus} -> {args.NewStatus}");
    Console.WriteLine($"Reason: {args.Reason}");
};
```

---

## Metrics Collection

### Counters (only increment)

```csharp
_monitoring.Metrics.IncrementCounter("my.counter");
_monitoring.Metrics.IncrementCounter("my.counter", value: 5);
_monitoring.Metrics.IncrementCounter("my.counter", tags: new() { ["type"] = "A" });
```

### Gauges (current value)

```csharp
_monitoring.Metrics.RecordGauge("my.gauge", 42.5);
_monitoring.Metrics.RecordGauge("my.gauge", 42.5, "MB");
```

### Histograms (distribution)

```csharp
_monitoring.Metrics.RecordHistogram("my.duration", 150.5, "ms");

// Or use timer
using (_monitoring.Metrics.StartTimer("my.operation"))
{
    await DoOperation();
} // Automatically records duration
```

### Built-in Metric Names

```csharp
using static TisTis.Agent.Core.Monitoring.Metrics.MetricsCollector.MetricNames;

_monitoring.Metrics.IncrementCounter(SyncTotal);
_monitoring.Metrics.IncrementCounter(SyncSuccessful);
_monitoring.Metrics.IncrementCounter(SyncFailed);
_monitoring.Metrics.RecordHistogram(SyncDurationMs, duration, "ms");
_monitoring.Metrics.IncrementCounter(ApiRequestsTotal);
_monitoring.Metrics.IncrementCounter(ApiErrors);
_monitoring.Metrics.RecordHistogram(ApiRequestDurationMs, duration, "ms");
_monitoring.Metrics.IncrementCounter(DbQueriesTotal);
_monitoring.Metrics.RecordHistogram(DbQueryDurationMs, duration, "ms");
_monitoring.Metrics.RecordGauge(MemoryUsageMb, memoryMb, "MB");
_monitoring.Metrics.RecordGauge(ConsecutiveErrors, errors);
```

### Get Metrics

```csharp
// All metrics
var metrics = _monitoring.Metrics.GetMetrics();

// Specific histogram
var histogram = _monitoring.Metrics.GetHistogram("my.duration");
Console.WriteLine($"P99: {histogram?.P99}ms, Mean: {histogram?.Mean}ms");

// Summary
var summary = _monitoring.Metrics.GetSummary();
Console.WriteLine($"Total metrics: {summary.TotalMetrics}");
```

---

## Alerting

### Get Alerts

```csharp
var activeAlerts = _monitoring.Alerts.GetActiveAlerts();
var allAlerts = _monitoring.Alerts.GetAllAlerts();
```

### Acknowledge Alert

```csharp
_monitoring.Alerts.AcknowledgeAlert(alertId);
```

### Raise Custom Alert

```csharp
_monitoring.Alerts.RaiseAlert(
    AlertSeverity.Warning,
    SubsystemType.SyncEngine,
    "Custom Alert",
    "Something needs attention");
```

### Alert Events

```csharp
_monitoring.Alerts.AlertRaised += (sender, args) =>
{
    var alert = args.Alert;
    Console.WriteLine($"[{alert.Severity}] {alert.Title}: {alert.Message}");
};

_monitoring.Alerts.AlertAcknowledged += (sender, args) =>
{
    Console.WriteLine($"Acknowledged: {args.Alert.Title}");
};
```

### Statistics

```csharp
var stats = _monitoring.Alerts.GetStatistics();
Console.WriteLine($"Active: {stats.ActiveAlerts}, Critical: {stats.CriticalAlerts}");
```

---

## Health Checks

### Full Report

```csharp
var report = await _monitoring.HealthChecks.CheckHealthAsync();

Console.WriteLine($"Status: {report.OverallStatus}");
Console.WriteLine($"Uptime: {report.Uptime}");

foreach (var subsystem in report.Subsystems)
{
    Console.WriteLine($"  {subsystem.Subsystem}: {subsystem.Status}");
}

foreach (var issue in report.Issues)
{
    Console.WriteLine($"  Issue: {issue}");
}
```

### Cached Report

```csharp
var cached = _monitoring.HealthChecks.GetLastHealthReport();
```

### Single Subsystem

```csharp
var dbHealth = await _monitoring.HealthChecks.CheckSubsystemAsync(SubsystemType.Database);
```

---

## Diagnostics

### Quick Summary

```csharp
var summary = _monitoring.Diagnostics.GetQuickSummary();
Console.WriteLine($"Health: {summary.HealthStatus}");
Console.WriteLine($"Uptime: {summary.Uptime}");
Console.WriteLine($"Memory: {summary.MemoryUsageMb}MB");
Console.WriteLine($"Alerts: {summary.ActiveAlerts}");
Console.WriteLine($"Errors: {summary.ConsecutiveErrors}");
```

### Full Diagnostic Info

```csharp
var diagnostics = await _monitoring.Diagnostics.CollectDiagnosticsAsync();
```

### Text Report

```csharp
var report = await _monitoring.Diagnostics.GenerateReportAsync();
File.WriteAllText("diagnostics.txt", report);
```

### Log Buffer

```csharp
// Add entry (auto-redacted)
_monitoring.Diagnostics.AddLogEntry("Processing request...");

// Get recent logs
var logs = _monitoring.Diagnostics.GetRecentLogs(maxEntries: 50);
```

---

## Thresholds

| Threshold | Default | Warning | Critical |
|-----------|---------|---------|----------|
| ConsecutiveErrors | 5 | >= 2-3 | >= 5 |
| SyncDuration | 300s | P90 > threshold | P99 > 2x |
| ApiResponseTime | 5000ms | P90 > threshold | P99 > 2x |
| DbQueryTime | 10000ms | P90 > threshold | P99 > 2x |
| MemoryUsage | 500MB | >= threshold | >= 150% |
| TimeSinceSync | 10min | >= threshold | >= 2x |

---

## Health Statuses

| Status | Description |
|--------|-------------|
| `Healthy` | All systems operational |
| `Degraded` | Some issues, but functional |
| `Unhealthy` | Critical issues present |
| `Unknown` | Unable to determine |

---

## Alert Severities

| Severity | Description |
|----------|-------------|
| `Info` | Informational, no action needed |
| `Warning` | Should be investigated |
| `Error` | Requires attention |
| `Critical` | Immediate action required |

---

## Subsystem Types

| Type | Description |
|------|-------------|
| `Agent` | Core agent service |
| `SyncEngine` | Synchronization engine |
| `Database` | Database connection |
| `ApiClient` | TIS TIS API client |
| `CredentialStore` | Credential storage |
| `Logging` | Logging subsystem |
| `Security` | SSL/TLS validation |

---

## Common Patterns

### Record Operation with Error Handling

```csharp
var sw = Stopwatch.StartNew();
try
{
    var result = await DoOperation();
    sw.Stop();
    _monitoring?.RecordSyncOperation(true, sw.Elapsed, result.Count);
    _monitoring?.UpdateConsecutiveErrors(0);
    _monitoring?.RecordLastSuccessfulSync();
}
catch (Exception ex)
{
    sw.Stop();
    _monitoring?.RecordSyncOperation(false, sw.Elapsed);
    _monitoring?.UpdateConsecutiveErrors(_consecutiveErrors++);
    throw;
}
```

### Shutdown Diagnostics

```csharp
public override async Task StopAsync(CancellationToken ct)
{
    try
    {
        var summary = _monitoring?.Diagnostics.GetQuickSummary();
        _logger.LogInformation(
            "Shutdown - Uptime: {Uptime}, Health: {Health}, Alerts: {Alerts}",
            summary?.Uptime,
            summary?.HealthStatus,
            summary?.ActiveAlerts);
    }
    catch { /* Ignore errors during shutdown */ }

    await base.StopAsync(ct);
}
```

### Health-Based Decisions

```csharp
var health = _monitoring?.CurrentHealthStatus ?? HealthStatus.Unknown;

if (health == HealthStatus.Unhealthy)
{
    // Skip non-critical operations
    _logger.LogWarning("Skipping operation due to unhealthy status");
    return;
}
```

---

## Files Reference

| File | Description |
|------|-------------|
| `Monitoring/Types/MonitoringTypes.cs` | Core type definitions |
| `Monitoring/HealthCheck/HealthCheckService.cs` | Health check implementation |
| `Monitoring/Metrics/MetricsCollector.cs` | Metrics collection |
| `Monitoring/Alerting/AlertingService.cs` | Alert management |
| `Monitoring/Diagnostics/DiagnosticsService.cs` | Diagnostics collection |
| `Monitoring/MonitoringOrchestrator.cs` | Background orchestrator |
| `Monitoring/MonitoringServiceExtensions.cs` | DI registration |

---

*For full documentation, see [MONITORING.md](MONITORING.md)*
