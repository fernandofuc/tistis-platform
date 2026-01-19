/**
 * ToolAnomalyDetection - Detección de anomalías en tool calls
 * MEJORA-1.4: Implementación completa
 *
 * Detecta:
 * - Exceso de tool calls en una conversación
 * - Patrones sospechosos de herramientas
 * - Acceso a datos sensibles repetido
 * - Secuencias inusuales
 */

// ============================================
// TIPOS
// ============================================

export interface ToolCall {
  toolName: string;
  timestamp: Date;
  arguments: Record<string, unknown>;
  result?: unknown;
  duration?: number;
}

export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  anomalies: Anomaly[];
  riskScore: number; // 0-1
  recommendation: 'allow' | 'warn' | 'block' | 'review';
}

export interface Anomaly {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string;
  toolName?: string;
}

export type AnomalyType =
  | 'excessive_calls'
  | 'rapid_fire'
  | 'sensitive_data_access'
  | 'unusual_sequence'
  | 'repeated_failures'
  | 'data_exfiltration_pattern'
  | 'privilege_escalation';

export interface AnomalyConfig {
  maxCallsPerConversation: number;
  maxCallsPerMinute: number;
  maxSensitiveAccessPerConversation: number;
  suspiciousPatterns: SuspiciousPattern[];
  sensitiveTools: string[];
}

export interface SuspiciousPattern {
  name: string;
  sequence: string[];
  severity: 'medium' | 'high' | 'critical';
}

// ============================================
// CONFIGURACIÓN
// ============================================

