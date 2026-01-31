# TIS TIS Agent - Security Quick Reference

Quick reference guide for FASE 6 security components.

---

## Namespaces

```csharp
using TisTis.Agent.Core.Security;   // SecureUtilities, CredentialStore, TokenManager, CertificateValidator
using TisTis.Agent.Core.Logging;    // AgentLogger, SecureLogEnricher
```

---

## SecureUtilities

### Constant-Time Comparison

```csharp
// Strings
bool match = SecureUtilities.ConstantTimeEquals(token1, token2);

// Byte arrays
bool match = SecureUtilities.ConstantTimeEquals(hash1, hash2);
```

### Memory Clearing

```csharp
SecureUtilities.ClearBytes(sensitiveBytes);
SecureUtilities.ClearChars(passwordChars);
```

### Validation

```csharp
bool validToken = SecureUtilities.ValidateTokenFormat(token);  // Max 4096 chars, printable ASCII
bool validSize = SecureUtilities.ValidateDataSize(data);       // Max 64 KB
```

### Redaction (for logging)

```csharp
string partial = SecureUtilities.Redact(value, 4);           // "tis-***[20]***xxxx"
string full = SecureUtilities.RedactFull(value);             // "[redacted:128 chars]"
string hashId = SecureUtilities.ComputeHashPrefix(value);    // "a1b2c3d4e5f6g7h8"
```

### Random Generation

```csharp
byte[] bytes = SecureUtilities.GenerateSecureBytes(32);
string token = SecureUtilities.GenerateSecureToken(32);      // URL-safe Base64
```

---

## CredentialStore

```csharp
using var store = new CredentialStore(path, useDataProtection: true, logger);

// CRUD
store.Store(credentials);
var creds = store.Retrieve();
store.UpdateToken(newToken);
store.Delete();              // Secure delete (overwrites with random data)

// Check
bool exists = store.Exists();
```

---

## TokenManager

```csharp
using var tokenManager = new TokenManager(credentialStore, config, logger);

// Lifecycle
tokenManager.LoadFromStore();
string token = tokenManager.GetToken();
tokenManager.UpdateToken(newToken);
tokenManager.SaveToStore();

// Expiration
tokenManager.SetTokenExpiration(expiresAt);
bool expired = tokenManager.IsExpired();
bool needsRotate = tokenManager.NeedsRotation();
TimeSpan? remaining = tokenManager.GetTimeToExpiration();

// Secure comparison
bool match = TokenManager.SecureCompare(token1, token2);
```

---

## CertificateValidator

```csharp
var validator = new CertificateValidator(securityOptions, logger);

// HttpClient integration
handler.ServerCertificateCustomValidationCallback = validator.GetValidationCallback();

// Runtime pin management
validator.AddPinnedThumbprint("AABBCCDD...");
validator.AddPinnedPublicKeyHash("1234ABCD...");

// Status
bool pinning = validator.IsPinningEnabled;
int count = validator.PinnedCertificateCount;
```

---

## Logging

### Configure Logger

```csharp
var logger = AgentLogger.CreateLogger(loggingOptions);
```

### Extension Methods

```csharp
logger.LogSyncStarted("Sales", recordCount);
logger.LogSyncCompleted("Sales", processed, created, updated, duration);
logger.LogSyncFailed("Sales", exception);
logger.LogAgentRegistered(agentId, tenantName);  // Auto-redacted
logger.LogConnectionError(target, exception);     // Auto-sanitized
```

### Serilog Configuration

```csharp
new LoggerConfiguration()
    .Enrich.WithSecureDataRedaction()  // Add secure enricher
    .CreateLogger();
```

---

## Cheat Sheet

| Task | Method |
|------|--------|
| Compare secrets | `SecureUtilities.ConstantTimeEquals()` |
| Clear sensitive bytes | `SecureUtilities.ClearBytes()` |
| Clear password chars | `SecureUtilities.ClearChars()` |
| Log-safe redaction | `SecureUtilities.Redact()` |
| Generate secure random | `SecureUtilities.GenerateSecureToken()` |
| Validate token format | `SecureUtilities.ValidateTokenFormat()` |
| Store credentials | `CredentialStore.Store()` |
| Check token expiry | `TokenManager.NeedsRotation()` |
| SSL callback | `CertificateValidator.GetValidationCallback()` |

---

## Anti-Patterns

```csharp
// BAD: Timing attack vulnerable
if (token1 == token2) { }

// GOOD: Constant-time
if (SecureUtilities.ConstantTimeEquals(token1, token2)) { }
```

```csharp
// BAD: Exposes secret in logs
_logger.LogInformation("Token: {Token}", token);

// GOOD: Uses hash identifier
_logger.LogInformation("Token: {Hash}", SecureUtilities.ComputeHashPrefix(token));
```

```csharp
// BAD: Leaks sensitive data
var password = GetPassword();
// forgot to clear

// GOOD: Always clear
var password = GetPassword();
try { Use(password); }
finally { SecureUtilities.ClearChars(password); }
```

```csharp
// BAD: No disposal
var manager = new TokenManager(store, config, logger);

// GOOD: Using statement
using var manager = new TokenManager(store, config, logger);
```

---

## Files Reference

| Component | Path |
|-----------|------|
| SecureUtilities | `src/TisTis.Agent.Core/Security/SecureUtilities.cs` |
| CredentialStore | `src/TisTis.Agent.Core/Security/CredentialStore.cs` |
| TokenManager | `src/TisTis.Agent.Core/Security/TokenManager.cs` |
| CertificateValidator | `src/TisTis.Agent.Core/Security/CertificateValidator.cs` |
| SecureLogEnricher | `src/TisTis.Agent.Core/Logging/SecureLogEnricher.cs` |
| AgentLogger | `src/TisTis.Agent.Core/Logging/AgentLogger.cs` |

---

*Full documentation: [SECURITY.md](./SECURITY.md)*
