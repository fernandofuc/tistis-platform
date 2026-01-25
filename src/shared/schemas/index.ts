// =====================================================
// TIS TIS PLATFORM - Schemas Index
// Central export for all Zod validation schemas
// =====================================================

// Common schemas (UUIDs, pagination, dates, text, etc.)
export * from './common.schema';

// Feature-specific schemas
export * from './leads.schema';
export * from './appointments.schema';
export * from './conversations.schema';
export * from './webhook.schema';
