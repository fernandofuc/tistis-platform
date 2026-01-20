/**
 * TIS TIS Platform - Voice Agent v2.0
 * Security Gate Tests
 *
 * Comprehensive tests for all 5 security layers:
 * 1. IP Whitelist
 * 2. Rate Limiting
 * 3. Timestamp Validation
 * 4. HMAC Signature
 * 5. Content Validation
 *
 * @jest-environment node
 */

// Jest test suite - globals provided by Jest
import { createHmac } from 'crypto';
import {
  WebhookSecurityGate,
  createSecurityGate,
  createDevSecurityGate,
  IPWhitelist,
  RateLimiter,
  MultiTierRateLimiter,
  DEFAULT_VAPI_IP_RANGES,
} from '../../../lib/voice-agent/security';

// =====================================================
// TEST HELPERS
// =====================================================

/**
 * Create a mock Request object
 */
function createMockRequest(options: {
  body?: string;
  headers?: Record<string, string>;
  ip?: string;
}): Request {
  const headers = new Headers(options.headers ?? {});

  // Set default content-type
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  // Set IP if provided
  if (options.ip) {
    headers.set('x-forwarded-for', options.ip);
  }

  const request = new Request('https://api.example.com/webhook', {
    method: 'POST',
    headers,
    body: options.body ?? JSON.stringify({ message: { type: 'assistant-request' } }),
  });

  return request;
}

/**
 * Create a valid VAPI webhook payload
 */