const DEFAULT_CONFIG: AnomalyConfig = {
  maxCallsPerConversation: 50,
  maxCallsPerMinute: 15,
  maxSensitiveAccessPerConversation: 5,

  sensitiveTools: [
    'search_appointments',
    'get_customer_info',
    'search_knowledge_base',
    'get_business_context',
    'get_pricing',
    'get_services',
    'get_lead_info',
    'get_patient_info',
    'search_patients',
  ],

  suspiciousPatterns: [
    {
      name: 'data_harvesting',
      sequence: ['get_customer_info', 'get_customer_info', 'get_customer_info'],
      severity: 'high',
    },
    {
      name: 'knowledge_base_enumeration',
      sequence: ['search_knowledge_base', 'search_knowledge_base', 'search_knowledge_base', 'search_knowledge_base'],
      severity: 'medium',
    },
    {
      name: 'pricing_extraction',
      sequence: ['get_services', 'get_pricing', 'get_services', 'get_pricing'],
      severity: 'medium',
    },
    {
      name: 'appointment_scraping',
      sequence: ['search_appointments', 'search_appointments', 'search_appointments'],
      severity: 'high',
    },
    {
      name: 'patient_data_harvesting',
      sequence: ['search_patients', 'get_patient_info', 'search_patients', 'get_patient_info'],
      severity: 'critical',
    },
  ],
};

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class ToolAnomalyDetectionService {
  private config: AnomalyConfig;
  private conversationHistory: Map<string, ToolCall[]> = new Map();
  private readonly HISTORY_TTL_MS = 30 * 60 * 1000; // 30 minutos
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<AnomalyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Limpieza periódica de historial (solo en entorno de servidor)
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanupHistory(), 5 * 60 * 1000);
    }
  }

  /**
   * Registra y analiza un tool call
   */
  async analyzeToolCall(
    conversationId: string,
    toolCall: ToolCall
  ): Promise<AnomalyDetectionResult> {
    // Obtener historial de la conversación
    const history = this.getHistory(conversationId);

    // Agregar call actual al historial
    history.push(toolCall);
    this.conversationHistory.set(conversationId, history);

    // Analizar anomalías
    const anomalies: Anomaly[] = [];

    // 1. Verificar exceso de calls totales
    if (history.length > this.config.maxCallsPerConversation) {
      anomalies.push({
        type: 'excessive_calls',
        severity: 'high',
        description: `Exceso de tool calls: ${history.length}/${this.config.maxCallsPerConversation}`,
        evidence: `${history.length} calls en la conversación`,
      });
    }

    // 2. Verificar rapid fire (muchos calls en poco tiempo)
    const lastMinuteCalls = this.getCallsInLastMinute(history);
    if (lastMinuteCalls.length > this.config.maxCallsPerMinute) {
      anomalies.push({
        type: 'rapid_fire',
        severity: 'high',
        description: `Demasiados calls en 1 minuto: ${lastMinuteCalls.length}/${this.config.maxCallsPerMinute}`,
        evidence: lastMinuteCalls.map(c => c.toolName).join(', '),
      });
    }

    // 3. Verificar acceso a herramientas sensibles
    const sensitiveAccessCount = this.countSensitiveAccess(history);
    if (sensitiveAccessCount > this.config.maxSensitiveAccessPerConversation) {
      anomalies.push({
        type: 'sensitive_data_access',
        severity: 'medium',
        description: `Exceso de acceso a datos sensibles: ${sensitiveAccessCount}`,
        evidence: this.getSensitiveCalls(history).map(c => c.toolName).join(', '),
      });
    }

    // 4. Detectar patrones sospechosos
    const patternAnomalies = this.detectSuspiciousPatterns(history);
    anomalies.push(...patternAnomalies);

    // 5. Detectar fallos repetidos
    const failureAnomalies = this.detectRepeatedFailures(history);
    anomalies.push(...failureAnomalies);

    // 6. Detectar posible exfiltración
    const exfiltrationAnomalies = this.detectExfiltrationPattern(history, toolCall);
    anomalies.push(...exfiltrationAnomalies);

    // Calcular risk score
    const riskScore = this.calculateRiskScore(anomalies);

    // Determinar recomendación
    const recommendation = this.getRecommendation(riskScore, anomalies);

    // Log si hay anomalías
    if (anomalies.length > 0) {
      console.warn('[ToolAnomalyDetection] Anomalies detected:', {
        conversationId,
        toolName: toolCall.toolName,
        anomalyCount: anomalies.length,
        riskScore,
        recommendation,
        anomalies: anomalies.map(a => ({ type: a.type, severity: a.severity })),
      });
    }

    return {
      isAnomalous: anomalies.length > 0,
      anomalies,
      riskScore,
      recommendation,
    };
  }

  // ============================================
  // MÉTODOS DE DETECCIÓN
  // ============================================

  private getCallsInLastMinute(history: ToolCall[]): ToolCall[] {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    return history.filter(call => call.timestamp > oneMinuteAgo);
  }

  private countSensitiveAccess(history: ToolCall[]): number {
    return history.filter(call =>
      this.config.sensitiveTools.includes(call.toolName)
    ).length;
  }

  private getSensitiveCalls(history: ToolCall[]): ToolCall[] {
    return history.filter(call =>
      this.config.sensitiveTools.includes(call.toolName)
    );
  }

  private detectSuspiciousPatterns(history: ToolCall[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const toolSequence = history.map(h => h.toolName);

    for (const pattern of this.config.suspiciousPatterns) {
      if (this.containsSubsequence(toolSequence, pattern.sequence)) {
        anomalies.push({
          type: 'unusual_sequence',
          severity: pattern.severity,
          description: `Patrón sospechoso detectado: ${pattern.name}`,
          evidence: pattern.sequence.join(' → '),
        });
      }
    }

    return anomalies;
  }

  private containsSubsequence(sequence: string[], pattern: string[]): boolean {
    if (pattern.length > sequence.length) return false;

    const sequenceStr = sequence.join('|');
    const patternStr = pattern.join('|');

    return sequenceStr.includes(patternStr);
  }

  private detectRepeatedFailures(history: ToolCall[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Contar fallos por herramienta
    const failuresByTool = new Map<string, number>();

    for (const call of history) {
      if (call.result && typeof call.result === 'object' && 'error' in (call.result as Record<string, unknown>)) {
        const count = (failuresByTool.get(call.toolName) || 0) + 1;
        failuresByTool.set(call.toolName, count);
      }
    }

    for (const [toolName, failCount] of failuresByTool) {
      if (failCount >= 3) {
        anomalies.push({
          type: 'repeated_failures',
          severity: 'medium',
          description: `Múltiples fallos en herramienta: ${toolName}`,
          evidence: `${failCount} fallos consecutivos`,
          toolName,
        });
      }
    }

    return anomalies;
  }

  private detectExfiltrationPattern(history: ToolCall[], currentCall: ToolCall): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Patrón: acceso a datos seguido de intento de comunicación externa
    const dataAccessTools = [
      'get_customer_info',
      'search_appointments',
      'get_business_context',
      'get_lead_info',
      'get_patient_info',
      'search_patients',
    ];
    const lastFiveCalls = history.slice(-5);

    const hasDataAccess = lastFiveCalls.some(c => dataAccessTools.includes(c.toolName));

    // Si accedió a datos y ahora intenta algo sospechoso
    if (hasDataAccess) {
      // Verificar si los argumentos contienen patrones de exfiltración
      const argsStr = JSON.stringify(currentCall.arguments).toLowerCase();

      const exfiltrationPatterns = [
        'http://',
        'https://',
        'webhook',
        'callback',
        'external',
        'send_to',
        'export',
        'upload',
        'ftp://',
        'mailto:',
      ];

      for (const pattern of exfiltrationPatterns) {
        if (argsStr.includes(pattern)) {
          anomalies.push({
            type: 'data_exfiltration_pattern',
            severity: 'critical',
            description: 'Posible intento de exfiltración de datos',
            evidence: `Acceso a datos + patrón "${pattern}" en argumentos`,
            toolName: currentCall.toolName,
          });
          break;
        }
      }
    }

    return anomalies;
  }

  // ============================================
  // CÁLCULO DE RIESGO
  // ============================================

  private calculateRiskScore(anomalies: Anomaly[]): number {
    let score = 0;

    for (const anomaly of anomalies) {
      switch (anomaly.severity) {
        case 'critical':
          score += 0.4;
          break;
        case 'high':
          score += 0.25;
          break;
        case 'medium':
          score += 0.1;
          break;
        case 'low':
          score += 0.05;
          break;
      }
    }

    return Math.min(1, score);
  }

  private getRecommendation(
    riskScore: number,
    anomalies: Anomaly[]
  ): 'allow' | 'warn' | 'block' | 'review' {
    // Bloquear inmediatamente si hay anomalía crítica
    if (anomalies.some(a => a.severity === 'critical')) {
      return 'block';
    }

    // Basado en risk score
    if (riskScore >= 0.7) return 'block';
    if (riskScore >= 0.4) return 'review';
    if (riskScore >= 0.2) return 'warn';
    return 'allow';
  }

  // ============================================
  // GESTIÓN DE HISTORIAL
  // ============================================

  private getHistory(conversationId: string): ToolCall[] {
    return this.conversationHistory.get(conversationId) || [];
  }

  private cleanupHistory(): void {
    const now = Date.now();

    for (const [conversationId, history] of this.conversationHistory) {
      // Filtrar calls más viejos que TTL
      const recentHistory = history.filter(
        call => now - call.timestamp.getTime() < this.HISTORY_TTL_MS
      );

      if (recentHistory.length === 0) {
        this.conversationHistory.delete(conversationId);
      } else {
        this.conversationHistory.set(conversationId, recentHistory);
      }
    }
  }

  /**
   * Resetea historial de una conversación
   */
  resetConversation(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
  }

  /**
   * Obtiene estadísticas
   */
  getStats(): { activeConversations: number; totalCalls: number } {
    let totalCalls = 0;
    for (const history of this.conversationHistory.values()) {
      totalCalls += history.length;
    }

    return {
      activeConversations: this.conversationHistory.size,
      totalCalls,
    };
  }

  /**
   * Destructor - limpia el intervalo
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.conversationHistory.clear();
  }
}

// ============================================
// SINGLETON
// ============================================

let anomalyServiceInstance: ToolAnomalyDetectionService | null = null;

export function getToolAnomalyDetectionService(
  config?: Partial<AnomalyConfig>
): ToolAnomalyDetectionService {
  if (!anomalyServiceInstance) {
    anomalyServiceInstance = new ToolAnomalyDetectionService(config);
  }
  return anomalyServiceInstance;
}

// ============================================
// HELPER: Wrapper para tool handlers
// ============================================

/**
 * Wrapper que envuelve cualquier tool handler con detección de anomalías
 */
export async function executeToolWithAnomalyDetection<T>(
  conversationId: string,
  toolName: string,
  args: Record<string, unknown>,
  handler: () => Promise<T>
): Promise<T | { error: string; blocked: boolean; reason: string }> {
  const anomalyService = getToolAnomalyDetectionService();
  const startTime = Date.now();

  // Crear registro del tool call
  const toolCall: ToolCall = {
    toolName,
    timestamp: new Date(),
    arguments: args,
  };

  // Analizar antes de ejecutar
  const analysis = await anomalyService.analyzeToolCall(conversationId, toolCall);

  // Si se recomienda bloquear, no ejecutar
  if (analysis.recommendation === 'block') {
    console.error('[ToolHandler] Tool call blocked due to anomaly:', {
      conversationId,
      toolName,
      anomalies: analysis.anomalies,
      riskScore: analysis.riskScore,
    });

    return {
      error: 'La solicitud fue bloqueada por razones de seguridad.',
      blocked: true,
      reason: 'anomaly_detected',
    };
  }

  // Warn pero permitir
  if (analysis.recommendation === 'warn') {
    console.warn('[ToolHandler] Tool call warning:', {
      conversationId,
      toolName,
      anomalies: analysis.anomalies,
      riskScore: analysis.riskScore,
    });
  }

  // Ejecutar el handler
  try {
    const result = await handler();

    // Actualizar tool call con resultado
    toolCall.result = result;
    toolCall.duration = Date.now() - startTime;

    return result;
  } catch (error) {
    // Registrar fallo
    toolCall.result = { error: error instanceof Error ? error.message : 'Unknown error' };
    toolCall.duration = Date.now() - startTime;

    throw error;
  }
}

export default ToolAnomalyDetectionService;
