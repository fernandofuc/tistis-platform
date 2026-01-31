// =====================================================
// TIS TIS PLATFORM - SecureUtilities Unit Tests
// Comprehensive tests for cryptographic utilities
// =====================================================

using FluentAssertions;
using TisTis.Agent.Core.Security;
using Xunit;

namespace TisTis.Agent.Core.Tests.Security;

/// <summary>
/// Unit tests for SecureUtilities class.
/// Tests cryptographic operations, constant-time comparisons, and secure memory handling.
/// </summary>
public class SecureUtilitiesTests
{
    #region ConstantTimeEquals (byte[]) Tests

    [Fact]
    public void ConstantTimeEquals_Bytes_BothNull_ReturnsTrue()
    {
        // Arrange
        byte[]? a = null;
        byte[]? b = null;

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_FirstNull_ReturnsFalse()
    {
        // Arrange
        byte[]? a = null;
        byte[] b = new byte[] { 1, 2, 3 };

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_SecondNull_ReturnsFalse()
    {
        // Arrange
        byte[] a = new byte[] { 1, 2, 3 };
        byte[]? b = null;

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_EqualArrays_ReturnsTrue()
    {
        // Arrange
        byte[] a = new byte[] { 1, 2, 3, 4, 5 };
        byte[] b = new byte[] { 1, 2, 3, 4, 5 };

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_DifferentArrays_ReturnsFalse()
    {
        // Arrange
        byte[] a = new byte[] { 1, 2, 3, 4, 5 };
        byte[] b = new byte[] { 1, 2, 3, 4, 6 };

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_DifferentLengths_ReturnsFalse()
    {
        // Arrange
        byte[] a = new byte[] { 1, 2, 3 };
        byte[] b = new byte[] { 1, 2, 3, 4, 5 };

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_EmptyArrays_ReturnsTrue()
    {
        // Arrange
        byte[] a = Array.Empty<byte>();
        byte[] b = Array.Empty<byte>();

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_OneEmptyOneFilled_ReturnsFalse()
    {
        // Arrange
        byte[] a = Array.Empty<byte>();
        byte[] b = new byte[] { 1, 2, 3 };

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_LargeEqualArrays_ReturnsTrue()
    {
        // Arrange
        var a = new byte[10000];
        var b = new byte[10000];
        for (int i = 0; i < 10000; i++)
        {
            a[i] = (byte)(i % 256);
            b[i] = (byte)(i % 256);
        }

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_Bytes_LargeDifferentArrays_ReturnsFalse()
    {
        // Arrange
        var a = new byte[10000];
        var b = new byte[10000];
        for (int i = 0; i < 10000; i++)
        {
            a[i] = (byte)(i % 256);
            b[i] = (byte)(i % 256);
        }
        b[9999] = 0; // Differ only at last byte

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region ConstantTimeEquals (string) Tests

    [Fact]
    public void ConstantTimeEquals_String_BothNull_ReturnsTrue()
    {
        // Arrange
        string? a = null;
        string? b = null;

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_String_FirstNull_ReturnsFalse()
    {
        // Arrange
        string? a = null;
        string b = "test";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_String_SecondNull_ReturnsFalse()
    {
        // Arrange
        string a = "test";
        string? b = null;

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_String_EqualStrings_ReturnsTrue()
    {
        // Arrange
        string a = "test-token-12345";
        string b = "test-token-12345";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_String_DifferentStrings_ReturnsFalse()
    {
        // Arrange
        string a = "test-token-12345";
        string b = "test-token-12346";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_String_DifferentLengths_ReturnsFalse()
    {
        // Arrange
        string a = "short";
        string b = "muchlongerstring";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ConstantTimeEquals_String_EmptyStrings_ReturnsTrue()
    {
        // Arrange
        string a = "";
        string b = "";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_String_UnicodeStrings_ReturnsTrue()
    {
        // Arrange
        string a = "tëst-tökén-日本語";
        string b = "tëst-tökén-日本語";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ConstantTimeEquals_String_CaseSensitive_ReturnsFalse()
    {
        // Arrange
        string a = "TestToken";
        string b = "testtoken";

        // Act
        var result = SecureUtilities.ConstantTimeEquals(a, b);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region ClearBytes Tests

    [Fact]
    public void ClearBytes_NullArray_DoesNotThrow()
    {
        // Arrange
        byte[]? data = null;

        // Act & Assert
        var action = () => SecureUtilities.ClearBytes(data);
        action.Should().NotThrow();
    }

    [Fact]
    public void ClearBytes_EmptyArray_DoesNotThrow()
    {
        // Arrange
        byte[] data = Array.Empty<byte>();

        // Act & Assert
        var action = () => SecureUtilities.ClearBytes(data);
        action.Should().NotThrow();
    }

    [Fact]
    public void ClearBytes_FilledArray_ZerosAllBytes()
    {
        // Arrange
        byte[] data = new byte[] { 1, 2, 3, 4, 5, 255, 128, 64 };

        // Act
        SecureUtilities.ClearBytes(data);

        // Assert
        data.Should().AllBeEquivalentTo((byte)0);
    }

    [Fact]
    public void ClearBytes_LargeArray_ZerosAllBytes()
    {
        // Arrange
        byte[] data = new byte[10000];
        for (int i = 0; i < data.Length; i++)
            data[i] = (byte)(i % 256);

        // Act
        SecureUtilities.ClearBytes(data);

        // Assert
        data.Should().AllBeEquivalentTo((byte)0);
    }

    #endregion

    #region ClearChars Tests

    [Fact]
    public void ClearChars_NullArray_DoesNotThrow()
    {
        // Arrange
        char[]? data = null;

        // Act & Assert
        var action = () => SecureUtilities.ClearChars(data);
        action.Should().NotThrow();
    }

    [Fact]
    public void ClearChars_EmptyArray_DoesNotThrow()
    {
        // Arrange
        char[] data = Array.Empty<char>();

        // Act & Assert
        var action = () => SecureUtilities.ClearChars(data);
        action.Should().NotThrow();
    }

    [Fact]
    public void ClearChars_FilledArray_ZerosAllChars()
    {
        // Arrange
        char[] data = new char[] { 'a', 'b', 'c', 'P', 'A', 'S', 'S' };

        // Act
        SecureUtilities.ClearChars(data);

        // Assert
        data.Should().AllBeEquivalentTo('\0');
    }

    #endregion

    #region ValidateTokenFormat Tests

    [Fact]
    public void ValidateTokenFormat_Null_ReturnsFalse()
    {
        // Arrange
        string? token = null;

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_EmptyString_ReturnsFalse()
    {
        // Arrange
        string token = "";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_WhitespaceOnly_ReturnsFalse()
    {
        // Arrange
        string token = "   ";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_ValidToken_ReturnsTrue()
    {
        // Arrange
        string token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateTokenFormat_ValidBase64UrlSafe_ReturnsTrue()
    {
        // Arrange - Base64 URL-safe tokens use - and _ instead of + and /
        string token = "abcdefghijklmnopqrstuvwxyz-_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateTokenFormat_TooLong_ReturnsFalse()
    {
        // Arrange
        string token = new string('a', SecureUtilities.MaxTokenLength + 1);

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_MaxLength_ReturnsTrue()
    {
        // Arrange
        string token = new string('a', SecureUtilities.MaxTokenLength);

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateTokenFormat_ContainsNonPrintable_ReturnsFalse()
    {
        // Arrange - Contains tab character (0x09)
        string token = "valid-part\tmore-content";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_ContainsNewline_ReturnsFalse()
    {
        // Arrange
        string token = "valid-part\nmore-content";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_ContainsHighUnicode_ReturnsFalse()
    {
        // Arrange - Contains character outside ASCII printable range
        string token = "token-with-émoji";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Theory]
    [InlineData(' ', true)]    // 0x20 - First valid printable char (space)
    [InlineData('~', true)]    // 0x7E - Last valid printable char (tilde)
    [InlineData('\x1F', false)] // 0x1F - Just below valid range (unit separator)
    [InlineData('\x7F', false)] // 0x7F - Just above valid range (DEL)
    public void ValidateTokenFormat_BoundaryCharacters_RespectsLimits(char boundaryChar, bool shouldBeValid)
    {
        // Arrange - Token with boundary character at the end
        string token = $"valid-prefix{boundaryChar}";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().Be(shouldBeValid);
    }

    [Fact]
    public void ValidateTokenFormat_AllPrintableAscii_ReturnsTrue()
    {
        // Arrange - String with all printable ASCII characters (0x20-0x7E)
        var chars = new char[0x7E - 0x20 + 1];
        for (int i = 0; i < chars.Length; i++)
        {
            chars[i] = (char)(0x20 + i);
        }
        var token = new string(chars);

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateTokenFormat_ContainsNullChar_ReturnsFalse()
    {
        // Arrange
        string token = "before\0after";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void ValidateTokenFormat_ContainsCarriageReturn_ReturnsFalse()
    {
        // Arrange
        string token = "line1\rline2";

        // Act
        var result = SecureUtilities.ValidateTokenFormat(token);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region ValidateDataSize Tests

    [Fact]
    public void ValidateDataSize_Null_ReturnsTrue()
    {
        // Arrange
        byte[]? data = null;

        // Act
        var result = SecureUtilities.ValidateDataSize(data);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateDataSize_EmptyArray_ReturnsTrue()
    {
        // Arrange
        byte[] data = Array.Empty<byte>();

        // Act
        var result = SecureUtilities.ValidateDataSize(data);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateDataSize_SmallArray_ReturnsTrue()
    {
        // Arrange
        byte[] data = new byte[100];

        // Act
        var result = SecureUtilities.ValidateDataSize(data);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateDataSize_MaxSize_ReturnsTrue()
    {
        // Arrange
        byte[] data = new byte[SecureUtilities.MaxCredentialSizeBytes];

        // Act
        var result = SecureUtilities.ValidateDataSize(data);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void ValidateDataSize_ExceedsMaxSize_ReturnsFalse()
    {
        // Arrange
        byte[] data = new byte[SecureUtilities.MaxCredentialSizeBytes + 1];

        // Act
        var result = SecureUtilities.ValidateDataSize(data);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region GenerateSecureBytes Tests

    [Fact]
    public void GenerateSecureBytes_ZeroLength_ThrowsArgumentOutOfRangeException()
    {
        // Act & Assert
        var action = () => SecureUtilities.GenerateSecureBytes(0);
        action.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void GenerateSecureBytes_NegativeLength_ThrowsArgumentOutOfRangeException()
    {
        // Act & Assert
        var action = () => SecureUtilities.GenerateSecureBytes(-1);
        action.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void GenerateSecureBytes_ValidLength_ReturnsCorrectSize()
    {
        // Act
        var result = SecureUtilities.GenerateSecureBytes(32);

        // Assert
        result.Should().HaveCount(32);
    }

    [Fact]
    public void GenerateSecureBytes_ConsecutiveCalls_ReturnsDifferentBytes()
    {
        // Act
        var result1 = SecureUtilities.GenerateSecureBytes(32);
        var result2 = SecureUtilities.GenerateSecureBytes(32);

        // Assert - Should be extremely unlikely to be equal
        result1.Should().NotBeEquivalentTo(result2);
    }

    [Fact]
    public void GenerateSecureBytes_LargeSize_ReturnsCorrectSize()
    {
        // Act
        var result = SecureUtilities.GenerateSecureBytes(1000);

        // Assert
        result.Should().HaveCount(1000);
    }

    [Fact]
    public void GenerateSecureBytes_HasEntropy_NotAllZeros()
    {
        // Act
        var result = SecureUtilities.GenerateSecureBytes(100);

        // Assert - Should have some non-zero bytes
        result.Should().Contain(b => b != 0);
    }

    #endregion

    #region GenerateSecureToken Tests

    [Fact]
    public void GenerateSecureToken_DefaultLength_ReturnsValidToken()
    {
        // Act
        var result = SecureUtilities.GenerateSecureToken();

        // Assert
        result.Should().NotBeNullOrEmpty();
        SecureUtilities.ValidateTokenFormat(result).Should().BeTrue();
    }

    [Fact]
    public void GenerateSecureToken_ConsecutiveCalls_ReturnsDifferentTokens()
    {
        // Act
        var token1 = SecureUtilities.GenerateSecureToken();
        var token2 = SecureUtilities.GenerateSecureToken();

        // Assert
        token1.Should().NotBe(token2);
    }

    [Fact]
    public void GenerateSecureToken_UrlSafe_NoBase64Padding()
    {
        // Act
        var result = SecureUtilities.GenerateSecureToken(16);

        // Assert - Should not contain Base64 padding or non-URL-safe chars
        result.Should().NotContain("=");
        result.Should().NotContain("+");
        result.Should().NotContain("/");
    }

    [Fact]
    public void GenerateSecureToken_UrlSafe_ContainsOnlyValidChars()
    {
        // Act
        var result = SecureUtilities.GenerateSecureToken(64);

        // Assert - Should only contain URL-safe Base64 characters
        result.Should().MatchRegex("^[A-Za-z0-9_-]+$");
    }

    [Fact]
    public void GenerateSecureToken_CustomLength_GeneratesTokenOfExpectedSize()
    {
        // Arrange - 16 bytes of random data -> ~22 base64 chars (without padding)
        int byteLength = 16;

        // Act
        var result = SecureUtilities.GenerateSecureToken(byteLength);

        // Assert - Base64 encodes 3 bytes as 4 chars, so 16 bytes -> 22 chars (rounded up)
        result.Length.Should().BeGreaterThanOrEqualTo(21);
        result.Length.Should().BeLessThanOrEqualTo(22);
    }

    #endregion

    #region Redact Tests

    [Fact]
    public void Redact_Null_ReturnsEmpty()
    {
        // Arrange
        string? value = null;

        // Act
        var result = SecureUtilities.Redact(value);

        // Assert
        result.Should().Be("[empty]");
    }

    [Fact]
    public void Redact_EmptyString_ReturnsEmpty()
    {
        // Arrange
        string value = "";

        // Act
        var result = SecureUtilities.Redact(value);

        // Assert
        result.Should().Be("[empty]");
    }

    [Fact]
    public void Redact_ShortString_ReturnsRedacted()
    {
        // Arrange - String too short to show prefix/suffix
        string value = "short";

        // Act
        var result = SecureUtilities.Redact(value);

        // Assert
        result.Should().Be("[redacted]");
    }

    [Fact]
    public void Redact_LongString_ShowsPrefixAndSuffix()
    {
        // Arrange
        string value = "this-is-a-very-long-secret-token-value";

        // Act
        var result = SecureUtilities.Redact(value);

        // Assert
        result.Should().StartWith("this");
        result.Should().EndWith("alue");
        result.Should().Contain("***");
    }

    [Fact]
    public void Redact_CustomVisibleChars_ShowsCorrectAmount()
    {
        // Arrange
        string value = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        // Act
        var result = SecureUtilities.Redact(value, visibleChars: 2);

        // Assert
        result.Should().StartWith("AB");
        result.Should().EndWith("YZ");
    }

    [Fact]
    public void Redact_ShowsHiddenLength()
    {
        // Arrange
        string value = "1234567890123456789012345678901234567890"; // 40 chars

        // Act
        var result = SecureUtilities.Redact(value, visibleChars: 4);

        // Assert
        result.Should().Contain("[32 chars]"); // 40 - 4 - 4 = 32
    }

    #endregion

    #region RedactFull Tests

    [Fact]
    public void RedactFull_Null_ReturnsEmpty()
    {
        // Arrange
        string? value = null;

        // Act
        var result = SecureUtilities.RedactFull(value);

        // Assert
        result.Should().Be("[empty]");
    }

    [Fact]
    public void RedactFull_EmptyString_ReturnsEmpty()
    {
        // Arrange
        string value = "";

        // Act
        var result = SecureUtilities.RedactFull(value);

        // Assert
        result.Should().Be("[empty]");
    }

    [Fact]
    public void RedactFull_AnyString_ReturnsLengthOnly()
    {
        // Arrange
        string value = "super-secret-password-12345";

        // Act
        var result = SecureUtilities.RedactFull(value);

        // Assert
        result.Should().Be($"[redacted:{value.Length} chars]");
        result.Should().NotContain("super");
        result.Should().NotContain("password");
    }

    #endregion

    #region ComputeHashPrefix Tests

    [Fact]
    public void ComputeHashPrefix_Null_ReturnsEmpty()
    {
        // Arrange
        string? value = null;

        // Act
        var result = SecureUtilities.ComputeHashPrefix(value);

        // Assert
        result.Should().Be("[empty]");
    }

    [Fact]
    public void ComputeHashPrefix_EmptyString_ReturnsEmpty()
    {
        // Arrange
        string value = "";

        // Act
        var result = SecureUtilities.ComputeHashPrefix(value);

        // Assert
        result.Should().Be("[empty]");
    }

    [Fact]
    public void ComputeHashPrefix_ValidString_ReturnsHexPrefix()
    {
        // Arrange
        string value = "test-token-value";

        // Act
        var result = SecureUtilities.ComputeHashPrefix(value);

        // Assert
        result.Should().MatchRegex("^[0-9a-f]{16}$"); // 8 bytes = 16 hex chars
    }

    [Fact]
    public void ComputeHashPrefix_SameInput_ReturnsSameHash()
    {
        // Arrange
        string value = "consistent-input";

        // Act
        var result1 = SecureUtilities.ComputeHashPrefix(value);
        var result2 = SecureUtilities.ComputeHashPrefix(value);

        // Assert
        result1.Should().Be(result2);
    }

    [Fact]
    public void ComputeHashPrefix_DifferentInputs_ReturnsDifferentHashes()
    {
        // Arrange
        string value1 = "input-one";
        string value2 = "input-two";

        // Act
        var result1 = SecureUtilities.ComputeHashPrefix(value1);
        var result2 = SecureUtilities.ComputeHashPrefix(value2);

        // Assert
        result1.Should().NotBe(result2);
    }

    [Fact]
    public void ComputeHashPrefix_IsLowercase()
    {
        // Arrange
        string value = "UPPERCASE-INPUT";

        // Act
        var result = SecureUtilities.ComputeHashPrefix(value);

        // Assert
        result.Should().Be(result.ToLowerInvariant());
    }

    #endregion

    #region Constants Tests

    [Fact]
    public void MaxCredentialSizeBytes_Is64KB()
    {
        // Assert
        SecureUtilities.MaxCredentialSizeBytes.Should().Be(64 * 1024);
    }

    [Fact]
    public void MaxTokenLength_Is4096()
    {
        // Assert
        SecureUtilities.MaxTokenLength.Should().Be(4096);
    }

    #endregion
}
