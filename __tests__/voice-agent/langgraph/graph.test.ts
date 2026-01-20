/**
 * TIS TIS Platform - Voice Agent v2.0
 * Graph Structure Tests
 *
 * Tests the graph structure validation without requiring actual LangGraph runtime.
 */

import { GRAPH_STRUCTURE, validateGraphStructure } from '@/lib/voice-agent/langgraph/edges';

describe('Graph Structure Validation', () => {
  describe('validateGraphStructure', () => {
    it('should validate current graph structure', () => {
      const result = validateGraphStructure();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('GRAPH_STRUCTURE', () => {
    it('should have correct entry point', () => {
      expect(GRAPH_STRUCTURE.entryPoint).toBe('router');
    });

    it('should have all required nodes', () => {
      const requiredNodes = [
        'router',
        'rag',
        'tool_executor',
        'confirmation',
        'response_generator',
      ];

      for (const node of requiredNodes) {
        expect(GRAPH_STRUCTURE.nodes).toContain(node);
      }
    });

    it('should have 5 main processing nodes', () => {
      expect(GRAPH_STRUCTURE.nodes).toHaveLength(5);
    });

    it('should have response_generator connecting to end', () => {
      expect(GRAPH_STRUCTURE.edges.response_generator).toContain('__end__');
    });

    it('should have conditional edges for router', () => {
      expect(GRAPH_STRUCTURE.conditionalEdges).toContain('router');
    });

    it('should have conditional edges for tool_executor', () => {
      expect(GRAPH_STRUCTURE.conditionalEdges).toContain('tool_executor');
    });

    it('should have conditional edges for confirmation', () => {
      expect(GRAPH_STRUCTURE.conditionalEdges).toContain('confirmation');
    });

    it('should have __start__ edge to router', () => {
      expect(GRAPH_STRUCTURE.edges.__start__).toContain('router');
    });

    it('should have router edges to all processing nodes', () => {
      const routerTargets = GRAPH_STRUCTURE.edges.router;
      expect(routerTargets).toContain('rag');
      expect(routerTargets).toContain('tool_executor');
      expect(routerTargets).toContain('confirmation');
      expect(routerTargets).toContain('response_generator');
    });

    it('should have rag edge to response_generator', () => {
      expect(GRAPH_STRUCTURE.edges.rag).toContain('response_generator');
    });

    it('should have tool_executor edges', () => {
      const toolEdges = GRAPH_STRUCTURE.edges.tool_executor;
      expect(toolEdges).toContain('response_generator');
    });

    it('should have confirmation edges', () => {
      const confirmEdges = GRAPH_STRUCTURE.edges.confirmation;
      expect(confirmEdges).toContain('tool_executor');
      expect(confirmEdges).toContain('response_generator');
    });

    it('should have router as first node after start', () => {
      const startEdges = GRAPH_STRUCTURE.edges.__start__;
      expect(startEdges[0]).toBe('router');
    });

    it('should have all nodes reachable from router', () => {
      const routerTargets = GRAPH_STRUCTURE.edges.router;
      const allNodes = new Set(GRAPH_STRUCTURE.nodes);

      // Every node except router should be reachable
      for (const node of allNodes) {
        if (node === 'router') continue;
        expect(routerTargets).toContain(node);
      }
    });
  });
});

describe('Graph Edge Configuration', () => {
  it('should define edges from __start__ to router', () => {
    expect(GRAPH_STRUCTURE.edges.__start__).toBeDefined();
  });

  it('should define edges from router', () => {
    expect(GRAPH_STRUCTURE.edges.router).toBeDefined();
    expect(GRAPH_STRUCTURE.edges.router.length).toBeGreaterThan(0);
  });

  it('should define edges from rag', () => {
    expect(GRAPH_STRUCTURE.edges.rag).toBeDefined();
  });

  it('should define edges from tool_executor', () => {
    expect(GRAPH_STRUCTURE.edges.tool_executor).toBeDefined();
  });

  it('should define edges from confirmation', () => {
    expect(GRAPH_STRUCTURE.edges.confirmation).toBeDefined();
  });

  it('should define edges from response_generator', () => {
    expect(GRAPH_STRUCTURE.edges.response_generator).toBeDefined();
    expect(GRAPH_STRUCTURE.edges.response_generator).toContain('__end__');
  });
});

describe('Conditional Edges', () => {
  it('should have 3 conditional edges', () => {
    expect(GRAPH_STRUCTURE.conditionalEdges).toHaveLength(3);
  });

  it('should include router in conditional edges', () => {
    expect(GRAPH_STRUCTURE.conditionalEdges).toContain('router');
  });

  it('should include tool_executor in conditional edges', () => {
    expect(GRAPH_STRUCTURE.conditionalEdges).toContain('tool_executor');
  });

  it('should include confirmation in conditional edges', () => {
    expect(GRAPH_STRUCTURE.conditionalEdges).toContain('confirmation');
  });
});
