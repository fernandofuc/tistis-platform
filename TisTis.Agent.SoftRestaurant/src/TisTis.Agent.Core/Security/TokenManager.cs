// =====================================================
// TIS TIS PLATFORM - Token Manager
// Manages authentication token lifecycle
// FIX SEC-02: Secure logging (no token exposure)
// FIX SEC-03: Token validation
// FIX SEC-05: Proactive expiration checking
// FIX SEC-06: IDisposable implementation
// =====================================================

using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Api.Requests;
using TisTis.Agent.Core.Configuration;

namespace TisTis.Agent.Core.Security;

/// <summary>
/// Manages authentication token lifecycle and rotation.
/// FIX SEC-02: Uses secure logging practices.
/// FIX SEC-03: Validates token format before use.
/// FIX SEC-05: Proactive token expiration management.
/// FIX SEC-06: Implements IDisposable for cleanup.
/// </summary>
public class TokenManager : IDisposable
{
    private readonly CredentialStore _credentialStore;
    private readonly AgentConfiguration _config;
    private readonly ILogger<TokenManager> _logger;
    private readonly object _tokenLock = new();

    private DateTime? _tokenExpiresAt;
    private DateTime? _lastTokenValidation;
    private bool _disposed;

    /// <summary>
    /// Default threshold for token rotation (24 hours before expiry)
    /// </summary>
    public static readonly TimeSpan DefaultRotationThreshold = TimeSpan.FromHours(24);

    /// <summary>
    /// Minimum interval between token validations
    /// </summary>
    private static readonly TimeSpan TokenValidationInterval = TimeSpan.FromMinutes(5);

