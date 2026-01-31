# TIS TIS Agent - Development Guide

## Version: 1.0.0

This guide provides instructions for developers working on the TIS TIS Local Agent codebase.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Building](#building)
5. [Running Locally](#running-locally)
6. [Debugging](#debugging)
7. [Code Style](#code-style)
8. [Contributing](#contributing)

---

## Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| .NET SDK | 8.0+ | [dotnet.microsoft.com](https://dotnet.microsoft.com/download) |
| Visual Studio | 2022+ | [visualstudio.com](https://visualstudio.microsoft.com/) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com/) |
| SQL Server | 2016+ | For testing with SR database |

### Visual Studio Workloads

- .NET desktop development
- ASP.NET and web development (for debugging)

### Optional Tools

- WiX Toolset v4 (for installer development)
- SQL Server Management Studio
- Postman (for API testing)

---

## Getting Started

### Clone Repository

```bash
git clone https://github.com/tistis/tistis-platform.git
cd tistis-platform/TisTis.Agent.SoftRestaurant
```

### Open Solution

```bash
# Via command line
start TisTis.Agent.SoftRestaurant.sln

# Or open in Visual Studio
```

### Restore Packages

```bash
dotnet restore
```

### Build Solution

```bash
dotnet build
```

### Run Tests

```bash
dotnet test
```

---

## Project Structure

```
TisTis.Agent.SoftRestaurant/
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── CONFIGURATION.md
│   ├── DEVELOPMENT.md              # This file
│   ├── MONITORING.md
│   ├── SECURITY.md
│   ├── SYNC_ENGINE.md
│   ├── TESTING.md
│   ├── TRANSFORMERS.md
│   └── TROUBLESHOOTING.md
│
├── src/
│   ├── TisTis.Agent.Core/          # Core library (net8.0)
│   │   ├── Api/                    # API client
│   │   ├── Configuration/          # Configuration models
│   │   ├── Database/               # SQL Server repository
│   │   ├── Detection/              # SR detection
│   │   ├── Logging/                # Secure logging
│   │   ├── Monitoring/             # Health & metrics
│   │   ├── Security/               # Cryptography
│   │   └── Sync/                   # Sync engine & transformers
│   │
│   └── TisTis.Agent.Service/       # Windows Service (net8.0-windows)
│       ├── Program.cs
│       ├── AgentWorker.cs
│       ├── appsettings.json
│       └── appsettings.Development.json
│
├── tests/
│   ├── TisTis.Agent.Core.Tests/    # Unit tests
│   └── TisTis.Agent.Integration.Tests/
│
├── installer/                      # MSI installer (WiX)
│
└── TisTis.Agent.SoftRestaurant.sln
```

---

## Building

### Debug Build

```bash
dotnet build -c Debug
```

### Release Build

```bash
dotnet build -c Release
```

### Publish (Self-Contained)

```bash
dotnet publish src/TisTis.Agent.Service -c Release -r win-x64 --self-contained -o publish
```

### Build Specific Project

```bash
# Core library only
dotnet build src/TisTis.Agent.Core

# Service only
dotnet build src/TisTis.Agent.Service

# Tests only
dotnet build tests/TisTis.Agent.Core.Tests
```

---

## Running Locally

### As Console Application

```bash
cd src/TisTis.Agent.Service
dotnet run
```

### With Development Settings

```bash
dotnet run --environment Development
```

### Configuration for Local Development

Edit `appsettings.Development.json`:

```json
{
  "TisTisAgent": {
    "AgentId": "dev-agent-001",
    "TenantId": "dev-tenant",
    "IntegrationId": "dev-integration",
    "Api": {
      "BaseUrl": "https://localhost:5001",
      "ValidateSsl": false
    },
    "Logging": {
      "MinimumLevel": "Debug"
    }
  }
}
```

### Simulating Without SR Database

For testing without Soft Restaurant:

```csharp
// Use mock repository
builder.Services.AddSingleton<ISoftRestaurantRepository, MockSoftRestaurantRepository>();
```

---

## Debugging

### Visual Studio

1. Set `TisTis.Agent.Service` as startup project
2. Press F5 to start debugging
3. Set breakpoints in code

### Attach to Running Process

1. Start agent as console: `dotnet run`
2. Debug → Attach to Process
3. Select `TisTis.Agent.Service.exe`

### Remote Debugging

1. Publish with debug symbols
2. Install Remote Tools on target machine
3. Connect via Debug → Attach to Process → Remote

### Logging for Debug

```csharp
// Set minimum level in appsettings
"MinimumLevel": {
  "Default": "Debug",
  "Override": {
    "TisTis.Agent": "Verbose"
  }
}
```

### Inspecting State

```csharp
// Get statistics
var stats = _syncEngine.GetStatistics();

// Get health report
var health = await _monitoring.ForceHealthCheckAsync();

// Get metrics
var summary = _metrics.GetSummary();
```

---

## Code Style

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `SyncEngine` |
| Interfaces | I + PascalCase | `ISyncEngine` |
| Methods | PascalCase | `SyncNowAsync` |
| Properties | PascalCase | `CurrentStock` |
| Private fields | _camelCase | `_logger` |
| Constants | PascalCase | `MaxRetries` |
| Parameters | camelCase | `cancellationToken` |

### File Organization

```csharp
// 1. Using statements
using System;
using Microsoft.Extensions.Logging;

// 2. Namespace
namespace TisTis.Agent.Core.Sync;

// 3. Class documentation
/// <summary>
/// Description of the class
/// </summary>
public class SyncEngine : ISyncEngine
{
    // 4. Private fields
    private readonly ILogger<SyncEngine> _logger;

    // 5. Constructor
    public SyncEngine(ILogger<SyncEngine> logger)
    {
        _logger = logger;
    }

    // 6. Public properties
    public SyncEngineState State { get; }

    // 7. Public methods
    public async Task StartAsync(CancellationToken ct) { }

    // 8. Private methods
    private void UpdateStatistics() { }
}
```

### Async/Await

```csharp
// Use Async suffix
public async Task<SyncResult> SyncNowAsync(...)

// Always pass CancellationToken
public async Task<T> MethodAsync(CancellationToken cancellationToken = default)

// Use ConfigureAwait(false) in library code
await _httpClient.GetAsync(url, ct).ConfigureAwait(false);
```

### Error Handling

```csharp
try
{
    var result = await _api.SendAsync(data, ct);
    return result;
}
catch (HttpRequestException ex)
{
    _logger.LogError(ex, "API request failed");
    throw; // Re-throw or handle
}
catch (OperationCanceledException) when (ct.IsCancellationRequested)
{
    _logger.LogDebug("Operation cancelled");
    throw;
}
```

### Documentation

```csharp
/// <summary>
/// Brief description of the method.
/// </summary>
/// <param name="source">Description of source parameter</param>
/// <returns>Description of return value</returns>
/// <exception cref="ArgumentNullException">When source is null</exception>
public TTarget Transform(TSource source)
```

---

## Contributing

### Branch Strategy

```
main            # Production-ready code
├── develop     # Integration branch
├── feature/*   # New features
├── fix/*       # Bug fixes
└── release/*   # Release preparation
```

### Commit Messages

```
type(scope): brief description

- Detail 1
- Detail 2

Co-Authored-By: Developer <dev@example.com>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes with tests
3. Run `dotnet build` and `dotnet test`
4. Create PR to `develop`
5. Address review comments
6. Squash and merge

### Code Review Checklist

- [ ] Code compiles without warnings
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No sensitive data in code
- [ ] Follows code style guidelines

---

## Common Tasks

### Adding a New Transformer

1. Create model in `Database/Models/`
2. Create target model in `Sync/Transformers/`
3. Implement `IDataTransformer<TSource, TTarget>`
4. Add unit tests
5. Register in `SyncEngine`

### Adding a New API Endpoint

1. Add endpoint to `ApiOptions`
2. Add method to `ITisTisApiClient`
3. Implement in `TisTisApiClient`
4. Add request/response models
5. Add unit tests

### Adding a Health Check

1. Add subsystem to `SubsystemType` enum
2. Implement check in `HealthCheckService`
3. Add tests
4. Update documentation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial development guide |

---

*For additional support, contact: soporte@tistis.com*
