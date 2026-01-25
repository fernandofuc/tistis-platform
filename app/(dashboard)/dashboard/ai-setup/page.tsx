'use client';

// =====================================================
// TIS TIS PLATFORM - AI Setup Assistant Page
// Redesigned: Claude Cowork-inspired layout with TIS TIS style
// Layout: Chat (left/center) + Progress Panel (right)
// Fixed: Proper height calculation within DashboardLayout
// =====================================================

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSetupAssistant } from '@/src/features/setup-assistant/hooks/useSetupAssistant';
import { ChatMessage } from '@/src/features/setup-assistant/components/ChatMessage';
import { ChatInput } from '@/src/features/setup-assistant/components/ChatInput';
import { TypingIndicator } from '@/src/features/setup-assistant/components/TypingIndicator';
import { QuickActionsGrid } from '@/src/features/setup-assistant/components/QuickActionsGrid';
import { ProgressPanel } from '@/src/features/setup-assistant/components/ProgressPanel';
import { UpgradePrompt } from '@/src/features/setup-assistant/components/UpgradePrompt';
import {
  shouldShowUpgradePrompt,
  getUpgradePlan,
  PLAN_DISPLAY_INFO,
  type PlanId,
} from '@/src/features/setup-assistant/config/limits';
import type { DetailedUsageInfo } from '@/src/features/setup-assistant/types';
import { Button } from '@/src/shared/components/ui/Button';
import { useTenant } from '@/src/hooks';
import { useRouter } from 'next/navigation';