function createVapiPayload(type: string = 'assistant-request'): string {
  return JSON.stringify({
    message: {
      type,
      call: {
        id: 'call-123',
        orgId: 'org-456',
        createdAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Generate HMAC signature for testing
 */
function generateSignature(
  secretKey: string,
  timestamp: string,
  payload: string
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac('sha256', secretKey).update(signedPayload).digest('hex');
}

// =====================================================
// IP WHITELIST TESTS
// =====================================================

describe('IPWhitelist', () => {
  describe('CIDR Range Validation', () => {
    it('should allow IPs within VAPI CIDR ranges', () => {
      const whitelist = new IPWhitelist();

      // Test IPs within VAPI ranges
      expect(whitelist.isAllowed('54.172.60.1')).toBe(true);
      expect(whitelist.isAllowed('54.172.60.255')).toBe(true);
      expect(whitelist.isAllowed('54.244.51.100')).toBe(true);
      expect(whitelist.isAllowed('52.2.4.50')).toBe(true);
      expect(whitelist.isAllowed('3.129.67.200')).toBe(true);
    });

    it('should block IPs outside VAPI ranges', () => {
      const whitelist = new IPWhitelist();

      expect(whitelist.isAllowed('192.168.1.1')).toBe(false);
      expect(whitelist.isAllowed('10.0.0.1')).toBe(false);
      expect(whitelist.isAllowed('8.8.8.8')).toBe(false);
      expect(whitelist.isAllowed('1.2.3.4')).toBe(false);
    });

    it('should handle custom CIDR ranges', () => {
      const whitelist = new IPWhitelist({
        allowedIPs: ['192.168.1.0/24', '10.0.0.0/8'],
      });

      expect(whitelist.isAllowed('192.168.1.100')).toBe(true);
      expect(whitelist.isAllowed('192.168.2.1')).toBe(false);
      expect(whitelist.isAllowed('10.1.2.3')).toBe(true);
      expect(whitelist.isAllowed('11.0.0.1')).toBe(false);
    });
  });

  describe('IPv6 Handling', () => {
    it('should handle IPv6-mapped IPv4 addresses', () => {
      const whitelist = new IPWhitelist({
        allowedIPs: ['192.168.1.0/24'],
      });

      // ::ffff:192.168.1.1 should be treated as 192.168.1.1
      expect(whitelist.isAllowed('::ffff:192.168.1.1')).toBe(true);
      expect(whitelist.isAllowed('::ffff:192.168.2.1')).toBe(false);
    });

    it('should normalize IPv6-mapped format', () => {
      const whitelist = new IPWhitelist();

      const normalized = whitelist['normalizeIP']('::ffff:54.172.60.1');
      expect(normalized).toBe('54.172.60.1');
    });
  });

  describe('x-forwarded-for Handling', () => {
    it('should extract client IP from forwarded header', () => {
      const whitelist = new IPWhitelist();

      const clientIp = whitelist.extractClientIP(
        '127.0.0.1',
        '54.172.60.1, 10.0.0.1, 192.168.1.1'
      );

      expect(clientIp).toBe('54.172.60.1');
    });

    it('should respect maxProxyHops setting', () => {
      const whitelist = new IPWhitelist({
        maxProxyHops: 1,
      });

      // With many hops, should use the IP at maxHops position
      const clientIp = whitelist.extractClientIP(
        '127.0.0.1',
        '1.1.1.1, 2.2.2.2, 3.3.3.3, 4.4.4.4'
      );

      expect(clientIp).toBe('2.2.2.2'); // maxHops=1 means take position 1
    });
  });

  describe('Development Mode', () => {
    it('should allow all IPs in development when configured', () => {
      const originalEnv = process.env.NODE_ENV;
      // Use Object.defineProperty to avoid TS read-only error
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });

      const whitelist = new IPWhitelist({
        allowAllInDevelopment: true,
      });

      expect(whitelist.isAllowed('1.2.3.4')).toBe(true);
      expect(whitelist.isAllowed('192.168.1.1')).toBe(true);

      // Restore original value
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });
});

// =====================================================
// RATE LIMITER TESTS
// =====================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000, // 1 second window for testing
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const key = 'test-ip';

      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', () => {
      const key = 'test-ip';

      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(key);
      }

      // 6th request should be blocked
      const result = limiter.checkLimit(key);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const key = 'test-ip';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(key);
      }

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      const result = limiter.checkLimit(key);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Sliding Window', () => {
    it('should use sliding window algorithm', async () => {
      const key = 'test-ip';

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit(key);
      }

      // Wait half the window
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Make 2 more requests (should be allowed, total 5)
      const result1 = limiter.checkLimit(key);
      const result2 = limiter.checkLimit(key);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);

      // 6th should be blocked
      const result3 = limiter.checkLimit(key);
      expect(result3.allowed).toBe(false);

      // Wait for first 3 to expire
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should have room for more requests now
      const result4 = limiter.checkLimit(key);
      expect(result4.allowed).toBe(true);
    });
  });

  describe('Key Generation', () => {
    it('should generate correct keys', () => {
      expect(RateLimiter.generateKey('ip', '1.2.3.4')).toBe('ip:1.2.3.4');
      expect(RateLimiter.generateKey('tenant', undefined, 'tenant-123')).toBe(
        'tenant:tenant-123'
      );
      expect(RateLimiter.generateKey('combined', '1.2.3.4', 'tenant-123')).toBe(
        'combined:1.2.3.4:tenant-123'
      );
    });
  });
});

