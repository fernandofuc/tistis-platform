// =====================================================
// TIS TIS PLATFORM - Server-Side Image Validator
// Validates uploaded files for security and integrity
// =====================================================

// =====================================================
// TYPES
// =====================================================

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    actualMimeType: string;
    declaredMimeType: string;
    fileSize: number;
  };
}

export interface ImageValidationOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

// =====================================================
// MAGIC NUMBERS (File Signatures)
// =====================================================

interface MagicNumber {
  bytes: number[];
  offset?: number;
  mimeType: string;
  format: string;
}

const MAGIC_NUMBERS: MagicNumber[] = [
  // JPEG
  { bytes: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg', format: 'jpeg' },

  // PNG
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: 'image/png', format: 'png' },

  // WebP (RIFF....WEBP)
  { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', format: 'webp' },

  // GIF87a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mimeType: 'image/gif', format: 'gif' },

  // GIF89a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mimeType: 'image/gif', format: 'gif' },

  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', format: 'pdf' },

  // BMP
  { bytes: [0x42, 0x4D], mimeType: 'image/bmp', format: 'bmp' },

  // TIFF (little-endian)
  { bytes: [0x49, 0x49, 0x2A, 0x00], mimeType: 'image/tiff', format: 'tiff' },

  // TIFF (big-endian)
  { bytes: [0x4D, 0x4D, 0x00, 0x2A], mimeType: 'image/tiff', format: 'tiff' },

  // HEIC/HEIF (ftyp heic/heix/mif1)
  { bytes: [0x00, 0x00, 0x00], offset: 0, mimeType: 'image/heic', format: 'heic' },
];

// WebP secondary check (bytes at offset 8)
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

// =====================================================
// CONSTANTS
// =====================================================

const DEFAULT_OPTIONS: ImageValidationOptions = {
  maxWidth: 8192,
  maxHeight: 8192,
  minWidth: 10,
  minHeight: 10,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ],
};

// Suspicious patterns in file content
const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /data:text\/html/i,
  /onclick/i,
  /onerror/i,
  /onload/i,
  /__proto__/i,
  /constructor\s*\[/i,
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if buffer starts with given bytes at optional offset
 */
function checkMagicNumber(buffer: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;

  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }

  return true;
}

/**
 * Detect actual MIME type from file content
 */
function detectMimeType(buffer: Uint8Array): { mimeType: string; format: string } | null {
  for (const magic of MAGIC_NUMBERS) {
    if (checkMagicNumber(buffer, magic.bytes, magic.offset ?? 0)) {
      // Special handling for WebP (needs secondary check)
      if (magic.format === 'webp') {
        if (checkMagicNumber(buffer, WEBP_SIGNATURE, 8)) {
          return { mimeType: magic.mimeType, format: magic.format };
        }
        continue;
      }

      return { mimeType: magic.mimeType, format: magic.format };
    }
  }

  return null;
}

/**
 * Extract image dimensions from PNG
 */
function getPngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // PNG dimensions are at bytes 16-23 (IHDR chunk)
  if (buffer.length < 24) return null;

  // Check for PNG signature
  if (!checkMagicNumber(buffer, [0x89, 0x50, 0x4E, 0x47])) return null;

  // IHDR should be at position 8
  const ihdrPos = 8;

  // Read IHDR chunk
  if (buffer.length < ihdrPos + 16) return null;

  // Width (bytes 16-19, big-endian)
  const width = (buffer[ihdrPos + 8] << 24) |
                (buffer[ihdrPos + 9] << 16) |
                (buffer[ihdrPos + 10] << 8) |
                buffer[ihdrPos + 11];

  // Height (bytes 20-23, big-endian)
  const height = (buffer[ihdrPos + 12] << 24) |
                 (buffer[ihdrPos + 13] << 16) |
                 (buffer[ihdrPos + 14] << 8) |
                 buffer[ihdrPos + 15];

  return { width, height };
}

/**
 * Extract image dimensions from JPEG
 */
function getJpegDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // JPEG is more complex, need to find SOF marker
  if (buffer.length < 4) return null;
  if (!checkMagicNumber(buffer, [0xFF, 0xD8, 0xFF])) return null;

  let offset = 2;

  while (offset < buffer.length - 9) {
    // Find marker
    if (buffer[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // SOF markers (Start Of Frame) contain dimensions
    // SOF0 (0xC0) to SOF3 (0xC3), SOF5 (0xC5) to SOF7 (0xC7)
    // SOF9 (0xC9) to SOF11 (0xCB), SOF13 (0xCD) to SOF15 (0xCF)
    if ((marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)) {

      // SOF structure: marker (2) + length (2) + precision (1) + height (2) + width (2)
      if (offset + 9 > buffer.length) return null;

      const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
      const width = (buffer[offset + 7] << 8) | buffer[offset + 8];

      return { width, height };
    }

    // Skip other markers
    if (marker >= 0xD0 && marker <= 0xD9) {
      // Standalone markers (no length)
      offset += 2;
      continue;
    }

    // Read length and skip segment
    if (offset + 3 >= buffer.length) break;
    const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
    offset += 2 + length;
  }

  return null;
}

/**
 * Extract image dimensions from WebP
 */
function getWebpDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 30) return null;

  // Check RIFF header
  if (!checkMagicNumber(buffer, [0x52, 0x49, 0x46, 0x46])) return null;

  // Check WEBP signature at offset 8
  if (!checkMagicNumber(buffer, WEBP_SIGNATURE, 8)) return null;

  // Check chunk type at offset 12
  const chunkType = String.fromCharCode(
    buffer[12], buffer[13], buffer[14], buffer[15]
  );

  if (chunkType === 'VP8 ') {
    // Lossy WebP
    // Frame tag at offset 23
    if (buffer.length < 30) return null;

    // Width and height are at offset 26-29 (little-endian, 14 bits each)
    const width = (buffer[26] | (buffer[27] << 8)) & 0x3FFF;
    const height = (buffer[28] | (buffer[29] << 8)) & 0x3FFF;

    return { width, height };
  }

  if (chunkType === 'VP8L') {
    // Lossless WebP
    if (buffer.length < 25) return null;

    // Signature byte at offset 21 should be 0x2F
    if (buffer[21] !== 0x2F) return null;

    // Width and height encoded in bytes 22-25
    const bits = (buffer[22]) |
                 (buffer[23] << 8) |
                 (buffer[24] << 16) |
                 (buffer[25] << 24);

    const width = (bits & 0x3FFF) + 1;
    const height = ((bits >> 14) & 0x3FFF) + 1;

    return { width, height };
  }

  if (chunkType === 'VP8X') {
    // Extended WebP
    if (buffer.length < 30) return null;

    // Canvas width at offset 24-26 (little-endian, 24 bits, +1)
    const width = ((buffer[24]) |
                   (buffer[25] << 8) |
                   (buffer[26] << 16)) + 1;

    // Canvas height at offset 27-29 (little-endian, 24 bits, +1)
    const height = ((buffer[27]) |
                    (buffer[28] << 8) |
                    (buffer[29] << 16)) + 1;

    return { width, height };
  }

  return null;
}

/**
 * Extract image dimensions from GIF
 */
function getGifDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 10) return null;

  // Check GIF signature
  if (!checkMagicNumber(buffer, [0x47, 0x49, 0x46, 0x38])) return null;

  // Logical screen width (little-endian) at offset 6
  const width = buffer[6] | (buffer[7] << 8);

  // Logical screen height (little-endian) at offset 8
  const height = buffer[8] | (buffer[9] << 8);

  return { width, height };
}

/**
 * Get image dimensions based on format
 */
function getImageDimensions(
  buffer: Uint8Array,
  format: string
): { width: number; height: number } | null {
  switch (format) {
    case 'png':
      return getPngDimensions(buffer);
    case 'jpeg':
      return getJpegDimensions(buffer);
    case 'webp':
      return getWebpDimensions(buffer);
    case 'gif':
      return getGifDimensions(buffer);
    default:
      return null;
  }
}

/**
 * Check for suspicious content in file
 */
function checkSuspiciousContent(buffer: Uint8Array): string[] {
  const warnings: string[] = [];

  // Convert first 8KB to string for pattern matching
  const textSample = new TextDecoder('utf-8', { fatal: false })
    .decode(buffer.slice(0, 8192));

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(textSample)) {
      warnings.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }

  // Check for null bytes in image (often indicates polyglot files)
  let nullCount = 0;
  const checkLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0x00) nullCount++;
  }

  // High null byte ratio in text-based areas is suspicious
  if (nullCount > checkLength * 0.5) {
    warnings.push('Unusual null byte distribution detected');
  }

  return warnings;
}

// =====================================================
// IMAGE VALIDATOR SERVICE CLASS
// =====================================================

