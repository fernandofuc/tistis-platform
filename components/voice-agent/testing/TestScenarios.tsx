/**
 * TIS TIS Platform - Voice Agent Testing v2.0
 * TestScenarios Component
 *
 * Predefined test scenarios for quick testing of
 * voice agent responses by vertical.
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  CheckIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { TestScenario } from '../wizard/types';
import { TEST_SCENARIOS } from '../wizard/types';

// =====================================================
// TYPES
// =====================================================

export interface TestScenarioResult {
  scenarioId: string;
  passed: boolean;
  response: string;
  latencyMs: number;
  detectedIntent?: string;
  timestamp: Date;
}

export interface TestScenariosProps {
  /** Business vertical */
  vertical: 'restaurant' | 'dental';
  /** Callback to run a scenario */
  onRunScenario: (scenario: TestScenario) => Promise<TestScenarioResult>;
  /** Callback when all scenarios complete */
  onComplete?: (results: TestScenarioResult[]) => void;
  /** Whether testing is in progress */
  isRunning?: boolean;
  /** Additional className */
  className?: string;
}

// =====================================================
// SCENARIO CARD
// =====================================================

interface ScenarioCardProps {
  scenario: TestScenario;
  result?: TestScenarioResult;
  isRunning: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRun: () => void;
}

function ScenarioCard({
  scenario,
  result,
  isRunning,
  isSelected,
  onSelect,
  onRun,
}: ScenarioCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative rounded-xl border-2 overflow-hidden cursor-pointer
        transition-all duration-200
        ${isSelected
          ? 'border-tis-coral bg-tis-coral-50 shadow-md'
          : result?.passed
          ? 'border-green-200 bg-green-50'
          : result && !result.passed
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
        }
      `}
      onClick={onSelect}
    >
      {/* Status badge */}
      {result && (
        <div
          className={`
            absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium
            ${result.passed
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
            }
          `}
        >
          {result.passed ? 'Pasó' : 'Falló'}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="text-2xl">{scenario.icon}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900">{scenario.name}</h4>
            <p className="text-sm text-slate-500 mt-0.5">{scenario.description}</p>

            {/* Sample message */}
            <div className="mt-2 p-2 bg-slate-100/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-0.5">Mensaje de prueba:</p>
              <p className="text-sm text-slate-600 italic">"{scenario.sampleMessage}"</p>
            </div>

            {/* Expected intent */}
            {scenario.expectedIntent && (
              <p className="text-xs text-slate-400 mt-2">
                Intención esperada:{' '}
                <span className="font-mono text-tis-purple">{scenario.expectedIntent}</span>
              </p>
            )}
          </div>
        </div>

        {/* Run button */}
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-slate-200/50"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              disabled={isRunning}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-2.5
                rounded-lg text-sm font-medium transition-colors
                ${isRunning
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-tis-coral text-white hover:bg-tis-coral-600'
                }
              `}
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  Ejecutar Prueba
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Result details */}
        {result && isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-slate-200/50 space-y-2"
          >
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Latencia</span>
              <span className="font-mono text-slate-700">{result.latencyMs}ms</span>
            </div>
            {result.detectedIntent && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Intención detectada</span>
                <span className="font-mono text-tis-purple">{result.detectedIntent}</span>
              </div>
            )}
            <div className="p-2 bg-white rounded-lg">
              <p className="text-xs text-slate-400 mb-0.5">Respuesta:</p>
              <p className="text-sm text-slate-600">{result.response}</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// =====================================================
// SUMMARY BAR
// =====================================================

interface SummaryBarProps {
  results: TestScenarioResult[];
  totalScenarios: number;
}