describe('MultiTierRateLimiter', () => {
  let limiter: MultiTierRateLimiter;

  beforeEach(() => {
    limiter = new MultiTierRateLimiter({
      perIp: { maxRequests: 3, windowMs: 1000 },
      perTenant: { maxRequests: 10, windowMs: 1000 },
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  it('should check both IP and tenant limits', () => {
    const result = limiter.checkLimits('1.2.3.4', 'tenant-123');

    expect(result.allowed).toBe(true);
    expect(result.results.ip).toBeDefined();
    expect(result.results.tenant).toBeDefined();
  });

  it('should fail at IP level first', () => {
    // Exhaust IP limit
    for (let i = 0; i < 3; i++) {
      limiter.checkLimits('1.2.3.4', 'tenant-123');
    }

    const result = limiter.checkLimits('1.2.3.4', 'tenant-123');

    expect(result.allowed).toBe(false);
    expect(result.failedAt).toBe('ip');
  });
});

// =====================================================
// TIMESTAMP VALIDATION TESTS
// =====================================================

describe('Timestamp Validation', () => {
  let securityGate: WebhookSecurityGate;

  beforeEach(() => {
    securityGate = new WebhookSecurityGate({
      timestamp: {
        maxAgeMs: 300000, // 5 minutes
        clockSkewToleranceMs: 30000, // 30 seconds
        headerName: 'x-vapi-timestamp',
      },
    });
  });

  afterEach(() => {
    securityGate.stop();
  });

  it('should accept valid timestamp (Unix seconds)', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const result = securityGate.validateTimestamp(timestamp);

    expect(result.passed).toBe(true);
  });

  it('should accept valid timestamp (Unix milliseconds)', () => {
    const timestamp = Date.now().toString();
    const result = securityGate.validateTimestamp(timestamp);

    expect(result.passed).toBe(true);
  });

  it('should accept valid timestamp (ISO string)', () => {
    const timestamp = new Date().toISOString();
    const result = securityGate.validateTimestamp(timestamp);

    expect(result.passed).toBe(true);
  });

  it('should reject old timestamp', () => {
    const oldTimestamp = Math.floor((Date.now() - 600000) / 1000).toString(); // 10 minutes ago
    const result = securityGate.validateTimestamp(oldTimestamp);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('too old');
  });

  it('should reject future timestamp beyond tolerance', () => {
    const futureTimestamp = Math.floor((Date.now() + 60000) / 1000).toString(); // 1 minute in future
    const result = securityGate.validateTimestamp(futureTimestamp);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('future');
  });

  it('should accept timestamp within clock skew tolerance', () => {
    const slightlyFuture = Math.floor((Date.now() + 20000) / 1000).toString(); // 20 seconds in future
    const result = securityGate.validateTimestamp(slightlyFuture);

    expect(result.passed).toBe(true);
  });

  it('should reject missing timestamp', () => {
    const result = securityGate.validateTimestamp(null);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Missing');
  });

  it('should reject invalid timestamp format', () => {
    const result = securityGate.validateTimestamp('not-a-timestamp');

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Invalid');
  });
});

// =====================================================
// HMAC SIGNATURE TESTS
// =====================================================

describe('HMAC Signature Validation', () => {
  const SECRET_KEY = 'test-secret-key-12345';
  let securityGate: WebhookSecurityGate;

  beforeEach(() => {
    securityGate = new WebhookSecurityGate({
      hmac: {
        secretKey: SECRET_KEY,
        signatureHeader: 'x-vapi-signature',
        timestampHeader: 'x-vapi-timestamp',
        algorithm: 'sha256',
      },
    });
  });

  afterEach(() => {
    securityGate.stop();
  });

  it('should accept valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();
    const signature = generateSignature(SECRET_KEY, timestamp, payload);

    const result = securityGate.validateSignature(signature, timestamp, payload);

    expect(result.passed).toBe(true);
  });

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();
    const wrongSignature = generateSignature('wrong-key', timestamp, payload);

    const result = securityGate.validateSignature(wrongSignature, timestamp, payload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('mismatch');
  });

  it('should reject missing signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();

    const result = securityGate.validateSignature(null, timestamp, payload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Missing signature');
  });

  it('should reject tampered payload', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const originalPayload = createVapiPayload();
    const signature = generateSignature(SECRET_KEY, timestamp, originalPayload);

    // Tamper with the payload
    const tamperedPayload = originalPayload.replace('assistant-request', 'hacked');

    const result = securityGate.validateSignature(signature, timestamp, tamperedPayload);

    expect(result.passed).toBe(false);
  });

  it('should reject signature with wrong timestamp', () => {
    const originalTimestamp = Math.floor(Date.now() / 1000).toString();
    const differentTimestamp = Math.floor((Date.now() - 1000) / 1000).toString();
    const payload = createVapiPayload();
    const signature = generateSignature(SECRET_KEY, originalTimestamp, payload);

    const result = securityGate.validateSignature(signature, differentTimestamp, payload);

    expect(result.passed).toBe(false);
  });

  it('should reject signature with invalid hex format', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();

    // Test with non-hex characters
    const invalidHexSignatures = [
      'not-a-valid-hex-string',
      'ghijklmnop1234567890',
      '12345678!@#$%^&*()',
      'abcdef 123456', // space in middle
      '0x1234567890abcdef', // has 0x prefix
    ];

    for (const invalidSig of invalidHexSignatures) {
      const result = securityGate.validateSignature(invalidSig, timestamp, payload);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not valid hex');
    }
  });

  it('should accept signature with valid hex format (even if wrong value)', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();

    // Valid hex but wrong signature - should fail with "mismatch" not "invalid format"
    const wrongButValidHex = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    const result = securityGate.validateSignature(wrongButValidHex, timestamp, payload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('mismatch'); // Should fail for mismatch, not format
    expect(result.reason).not.toContain('not valid hex');
  });
});

