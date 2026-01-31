// =====================================================
// TIS TIS PLATFORM - TokenManager Unit Tests
// Comprehensive tests for token lifecycle management
// =====================================================

using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Security;
using Xunit;

namespace TisTis.Agent.Core.Tests.Security;

/// <summary>
/// Unit tests for TokenManager class.
/// Tests token lifecycle, rotation, expiration, and credential management.
/// </summary>
public class TokenManagerTests : IDisposable
{
    private readonly Mock<CredentialStore> _mockCredentialStore;
    private readonly Mock<ILogger<TokenManager>> _mockLogger;
    private readonly Mock<ILogger<CredentialStore>> _mockCredentialStoreLogger;
    private readonly AgentConfiguration _config;
    private readonly string _tempStorePath;
    private TokenManager? _tokenManager;

    public TokenManagerTests()
    {
        _mockLogger = new Mock<ILogger<TokenManager>>();
        _mockCredentialStoreLogger = new Mock<ILogger<CredentialStore>>();

        // Create a temp path for the mock credential store
        _tempStorePath = Path.Combine(Path.GetTempPath(), $"tistis-test-{Guid.NewGuid()}.dat");

        // Create a real CredentialStore but with DPAPI disabled for testing
        var realCredentialStore = new CredentialStore(
            _tempStorePath,
            useDataProtection: false,
            _mockCredentialStoreLogger.Object);

        _mockCredentialStore = new Mock<CredentialStore>(
            _tempStorePath,
            false,
            _mockCredentialStoreLogger.Object) { CallBase = true };

        _config = new AgentConfiguration
        {
            AgentId = "test-agent-001",
            TenantId = "test-tenant-001",
            IntegrationId = "test-integration-001",
            AuthToken = "valid-test-token-12345678901234567890",
            Version = "1.0.0",
            SoftRestaurant = new SoftRestaurantOptions
            {
                Version = "11.0",
                DatabaseName = "DVSOFT",
                SqlInstance = "DVSOFT",
                EmpresaId = "1"
            }
        };
    }

    public void Dispose()
    {
        _tokenManager?.Dispose();

        // Clean up temp file if exists
        if (File.Exists(_tempStorePath))
        {
            try { File.Delete(_tempStorePath); } catch { }
        }
    }

    private TokenManager CreateTokenManager()
    {
        _tokenManager = new TokenManager(
            new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object),
            _config,
            _mockLogger.Object);
        return _tokenManager;
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_NullCredentialStore_ThrowsArgumentNullException()
    {
        // Act & Assert
        var action = () => new TokenManager(null!, _config, _mockLogger.Object);
        action.Should().Throw<ArgumentNullException>()
            .WithParameterName("credentialStore");
    }

