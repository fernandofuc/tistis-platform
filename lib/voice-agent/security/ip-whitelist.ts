/**
 * TIS TIS Platform - Voice Agent v2.0
 * IP Whitelist Security Layer
 *
 * Validates incoming request IPs against VAPI's known IP ranges.
 * Supports CIDR notation, IPv4, and IPv6 (with IPv4-mapped handling).
 */

import type {
  IPWhitelistConfig,
  ValidationCheckResult,
} from './types';
import { DEFAULT_VAPI_IP_RANGES } from './types';

// =====================================================
// IP WHITELIST CLASS
// =====================================================

export class IPWhitelist {
  private readonly config: IPWhitelistConfig;
  private readonly parsedRanges: ParsedCIDR[];

  constructor(config?: Partial<IPWhitelistConfig>) {
    this.config = {
      allowedIPs: [...DEFAULT_VAPI_IP_RANGES],
      allowAllInDevelopment: false,
      trustProxy: true,
      maxProxyHops: 2,
      ...config,
    };

    // Pre-parse CIDR ranges for faster validation
    this.parsedRanges = this.config.allowedIPs.map((ip) =>
      parseCIDR(ip)
    );
  }

  /**
   * Check if an IP address is allowed
   */
  isAllowed(ip: string): boolean {
    // Development mode bypass
    if (
      this.config.allowAllInDevelopment &&
      process.env.NODE_ENV === 'development'
    ) {
      return true;
    }

    // Normalize the IP address
    const normalizedIp = this.normalizeIP(ip);

    if (!normalizedIp) {
      return false;
    }

    // Check against all allowed ranges
    return this.parsedRanges.some((range) =>
      isIPInRange(normalizedIp, range)
    );
  }

  /**
   * Validate IP from request with full result
   */
  validate(
    ip: string,
    forwardedFor?: string | null
  ): ValidationCheckResult {
    // Extract the actual client IP
    const clientIp = this.extractClientIP(ip, forwardedFor);

    if (!clientIp) {
      return {
        passed: false,
        reason: 'Could not determine client IP address',
        metadata: { rawIp: ip, forwardedFor },
      };
    }

    const allowed = this.isAllowed(clientIp);

    if (!allowed) {
      return {
        passed: false,
        reason: `IP address ${clientIp} is not in the whitelist`,
        metadata: {
          clientIp,
          normalizedIp: this.normalizeIP(clientIp),
          allowedRanges: this.config.allowedIPs,
        },
      };
    }

    return {
      passed: true,
      metadata: { clientIp },
    };
  }

  /**
   * Extract client IP from request, handling proxies
   */
  extractClientIP(
    directIp: string,
    forwardedFor?: string | null
  ): string | null {
    // If we don't trust proxy headers, use direct IP
    if (!this.config.trustProxy || !forwardedFor) {
      return this.normalizeIP(directIp);
    }

    // Parse x-forwarded-for header
    // Format: "client, proxy1, proxy2"
    const forwardedIps = forwardedFor
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    if (forwardedIps.length === 0) {
      return this.normalizeIP(directIp);
    }

    // Take the first IP (original client) respecting maxProxyHops
    // The leftmost IP is typically the original client
    const maxHops = this.config.maxProxyHops ?? 2;
    const clientIp = forwardedIps[0];

    // Validate that we're not accepting more hops than configured
    if (forwardedIps.length > maxHops + 1) {
      // Too many proxy hops, this could be spoofing
      // Fall back to the IP at maxHops position
      return this.normalizeIP(forwardedIps[maxHops]);
    }

    return this.normalizeIP(clientIp);
  }

  /**
   * Normalize IP address (handle IPv6-mapped IPv4)
   */
  normalizeIP(ip: string): string | null {
    if (!ip) {
      return null;
    }

    let normalized = ip.trim();

    // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.substring(7);
    }

    // Handle full IPv6-mapped format (0:0:0:0:0:ffff:192.168.1.1)
    const ipv6MappedMatch = normalized.match(
      /^(?:0{1,4}:){5}ffff:(.+)$/i
    );
    if (ipv6MappedMatch) {
      normalized = ipv6MappedMatch[1];
    }

