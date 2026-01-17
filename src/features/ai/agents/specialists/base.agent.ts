// =====================================================
// TIS TIS PLATFORM - Base Agent Class
// Clase base para todos los agentes especialistas
// =====================================================
// REVISIÓN 5.0: Integración con SafetyResilienceService
// - P29: Incluir disclaimers de seguridad automáticamente
// - P23: Manejar configuración incompleta
// =====================================================

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  type TISTISAgentStateType,
  type AgentTrace,
  addAgentTrace,
} from '../../state';
import { DEFAULT_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';
import { SafetyResilienceService } from '../../services/safety-resilience.service';

// ======================
// TYPES
// ======================

export interface AgentConfig {
  name: string;
  description: string;
  systemPromptTemplate: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Agentes a los que puede hacer handoff */
  canHandoffTo?: string[];
  /** Si el agente puede generar respuesta final */
  canGenerateResponse?: boolean;
}

export interface AgentResult {
  response?: string;
  next_agent?: string;
  handoff_reason?: string;
  should_escalate?: boolean;
  escalation_reason?: string;
  tokens_used?: number;
  error?: string;
}

// ======================
// BASE AGENT CLASS
// ======================

/**
 * Clase base para todos los agentes especialistas
 *
 * Proporciona:
 * - Configuración común de OpenAI
 * - Construcción de prompts con contexto de negocio
 * - Logging y trazabilidad
 * - Manejo de errores consistente
 * - Mecanismo de handoff
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llm: ChatOpenAI;

  constructor(config: AgentConfig) {
    this.config = {
      model: DEFAULT_MODELS.MESSAGING,
      temperature: OPENAI_CONFIG.defaultTemperature,
      maxTokens: OPENAI_CONFIG.defaultMaxTokens,
      canGenerateResponse: true,
      canHandoffTo: [],
      ...config,
    };

    this.llm = new ChatOpenAI({
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }

  /**
   * Método principal que ejecuta el agente
   * Debe ser implementado por cada agente especializado
   */
  abstract execute(state: TISTISAgentStateType): Promise<AgentResult>;

  /**
   * Construye el system prompt con el contexto COMPLETO del negocio
   *
   * P13 FIX: PRIORIZA el prompt cacheado de Gemini si está disponible.
   * El prompt cacheado ya incluye toda la información del negocio optimizada.
   * Solo usa el template del agente como FALLBACK o para información específica.
   *
   * FLUJO:
   * 1. Si hay prompt cacheado en tenant.ai_config.system_prompt → usarlo como BASE
   * 2. Agregar instrucciones específicas del agente (rol, tarea específica)
   * 3. Agregar contexto dinámico (lead info, conversation context)
   */
  protected buildSystemPrompt(state: TISTISAgentStateType): string {
    const tenant = state.tenant;
    const business = state.business_context;

    // P13 FIX: Check if we have a cached prompt from Gemini
    const cachedPrompt = tenant?.ai_config?.system_prompt;
    const hasCachedPrompt = cachedPrompt && cachedPrompt.length > 500;

    let prompt: string;

    if (hasCachedPrompt) {
      // =====================================================
      // P13 FIX: USE CACHED GEMINI PROMPT AS BASE
      // This prompt already contains:
      // - Business info (services, branches, staff)
      // - FAQs, Knowledge Base, policies
      // - Custom instructions
      // - Personality and style settings
      // =====================================================
      prompt = cachedPrompt;

      // Add agent-specific role instructions (short, doesn't repeat business info)
      const agentRole = this.getAgentRoleInstructions(state);
      if (agentRole) {
        prompt += `\n\n# TU ROL ESPECÍFICO EN ESTA CONVERSACIÓN\n${agentRole}`;
      }

      console.log(`[${this.config.name}] Using cached Gemini prompt (${cachedPrompt.length} chars) + agent role`);
    } else {
      // =====================================================
      // FALLBACK: Use hardcoded template if no cached prompt
      // ARQUITECTURA V7: NO usar context stuffing
      // Los agentes DEBEN usar Tool Calling para obtener información
      // =====================================================
      console.warn(`[${this.config.name}] No cached prompt available, using template fallback with V7 architecture`);

      prompt = this.config.systemPromptTemplate;

      // Reemplazar placeholders con datos del estado
      if (tenant) {
        prompt = prompt.replace('{{TENANT_NAME}}', tenant.tenant_name || '');
        prompt = prompt.replace('{{VERTICAL}}', tenant.vertical || 'general');
        prompt = prompt.replace('{{RESPONSE_STYLE}}', tenant.ai_config?.response_style || 'professional');
        prompt = prompt.replace('{{MAX_LENGTH}}', String(tenant.ai_config?.max_response_length || 300));
      }

      // Agregar instrucciones de estilo
      const styleDescriptions: Record<string, string> = {
        professional: 'profesional y directo',
        professional_friendly: 'profesional pero cálido y amigable',
        casual: 'informal y cercano',
        formal: 'muy formal y respetuoso',
      };
      const style = tenant?.ai_config?.response_style || 'professional';
      prompt = prompt.replace('{{STYLE_DESCRIPTION}}', styleDescriptions[style] || 'profesional');

      // =====================================================
      // ARQUITECTURA V7: Instrucciones para usar Tools
      // NO se incluye business context - se obtiene via Tools/RAG
      // =====================================================
      const vertical = state.vertical || tenant?.vertical || 'dental';
      if (vertical === 'restaurant') {
        prompt += `\n\n# HERRAMIENTAS DISPONIBLES
Tienes acceso a herramientas para obtener información. USA LAS HERRAMIENTAS cuando necesites:
- Items del menú y precios (get_menu_items)
- Categorías del menú (get_menu_categories)
- Disponibilidad de platillos (check_item_availability)
- Crear pedidos (create_order)
- Promociones activas (get_active_promotions)
- Información de sucursales/ubicaciones (get_branch_info)
- Horarios de operación (get_operating_hours)
- Preguntas frecuentes (get_faq_answer)
- Políticas del negocio (get_business_policy)
- Buscar en base de conocimiento (search_knowledge_base)

NO inventes información de precios o disponibilidad. Si no la tienes, usa la herramienta correspondiente.`;
      } else {
        prompt += `\n\n# HERRAMIENTAS DISPONIBLES
Tienes acceso a herramientas para obtener información. USA LAS HERRAMIENTAS cuando necesites:
- Información de servicios o precios (get_service_info, list_services)
- Disponibilidad de horarios (get_available_slots)
- Información de sucursales (get_branch_info)
- Políticas del negocio (get_business_policy)
- Preguntas frecuentes (get_faq_answer)
- Información del equipo (get_staff_info)
- Crear citas (create_appointment)
- Buscar en base de conocimiento (search_knowledge_base)

NO inventes información. Si no la tienes, usa la herramienta correspondiente.`;
      }
    }

    // =====================================================
    // ALWAYS ADD: Dynamic context (lead info, conversation state)
    // This info changes per conversation, not in cached prompt
    // =====================================================
    if (state.lead) {
      prompt += `\n\n# INFORMACIÓN DEL CLIENTE ACTUAL\n`;
      prompt += `- Nombre: ${state.lead.name || 'No proporcionado'}\n`;
      prompt += `- Score: ${state.lead.score || 50} (${state.lead.classification || 'warm'})\n`;
      if (state.lead.preferred_branch_id) {
        const branch = business?.branches.find((b) => b.id === state.lead?.preferred_branch_id);
        if (branch) {
          prompt += `- Sucursal preferida: ${branch.name}\n`;
        }
      }
      if (state.lead.notes) {
        prompt += `- Notas: ${state.lead.notes}\n`;
      }
    }

    // Add conversation context if available
    if (state.conversation) {
      prompt += `\n# CONTEXTO DE CONVERSACIÓN\n`;
      prompt += `- Canal: ${state.conversation.channel}\n`;
      prompt += `- Mensajes previos: ${state.conversation.message_count}\n`;
    }

    return prompt;
  }

  /**
   * P13 FIX: Returns agent-specific role instructions
   * These are SHORT instructions about what this specific agent does,
   * NOT business info (which is already in the cached prompt)
   */
  protected getAgentRoleInstructions(state: TISTISAgentStateType): string {
    // Can be overridden by specific agents
    // Default: use the first paragraph of the template as role description
    const templateLines = this.config.systemPromptTemplate.split('\n');
    const roleLines: string[] = [];

    for (const line of templateLines) {
      // Stop at first heading or after 5 lines
      if (line.startsWith('#') && roleLines.length > 0) break;
      if (roleLines.length >= 5) break;
      if (line.trim()) {
        roleLines.push(line);
      }
    }

    return roleLines.join('\n').replace(/\{\{[^}]+\}\}/g, '').trim();
  }

  /**
   * Construye el historial de mensajes para el LLM
   *
   * NOTA: El mensaje actual (state.current_message) ya está incluido en
   * state.messages por el nodo initializeNode del grafo. NO lo duplicamos aquí.
   */
  protected buildMessageHistory(state: TISTISAgentStateType): (HumanMessage | AIMessage)[] {
    const messages: (HumanMessage | AIMessage)[] = [];

    // Agregar mensajes del estado de LangGraph (incluye historial previo + mensaje actual)
    for (const msg of state.messages) {
      if (msg._getType() === 'human') {
        messages.push(new HumanMessage(msg.content as string));
      } else if (msg._getType() === 'ai') {
        messages.push(new AIMessage(msg.content as string));
      }
    }

    return messages;
  }

  /**
   * Llama al LLM con el contexto construido
   *
   * REVISIÓN 5.0:
   * - P29: Incluye disclaimers de seguridad automáticamente si están presentes en safety_analysis
   * - P23: Maneja configuración incompleta con respuesta apropiada
   */
  protected async callLLM(
    state: TISTISAgentStateType,
    additionalContext?: string
  ): Promise<{ response: string; tokens: number }> {
    // P23 FIX: Check for incomplete configuration
    const safetyAnalysis = state.safety_analysis;
    if (safetyAnalysis?.config_missing_critical && safetyAnalysis.config_missing_critical.length > 0) {
      const fallbackResponse = SafetyResilienceService.generateIncompleteConfigResponse(
        safetyAnalysis.config_missing_critical,
        state.vertical
      );
      console.warn(`[${this.config.name}] Using incomplete config fallback response`);
      return { response: fallbackResponse, tokens: 50 };
    }

    let systemPrompt = this.buildSystemPrompt(state);

    if (additionalContext) {
      systemPrompt += `\n\n${additionalContext}`;
    }

    // P29 FIX: Add safety context if available
    if (safetyAnalysis?.safety_disclaimer) {
      systemPrompt += `\n\n# IMPORTANTE - AVISO DE SEGURIDAD\nDebes incluir el siguiente aviso en tu respuesta:\n"${safetyAnalysis.safety_disclaimer}"`;
    }

    // P25 FIX: Add emergency context if detected
    if (safetyAnalysis?.emergency_detected && safetyAnalysis.emergency_message) {
      systemPrompt += `\n\n# EMERGENCIA DETECTADA\nEl cliente está en una situación de emergencia (${safetyAnalysis.emergency_type}). Prioriza su seguridad y proporciona información de contacto directo si es necesario.`;
    }

    const messages = [
      new SystemMessage(systemPrompt),
      ...this.buildMessageHistory(state),
    ];

    try {
      const result = await this.llm.invoke(messages);

      let response = typeof result.content === 'string'
        ? result.content
        : 'Lo siento, no pude procesar tu mensaje.';

      // P29 FIX: Append safety disclaimer if not already included in response
      response = this.appendSafetyDisclaimer(response, state);

      // Estimar tokens (LangChain no siempre proporciona usage)
      const estimatedTokens = Math.ceil(
        (systemPrompt.length + state.current_message.length + response.length) / 4
      );

      return { response, tokens: estimatedTokens };
    } catch (error) {
      console.error(`[${this.config.name}] LLM error:`, error);
      throw error;
    }
  }

  /**
   * P29 FIX: Appends safety disclaimer to response if needed and not already present
   */
  protected appendSafetyDisclaimer(response: string, state: TISTISAgentStateType): string {
    const safetyAnalysis = state.safety_analysis;

    // No disclaimer needed
    if (!safetyAnalysis?.safety_disclaimer) {
      return response;
    }

    // Check if LLM already included a safety-related message
    const safetyIndicators = [
      'alergia', 'seguridad', 'contaminación', 'informar', 'mesero',
      'precaución', 'importante', 'recomendamos'
    ];

    const responseLower = response.toLowerCase();
    const hasDisclaimer = safetyIndicators.some(indicator => responseLower.includes(indicator));

    if (hasDisclaimer) {
      // LLM already included safety info
      return response;
    }

    // Append disclaimer
    return `${response}\n\n${safetyAnalysis.safety_disclaimer}`;
  }

  /**
   * Llama al LLM con herramientas (Tool Calling)
   *
   * ARQUITECTURA V7.0:
   * - El LLM puede invocar tools para obtener información on-demand
   * - CERO context stuffing - toda info se obtiene via tools
   * - Soporta múltiples iteraciones de tool calls
   * - RAG habilitado via search_knowledge_base
   *
   * @param state Estado actual del grafo
   * @param tools Array de DynamicStructuredTool de LangChain
   * @param additionalContext Contexto adicional para el system prompt
   * @param maxIterations Máximo de iteraciones de tool calling (default: 3)
   */
  protected async callLLMWithTools(
    state: TISTISAgentStateType,
    tools: import('@langchain/core/tools').DynamicStructuredTool[],
    additionalContext?: string,
    maxIterations: number = 3
  ): Promise<{ response: string; tokens: number; toolCalls: string[] }> {
    // P23 FIX: Check for incomplete configuration
    const safetyAnalysis = state.safety_analysis;
    if (safetyAnalysis?.config_missing_critical && safetyAnalysis.config_missing_critical.length > 0) {
      const fallbackResponse = SafetyResilienceService.generateIncompleteConfigResponse(
        safetyAnalysis.config_missing_critical,
        state.vertical
      );
      console.warn(`[${this.config.name}] Using incomplete config fallback response`);
      return { response: fallbackResponse, tokens: 50, toolCalls: [] };
    }

    let systemPrompt = this.buildSystemPromptForTools(state);

    if (additionalContext) {
      systemPrompt += `\n\n${additionalContext}`;
    }

    // P29 FIX: Add safety context if available
    if (safetyAnalysis?.safety_disclaimer) {
      systemPrompt += `\n\n# IMPORTANTE - AVISO DE SEGURIDAD\nDebes incluir el siguiente aviso en tu respuesta:\n"${safetyAnalysis.safety_disclaimer}"`;
    }

    // Bind tools to LLM
    const llmWithTools = this.llm.bindTools(tools);

    const messages: import('@langchain/core/messages').BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...this.buildMessageHistory(state),
    ];

    const toolCallsLog: string[] = [];
    let totalTokens = 0;
    let iterations = 0;

    // Import messages types once, outside the loop for efficiency
    const { AIMessage: AIMsg, ToolMessage: ToolMsg } = await import('@langchain/core/messages');

    // V7.1: Track timing for observability
    const startTime = Date.now();

    try {
      // Agentic loop: ejecutar hasta que el LLM responda sin tool calls
      while (iterations < maxIterations) {
        iterations++;

        const result = await llmWithTools.invoke(messages);

        // Estimar tokens de esta iteración
        const iterationTokens = Math.ceil(
          (typeof result.content === 'string' ? result.content.length : 0) / 4
        );
        totalTokens += iterationTokens;

        // Si no hay tool calls, tenemos la respuesta final
        if (!result.tool_calls || result.tool_calls.length === 0) {
          let response = typeof result.content === 'string'
            ? result.content
            : 'Lo siento, no pude procesar tu mensaje.';

          response = this.appendSafetyDisclaimer(response, state);

          const duration = Date.now() - startTime;
          console.log(`[${this.config.name}] Completed in ${duration}ms | iterations=${iterations} | tools=${toolCallsLog.length} (${toolCallsLog.join(', ') || 'none'}) | tokens≈${totalTokens}`);

          return { response, tokens: totalTokens, toolCalls: toolCallsLog };
        }

        // Procesar tool calls

        // Agregar respuesta del LLM con tool calls
        messages.push(new AIMsg({
          content: result.content || '',
          tool_calls: result.tool_calls,
        }));

        // Ejecutar cada tool y agregar resultado
        for (const toolCall of result.tool_calls) {
          const toolName = toolCall.name;
          const toolArgs = toolCall.args;

          console.log(`[${this.config.name}] Tool call: ${toolName}(${JSON.stringify(toolArgs)})`);
          toolCallsLog.push(toolName);

          // Encontrar y ejecutar la tool
          const tool = tools.find((t) => t.name === toolName);
          if (tool) {
            try {
              const toolResult = await tool.invoke(toolArgs);
              messages.push(new ToolMsg({
                content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                tool_call_id: toolCall.id || toolName,
              }));
            } catch (toolError) {
              console.error(`[${this.config.name}] Tool error (${toolName}):`, toolError);
              messages.push(new ToolMsg({
                content: JSON.stringify({ error: `Error ejecutando ${toolName}` }),
                tool_call_id: toolCall.id || toolName,
              }));
            }
          } else {
            console.warn(`[${this.config.name}] Tool not found: ${toolName}`);
            messages.push(new ToolMsg({
              content: JSON.stringify({ error: `Tool ${toolName} no encontrada` }),
              tool_call_id: toolCall.id || toolName,
            }));
          }
        }
      }

      // Si llegamos aquí, alcanzamos max iterations
      const duration = Date.now() - startTime;
      console.warn(`[${this.config.name}] Max iterations (${maxIterations}) reached in ${duration}ms | tools=${toolCallsLog.join(', ')}`);

      return {
        response: 'Estoy teniendo dificultades para procesar tu solicitud. ¿Podrías reformularla?',
        tokens: totalTokens,
        toolCalls: toolCallsLog,
      };
    } catch (error) {
      console.error(`[${this.config.name}] LLM with tools error:`, error);
      throw error;
    }
  }

  /**
   * Construye un system prompt optimizado para Tool Calling
   *
   * Este prompt NO incluye toda la información del negocio,
   * solo las instrucciones de comportamiento y las tools disponibles.
   */
  protected buildSystemPromptForTools(state: TISTISAgentStateType): string {
    const tenant = state.tenant;

    // Usar el prompt cacheado si existe, pero NO agregar business context completo
    const cachedPrompt = tenant?.ai_config?.system_prompt;
    const hasCachedPrompt = cachedPrompt && cachedPrompt.length > 500;

    let prompt: string;

    if (hasCachedPrompt) {
      // El prompt cacheado ya tiene las instrucciones de personalidad
      // Pero debemos indicar que use las tools para obtener información
      prompt = cachedPrompt;

      // Instrucciones de tools según vertical
      const vertical = state.vertical || tenant?.vertical || 'dental';
      if (vertical === 'restaurant') {
        prompt += `\n\n# HERRAMIENTAS DISPONIBLES
Tienes acceso a herramientas para obtener información. USA LAS HERRAMIENTAS cuando necesites:
- Items del menú y precios (get_menu_items)
- Categorías del menú (get_menu_categories)
- Disponibilidad de platillos (check_item_availability)
- Crear pedidos (create_order)
- Promociones activas (get_active_promotions)
- Información de sucursales/ubicaciones (get_branch_info)
- Horarios de operación (get_operating_hours)
- Preguntas frecuentes (get_faq_answer)
- Políticas del negocio (get_business_policy)

NO inventes información de precios o disponibilidad. Si no la tienes, usa la herramienta correspondiente.`;
      } else {
        prompt += `\n\n# HERRAMIENTAS DISPONIBLES
Tienes acceso a herramientas para obtener información. USA LAS HERRAMIENTAS cuando necesites:
- Información de servicios o precios (get_service_info, list_services)
- Disponibilidad de horarios (get_available_slots)
- Información de sucursales (get_branch_info)
- Políticas del negocio (get_business_policy)
- Preguntas frecuentes (get_faq_answer)
- Información del equipo (get_staff_info)
- Crear citas (create_appointment)

NO inventes información. Si no la tienes, usa la herramienta correspondiente.`;
      }
    } else {
      // Fallback: usar template básico
      prompt = this.config.systemPromptTemplate;

      if (tenant) {
        prompt = prompt.replace('{{TENANT_NAME}}', tenant.tenant_name || '');
        prompt = prompt.replace('{{VERTICAL}}', tenant.vertical || 'general');
        prompt = prompt.replace('{{RESPONSE_STYLE}}', tenant.ai_config?.response_style || 'professional');
        prompt = prompt.replace('{{MAX_LENGTH}}', String(tenant.ai_config?.max_response_length || 300));
      }

      prompt += `\n\n# HERRAMIENTAS
Usa las herramientas disponibles para obtener información cuando sea necesario.`;
    }

    // Agregar contexto del agente específico
    const agentRole = this.getAgentRoleInstructions(state);
    if (agentRole) {
      prompt += `\n\n# TU ROL\n${agentRole}`;
    }

    // Agregar contexto dinámico del lead
    if (state.lead) {
      prompt += `\n\n# CLIENTE ACTUAL\n`;
      prompt += `- Nombre: ${state.lead.name || 'No proporcionado'}\n`;
    }

    return prompt;
  }

  /**
   * Crea una traza del agente para debugging
   */
  protected createTrace(
    state: TISTISAgentStateType,
    result: AgentResult,
    durationMs: number
  ): AgentTrace {
    return addAgentTrace(state, {
      agent_name: this.config.name,
      input_summary: `Message: "${state.current_message.substring(0, 50)}..."`,
      output_summary: result.response
        ? `Response: "${result.response.substring(0, 50)}..."`
        : `Handoff to: ${result.next_agent}`,
      decision: result.handoff_reason || 'Generated response',
      duration_ms: durationMs,
    });
  }

  /**
   * Determina si debe hacer handoff a otro agente
   */
  protected shouldHandoff(state: TISTISAgentStateType): {
    handoff: boolean;
    to?: string;
    reason?: string;
  } {
    // Por defecto, no hacer handoff
    return { handoff: false };
  }

  /**
   * Convierte el agente a un nodo de LangGraph
   */
  toNode(): (state: TISTISAgentStateType) => Promise<Partial<TISTISAgentStateType>> {
    return async (state: TISTISAgentStateType): Promise<Partial<TISTISAgentStateType>> => {
      const startTime = Date.now();

      console.log(`[${this.config.name}] Processing...`);

      try {
        // Verificar handoff antes de procesar
        const handoffCheck = this.shouldHandoff(state);
        if (handoffCheck.handoff && handoffCheck.to) {
          const trace = this.createTrace(
            state,
            { next_agent: handoffCheck.to, handoff_reason: handoffCheck.reason },
            Date.now() - startTime
          );

          return {
            current_agent: this.config.name,
            next_agent: handoffCheck.to,
            routing_reason: handoffCheck.reason || '',
            agent_trace: [trace],
          };
        }

        // Ejecutar lógica del agente
        const result = await this.execute(state);
        const trace = this.createTrace(state, result, Date.now() - startTime);

        // Construir actualización de estado
        const stateUpdate: Partial<TISTISAgentStateType> = {
          current_agent: this.config.name,
          agent_trace: [trace],
          tokens_used: result.tokens_used || 0,
        };

        if (result.response) {
          stateUpdate.final_response = result.response;
          stateUpdate.control = {
            ...state.control,
            response_ready: true,
          };
        }

        if (result.next_agent) {
          stateUpdate.next_agent = result.next_agent;
          stateUpdate.routing_reason = result.handoff_reason || '';
        }

        if (result.should_escalate) {
          stateUpdate.control = {
            ...state.control,
            should_escalate: true,
            escalation_reason: result.escalation_reason,
          };
        }

        if (result.error) {
          stateUpdate.errors = [result.error];
        }

        console.log(`[${this.config.name}] Completed in ${Date.now() - startTime}ms`);

        return stateUpdate;
      } catch (error) {
        console.error(`[${this.config.name}] Error:`, error);

        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const trace = this.createTrace(
          state,
          { error: errorMsg },
          Date.now() - startTime
        );

        return {
          current_agent: this.config.name,
          next_agent: 'escalation',
          control: {
            ...state.control,
            should_escalate: true,
            escalation_reason: `Error en ${this.config.name}: ${errorMsg}`,
          },
          agent_trace: [trace],
          errors: [errorMsg],
        };
      }
    };
  }
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * @deprecated ARQUITECTURA V7: No usar context stuffing.
 * Los agentes deben usar Tool Calling con `list_services` o `get_service_info`.
 * Esta función se mantiene solo para compatibilidad temporal.
 */
