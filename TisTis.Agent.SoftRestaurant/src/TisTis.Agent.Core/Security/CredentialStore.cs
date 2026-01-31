// =====================================================
// TIS TIS PLATFORM - Credential Store
// Secure storage of credentials using DPAPI
// FIX SEC-01: Added secure memory clearing
// FIX SEC-06: Implements IDisposable for resource cleanup
// =====================================================

using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace TisTis.Agent.Core.Security;

/// <summary>
/// Secure credential storage using Windows Data Protection API (DPAPI).
/// Implements IDisposable for proper resource cleanup.
/// FIX SEC-01: Clears sensitive data from memory after use.
/// FIX SEC-06: Proper disposal pattern implementation.
/// </summary>
public class CredentialStore : IDisposable
{
    private readonly string _storePath;
    private readonly ILogger<CredentialStore> _logger;
    private readonly bool _useDataProtection;
    private readonly object _fileLock = new();
    private bool _disposed;

    /// <summary>
    /// Create a new credential store
    /// </summary>
    /// <param name="storePath">Path to the credential file</param>
    /// <param name="useDataProtection">Whether to use DPAPI encryption</param>
    /// <param name="logger">Logger instance</param>
    public CredentialStore(string storePath, bool useDataProtection, ILogger<CredentialStore> logger)
    {
        _storePath = storePath;
        _useDataProtection = useDataProtection;
        _logger = logger;

        // Ensure directory exists with restricted permissions
        var directory = Path.GetDirectoryName(storePath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
            SetDirectoryPermissions(directory);
        }
    }

    /// <summary>
    /// Set restrictive permissions on the credential directory (Windows only)
    /// </summary>
    private void SetDirectoryPermissions(string directoryPath)
    {
        try
        {
            if (!OperatingSystem.IsWindows()) return;

            var directoryInfo = new DirectoryInfo(directoryPath);
            var security = directoryInfo.GetAccessControl();

            // Remove inherited permissions
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);

            // Only allow SYSTEM and Administrators
            var systemIdentity = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var adminIdentity = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);

            security.AddAccessRule(new FileSystemAccessRule(
                systemIdentity,
                FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));

            security.AddAccessRule(new FileSystemAccessRule(
                adminIdentity,
                FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));

