// =====================================================
// TIS TIS PLATFORM - CredentialStore Unit Tests
// Comprehensive tests for secure credential storage
// =====================================================

using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using TisTis.Agent.Core.Security;
using Xunit;

namespace TisTis.Agent.Core.Tests.Security;

/// <summary>
/// Unit tests for CredentialStore class.
/// Tests secure credential storage, retrieval, and lifecycle.
/// Note: Tests run with DPAPI disabled for cross-platform compatibility.
/// </summary>
public class CredentialStoreTests : IDisposable
{
    private readonly Mock<ILogger<CredentialStore>> _mockLogger;
    private readonly string _tempDirectory;
    private readonly List<string> _tempFiles = new();

    public CredentialStoreTests()
    {
        _mockLogger = new Mock<ILogger<CredentialStore>>();
        _tempDirectory = Path.Combine(Path.GetTempPath(), $"tistis-cred-test-{Guid.NewGuid()}");
        Directory.CreateDirectory(_tempDirectory);
    }

    public void Dispose()
    {
        // Clean up all temp files
        foreach (var file in _tempFiles)
        {
            try { if (File.Exists(file)) File.Delete(file); } catch { }
        }

        // Clean up temp directory
        try
        {
            if (Directory.Exists(_tempDirectory))
                Directory.Delete(_tempDirectory, recursive: true);
        }
        catch { }
    }

    private string GetTempStorePath()
    {
        var path = Path.Combine(_tempDirectory, $"creds-{Guid.NewGuid()}.dat");
        _tempFiles.Add(path);
        return path;
    }

    private CredentialStore CreateStore(string? path = null, bool useDpapi = false)
    {
        return new CredentialStore(
            path ?? GetTempStorePath(),
            useDpapi,
            _mockLogger.Object);
    }

    private StoredCredentials CreateValidCredentials()
    {
        return new StoredCredentials
        {
            AgentId = "test-agent-001",
            TenantId = "test-tenant-001",
            IntegrationId = "test-integration-001",
            BranchId = "test-branch-001",
            AuthToken = "valid-auth-token-12345678901234567890",
            SqlConnectionString = "Server=localhost;Database=TestDB;Trusted_Connection=true"
        };
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_CreatesDirectoryIfNotExists()
    {
        // Arrange
        var newDir = Path.Combine(_tempDirectory, "new-subdir");
        var storePath = Path.Combine(newDir, "credentials.dat");

        // Act
        using var store = new CredentialStore(storePath, false, _mockLogger.Object);

        // Assert
        Directory.Exists(newDir).Should().BeTrue();
    }

    [Fact]
    public void Constructor_ValidParameters_CreatesInstance()
    {
        // Act
        using var store = CreateStore();

        // Assert
        store.Should().NotBeNull();
    }

    #endregion

    #region Store Tests

    [Fact]
    public void Store_ValidCredentials_CreatesFile()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var credentials = CreateValidCredentials();

        // Act
        store.Store(credentials);

        // Assert
        File.Exists(path).Should().BeTrue();
    }

    [Fact]
    public void Store_NullCredentials_ThrowsArgumentNullException()
    {
        // Arrange
        using var store = CreateStore();

        // Act & Assert
        var action = () => store.Store(null!);
        action.Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void Store_InvalidTokenFormat_ThrowsArgumentException()
    {
        // Arrange
        using var store = CreateStore();
        var credentials = CreateValidCredentials();
        credentials.AuthToken = "invalid\ntoken\twith\rcontrol\0chars";

        // Act & Assert
        var action = () => store.Store(credentials);
        action.Should().Throw<ArgumentException>()
            .WithMessage("*Invalid token format*");
    }

    [Fact]
    public void Store_OversizedData_ThrowsInvalidOperationException()
    {
        // Arrange
        using var store = CreateStore();
        var credentials = CreateValidCredentials();
        // Use a valid token but make the SQL connection string oversized
        // This bypasses token validation but still triggers size validation
        credentials.SqlConnectionString = new string('x', SecureUtilities.MaxCredentialSizeBytes);

        // Act & Assert
        var action = () => store.Store(credentials);
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*exceeds maximum allowed size*");
    }

    [Fact]
    public void Store_OverwritesExistingFile()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);

        var credentials1 = CreateValidCredentials();
        credentials1.AgentId = "first-agent-id";
        store.Store(credentials1);

