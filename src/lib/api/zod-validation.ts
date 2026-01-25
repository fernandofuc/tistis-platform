// =====================================================
// TIS TIS PLATFORM - Zod Validation Middleware
// Centralized validation helper for API routes using Zod
// =====================================================

import { z, ZodSchema, ZodError } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ======================
// TYPES
// ======================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errors: ValidationError[];
}

export type ZodValidationResult<T> = ValidationResult<T> | ValidationFailure;

// ======================
// CORE VALIDATION FUNCTION
// ======================

/**
 * Validates data against a Zod schema
 *
 * @param schema - Zod schema to validate against (supports transforms)
 * @param data - Data to validate (typically from request.json())
 * @returns Validation result with typed data or errors
 *
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string().min(1) });
 * const result = validateSchema(schema, await request.json());
 *
 * if (!result.success) {
 *   return NextResponse.json({ errors: result.errors }, { status: 400 });
 * }
 *
 * const { name } = result.data; // typed!
 * ```
 */
export function validateSchema<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): ZodValidationResult<z.output<S>> {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.') || 'root',
        message: err.message,
        code: err.code,
      }));
      return { success: false, errors };
    }

    // Unexpected error
    return {
      success: false,
      errors: [{ field: 'root', message: 'Error de validacion inesperado', code: 'UNKNOWN' }],
    };
  }
}

/**
 * Async version that validates request body directly
 *
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against (supports transforms)
 * @returns Validation result with typed data or errors
 *
 * @example
 * ```typescript
 * const result = await validateRequest(request, LeadCreateSchema);
 * if (!result.success) {
 *   return validationErrorResponse(result.errors);
 * }
 * const { name, phone, email } = result.data;
 * ```
 */
export async function validateRequest<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<ZodValidationResult<z.output<S>>> {
  try {
    const body = await request.json();
    return validateSchema(schema, body);
  } catch {
    return {
      success: false,
      errors: [{ field: 'body', message: 'JSON invalido en el cuerpo de la peticion', code: 'INVALID_JSON' }],
    };
  }
}

/**
 * Validates query parameters against a schema
 *
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against (supports transforms)
 * @returns Validation result
 */
export function validateQueryParams<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): ZodValidationResult<z.output<S>> {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};

  url.searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  return validateSchema(schema, params);
}

/**
 * Validates URL path parameters
 *
 * @param params - Route params object
 * @param schema - Zod schema to validate against (supports transforms)
 * @returns Validation result
 */
export function validatePathParams<S extends z.ZodTypeAny>(
  params: Record<string, string | string[] | undefined>,
  schema: S
): ZodValidationResult<z.output<S>> {
  return validateSchema(schema, params);
}

// ======================
// ERROR RESPONSE HELPERS
// ======================

/**
 * Creates a standardized validation error response
 */
export function validationErrorResponse(
  errors: ValidationError[],
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Error de validacion',
      errors: errors.map((e) => ({
        field: e.field,
        message: e.message,
        code: e.code,
      })),
    },
    { status }
  );
}

/**
 * Quick validation check - returns error response if validation fails
 * Use this for cleaner route handlers
 *
 * @example
 * ```typescript
 * const validation = await validateRequest(request, schema);
 * const errorOrData = checkValidation(validation);
 * if (errorOrData instanceof NextResponse) return errorOrData;
 * const data = errorOrData; // typed!
 * ```
 */
export function checkValidation<T>(
  result: ZodValidationResult<T>
): NextResponse | T {
  if (!result.success) {
    return validationErrorResponse(result.errors);
  }
  return result.data;
}

// ======================
// TYPE HELPERS
// ======================

/**
 * Type guard for checking if validation succeeded
 */
export function isValidationSuccess<T>(
  result: ZodValidationResult<T>
): result is ValidationResult<T> {
  return result.success === true;
}

/**
 * Type guard for checking if validation failed
 */
export function isValidationFailure<T>(
  result: ZodValidationResult<T>
): result is ValidationFailure {
  return result.success === false;
}

// ======================
// USAGE EXAMPLE
// ======================

/*
import { validateRequest, checkValidation } from '@/lib/api/zod-validation';
import { LeadCreateSchema } from '@/shared/schemas/leads.schema';

export async function POST(request: NextRequest) {
  // Method 1: Using checkValidation helper (cleaner)
  const validation = await validateRequest(request, LeadCreateSchema);
  const result = checkValidation(validation);
  if (result instanceof NextResponse) return result;

  const { name, phone, email } = result; // fully typed!

  // Method 2: Manual handling (more control)
  const validation = await validateRequest(request, LeadCreateSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors);
  }

  const { name, phone, email } = validation.data;
}
*/

// Re-export z for convenience
export { z, ZodSchema, ZodError };
