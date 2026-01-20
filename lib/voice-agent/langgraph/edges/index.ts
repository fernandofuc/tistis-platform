/**
 * TIS TIS Platform - Voice Agent v2.0
 * Edges Index
 *
 * Exports all edge functions and utilities.
 */

export {
  // Edge functions
  routerEdge,
  toolExecutorEdge,
  confirmationEdge,
  ragEdge,
  responseGeneratorEdge,

  // Edge map
  CONDITIONAL_EDGES,

  // Factory
  createConditionalEdge,

  // Utilities
  getPossibleNextNodes,
  isValidPath,
  getEdgeForNode,

  // Decision helpers
  shouldRouteToRAG,
  shouldRouteToToolExecutor,
  shouldRouteToConfirmation,
  isProcessingComplete,

  // Graph structure
  GRAPH_STRUCTURE,
  validateGraphStructure,

  // Types
  type NodeName,
  type EdgeRoutingResult,
} from './conditional-edges';
