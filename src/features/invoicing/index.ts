// =====================================================
// TIS TIS PLATFORM - Invoicing Feature Module
// AI-powered invoice generation from ticket photos
// =====================================================

// ======================
// TYPES
// ======================
export * from './types';

// ======================
// SERVICES
// ======================
export {
  InvoiceService,
  getInvoiceService,
} from './services/invoice.service';

export {
  GeminiExtractionService,
  getGeminiExtractionService,
  processTicketImage,
} from './services/gemini-extraction.service';

export {
  PDFGeneratorService,
  getPDFGeneratorService,
} from './services/pdf-generator.service';

export {
  InvoiceEmailService,
  getInvoiceEmailService,
} from './services/email.service';

// ======================
// HOOKS
// ======================
export { useInvoices } from './hooks/useInvoices';
export { useTicketExtraction } from './hooks/useTicketExtraction';

// ======================
// UTILS
// ======================
export {
  validateRFC,
  formatRFC,
  getRFCTypeDescription,
  REGIMEN_FISCAL_OPTIONS,
  USO_CFDI_OPTIONS,
  FORMA_PAGO_OPTIONS,
} from './utils/rfc-validator';