// Icons (using lucide-react)
import {
  Sparkles,
  Plus,
  AlertTriangle,
  PanelRightClose,
  PanelRight,
  MessageSquare,
  Zap,
  X,
} from 'lucide-react';

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// Helper to generate upgrade reason message
function getUpgradeReason(percentages: Record<string, number>): string {
  const reasons: string[] = [];

  if (percentages.messages >= 80) {
    reasons.push('límite de mensajes');
  }
  if (percentages.files >= 80) {
    reasons.push('límite de archivos');
  }
  if (percentages.vision >= 80) {
    reasons.push('límite de análisis de imagen');
  }
  if (percentages.tokens >= 80) {
    reasons.push('límite de tokens');
  }

  if (reasons.length === 0) {
    return 'Más capacidad para tu negocio';
  }

  return `Estás cerca del ${reasons.join(' y ')}. Actualiza para continuar sin interrupciones.`;
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================

export default function AISetupPage() {
  const {
    messages,
    usage,
    isLoading,
    isSending,
    error,
    sendMessage,
    uploadFile,
    createConversation,
    clearError,
    inputRef,
  } = useSetupAssistant();

  const { tenant } = useTenant();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: 'image' | 'document';
  }>>([]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Check if at limit
  const isAtLimit = usage?.isAtLimit || false;

  // Calculate upgrade suggestion based on usage
  const upgradeSuggestion = useMemo(() => {
    if (!usage) return null;

    // Build DetailedUsageInfo from usage
    const detailedUsage: DetailedUsageInfo = {
      ...usage,
      tokensUsed: usage.totalTokens || 0,
      tokensLimit: usage.tokensLimit || 10000,
      percentages: {
        messages: usage.messagesLimit > 0 ? Math.round((usage.messagesCount / usage.messagesLimit) * 100) : 0,
        files: usage.filesLimit > 0 ? Math.round((usage.filesUploaded / usage.filesLimit) * 100) : 0,
        vision: usage.visionLimit > 0 ? Math.round((usage.visionRequests / usage.visionLimit) * 100) : 0,
        tokens: (usage.tokensLimit || 0) > 0 ? Math.round(((usage.totalTokens || 0) / (usage.tokensLimit || 1)) * 100) : 0,
      },
    };

    // Check if we should show upgrade prompt
    const shouldShow = shouldShowUpgradePrompt(
      {
        messages: usage.messagesCount,
        files: usage.filesUploaded,
        vision: usage.visionRequests,
        tokens: usage.totalTokens || 0,
      },
      {
        messagesPerDay: usage.messagesLimit,
        filesPerDay: usage.filesLimit,
        visionRequestsPerDay: usage.visionLimit,
        tokensPerDay: usage.tokensLimit || 10000,
        features: { visionAnalysis: true, bulkImport: false, customPrompts: false, advancedAnalytics: false, prioritySupport: false },
      },
      usage.planId
    );

    if (!shouldShow) return null;

    const suggestedPlan = getUpgradePlan(usage.planId);
    if (!suggestedPlan) return null;

    const planInfo = PLAN_DISPLAY_INFO[suggestedPlan as PlanId];

    return {
      detailedUsage,
      suggestedPlan,
      suggestedPlanName: planInfo.name,
      suggestedPlanPrice: planInfo.price,
      suggestedPlanHighlight: planInfo.highlight,
      reason: getUpgradeReason(detailedUsage.percentages),
    };
  }, [usage]);

  // Handle new conversation
  const handleNewConversation = useCallback(async () => {
    if (isLoading || isSending) return; // Prevent while loading
    setUploadedFiles([]);
    await createConversation();
  }, [isLoading, isSending, createConversation]);

  // Handle file upload with tracking
  const handleUploadFile = useCallback(async (file: File) => {
    const result = await uploadFile(file);
    if (result?.url) {
      setUploadedFiles((prev) => [
        ...prev,
        {
          url: result.url,
          filename: result.filename || file.name,
          mimeType: result.mimeType || file.type,
          size: result.size || file.size,
          type: file.type.startsWith('image/') ? 'image' : 'document',
        },
      ]);
    }
    return result;
  }, [uploadFile]);

  // Calculate progress based on messages and actions (memoized)
  const progress = useMemo(() => {
    const progressItems = [
      { id: 'services', label: 'Productos/Servicios', completed: false },
      { id: 'loyalty', label: 'Programa de lealtad', completed: false },
      { id: 'bot', label: 'Asistente configurado', completed: false },
      { id: 'faq', label: 'FAQs creadas', completed: false },
      { id: 'schedule', label: 'Horarios definidos', completed: false },
    ];

    const moduleMap: Record<string, string> = {
      services: 'services',
      loyalty: 'loyalty',
      agents: 'bot',
      knowledge_base: 'faq',
      branches: 'schedule',
      general: 'bot',
    };

    // Check actions from messages to determine completion
    messages.forEach((msg) => {
      if (msg.actionsTaken) {
        msg.actionsTaken.forEach((action) => {
          if (action.status === 'success') {
            const progressId = moduleMap[action.module];
            if (progressId) {
              const item = progressItems.find((p) => p.id === progressId);
              if (item) item.completed = true;
            }
          }
        });
      }
    });

    return progressItems;
  }, [messages]);

  const hasConversation = messages.length > 0;

  return (
    <>
      {/* Main Container - Uses calc to account for dashboard header (64px) + main padding (48px) + mobile nav space */}
      <div className="h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {/* Top Header Bar */}
        <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 bg-slate-50/80 border-b border-slate-200 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center shadow-lg shadow-tis-coral/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 text-sm">
                AI Setup Assistant
              </h1>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-slate-500">
                  Gemini 3.0 Flash
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              className="gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva</span>
            </Button>
            {/* Desktop panel toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidePanel(!showSidePanel)}
              className="hidden lg:flex text-slate-500 hover:text-slate-700"
            >
              {showSidePanel ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRight className="w-4 h-4" />
              )}
            </Button>
            {/* Mobile panel toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobilePanel(true)}
              className="lg:hidden text-slate-500 hover:text-slate-700"
            >
              <PanelRight className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area (Left/Center) */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            {/* Messages or Welcome */}
            <div className="flex-1 overflow-y-auto">
              {!hasConversation && !isLoading ? (
                <WelcomeScreen
                  onActionClick={sendMessage}
                  vertical={tenant?.vertical}
                />
              ) : (
                <div className="py-4 px-4 max-w-4xl mx-auto">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                    />
                  ))}
                  <AnimatePresence>
                    {isSending && <TypingIndicator />}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-3 bg-red-50 border-t border-red-100"
                >
                  <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                    <button
                      onClick={clearError}
                      aria-label="Cerrar mensaje de error"
                      className="text-xs text-red-500 hover:text-red-600 underline"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Limit Warning */}
            <AnimatePresence>
              {isAtLimit && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-3 bg-amber-50 border-t border-amber-100"
                >
                  <div className="max-w-4xl mx-auto flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">
                      Has alcanzado el límite diario. Vuelve mañana o actualiza tu plan.
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upgrade Prompt - Shows when usage is at 80%+ */}
            <AnimatePresence>
              {showUpgradePrompt && upgradeSuggestion && !isAtLimit && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pt-4"
                >
                  <div className="max-w-4xl mx-auto">
                    <UpgradePrompt
                      usage={upgradeSuggestion.detailedUsage}
                      suggestedPlanName={upgradeSuggestion.suggestedPlanName}
                      suggestedPlanPrice={upgradeSuggestion.suggestedPlanPrice}
                      suggestedPlanHighlight={upgradeSuggestion.suggestedPlanHighlight}
                      reason={upgradeSuggestion.reason}
                      onUpgrade={() => router.push('/dashboard/settings/subscription')}
                      onDismiss={() => setShowUpgradePrompt(false)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Input */}
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="max-w-4xl mx-auto">
                <ChatInput
                  onSend={sendMessage}
                  onUpload={handleUploadFile}
                  disabled={isAtLimit}
                  isLoading={isSending}
                  inputRef={inputRef}
                  placeholder="¿Qué te gustaría configurar hoy?"
                />
              </div>
            </div>
          </div>

          {/* Right Side Panel (Desktop) */}
          <AnimatePresence>
            {showSidePanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: appleEasing }}
                className="flex-shrink-0 overflow-hidden hidden lg:block"
              >
                <ProgressPanel
                  progress={progress}
                  files={uploadedFiles}
                  businessName={tenant?.name}
                  vertical={tenant?.vertical}
                  usage={usage}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Side Panel (Drawer) */}
      <AnimatePresence>
        {showMobilePanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobilePanel(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: appleEasing }}
              className="fixed right-0 top-0 h-full w-80 z-50 lg:hidden"
            >
              <div className="h-full flex flex-col bg-white">
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-900">
                    Panel de Progreso
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobilePanel(false)}
                    aria-label="Cerrar panel"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {/* Panel Content */}
                <div className="flex-1 overflow-hidden">
                  <ProgressPanel
                    progress={progress}
                    files={uploadedFiles}
                    businessName={tenant?.name}
                    vertical={tenant?.vertical}
                    usage={usage}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// WELCOME SCREEN COMPONENT
// =====================================================

interface WelcomeScreenProps {
  onActionClick: (prompt: string) => void;
  vertical?: string;
}

function WelcomeScreen({ onActionClick, vertical }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: appleEasing }}
        className="text-center mb-10 max-w-lg"
      >
        {/* Animated gradient icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: appleEasing }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center shadow-2xl shadow-tis-coral/30"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Configura tu negocio
        </h1>
        <p className="text-slate-500 text-lg">
          Dime qué necesitas o elige una acción rápida
        </p>
      </motion.div>

      {/* Quick Actions Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: appleEasing }}
        className="w-full max-w-3xl px-4"
      >
        <QuickActionsGrid onActionClick={onActionClick} vertical={vertical} />
      </motion.div>

      {/* Helper text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: appleEasing }}
        className="mt-8 text-sm text-slate-400 flex items-center gap-2"
      >
        <MessageSquare className="w-4 h-4" />
        También puedes escribir directamente lo que necesitas
      </motion.p>
    </div>
  );
}
