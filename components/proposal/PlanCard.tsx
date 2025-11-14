import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Check } from 'lucide-react';

interface PlanCardProps {
  planName: string;
  price: number;
  features: string[];
  highlighted?: boolean;
}

export default function PlanCard({
  planName,
  price,
  features,
  highlighted = true
}: PlanCardProps) {
  return (
    <Card className={`p-8 ${highlighted ? 'ring-2 ring-tis-coral shadow-coral' : ''}`}>
      {highlighted && (
        <div className="bg-gradient-coral text-white text-sm font-semibold px-4 py-1 rounded-full inline-block mb-4">
          Recomendado para ti
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-3xl">
          Plan {planName}
        </CardTitle>
        <div className="mt-4">
          <span className="text-5xl font-extrabold text-tis-text-primary">
            ${price.toLocaleString('es-MX')}
          </span>
          <span className="text-xl text-tis-text-muted ml-2">
            /mes
          </span>
        </div>
      </CardHeader>

      <CardContent className="mt-6">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
              </div>
              <span className="text-sm text-tis-text-secondary">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
