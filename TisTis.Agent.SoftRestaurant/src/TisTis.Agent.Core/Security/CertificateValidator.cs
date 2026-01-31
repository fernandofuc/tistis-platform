// =====================================================
// TIS TIS PLATFORM - Certificate Validator
// FIX SEC-04: SSL Certificate Pinning Implementation
// FIX AUDIT-01: Fixed X509Certificate memory leak
// FIX AUDIT-02: Fixed race condition in initialization
// FIX AUDIT-06: Fixed HashSet race condition in reads
// FIX AUDIT-09: Improved certificate chain validation
// =====================================================

using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Configuration;

namespace TisTis.Agent.Core.Security;

/// <summary>
/// SSL/TLS certificate validation with optional certificate pinning.
/// FIX SEC-04: Implements certificate pinning for enhanced security.
/// Thread-safe implementation for concurrent access.
/// </summary>
public class CertificateValidator
{
    private readonly SecurityOptions _securityOptions;
    private readonly ILogger<CertificateValidator> _logger;
    private readonly HashSet<string> _pinnedThumbprints;
    private readonly HashSet<string> _pinnedPublicKeyHashes;

    // FIX AUDIT-02: Lock for thread-safe access to pinned collections
    private readonly object _pinLock = new();

    /// <summary>
    /// Minimum acceptable RSA key size in bits
    /// </summary>
    private const int MinRsaKeySize = 2048;

    /// <summary>
    /// Known TIS TIS production certificate thumbprints.
    /// Updated during deployment - add new certs before rotation.
    /// </summary>
    private static readonly string[] DefaultPinnedThumbprints =
    {
        // Placeholder - will be populated with actual TIS TIS cert thumbprints
        // Format: SHA256 thumbprint in uppercase without colons
    };

    public CertificateValidator(
        SecurityOptions securityOptions,
        ILogger<CertificateValidator> logger)
    {
        _securityOptions = securityOptions ?? throw new ArgumentNullException(nameof(securityOptions));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        _pinnedThumbprints = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        _pinnedPublicKeyHashes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // FIX AUDIT-02: Initialize under lock to prevent race conditions
        lock (_pinLock)
        {
            InitializePinnedCertificates();
        }
    }

    /// <summary>
    /// Initialize the set of pinned certificate identifiers.
    /// Caller must hold _pinLock.
    /// </summary>
    private void InitializePinnedCertificates()
    {
        // Add configured thumbprint if provided
        if (!string.IsNullOrWhiteSpace(_securityOptions.CertificateThumbprint))
        {
            var normalized = NormalizeThumbprint(_securityOptions.CertificateThumbprint);
            _pinnedThumbprints.Add(normalized);
            _logger.LogDebug("Added configured certificate thumbprint for pinning");
        }

        // Add default TIS TIS thumbprints
        foreach (var thumbprint in DefaultPinnedThumbprints)
        {
            if (!string.IsNullOrWhiteSpace(thumbprint))
            {
                _pinnedThumbprints.Add(NormalizeThumbprint(thumbprint));
            }
        }

        if (_pinnedThumbprints.Count > 0)
        {
            _logger.LogInformation(
                "Certificate pinning initialized with {Count} pinned certificates",
                _pinnedThumbprints.Count);
        }
    }

    /// <summary>
    /// Gets the callback for server certificate validation (legacy).
    /// Use GetHttpClientValidationCallback() for HttpClientHandler.
    /// </summary>
    [Obsolete("Use GetHttpClientValidationCallback() for HttpClientHandler")]
    public RemoteCertificateValidationCallback GetValidationCallback()
    {
        return ValidateServerCertificate;
    }

    /// <summary>
    /// Gets the callback for HttpClientHandler.ServerCertificateCustomValidationCallback.
    /// FIX: Compatible with modern HttpClientHandler signature.
    /// </summary>
    public Func<System.Net.Http.HttpRequestMessage, X509Certificate2?, X509Chain?, SslPolicyErrors, bool> GetHttpClientValidationCallback()
    {
        return (request, cert2, chain, sslPolicyErrors) =>
        {
            // Delegate to the main validation logic
            return ValidateServerCertificate(request, cert2, chain, sslPolicyErrors);
        };
    }

