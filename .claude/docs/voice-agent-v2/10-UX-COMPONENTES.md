# 10. UX y Componentes del Voice Agent v2.0

## Tabla de Contenidos

1. [Vision General de UX](#1-vision-general-de-ux)
2. [Wizard de Configuracion](#2-wizard-de-configuracion)
3. [Selector de Voz](#3-selector-de-voz)
4. [Panel de Testing](#4-panel-de-testing)
5. [Dashboard de Metricas](#5-dashboard-de-metricas)
6. [Componentes Reutilizables](#6-componentes-reutilizables)

---

## 1. Vision General de UX

### 1.1 Principios de Diseno

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRINCIPIOS UX VOICE AGENT                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SIMPLICIDAD                                                 │
│     - Ocultar complejidad tecnica                               │
│     - Configuracion guiada paso a paso                          │
│     - Valores por defecto inteligentes                          │
│                                                                 │
│  2. FEEDBACK INMEDIATO                                          │
│     - Preview de voz en tiempo real                             │
│     - Simulador de llamadas                                     │
│     - Indicadores de estado claros                              │
│                                                                 │
│  3. CONFIANZA                                                   │
│     - Mostrar que esta pasando                                  │
│     - Logs accesibles                                           │
│     - Metricas transparentes                                    │
│                                                                 │
│  4. FLEXIBILIDAD CONTROLADA                                     │
│     - Tipos predefinidos (facil)                                │
│     - Personalizacion avanzada (opcional)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Flujo de Usuario

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Elegir  │───▶│  Config  │───▶│  Probar  │───▶│ Activar  │
│   Tipo   │    │   Voz    │    │  Llamada │    │  Numero  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  Selector       Selector        Simulador       Provision
  de Tipos      de Voces        de Prueba       Telefonico
```

---

## 2. Wizard de Configuracion

### 2.1 Estructura del Wizard

```typescript
// components/voice-agent/wizard/VoiceAgentWizard.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Steps
import { StepSelectType } from './steps/StepSelectType';
import { StepSelectVoice } from './steps/StepSelectVoice';
import { StepCustomize } from './steps/StepCustomize';
import { StepTest } from './steps/StepTest';
import { StepActivate } from './steps/StepActivate';

interface WizardProps {
  businessId: string;
  vertical: 'restaurant' | 'dental';
  existingConfig?: VoiceAssistantConfig;
}

const STEPS = [
  { id: 'type', title: 'Tipo de Asistente', component: StepSelectType },
  { id: 'voice', title: 'Voz', component: StepSelectVoice },
  { id: 'customize', title: 'Personalizar', component: StepCustomize },
  { id: 'test', title: 'Probar', component: StepTest },
  { id: 'activate', title: 'Activar', component: StepActivate },
];

export function VoiceAgentWizard({ businessId, vertical, existingConfig }: WizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<Partial<VoiceAssistantConfig>>(
    existingConfig || {
      business_id: businessId,
      vertical,
      is_active: false,
    }
  );

  const CurrentStepComponent = STEPS[currentStep].component;

  const handleNext = (stepData: Partial<VoiceAssistantConfig>) => {
    setConfig(prev => ({ ...prev, ...stepData }));
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    // Guardar configuracion final
    await saveVoiceConfig(config as VoiceAssistantConfig);
    router.push(`/dashboard/voice-agent?success=true`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${
                index <= currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  index < currentStep
                    ? 'bg-primary border-primary text-white'
                    : index === currentStep
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              <span className="ml-2 text-sm hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <CurrentStepComponent
            config={config}
            vertical={vertical}
            onNext={handleNext}
            onBack={handleBack}
            onComplete={handleComplete}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === STEPS.length - 1}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

### 2.2 Step 1: Selector de Tipo

```typescript
// components/voice-agent/wizard/steps/StepSelectType.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Phone, ShoppingBag, MessageSquare, Calendar, Stethoscope, Star } from 'lucide-react';

interface AssistantTypeOption {
  id: string;
  name: string;
  description: string;
  features: string[];
  recommended?: boolean;
  icon: React.ReactNode;
}

const RESTAURANT_TYPES: AssistantTypeOption[] = [
  {
    id: 'rest_basic',
    name: 'Reservaciones',
    description: 'Solo manejo de reservaciones',
    features: ['Crear reservaciones', 'Modificar/Cancelar', 'Horarios e informacion'],
    icon: <Calendar className="w-6 h-6" />,
  },
  {
    id: 'rest_standard',
    name: 'Reservaciones + Pedidos',
    description: 'Reservaciones y ordenes para llevar/domicilio',
    features: ['Todo de Basico', 'Tomar pedidos', 'Menu completo', 'Delivery'],
    recommended: true,
    icon: <ShoppingBag className="w-6 h-6" />,
  },
  {
    id: 'rest_complete',
    name: 'Completo',
    description: 'Todas las funcionalidades + FAQ',
    features: ['Todo de Estandar', 'Preguntas frecuentes', 'Transferencia a humano', 'Promociones'],
    icon: <MessageSquare className="w-6 h-6" />,
  },
];

const DENTAL_TYPES: AssistantTypeOption[] = [
  {
    id: 'dental_basic',
    name: 'Citas',
    description: 'Solo manejo de citas',
    features: ['Agendar citas', 'Modificar/Cancelar', 'Horarios e informacion'],
    icon: <Calendar className="w-6 h-6" />,
  },
  {
    id: 'dental_standard',
    name: 'Citas + Servicios',
    description: 'Citas con informacion de servicios',
    features: ['Todo de Basico', 'Info de servicios', 'FAQ dental', 'Doctores'],
    recommended: true,
    icon: <Stethoscope className="w-6 h-6" />,
  },
  {
    id: 'dental_complete',
    name: 'Completo',
    description: 'Todas las funcionalidades',
    features: ['Todo de Estandar', 'Transferencia', 'Urgencias', 'Seguros'],
    icon: <MessageSquare className="w-6 h-6" />,
  },
];

export function StepSelectType({ config, vertical, onNext, isFirstStep }: StepProps) {
  const [selected, setSelected] = useState<string>(config.assistant_type || '');

  const types = vertical === 'restaurant' ? RESTAURANT_TYPES : DENTAL_TYPES;

  const handleContinue = () => {
    if (selected) {
      onNext({ assistant_type: selected });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Elige el tipo de asistente</h2>
        <p className="text-muted-foreground mt-2">
          Selecciona las capacidades que necesitas para tu {vertical === 'restaurant' ? 'restaurante' : 'clinica'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {types.map((type) => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all hover:border-primary ${
              selected === type.id ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
            onClick={() => setSelected(type.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  {type.icon}
                </div>
                {type.recommended && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="w-3 h-3" /> Recomendado
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg mt-3">{type.name}</CardTitle>
              <CardDescription>{type.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {type.features.map((feature) => (
                  <li key={feature} className="flex items-center text-sm">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              {selected === type.id && (
                <div className="mt-4 p-2 bg-primary/10 rounded text-primary text-center text-sm font-medium">
                  Seleccionado
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pt-6">
        <Button onClick={handleContinue} disabled={!selected} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  );
}
```

---

## 3. Selector de Voz

### 3.1 Componente de Selector de Voz

```typescript
// components/voice-agent/wizard/steps/StepSelectVoice.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, User, Sparkles } from 'lucide-react';

interface VoiceOption {
  id: string;
  name: string;
  provider: string;
  gender: 'female' | 'male';
  accent: string;
  personality: string;
  previewUrl: string;
  recommended?: boolean;
}

const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: '11labs-maria',
    name: 'Maria',
    provider: 'ElevenLabs',
    gender: 'female',
    accent: 'Mexicano neutro',
    personality: 'Calida y profesional',
    previewUrl: '/audio/previews/maria.mp3',
    recommended: true,
  },
  {
    id: '11labs-sofia',
    name: 'Sofia',
    provider: 'ElevenLabs',
    gender: 'female',
    accent: 'Mexicano neutro',
    personality: 'Energetica y amigable',
    previewUrl: '/audio/previews/sofia.mp3',
  },
  {
    id: '11labs-carlos',
    name: 'Carlos',
    provider: 'ElevenLabs',
    gender: 'male',
    accent: 'Mexicano neutro',
    personality: 'Profesional y confiable',
    previewUrl: '/audio/previews/carlos.mp3',
  },
  {
    id: 'azure-ana',
    name: 'Ana',
    provider: 'Azure',
    gender: 'female',
    accent: 'Espanol neutro',
    personality: 'Calmada y clara',
    previewUrl: '/audio/previews/ana.mp3',
  },
];

export function StepSelectVoice({ config, onNext, onBack }: StepProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>(config.voice_id || '');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(config.voice_speed || 1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playPreview = async (voice: VoiceOption) => {
    if (playingVoice === voice.id) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(voice.previewUrl);
    audio.playbackRate = speed;
    audioRef.current = audio;

    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => setPlayingVoice(null);

    try {
      await audio.play();
      setPlayingVoice(voice.id);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handleContinue = () => {
    onNext({
      voice_id: selectedVoice,
      voice_speed: speed,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Elige la voz de tu asistente</h2>
        <p className="text-muted-foreground mt-2">
          Selecciona la voz que mejor represente a tu negocio
        </p>
      </div>

      {/* Voice Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {AVAILABLE_VOICES.map((voice) => (
          <Card
            key={voice.id}
            className={`cursor-pointer transition-all ${
              selectedVoice === voice.id ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
            onClick={() => setSelectedVoice(voice.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  voice.gender === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <User className="w-6 h-6" />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{voice.name}</h3>
                    {voice.recommended && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Recomendada
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{voice.personality}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {voice.accent} • {voice.provider}
                  </p>
                </div>

                {/* Play Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPreview(voice);
                  }}
                >
                  {playingVoice === voice.id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {selectedVoice === voice.id && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-primary font-medium">Voz seleccionada</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Speed Control */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Volume2 className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Velocidad de habla</span>
                <span className="text-sm text-muted-foreground">{speed.toFixed(1)}x</span>
              </div>
              <Slider
                value={[speed]}
                onValueChange={([value]) => setSpeed(value)}
                min={0.8}
                max={1.3}
                step={0.1}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">Lento</span>
                <span className="text-xs text-muted-foreground">Rapido</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          Atras
        </Button>
        <Button onClick={handleContinue} disabled={!selectedVoice}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
```

---

## 4. Panel de Testing

### 4.1 Simulador de Llamadas

```typescript
// components/voice-agent/testing/CallSimulator.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  latency?: number;
}

interface CallSimulatorProps {
  config: VoiceAssistantConfig;
  onTestComplete: (result: TestResult) => void;
}

export function CallSimulator({ config, onTestComplete }: CallSimulatorProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCall = async () => {
    setStatus('connecting');
    setMessages([]);
    setCallDuration(0);

    try {
      // Iniciar llamada de prueba via API
      const response = await fetch('/api/voice-agent/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) throw new Error('Failed to start test call');

      setStatus('active');
      setIsCallActive(true);

      // Iniciar timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Simular primer mensaje del asistente
      addMessage({
        role: 'assistant',
        content: `Hola, gracias por llamar a ${config.business_name}. En que puedo ayudarte?`,
        timestamp: new Date(),
        latency: 450,
      });

    } catch (error) {
      setStatus('idle');
      console.error('Error starting call:', error);
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setStatus('ended');

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Calcular resultados del test
    const result: TestResult = {
      duration: callDuration,
      messageCount: messages.length,
      averageLatency: calculateAverageLatency(messages),
      success: true,
    };

    onTestComplete(result);
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const calculateAverageLatency = (msgs: Message[]): number => {
    const latencies = msgs.filter(m => m.latency).map(m => m.latency!);
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Phone UI */}
      <Card className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <CardContent className="p-6">
          {/* Status Bar */}
          <div className="flex justify-between items-center mb-4">
            <Badge variant={status === 'active' ? 'default' : 'secondary'}>
              {status === 'idle' && 'Listo para llamar'}
              {status === 'connecting' && 'Conectando...'}
              {status === 'active' && 'Llamada activa'}
              {status === 'ended' && 'Llamada finalizada'}
            </Badge>
            {status === 'active' && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                {formatDuration(callDuration)}
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="bg-slate-800/50 rounded-lg p-4 h-64 overflow-y-auto mb-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                {status === 'idle' && 'Inicia una llamada de prueba'}
                {status === 'connecting' && 'Conectando...'}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-slate-700 text-white'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.latency && (
                        <p className="text-xs opacity-60 mt-1">{msg.latency}ms</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {!isCallActive ? (
              <Button
                size="lg"
                className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
                onClick={startCall}
                disabled={status === 'connecting'}
              >
                <Phone className="w-6 h-6" />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full w-12 h-12"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
                  onClick={endCall}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full w-12 h-12"
                >
                  <Volume2 className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Escenarios de prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {TEST_SCENARIOS.map((scenario) => (
              <Button
                key={scenario.id}
                variant="outline"
                className="justify-start"
                disabled={!isCallActive}
                onClick={() => simulateScenario(scenario)}
              >
                {scenario.icon}
                <span className="ml-2">{scenario.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const TEST_SCENARIOS = [
  { id: 'reservation', name: 'Hacer reservacion', icon: '📅' },
  { id: 'hours', name: 'Preguntar horarios', icon: '🕐' },
  { id: 'cancel', name: 'Cancelar reservacion', icon: '❌' },
  { id: 'menu', name: 'Preguntar por menu', icon: '📋' },
  { id: 'confused', name: 'Hablar confuso', icon: '😕' },
];
```

### 4.2 Checklist de Validacion

```typescript
// components/voice-agent/testing/ValidationChecklist.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface ValidationItem {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'passed' | 'failed' | 'warning';
  message?: string;
}

interface ValidationChecklistProps {
  config: VoiceAssistantConfig;
  onValidationComplete: (allPassed: boolean) => void;
}

export function ValidationChecklist({ config, onValidationComplete }: ValidationChecklistProps) {
  const [items, setItems] = useState<ValidationItem[]>([
    {
      id: 'prompt',
      name: 'Prompt valido',
      description: 'El prompt cumple con los requisitos',
      status: 'pending',
    },
    {
      id: 'voice',
      name: 'Voz configurada',
      description: 'La voz seleccionada esta disponible',
      status: 'pending',
    },
    {
      id: 'business',
      name: 'Datos del negocio',
      description: 'Informacion del negocio completa',
      status: 'pending',
    },
    {
      id: 'tools',
      name: 'Herramientas activas',
      description: 'Las herramientas necesarias estan configuradas',
      status: 'pending',
    },
    {
      id: 'latency',
      name: 'Latencia aceptable',
      description: 'Tiempo de respuesta dentro de limites',
      status: 'pending',
    },
  ]);

  const runValidation = async () => {
    for (const item of items) {
      // Marcar como checking
      setItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, status: 'checking' } : i))
      );

      // Ejecutar validacion
      const result = await validateItem(item.id, config);

      // Actualizar resultado
      setItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? { ...i, status: result.status, message: result.message }
            : i
        )
      );

      // Pequena pausa para UX
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const validateItem = async (
    itemId: string,
    config: VoiceAssistantConfig
  ): Promise<{ status: ValidationItem['status']; message?: string }> => {
    switch (itemId) {
      case 'prompt':
        if (!config.system_prompt || config.system_prompt.length < 100) {
          return { status: 'failed', message: 'Prompt demasiado corto' };
        }
        if (config.system_prompt.length > 8000) {
          return { status: 'warning', message: 'Prompt muy largo, puede afectar latencia' };
        }
        return { status: 'passed' };

      case 'voice':
        if (!config.voice_id) {
          return { status: 'failed', message: 'No hay voz seleccionada' };
        }
        return { status: 'passed' };

      case 'business':
        const missing: string[] = [];
        if (!config.business_name) missing.push('nombre');
        if (!config.business_phone) missing.push('telefono');
        if (missing.length > 0) {
          return { status: 'failed', message: `Falta: ${missing.join(', ')}` };
        }
        return { status: 'passed' };

      case 'tools':
        if (!config.enabled_tools || config.enabled_tools.length === 0) {
          return { status: 'warning', message: 'Sin herramientas activas' };
        }
        return { status: 'passed' };

      case 'latency':
        // Simular test de latencia
        const latency = await testLatency(config);
        if (latency > 1000) {
          return { status: 'failed', message: `${latency}ms - muy alto` };
        }
        if (latency > 700) {
          return { status: 'warning', message: `${latency}ms - limite` };
        }
        return { status: 'passed', message: `${latency}ms` };

      default:
        return { status: 'passed' };
    }
  };

  useEffect(() => {
    runValidation();
  }, [config]);

  useEffect(() => {
    const allChecked = items.every(i => i.status !== 'pending' && i.status !== 'checking');
    if (allChecked) {
      const allPassed = items.every(i => i.status === 'passed' || i.status === 'warning');
      onValidationComplete(allPassed);
    }
  }, [items, onValidationComplete]);

  const getStatusIcon = (status: ValidationItem['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validacion de configuracion</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(item.status)}
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {item.message && (
                <span className={`text-sm ${
                  item.status === 'failed' ? 'text-red-500' :
                  item.status === 'warning' ? 'text-yellow-500' :
                  'text-muted-foreground'
                }`}>
                  {item.message}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 5. Dashboard de Metricas

### 5.1 Vista General de Metricas

```typescript
// components/voice-agent/dashboard/MetricsDashboard.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Clock, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { AreaChart, BarChart } from '@/components/ui/charts';

interface MetricsDashboardProps {
  businessId: string;
  dateRange: { from: Date; to: Date };
}

export function MetricsDashboard({ businessId, dateRange }: MetricsDashboardProps) {
  // Fetch metrics data
  const { data: metrics, isLoading } = useVoiceMetrics(businessId, dateRange);

  if (isLoading) return <MetricsLoading />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Llamadas Totales"
          value={metrics.totalCalls}
          change={metrics.callsChange}
          icon={<Phone className="w-4 h-4" />}
        />
        <MetricCard
          title="Tasa de Exito"
          value={`${metrics.successRate}%`}
          change={metrics.successRateChange}
          icon={<CheckCircle className="w-4 h-4" />}
        />
        <MetricCard
          title="Latencia Promedio"
          value={`${metrics.avgLatency}ms`}
          change={metrics.latencyChange}
          icon={<Clock className="w-4 h-4" />}
          inverseChange
        />
        <MetricCard
          title="Duracion Promedio"
          value={formatDuration(metrics.avgDuration)}
          change={metrics.durationChange}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">Llamadas</TabsTrigger>
          <TabsTrigger value="latency">Latencia</TabsTrigger>
          <TabsTrigger value="outcomes">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Llamadas por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <AreaChart
                data={metrics.callsByDay}
                xKey="date"
                yKey="count"
                height={300}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="latency">
          <Card>
            <CardHeader>
              <CardTitle>Latencia (p50 / p95)</CardTitle>
            </CardHeader>
            <CardContent>
              <AreaChart
                data={metrics.latencyByDay}
                xKey="date"
                yKeys={['p50', 'p95']}
                height={300}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outcomes">
          <Card>
            <CardHeader>
              <CardTitle>Resultados de llamadas</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={metrics.outcomeDistribution}
                xKey="outcome"
                yKey="count"
                height={300}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Llamadas recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentCallsTable calls={metrics.recentCalls} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, change, icon, inverseChange = false }) {
  const isPositive = inverseChange ? change < 0 : change > 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            {icon}
          </div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold">{value}</p>
          <p className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {change > 0 ? '+' : ''}{change}% vs periodo anterior
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 6. Componentes Reutilizables

### 6.1 Status Badge

```typescript
// components/voice-agent/ui/StatusBadge.tsx

import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

type VoiceAgentStatus = 'active' | 'inactive' | 'error' | 'provisioning';

interface StatusBadgeProps {
  status: VoiceAgentStatus;
  showIcon?: boolean;
}

const STATUS_CONFIG = {
  active: {
    label: 'Activo',
    variant: 'default' as const,
    icon: CheckCircle,
    className: 'bg-green-500',
  },
  inactive: {
    label: 'Inactivo',
    variant: 'secondary' as const,
    icon: PhoneOff,
    className: '',
  },
  error: {
    label: 'Error',
    variant: 'destructive' as const,
    icon: AlertTriangle,
    className: '',
  },
  provisioning: {
    label: 'Configurando',
    variant: 'outline' as const,
    icon: Clock,
    className: '',
  },
};

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
```

### 6.2 Audio Player

```typescript
// components/voice-agent/ui/AudioPlayer.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  label?: string;
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const time = (value[0] / 100) * duration;
    audioRef.current.currentTime = time;
    setProgress(value[0]);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
      <audio ref={audioRef} src={src} />

      <Button variant="ghost" size="icon" onClick={togglePlay}>
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>

      <div className="flex-1">
        {label && <p className="text-sm mb-1">{label}</p>}
        <Slider
          value={[progress]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatTime((progress / 100) * duration)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={toggleMute}>
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </Button>
    </div>
  );
}
```

---

**Documento creado:** Enero 2024
**Ultima actualizacion:** Enero 2024
**Version:** 1.0.0