            directoryInfo.SetAccessControl(security);
            _logger.LogDebug("Set restrictive permissions on credential directory: {Path}", directoryPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not set directory permissions (may require elevated privileges)");
        }
    }

    /// <summary>
    /// Set restrictive permissions on the credential file (Windows only)
    /// </summary>
    private void SetFilePermissions()
    {
        try
        {
            if (!OperatingSystem.IsWindows() || !File.Exists(_storePath)) return;

            var fileInfo = new FileInfo(_storePath);
            var security = fileInfo.GetAccessControl();

            // Remove inherited permissions
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);

            // Only allow SYSTEM and Administrators
            var systemIdentity = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var adminIdentity = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);

            security.AddAccessRule(new FileSystemAccessRule(
                systemIdentity,
                FileSystemRights.FullControl,
                AccessControlType.Allow));

            security.AddAccessRule(new FileSystemAccessRule(
                adminIdentity,
                FileSystemRights.FullControl,
                AccessControlType.Allow));

            fileInfo.SetAccessControl(security);
            _logger.LogDebug("Set restrictive permissions on credential file");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not set file permissions (may require elevated privileges)");
        }
    }

    /// <summary>
    /// Store credentials securely (thread-safe with file locking)
    /// FIX SEC-01: Clears plaintext data from memory after encryption.
    /// </summary>
    public void Store(StoredCredentials credentials)
    {
        ThrowIfDisposed();

        // Validate credentials before storing
        if (credentials == null)
            throw new ArgumentNullException(nameof(credentials));

        if (!SecureUtilities.ValidateTokenFormat(credentials.AuthToken))
            throw new ArgumentException("Invalid token format", nameof(credentials));

        lock (_fileLock)
        {
            byte[]? plainBytes = null;
            byte[]? encryptedData = null;

            try
            {
                var json = JsonSerializer.Serialize(credentials);
                plainBytes = Encoding.UTF8.GetBytes(json);

                // FIX SEC-01: Validate data size to prevent DoS
                if (!SecureUtilities.ValidateDataSize(plainBytes))
                {
                    throw new InvalidOperationException(
                        $"Credential data exceeds maximum allowed size ({SecureUtilities.MaxCredentialSizeBytes} bytes)");
                }

                if (_useDataProtection)
                {
                    // Encrypt with DPAPI (machine-scoped)
                    encryptedData = ProtectedData.Protect(plainBytes, null, DataProtectionScope.LocalMachine);
                    _logger.LogDebug("Credentials encrypted with DPAPI");
                }
                else
                {
                    encryptedData = plainBytes;
                    plainBytes = null; // Don't clear, we're using it directly
                    _logger.LogWarning("Credentials stored without encryption (development mode)");
                }

                // Write with exclusive file lock
                using (var fileStream = new FileStream(_storePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    fileStream.Write(encryptedData, 0, encryptedData.Length);
                }

                // Set restrictive file permissions
                SetFilePermissions();

                // FIX SEC-02: Log without exposing sensitive paths in production
                _logger.LogInformation("Credentials stored successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to store credentials");
                throw;
            }
            finally
            {
                // FIX SEC-01: Clear sensitive data from memory
                SecureUtilities.ClearBytes(plainBytes);
                // Note: encryptedData is not sensitive, but clear for consistency
                SecureUtilities.ClearBytes(encryptedData);
            }
        }
    }

    /// <summary>
    /// Retrieve stored credentials (thread-safe with file locking)
    /// FIX SEC-01: Clears decrypted data from memory after parsing.
    /// </summary>
    public StoredCredentials? Retrieve()
    {
        ThrowIfDisposed();

        if (!File.Exists(_storePath))
        {
            _logger.LogWarning("Credential store not found");
            return null;
        }

        lock (_fileLock)
        {
            byte[]? encryptedData = null;
            byte[]? plainBytes = null;

            try
            {
                using (var fileStream = new FileStream(_storePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    // FIX SEC-01: Validate file size before reading
                    if (fileStream.Length > SecureUtilities.MaxCredentialSizeBytes)
                    {
                        throw new InvalidOperationException("Credential file exceeds maximum allowed size");
                    }

                    encryptedData = new byte[fileStream.Length];
                    fileStream.Read(encryptedData, 0, encryptedData.Length);
                }

                if (_useDataProtection)
                {
                    // Decrypt with DPAPI
                    plainBytes = ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.LocalMachine);
                }
                else
                {
                    plainBytes = encryptedData;
                    encryptedData = null; // Don't double-clear
                }

                var json = Encoding.UTF8.GetString(plainBytes);
                var credentials = JsonSerializer.Deserialize<StoredCredentials>(json);

                // Validate retrieved credentials
                if (credentials != null && !SecureUtilities.ValidateTokenFormat(credentials.AuthToken))
                {
                    _logger.LogWarning("Retrieved credentials contain invalid token format");
                }

                return credentials;
            }
            catch (CryptographicException ex)
            {
                _logger.LogError(ex, "Failed to decrypt credentials. This may happen if the credential file " +
                                      "was created on a different machine or with different Windows account");
                throw new InvalidOperationException("Failed to decrypt credentials. Please reinstall the agent.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve credentials");
                throw;
            }
            finally
            {
                // FIX SEC-01: Clear sensitive data from memory
                SecureUtilities.ClearBytes(plainBytes);
                SecureUtilities.ClearBytes(encryptedData);
            }
        }
    }

    /// <summary>
    /// Delete stored credentials
    /// </summary>
    public void Delete()
    {
        ThrowIfDisposed();

        lock (_fileLock)
        {
            if (File.Exists(_storePath))
            {
                // FIX SEC-01: Overwrite file with random data before deleting
                // to prevent recovery of sensitive data
                try
                {
                    var fileInfo = new FileInfo(_storePath);
                    var size = (int)fileInfo.Length;
                    if (size > 0)
                    {
                        var randomData = SecureUtilities.GenerateSecureBytes(size);
                        try
                        {
                            File.WriteAllBytes(_storePath, randomData);
                        }
                        finally
                        {
                            SecureUtilities.ClearBytes(randomData);
                        }
                    }
                }
                catch
                {
                    // Best effort - proceed with deletion even if overwrite fails
                }

                File.Delete(_storePath);
                _logger.LogInformation("Credentials securely deleted");
            }
        }
    }

    /// <summary>
    /// Check if credentials exist
    /// </summary>
    public bool Exists()
    {
        ThrowIfDisposed();
        return File.Exists(_storePath);
    }

    /// <summary>
    /// Update auth token
    /// FIX SEC-03: Validates token format before storing.
    /// </summary>
    public void UpdateToken(string newToken)
    {
        ThrowIfDisposed();

        if (!SecureUtilities.ValidateTokenFormat(newToken))
            throw new ArgumentException("Invalid token format", nameof(newToken));

        var credentials = Retrieve();
        if (credentials != null)
        {
            credentials.AuthToken = newToken;
            credentials.TokenUpdatedAt = DateTime.UtcNow;
            Store(credentials);
            _logger.LogInformation("Auth token updated (hash: {Hash})",
                SecureUtilities.ComputeHashPrefix(newToken));
        }
    }

    /// <summary>
    /// FIX SEC-06: Dispose pattern implementation.
    /// </summary>
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// FIX SEC-06: Protected dispose method.
    /// </summary>
    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            // No managed resources to dispose in this class,
            // but pattern is implemented for future use
            _logger.LogDebug("CredentialStore disposed");
        }

        _disposed = true;
    }

    /// <summary>
    /// Throws ObjectDisposedException if disposed.
    /// </summary>
    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(CredentialStore));
    }
}

/// <summary>
/// Stored credentials model
/// </summary>
public class StoredCredentials
{
    public string AgentId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string IntegrationId { get; set; } = string.Empty;
    public string? BranchId { get; set; }
    public string AuthToken { get; set; } = string.Empty;
    public string? SqlConnectionString { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? TokenUpdatedAt { get; set; }
}