export function formatServicesForPrompt(
  services: TISTISAgentStateType['business_context']
): string {
  if (!services?.services || services.services.length === 0) {
    return 'No hay servicios configurados.';
  }

  let text = '';
  for (const service of services.services) {
    let priceStr = '';
    if (service.price_note) {
      priceStr = service.price_note;
    } else if (service.price_min === service.price_max) {
      priceStr = `$${service.price_min.toLocaleString()}`;
    } else {
      priceStr = `$${service.price_min.toLocaleString()} - $${service.price_max.toLocaleString()}`;
    }

    text += `- ${service.name}: ${priceStr} (${service.duration_minutes} min)\n`;
    if (service.ai_description || service.description) {
      text += `  ${service.ai_description || service.description}\n`;
    }
    if (service.promotion_active && service.promotion_text) {
      text += `  [PROMOCIÓN] ${service.promotion_text}\n`;
    }
  }

  return text;
}

/**
 * @deprecated ARQUITECTURA V7: No usar context stuffing.
 * Los agentes deben usar Tool Calling con `get_branch_info`.
 * Esta función se mantiene solo para compatibilidad temporal.
 */
export function formatBranchesForPrompt(
  business: TISTISAgentStateType['business_context']
): string {
  if (!business?.branches || business.branches.length === 0) {
    return 'No hay sucursales configuradas.';
  }

  let text = '';
  for (const branch of business.branches) {
    const hqTag = branch.is_headquarters ? ' (Principal)' : '';
    text += `## ${branch.name}${hqTag}\n`;
    text += `- Dirección: ${branch.address}${branch.city ? `, ${branch.city}` : ''}\n`;
    text += `- Teléfono: ${branch.phone}\n`;
    if (branch.google_maps_url) {
      text += `- Mapa: ${branch.google_maps_url}\n`;
    }
    text += '\n';
  }

  return text;
}

