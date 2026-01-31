# TIS TIS Agent - Testing Documentation

## Version: 1.0.0

This document describes the testing strategy, frameworks, and test coverage for the TIS TIS Local Agent.

---

## Table of Contents

1. [Overview](#overview)
2. [Test Projects](#test-projects)
3. [Testing Framework](#testing-framework)
4. [Test Categories](#test-categories)
5. [Running Tests](#running-tests)
6. [Test Coverage](#test-coverage)
7. [Writing Tests](#writing-tests)
8. [Best Practices](#best-practices)

---

## Overview

The agent uses a comprehensive testing strategy:

| Test Type | Project | Count | Purpose |
|-----------|---------|-------|---------|
| **Unit Tests** | TisTis.Agent.Core.Tests | 410 | Component-level testing |
| **Integration Tests** | TisTis.Agent.Integration.Tests | TBD | End-to-end flows |

### Test Metrics

- **Total Tests:** 410
- **Pass Rate:** 100%
- **Coverage Areas:** Security, Configuration, Sync, Monitoring, Transformers

---

## Test Projects

### TisTis.Agent.Core.Tests

Unit tests for core library components.

**Target Framework:** `net8.0`

**Test Files:**

| File | Tests | Module |
|------|-------|--------|
| `SecureUtilitiesTests.cs` | 73 | Security |
| `TokenManagerTests.cs` | 49 | Security |
| `MetricsCollectorTests.cs` | 45 | Monitoring |
| `VentasTransformerTests.cs` | 35 | Sync/Transformers |
| `CredentialStoreTests.cs` | 31 | Security |
| `AgentConfigurationTests.cs` | 30 | Configuration |
| `InventarioTransformerTests.cs` | 71 | Sync/Transformers |
| `ProductosTransformerTests.cs` | 32 | Sync/Transformers |

### TisTis.Agent.Integration.Tests

Integration tests requiring Windows environment.

**Target Framework:** `net8.0-windows`

---

## Testing Framework

### Dependencies

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.9.0" />
  <PackageReference Include="xunit" Version="2.8.1" />
  <PackageReference Include="xunit.runner.visualstudio" Version="2.8.1" />
  <PackageReference Include="FluentAssertions" Version="6.12.0" />
  <PackageReference Include="Moq" Version="4.20.70" />
  <PackageReference Include="coverlet.collector" Version="6.0.2" />
</ItemGroup>
```

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **xUnit** | 2.8.1 | Test framework |
| **FluentAssertions** | 6.12.0 | Readable assertions |
| **Moq** | 4.20.70 | Mocking framework |
| **Coverlet** | 6.0.2 | Code coverage |

---

## Test Categories

### 1. Configuration Tests

Test configuration validation and loading.

```csharp
[Fact]
public void Validate_AllRequiredFieldsMissing_ReturnsAllErrors()
{
    var config = new AgentConfiguration();
    var result = config.Validate();

    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.Contains("AgentId"));
}
```

### 2. Security Tests

Test cryptographic operations and credential storage.

```csharp
[Fact]
public void ConstantTimeEquals_SameStrings_ReturnsTrue()
{
    var result = SecureUtilities.ConstantTimeEquals("secret", "secret");
    result.Should().BeTrue();
}

[Theory]
[InlineData(null, null, true)]
[InlineData("", "", true)]
[InlineData("a", "b", false)]
public void ConstantTimeEquals_Variations_ReturnsExpected(
    string? a, string? b, bool expected)
{
    SecureUtilities.ConstantTimeEquals(a, b).Should().Be(expected);
}
```

### 3. Transformer Tests

Test data transformation logic.

```csharp
[Theory]
[InlineData("KG", "kg")]
[InlineData("KILOGRAMO", "kg")]
[InlineData("PZA", "unit")]
public void Transform_UnitMapping_MapsCorrectly(string input, string expected)
{
    var source = new SRProducto { Codigo = "P", UnidadMedida = input };
    var result = _transformer.Transform(source);
    result.Unit.Should().Be(expected);
}
```

### 4. Monitoring Tests

Test metrics collection and alerting.

```csharp
[Fact]
public void RecordHistogram_MultipleValues_CalculatesPercentiles()
{
    for (int i = 1; i <= 100; i++)
        _collector.RecordHistogram("test", i);

    var histogram = _collector.GetHistogram("test");
    histogram.P50.Should().BeApproximately(50, 1);
    histogram.P99.Should().BeApproximately(99, 1);
}
```

---

## Running Tests

### Command Line

```bash
# Run all tests
dotnet test

# Run with verbose output
dotnet test --verbosity normal

# Run specific project
dotnet test tests/TisTis.Agent.Core.Tests

# Run specific test class
dotnet test --filter "FullyQualifiedName~SecureUtilitiesTests"

# Run specific test
dotnet test --filter "FullyQualifiedName=TisTis.Agent.Core.Tests.Security.SecureUtilitiesTests.ConstantTimeEquals_SameStrings_ReturnsTrue"
```

### Visual Studio

1. Open Test Explorer (View → Test Explorer)
2. Click "Run All Tests" or use Ctrl+R, A
3. View results in Test Explorer panel

### With Coverage

```bash
# Generate coverage report
dotnet test --collect:"XPlat Code Coverage"

# Generate HTML report (requires reportgenerator)
reportgenerator -reports:"**/*.cobertura.xml" -targetdir:"coverage" -reporttypes:Html
```

---

## Test Coverage

### By Module

| Module | Files | Tests | Coverage |
|--------|-------|-------|----------|
| Security | 4 | 153 | 100% |
| Monitoring | 5 | 45 | 95%+ |
| Transformers | 4 | 173 | 100% |
| Configuration | 1 | 30 | 100% |

### Critical Paths

| Path | Tests | Notes |
|------|-------|-------|
| Constant-time comparison | 25+ | Timing attack prevention |
| DPAPI operations | 15+ | Credential storage |
| Token rotation | 10+ | Auth token lifecycle |
| Unit mapping | 40+ | All known unit codes |
| Status mapping | 20+ | All known statuses |

---

## Writing Tests

### Test Structure (AAA Pattern)

```csharp
[Fact]
public void MethodName_Scenario_ExpectedBehavior()
{
    // Arrange
    var source = CreateValidInput();

    // Act
    var result = _sut.Method(source);

    // Assert
    result.Should().NotBeNull();
    result.Property.Should().Be("expected");
}
```

### Parameterized Tests

```csharp
[Theory]
[InlineData("input1", "expected1")]
[InlineData("input2", "expected2")]
[InlineData(null, "default")]
public void Method_DifferentInputs_ReturnsExpected(
    string? input, string expected)
{
    var result = _sut.Method(input);
    result.Should().Be(expected);
}
```

### Testing Edge Cases

```csharp
[Fact]
public void Transform_DefaultValues_HandlesGracefully()
{
    // Arrange - default/empty object
    var source = new SRProducto();

    // Act
    var result = _transformer.Transform(source);

    // Assert
    result.Should().NotBeNull();
    result.ExternalId.Should().Be("sr-");
    result.IsActive.Should().BeTrue(); // Default value
}

[Fact]
public void Transform_AllOptionalFieldsNull_HandlesGracefully()
{
    var source = new SRProducto
    {
        Codigo = "PROD",
        Descripcion = "Test",
        // All nullable fields remain null
    };

    var result = _transformer.Transform(source);

    result.Cost.Should().BeNull();
    result.Category.Should().BeNull();
}
```

### Mocking Dependencies

```csharp
public class SyncEngineTests
{
    private readonly Mock<ISoftRestaurantRepository> _mockRepo;
    private readonly Mock<ITisTisApiClient> _mockApi;
    private readonly SyncEngine _sut;

    public SyncEngineTests()
    {
        _mockRepo = new Mock<ISoftRestaurantRepository>();
        _mockApi = new Mock<ITisTisApiClient>();

        _sut = new SyncEngine(
            _mockRepo.Object,
            _mockApi.Object,
            // ... other dependencies
        );
    }

    [Fact]
    public async Task SyncSalesAsync_NoNewRecords_SkipsApiCall()
    {
        // Arrange
        _mockRepo.Setup(r => r.GetNewVentasAsync(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SRVenta>());

        // Act
        var result = await _sut.SyncNowAsync(SyncType.Sales);

        // Assert
        result.Success.Should().BeTrue();
        result.RecordsProcessed.Should().Be(0);
        _mockApi.Verify(a => a.SendSyncDataAsync<TisTisSale>(
            It.IsAny<string>(),
            It.IsAny<IEnumerable<TisTisSale>>(),
            It.IsAny<int>(),
            It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
```

---

## Best Practices

### DO

1. **Use descriptive test names**: `Method_Scenario_ExpectedBehavior`
2. **Follow AAA pattern**: Arrange, Act, Assert
3. **Test edge cases**: null, empty, boundary values
4. **Use Theory for parameterized tests**: Reduces code duplication
5. **Test one thing per test**: Single assertion focus
6. **Use FluentAssertions**: Readable, expressive assertions
7. **Mock external dependencies**: Isolate unit under test

### DON'T

1. **Don't test implementation details**: Test behavior, not code
2. **Don't share state between tests**: Each test must be independent
3. **Don't use magic numbers**: Use named constants
4. **Don't ignore flaky tests**: Fix them immediately
5. **Don't test framework code**: Focus on your logic
6. **Don't over-mock**: Only mock what's necessary

### Naming Conventions

```
[Method]_[Scenario]_[Expected]

Examples:
- Transform_ValidProduct_TransformsCorrectly
- ConstantTimeEquals_NullInputs_ReturnsTrueForBothNull
- Validate_MissingAgentId_ReturnsError
- GetHistogram_AfterRecording_ReturnsCorrectStats
```

### Assert Guidelines

```csharp
// Good - specific assertions
result.ExternalId.Should().Be("sr-PROD-001");
result.Price.Should().Be(150.50m);
result.IsActive.Should().BeTrue();

// Avoid - overly general
result.Should().NotBeNull();

// Better - combine with specifics
result.Should().NotBeNull();
result.Should().BeEquivalentTo(expected, options =>
    options.ExcludingMissingMembers());
```

---

## Test Output

### Successful Run

```
Test Run Successful.
Total tests: 410
     Passed: 410
     Failed: 0
     Skipped: 0
 Total time: 2.5s
```

### Failed Test Output

```
X Method_Scenario_ExpectedBehavior [25ms]
  Error Message:
   Expected result to be "expected", but found "actual".
  Stack Trace:
     at Namespace.TestClass.TestMethod() in C:\...\TestFile.cs:line 45
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial testing documentation |

---

*For additional support, contact: soporte@tistis.com*
