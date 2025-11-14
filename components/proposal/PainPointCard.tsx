import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface PainPointCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  description?: string;
}

export default function PainPointCard({
  icon: Icon,
  title,
  value,
  description
}: PainPointCardProps) {
  return (
    <Card className="p-6 text-center hover:shadow-lg transition-shadow">
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 bg-gradient-coral rounded-xl flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-tis-text-muted mb-2">
        {title}
      </h3>
      <p className="text-2xl font-bold text-tis-text-primary mb-1">
        {value}
      </p>
      {description && (
        <p className="text-xs text-tis-text-secondary">
          {description}
        </p>
      )}
    </Card>
  );
}