/**
 * @deprecated ARQUITECTURA V7: No usar context stuffing.
 * Los agentes deben usar Tool Calling con `get_faq_answer`.
 * Esta función se mantiene solo para compatibilidad temporal.
 */
export function formatFAQsForPrompt(
  business: TISTISAgentStateType['business_context']
): string {
  if (!business?.faqs || business.faqs.length === 0) {
    return 'No hay FAQs configuradas.';
  }

  let text = '';
  for (const faq of business.faqs) {
    text += `P: ${faq.question}\n`;
    text += `R: ${faq.answer}\n\n`;
  }

  return text;
}

// ======================
// FULL CONTEXT BUILDER (DEPRECATED)
// ======================

/**
 * @deprecated ARQUITECTURA V7: NO USAR CONTEXT STUFFING.
 *
 * Esta función fue reemplazada por el sistema de Tool Calling + RAG.
 * Los agentes ahora obtienen información on-demand usando:
 * - list_services / get_service_info (servicios)
 * - get_branch_info (sucursales)
 * - get_faq_answer (FAQs)
 * - search_knowledge_base (base de conocimiento con RAG semántico)
 * - get_business_policy (políticas)
 *
 * BENEFICIOS DE V7 vs CONTEXT STUFFING:
 * - Reducción de ~70% en tokens por request
 * - Respuestas más rápidas (menor latencia)
 * - Información siempre actualizada desde DB
 * - RAG semántico para búsquedas inteligentes
 *
 * Esta función se mantiene solo para compatibilidad temporal.
 * TODO: Eliminar completamente en v8.0
 */
