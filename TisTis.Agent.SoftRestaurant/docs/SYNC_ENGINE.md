# TIS TIS Agent - Sync Engine Documentation

## Version: 1.0.0

This document describes the synchronization engine that orchestrates data flow from Soft Restaurant POS to the TIS TIS Platform.

---

## Table of Contents

1. [Overview](#overview)
2. [State Machine](#state-machine)
3. [Sync Types](#sync-types)
4. [Sync Loop](#sync-loop)
5. [Incremental Sync](#incremental-sync)
6. [State Persistence](#state-persistence)
7. [Statistics](#statistics)
8. [Error Handling](#error-handling)
9. [Configuration](#configuration)
10. [Usage](#usage)

---

## Overview

The `SyncEngine` is the core component responsible for orchestrating data synchronization between Soft Restaurant and TIS TIS Platform. It manages the sync lifecycle, handles incremental updates, and maintains synchronization state across restarts.

### Key Features

| Feature | Description |
|---------|-------------|
| **State Machine** | Managed lifecycle (Stopped → Starting → Running → Syncing) |
| **Incremental Sync** | Only syncs new/changed data since last sync |
| **State Persistence** | Survives restarts - tracks last synced position |
| **Batching** | Large datasets split into configurable batches |
| **Error Recovery** | Automatic retry with backoff on failures |
| **Statistics** | Real-time tracking of sync operations |

### Interface

```csharp
public interface ISyncEngine : IDisposable
{
    SyncEngineState State { get; }
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync();
    Task<SyncResult> SyncNowAsync(SyncType syncType, CancellationToken cancellationToken = default);
    SyncStatistics GetStatistics();
}
```

---

## State Machine

The sync engine operates as a finite state machine:

```
                    ┌─────────┐
                    │ Stopped │
                    └────┬────┘
                         │ StartAsync()
                         ▼
                    ┌──────────┐
                    │ Starting │
                    └────┬─────┘
                         │ DB connection OK
                         ▼
          ┌─────────────────────────────┐
          │                             │
          ▼                             │
     ┌─────────┐    sync triggered  ┌───┴────┐
     │ Running │───────────────────▶│ Syncing│
     └────┬────┘◀───────────────────└────────┘
          │         sync completed
          │ StopAsync()
          ▼
     ┌──────────┐
     │ Stopping │
     └────┬─────┘
          │
          ▼
     ┌─────────┐
     │ Stopped │
     └─────────┘
```

### State Definitions

| State | Description |
|-------|-------------|
| `Stopped` | Engine is not running |
| `Starting` | Initializing, loading state, testing DB connection |
| `Running` | Waiting for next sync interval |
| `Syncing` | Currently synchronizing data |
| `Stopping` | Graceful shutdown in progress |
| `Error` | Fatal error (e.g., DB connection failed) |

---

## Sync Types

The engine supports multiple sync types:

| Type | Description | Typical Interval | Mode |
|------|-------------|------------------|------|
| `Sales` | Orders/transactions | 30 seconds | Incremental |
| `Menu` | Products/menu items | 5 minutes | Full snapshot |
| `Inventory` | Stock levels | 5 minutes | Full snapshot |
| `Tables` | Table status | 1 minute | Full snapshot |
| `Full` | All data types | On-demand | Combined |

### Sync Flow by Type

```
Sales (Incremental):
  Repository.GetNewVentasAsync(lastSyncedId)
  → VentasTransformer.TransformMany()
  → ApiClient.SendSyncDataAsync("sales")
  → Update lastSyncedSaleId
  → Persist state

Menu/Inventory/Tables (Full Snapshot):
  Repository.GetXxxAsync()
  → XxxTransformer.TransformMany()
  → ApiClient.SendSyncDataAsync("xxx")
```

---

## Sync Loop

### Startup Sequence

```
1. Load persisted sync state (lastSyncedSaleId, lastFullSyncAt)
2. Test database connection
3. Perform initial full sync
4. Enter periodic sync loop
```

### Periodic Sync Loop

```
while (!cancellationToken.IsCancellationRequested)
{
    await Task.Delay(SyncInterval);

    // Always sync sales (incremental)
    if (SyncSales) await SyncSalesAsync();

    // Periodic full sync if needed
    if (NeedsFullSync())
    {
        await PerformFullSyncAsync();
    }
    else
    {
        // Send heartbeat
        await SendHeartbeatAsync();
    }
}
```

### Full Sync Trigger

Full sync is triggered when:
- Agent first starts
- Time since last full sync exceeds `FullSyncIntervalMinutes`
- Manual trigger via `SyncNowAsync(SyncType.Full)`

---

## Incremental Sync

Sales sync uses position-based incremental synchronization:

### Algorithm

```
1. Load lastSyncedSaleId from persistent storage
2. Query: SELECT * FROM Ventas WHERE IdVenta > @lastSyncedSaleId
3. Transform records to TIS TIS format
4. Send to API
5. Update lastSyncedSaleId = MAX(IdVenta)
6. Persist new position
```

### Benefits

- **Efficient**: Only transfers new data
- **Resumable**: Survives restarts without data loss
- **Reliable**: No duplicate or missed records

### Implementation

```csharp
private async Task<SyncResult> SyncSalesAsync(CancellationToken ct)
{
    // Get new sales since last synced position
    var ventas = await _repository.GetNewVentasAsync(
        _lastSyncedSaleId,
        _options.MaxRecordsPerQuery,
        ct);

    if (ventas.Count == 0)
    {
        return SyncResult.Successful(SyncType.Sales, 0, 0, 0, duration);
    }

    // Transform and send
    var transformed = VentasTransformer.TransformMany(ventas);
    var response = await _apiClient.SendSyncDataAsync("sales", transformed, ventas.Count, ct);

    // Update and persist position
    if (response.Success && ventas.Count > 0)
    {
        var maxId = ventas.Max(v => v.IdVenta);
        _lastSyncedSaleId = maxId;
        await _stateService.UpdateSyncPositionAsync(SyncType.Sales, maxId, ct);
    }

    return SyncResult.Successful(...);
}
```

---

## State Persistence

The engine persists sync state to survive restarts:

### Persisted State

| Property | Purpose |
|----------|---------|
| `LastSyncedSaleId` | Position for incremental sales sync |
| `LastFullSyncAt` | Timestamp of last full sync |
| `LastSyncAt` | Timestamp of any sync |

### Storage Interface

```csharp
public interface ISyncStateService
{
    Task<SyncState> GetStateAsync(CancellationToken ct);
    Task<long> GetLastSyncPositionAsync(SyncType syncType, CancellationToken ct);
    Task UpdateSyncPositionAsync(SyncType syncType, long position, CancellationToken ct);
}
```

### Recovery Flow

```
StartAsync():
  1. Load lastSyncedSaleId from storage
  2. Load lastFullSyncAt from storage
  3. If load fails, start fresh (position = 0)
  4. Log recovered state
  5. Continue normal operation
```

---

## Statistics

The engine tracks comprehensive statistics:

### SyncStatistics Class

```csharp
public class SyncStatistics
{
    public DateTime StartedAt { get; set; }
    public TimeSpan Uptime => DateTime.UtcNow - StartedAt;
    public int TotalSyncs { get; set; }
    public int SuccessfulSyncs { get; set; }
    public int FailedSyncs { get; set; }
    public long TotalRecordsSynced { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public DateTime? LastSuccessfulSyncAt { get; set; }
    public string? LastError { get; set; }
    public DateTime? LastErrorAt { get; set; }
    public int ConsecutiveErrors { get; set; }
}
```

### Usage

```csharp
var stats = _syncEngine.GetStatistics();
_logger.LogInformation(
    "Sync stats - Total: {Total}, Success: {Success}, Failed: {Failed}",
    stats.TotalSyncs,
    stats.SuccessfulSyncs,
    stats.FailedSyncs);
```

---

## Error Handling

### Error Categories

| Category | Handling |
|----------|----------|
| **Transient** (network, timeout) | Retry with backoff |
| **API Errors** (rate limit) | Pause and retry |
| **Data Errors** (invalid records) | Log and skip |
| **Fatal** (DB connection lost) | Stop engine, alert |

### Consecutive Error Handling

```csharp
catch (Exception ex)
{
    _statistics.ConsecutiveErrors++;
    _statistics.LastError = ex.Message;

    // Send error heartbeat
    await _apiClient.SendHeartbeatAsync("error", ex.Message, ct);

    // Pause if too many errors
    if (_statistics.ConsecutiveErrors >= MaxConsecutiveErrors)
    {
        _logger.LogWarning("Max errors reached, pausing for {Pause}s", ErrorPauseSeconds);
        await Task.Delay(TimeSpan.FromSeconds(ErrorPauseSeconds), ct);
    }
}
```

### Success Resets Error Counter

```csharp
if (response.Success)
{
    _statistics.ConsecutiveErrors = 0;  // Reset on success
}
```

---

## Configuration

### SyncOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `IntervalSeconds` | int | 30 | Seconds between sync cycles |
| `SyncSales` | bool | true | Enable sales sync |
| `SyncMenu` | bool | true | Enable menu sync |
| `SyncInventory` | bool | true | Enable inventory sync |
| `SyncTables` | bool | true | Enable table sync |
| `FullSyncIntervalMinutes` | int | 60 | Minutes between full syncs |
| `MaxRecordsPerQuery` | int | 1000 | Max records per DB query |
| `BatchSize` | int | 100 | Records per API batch |
| `MaxConsecutiveErrors` | int | 5 | Errors before pause |
| `ErrorPauseSeconds` | int | 60 | Pause duration on errors |

### Configuration Example

```json
{
  "TisTisAgent": {
    "Sync": {
      "IntervalSeconds": 30,
      "SyncSales": true,
      "SyncMenu": true,
      "SyncInventory": true,
      "SyncTables": true,
      "FullSyncIntervalMinutes": 60,
      "MaxRecordsPerQuery": 1000,
      "BatchSize": 100,
      "MaxConsecutiveErrors": 5,
      "ErrorPauseSeconds": 60
    }
  }
}
```

---

## Usage

### Starting the Engine

```csharp
await _syncEngine.StartAsync(cancellationToken);

// Engine now running in background
while (_syncEngine.State == SyncEngineState.Running)
{
    await Task.Delay(1000, cancellationToken);
}
```

### Manual Sync

```csharp
// Trigger immediate sync of specific type
var result = await _syncEngine.SyncNowAsync(SyncType.Sales, cancellationToken);

if (result.Success)
{
    _logger.LogInformation(
        "Synced {Processed} records ({Created} new, {Updated} updated)",
        result.RecordsProcessed,
        result.RecordsCreated,
        result.RecordsUpdated);
}
```

### Stopping the Engine

```csharp
await _syncEngine.StopAsync();
// Engine gracefully stopped
```

### Getting Statistics

```csharp
var stats = _syncEngine.GetStatistics();
Console.WriteLine($"Uptime: {stats.Uptime}");
Console.WriteLine($"Total synced: {stats.TotalRecordsSynced}");
```

---

## SyncResult

### Structure

```csharp
public class SyncResult
{
    public bool Success { get; set; }
    public SyncType SyncType { get; set; }
    public int RecordsProcessed { get; set; }
    public int RecordsCreated { get; set; }
    public int RecordsUpdated { get; set; }
    public int RecordsFailed { get; set; }
    public TimeSpan Duration { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CompletedAt { get; set; }
}
```

### Factory Methods

```csharp
// Success
SyncResult.Successful(SyncType.Sales, processed: 100, created: 90, updated: 10, duration);

// Failure
SyncResult.Failed(SyncType.Sales, "Connection timeout", duration);
```

---

## Transformers

The engine uses static transformer instances for efficiency:

```csharp
private static readonly VentasTransformer VentasTransformer = new();
private static readonly ProductosTransformer ProductosTransformer = new();
private static readonly InventarioTransformer InventarioTransformer = new();
private static readonly MesasTransformer MesasTransformer = new();
```

Transformers are stateless and thread-safe.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial sync engine documentation |

---

*For additional support, contact: soporte@tistis.com*
