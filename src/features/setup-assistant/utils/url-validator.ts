// =====================================================
// TIS TIS PLATFORM - URL Validation Utilities
// Security functions for validating image URLs
// =====================================================

/**
 * Validates that a URL is from allowed storage sources.
 * Prevents SSRF (Server-Side Request Forgery) attacks.
 *
 * @param url - The URL to validate
 * @returns true if URL is from allowed source, false otherwise
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Extract base host from Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let supabaseHost: string | null = null;
    if (supabaseUrl) {
      try {
        supabaseHost = new URL(supabaseUrl).host;
      } catch {
        // Invalid Supabase URL in env
      }
    }

    // Allowed hosts must match exactly or be valid subdomain
    const allowedHosts = [
      supabaseHost,
      'storage.googleapis.com',
    ].filter((h): h is string => !!h);

    // Check for exact match or subdomain match (host ends with .allowedHost)
    return allowedHosts.some(allowedHost => {
      return parsed.host === allowedHost ||
             parsed.host.endsWith('.' + allowedHost);
    });
  } catch {
    return false;
  }
}

/**
 * Validates that a URL uses HTTPS protocol
 *
 * @param url - The URL to validate
 * @returns true if URL uses HTTPS, false otherwise
 */
export function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Combined validation: checks both allowed host and secure protocol
 *
 * @param url - The URL to validate
 * @returns true if URL passes all security checks
 */
export function isSecureImageUrl(url: string): boolean {
  return isSecureUrl(url) && isValidImageUrl(url);
}