    /// <summary>
    /// Validates the server certificate.
    /// FIX SEC-04: Implements certificate pinning when enabled.
    /// FIX AUDIT-09: Enhanced validation for security best practices.
    /// </summary>
    public bool ValidateServerCertificate(
        object sender,
        X509Certificate? certificate,
        X509Chain? chain,
        SslPolicyErrors sslPolicyErrors)
    {
        // If certificate is null, fail
        if (certificate == null)
        {
            _logger.LogError("Server certificate is null");
            return false;
        }

        // Convert to X509Certificate2 for full functionality
        using var cert2 = new X509Certificate2(certificate);

        // Log certificate info for debugging (redacted)
        _logger.LogDebug(
            "Validating certificate: Thumbprint={Thumbprint}",
            cert2.Thumbprint[..16] + "...");

        // FIX AUDIT-09: Always reject name mismatch - indicates MITM risk
        if (sslPolicyErrors.HasFlag(SslPolicyErrors.RemoteCertificateNameMismatch))
        {
            _logger.LogError("Certificate name mismatch detected - possible MITM attack");
            return false;
        }

        // FIX ITER1-A5: Use UTC time for consistent certificate validation
        // Certificate NotBefore/NotAfter are typically in UTC
        var now = DateTime.UtcNow;
        if (now < cert2.NotBefore.ToUniversalTime() || now > cert2.NotAfter.ToUniversalTime())
        {
            _logger.LogError("Certificate is expired or not yet valid. Valid: {NotBefore} to {NotAfter} (UTC)",
                cert2.NotBefore.ToUniversalTime(), cert2.NotAfter.ToUniversalTime());
            return false;
        }

        // FIX AUDIT-10: Validate key strength
        if (!ValidateKeyStrength(cert2))
        {
            return false;
        }

        // Check other SSL policy errors
        if (sslPolicyErrors != SslPolicyErrors.None)
        {
            // In development mode (pinning disabled), allow some errors
            if (!_securityOptions.UseCertificatePinning)
            {
                _logger.LogWarning(
                    "SSL policy errors (development mode): {Errors}",
                    sslPolicyErrors);

                // Still fail on certificate not available
                if (sslPolicyErrors.HasFlag(SslPolicyErrors.RemoteCertificateNotAvailable))
                {
                    _logger.LogError("Certificate not available");
                    return false;
                }

                return true;
            }

            _logger.LogError("SSL policy errors (pinning enabled): {Errors}", sslPolicyErrors);
            return false;
        }

        // If pinning is disabled, standard validation passed
        if (!_securityOptions.UseCertificatePinning)
        {
            _logger.LogDebug("Certificate validation passed (pinning disabled)");
            return true;
        }

        // Perform certificate pinning validation
        return ValidatePinnedCertificate(cert2, chain);
    }

    /// <summary>
    /// Minimum acceptable ECDSA key size in bits
    /// </summary>
    private const int MinEcdsaKeySize = 256;

    /// <summary>
    /// FIX ITER2-C3: Static array of weak SHA-1 OIDs to avoid allocation per call
    /// </summary>
    private static readonly string[] WeakSha1Oids =
    {
        "1.2.840.113549.1.1.5",  // sha1WithRSAEncryption
        "1.2.840.10040.4.3",     // id-dsa-with-sha1
        "1.2.840.10045.4.1"      // ecdsa-with-SHA1
    };

