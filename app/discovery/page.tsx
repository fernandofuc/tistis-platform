'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Message, QuestionnaireAnswers } from '@/types';
import QuestionnaireForm from '@/components/questionnaire/QuestionnaireForm';
import Image from 'next/image';
import { Send } from 'lucide-react';

export default function DiscoveryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll solo dentro del contenedor de mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enviar mensaje con streaming progresivo
  const sendMessageToAI = useCallback(async (conversationHistory: Message[]) => {
    setIsLoading(true);

    try {
      console.log('📤 Enviando mensaje a IA...');

      const response = await fetch('/api/chat/discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Error en la respuesta del chat');
      }

      if (!response.body) {
        throw new Error('No se recibió stream del servidor');
      }

      // Crear mensaje vacío que se irá llenando
      const aiMessageId = Date.now().toString();
      const aiMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Leer stream progresivamente
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Actualizar el último mensaje con el texto acumulado
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessageIndex = newMessages.findIndex(m => m.id === aiMessageId);
          if (lastMessageIndex !== -1) {
            newMessages[lastMessageIndex] = {
              ...newMessages[lastMessageIndex],
              content: accumulatedText
            };
          }
          return newMessages;
        });
      }

      console.log('✅ Stream completado');

    } catch (error) {
      console.error('❌ Error sending message to AI:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error. Por favor intenta de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar mensaje inicial de la landing page
  useEffect(() => {
    const initialMessage = sessionStorage.getItem('initial_message');
    if (initialMessage) {
      const userMessage: Message = {
        id: '1',
        role: 'user',
        content: initialMessage,
        timestamp: new Date()
      };
      setMessages([userMessage]);
      sendMessageToAI([userMessage]);
      sessionStorage.removeItem('initial_message');
    } else {
      const welcomeMessage: Message = {
        id: '0',
        role: 'assistant',
        content: '¡Hola! Soy tu asistente de TIS TIS. Para ayudarte mejor, ¿cuál es tu mayor dolor de cabeza operativo en este momento?',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setCurrentInput('');

    await sendMessageToAI(updatedMessages);
  };

  const handleQuestionnaireComplete = (answers: QuestionnaireAnswers) => {
    sessionStorage.setItem('questionnaire_answers', JSON.stringify(answers));
    router.push('/proposal');
  };

  return (
    <div className="flex h-screen bg-tis-bg-primary">
      {/* LEFT PANEL: Chat */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/tis-brain-logo.png"
              alt="TIS TIS"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <div>
              <h2 className="text-lg font-semibold text-tis-text-primary">Asistente TIS TIS</h2>
              <p className="text-sm text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                En línea · Responde en segundos
              </p>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4"
          style={{ scrollBehavior: 'smooth' }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#DF7373] text-white'
                    : 'bg-gray-100 text-tis-text-primary'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && isLoading && msg.content === '' && (
                  <span className="inline-block w-2 h-4 bg-tis-text-secondary animate-pulse ml-1">|</span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-200 bg-white">
          <div className="flex items-end gap-3">
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Escribe tu respuesta..."
              className="flex-1 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DF7373] focus:border-transparent resize-none"
              rows={2}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!currentInput.trim() || isLoading}
              className="p-3 bg-[#DF7373] text-white rounded-lg hover:bg-[#C23350] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Presiona Enter para enviar, Shift+Enter para nueva línea
          </p>
        </form>
      </div>

      {/* RIGHT PANEL: Questionnaire */}
      <div className="w-1/2 bg-gray-50 overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-tis-text-primary mb-3">
              Cuéntanos más sobre tu negocio
            </h2>
            <p className="text-gray-600">
              Esta información nos ayuda a crear la propuesta perfecta para ti
            </p>
          </div>

          <QuestionnaireForm
            onComplete={handleQuestionnaireComplete}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