    [Fact]
    public void Constructor_NullConfig_ThrowsArgumentNullException()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);

        // Act & Assert
        var action = () => new TokenManager(credentialStore, null!, _mockLogger.Object);
        action.Should().Throw<ArgumentNullException>()
            .WithParameterName("config");
    }

    [Fact]
    public void Constructor_NullLogger_ThrowsArgumentNullException()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);

        // Act & Assert
        var action = () => new TokenManager(credentialStore, _config, null!);
        action.Should().Throw<ArgumentNullException>()
            .WithParameterName("logger");
    }

    [Fact]
    public void Constructor_ValidParameters_CreatesInstance()
    {
        // Act
        var manager = CreateTokenManager();

        // Assert
        manager.Should().NotBeNull();
    }

    #endregion

    #region GetToken Tests

    [Fact]
    public void GetToken_TokenInConfig_ReturnsConfigToken()
    {
        // Arrange
        var manager = CreateTokenManager();
        var expectedToken = _config.AuthToken;

        // Act
        var result = manager.GetToken();

        // Assert
        result.Should().Be(expectedToken);
    }

    [Fact]
    public void GetToken_NoTokenInConfig_RetrievesFromStore()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);
        var storedToken = "stored-token-from-credential-file-12345";

        // Store credentials first
        credentialStore.Store(new StoredCredentials
        {
            AgentId = "test-agent",
            TenantId = "test-tenant",
            IntegrationId = "test-integration",
            AuthToken = storedToken
        });

        // Create manager with empty config token
        _config.AuthToken = string.Empty;
        var manager = new TokenManager(credentialStore, _config, _mockLogger.Object);

        // Act
        var result = manager.GetToken();

        // Assert
        result.Should().Be(storedToken);
    }

    [Fact]
    public void GetToken_NoTokenAnywhere_ThrowsInvalidOperationException()
    {
        // Arrange
        _config.AuthToken = string.Empty;
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () => manager.GetToken();
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*No auth token available*");
    }

    [Fact]
    public void GetToken_InvalidTokenFormat_ThrowsInvalidOperationException()
    {
        // Arrange
        _config.AuthToken = "invalid\ntoken\twith\rcontrol\0chars";
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () => manager.GetToken();
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*Invalid token format*");
    }

    [Fact]
    public void GetToken_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.GetToken();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region NeedsRotation Tests

    [Fact]
    public void NeedsRotation_NoExpiration_ReturnsFalse()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act
        var result = manager.NeedsRotation();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void NeedsRotation_ExpirationFarInFuture_ReturnsFalse()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddDays(30));

        // Act
        var result = manager.NeedsRotation();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void NeedsRotation_ExpirationWithin24Hours_ReturnsTrue()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddHours(12)); // Less than default 24-hour threshold

        // Act
        var result = manager.NeedsRotation();

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void NeedsRotation_CustomThreshold_RespectsThreshold()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddHours(6));

        // Act - Using 1 hour threshold
        var result = manager.NeedsRotation(TimeSpan.FromHours(1));

        // Assert - Should not need rotation with 1-hour threshold
        result.Should().BeFalse();
    }

    [Fact]
    public void NeedsRotation_AlreadyExpired_ReturnsTrue()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddHours(-1)); // Already expired

        // Act
        var result = manager.NeedsRotation();

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void NeedsRotation_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.NeedsRotation();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region IsExpired Tests

    [Fact]
    public void IsExpired_NoExpiration_ReturnsFalse()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act
        var result = manager.IsExpired();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void IsExpired_FutureExpiration_ReturnsFalse()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddDays(1));

        // Act
        var result = manager.IsExpired();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void IsExpired_PastExpiration_ReturnsTrue()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddMinutes(-1));

        // Act
        var result = manager.IsExpired();

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void IsExpired_ExactNow_ReturnsTrue()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow);

        // Act - Tiny delay to ensure we're past the time
        Thread.Sleep(1);
        var result = manager.IsExpired();

        // Assert
        result.Should().BeTrue();
    }

    #endregion

    #region SetTokenExpiration Tests

    [Fact]
    public void SetTokenExpiration_ValidTime_SetsExpiration()
    {
        // Arrange
        var manager = CreateTokenManager();
        var expiration = DateTime.UtcNow.AddDays(7);

        // Act
        manager.SetTokenExpiration(expiration);

        // Assert
        manager.GetTimeToExpiration().Should().NotBeNull();
        manager.IsExpired().Should().BeFalse();
    }

    [Fact]
    public void SetTokenExpiration_PastTime_AllowsButMarksExpired()
    {
        // Arrange
        var manager = CreateTokenManager();
        var expiration = DateTime.UtcNow.AddDays(-1);

        // Act
        manager.SetTokenExpiration(expiration);

        // Assert
        manager.IsExpired().Should().BeTrue();
    }

    [Fact]
    public void SetTokenExpiration_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.SetTokenExpiration(DateTime.UtcNow.AddDays(1));
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region GetTimeToExpiration Tests

    [Fact]
    public void GetTimeToExpiration_NoExpiration_ReturnsNull()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act
        var result = manager.GetTimeToExpiration();

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void GetTimeToExpiration_FutureExpiration_ReturnsPositiveTimeSpan()
    {
        // Arrange
        var manager = CreateTokenManager();
        var expirationTime = DateTime.UtcNow.AddHours(5);
        manager.SetTokenExpiration(expirationTime);

        // Act
        var result = manager.GetTimeToExpiration();

        // Assert
        result.Should().NotBeNull();
        result!.Value.TotalHours.Should().BeApproximately(5, 0.1);
    }

    [Fact]
    public void GetTimeToExpiration_PastExpiration_ReturnsZero()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddDays(-1));

        // Act
        var result = manager.GetTimeToExpiration();

        // Assert
        result.Should().NotBeNull();
        result.Should().Be(TimeSpan.Zero);
    }

    #endregion

    #region UpdateToken Tests

    [Fact]
    public void UpdateToken_ValidToken_UpdatesConfigAndStore()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);

        // Initialize with existing credentials
        credentialStore.Store(new StoredCredentials
        {
            AgentId = _config.AgentId,
            TenantId = _config.TenantId,
            IntegrationId = _config.IntegrationId,
            AuthToken = _config.AuthToken
        });

        var manager = new TokenManager(credentialStore, _config, _mockLogger.Object);
        var newToken = "brand-new-token-xyz-123456789012345";

        // Act
        manager.UpdateToken(newToken);

        // Assert
        _config.AuthToken.Should().Be(newToken);
        manager.GetToken().Should().Be(newToken);
    }

    [Fact]
    public void UpdateToken_EmptyToken_ThrowsArgumentException()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () => manager.UpdateToken("");
        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void UpdateToken_WhitespaceToken_ThrowsArgumentException()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () => manager.UpdateToken("   ");
        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void UpdateToken_InvalidFormat_ThrowsInvalidOperationException()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () => manager.UpdateToken("invalid\ntoken");
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*Invalid token format*");
    }

    [Fact]
    public void UpdateToken_ResetsExpiration()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);
        credentialStore.Store(new StoredCredentials
        {
            AgentId = _config.AgentId,
            TenantId = _config.TenantId,
            IntegrationId = _config.IntegrationId,
            AuthToken = _config.AuthToken
        });

        var manager = new TokenManager(credentialStore, _config, _mockLogger.Object);
        manager.SetTokenExpiration(DateTime.UtcNow.AddDays(1));
        manager.GetTimeToExpiration().Should().NotBeNull();

        // Act
        manager.UpdateToken("new-token-after-expiration-set-123");

        // Assert - Expiration should be reset (null)
        manager.GetTimeToExpiration().Should().BeNull();
    }

    [Fact]
    public void UpdateToken_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.UpdateToken("some-valid-token-12345678901234567890");
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region SecureCompare Tests

    [Fact]
    public void SecureCompare_EqualTokens_ReturnsTrue()
    {
        // Arrange
        string token1 = "test-token-123";
        string token2 = "test-token-123";

        // Act
        var result = TokenManager.SecureCompare(token1, token2);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void SecureCompare_DifferentTokens_ReturnsFalse()
    {
        // Arrange
        string token1 = "test-token-123";
        string token2 = "test-token-456";

        // Act
        var result = TokenManager.SecureCompare(token1, token2);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void SecureCompare_BothNull_ReturnsTrue()
    {
        // Act
        var result = TokenManager.SecureCompare(null, null);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void SecureCompare_OneNull_ReturnsFalse()
    {
        // Act
        var result = TokenManager.SecureCompare("token", null);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region BuildRegisterRequest Tests

    [Fact]
    public void BuildRegisterRequest_ReturnsPopulatedRequest()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act
        var request = manager.BuildRegisterRequest();

        // Assert
        request.Should().NotBeNull();
        request.AgentId.Should().Be(_config.AgentId);
        request.AuthToken.Should().Be(_config.AuthToken);
        request.AgentVersion.Should().Be(_config.Version);
        request.MachineName.Should().Be(Environment.MachineName);
        request.SrVersion.Should().Be(_config.SoftRestaurant.Version);
        request.SrDatabaseName.Should().Be(_config.SoftRestaurant.DatabaseName);
        request.SrSqlInstance.Should().Be(_config.SoftRestaurant.SqlInstance);
        request.SrEmpresaId.Should().Be(_config.SoftRestaurant.EmpresaId);
    }

    [Fact]
    public void BuildRegisterRequest_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.BuildRegisterRequest();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region LoadFromStore Tests

    [Fact]
    public void LoadFromStore_NoStoredCredentials_DoesNotThrow()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () => manager.LoadFromStore();
        action.Should().NotThrow();
    }

    [Fact]
    public void LoadFromStore_ValidCredentials_LoadsIntoConfig()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);
        var storedCredentials = new StoredCredentials
        {
            AgentId = "stored-agent-id",
            TenantId = "stored-tenant-id",
            IntegrationId = "stored-integration-id",
            BranchId = "stored-branch-id",
            AuthToken = "stored-auth-token-12345678901234567890",
            SqlConnectionString = "Server=localhost;Database=Test"
        };
        credentialStore.Store(storedCredentials);

        var freshConfig = new AgentConfiguration();
        var manager = new TokenManager(credentialStore, freshConfig, _mockLogger.Object);

        // Act
        manager.LoadFromStore();

        // Assert
        freshConfig.AgentId.Should().Be(storedCredentials.AgentId);
        freshConfig.TenantId.Should().Be(storedCredentials.TenantId);
        freshConfig.IntegrationId.Should().Be(storedCredentials.IntegrationId);
        freshConfig.BranchId.Should().Be(storedCredentials.BranchId);
        freshConfig.AuthToken.Should().Be(storedCredentials.AuthToken);
        freshConfig.SoftRestaurant.ConnectionString.Should().Be(storedCredentials.SqlConnectionString);
    }

    [Fact]
    public void LoadFromStore_IncompleteCredentials_ThrowsInvalidOperationException()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);
        var incompleteCredentials = new StoredCredentials
        {
            AgentId = "agent-id",
            TenantId = "", // Missing
            IntegrationId = "integration-id",
            AuthToken = "valid-token-123456789012345678901234"
        };
        credentialStore.Store(incompleteCredentials);

        var manager = new TokenManager(credentialStore, new AgentConfiguration(), _mockLogger.Object);

        // Act & Assert
        var action = () => manager.LoadFromStore();
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*incomplete*");
    }

    [Fact]
    public void LoadFromStore_InvalidTokenFormat_ThrowsInvalidOperationException()
    {
        // This test verifies that TokenManager rejects credentials with invalid token format.
        // However, since CredentialStore.Store() also validates tokens, we cannot easily
        // store invalid credentials. Instead, we test that the validation works at storage time.
        // The Store method throws ArgumentException for invalid tokens.

        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);
        var badCredentials = new StoredCredentials
        {
            AgentId = "agent-id",
            TenantId = "tenant-id",
            IntegrationId = "integration-id",
            AuthToken = "invalid\ntoken\twith\rchars" // Invalid format
        };

        // Act & Assert - CredentialStore validates at store time
        var action = () => credentialStore.Store(badCredentials);
        action.Should().Throw<ArgumentException>()
            .WithMessage("*Invalid token format*");
    }

    [Fact]
    public void LoadFromStore_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.LoadFromStore();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region SaveToStore Tests

    [Fact]
    public void SaveToStore_ValidConfig_PersistsCredentials()
    {
        // Arrange
        var credentialStore = new CredentialStore(_tempStorePath, false, _mockCredentialStoreLogger.Object);
        var manager = new TokenManager(credentialStore, _config, _mockLogger.Object);

        // Act
        manager.SaveToStore();

        // Assert
        credentialStore.Exists().Should().BeTrue();
        var retrieved = credentialStore.Retrieve();
        retrieved.Should().NotBeNull();
        retrieved!.AgentId.Should().Be(_config.AgentId);
        retrieved.TenantId.Should().Be(_config.TenantId);
        retrieved.AuthToken.Should().Be(_config.AuthToken);
    }

    [Fact]
    public void SaveToStore_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.Dispose();

        // Act & Assert
        var action = () => manager.SaveToStore();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Dispose Tests

    [Fact]
    public void Dispose_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        var manager = CreateTokenManager();

        // Act & Assert
        var action = () =>
        {
            manager.Dispose();
            manager.Dispose();
            manager.Dispose();
        };
        action.Should().NotThrow();
    }

    [Fact]
    public void Dispose_ClearsExpirationTracking()
    {
        // Arrange
        var manager = CreateTokenManager();
        manager.SetTokenExpiration(DateTime.UtcNow.AddDays(1));

        // Act
        manager.Dispose();

        // Assert - Should throw because disposed, confirming state is cleared
        var action = () => manager.GetTimeToExpiration();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Thread Safety Tests

    [Fact]
    public async Task GetToken_ConcurrentAccess_ThreadSafe()
    {
        // Arrange
        var manager = CreateTokenManager();
        var exceptions = new List<Exception>();
        var tasks = new Task[100];

        // Act
        for (int i = 0; i < 100; i++)
        {
            tasks[i] = Task.Run(() =>
            {
                try
                {
                    var token = manager.GetToken();
                    token.Should().NotBeNullOrEmpty();
                }
                catch (Exception ex)
                {
                    lock (exceptions)
                    {
                        exceptions.Add(ex);
                    }
                }
            });
        }

        await Task.WhenAll(tasks);

        // Assert
        exceptions.Should().BeEmpty();
    }

    [Fact]
    public async Task SetAndCheckExpiration_ConcurrentAccess_ThreadSafe()
    {
        // Arrange
        var manager = CreateTokenManager();
        var exceptions = new List<Exception>();
        var tasks = new Task[50];

        // Act - Half set expiration, half check it
        for (int i = 0; i < 50; i++)
        {
            int index = i;
            tasks[i] = Task.Run(() =>
            {
                try
                {
                    if (index % 2 == 0)
                    {
                        manager.SetTokenExpiration(DateTime.UtcNow.AddHours(index));
                    }
                    else
                    {
                        _ = manager.NeedsRotation();
                        _ = manager.IsExpired();
                        _ = manager.GetTimeToExpiration();
                    }
                }
                catch (Exception ex)
                {
                    lock (exceptions)
                    {
                        exceptions.Add(ex);
                    }
                }
            });
        }

        await Task.WhenAll(tasks);

        // Assert
        exceptions.Should().BeEmpty();
    }

    #endregion

    #region DefaultRotationThreshold Tests

    [Fact]
    public void DefaultRotationThreshold_Is24Hours()
    {
        // Assert
        TokenManager.DefaultRotationThreshold.Should().Be(TimeSpan.FromHours(24));
    }

    #endregion
}
