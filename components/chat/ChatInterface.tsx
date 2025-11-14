'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <Image
          src="/logos/tis-brain-logo.png"
          alt="TIS TIS AI"
          width={40}
          height={40}
          className="w-10 h-10"
        />
        <div>
          <h3 className="font-semibold text-tis-text-primary">Asistente TIS TIS</h3>
          <p className="text-sm text-tis-text-muted flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            En línea · Responde en segundos
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Image
              src="/logos/tis-brain-logo.png"
              alt="TIS TIS"
              width={80}
              height={80}
              className="w-20 h-20 mb-4 opacity-50"
            />
            <p className="text-tis-text-muted">
              ¡Hola! Soy tu asistente de TIS TIS.<br />
              Conversemos sobre tu negocio.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <Image
                  src="/logos/tis-brain-logo.png"
                  alt="TIS TIS AI"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full"
                />
                <div className="bg-tis-bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-tis-coral" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder={isLoading ? "Esperando respuesta..." : "Escribe tu respuesta..."}
      />
    </div>
  );
}