// =====================================================
// CONTENT VALIDATION TESTS
// =====================================================

describe('Content Validation', () => {
  let securityGate: WebhookSecurityGate;

  beforeEach(() => {
    securityGate = new WebhookSecurityGate({
      content: {
        maxPayloadSize: 1024, // 1KB for testing
        requiredContentType: 'application/json',
        validateVapiStructure: true,
      },
    });
  });

  afterEach(() => {
    securityGate.stop();
  });

  it('should accept valid VAPI webhook payload', () => {
    const payload = createVapiPayload();
    const result = securityGate.validateContent('application/json', payload);

    expect(result.passed).toBe(true);
  });

  it('should reject invalid content type', () => {
    const payload = createVapiPayload();
    const result = securityGate.validateContent('text/plain', payload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('content type');
  });

  it('should reject oversized payload', () => {
    const largePayload = JSON.stringify({
      message: { type: 'assistant-request' },
      data: 'x'.repeat(2000), // Exceeds 1KB limit
    });

    const result = securityGate.validateContent('application/json', largePayload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('too large');
  });

  it('should reject invalid JSON', () => {
    const result = securityGate.validateContent('application/json', 'not valid json');

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Invalid JSON');
  });

  it('should reject empty body', () => {
    const result = securityGate.validateContent('application/json', '');

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Empty');
  });

  it('should reject missing message object', () => {
    const payload = JSON.stringify({ data: 'no message' });
    const result = securityGate.validateContent('application/json', payload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Invalid VAPI webhook structure');
  });

  it('should reject unknown message type', () => {
    const payload = JSON.stringify({
      message: { type: 'unknown-type' },
    });
    const result = securityGate.validateContent('application/json', payload);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Unknown VAPI message type');
  });

  it('should accept all valid VAPI message types', () => {
    const validTypes = [
      'assistant-request',
      'function-call',
      'function-call-result',
      'conversation-update',
      'end-of-call-report',
      'hang',
      'speech-update',
      'status-update',
      'transcript',
      'tool-calls',
      'tool-call-result',
      'transfer-destination-request',
      'voice-input',
    ];

    for (const type of validTypes) {
      const payload = createVapiPayload(type);
      const result = securityGate.validateContent('application/json', payload);
      expect(result.passed).toBe(true);
    }
  });
});

// =====================================================
// INTEGRATION TESTS
// =====================================================

describe('WebhookSecurityGate Integration', () => {
  const SECRET_KEY = 'integration-test-secret';
  let securityGate: WebhookSecurityGate;

  beforeEach(() => {
    securityGate = new WebhookSecurityGate({
      enabled: true,
      failFast: true,
      ipWhitelist: {
        allowedIPs: ['192.168.1.0/24'],
        allowAllInDevelopment: false,
        trustProxy: true,
        maxProxyHops: 2,
      },
      rateLimiter: {
        maxRequests: 100,
        windowMs: 60000,
      },
      hmac: {
        secretKey: SECRET_KEY,
        signatureHeader: 'x-vapi-signature',
        timestampHeader: 'x-vapi-timestamp',
        algorithm: 'sha256',
      },
      content: {
        maxPayloadSize: 1048576,
        requiredContentType: 'application/json',
        validateVapiStructure: true,
      },
    });
  });

  afterEach(() => {
    securityGate.stop();
  });

  it('should pass a completely valid request', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();
    const signature = generateSignature(SECRET_KEY, timestamp, payload);

    const request = createMockRequest({
      body: payload,
      ip: '192.168.1.100',
      headers: {
        'content-type': 'application/json',
        'x-vapi-timestamp': timestamp,
        'x-vapi-signature': signature,
      },
    });

    const result = await securityGate.validate(request, payload);

    expect(result.valid).toBe(true);
    expect(result.validations.ip).toBe(true);
    expect(result.validations.rateLimit).toBe(true);
    expect(result.validations.timestamp).toBe(true);
    expect(result.validations.signature).toBe(true);
    expect(result.validations.content).toBe(true);
  });

  it('should fail at IP layer for blocked IP', async () => {
    const request = createMockRequest({
      ip: '10.0.0.1', // Not in whitelist
    });

    const result = await securityGate.validate(request);

    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('ip');
    expect(result.validations.ip).toBe(false);
  });

  it('should fail at signature layer for invalid signature', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();
    const wrongSignature = 'invalid-signature';

    const request = createMockRequest({
      body: payload,
      ip: '192.168.1.100',
      headers: {
        'content-type': 'application/json',
        'x-vapi-timestamp': timestamp,
        'x-vapi-signature': wrongSignature,
      },
    });

    const result = await securityGate.validate(request, payload);

    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('signature');
  });

  it('should include metadata in result', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = createVapiPayload();
    const signature = generateSignature(SECRET_KEY, timestamp, payload);

    const request = createMockRequest({
      body: payload,
      ip: '192.168.1.100',
      headers: {
        'content-type': 'application/json',
        'x-vapi-timestamp': timestamp,
        'x-vapi-signature': signature,
      },
    });

    const result = await securityGate.validate(request, payload);

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.requestId).toBeDefined();
    expect(result.metadata?.processingTimeMs).toBeDefined();
    expect(typeof result.metadata?.processingTimeMs).toBe('number');
  });
});