function SummaryBar({ results, totalScenarios }: SummaryBarProps) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const pending = totalScenarios - results.length;

  const avgLatency =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length)
      : 0;

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-slate-600">
            <strong className="text-slate-900">{passed}</strong> pasadas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-slate-600">
            <strong className="text-slate-900">{failed}</strong> fallidas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <span className="text-sm text-slate-600">
            <strong className="text-slate-900">{pending}</strong> pendientes
          </span>
        </div>
      </div>

      {results.length > 0 && (
        <div className="text-sm text-slate-500">
          Latencia promedio:{' '}
          <span className="font-mono font-medium text-slate-700">{avgLatency}ms</span>
        </div>
      )}
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function TestScenarios({
  vertical,
  onRunScenario,
  onComplete,
  isRunning = false,
  className = '',
}: TestScenariosProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, TestScenarioResult>>(new Map());
  const [currentlyRunning, setCurrentlyRunning] = useState<string | null>(null);

  const scenarios = TEST_SCENARIOS[vertical];

  // Run single scenario
  const handleRunScenario = useCallback(
    async (scenario: TestScenario) => {
      if (currentlyRunning) return;

      setCurrentlyRunning(scenario.id);

      try {
        const result = await onRunScenario(scenario);
        setResults((prev) => new Map(prev).set(scenario.id, result));

        // Check if all done
        const newResults = new Map(results).set(scenario.id, result);
        if (newResults.size === scenarios.length) {
          onComplete?.(Array.from(newResults.values()));
        }
      } catch {
        // Handle error
        const errorResult: TestScenarioResult = {
          scenarioId: scenario.id,
          passed: false,
          response: 'Error al ejecutar la prueba',
          latencyMs: 0,
          timestamp: new Date(),
        };
        setResults((prev) => new Map(prev).set(scenario.id, errorResult));
      }

      setCurrentlyRunning(null);
    },
    [currentlyRunning, onRunScenario, results, scenarios.length, onComplete]
  );

  // Run all scenarios
  const handleRunAll = useCallback(async () => {
    for (const scenario of scenarios) {
      if (!results.has(scenario.id)) {
        await handleRunScenario(scenario);
      }
    }
  }, [scenarios, results, handleRunScenario]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Escenarios de Prueba
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {vertical === 'restaurant'
              ? 'Escenarios para restaurantes'
              : 'Escenarios para consultorios dentales'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAll}
          disabled={isRunning || currentlyRunning !== null}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
            transition-colors
            ${isRunning || currentlyRunning
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-tis-purple text-white hover:bg-tis-purple-dark'
            }
          `}
        >
          <PlayIcon className="w-4 h-4" />
          Ejecutar Todos
        </button>
      </div>

      {/* Summary */}
      <SummaryBar results={Array.from(results.values())} totalScenarios={scenarios.length} />

      {/* Scenarios grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence>
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              result={results.get(scenario.id)}
              isRunning={currentlyRunning === scenario.id}
              isSelected={selectedId === scenario.id}
              onSelect={() => setSelectedId(selectedId === scenario.id ? null : scenario.id)}
              onRun={() => handleRunScenario(scenario)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Completion message */}
      {results.size === scenarios.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            p-4 rounded-xl border-2
            ${Array.from(results.values()).every((r) => r.passed)
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <CheckIcon
              className={`w-6 h-6 ${
                Array.from(results.values()).every((r) => r.passed)
                  ? 'text-green-600'
                  : 'text-amber-600'
              }`}
            />
            <div>
              <p
                className={`font-semibold ${
                  Array.from(results.values()).every((r) => r.passed)
                    ? 'text-green-800'
                    : 'text-amber-800'
                }`}
              >
                {Array.from(results.values()).every((r) => r.passed)
                  ? '¡Todas las pruebas pasaron!'
                  : 'Pruebas completadas con algunos fallos'}
              </p>
              <p
                className={`text-sm ${
                  Array.from(results.values()).every((r) => r.passed)
                    ? 'text-green-600'
                    : 'text-amber-600'
                }`}
              >
                {Array.from(results.values()).filter((r) => r.passed).length} de{' '}
                {scenarios.length} escenarios exitosos
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default TestScenarios;
