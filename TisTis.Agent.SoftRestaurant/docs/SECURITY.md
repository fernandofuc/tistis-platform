# TIS TIS Agent - Security Documentation

## Version: FASE 6 Security Hardening

This document describes the security features implemented in the TIS TIS Local Agent for Soft Restaurant. These enhancements protect credentials, prevent timing attacks, ensure secure logging, and validate SSL certificates.

---

## Table of Contents

1. [Overview](#overview)
2. [Security Components](#security-components)
   - [SecureUtilities](#secureutilities)
   - [CredentialStore](#credentialstore)
   - [TokenManager](#tokenmanager)
   - [CertificateValidator](#certificatevalidator)
   - [SecureLogEnricher](#securelogenricher)
   - [AgentLogger](#agentlogger)
3. [Security Fixes Reference](#security-fixes-reference)
4. [Best Practices](#best-practices)
5. [Configuration](#configuration)

---

## Overview

FASE 6 implements comprehensive security hardening across the agent codebase:

| Feature | Description | Fix ID |
|---------|-------------|--------|
| Constant-time comparison | Prevents timing attacks on token validation | SEC-03 |
| Secure memory clearing | Removes sensitive data from memory after use | SEC-01 |
| Credential data redaction | Hides sensitive values in logs | SEC-02 |
| SSL Certificate Pinning | Validates server certificates against known pins | SEC-04 |
| Proactive token expiration | Monitors and rotates tokens before expiry | SEC-05 |
| IDisposable pattern | Proper resource cleanup for security classes | SEC-06 |

---

## Security Components

### SecureUtilities

**File:** `src/TisTis.Agent.Core/Security/SecureUtilities.cs`

Static utility class providing cryptographic helper functions for secure operations.

#### Constant-Time Comparison

Prevents timing attacks by ensuring comparison operations take the same amount of time regardless of input similarity.

```csharp
using TisTis.Agent.Core.Security;

// Compare tokens without timing leakage
bool isValid = SecureUtilities.ConstantTimeEquals(providedToken, expectedToken);

// Works with byte arrays too
bool bytesMatch = SecureUtilities.ConstantTimeEquals(hashA, hashB);
```

**Implementation Details:**
- Uses `CryptographicOperations.FixedTimeEquals()` from .NET
- Maintains constant timing even for null values (ITER1-A1)
- Maintains constant timing for length mismatches (ITER2-C1)
- Marked with `[MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]` to prevent compiler optimizations

#### Secure Memory Clearing

Removes sensitive data from memory to prevent leakage.

```csharp
byte[] sensitiveData = GetSensitiveBytes();
try
{
    // Use the data
    ProcessData(sensitiveData);
}
finally
{
    // Clear from memory
    SecureUtilities.ClearBytes(sensitiveData);
}

// For char arrays (passwords)
char[] password = GetPassword();
try
{
    Authenticate(password);
}
finally
{
    SecureUtilities.ClearChars(password);
}
```

#### Data Validation

Validates tokens and credential data before processing.

```csharp
// Validate token format
if (!SecureUtilities.ValidateTokenFormat(token))
{
    throw new InvalidOperationException("Invalid token format");
}

// Validate data size (prevents DoS)
if (!SecureUtilities.ValidateDataSize(credentialBytes))
{
    throw new InvalidOperationException("Credential data too large");
}
```

**Limits:**
- `MaxTokenLength`: 4,096 characters
- `MaxCredentialSizeBytes`: 64 KB

#### Data Redaction

Safely redacts sensitive values for logging.

```csharp
// Partial redaction (shows first/last 4 chars)
string safe = SecureUtilities.Redact(agentId, 4);
// Output: "tis-***[20 chars]***xxxx"

// Full redaction (no reveal)
string fullRedact = SecureUtilities.RedactFull(authToken);
// Output: "[redacted:128 chars]"

// Hash prefix for correlation without exposure
string hashId = SecureUtilities.ComputeHashPrefix(token);
// Output: "a1b2c3d4e5f6g7h8" (first 16 hex chars of SHA256)
```

#### Secure Random Generation

Generates cryptographically secure random values.

```csharp
// Generate random bytes
byte[] randomBytes = SecureUtilities.GenerateSecureBytes(32);

// Generate URL-safe token
string secureToken = SecureUtilities.GenerateSecureToken(32);
// Output: "xYz123_AbC-789..." (Base64 URL-safe)
```

---

### CredentialStore

**File:** `src/TisTis.Agent.Core/Security/CredentialStore.cs`

Secure storage for agent credentials using Windows Data Protection API (DPAPI).

#### Features

- **DPAPI Encryption**: Credentials encrypted at machine scope
- **Thread-Safe**: File operations protected by locks
- **Secure Deletion**: Overwrites file with random data before delete
- **Permission Hardening**: Sets restrictive ACLs on credential files
- **IDisposable**: Proper cleanup pattern (SEC-06)
- **Memory Clearing**: Sensitive data cleared after operations (SEC-01)

#### Usage

```csharp
using var credentialStore = new CredentialStore(
    storePath: @"C:\ProgramData\TisTis\Agent\.credentials",
    useDataProtection: true,
    logger: logger
);

// Store credentials
var credentials = new StoredCredentials
{
    AgentId = "tis-agent-xxxx",
    TenantId = "tenant-yyyy",
    AuthToken = "bearer-token...",
    SqlConnectionString = "Server=...;Database=..."
};
credentialStore.Store(credentials);

// Retrieve credentials
var stored = credentialStore.Retrieve();

// Update token only
credentialStore.UpdateToken(newToken);

// Securely delete
credentialStore.Delete();
```

#### File Permissions

On Windows, the credential store sets restrictive permissions:

| Principal | Access |
|-----------|--------|
| SYSTEM | Full Control |
| Administrators | Full Control |
| Other Users | No Access |

---

### TokenManager

**File:** `src/TisTis.Agent.Core/Security/TokenManager.cs`

Manages authentication token lifecycle with thread-safe operations.

#### Features

- **Thread-Safe**: All operations protected by locks
- **Secure Logging**: Uses hash prefix instead of actual token (SEC-02)
- **Token Validation**: Validates format before storing (SEC-03)
- **Proactive Expiration**: Monitors token expiry and triggers rotation (SEC-05)
- **Atomic Updates**: Token updates are atomic to prevent inconsistent state (ITER1-A3)
- **IDisposable**: Proper cleanup pattern (SEC-06)

#### Usage

```csharp
using var tokenManager = new TokenManager(credentialStore, config, logger);

// Load from store on startup
tokenManager.LoadFromStore();

// Get current token (validates format)
string token = tokenManager.GetToken();

// Check if rotation needed
if (tokenManager.NeedsRotation())
{
    // Request new token from server
    string newToken = await RequestNewToken();
    tokenManager.UpdateToken(newToken);
}

// Check expiration
if (tokenManager.IsExpired())
{
    throw new InvalidOperationException("Token expired");
}

// Set expiration from server response
tokenManager.SetTokenExpiration(expiresAt);

// Get time remaining
TimeSpan? remaining = tokenManager.GetTimeToExpiration();

// Secure token comparison
if (TokenManager.SecureCompare(token1, token2))
{
    // Tokens match
}
```

#### Token Rotation

Default rotation threshold is 24 hours before expiry:

```csharp
// Custom rotation threshold
if (tokenManager.NeedsRotation(TimeSpan.FromHours(12)))
{
    // Rotate earlier
}
```

---

### CertificateValidator

**File:** `src/TisTis.Agent.Core/Security/CertificateValidator.cs`

SSL/TLS certificate validation with optional certificate pinning.

#### Features

- **Certificate Pinning**: Validates against known thumbprints/public key hashes (SEC-04)
- **Thread-Safe**: Pin collections protected by locks (AUDIT-02, AUDIT-06)
- **Key Strength Validation**: Rejects weak RSA keys (<2048 bits) (AUDIT-10)
- **Chain Validation**: Validates entire certificate chain (AUDIT-09)
- **ECDSA Support**: Validates ECDSA key sizes (ITER1-B2)
- **SHA-1 Detection**: Warns about deprecated signature algorithms (ITER1-B1)

#### Usage

```csharp
var validator = new CertificateValidator(securityOptions, logger);

// Get callback for HttpClientHandler
var handler = new HttpClientHandler
{
    ServerCertificateCustomValidationCallback = validator.GetValidationCallback()
};

// Add pinned certificates at runtime
validator.AddPinnedThumbprint("AA:BB:CC:DD:...");
validator.AddPinnedPublicKeyHash("1234ABCD...");

// Check pinning status
if (validator.IsPinningEnabled)
{
    Console.WriteLine($"Pinned certificates: {validator.PinnedCertificateCount}");
}
```

#### Validation Checks

| Check | Behavior |
|-------|----------|
| Certificate null | Fail |
| Name mismatch | Fail (MITM risk) |
| Expired certificate | Fail |
| Not yet valid | Fail |
| RSA key < 2048 bits | Fail |
| ECDSA key < 256 bits | Fail |
| SHA-1 signature | Warn (log) |
| DSA algorithm | Warn (deprecated) |
| Thumbprint mismatch (pinning enabled) | Fail |

#### Configuration

```csharp
var securityOptions = new SecurityOptions
{
    UseCertificatePinning = true,           // Enable pinning
    CertificateThumbprint = "AABB..."       // Primary pin
};
```

---

### SecureLogEnricher

**File:** `src/TisTis.Agent.Core/Logging/SecureLogEnricher.cs`

Serilog enricher that automatically redacts sensitive data from logs.

#### Features

- **Automatic Redaction**: Detects and redacts sensitive properties
- **Pattern Matching**: Identifies sensitive data by property names
- **Recursive Processing**: Handles nested structures, dictionaries, sequences
- **Configurable**: Separate rules for full vs partial redaction

#### Fully Redacted Properties

These properties are completely hidden in logs:

- `AuthToken`, `Token`, `Bearer`
- `Password`, `Secret`, `ApiKey`
- `PrivateKey`, `Credential`, `Credentials`
- `ConnectionString`, `SqlConnectionString`

#### Partially Redacted Properties

These show first/last 4 characters:

- `AgentId`, `TenantId`, `IntegrationId`, `BranchId`
- `UserId`, `Email`, `Phone`, `PhoneNumber`

#### Sensitive Patterns

Any property name containing these patterns is fully redacted:

- `token`, `secret`, `password`
- `key`, `credential`, `auth`

#### Usage

```csharp
// Configure Serilog with secure enricher
var logger = new LoggerConfiguration()
    .Enrich.WithSecureDataRedaction()
    .CreateLogger();

// Now safe to log potentially sensitive data
logger.Information("User {UserId} authenticated with {AuthToken}", userId, token);
// Output: "User usr-***[8 chars]***xxxx authenticated with [redacted:128 chars]"
```

---

### AgentLogger

**File:** `src/TisTis.Agent.Core/Logging/AgentLogger.cs`

Factory and extensions for secure agent logging.

#### Features

- **Pre-configured Security**: Includes `SecureLogEnricher` by default
- **Exception Sanitization**: Removes sensitive data from exception messages
- **Connection String Protection**: Redacts server details in errors
- **Extension Methods**: Convenient logging for common scenarios

#### Usage

```csharp
// Create logger with security features
var logger = AgentLogger.CreateLogger(new LoggingOptions
{
    MinimumLevel = "Information",
    LogDirectory = @"C:\ProgramData\TisTis\Agent\Logs",
    RetainDays = 30,
    MaxFileSizeMb = 10,
    WriteToEventLog = true,
    EventLogSource = "TisTis.Agent"
});

// Use extension methods for common scenarios
logger.LogSyncStarted("Sales", 150);
logger.LogSyncCompleted("Sales", 150, 45, 105, TimeSpan.FromSeconds(5));
logger.LogAgentRegistered(agentId, tenantName);  // Auto-redacts
logger.LogConnectionError(target, exception);     // Sanitizes connection strings
logger.LogSyncFailed("Inventory", exception);     // Sanitizes exception message
```

#### Exception Sanitization

The logger automatically sanitizes exception messages:

| Pattern Detected | Action |
|------------------|--------|
| Connection string keywords | Replace with "[Connection details redacted]" |
| Bearer tokens | Partial redaction |
| Auth headers | Partial redaction |
| API keys | Partial redaction |
| Long messages (>200 chars) | Truncate |

---

## Security Fixes Reference

### Fix Categories

| Category | ID Range | Description |
|----------|----------|-------------|
| SEC | SEC-01 to SEC-06 | Core security fixes |
| AUDIT | AUDIT-01 to AUDIT-10 | Security audit findings |
| ITER1 | ITER1-A1 to ITER1-B4 | First iteration improvements |
| ITER2 | ITER2-C1 to ITER2-C4 | Second iteration improvements |

### Complete Fix List

| Fix ID | Component | Description |
|--------|-----------|-------------|
| SEC-01 | CredentialStore, SecureUtilities | Secure memory clearing |
| SEC-02 | TokenManager, AgentLogger | Secure logging (no token exposure) |
| SEC-03 | SecureUtilities, TokenManager | Constant-time comparison |
| SEC-04 | CertificateValidator | SSL Certificate Pinning |
| SEC-05 | TokenManager | Proactive token expiration |
| SEC-06 | TokenManager, CredentialStore | IDisposable implementation |
| AUDIT-01 | CertificateValidator | Fixed X509Certificate memory leak |
| AUDIT-02 | CertificateValidator | Fixed race condition in initialization |
| AUDIT-03 | SecureUtilities | Constant-time for null comparisons |
| AUDIT-06 | CertificateValidator | Fixed HashSet race condition |
| AUDIT-09 | CertificateValidator | Improved certificate chain validation |
| AUDIT-10 | CertificateValidator | Key strength validation |
| ITER1-A1 | SecureUtilities | Constant time for null/length mismatch |
| ITER1-A3 | TokenManager | Atomic token updates |
| ITER1-A4 | SecureLogEnricher | Process nested sequences |
| ITER1-A5 | CertificateValidator | UTC time for certificate validation |
| ITER1-B1 | CertificateValidator | Fixed SHA1 detection logic |
| ITER1-B2 | CertificateValidator | Added ECDSA validation |
| ITER1-B3 | LoggerExtensions | Precise token detection |
| ITER1-B4 | TokenManager | Atomic credential load |
| ITER2-C1 | SecureUtilities | Compare empty arrays |
| ITER2-C3 | CertificateValidator | Static SHA-1 OID array |
| ITER2-C4 | CertificateValidator | Exception handling for public key hash |

---

## Best Practices

### DO

1. **Always use `SecureUtilities.ConstantTimeEquals()`** for comparing secrets
2. **Clear sensitive data from memory** using `ClearBytes()` / `ClearChars()`
3. **Use `Redact()` or `RedactFull()`** when logging sensitive values
4. **Use `using` statements** with IDisposable security classes
5. **Enable certificate pinning** in production environments
6. **Monitor token expiration** and rotate proactively
7. **Use the `SecureLogEnricher`** in all logging configurations

### DON'T

1. **Never log tokens, passwords, or connection strings** directly
2. **Never use `==` operator** to compare secrets (timing attack risk)
3. **Never store secrets in plain text** configuration files
4. **Never disable certificate validation** in production
5. **Never ignore `ObjectDisposedException`** - it indicates resource misuse
6. **Never use SHA-1** for cryptographic purposes
7. **Never use RSA keys smaller than 2048 bits**

### Code Examples

#### Secure Token Handling

```csharp
// GOOD
if (SecureUtilities.ConstantTimeEquals(providedToken, expectedToken))
{
    // Token valid
}

// BAD - vulnerable to timing attacks
if (providedToken == expectedToken)
{
    // Token valid
}
```

#### Secure Logging

```csharp
// GOOD
_logger.LogInformation("Token updated (hash: {Hash})",
    SecureUtilities.ComputeHashPrefix(token));

// BAD - exposes token
_logger.LogInformation("Token updated: {Token}", token);
```

#### Resource Cleanup

```csharp
// GOOD
using var tokenManager = new TokenManager(store, config, logger);
// Resources cleaned up automatically

// BAD - may leak resources
var tokenManager = new TokenManager(store, config, logger);
// No disposal
```

---

## Configuration

### Security Options

```json
{
  "TisTisAgent": {
    "Security": {
      "UseCertificatePinning": true,
      "CertificateThumbprint": "AABBCCDD...",
      "UseDataProtection": true,
      "TokenRotationHours": 24
    }
  }
}
```

### Logging Options

```json
{
  "TisTisAgent": {
    "Logging": {
      "MinimumLevel": "Information",
      "LogDirectory": "C:\\ProgramData\\TisTis\\Agent\\Logs",
      "RetainDays": 30,
      "MaxFileSizeMb": 10,
      "WriteToEventLog": true,
      "EventLogSource": "TisTis.Agent"
    }
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| FASE 6 | 2026-01-30 | Initial security hardening release |

---

*For additional support, contact: soporte@tistis.com*
