/**
 * TIS TIS PLATFORM - Admin Channel LangGraph State
 *
 * Estado del grafo siguiendo patrones TIS TIS existentes.
 * Define la estructura de datos que fluye entre nodos del grafo.
 *
 * @module admin-channel/graph/state
 */

import { Annotation } from '@langchain/langgraph';
import type {
  AdminChannelContext,
  AdminIntent,
  AdminPendingAction,
  AdminExecutedAction,
  AdminAnalyticsReport,
} from '../types';

// =====================================================
// STATE ANNOTATION
// Siguiendo patrón de src/features/ai/state/agent-state.ts
// =====================================================

export const AdminChannelState = Annotation.Root({
  // === CONTEXTO DEL USUARIO ===
  context: Annotation<AdminChannelContext>({
    reducer: (_, next) => next, // Replace semantics
    default: () => ({}) as AdminChannelContext,
  }),

  // === MENSAJE ACTUAL ===
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  messageId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // === DETECCIÓN DE INTENT ===
  detectedIntent: Annotation<AdminIntent>({
    reducer: (_, next) => next,
    default: () => 'unknown',
  }),

  intentConfidence: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  extractedEntities: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }), // Merge semantics
    default: () => ({}),
  }),

  // === HISTORIAL DE CONVERSACIÓN ===
  conversationHistory: Annotation<Array<{ role: string; content: string }>>({
    reducer: (prev, next) => [...prev, ...next].slice(-20), // Append, keep last 20
    default: () => [],
  }),

  // === DATOS DE ANALYTICS ===
  analyticsData: Annotation<AdminAnalyticsReport | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // === ACCIONES PENDIENTES (para confirmación) ===
  pendingAction: Annotation<AdminPendingAction | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // === ACCIONES EJECUTADAS ===
  executedActions: Annotation<AdminExecutedAction[]>({
    reducer: (prev, next) => [...prev, ...next].slice(-50), // Append, keep last 50 to prevent memory leaks
    default: () => [],
  }),

  // === RESPUESTA GENERADA ===
  response: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // === KEYBOARD PARA TELEGRAM ===
  keyboard: Annotation<Array<Array<{ text: string; callback_data: string }>> | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // === METADATA Y TOKENS ===
  tokens: Annotation<{ input: number; output: number }>({
    reducer: (prev, next) => ({
      input: Math.max(0, prev.input + next.input),
      output: Math.max(0, prev.output + next.output),
    }),
    default: () => ({ input: 0, output: 0 }),
  }),

  // === CONTROL DE FLUJO ===
  currentNode: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'supervisor',
  }),

  // === ITERATION TRACKING (P0: Prevent infinite loops) ===
  iterationCount: Annotation<number>({
    reducer: (prev) => prev + 1, // Auto-increment on each state update
    default: () => 0,
  }),

  maxIterations: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 10, // Safety limit
  }),

  shouldEnd: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type AdminChannelStateType = typeof AdminChannelState.State;
