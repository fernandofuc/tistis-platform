import { Message } from '@/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3 mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      {/* Avatar - Solo para asistente */}
      {!isUser && (
        <div className="flex-shrink-0">
          <Image
            src="/logos/tis-brain-logo.png"
            alt="TIS TIS AI"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
          />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-tis-coral text-white rounded-tr-sm"
            : "bg-tis-bg-secondary text-tis-text-primary rounded-tl-sm"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <p className={cn(
          "text-xs mt-1",
          isUser ? "text-white/70" : "text-tis-text-muted"
        )}>
          {new Date(message.timestamp).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}
