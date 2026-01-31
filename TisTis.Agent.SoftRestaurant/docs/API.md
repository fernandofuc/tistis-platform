# TIS TIS Agent - API Client Documentation

## Version: 1.0.0

This document describes the API client component of the TIS TIS Local Agent, including endpoint specifications, request/response models, and usage examples.

---

## Table of Contents

1. [Overview](#overview)
2. [Client Configuration](#client-configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
   - [Register](#register)
   - [Heartbeat](#heartbeat)
   - [Sync Data](#sync-data)
   - [Ping](#ping)
5. [Request/Response Models](#requestresponse-models)
6. [Error Handling](#error-handling)
7. [Retry Policy](#retry-policy)
8. [Security Features](#security-features)
9. [Usage Examples](#usage-examples)

---

## Overview

The `TisTisApiClient` is the HTTP client responsible for communicating with the TIS TIS Platform API. It handles agent registration, heartbeat reporting, and data synchronization.

### Key Features

| Feature | Description |
|---------|-------------|
| **Retry Policy** | Automatic retry with exponential backoff using Polly |
| **SSL Pinning** | Certificate validation against known pins (SEC-04) |
| **Secure Headers** | Auth tokens sent via headers, not body (SEC-02) |
| **Batching** | Large sync operations split into configurable batches |
| **Logging** | Secure logging with sensitive data redaction |

### Dependencies

```xml
<PackageReference Include="System.Net.Http.Json" Version="8.0.0" />
<PackageReference Include="Polly" Version="8.4.1" />
<PackageReference Include="Polly.Extensions.Http" Version="3.0.0" />
```

---

## Client Configuration

### Interface

```csharp
public interface ITisTisApiClient
{
    Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<HeartbeatResponse> SendHeartbeatAsync(string status, string? errorMessage = null, CancellationToken ct = default);
    Task<SyncResponse> SendSyncDataAsync<T>(string syncType, IEnumerable<T> records, int totalCount, CancellationToken ct = default);
    Task<bool> PingAsync(CancellationToken ct = default);
}
```

### Configuration Options (ApiOptions)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `BaseUrl` | string | `https://app.tistis.com` | TIS TIS Platform URL |
| `RegisterEndpoint` | string | `/api/agent/register` | Agent registration endpoint |
| `HeartbeatEndpoint` | string | `/api/agent/heartbeat` | Heartbeat endpoint |
| `SyncEndpoint` | string | `/api/agent/sync` | Data sync endpoint |
| `TimeoutSeconds` | int | `30` | HTTP request timeout |
| `MaxRetries` | int | `3` | Maximum retry attempts |
| `RetryDelayMs` | int | `1000` | Base delay between retries |
| `ValidateSsl` | bool | `true` | Enable SSL validation |

### Configuration Example

```json
{
  "TisTisAgent": {
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
}
```

---

## Authentication

The API client uses a dual authentication approach for security and backward compatibility:

### Header-Based Authentication (Preferred)

```http
X-TisTis-Agent-Id: tis-agent-abc123
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Body-Based Authentication (Backward Compatibility)

```json
{
  "agent_id": "tis-agent-abc123",
  "auth_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Security Note:** Header-based auth is preferred as headers are typically not logged in server access logs.

---

## API Endpoints

### Register

Registers the agent with TIS TIS Platform.

**Endpoint:** `POST /api/agent/register`

**Request:**

```json
{
  "agent_id": "tis-agent-abc123",
  "auth_token": "eyJhbGciOiJIUzI1NiIs...",
  "agent_version": "1.0.0",
  "machine_name": "SERVER01",
  "sr_version": "10.5",
  "sr_database_name": "DVSOFT",
  "sr_sql_instance": "SERVER01\\SQLEXPRESS",
  "sr_empresa_id": "EMP001"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Agent registered successfully",
  "status": "active",
  "tenant_name": "Restaurant ABC",
  "sync_config": {
    "sync_interval_seconds": 30,
    "sync_menu": true,
    "sync_inventory": true,
    "sync_sales": true,
    "sync_tables": true
  }
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Invalid agent credentials",
  "errorCode": "AUTH_FAILED"
}
```

### Heartbeat

Sends periodic status updates to TIS TIS Platform.

**Endpoint:** `POST /api/agent/heartbeat`

**Request:**

```json
{
  "agent_id": "tis-agent-abc123",
  "status": "connected",
  "last_sync_at": "2026-01-30T14:30:00Z",
  "last_sync_records": 150,
  "error_message": null
}
```

**Response:**

```json
{
  "success": true,
  "timestamp": "2026-01-30T14:30:05Z",
  "sync_config": {
    "sync_interval_seconds": 30,
    "sync_menu": true,
    "sync_inventory": true,
    "sync_sales": true,
    "sync_tables": true
  }
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `connected` | Agent is running normally |
| `syncing` | Currently syncing data |
| `error` | Agent encountered an error |
| `degraded` | Agent has issues but still operational |
| `stopped` | Agent is shutting down |

### Sync Data

Sends synchronized data to TIS TIS Platform.

**Endpoint:** `POST /api/agent/sync`

**Request:**

```json
{
  "agent_id": "tis-agent-abc123",
  "sync_type": "sales",
  "batch_id": "a1b2c3d4e5f6g7h8",
  "batch_number": 1,
  "total_batches": 3,
  "records": [
    {
      "external_id": "sr-ORD-001",
      "order_date": "2026-01-30T10:30:00Z",
      "total_amount": 450.00,
      "items": [...]
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "sync_type": "sales",
  "batch_id": "a1b2c3d4e5f6g7h8",
  "records_processed": 50,
  "records_created": 45,
  "records_updated": 5,
  "records_skipped": 0,
  "records_failed": 0,
  "duration_ms": 1250
}
```

**Sync Types:**

| Type | Description | Typical Interval |
|------|-------------|------------------|
| `sales` | Sales/orders | Every 30 seconds |
| `menu` | Menu items/products | Every 5 minutes |
| `inventory` | Inventory levels | Every 5 minutes |
| `tables` | Table status | Every 1 minute |

### Ping

Health check endpoint.

**Endpoint:** `GET /api/health`

**Response:** `200 OK` (body ignored)

---

## Request/Response Models

### Request Models

#### RegisterRequest

```csharp
public class RegisterRequest
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; }

    [JsonPropertyName("auth_token")]
    public string AuthToken { get; set; }

    [JsonPropertyName("agent_version")]
    public string AgentVersion { get; set; }

    [JsonPropertyName("machine_name")]
    public string MachineName { get; set; }

    [JsonPropertyName("sr_version")]
    public string? SrVersion { get; set; }

    [JsonPropertyName("sr_database_name")]
    public string? SrDatabaseName { get; set; }

    [JsonPropertyName("sr_sql_instance")]
    public string? SrSqlInstance { get; set; }

    [JsonPropertyName("sr_empresa_id")]
    public string? SrEmpresaId { get; set; }
}
```

#### HeartbeatRequest

```csharp
public class HeartbeatRequest
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "connected";

    [JsonPropertyName("last_sync_at")]
    public string? LastSyncAt { get; set; }

    [JsonPropertyName("last_sync_records")]
    public int? LastSyncRecords { get; set; }

    [JsonPropertyName("error_message")]
    public string? ErrorMessage { get; set; }
}
```

#### SyncRequest&lt;T&gt;

```csharp
public class SyncRequest<T>
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; }

    [JsonPropertyName("sync_type")]
    public string SyncType { get; set; }

    [JsonPropertyName("batch_id")]
    public string BatchId { get; set; }

    [JsonPropertyName("batch_number")]
    public int BatchNumber { get; set; } = 1;

    [JsonPropertyName("total_batches")]
    public int TotalBatches { get; set; } = 1;

    [JsonPropertyName("records")]
    public IEnumerable<T> Records { get; set; }
}
```

### Response Models

#### ApiResponse (Base)

```csharp
public class ApiResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("error")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; set; }
}
```

#### RegisterResponse

```csharp
public class RegisterResponse : ApiResponse
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("tenant_name")]
    public string? TenantName { get; set; }

    [JsonPropertyName("sync_config")]
    public SyncConfigResponse? SyncConfig { get; set; }
}
```

#### HeartbeatResponse

```csharp
public class HeartbeatResponse : ApiResponse
{
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    [JsonPropertyName("sync_config")]
    public SyncConfigResponse? SyncConfig { get; set; }
}
```

#### SyncResponse

```csharp
public class SyncResponse : ApiResponse
{
    [JsonPropertyName("sync_type")]
    public string? SyncType { get; set; }

    [JsonPropertyName("batch_id")]
    public string? BatchId { get; set; }

    [JsonPropertyName("records_processed")]
    public int RecordsProcessed { get; set; }

    [JsonPropertyName("records_created")]
    public int RecordsCreated { get; set; }

    [JsonPropertyName("records_updated")]
    public int RecordsUpdated { get; set; }

    [JsonPropertyName("records_skipped")]
    public int RecordsSkipped { get; set; }

    [JsonPropertyName("records_failed")]
    public int RecordsFailed { get; set; }

    [JsonPropertyName("duration_ms")]
    public int DurationMs { get; set; }
}
```

#### SyncConfigResponse

```csharp
public class SyncConfigResponse
{
    [JsonPropertyName("sync_interval_seconds")]
    public int SyncIntervalSeconds { get; set; }

    [JsonPropertyName("sync_menu")]
    public bool SyncMenu { get; set; }

    [JsonPropertyName("sync_inventory")]
    public bool SyncInventory { get; set; }

    [JsonPropertyName("sync_sales")]
    public bool SyncSales { get; set; }

    [JsonPropertyName("sync_tables")]
    public bool SyncTables { get; set; }
}
```

---

## Error Handling

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `AUTH_FAILED` | Invalid or expired credentials | Re-register agent |
| `AGENT_NOT_FOUND` | Agent ID not recognized | Contact support |
| `TENANT_DISABLED` | Tenant subscription inactive | Check billing |
| `RATE_LIMITED` | Too many requests | Reduce sync frequency |
| `INVALID_DATA` | Malformed request data | Check data format |
| `SERVER_ERROR` | Internal server error | Retry with backoff |

### HTTP Status Codes

| Status | Meaning | Retry |
|--------|---------|-------|
| `200` | Success | N/A |
| `400` | Bad Request | No |
| `401` | Unauthorized | No (re-register) |
| `403` | Forbidden | No |
| `404` | Not Found | No |
| `429` | Rate Limited | Yes (with backoff) |
| `500` | Server Error | Yes |
| `502` | Bad Gateway | Yes |
| `503` | Service Unavailable | Yes |
| `504` | Gateway Timeout | Yes |

---

## Retry Policy

The API client uses Polly for resilient HTTP operations.

### Configuration

```csharp
HttpPolicyExtensions
    .HandleTransientHttpError()
    .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt =>
            TimeSpan.FromMilliseconds(1000 * Math.Pow(2, attempt)),
        onRetry: (outcome, delay, attempt, context) =>
            _logger.LogWarning("Retry {Attempt} after {Delay}ms", attempt, delay)
    );
```

### Retry Timing

| Attempt | Delay |
|---------|-------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |

### Handled Errors

- `HttpRequestException`
- `5xx` status codes
- `408` Request Timeout
- `429` Too Many Requests

---

## Security Features

### Certificate Pinning (SEC-04)

```csharp
if (_certificateValidator != null)
{
    handler.ServerCertificateCustomValidationCallback =
        _certificateValidator.GetHttpClientValidationCallback();
}
```

### Secure Logging (SEC-02)

- Error response bodies truncated to 500 characters
- Sensitive data redacted from logs
- Auth tokens never logged

### Header-Based Auth (S4/S5)

```csharp
request.Headers.Add("X-TisTis-Agent-Id", _config.AgentId);
request.Headers.Add("Authorization", $"Bearer {_config.AuthToken}");
```

---

## Usage Examples

### Creating the Client

```csharp
// Via DI (recommended)
builder.Services.AddSingleton<ITisTisApiClient>(sp =>
{
    var config = sp.GetRequiredService<AgentConfiguration>();
    var logger = sp.GetRequiredService<ILogger<TisTisApiClient>>();
    var certValidator = sp.GetRequiredService<CertificateValidator>();
    return new TisTisApiClient(config, logger, certValidator);
});
```

### Registering the Agent

```csharp
var request = new RegisterRequest
{
    AgentId = _config.AgentId,
    AuthToken = _config.AuthToken,
    AgentVersion = _config.Version,
    MachineName = Environment.MachineName,
    SrVersion = detectionResult.Version,
    SrDatabaseName = detectionResult.DatabaseName,
    SrSqlInstance = detectionResult.SqlInstance
};

var response = await _apiClient.RegisterAsync(request, cancellationToken);

if (response.Success)
{
    _logger.LogInformation("Registered with {Tenant}", response.TenantName);
    ApplySyncConfig(response.SyncConfig);
}
else
{
    _logger.LogError("Registration failed: {Error}", response.ErrorMessage);
}
```

### Sending Heartbeat

```csharp
var response = await _apiClient.SendHeartbeatAsync(
    status: "connected",
    errorMessage: null,
    cancellationToken);

if (response.Success && response.SyncConfig != null)
{
    // Apply config updates from server
    ApplySyncConfig(response.SyncConfig);
}
```

### Syncing Data

```csharp
var sales = await _repository.GetVentasAsync(lastSyncAt, cancellationToken);
var transformed = _transformer.TransformMany(sales);

var response = await _apiClient.SendSyncDataAsync(
    syncType: "sales",
    records: transformed,
    totalCount: sales.Count,
    cancellationToken);

if (response.Success)
{
    _logger.LogInformation(
        "Synced {Processed} records ({Created} new, {Updated} updated)",
        response.RecordsProcessed,
        response.RecordsCreated,
        response.RecordsUpdated);
}
```

### Checking Connectivity

```csharp
var isReachable = await _apiClient.PingAsync(cancellationToken);

if (!isReachable)
{
    _logger.LogWarning("TIS TIS API is not reachable");
}
```

---

## JSON Serialization

The client uses `System.Text.Json` with snake_case naming:

```csharp
private static readonly JsonSerializerOptions JsonOptions = new()
{
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    WriteIndented = false
};
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial API documentation |

---

*For additional support, contact: soporte@tistis.com*