        var credentials2 = CreateValidCredentials();
        credentials2.AgentId = "second-agent-id";

        // Act
        store.Store(credentials2);

        // Assert
        var retrieved = store.Retrieve();
        retrieved!.AgentId.Should().Be("second-agent-id");
    }

    [Fact]
    public void Store_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var store = CreateStore();
        store.Dispose();

        // Act & Assert
        var action = () => store.Store(CreateValidCredentials());
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Retrieve Tests

    [Fact]
    public void Retrieve_StoredCredentials_ReturnsCorrectData()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var original = CreateValidCredentials();
        store.Store(original);

        // Act
        var retrieved = store.Retrieve();

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.AgentId.Should().Be(original.AgentId);
        retrieved.TenantId.Should().Be(original.TenantId);
        retrieved.IntegrationId.Should().Be(original.IntegrationId);
        retrieved.BranchId.Should().Be(original.BranchId);
        retrieved.AuthToken.Should().Be(original.AuthToken);
        retrieved.SqlConnectionString.Should().Be(original.SqlConnectionString);
    }

    [Fact]
    public void Retrieve_NoFile_ReturnsNull()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);

        // Act
        var retrieved = store.Retrieve();

        // Assert
        retrieved.Should().BeNull();
    }

    [Fact]
    public void Retrieve_PreservesTimestamps()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var original = CreateValidCredentials();
        var createdAt = DateTime.UtcNow.AddDays(-1);
        var updatedAt = DateTime.UtcNow.AddHours(-1);
        original.CreatedAt = createdAt;
        original.TokenUpdatedAt = updatedAt;
        store.Store(original);

        // Act
        var retrieved = store.Retrieve();

        // Assert
        retrieved!.CreatedAt.Should().BeCloseTo(createdAt, TimeSpan.FromSeconds(1));
        retrieved.TokenUpdatedAt.Should().BeCloseTo(updatedAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Retrieve_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var path = GetTempStorePath();
        var store = CreateStore(path);
        store.Store(CreateValidCredentials());
        store.Dispose();

        // Act & Assert
        var action = () => store.Retrieve();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Delete Tests

    [Fact]
    public void Delete_ExistingFile_RemovesFile()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        store.Store(CreateValidCredentials());
        File.Exists(path).Should().BeTrue();

        // Act
        store.Delete();

        // Assert
        File.Exists(path).Should().BeFalse();
    }

    [Fact]
    public void Delete_NonExistentFile_DoesNotThrow()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);

        // Act & Assert
        var action = () => store.Delete();
        action.Should().NotThrow();
    }

    [Fact]
    public void Delete_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var store = CreateStore();
        store.Dispose();

        // Act & Assert
        var action = () => store.Delete();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Exists Tests

    [Fact]
    public void Exists_FileExists_ReturnsTrue()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        store.Store(CreateValidCredentials());

        // Act
        var result = store.Exists();

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void Exists_NoFile_ReturnsFalse()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);

        // Act
        var result = store.Exists();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void Exists_AfterDelete_ReturnsFalse()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        store.Store(CreateValidCredentials());
        store.Delete();

        // Act
        var result = store.Exists();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void Exists_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var store = CreateStore();
        store.Dispose();

        // Act & Assert
        var action = () => store.Exists();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region UpdateToken Tests

    [Fact]
    public void UpdateToken_ExistingCredentials_UpdatesToken()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var original = CreateValidCredentials();
        store.Store(original);

        var newToken = "brand-new-token-xyz-123456789012345";

        // Act
        store.UpdateToken(newToken);

        // Assert
        var retrieved = store.Retrieve();
        retrieved!.AuthToken.Should().Be(newToken);
        retrieved.AgentId.Should().Be(original.AgentId); // Other fields preserved
    }

    [Fact]
    public void UpdateToken_SetsTokenUpdatedAt()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var original = CreateValidCredentials();
        original.TokenUpdatedAt = null;
        store.Store(original);

        // Act
        store.UpdateToken("new-token-with-timestamp-12345678901");

        // Assert
        var retrieved = store.Retrieve();
        retrieved!.TokenUpdatedAt.Should().NotBeNull();
        retrieved.TokenUpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void UpdateToken_InvalidFormat_ThrowsArgumentException()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        store.Store(CreateValidCredentials());

        // Act & Assert
        var action = () => store.UpdateToken("invalid\ntoken");
        action.Should().Throw<ArgumentException>()
            .WithMessage("*Invalid token format*");
    }

    [Fact]
    public void UpdateToken_NoExistingCredentials_DoesNothing()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);

        // Act - Should not throw, just do nothing
        store.UpdateToken("valid-token-123456789012345678901234");

        // Assert
        store.Exists().Should().BeFalse();
    }

    [Fact]
    public void UpdateToken_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var store = CreateStore();
        store.Dispose();

        // Act & Assert
        var action = () => store.UpdateToken("valid-token-123456789012345678901234");
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Thread Safety Tests

    [Fact]
    public async Task Store_ConcurrentCalls_ThreadSafe()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var exceptions = new List<Exception>();
        var tasks = new Task[20];

        // Act
        for (int i = 0; i < 20; i++)
        {
            int index = i;
            tasks[i] = Task.Run(() =>
            {
                try
                {
                    var creds = CreateValidCredentials();
                    creds.AgentId = $"agent-{index}";
                    store.Store(creds);
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
        store.Exists().Should().BeTrue();
    }

    [Fact]
    public async Task RetrieveAndStore_ConcurrentCalls_ThreadSafe()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        store.Store(CreateValidCredentials());
        var exceptions = new List<Exception>();
        var tasks = new Task[30];

        // Act - Mix of reads and writes
        for (int i = 0; i < 30; i++)
        {
            int index = i;
            tasks[i] = Task.Run(() =>
            {
                try
                {
                    if (index % 3 == 0)
                    {
                        var creds = CreateValidCredentials();
                        creds.AgentId = $"agent-{index}";
                        store.Store(creds);
                    }
                    else
                    {
                        var retrieved = store.Retrieve();
                        retrieved.Should().NotBeNull();
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

    #region Dispose Tests

    [Fact]
    public void Dispose_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        var store = CreateStore();

        // Act & Assert
        var action = () =>
        {
            store.Dispose();
            store.Dispose();
            store.Dispose();
        };
        action.Should().NotThrow();
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Store_EmptyOptionalFields_Succeeds()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var credentials = new StoredCredentials
        {
            AgentId = "agent-id",
            TenantId = "tenant-id",
            IntegrationId = "integration-id",
            BranchId = null, // Optional
            AuthToken = "valid-token-123456789012345678901234",
            SqlConnectionString = null // Optional
        };

        // Act
        store.Store(credentials);

        // Assert
        var retrieved = store.Retrieve();
        retrieved.Should().NotBeNull();
        retrieved!.BranchId.Should().BeNull();
        retrieved.SqlConnectionString.Should().BeNull();
    }

    [Fact]
    public void Store_SpecialCharactersInConnectionString_Preserved()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var credentials = CreateValidCredentials();
        credentials.SqlConnectionString = @"Server=192.168.1.1\SQLEXPRESS;Database=Test;User=sa;Password=P@$$w0rd!#%&*()";

        // Act
        store.Store(credentials);

        // Assert
        var retrieved = store.Retrieve();
        retrieved!.SqlConnectionString.Should().Be(credentials.SqlConnectionString);
    }

    [Fact]
    public void Store_UnicodeInAgentId_Preserved()
    {
        // Arrange
        var path = GetTempStorePath();
        using var store = CreateStore(path);
        var credentials = CreateValidCredentials();
        credentials.AgentId = "agent-日本語-тест-emoji-🚀";

        // Act
        store.Store(credentials);

        // Assert
        var retrieved = store.Retrieve();
        retrieved!.AgentId.Should().Be(credentials.AgentId);
    }

    #endregion
}

/// <summary>
/// Tests for StoredCredentials model
/// </summary>
public class StoredCredentialsTests
{
    [Fact]
    public void DefaultValues_AreCorrect()
    {
        // Act
        var credentials = new StoredCredentials();

        // Assert
        credentials.AgentId.Should().Be(string.Empty);
        credentials.TenantId.Should().Be(string.Empty);
        credentials.IntegrationId.Should().Be(string.Empty);
        credentials.BranchId.Should().BeNull();
        credentials.AuthToken.Should().Be(string.Empty);
        credentials.SqlConnectionString.Should().BeNull();
        credentials.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        credentials.TokenUpdatedAt.Should().BeNull();
    }
}