    /// <summary>
    /// FIX AUDIT-10: Validates certificate key strength.
    /// FIX ITER1-B1: Fixed SHA1 detection logic.
    /// FIX ITER1-B2: Added ECDSA/ECDsa validation.
    /// FIX: Migrated from obsolete PublicKey.Key to GetRSAPublicKey()/GetECDsaPublicKey().
    /// </summary>
    private bool ValidateKeyStrength(X509Certificate2 certificate)
    {
        try
        {
            // Check RSA key size using modern API (GetRSAPublicKey instead of obsolete PublicKey.Key)
            using var rsa = certificate.GetRSAPublicKey();
            if (rsa != null)
            {
                if (rsa.KeySize < MinRsaKeySize)
                {
                    _logger.LogError("Certificate RSA key size too small: {Size} bits (minimum: {Min})",
                        rsa.KeySize, MinRsaKeySize);
                    return false;
                }
                _logger.LogDebug("Certificate RSA key size: {Size} bits", rsa.KeySize);
            }
            else
            {
                // FIX ITER1-B2: Check ECDSA key size using modern API
                using var ecdsa = certificate.GetECDsaPublicKey();
                if (ecdsa != null)
                {
                    if (ecdsa.KeySize < MinEcdsaKeySize)
                    {
                        _logger.LogError("Certificate ECDSA key size too small: {Size} bits (minimum: {Min})",
                            ecdsa.KeySize, MinEcdsaKeySize);
                        return false;
                    }
                    _logger.LogDebug("Certificate ECDSA key size: {Size} bits", ecdsa.KeySize);
                }
                else
                {
                    // DSA is deprecated - warn but allow
                    using var dsa = certificate.GetDSAPublicKey();
                    if (dsa != null)
                    {
                        _logger.LogWarning("Certificate uses deprecated DSA algorithm");
                    }
                }
            }

            // FIX ITER1-B1: Properly detect weak SHA-1 signature algorithms
            // FIX ITER2-C3: Use static array to avoid allocation
            var sigAlg = certificate.SignatureAlgorithm.FriendlyName?.ToUpperInvariant() ?? "";
            var sigOid = certificate.SignatureAlgorithm.Value ?? "";

            if (WeakSha1Oids.Contains(sigOid))
            {
                _logger.LogWarning(
                    "Certificate uses deprecated SHA-1 signature algorithm: {Algorithm} (OID: {Oid})",
                    sigAlg, sigOid);
                // Warning only - many older CAs still use SHA-1 for root certificates
            }
            else if (sigAlg.Contains("SHA1") && !sigAlg.Contains("SHA1RSA"))
            {
                // Catch any other SHA-1 variants we might have missed
                _logger.LogWarning("Certificate uses potentially weak signature algorithm: {Algorithm}", sigAlg);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not validate certificate key strength");
            return true; // Don't fail on validation errors, log and continue
        }
    }

    /// <summary>
    /// Validates certificate against pinned thumbprints and public key hashes.
    /// FIX AUDIT-01: Properly handles X509Certificate disposal in chain.
    /// FIX AUDIT-06: Uses lock for thread-safe HashSet access.
    /// </summary>
    private bool ValidatePinnedCertificate(X509Certificate2 certificate, X509Chain? chain)
    {
        var thumbprint = certificate.Thumbprint;

        // FIX AUDIT-06: Read under lock for thread safety
        lock (_pinLock)
        {
            // Check leaf certificate thumbprint
            if (_pinnedThumbprints.Contains(thumbprint))
            {
                _logger.LogDebug("Certificate matched pinned thumbprint");
                return true;
            }

            // Check public key hash (more robust across renewals)
            var publicKeyHash = ComputePublicKeyHash(certificate);
            if (_pinnedPublicKeyHashes.Contains(publicKeyHash))
            {
                _logger.LogDebug("Certificate matched pinned public key hash");
                return true;
            }
        }

        // Check chain certificates (for intermediate pinning)
        // FIX AUDIT-01: Chain elements are owned by the chain, don't dispose
        // But we need to be careful not to hold references after chain is disposed
        if (chain != null)
        {
            lock (_pinLock)
            {
                foreach (var chainElement in chain.ChainElements)
                {
                    // Access certificate properties directly from chain element
                    // (chainElement.Certificate is already managed by the chain)
                    var chainCert = chainElement.Certificate;
                    var chainThumbprint = chainCert.Thumbprint;

                    if (_pinnedThumbprints.Contains(chainThumbprint))
                    {
                        _logger.LogDebug("Chain certificate matched pinned thumbprint");
                        return true;
                    }

                    var chainPkHash = ComputePublicKeyHash(chainCert);
                    if (_pinnedPublicKeyHashes.Contains(chainPkHash))
                    {
                        _logger.LogDebug("Chain certificate matched pinned public key hash");
                        return true;
                    }
                }
            }
        }

        // No pinned certificate matched
        _logger.LogError(
            "Certificate pinning validation failed. Thumbprint: {Thumbprint}",
            thumbprint[..16] + "...");

        return false;
    }

    /// <summary>
    /// Computes SHA256 hash of the certificate's public key.
    /// This is more stable across certificate renewals than thumbprint.
    /// FIX ITER2-C4: Added exception handling for robustness.
    /// </summary>
    private string ComputePublicKeyHash(X509Certificate2 certificate)
    {
        try
        {
            var publicKey = certificate.GetPublicKey();
            var hash = SHA256.HashData(publicKey);
            return Convert.ToHexString(hash);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to compute public key hash for certificate");
            // Return empty string to ensure pinning check fails safely
            return string.Empty;
        }
    }

    /// <summary>
    /// Normalizes a thumbprint for comparison.
    /// Removes colons, spaces, and converts to uppercase.
    /// </summary>
    private static string NormalizeThumbprint(string thumbprint)
    {
        return thumbprint
            .Replace(":", "")
            .Replace(" ", "")
            .Replace("-", "")
            .ToUpperInvariant();
    }

    /// <summary>
    /// Adds a certificate thumbprint to the pinned set at runtime.
    /// Thread-safe for concurrent access.
    /// </summary>
    /// <param name="thumbprint">The certificate thumbprint to add</param>
    public void AddPinnedThumbprint(string thumbprint)
    {
        if (string.IsNullOrWhiteSpace(thumbprint))
            return;

        var normalized = NormalizeThumbprint(thumbprint);

        lock (_pinLock)
        {
            if (_pinnedThumbprints.Add(normalized))
            {
                _logger.LogInformation("Added new pinned certificate thumbprint");
            }
        }
    }

    /// <summary>
    /// Adds a public key hash to the pinned set at runtime.
    /// Thread-safe for concurrent access.
    /// </summary>
    /// <param name="publicKeyHash">The SHA256 hash of the public key in hex</param>
    public void AddPinnedPublicKeyHash(string publicKeyHash)
    {
        if (string.IsNullOrWhiteSpace(publicKeyHash))
            return;

        var normalized = publicKeyHash.ToUpperInvariant().Replace(":", "").Replace(" ", "");

        lock (_pinLock)
        {
            if (_pinnedPublicKeyHashes.Add(normalized))
            {
                _logger.LogInformation("Added new pinned public key hash");
            }
        }
    }

    /// <summary>
    /// Checks if certificate pinning is currently enabled.
    /// </summary>
    public bool IsPinningEnabled => _securityOptions.UseCertificatePinning;

    /// <summary>
    /// Gets the count of pinned certificates.
    /// Thread-safe access.
    /// </summary>
    public int PinnedCertificateCount
    {
        get
        {
            lock (_pinLock)
            {
                return _pinnedThumbprints.Count + _pinnedPublicKeyHashes.Count;
            }
        }
    }
}