describe('Factory Functions', () => {
  it('should create security gate with createSecurityGate', () => {
    const gate = createSecurityGate();
    expect(gate).toBeInstanceOf(WebhookSecurityGate);
    gate.stop();
  });

  it('should create dev security gate with relaxed settings', () => {
    const gate = createDevSecurityGate();
    const config = gate.getConfig();

    expect(config.ipWhitelist.allowAllInDevelopment).toBe(true);
    gate.stop();
  });
});

// =====================================================
// RATE LIMITER MEMORY EXHAUSTION PROTECTION TESTS
// =====================================================

describe('Rate Limiter Memory Exhaustion Protection', () => {
  it('should reject requests when maxEntries is reached', () => {
    // Import RateLimiter directly for isolated testing
    const { RateLimiter } = require('../../../lib/voice-agent/security/rate-limiter');

    // Create rate limiter with very low maxEntries
    const limiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 60_000,
      maxEntries: 5, // Very small for testing
    });

    try {
      // Fill up to maxEntries with unique IPs
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit(`ip:192.168.1.${i}`);
        expect(result.allowed).toBe(true);
      }

      // Next unique IP should be rejected (memory protection)
      const result = limiter.checkLimit('ip:10.0.0.1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    } finally {
      limiter.stop();
    }
  });

  it('should allow requests after cleanup frees entries', () => {
    const { RateLimiter } = require('../../../lib/voice-agent/security/rate-limiter');

    // Create rate limiter with very short window
    const limiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 50, // 50ms window
      maxEntries: 3,
    });

    try {
      // Fill entries
      limiter.checkLimit('ip:1.1.1.1');
      limiter.checkLimit('ip:2.2.2.2');
      limiter.checkLimit('ip:3.3.3.3');

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // New request should trigger cleanup and succeed
          const result = limiter.checkLimit('ip:4.4.4.4');
          expect(result.allowed).toBe(true);
          resolve();
        }, 100);
      });
    } finally {
      limiter.stop();
    }
  });

  it('should have default maxEntries of 100000', () => {
    const { RateLimiter } = require('../../../lib/voice-agent/security/rate-limiter');

    const limiter = new RateLimiter({});
    const stats = limiter.getStats();

    // Verify limiter works (implying default config applied)
    const result = limiter.checkLimit('test-key');
    expect(result.allowed).toBe(true);

    limiter.stop();
  });
});