export function buildFullBusinessContext(
  state: TISTISAgentStateType
): string {
  const business = state.business_context;
  const tenant = state.tenant;

  if (!business) {
    return '';
  }

  let context = '';

  // =====================================================
  // 1. INSTRUCCIONES PERSONALIZADAS DEL CLIENTE
  // =====================================================
  const customInstructions = business.custom_instructions || [];
  if (customInstructions.length > 0) {
    context += '\n# INSTRUCCIONES PERSONALIZADAS DEL NEGOCIO\n';

    // Agrupar por tipo
    const instructionLabels: Record<string, string> = {
      identity: 'Identidad del Negocio',
      greeting: 'Saludos',
      farewell: 'Despedidas',
      pricing_policy: 'Política de Precios',
      special_cases: 'Casos Especiales',
      competitors: 'Manejo de Competencia',
      objections: 'Manejo de Objeciones',
      upsell: 'Oportunidades de Upsell',
      tone_examples: 'Ejemplos de Tono',
      forbidden: 'Lo que NUNCA debes decir',
      always_mention: 'Lo que SIEMPRE debes mencionar',
      custom: 'Instrucciones Adicionales',
    };

    const instructionsByType = customInstructions.reduce((acc, inst) => {
      const type = inst.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(inst);
      return acc;
    }, {} as Record<string, typeof customInstructions>);

    for (const [type, instructions] of Object.entries(instructionsByType)) {
      const label = instructionLabels[type] || type;
      context += `\n## ${label}\n`;
      for (const inst of instructions) {
        context += `### ${inst.title}\n`;
        context += `${inst.instruction}\n`;
        if (inst.examples) {
          context += `Ejemplos: ${inst.examples}\n`;
        }
        context += '\n';
      }
    }
  }

  // =====================================================
  // 2. POLÍTICAS DEL NEGOCIO
  // =====================================================
  const policies = business.business_policies || [];
  if (policies.length > 0) {
    context += '\n# POLÍTICAS DEL NEGOCIO\n';

    const policyLabels: Record<string, string> = {
      cancellation: 'Cancelación',
      rescheduling: 'Reagendamiento',
      payment: 'Métodos de Pago',
      insurance: 'Seguros',
      warranty: 'Garantías',
      pricing: 'Precios',
      late_arrival: 'Llegada Tarde',
      deposits: 'Depósitos',
      refunds: 'Reembolsos',
      emergency: 'Emergencias',
      custom: 'Otras Políticas',
    };

    for (const policy of policies) {
      const label = policyLabels[policy.type] || policy.type;
      context += `## ${label}: ${policy.title}\n`;
      context += `${policy.policy}\n`;
      if (policy.short_version) {
        context += `Versión corta: ${policy.short_version}\n`;
      }
      context += '\n';
    }
  }

  // =====================================================
  // 3. CATÁLOGO DE SERVICIOS Y PRECIOS
  // =====================================================
  if (business.services && business.services.length > 0) {
    context += '\n# CATÁLOGO DE SERVICIOS Y PRECIOS\n';

    // Agrupar por categoría
    const servicesByCategory = business.services.reduce((acc, service) => {
      const cat = service.category || 'general';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(service);
      return acc;
    }, {} as Record<string, typeof business.services>);

    for (const [category, services] of Object.entries(servicesByCategory)) {
      context += `\n## ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
      for (const service of services) {
        let priceStr = '';
        if (service.price_note) {
          priceStr = service.price_note;
        } else if (service.price_min === service.price_max) {
          priceStr = `$${service.price_min.toLocaleString()}`;
        } else {
          priceStr = `$${service.price_min.toLocaleString()} - $${service.price_max.toLocaleString()}`;
        }

        context += `### ${service.name}\n`;
        context += `- Precio: ${priceStr}\n`;
        context += `- Duración: ${service.duration_minutes} minutos\n`;
        if (service.ai_description || service.description) {
          context += `- ${service.ai_description || service.description}\n`;
        }
        if (service.special_instructions) {
          context += `- NOTA: ${service.special_instructions}\n`;
        }
        if (service.requires_consultation) {
          context += `- Requiere valoración previa\n`;
        }
        if (service.promotion_active && service.promotion_text) {
          context += `- [PROMOCIÓN ACTIVA] ${service.promotion_text}\n`;
        }
        context += '\n';
      }
    }
  }

  // =====================================================
  // 4. PREGUNTAS FRECUENTES (FAQs)
  // =====================================================
  if (business.faqs && business.faqs.length > 0) {
    context += '\n# PREGUNTAS FRECUENTES\n';
    for (const faq of business.faqs) {
      context += `P: ${faq.question}\n`;
      context += `R: ${faq.answer}\n\n`;
    }
  }

  // =====================================================
  // 5. BASE DE CONOCIMIENTO (Knowledge Articles)
  // =====================================================
  const articles = business.knowledge_articles || [];
  if (articles.length > 0) {
    context += '\n# INFORMACIÓN ADICIONAL DEL NEGOCIO\n';

    const categoryLabels: Record<string, string> = {
      about_us: 'Sobre Nosotros',
      differentiators: 'Lo Que Nos Diferencia',
      certifications: 'Certificaciones',
      technology: 'Tecnología',
      materials: 'Materiales y Productos',
      process: 'Procesos',
      aftercare: 'Cuidados Post-Servicio',
      preparation: 'Preparación Pre-Servicio',
      promotions: 'Promociones Actuales',
      events: 'Eventos',
      testimonials: 'Testimonios',
      awards: 'Premios',
      partnerships: 'Alianzas',
      custom: 'Información General',
    };

    const articlesByCategory = articles.reduce((acc, art) => {
      const cat = art.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(art);
      return acc;
    }, {} as Record<string, typeof articles>);

    for (const [category, arts] of Object.entries(articlesByCategory)) {
      const label = categoryLabels[category] || category;
      context += `\n## ${label}\n`;
      for (const article of arts) {
        context += `### ${article.title}\n`;
        context += `${article.content}\n\n`;
      }
    }
  }

  // =====================================================
  // 6. SUCURSALES Y UBICACIONES
  // =====================================================
  if (business.branches && business.branches.length > 0) {
    context += '\n# SUCURSALES Y UBICACIONES\n';
    for (const branch of business.branches) {
      const isHQ = branch.is_headquarters ? ' (Principal)' : '';
      context += `## ${branch.name}${isHQ}\n`;

      if (branch.address) {
        const fullAddress = branch.city ? `${branch.address}, ${branch.city}` : branch.address;
        context += `- Dirección: ${fullAddress}\n`;
      }

      if (branch.phone) {
        context += `- Teléfono: ${branch.phone}\n`;
      }
      if (branch.whatsapp_number && branch.whatsapp_number !== branch.phone) {
        context += `- WhatsApp: ${branch.whatsapp_number}\n`;
      }

      if (branch.google_maps_url) {
        context += `- Ubicación en mapa: ${branch.google_maps_url}\n`;
      }

      // Horarios
      if (branch.operating_hours && Object.keys(branch.operating_hours).length > 0) {
        context += `- Horarios:\n`;
        const dayNames: Record<string, string> = {
          monday: 'Lunes',
          tuesday: 'Martes',
          wednesday: 'Miércoles',
          thursday: 'Jueves',
          friday: 'Viernes',
          saturday: 'Sábado',
          sunday: 'Domingo',
        };
        for (const [day, hours] of Object.entries(branch.operating_hours)) {
          if (hours && typeof hours === 'object' && 'open' in hours) {
            const dayName = dayNames[day.toLowerCase()] || day;
            context += `  * ${dayName}: ${hours.open} - ${hours.close}\n`;
          }
        }
      }

      // Doctores en esta sucursal
      const branchStaff = (business.staff || []).filter(doc =>
        doc.branch_ids && doc.branch_ids.includes(branch.id)
      );
      if (branchStaff.length > 0) {
        context += `- Especialistas:\n`;
        for (const doc of branchStaff) {
          const specialty = doc.specialty ? ` - ${doc.specialty}` : '';
          context += `  * ${doc.role_title} ${doc.name}${specialty}\n`;
        }
      }

      context += '\n';
    }
  }

  // =====================================================
  // 7. EQUIPO MÉDICO/PERSONAL
  // =====================================================
  if (business.staff && business.staff.length > 0) {
    context += '\n# EQUIPO\n';
    for (const doc of business.staff) {
      context += `## ${doc.role_title} ${doc.name}\n`;

      if (doc.specialty) {
        context += `- Especialidad: ${doc.specialty}\n`;
      }

      if (doc.bio) {
        context += `- ${doc.bio}\n`;
      }

      if (doc.branch_ids && doc.branch_ids.length > 0) {
        const docBranches = (business.branches || [])
          .filter(b => doc.branch_ids.includes(b.id))
          .map(b => b.name);
        if (docBranches.length > 0) {
          context += `- Atiende en: ${docBranches.join(', ')}\n`;
        }
      }

      context += '\n';
    }
  }

  // =====================================================
  // 8. MANEJO DE COMPETENCIA
  // =====================================================
  const competitors = business.competitor_handling || [];
  if (competitors.length > 0) {
    context += '\n# MANEJO DE MENCIONES DE COMPETENCIA\n';
    context += 'Si el cliente menciona alguno de estos competidores, sigue la estrategia indicada:\n\n';

    for (const comp of competitors) {
      const aliases = comp.aliases && comp.aliases.length > 0
        ? ` (también conocido como: ${comp.aliases.join(', ')})`
        : '';
      context += `## ${comp.competitor}${aliases}\n`;
      context += `Estrategia: ${comp.strategy}\n`;

      if (comp.talking_points && comp.talking_points.length > 0) {
        context += `Puntos a destacar:\n`;
        for (const point of comp.talking_points) {
          context += `- ${point}\n`;
        }
      }

      if (comp.avoid_saying && comp.avoid_saying.length > 0) {
        context += `EVITAR decir:\n`;
        for (const avoid of comp.avoid_saying) {
          context += `- ${avoid}\n`;
        }
      }

      context += '\n';
    }
  }

  // =====================================================
  // 9. PLANTILLAS DE RESPUESTA (Como referencia)
  // =====================================================
  const templates = business.response_templates || [];
  if (templates.length > 0) {
    context += '\n# PLANTILLAS DE RESPUESTA SUGERIDAS\n';
    context += 'Usa estas plantillas como referencia para mantener consistencia:\n\n';

    const triggerLabels: Record<string, string> = {
      greeting: 'Saludo inicial',
      after_hours: 'Fuera de horario',
      appointment_confirm: 'Confirmación de cita',
      price_inquiry: 'Consulta de precios',
      location_inquiry: 'Consulta de ubicación',
      emergency: 'Emergencia',
      farewell: 'Despedida',
      thank_you: 'Agradecimiento',
    };

    for (const template of templates) {
      const label = triggerLabels[template.trigger] || template.name;
      context += `## ${label}\n`;
      context += `${template.template}\n\n`;
    }
  }

  // =====================================================
  // 10. INSTRUCCIONES FINALES DE FORMATO
  // =====================================================
  const styleDescriptions: Record<string, string> = {
    professional: 'profesional y directo',
    professional_friendly: 'profesional pero cálido y amigable',
    casual: 'informal y cercano',
    formal: 'muy formal y respetuoso',
  };

  const style = tenant?.ai_config?.response_style || 'professional';
  const styleDesc = styleDescriptions[style] || 'profesional y amable';
  const maxLength = tenant?.ai_config?.max_response_length || 300;

  context += '\n# INSTRUCCIONES DE RESPUESTA\n';
  context += `- Responde de manera ${styleDesc}\n`;
  context += `- Máximo ${maxLength} caracteres por respuesta\n`;
  context += `- NO uses emojis a menos que el cliente los use primero\n`;
  context += `- Si no sabes algo con certeza, ofrece conectar con un asesor humano\n`;
  context += `- Siempre busca agendar una cita o proporcionar información útil\n`;
  context += `- Para ubicaciones, da la dirección completa y el link de Google Maps\n`;
  context += `- Usa la información de las políticas cuando sea relevante\n`;
  context += `- Sigue las instrucciones personalizadas del negocio de forma natural\n`;

  return context;
}
