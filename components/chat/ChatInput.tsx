'use client';

import { useState, FormEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Escribe tu respuesta..."
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex-1 px-4 py-3 rounded-xl border-2 border-gray-200",
            "focus:outline-none focus:border-tis-coral focus:ring-2 focus:ring-tis-coral/20",
            "transition-all",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className={cn(
            "p-3 bg-tis-coral text-white rounded-xl",
            "hover:opacity-90 transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
