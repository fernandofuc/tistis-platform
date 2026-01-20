/**
 * TIS TIS Platform - Voice Agent v2.0
 * Security Tests: Input Validation
 *
 * Tests for validating user inputs and preventing security vulnerabilities:
 * - XSS prevention
 * - SQL injection prevention
 * - Command injection prevention
 * - Input sanitization
 * - Data leak prevention
 *
 * @jest-environment node
 */

// =====================================================
// INPUT VALIDATION UTILITIES
// =====================================================

/**
 * Sanitizes user input to prevent XSS attacks
 */
function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;

  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');

  // Mexican phone numbers should have 10-13 digits
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates date format (YYYY-MM-DD)
 */
function isValidDate(date: string): boolean {
  if (!date || typeof date !== 'string') return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Validates time format (HH:MM)
 */
function isValidTime(time: string): boolean {
  if (!time || typeof time !== 'string') return false;

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * Sanitizes database query parameters
 */
function sanitizeQueryParam(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove or escape SQL injection characters
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/exec /gi, '')
    .replace(/union /gi, '')
    .replace(/select /gi, '')
    .replace(/drop /gi, '')
    .replace(/delete /gi, '')
    .replace(/insert /gi, '')
    .replace(/update /gi, '');
}

/**
 * Detects potential SQL injection attempts
 */
function detectSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION(?:\s+ALL)?\s+SELECT/i,
    /SELECT\s+.*\s+FROM/i,
    /INSERT\s+INTO/i,
    /DELETE\s+FROM/i,
    /DROP\s+TABLE/i,
    /UPDATE\s+.*\s+SET/i,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Detects potential command injection attempts
 */
function detectCommandInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const cmdPatterns = [
    /[;&|`$]/,
    /\$\(/,
    /`.*`/,
    /\|\|/,
    /&&/,
    /\n/,
    /\r/,
    /\/etc\/passwd/i,
    /\/bin\//i,
    /cmd\.exe/i,
    /powershell/i,
  ];

  return cmdPatterns.some((pattern) => pattern.test(input));
}

/**
 * Masks sensitive data (phone, email)
 */
function maskSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Mask phone numbers - more comprehensive pattern
  let masked = text.replace(
    /(\+?\d{1,3}[\s-]?)?(\d{2,4}[\s-]?){2,4}/g,
    (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 10) {
        return digits.slice(0, 3) + '****' + digits.slice(-4);
      }
      return match;
    }
  );

  // Mask email addresses
  masked = masked.replace(
    /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    (match, user, domain) => {
      const maskedUser = user.charAt(0) + '***';
      return maskedUser + '@' + domain;
    }
  );

  return masked;
}

/**
 * Validates JSON structure - for webhook payloads, must be a plain object (not array)
 */
function isValidJson(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    // Must be an object, not null, and not an array
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Limits string length
 */
function truncate(str: string, maxLength: number): string {
  if (!str || typeof str !== 'string') return '';
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

// =====================================================
// XSS PREVENTION TESTS
// =====================================================

describe('Security: XSS Prevention', () => {
  describe('HTML Sanitization', () => {
    it('should escape HTML tags', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeHtml(input);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should escape event handlers by escaping HTML', () => {
      const input = '<img src=x onerror="alert(1)">';
      const sanitized = sanitizeHtml(input);

      // The entire tag should be escaped, making it harmless
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('&lt;img');
    });

    it('should escape JavaScript URLs by escaping special chars', () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const sanitized = sanitizeHtml(input);

      // The link tag should be escaped
      expect(sanitized).not.toContain('<a ');
      expect(sanitized).toContain('&lt;');
    });

    it('should escape nested tags', () => {
      const input = '<<script>script>alert(1)<</script>/script>';
      const sanitized = sanitizeHtml(input);

      expect(sanitized).not.toContain('<script>');
    });

    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as unknown as string)).toBe('');
      expect(sanitizeHtml(undefined as unknown as string)).toBe('');
    });

    it('should preserve safe text', () => {
      const input = 'Hola, mi nombre es Juan';
      const sanitized = sanitizeHtml(input);

      expect(sanitized).toBe('Hola, mi nombre es Juan');
    });
  });
});

// =====================================================
// SQL INJECTION TESTS
// =====================================================

describe('Security: SQL Injection Prevention', () => {
  describe('SQL Injection Detection', () => {
    it('should detect basic SQL injection', () => {
      const attacks = [
        "' OR '1'='1",
        "'; DROP TABLE users--",
        "1; SELECT * FROM users",
        "' UNION SELECT * FROM passwords--",
        "admin'--",
      ];

      attacks.forEach((attack) => {
        expect(detectSqlInjection(attack)).toBe(true);
      });
    });

    it('should detect encoded SQL injection', () => {
      const attacks = [
        '%27%20OR%20%271%27=%271',
        '%27%3B%20DROP%20TABLE',
      ];

      attacks.forEach((attack) => {
        expect(detectSqlInjection(attack)).toBe(true);
      });
    });

    it('should not flag normal inputs', () => {
      const normalInputs = [
        'Juan Pérez',
        'Hola, quisiera una cita',
        '2024-01-15',
        '+52 55 1234 5678',
        'juan@email.com',
      ];

      normalInputs.forEach((input) => {
        expect(detectSqlInjection(input)).toBe(false);
      });
    });
  });

  describe('Query Parameter Sanitization', () => {
    it('should escape single quotes', () => {
      const input = "O'Brien";
      const sanitized = sanitizeQueryParam(input);

      expect(sanitized).toBe("O''Brien");
    });

    it('should remove SQL keywords', () => {
      const input = 'SELECT * FROM users; DROP TABLE users;';
      const sanitized = sanitizeQueryParam(input);

      expect(sanitized).not.toContain('SELECT');
      expect(sanitized).not.toContain('DROP');
    });

    it('should remove comment markers', () => {
      const input = 'value -- comment';
      const sanitized = sanitizeQueryParam(input);

      expect(sanitized).not.toContain('--');
    });
  });
});

// =====================================================
// COMMAND INJECTION TESTS
// =====================================================

describe('Security: Command Injection Prevention', () => {
  describe('Command Injection Detection', () => {
    it('should detect shell metacharacters', () => {
      const attacks = [
        'file; rm -rf /',
        'name | cat /etc/passwd',
        'value `whoami`',
        'data && shutdown now',
        'input || echo hacked',
      ];

      attacks.forEach((attack) => {
        expect(detectCommandInjection(attack)).toBe(true);
      });
    });

    it('should detect path traversal', () => {
      const attacks = [
        '../../../etc/passwd',
        '/bin/bash',
        'cmd.exe /c dir',
      ];

      attacks.forEach((attack) => {
        expect(detectCommandInjection(attack)).toBe(true);
      });
    });

    it('should not flag normal inputs', () => {
      const normalInputs = [
        'Juan Pérez',
        'Reservación para 4 personas',
        'Calle Principal 123',
        'Mi dirección es Av. Reforma',
      ];

      normalInputs.forEach((input) => {
        expect(detectCommandInjection(input)).toBe(false);
      });
    });
  });
});

// =====================================================
// INPUT FORMAT VALIDATION TESTS
// =====================================================

describe('Security: Input Format Validation', () => {
  describe('Phone Number Validation', () => {
    it('should accept valid Mexican phone numbers', () => {
      const validNumbers = [
        '+52 55 1234 5678',
        '5512345678',
        '+521234567890',
        '55 1234 5678',
      ];

      validNumbers.forEach((number) => {
        expect(isValidPhoneNumber(number)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '123',
        'not-a-phone',
        '',
        '12345678901234567890', // Too long
      ];

      invalidNumbers.forEach((number) => {
        expect(isValidPhoneNumber(number)).toBe(false);
      });
    });
  });

  describe('Email Validation', () => {
    it('should accept valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.org',
        'name+tag@email.co.mx',
      ];

      validEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@nodomain.com',
        'no@',
        '',
        'spaces in@email.com',
      ];

      invalidEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('Date Validation', () => {
    it('should accept valid dates', () => {
      const validDates = ['2024-01-15', '2024-12-31', '2025-06-01'];

      validDates.forEach((date) => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        '2024/01/15',
        '15-01-2024',
        '01-15-2024',
        '2024-13-01',
        '2024-01-32',
        'not-a-date',
        '',
      ];

      invalidDates.forEach((date) => {
        expect(isValidDate(date)).toBe(false);
      });
    });
  });

  describe('Time Validation', () => {
    it('should accept valid times', () => {
      const validTimes = ['09:00', '14:30', '00:00', '23:59'];

      validTimes.forEach((time) => {
        expect(isValidTime(time)).toBe(true);
      });
    });

    it('should reject invalid times', () => {
      const invalidTimes = [
        '24:00',
        '9:00',
        '09:60',
        '25:30',
        'not-a-time',
        '',
      ];

      invalidTimes.forEach((time) => {
        expect(isValidTime(time)).toBe(false);
      });
    });
  });

  describe('JSON Validation', () => {
    it('should accept valid JSON', () => {
      const validJson = [
        '{"key": "value"}',
        '{"nested": {"key": "value"}}',
        '{"array": [1, 2, 3]}',
      ];

      validJson.forEach((json) => {
        expect(isValidJson(json)).toBe(true);
      });
    });

    it('should reject invalid or non-object JSON', () => {
      const invalidJson = [
        '{key: "value"}', // Invalid syntax
        'not json',       // Not JSON
        '',               // Empty
      ];

      invalidJson.forEach((json) => {
        expect(isValidJson(json)).toBe(false);
      });
    });

    it('should reject non-object JSON types for webhook payloads', () => {
      // For webhook payloads, we only accept objects
      // null parses as object but is null
      expect(isValidJson('null')).toBe(false);
      // arrays are objects but we want key-value objects
      expect(isValidJson('[]')).toBe(false);
      // primitives are not objects
      expect(isValidJson('123')).toBe(false);
    });
  });
});

// =====================================================
// DATA LEAK PREVENTION TESTS
// =====================================================

describe('Security: Data Leak Prevention', () => {
  describe('Sensitive Data Masking', () => {
    it('should mask phone numbers', () => {
      const text = 'Llámame al +52 55 1234 5678';
      const masked = maskSensitiveData(text);

      expect(masked).not.toContain('1234 5678');
      expect(masked).toContain('****');
    });

    it('should mask email addresses', () => {
      const text = 'Mi correo es juan.perez@email.com';
      const masked = maskSensitiveData(text);

      expect(masked).not.toContain('juan.perez');
      expect(masked).toContain('j***@email.com');
    });

    it('should mask multiple sensitive values', () => {
      const text = 'Tel: 5512345678, Email: user@test.com';
      const masked = maskSensitiveData(text);

      expect(masked).toContain('****');
      expect(masked).toContain('***@');
    });

    it('should preserve non-sensitive text', () => {
      const text = 'Hola, mi nombre es Juan';
      const masked = maskSensitiveData(text);

      expect(masked).toBe(text);
    });
  });

  describe('String Length Limits', () => {
    it('should truncate long strings', () => {
      const longString = 'a'.repeat(1000);
      const truncated = truncate(longString, 100);

      expect(truncated.length).toBe(100);
    });

    it('should not modify short strings', () => {
      const shortString = 'Hello';
      const truncated = truncate(shortString, 100);

      expect(truncated).toBe(shortString);
    });

    it('should handle edge cases', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate(null as unknown as string, 10)).toBe('');
    });
  });
});

// =====================================================
// WEBHOOK PAYLOAD VALIDATION TESTS
// =====================================================

describe('Security: Webhook Payload Validation', () => {
  interface WebhookPayload {
    message: {
      type: string;
      call?: {
        id: string;
        orgId: string;
      };
    };
  }

  function validateWebhookPayload(payload: unknown): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be an object');
      return { valid: false, errors };
    }

    const p = payload as WebhookPayload;

    if (!p.message) {
      errors.push('Missing message object');
    } else {
      if (!p.message.type) {
        errors.push('Missing message.type');
      }
      if (p.message.call) {
        if (!p.message.call.id) {
          errors.push('Missing call.id');
        }
        if (!p.message.call.orgId) {
          errors.push('Missing call.orgId');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  it('should validate correct payload', () => {
    const payload = {
      message: {
        type: 'assistant-request',
        call: {
          id: 'call-123',
          orgId: 'org-456',
        },
      },
    };

    const result = validateWebhookPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing message', () => {
    const payload = {};

    const result = validateWebhookPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing message object');
  });

  it('should reject missing type', () => {
    const payload = {
      message: {},
    };

    const result = validateWebhookPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing message.type');
  });

  it('should reject non-object payload', () => {
    const invalidPayloads = [null, undefined, 'string', 123, []];

    invalidPayloads.forEach((payload) => {
      const result = validateWebhookPayload(payload);
      expect(result.valid).toBe(false);
    });
  });
});
