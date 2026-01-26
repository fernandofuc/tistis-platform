/**
 * TIS TIS PLATFORM - Admin Channel Utils Barrel Export
 *
 * Exporta utilidades del Admin Channel.
 *
 * @module admin-channel/utils
 */

export { formatReportForChannel } from './report-formatter';
export type { FormattedReport } from './report-formatter';

// Shared helpers
export {
  validateUUID,
  isValidUUID,
  withTimeout,
  extractString,
  extractNumber,
  extractBoolean,
  escapeLikePattern,
  sanitizeUserContent,
} from './helpers';
