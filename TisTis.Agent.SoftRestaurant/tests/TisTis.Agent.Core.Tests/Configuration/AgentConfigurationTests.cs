// =====================================================
// TIS TIS PLATFORM - AgentConfiguration Unit Tests
// Comprehensive tests for configuration validation
// =====================================================

using FluentAssertions;
using TisTis.Agent.Core.Configuration;
using Xunit;

namespace TisTis.Agent.Core.Tests.Configuration;

/// <summary>
/// Unit tests for AgentConfiguration and nested option classes.
/// Tests validation logic and default values.
/// </summary>
public class AgentConfigurationTests
{
    #region Default Values Tests

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        // Act
        var config = new AgentConfiguration();

        // Assert
        config.AgentId.Should().Be(string.Empty);
        config.AuthToken.Should().Be(string.Empty);
        config.TenantId.Should().Be(string.Empty);
        config.IntegrationId.Should().Be(string.Empty);
        config.BranchId.Should().BeNull();
        config.Version.Should().Be("1.0.0");
        config.Api.Should().NotBeNull();
        config.SoftRestaurant.Should().NotBeNull();
        config.Sync.Should().NotBeNull();
        config.Logging.Should().NotBeNull();
        config.Security.Should().NotBeNull();
    }

    [Fact]
    public void SectionName_IsTisTisAgent()
    {
        // Assert
        AgentConfiguration.SectionName.Should().Be("TisTisAgent");
    }

    #endregion

    #region Validation Tests - AgentConfiguration

    [Fact]
    public void Validate_ValidConfig_ReturnsSuccess()
    {
        // Arrange
        var config = CreateValidConfig();

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void Validate_MissingAgentId_ReturnsError()
    {
        // Arrange
        var config = CreateValidConfig();
        config.AgentId = "";

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("AgentId is required");
    }

    [Fact]
    public void Validate_MissingTenantId_ReturnsError()
    {
        // Arrange
        var config = CreateValidConfig();
        config.TenantId = "";

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("TenantId is required");
    }

    [Fact]
    public void Validate_MissingIntegrationId_ReturnsError()
    {
        // Arrange
        var config = CreateValidConfig();
        config.IntegrationId = "";

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("IntegrationId is required");
    }

    [Fact]
    public void Validate_MissingApiBaseUrl_ReturnsError()
    {
        // Arrange
        var config = CreateValidConfig();
        config.Api.BaseUrl = "";

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("Api.BaseUrl is required");
    }

    [Fact]
    public void Validate_MultipleErrors_ReturnsAllErrors()
    {
        // Arrange
        var config = new AgentConfiguration(); // All defaults, most required fields empty

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().HaveCountGreaterOrEqualTo(3); // At least AgentId, TenantId, IntegrationId
    }

    [Fact]
    public void Validate_WhitespaceOnly_TreatedAsEmpty()
    {
        // Arrange
        var config = CreateValidConfig();
        config.AgentId = "   ";

        // Act
        var result = config.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("AgentId is required");
    }

    #endregion

    #region ApiOptions Validation Tests

    [Fact]
    public void ApiOptions_DefaultValues_AreCorrect()
    {
        // Act
        var options = new ApiOptions();

        // Assert
        options.BaseUrl.Should().Be("https://app.tistis.com");
        options.RegisterEndpoint.Should().Be("/api/agent/register");
        options.HeartbeatEndpoint.Should().Be("/api/agent/heartbeat");
        options.SyncEndpoint.Should().Be("/api/agent/sync");
        options.TimeoutSeconds.Should().Be(30);
        options.MaxRetries.Should().Be(3);
        options.RetryDelayMs.Should().Be(1000);
        options.ValidateSsl.Should().BeTrue();
    }

    [Fact]
    public void ApiOptions_Validate_ValidConfig_ReturnsSuccess()
    {
        // Arrange
        var options = new ApiOptions
        {
            BaseUrl = "https://api.tistis.com",
            TimeoutSeconds = 30,
            MaxRetries = 3
        };

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void ApiOptions_Validate_EmptyBaseUrl_ReturnsError()
    {
        // Arrange
        var options = new ApiOptions { BaseUrl = "" };

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("Api.BaseUrl is required");
    }

    [Fact]
    public void ApiOptions_Validate_InvalidBaseUrl_ReturnsError()
    {
        // Arrange
        var options = new ApiOptions { BaseUrl = "not-a-valid-url" };

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("Api.BaseUrl must be a valid HTTP(S) URL");
    }

    [Fact]
    public void ApiOptions_Validate_FtpUrl_ReturnsError()
    {
        // Arrange
        var options = new ApiOptions { BaseUrl = "ftp://server.com" };

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("Api.BaseUrl must be a valid HTTP(S) URL");
    }

    [Fact]
    public void ApiOptions_Validate_HttpUrl_ReturnsSuccess()
    {
        // Arrange
        var options = new ApiOptions { BaseUrl = "http://localhost:3000" };

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(4, false)]  // Below minimum
    [InlineData(5, true)]   // Minimum
    [InlineData(60, true)]  // Middle
    [InlineData(120, true)] // Maximum
    [InlineData(121, false)] // Above maximum
    public void ApiOptions_Validate_TimeoutSeconds_RespectsLimits(int timeout, bool shouldBeValid)
    {
        // Arrange
        var options = new ApiOptions { TimeoutSeconds = timeout };

        // Act
        var result = options.Validate();

        // Assert
        if (shouldBeValid)
        {
            result.Errors.Should().NotContain(e => e.Contains("TimeoutSeconds"));
        }
        else
        {
            result.Errors.Should().Contain("Api.TimeoutSeconds must be between 5 and 120");
        }
    }

    [Theory]
    [InlineData(-1, false)] // Below minimum
    [InlineData(0, true)]   // Minimum (no retries)
    [InlineData(5, true)]   // Middle
    [InlineData(10, true)]  // Maximum
    [InlineData(11, false)] // Above maximum
    public void ApiOptions_Validate_MaxRetries_RespectsLimits(int retries, bool shouldBeValid)
    {
        // Arrange
        var options = new ApiOptions { MaxRetries = retries };

        // Act
        var result = options.Validate();

        // Assert
        if (shouldBeValid)
        {
            result.Errors.Should().NotContain(e => e.Contains("MaxRetries"));
        }
        else
        {
            result.Errors.Should().Contain("Api.MaxRetries must be between 0 and 10");
        }
    }

    #endregion

    #region SyncOptions Validation Tests

    [Fact]
    public void SyncOptions_DefaultValues_AreCorrect()
    {
        // Act
        var options = new SyncOptions();

        // Assert
        options.IntervalSeconds.Should().Be(30);
        options.SyncSales.Should().BeTrue();
        options.SyncMenu.Should().BeTrue();
        options.SyncInventory.Should().BeTrue();
        options.SyncTables.Should().BeFalse();
        options.BatchSize.Should().Be(100);
        options.MaxRecordsPerQuery.Should().Be(1000);
        options.HeartbeatIntervalSeconds.Should().Be(60);
        options.FullSyncIntervalMinutes.Should().Be(60);
        options.MaxConsecutiveErrors.Should().Be(5);
        options.ErrorPauseSeconds.Should().Be(300);
    }

    [Fact]
    public void SyncOptions_Validate_ValidConfig_ReturnsSuccess()
    {
        // Arrange
        var options = new SyncOptions(); // Defaults are valid

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Theory]
    [InlineData(9, false)]   // Below minimum
    [InlineData(10, true)]   // Minimum
    [InlineData(150, true)]  // Middle
    [InlineData(300, true)]  // Maximum
    [InlineData(301, false)] // Above maximum
    public void SyncOptions_Validate_IntervalSeconds_RespectsLimits(int interval, bool shouldBeValid)
    {
        // Arrange
        var options = new SyncOptions { IntervalSeconds = interval };

        // Act
        var result = options.Validate();

        // Assert
        if (shouldBeValid)
        {
            result.Errors.Should().NotContain(e => e.Contains("IntervalSeconds"));
        }
        else
        {
            result.Errors.Should().Contain("Sync.IntervalSeconds must be between 10 and 300");
        }
    }

    [Theory]
    [InlineData(9, false)]    // Below minimum
    [InlineData(10, true)]    // Minimum
    [InlineData(500, true)]   // Middle
    [InlineData(1000, true)]  // Maximum
    [InlineData(1001, false)] // Above maximum
    public void SyncOptions_Validate_BatchSize_RespectsLimits(int batchSize, bool shouldBeValid)
    {
        // Arrange
        var options = new SyncOptions { BatchSize = batchSize };

        // Act
        var result = options.Validate();

        // Assert
        if (shouldBeValid)
        {
            result.Errors.Should().NotContain(e => e.Contains("BatchSize"));
        }
        else
        {
            result.Errors.Should().Contain("Sync.BatchSize must be between 10 and 1000");
        }
    }

    [Theory]
    [InlineData(29, false)]  // Below minimum
    [InlineData(30, true)]   // Minimum
    [InlineData(150, true)]  // Middle
    [InlineData(300, true)]  // Maximum
    [InlineData(301, false)] // Above maximum
    public void SyncOptions_Validate_HeartbeatIntervalSeconds_RespectsLimits(int interval, bool shouldBeValid)
    {
        // Arrange
        var options = new SyncOptions { HeartbeatIntervalSeconds = interval };

        // Act
        var result = options.Validate();

        // Assert
        if (shouldBeValid)
        {
            result.Errors.Should().NotContain(e => e.Contains("HeartbeatIntervalSeconds"));
        }
        else
        {
            result.Errors.Should().Contain("Sync.HeartbeatIntervalSeconds must be between 30 and 300");
        }
    }

    [Fact]
    public void SyncOptions_Validate_NoSyncTypesEnabled_ReturnsError()
    {
        // Arrange
        var options = new SyncOptions
        {
            SyncSales = false,
            SyncMenu = false,
            SyncInventory = false,
            SyncTables = false
        };

        // Act
        var result = options.Validate();

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain("At least one sync type must be enabled");
    }

    [Fact]
    public void SyncOptions_Validate_OnlySyncTables_ReturnsSuccess()
    {
        // Arrange
        var options = new SyncOptions
        {
            SyncSales = false,
            SyncMenu = false,
            SyncInventory = false,
            SyncTables = true
        };

        // Act
        var result = options.Validate();

        // Assert
        result.Errors.Should().NotContain("At least one sync type must be enabled");
    }

    #endregion

    #region SoftRestaurantOptions Tests

    [Fact]
    public void SoftRestaurantOptions_DefaultValues_AreCorrect()
    {
        // Act
        var options = new SoftRestaurantOptions();

        // Assert
        options.ConnectionString.Should().Be(string.Empty);
        options.SqlInstance.Should().Be(string.Empty);
        options.DatabaseName.Should().Be(string.Empty);
        options.Version.Should().Be(string.Empty);
        options.EmpresaId.Should().Be(string.Empty);
        options.QueryTimeoutSeconds.Should().Be(60);
        options.MinPoolSize.Should().Be(1);
        options.MaxPoolSize.Should().Be(10);
    }

    #endregion

    #region LoggingOptions Tests

    [Fact]
    public void LoggingOptions_DefaultValues_AreCorrect()
    {
        // Act
        var options = new LoggingOptions();

        // Assert
        options.LogDirectory.Should().Be(@"C:\ProgramData\TisTis\Agent\Logs");
        options.MinimumLevel.Should().Be("Information");
        options.RetainDays.Should().Be(30);
        options.MaxFileSizeMb.Should().Be(10);
        options.WriteToEventLog.Should().BeTrue();
        options.EventLogSource.Should().Be("TisTis.Agent");
    }

    #endregion

    #region SecurityOptions Tests

    [Fact]
    public void SecurityOptions_DefaultValues_AreCorrect()
    {
        // Act
        var options = new SecurityOptions();

        // Assert
        options.UseDataProtection.Should().BeTrue();
        options.CredentialStorePath.Should().Be(@"C:\ProgramData\TisTis\Agent\credentials.dat");
        options.MinTlsVersion.Should().Be("Tls12");
        options.UseCertificatePinning.Should().BeFalse();
        options.CertificateThumbprint.Should().BeNull();
    }

    #endregion

    #region ValidationResult Tests

    [Fact]
    public void ValidationResult_Success_ReturnsValidResult()
    {
        // Act
        var result = ValidationResult.Success();

        // Assert
        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void ValidationResult_WithErrors_ReturnsInvalidResult()
    {
        // Act
        var result = new ValidationResult(false, new[] { "Error 1", "Error 2" });

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().HaveCount(2);
        result.Errors.Should().Contain("Error 1");
        result.Errors.Should().Contain("Error 2");
    }

    [Fact]
    public void ValidationResult_Errors_IsReadOnly()
    {
        // Act
        var result = new ValidationResult(false, new[] { "Error" });

        // Assert
        result.Errors.Should().BeAssignableTo<IReadOnlyList<string>>();
    }

    #endregion

    #region Helper Methods

    private static AgentConfiguration CreateValidConfig()
    {
        return new AgentConfiguration
        {
            AgentId = "test-agent-001",
            TenantId = "test-tenant-001",
            IntegrationId = "test-integration-001",
            AuthToken = "valid-token-12345678901234567890",
            Api = new ApiOptions
            {
                BaseUrl = "https://app.tistis.com",
                TimeoutSeconds = 30,
                MaxRetries = 3
            },
            Sync = new SyncOptions
            {
                IntervalSeconds = 30,
                SyncSales = true,
                BatchSize = 100,
                HeartbeatIntervalSeconds = 60
            }
        };
    }

    #endregion
}
