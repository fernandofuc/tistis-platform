import { Card } from '@/components/ui/Card';
import { TrendingUp, Clock, DollarSign } from 'lucide-react';

interface ROICalculatorProps {
  monthlySavings: number;
  hoursRecovered: number;
  paybackMonths: number;
}

export default function ROICalculator({
  monthlySavings,
  hoursRecovered,
  paybackMonths
}: ROICalculatorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="p-6 text-center bg-gradient-to-br from-green-50 to-white">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">
          Ahorro Mensual Estimado
        </p>
        <p className="text-3xl font-bold text-green-600">
          ${monthlySavings.toLocaleString('es-MX')} MXN
        </p>
      </Card>

      <Card className="p-6 text-center bg-gradient-to-br from-blue-50 to-white">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">
          Tiempo Recuperado
        </p>
        <p className="text-3xl font-bold text-blue-600">
          {hoursRecovered} hrs/sem
        </p>
      </Card>

      <Card className="p-6 text-center bg-gradient-to-br from-purple-50 to-white">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">
          Se paga solo en
        </p>
        <p className="text-3xl font-bold text-purple-600">
          {paybackMonths} {paybackMonths === 1 ? 'mes' : 'meses'}
        </p>
      </Card>
    </div>
  );
}
