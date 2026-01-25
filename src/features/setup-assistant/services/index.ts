// =====================================================
// TIS TIS PLATFORM - Setup Assistant Services Exports
// =====================================================

export {
  SetupAssistantService,
  setupAssistantService,
  type ProcessMessageInput,
  type ProcessMessageOutput,
} from './setup-assistant.service';

export {
  VisionService,
  visionService,
  type AnalysisContext,
  type AnalyzeImageInput,
} from './vision.service';

export {
  UsageService,
  usageService,
  type DetailedUsageInfo,
  type ActionCheckResult,
  type UpgradeSuggestion,
} from './usage.service';

export {
  GeminiService,
  geminiService,
  generateText,
  analyzeImage,
  type GeminiTextRequest,
  type GeminiVisionRequest,
  type GeminiResponse,
  type GeminiConfig,
} from './gemini.service';

export {
  SupabaseCheckpointer,
  getCheckpointer,
  resetCheckpointer,
} from './checkpointer.service';

export {
  ImageValidatorService,
  imageValidatorService,
  type ImageValidationResult,
  type ImageValidationOptions,
} from './image-validator.service';

export {
  VisionCacheService,
  visionCacheService,
  type CachedAnalysis,
  type CacheStats,
} from './vision-cache.service';

export {
  StreamingService,
  streamingService,
  createSSEHeaders,
  parseSSEChunk,
  type StreamingConfig,
  type StreamChunk,
  type StreamCallback,
} from './streaming.service';

// FASE 12: Multi-language Support
export {
  LanguageService,
  languageService,
  detectLanguage,
  t,
  getLanguageInstruction,
  type SupportedLanguage,
  type LanguageDetectionResult,
  type LocalizedStrings,
} from './language.service';