export class ImageValidatorService {
  private static instance: ImageValidatorService;

  private constructor() {}

  static getInstance(): ImageValidatorService {
    if (!ImageValidatorService.instance) {
      ImageValidatorService.instance = new ImageValidatorService();
    }
    return ImageValidatorService.instance;
  }

  /**
   * Validate an image file
   * Checks: magic number, MIME type match, dimensions, suspicious content
   */
  async validateImage(
    buffer: ArrayBuffer | Uint8Array,
    declaredMimeType: string,
    options: ImageValidationOptions = {}
  ): Promise<ImageValidationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    const uint8Buffer = buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

    // Check file size
    if (uint8Buffer.length > (opts.maxFileSize ?? Infinity)) {
      errors.push(`File size ${uint8Buffer.length} exceeds maximum ${opts.maxFileSize}`);
    }

    // Detect actual MIME type from content
    const detected = detectMimeType(uint8Buffer);

    if (!detected) {
      errors.push('Unable to detect file type from content');
      return {
        valid: false,
        errors,
        warnings,
        metadata: {
          actualMimeType: 'unknown',
          declaredMimeType,
          fileSize: uint8Buffer.length,
        },
      };
    }

    // Check if declared MIME type matches actual
    const declaredNormalized = declaredMimeType.toLowerCase().split(';')[0].trim();
    if (detected.mimeType !== declaredNormalized) {
      // Some flexibility for JPEG variations
      const isJpegVariant = detected.mimeType === 'image/jpeg' &&
        ['image/jpg', 'image/pjpeg'].includes(declaredNormalized);

      if (!isJpegVariant) {
        errors.push(
          `MIME type mismatch: declared ${declaredMimeType}, detected ${detected.mimeType}`
        );
      }
    }

    // Check if MIME type is allowed
    if (opts.allowedMimeTypes && !opts.allowedMimeTypes.includes(detected.mimeType)) {
      errors.push(`File type ${detected.mimeType} is not allowed`);
    }

    // Get image dimensions (for image types)
    let dimensions: { width: number; height: number } | null = null;
    if (detected.mimeType.startsWith('image/')) {
      dimensions = getImageDimensions(uint8Buffer, detected.format);

      if (dimensions) {
        // Validate dimensions
        if (opts.minWidth && dimensions.width < opts.minWidth) {
          errors.push(`Image width ${dimensions.width} is below minimum ${opts.minWidth}`);
        }
        if (opts.minHeight && dimensions.height < opts.minHeight) {
          errors.push(`Image height ${dimensions.height} is below minimum ${opts.minHeight}`);
        }
        if (opts.maxWidth && dimensions.width > opts.maxWidth) {
          errors.push(`Image width ${dimensions.width} exceeds maximum ${opts.maxWidth}`);
        }
        if (opts.maxHeight && dimensions.height > opts.maxHeight) {
          errors.push(`Image height ${dimensions.height} exceeds maximum ${opts.maxHeight}`);
        }
      } else {
        warnings.push('Could not extract image dimensions');
      }
    }

    // Check for suspicious content
    const suspiciousWarnings = checkSuspiciousContent(uint8Buffer);
    warnings.push(...suspiciousWarnings);

    // If suspicious content found, treat as error
    if (suspiciousWarnings.length > 0) {
      errors.push('File contains potentially malicious content');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        width: dimensions?.width,
        height: dimensions?.height,
        format: detected.format,
        actualMimeType: detected.mimeType,
        declaredMimeType,
        fileSize: uint8Buffer.length,
      },
    };
  }

  /**
   * Quick validation for MIME type only
   */
  quickValidateMimeType(
    buffer: ArrayBuffer | Uint8Array,
    declaredMimeType: string
  ): { valid: boolean; actualMimeType: string | null } {
    const uint8Buffer = buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

    const detected = detectMimeType(uint8Buffer);

    if (!detected) {
      return { valid: false, actualMimeType: null };
    }

    const declaredNormalized = declaredMimeType.toLowerCase().split(';')[0].trim();

    // Allow JPEG variations
    if (detected.mimeType === 'image/jpeg') {
      const valid = ['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(declaredNormalized);
      return { valid, actualMimeType: detected.mimeType };
    }

    return {
      valid: detected.mimeType === declaredNormalized,
      actualMimeType: detected.mimeType,
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const imageValidatorService = ImageValidatorService.getInstance();