    public TokenManager(
        CredentialStore credentialStore,
        AgentConfiguration config,
        ILogger<TokenManager> logger)
    {
        _credentialStore = credentialStore ?? throw new ArgumentNullException(nameof(credentialStore));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Get the current auth token.
    /// FIX SEC-03: Validates token format before returning.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when no valid token is available</exception>
    public string GetToken()
    {
        ThrowIfDisposed();

        lock (_tokenLock)
        {
            // First try from config (in-memory)
            if (!string.IsNullOrEmpty(_config.AuthToken))
            {
                ValidateTokenOrThrow(_config.AuthToken, "in-memory config");
                return _config.AuthToken;
            }

            // Fall back to credential store
            var credentials = _credentialStore.Retrieve();
            if (credentials?.AuthToken != null)
            {
                ValidateTokenOrThrow(credentials.AuthToken, "credential store");
                return credentials.AuthToken;
            }

            throw new InvalidOperationException("No auth token available. Please run the agent installer.");
        }
    }

    /// <summary>
    /// Check if token needs rotation.
    /// FIX SEC-05: Enhanced rotation logic with logging.
    /// </summary>
    /// <param name="rotationThreshold">How long before expiry to start rotation</param>
    /// <returns>True if token should be rotated</returns>
    public bool NeedsRotation(TimeSpan? rotationThreshold = null)
    {
        ThrowIfDisposed();

        var threshold = rotationThreshold ?? DefaultRotationThreshold;

        lock (_tokenLock)
        {
            if (!_tokenExpiresAt.HasValue)
            {
                // Unknown expiration - check if we should do periodic validation
                if (!_lastTokenValidation.HasValue ||
                    DateTime.UtcNow - _lastTokenValidation.Value > TokenValidationInterval)
                {
                    _lastTokenValidation = DateTime.UtcNow;
                    _logger.LogDebug("Token expiration unknown, periodic validation recommended");
                }
                return false;
            }

            var rotationTime = _tokenExpiresAt.Value - threshold;
            var needsRotation = DateTime.UtcNow >= rotationTime;

            if (needsRotation)
            {
                _logger.LogInformation(
                    "Token rotation needed. Expires in: {TimeToExpiry}",
                    _tokenExpiresAt.Value - DateTime.UtcNow);
            }

            return needsRotation;
        }
    }

    /// <summary>
    /// Check if token has expired.
    /// </summary>
    public bool IsExpired()
    {
        ThrowIfDisposed();

        lock (_tokenLock)
        {
            if (!_tokenExpiresAt.HasValue)
                return false;

            return DateTime.UtcNow >= _tokenExpiresAt.Value;
        }
    }

    /// <summary>
    /// Set token expiration time.
    /// </summary>
    /// <param name="expiresAt">When the token expires</param>
    public void SetTokenExpiration(DateTime expiresAt)
    {
        ThrowIfDisposed();

        lock (_tokenLock)
        {
            _tokenExpiresAt = expiresAt;
            _logger.LogDebug("Token expiration set to: {ExpiresAt}", expiresAt);
        }
    }

    /// <summary>
    /// Get remaining time until token expiration.
    /// </summary>
    /// <returns>Time until expiration, or null if unknown</returns>
    public TimeSpan? GetTimeToExpiration()
    {
        ThrowIfDisposed();

        lock (_tokenLock)
        {
            if (!_tokenExpiresAt.HasValue)
                return null;

            var remaining = _tokenExpiresAt.Value - DateTime.UtcNow;
            return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
        }
    }

    /// <summary>
    /// Update token with new value.
    /// FIX SEC-02: Logs token hash instead of token value.
    /// FIX SEC-03: Validates token format before storing.
    /// FIX ITER1-A3: Atomic update to prevent inconsistent state.
    /// </summary>
    /// <param name="newToken">The new authentication token</param>
    public void UpdateToken(string newToken)
    {
        ThrowIfDisposed();

        if (string.IsNullOrWhiteSpace(newToken))
            throw new ArgumentException("Token cannot be empty", nameof(newToken));

        ValidateTokenOrThrow(newToken, "new token");

        lock (_tokenLock)
        {
            var oldTokenHash = SecureUtilities.ComputeHashPrefix(_config.AuthToken);
            var newTokenHash = SecureUtilities.ComputeHashPrefix(newToken);

            try
            {
                // FIX ITER1-A3: Persist to credential store FIRST
                // If this fails, we haven't changed in-memory state
                _credentialStore.UpdateToken(newToken);

                // Only update in-memory config after successful persistence
                _config.AuthToken = newToken;

                // Reset expiration - will be set by server response
                _tokenExpiresAt = null;
                _lastTokenValidation = DateTime.UtcNow;

                // FIX SEC-02: Log hash prefix only, not actual token
                _logger.LogInformation(
                    "Auth token updated. Previous: {OldHash}, New: {NewHash}",
                    oldTokenHash, newTokenHash);
            }
            catch (Exception ex)
            {
                // FIX ITER1-A3: Log failure and ensure state remains consistent
                _logger.LogError(ex, "Failed to persist token update to credential store");
                throw;
            }
        }
    }

    /// <summary>
    /// Securely compare two tokens using constant-time comparison.
    /// FIX SEC-03: Prevents timing attacks.
    /// </summary>
    /// <param name="token1">First token</param>
    /// <param name="token2">Second token</param>
    /// <returns>True if tokens are equal</returns>
    public static bool SecureCompare(string? token1, string? token2)
    {
        return SecureUtilities.ConstantTimeEquals(token1, token2);
    }

    /// <summary>
    /// Build register request with current credentials.
    /// </summary>
    public RegisterRequest BuildRegisterRequest()
    {
        ThrowIfDisposed();

        return new RegisterRequest
        {
            AgentId = _config.AgentId,
            AuthToken = GetToken(),
            AgentVersion = _config.Version,
            MachineName = Environment.MachineName,
            SrVersion = _config.SoftRestaurant.Version,
            SrDatabaseName = _config.SoftRestaurant.DatabaseName,
            SrSqlInstance = _config.SoftRestaurant.SqlInstance,
            SrEmpresaId = _config.SoftRestaurant.EmpresaId
        };
    }

    /// <summary>
    /// Initialize from stored credentials.
    /// FIX SEC-02: Uses secure logging.
    /// FIX ITER1-B4: Atomic load to prevent partial state on failure.
    /// </summary>
    public void LoadFromStore()
    {
        ThrowIfDisposed();

        if (!_credentialStore.Exists())
        {
            _logger.LogDebug("No stored credentials found");
            return;
        }

        var credentials = _credentialStore.Retrieve();
        if (credentials == null)
        {
            _logger.LogWarning("Failed to retrieve credentials from store");
            return;
        }

        // FIX ITER1-B4: Validate all required fields before applying any changes
        if (string.IsNullOrEmpty(credentials.AgentId) ||
            string.IsNullOrEmpty(credentials.TenantId) ||
            string.IsNullOrEmpty(credentials.AuthToken))
        {
            _logger.LogError("Retrieved credentials are incomplete - missing required fields");
            throw new InvalidOperationException("Stored credentials are incomplete. Please reinstall the agent.");
        }

        // Validate token format before applying
        if (!SecureUtilities.ValidateTokenFormat(credentials.AuthToken))
        {
            _logger.LogError("Retrieved credentials contain invalid token format");
            throw new InvalidOperationException("Stored token is invalid. Please reinstall the agent.");
        }

        lock (_tokenLock)
        {
            // FIX ITER1-B4: Apply all changes atomically (within the lock)
            // If we get here, all validations passed
            _config.AgentId = credentials.AgentId;
            _config.TenantId = credentials.TenantId;
            _config.IntegrationId = credentials.IntegrationId;
            _config.BranchId = credentials.BranchId;
            _config.AuthToken = credentials.AuthToken;

            if (!string.IsNullOrEmpty(credentials.SqlConnectionString))
            {
                _config.SoftRestaurant.ConnectionString = credentials.SqlConnectionString;
            }

            _lastTokenValidation = DateTime.UtcNow;

            // FIX SEC-02: Log agent ID but not full details
            _logger.LogInformation(
                "Credentials loaded for agent: {AgentId} (token hash: {TokenHash})",
                SecureUtilities.Redact(credentials.AgentId, 8),
                SecureUtilities.ComputeHashPrefix(credentials.AuthToken));
        }
    }

    /// <summary>
    /// Save current credentials to store.
    /// </summary>
    public void SaveToStore()
    {
        ThrowIfDisposed();

        lock (_tokenLock)
        {
            var credentials = new StoredCredentials
            {
                AgentId = _config.AgentId,
                TenantId = _config.TenantId,
                IntegrationId = _config.IntegrationId,
                BranchId = _config.BranchId,
                AuthToken = _config.AuthToken,
                SqlConnectionString = _config.SoftRestaurant.ConnectionString
            };

            _credentialStore.Store(credentials);
            _logger.LogDebug("Credentials saved to store");
        }
    }

    /// <summary>
    /// Validates token format and throws if invalid.
    /// </summary>
    private void ValidateTokenOrThrow(string token, string source)
    {
        if (!SecureUtilities.ValidateTokenFormat(token))
        {
            _logger.LogError("Invalid token format detected from {Source}", source);
            throw new InvalidOperationException($"Invalid token format from {source}");
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
            lock (_tokenLock)
            {
                // Clear expiration tracking
                _tokenExpiresAt = null;
                _lastTokenValidation = null;
            }

            _logger.LogDebug("TokenManager disposed");
        }

        _disposed = true;
    }

    /// <summary>
    /// Throws ObjectDisposedException if disposed.
    /// </summary>
    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(TokenManager));
    }
}
