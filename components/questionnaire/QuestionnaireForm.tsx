'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { QuestionnaireAnswers } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import MultipleChoice from './MultipleChoice';
import { Card } from '@/components/ui/Card';

interface QuestionnaireFormProps {
  onComplete: (answers: QuestionnaireAnswers) => void;
  disabled?: boolean;
}

export default function QuestionnaireForm({
  onComplete,
  disabled = false
}: QuestionnaireFormProps) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    locations: '1', // Default a 1 sucursal
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormComplete()) {
      onComplete(answers);
    }
  };

  const isFormComplete = () => {
    return (
      answers.business_type &&
      answers.locations &&
      answers.employees_count &&
      answers.monthly_transactions &&
      answers.current_system &&
      answers.missed_calls &&
      answers.contact_info?.name &&
      answers.contact_info?.email &&
      answers.contact_info?.phone
    );
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-tis-bg-primary">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        {/* Pregunta 1: Tipo de Negocio */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            ¿Qué tipo de negocio tienes?
          </label>
          <MultipleChoice
            name="business_type"
            value={answers.business_type}
            onChange={(value) => setAnswers({ ...answers, business_type: value })}
            options={[
              { value: 'restaurante', label: '🍽️ Restaurante / Bar / Cafetería' },
              { value: 'retail', label: '🛍️ Retail / Supermercado / Tienda' },
              { value: 'clinica', label: '🏥 Clínica / Consultorio Médico' },
              { value: 'farmacia', label: '💊 Farmacia' },
              { value: 'industrial', label: '🏭 Industrial / Manufactura' },
              { value: 'servicios', label: '✂️ Servicios (Salón, Spa, etc.)' },
              { value: 'otro', label: '🏢 Otro' }
            ]}
          />
        </Card>

        {/* Pregunta 2: Ubicaciones - NÚMERO EXACTO */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            ¿Cuántas ubicaciones/sucursales tienes?
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                const current = parseInt(answers.locations || '1');
                if (current > 1) {
                  setAnswers({ ...answers, locations: String(current - 1) });
                }
              }}
              className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-tis-coral hover:text-tis-coral transition-colors"
            >
              -
            </button>
            <div className="flex-1 text-center">
              <span className="text-4xl font-bold text-tis-text-primary">
                {answers.locations || '1'}
              </span>
              <p className="text-sm text-tis-text-secondary mt-1">
                {parseInt(answers.locations || '1') === 1 ? 'sucursal' : 'sucursales'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const current = parseInt(answers.locations || '1');
                if (current < 20) {
                  setAnswers({ ...answers, locations: String(current + 1) });
                }
              }}
              className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-tis-coral hover:text-tis-coral transition-colors"
            >
              +
            </button>
          </div>
          {parseInt(answers.locations || '1') > 1 && (
            <p className="text-sm text-tis-coral mt-3 text-center">
              +${(1500 * (parseInt(answers.locations || '1') - 1)).toLocaleString('es-MX')} MXN/mes por sucursales extra
            </p>
          )}
        </Card>

        {/* Pregunta 3: Empleados */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            ¿Cuántos empleados tienes?
          </label>
          <MultipleChoice
            name="employees_count"
            value={answers.employees_count}
            onChange={(value) => setAnswers({ ...answers, employees_count: value })}
            options={[
              { value: '1-5', label: '1-5 empleados' },
              { value: '6-15', label: '6-15 empleados' },
              { value: '16-50', label: '16-50 empleados' },
              { value: '51+', label: 'Más de 50 empleados' }
            ]}
          />
        </Card>

        {/* Pregunta 4: Transacciones */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            ¿Cuántas transacciones/ventas realizas al mes aproximadamente?
          </label>
          <MultipleChoice
            name="monthly_transactions"
            value={answers.monthly_transactions}
            onChange={(value) => setAnswers({ ...answers, monthly_transactions: value })}
            options={[
              { value: '0-100', label: '0-100 transacciones' },
              { value: '101-500', label: '101-500 transacciones' },
              { value: '501-2000', label: '501-2,000 transacciones' },
              { value: '2001+', label: 'Más de 2,000 transacciones' }
            ]}
          />
        </Card>

        {/* Pregunta 5: Sistema Actual */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            ¿Tienes algún sistema de gestión actualmente?
          </label>
          <MultipleChoice
            name="current_system"
            value={answers.current_system}
            onChange={(value) => setAnswers({ ...answers, current_system: value })}
            options={[
              { value: 'ninguno', label: '❌ No, todo manual' },
              { value: 'excel', label: '📊 Excel / Hojas de cálculo' },
              { value: 'sistema-basico', label: '🖥️ Sistema básico (POS, etc.)' },
              { value: 'erp', label: '🏢 ERP / Sistema empresarial' }
            ]}
          />
        </Card>

        {/* Pregunta 6: Llamadas Perdidas */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            ¿Aproximadamente cuántas llamadas o mensajes pierdes al día?
          </label>
          <MultipleChoice
            name="missed_calls"
            value={answers.missed_calls}
            onChange={(value) => setAnswers({ ...answers, missed_calls: value })}
            options={[
              { value: '0-5', label: '0-5 por día' },
              { value: '6-15', label: '6-15 por día' },
              { value: '16-30', label: '16-30 por día' },
              { value: '31+', label: 'Más de 30 por día' }
            ]}
          />
        </Card>

        {/* Pregunta 7: Información de Contacto */}
        <Card className="p-6">
          <label className="block text-base font-semibold text-tis-text-primary mb-4">
            Para enviarte tu propuesta personalizada
          </label>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Nombre completo"
              value={answers.contact_info?.name || ''}
              onChange={(e) => setAnswers({
                ...answers,
                contact_info: {
                  ...answers.contact_info,
                  name: e.target.value,
                  email: answers.contact_info?.email || '',
                  phone: answers.contact_info?.phone || ''
                }
              })}
              required
            />
            <Input
              type="email"
              placeholder="Correo electrónico"
              value={answers.contact_info?.email || ''}
              onChange={(e) => setAnswers({
                ...answers,
                contact_info: {
                  ...answers.contact_info,
                  email: e.target.value,
                  name: answers.contact_info?.name || '',
                  phone: answers.contact_info?.phone || ''
                }
              })}
              required
            />
            <Input
              type="tel"
              placeholder="Teléfono (WhatsApp)"
              value={answers.contact_info?.phone || ''}
              onChange={(e) => setAnswers({
                ...answers,
                contact_info: {
                  ...answers.contact_info,
                  phone: e.target.value,
                  name: answers.contact_info?.name || '',
                  email: answers.contact_info?.email || ''
                }
              })}
              required
            />
          </div>
        </Card>

        {/* Botón de Envío */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isFormComplete() || disabled}
        >
          Ver Mi Propuesta Personalizada
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </form>
    </div>
  );
}
