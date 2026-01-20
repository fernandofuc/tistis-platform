# FASE 09: VoiceRAG - RAG Optimizado para Voz

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 09 |
| **Nombre** | VoiceRAG |
| **Sprint** | 2 - Integracion VAPI |
| **Duracion Estimada** | 1-2 dias |
| **Dependencias** | Fase 07 (LangGraph) |
| **Documento Referencia** | `03-INVESTIGACION-INDUSTRIA.md`, `04-ARQUITECTURA-PROPUESTA.md` |

---

## Objetivo

Implementar el sistema VoiceRAG optimizado para latencia y respuestas de voz, integrando con el vector store existente y formateando respuestas para lectura natural.

---

## Microfases

### MICROFASE 9.1: Crear Estructura
```
lib/voice-agent/rag/
├── index.ts
├── voice-rag.ts
├── query-optimizer.ts
├── response-formatter.ts
├── cache.ts
└── types.ts
```

### MICROFASE 9.2: Implementar Query Optimizer
- Reformular queries de voz para retrieval
- Expandir abreviaciones y sinonimos
- Detectar intent de la query

### MICROFASE 9.3: Implementar VoiceRAG Core
```typescript
class VoiceRAG {
  async query(input: string, context: RAGContext): Promise<RAGResult> {
    // 1. Optimizar query
    // 2. Buscar en vector store
    // 3. Filtrar por relevancia
    // 4. Formatear para voz
  }
}
```

### MICROFASE 9.4: Implementar Cache
- Cache de queries frecuentes
- TTL de 5 minutos
- Invalidacion por business

### MICROFASE 9.5: Implementar Response Formatter
- Resumir resultados largos
- Formatear para lectura natural
- Limitar a 2-3 oraciones

### MICROFASE 9.6: Integrar con LangGraph RAG Node
- Actualizar rag.ts para usar VoiceRAG
- Manejar casos sin resultados

### MICROFASE 9.7: Tests y Verificacion
- Tests de query optimization
- Tests de latencia (< 200ms target)
- Tests de formateo

---

## Criterios de Exito
- [ ] Latencia < 200ms
- [ ] Respuestas relevantes
- [ ] Cache funcional
- [ ] Formato para voz
- [ ] Tests pasan
