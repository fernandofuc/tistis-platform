import { Check } from 'lucide-react';

interface TimelineStepProps {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}

function TimelineStep({ number, title, description, isLast = false }: TimelineStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold">
          {number}
        </div>
        {!isLast && (
          <div className="w-0.5 h-full bg-gradient-primary mt-2 flex-1 min-h-[40px]" />
        )}
      </div>
      <div className="pb-8">
        <h4 className="font-semibold text-tis-text-primary mb-1">
          {title}
        </h4>
        <p className="text-sm text-tis-text-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function Timeline() {
  return (
    <div className="max-w-2xl">
      <TimelineStep
        number={1}
        title="Pago"
        description="Asegura tu plan con pago seguro mediante Stripe"
      />
      <TimelineStep
        number={2}
        title="Dashboard Inmediato"
        description="Acceso instantáneo a tu micro-app personalizada"
      />
      <TimelineStep
        number={3}
        title="Configuración"
        description="Call de 30 min con el equipo TIS TIS para afinar detalles"
      />
      <TimelineStep
        number={4}
        title="Implementación"
        description="2-3 días para automatizaciones complejas personalizadas"
      />
      <TimelineStep
        number={5}
        title="Go Live"
        description="Tu cerebro digital funcionando en piloto automático"
        isLast
      />
    </div>
  );
}
