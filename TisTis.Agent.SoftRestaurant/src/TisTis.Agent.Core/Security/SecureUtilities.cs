// =====================================================
// TIS TIS PLATFORM - Secure Utilities
// FIX SEC-01, SEC-03: Security helper functions
// =====================================================

using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace TisTis.Agent.Core.Security;

/// <summary>
/// Security utility functions for cryptographic operations and secure memory handling.
/// </summary>
public static class SecureUtilities
{
    /// <summary>
    /// Maximum allowed size for credentials (prevent memory DoS)
    /// </summary>
    public const int MaxCredentialSizeBytes = 64 * 1024; // 64 KB

    /// <summary>
    /// Maximum allowed token length
    /// </summary>
    public const int MaxTokenLength = 4096;

    /// <summary>
    /// FIX SEC-03: Performs a constant-time comparison of two byte arrays.
    /// This prevents timing attacks where an attacker could measure comparison time
    /// to infer information about the expected value.
    /// FIX ITER1-A1: Maintains constant time even for null/length-mismatch cases.
    /// </summary>
    /// <param name="a">First byte array</param>
    /// <param name="b">Second byte array</param>
    /// <returns>True if arrays are equal, false otherwise</returns>
    [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
    public static bool ConstantTimeEquals(byte[]? a, byte[]? b)
    {
        // FIX ITER1-A1: Both null = equal, but maintain constant timing
        if (a == null && b == null)
        {
            var dummyBytes = new byte[32];
            CryptographicOperations.FixedTimeEquals(dummyBytes, dummyBytes);
            return true;
        }

        // FIX ITER1-A1: One null = not equal, but maintain constant timing
        if (a == null || b == null)
        {
            var dummyBytes = new byte[32];
            CryptographicOperations.FixedTimeEquals(dummyBytes, dummyBytes);
            return false;
        }

        // FIX ITER1-A1: Length mismatch - still do comparison to maintain timing
        // FIX ITER2-C1: Always perform comparison even for empty arrays
        if (a.Length != b.Length)
        {
            // Compare to maintain timing consistency
            if (a.Length > 0 && b.Length > 0)
            {
                // Compare shorter with itself
                var shorter = a.Length < b.Length ? a : b;
                CryptographicOperations.FixedTimeEquals(shorter, shorter);
            }
            else
            {
                // One or both arrays are empty - do dummy comparison
                var dummyBytes = new byte[32];
                CryptographicOperations.FixedTimeEquals(dummyBytes, dummyBytes);
            }
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    /// <summary>
    /// FIX SEC-03: Performs a constant-time comparison of two strings.
    /// Converts to UTF-8 bytes for comparison.
    /// FIX AUDIT-03: Maintains constant time even for null comparisons.
    /// </summary>
    /// <param name="a">First string</param>
    /// <param name="b">Second string</param>
    /// <returns>True if strings are equal, false otherwise</returns>
    [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
    public static bool ConstantTimeEquals(string? a, string? b)
    {
        // FIX AUDIT-03: Handle null cases with constant-time behavior
        // Both null = equal, one null = not equal (but maintain timing)
        if (a == null && b == null)
        {
            // Do a dummy comparison to maintain consistent timing
            var dummyBytes = new byte[32];
            CryptographicOperations.FixedTimeEquals(dummyBytes, dummyBytes);
            return true;
        }

        if (a == null || b == null)
        {
            // Do a dummy comparison to maintain consistent timing before returning false
            var dummyBytes = new byte[32];
            CryptographicOperations.FixedTimeEquals(dummyBytes, dummyBytes);
            return false;
        }

        var bytesA = Encoding.UTF8.GetBytes(a);
        var bytesB = Encoding.UTF8.GetBytes(b);

        try
        {
            // If lengths differ, we still do a comparison to maintain constant time
            if (bytesA.Length != bytesB.Length)
            {
                // Compare with itself to maintain timing, then return false
                CryptographicOperations.FixedTimeEquals(bytesA, bytesA);
                return false;
            }

            return CryptographicOperations.FixedTimeEquals(bytesA, bytesB);
        }
        finally
        {
            // Clear sensitive data from memory
            ClearBytes(bytesA);
            ClearBytes(bytesB);
        }
    }

    /// <summary>
    /// FIX SEC-01: Securely clears a byte array from memory.
    /// Uses volatile writes to prevent compiler optimization from removing the clear.
    /// </summary>
    /// <param name="data">The byte array to clear</param>
    [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
    public static void ClearBytes(byte[]? data)
    {
        if (data == null || data.Length == 0)
            return;

        CryptographicOperations.ZeroMemory(data);
    }

    /// <summary>
    /// FIX SEC-01: Securely clears a char array from memory.
    /// </summary>
    /// <param name="data">The char array to clear</param>
    [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
    public static void ClearChars(char[]? data)
    {
        if (data == null || data.Length == 0)
            return;

        // Convert chars to bytes for zeroing
        var byteSpan = MemoryMarshal.AsBytes<char>(data);
        CryptographicOperations.ZeroMemory(byteSpan);
    }

    /// <summary>
    /// Validates that a token has a reasonable format and size.
    /// This is a basic sanity check, not a full JWT validation.
    /// </summary>
    /// <param name="token">The token to validate</param>
    /// <returns>True if token appears valid, false otherwise</returns>
    public static bool ValidateTokenFormat(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return false;

        if (token.Length > MaxTokenLength)
            return false;

        // Basic printable ASCII check (tokens should be URL-safe)
        foreach (var c in token)
        {
            if (c < 0x20 || c > 0x7E)
                return false;
        }

        return true;
    }

    /// <summary>
    /// Validates that credentials data is within acceptable size limits.
    /// </summary>
    /// <param name="data">The data to validate</param>
    /// <returns>True if size is acceptable, false otherwise</returns>
    public static bool ValidateDataSize(byte[]? data)
    {
        if (data == null)
            return true;

        return data.Length <= MaxCredentialSizeBytes;
    }

    /// <summary>
    /// Generates a cryptographically secure random byte array.
    /// </summary>
    /// <param name="length">Number of bytes to generate</param>
    /// <returns>Random byte array</returns>
    public static byte[] GenerateSecureBytes(int length)
    {
        if (length <= 0)
            throw new ArgumentOutOfRangeException(nameof(length), "Length must be positive");

        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        return bytes;
    }

    /// <summary>
    /// Generates a cryptographically secure random string (base64 URL-safe).
    /// </summary>
    /// <param name="byteLength">Number of random bytes (output will be longer)</param>
    /// <returns>URL-safe base64 encoded random string</returns>
    public static string GenerateSecureToken(int byteLength = 32)
    {
        var bytes = GenerateSecureBytes(byteLength);
        try
        {
            return Convert.ToBase64String(bytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }
        finally
        {
            ClearBytes(bytes);
        }
    }

    /// <summary>
    /// Redacts sensitive information from a string for safe logging.
    /// Shows first 4 and last 4 characters only.
    /// </summary>
    /// <param name="value">The value to redact</param>
    /// <param name="visibleChars">Number of chars to show at each end</param>
    /// <returns>Redacted string</returns>
    public static string Redact(string? value, int visibleChars = 4)
    {
        if (string.IsNullOrEmpty(value))
            return "[empty]";

        if (value.Length <= visibleChars * 2 + 4)
            return "[redacted]";

        var prefix = value[..visibleChars];
        var suffix = value[^visibleChars..];
        var hiddenLength = value.Length - (visibleChars * 2);

        return $"{prefix}***[{hiddenLength} chars]***{suffix}";
    }

    /// <summary>
    /// Completely redacts a value for logging (no partial reveal).
    /// </summary>
    /// <param name="value">The value to redact</param>
    /// <returns>Redaction indicator</returns>
    public static string RedactFull(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "[empty]";

        return $"[redacted:{value.Length} chars]";
    }

    /// <summary>
    /// Computes SHA256 hash of a string for logging/comparison purposes.
    /// Useful for logging token identifiers without exposing the actual token.
    /// </summary>
    /// <param name="value">The value to hash</param>
    /// <returns>Hex-encoded first 8 bytes of SHA256 hash</returns>
    public static string ComputeHashPrefix(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "[empty]";

        var bytes = Encoding.UTF8.GetBytes(value);
        try
        {
            var hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash[..8]).ToLowerInvariant();
        }
        finally
        {
            ClearBytes(bytes);
        }
    }
}
