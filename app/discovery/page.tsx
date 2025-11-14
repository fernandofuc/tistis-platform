'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Message, QuestionnaireAnswers, AIAnalysis } from '@/types';
import ChatInterface from '@/components/chat/ChatInterface';
import QuestionnaireForm from '@/components/questionnaire/QuestionnaireForm';

export default function DiscoveryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>({});
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  // Definir sendMessageToAI con useCallback para evitar recrearla en cada render
  const sendMessageToAI = useCallback(async (conversationHistory: Message[]) => {
    setIsLoading(true);

    try {
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
        throw new Error('Error en la respuesta del chat');
      }

      const data = await response.json();

      // Agregar respuesta de la IA
      const aiMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Si hay análisis, guardarlo
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error sending message to AI:', error);
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
      // Agregar mensaje del usuario
      const userMessage: Message = {
        id: '1',
        role: 'user',
        content: initialMessage,
        timestamp: new Date()
      };
      setMessages([userMessage]);

      // Enviar a la IA
      sendMessageToAI([userMessage]);

      // Limpiar sessionStorage
      sessionStorage.removeItem('initial_message');
    } else {
      // Mensaje de bienvenida si no hay mensaje inicial
      const welcomeMessage: Message = {
        id: '0',
        role: 'assistant',
        content: '¡Hola! Soy tu asistente de TIS TIS. Para ayudarte mejor, ¿cuál es tu mayor dolor de cabeza operativo en este momento?',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [sendMessageToAI]);

  const handleSendMessage = async (content: string) => {
    // Agregar mensaje del usuario
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Enviar a la IA
    await sendMessageToAI(updatedMessages);
  };

  const handleAnswersChange = (answers: QuestionnaireAnswers) => {
    setQuestionnaireAnswers(answers);
  };

  const handleProposalGenerated = (proposal: AIAnalysis) => {
    setAiAnalysis(proposal);
    // Guardar propuesta en sessionStorage
    sessionStorage.setItem('proposal', JSON.stringify(proposal));
    // Redirigir a página de propuesta
    router.push('/proposal');
  };

  return (
    <div className="min-h-screen bg-tis-bg-primary py-12">
      {!aiAnalysis ? (
        <>
          <ChatInterface 
            messages={messages} 
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
          />
          <QuestionnaireForm
            onAnswersChange={handleAnswersChange}
            onProposalGenerated={handleProposalGenerated}
            answersCount={Object.keys(questionnaireAnswers).length}
          />
        </>
      ) : (
        <div className="text-center">
          <h1>Propuesta generada</h1>
          <p>Redirigiendo...</p>
        </div>
      )}
    </div>
  );
}