    // Validate basic IP format
    if (!isValidIPv4(normalized) && !isValidIPv6(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Add an IP or range to the whitelist
   */
  addIP(ip: string): void {
    if (!this.config.allowedIPs.includes(ip)) {
      this.config.allowedIPs.push(ip);
      this.parsedRanges.push(parseCIDR(ip));
    }
  }

  /**
   * Remove an IP or range from the whitelist
   */
  removeIP(ip: string): boolean {
    const index = this.config.allowedIPs.indexOf(ip);
    if (index > -1) {
      this.config.allowedIPs.splice(index, 1);
      this.parsedRanges.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get current whitelist
   */
  getWhitelist(): string[] {
    return [...this.config.allowedIPs];
  }
}

// =====================================================
// CIDR PARSING AND VALIDATION
// =====================================================

interface ParsedCIDR {
  ip: number[];
  mask: number;
  isIPv6: boolean;
}

/**
 * Parse a CIDR notation string into components
 */
function parseCIDR(cidr: string): ParsedCIDR {
  const parts = cidr.split('/');
  const ip = parts[0];
  const maskBits = parts[1] ? parseInt(parts[1], 10) : null;

  const isIPv6 = ip.includes(':');

  if (isIPv6) {
    const ipParts = parseIPv6(ip);
    return {
      ip: ipParts,
      mask: maskBits ?? 128,
      isIPv6: true,
    };
  } else {
    const ipParts = ip.split('.').map((p) => parseInt(p, 10));
    return {
      ip: ipParts,
      mask: maskBits ?? 32,
      isIPv6: false,
    };
  }
}

/**
 * Parse IPv6 address into array of 16-bit groups
 */
function parseIPv6(ip: string): number[] {
  // Handle :: expansion
  const parts = ip.split('::');

  let groups: number[] = [];

  if (parts.length === 2) {
    const leftGroups = parts[0]
      ? parts[0].split(':').map((h) => parseInt(h, 16) || 0)
      : [];
    const rightGroups = parts[1]
      ? parts[1].split(':').map((h) => parseInt(h, 16) || 0)
      : [];
    const middleZeros = 8 - leftGroups.length - rightGroups.length;
    groups = [
      ...leftGroups,
      ...new Array(middleZeros).fill(0),
      ...rightGroups,
    ];
  } else {
    groups = ip.split(':').map((h) => parseInt(h, 16) || 0);
  }

  // Ensure we have exactly 8 groups
  while (groups.length < 8) {
    groups.push(0);
  }

  return groups.slice(0, 8);
}

/**
 * Check if an IP is within a CIDR range
 */
function isIPInRange(ip: string, range: ParsedCIDR): boolean {
  const isIPv6 = ip.includes(':');

  // Type mismatch - IPv6 can't match IPv4 range and vice versa
  if (isIPv6 !== range.isIPv6) {
    return false;
  }

  if (isIPv6) {
    return isIPv6InRange(ip, range);
  } else {
    return isIPv4InRange(ip, range);
  }
}

/**
 * Check if IPv4 is in range
 */
function isIPv4InRange(ip: string, range: ParsedCIDR): boolean {
  const ipParts = ip.split('.').map((p) => parseInt(p, 10));

  if (ipParts.length !== 4 || ipParts.some(isNaN)) {
    return false;
  }

  // Convert to 32-bit integers for comparison
  const ipInt =
    (ipParts[0] << 24) |
    (ipParts[1] << 16) |
    (ipParts[2] << 8) |
    ipParts[3];

  const rangeInt =
    (range.ip[0] << 24) |
    (range.ip[1] << 16) |
    (range.ip[2] << 8) |
    range.ip[3];

  // Create mask
  const mask = range.mask === 0 ? 0 : ~((1 << (32 - range.mask)) - 1);

  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Check if IPv6 is in range
 */
function isIPv6InRange(ip: string, range: ParsedCIDR): boolean {
  const ipParts = parseIPv6(ip);

  // Compare each 16-bit group with the mask
  let remainingBits = range.mask;

  for (let i = 0; i < 8; i++) {
    if (remainingBits <= 0) {
      break;
    }

    const bitsToCheck = Math.min(16, remainingBits);
    const mask =
      bitsToCheck === 16 ? 0xffff : ~((1 << (16 - bitsToCheck)) - 1) & 0xffff;

    if ((ipParts[i] & mask) !== (range.ip[i] & mask)) {
      return false;
    }

    remainingBits -= 16;
  }

  return true;
}

// =====================================================
// IP VALIDATION HELPERS
// =====================================================

/**
 * Validate IPv4 address format
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * Validate IPv6 address format (basic validation)
 */
function isValidIPv6(ip: string): boolean {
  // Basic IPv6 validation
  const parts = ip.split('::');

  if (parts.length > 2) {
    return false; // Only one :: allowed
  }

  const allParts =
    parts.length === 2
      ? [...parts[0].split(':'), ...parts[1].split(':')].filter(
          (p) => p.length > 0
        )
      : ip.split(':');

  if (allParts.length > 8) {
    return false;
  }

  return allParts.every((part) => {
    if (part.length === 0 || part.length > 4) {
      return false;
    }
    return /^[0-9a-fA-F]+$/.test(part);
  });
}

// =====================================================
// EXPORTS
// =====================================================

export { parseCIDR, isIPInRange, isValidIPv4, isValidIPv6 };
