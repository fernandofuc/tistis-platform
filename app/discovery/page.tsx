'use client';

import { useState, useEffect } from 'react';
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
  }, []);

  const sendMessageToAI = async (conversationHistory: Message[]) => {
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
        content: data.message.replace('ANALYSIS_COMPLETE::', '').split('{')[0].trim() || data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Si la IA completó el análisis
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        // Esperar 2 segundos y redirigir a proposal
        setTimeout(() => {
          // Guardar datos en sessionStorage para la página de proposal
          sessionStorage.setItem('ai_analysis', JSON.stringify(data.analysis));
          sessionStorage.setItem('questionnaire_answers', JSON.stringify(questionnaireAnswers));
          router.push('/proposal');
        }, 2000);
      }

    } catch (error) {
      console.error('Error sending message:', error);
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
  };

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    sendMessageToAI(updatedMessages);
  };

  const handleQuestionnaireComplete = (answers: QuestionnaireAnswers) => {
    setQuestionnaireAnswers(answers);

    // Si ya tenemos análisis de IA, ir a proposal
    if (aiAnalysis) {
      sessionStorage.setItem('ai_analysis', JSON.stringify(aiAnalysis));
      sessionStorage.setItem('questionnaire_answers', JSON.stringify(answers));
      router.push('/proposal');
    } else {
      // Informar al usuario que espere el análisis
      const infoMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Perfecto, tengo toda la información. Déjame generar tu propuesta personalizada...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, infoMessage]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Columna Izquierda: Chat */}
      <div className="w-full md:w-1/2 h-screen border-r border-gray-200">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>

      {/* Columna Derecha: Cuestionario */}
      <div className="w-full md:w-1/2 h-screen overflow-hidden">
        <QuestionnaireForm
          onComplete={handleQuestionnaireComplete}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
