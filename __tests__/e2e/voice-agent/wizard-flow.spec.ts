/**
 * TIS TIS Platform - Voice Agent v2.0
 * E2E Tests: Wizard Flow
 *
 * Tests the complete Voice Agent setup wizard flow.
 * These tests verify the user journey from start to finish.
 *
 * @jest-environment node
 */

// =====================================================
// WIZARD STEP TYPES
// =====================================================

type WizardStep = 'select-type' | 'select-voice' | 'customize' | 'test' | 'activate';

interface WizardState {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  data: {
    assistantType?: string;
    voiceId?: string;
    assistantName?: string;
    firstMessage?: string;
    personality?: string;
    testResult?: 'passed' | 'failed' | 'skipped';
    isActivated?: boolean;
  };
}

// =====================================================
// WIZARD FLOW SIMULATION
// =====================================================

class WizardFlowSimulator {
  private state: WizardState = {
    currentStep: 'select-type',
    completedSteps: [],
    data: {},
  };

  private readonly steps: WizardStep[] = [
    'select-type',
    'select-voice',
    'customize',
    'test',
    'activate',
  ];

  getCurrentStep(): WizardStep {
    return this.state.currentStep;
  }

  getCompletedSteps(): WizardStep[] {
    return [...this.state.completedSteps];
  }

  getData(): WizardState['data'] {
    return { ...this.state.data };
  }

  canProceed(): boolean {
    switch (this.state.currentStep) {
      case 'select-type':
        return !!this.state.data.assistantType;
      case 'select-voice':
        return !!this.state.data.voiceId;
      case 'customize':
        return !!this.state.data.assistantName && !!this.state.data.firstMessage;
      case 'test':
        return true; // Can skip testing
      case 'activate':
        return true;
      default:
        return false;
    }
  }

  selectAssistantType(typeId: string): void {
    if (this.state.currentStep !== 'select-type') {
      throw new Error('Not on select-type step');
    }
    this.state.data.assistantType = typeId;
  }

  selectVoice(voiceId: string): void {
    if (this.state.currentStep !== 'select-voice') {
      throw new Error('Not on select-voice step');
    }
    this.state.data.voiceId = voiceId;
  }

  setCustomization(name: string, firstMessage: string, personality: string): void {
    if (this.state.currentStep !== 'customize') {
      throw new Error('Not on customize step');
    }
    this.state.data.assistantName = name;
    this.state.data.firstMessage = firstMessage;
    this.state.data.personality = personality;
  }

  runTest(): 'passed' | 'failed' {
    if (this.state.currentStep !== 'test') {
      throw new Error('Not on test step');
    }
    // Simulate test execution
    const passed = Math.random() > 0.1; // 90% success rate
    this.state.data.testResult = passed ? 'passed' : 'failed';
    return this.state.data.testResult;
  }

  skipTest(): void {
    if (this.state.currentStep !== 'test') {
      throw new Error('Not on test step');
    }
    this.state.data.testResult = 'skipped';
  }

  activate(): void {
    if (this.state.currentStep !== 'activate') {
      throw new Error('Not on activate step');
    }
    this.state.data.isActivated = true;
  }

  nextStep(): boolean {
    if (!this.canProceed()) {
      return false;
    }

    const currentIndex = this.steps.indexOf(this.state.currentStep);
    if (currentIndex < this.steps.length - 1) {
      this.state.completedSteps.push(this.state.currentStep);
      this.state.currentStep = this.steps[currentIndex + 1];
      return true;
    }
    return false;
  }

  prevStep(): boolean {
    const currentIndex = this.steps.indexOf(this.state.currentStep);
    if (currentIndex > 0) {
      this.state.currentStep = this.steps[currentIndex - 1];
      // Remove from completed if going back
      const idx = this.state.completedSteps.indexOf(this.state.currentStep);
      if (idx !== -1) {
        this.state.completedSteps.splice(idx);
      }
      return true;
    }
    return false;
  }

  isComplete(): boolean {
    return this.state.completedSteps.length === this.steps.length - 1 &&
           this.state.data.isActivated === true;
  }
}

// =====================================================
// E2E TESTS: COMPLETE WIZARD FLOW
// =====================================================

describe('E2E: Wizard Complete Flow', () => {
  let wizard: WizardFlowSimulator;

  beforeEach(() => {
    wizard = new WizardFlowSimulator();
  });

  describe('Step 1: Select Assistant Type', () => {
    it('should start on select-type step', () => {
      expect(wizard.getCurrentStep()).toBe('select-type');
    });

    it('should not proceed without selecting type', () => {
      expect(wizard.canProceed()).toBe(false);
      expect(wizard.nextStep()).toBe(false);
    });

    it('should allow selecting restaurant assistant', () => {
      wizard.selectAssistantType('rest_basic');
      expect(wizard.getData().assistantType).toBe('rest_basic');
      expect(wizard.canProceed()).toBe(true);
    });

    it('should allow selecting dental assistant', () => {
      wizard.selectAssistantType('dental_standard');
      expect(wizard.getData().assistantType).toBe('dental_standard');
    });

    it('should proceed to voice selection', () => {
      wizard.selectAssistantType('rest_basic');
      expect(wizard.nextStep()).toBe(true);
      expect(wizard.getCurrentStep()).toBe('select-voice');
    });
  });

  describe('Step 2: Select Voice', () => {
    beforeEach(() => {
      wizard.selectAssistantType('rest_basic');
      wizard.nextStep();
    });

    it('should be on select-voice step', () => {
      expect(wizard.getCurrentStep()).toBe('select-voice');
    });

    it('should not proceed without selecting voice', () => {
      expect(wizard.canProceed()).toBe(false);
    });

    it('should allow selecting a voice', () => {
      wizard.selectVoice('coral');
      expect(wizard.getData().voiceId).toBe('coral');
      expect(wizard.canProceed()).toBe(true);
    });

    it('should allow going back', () => {
      expect(wizard.prevStep()).toBe(true);
      expect(wizard.getCurrentStep()).toBe('select-type');
    });

    it('should proceed to customize', () => {
      wizard.selectVoice('coral');
      wizard.nextStep();
      expect(wizard.getCurrentStep()).toBe('customize');
    });
  });

  describe('Step 3: Customize', () => {
    beforeEach(() => {
      wizard.selectAssistantType('rest_basic');
      wizard.nextStep();
      wizard.selectVoice('coral');
      wizard.nextStep();
    });

    it('should be on customize step', () => {
      expect(wizard.getCurrentStep()).toBe('customize');
    });

    it('should not proceed without name and message', () => {
      expect(wizard.canProceed()).toBe(false);
    });

    it('should allow setting customization', () => {
      wizard.setCustomization(
        'María',
        '¡Hola! Gracias por llamar a Restaurante El Sol. ¿En qué puedo ayudarle?',
        'friendly'
      );

      const data = wizard.getData();
      expect(data.assistantName).toBe('María');
      expect(data.firstMessage).toContain('Restaurante El Sol');
      expect(data.personality).toBe('friendly');
    });

    it('should proceed to test', () => {
      wizard.setCustomization('María', 'Hola', 'friendly');
      wizard.nextStep();
      expect(wizard.getCurrentStep()).toBe('test');
    });
  });

  describe('Step 4: Test', () => {
    beforeEach(() => {
      wizard.selectAssistantType('rest_basic');
      wizard.nextStep();
      wizard.selectVoice('coral');
      wizard.nextStep();
      wizard.setCustomization('María', 'Hola', 'friendly');
      wizard.nextStep();
    });

    it('should be on test step', () => {
      expect(wizard.getCurrentStep()).toBe('test');
    });

    it('should allow running test', () => {
      const result = wizard.runTest();
      expect(['passed', 'failed']).toContain(result);
    });

    it('should allow skipping test', () => {
      wizard.skipTest();
      expect(wizard.getData().testResult).toBe('skipped');
    });

    it('should proceed to activate even with skipped test', () => {
      wizard.skipTest();
      wizard.nextStep();
      expect(wizard.getCurrentStep()).toBe('activate');
    });
  });

  describe('Step 5: Activate', () => {
    beforeEach(() => {
      wizard.selectAssistantType('rest_basic');
      wizard.nextStep();
      wizard.selectVoice('coral');
      wizard.nextStep();
      wizard.setCustomization('María', 'Hola', 'friendly');
      wizard.nextStep();
      wizard.skipTest();
      wizard.nextStep();
    });

    it('should be on activate step', () => {
      expect(wizard.getCurrentStep()).toBe('activate');
    });

    it('should not be complete before activation', () => {
      expect(wizard.isComplete()).toBe(false);
    });

    it('should activate assistant', () => {
      wizard.activate();
      expect(wizard.getData().isActivated).toBe(true);
    });

    it('should be complete after activation', () => {
      wizard.activate();
      expect(wizard.isComplete()).toBe(true);
    });
  });

  describe('Complete Flow', () => {
    it('should complete entire wizard flow for restaurant', () => {
      // Step 1: Select Type
      wizard.selectAssistantType('rest_complete');
      expect(wizard.nextStep()).toBe(true);

      // Step 2: Select Voice
      wizard.selectVoice('alloy');
      expect(wizard.nextStep()).toBe(true);

      // Step 3: Customize
      wizard.setCustomization(
        'Sofia',
        '¡Bienvenido a La Trattoria! Soy Sofia, ¿en qué puedo ayudarle hoy?',
        'energetic'
      );
      expect(wizard.nextStep()).toBe(true);

      // Step 4: Test
      wizard.runTest();
      expect(wizard.nextStep()).toBe(true);

      // Step 5: Activate
      wizard.activate();

      // Verify completion
      expect(wizard.isComplete()).toBe(true);
      expect(wizard.getCompletedSteps().length).toBe(4);

      const data = wizard.getData();
      expect(data.assistantType).toBe('rest_complete');
      expect(data.voiceId).toBe('alloy');
      expect(data.assistantName).toBe('Sofia');
      expect(data.isActivated).toBe(true);
    });

    it('should complete entire wizard flow for dental', () => {
      // Step 1: Select Type
      wizard.selectAssistantType('dental_standard');
      wizard.nextStep();

      // Step 2: Select Voice
      wizard.selectVoice('shimmer');
      wizard.nextStep();

      // Step 3: Customize
      wizard.setCustomization(
        'Ana',
        'Buenos días, Clínica Dental Sonrisas. Soy Ana, su asistente virtual.',
        'calm'
      );
      wizard.nextStep();

      // Step 4: Skip Test
      wizard.skipTest();
      wizard.nextStep();

      // Step 5: Activate
      wizard.activate();

      expect(wizard.isComplete()).toBe(true);
    });
  });
});

// =====================================================
// E2E TESTS: NAVIGATION
// =====================================================

describe('E2E: Wizard Navigation', () => {
  let wizard: WizardFlowSimulator;

  beforeEach(() => {
    wizard = new WizardFlowSimulator();
  });

  it('should track completed steps correctly', () => {
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();

    expect(wizard.getCompletedSteps()).toContain('select-type');
    expect(wizard.getCompletedSteps()).not.toContain('select-voice');
  });

  it('should allow going back and forward', () => {
    // Go forward
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();
    wizard.selectVoice('coral');
    wizard.nextStep();

    expect(wizard.getCurrentStep()).toBe('customize');

    // Go back
    wizard.prevStep();
    expect(wizard.getCurrentStep()).toBe('select-voice');

    // Go forward again
    wizard.nextStep();
    expect(wizard.getCurrentStep()).toBe('customize');
  });

  it('should not go back from first step', () => {
    expect(wizard.prevStep()).toBe(false);
    expect(wizard.getCurrentStep()).toBe('select-type');
  });

  it('should not go forward from last step', () => {
    // Complete all steps
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();
    wizard.selectVoice('coral');
    wizard.nextStep();
    wizard.setCustomization('Test', 'Hola', 'friendly');
    wizard.nextStep();
    wizard.skipTest();
    wizard.nextStep();

    expect(wizard.getCurrentStep()).toBe('activate');
    expect(wizard.nextStep()).toBe(false);
  });
});

// =====================================================
// E2E TESTS: VALIDATION
// =====================================================

describe('E2E: Wizard Validation', () => {
  let wizard: WizardFlowSimulator;

  beforeEach(() => {
    wizard = new WizardFlowSimulator();
  });

  it('should validate assistant type is selected', () => {
    expect(() => wizard.nextStep()).not.toThrow();
    expect(wizard.getCurrentStep()).toBe('select-type'); // Didn't move
  });

  it('should validate voice is selected', () => {
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();

    expect(wizard.canProceed()).toBe(false);
    expect(wizard.nextStep()).toBe(false);
    expect(wizard.getCurrentStep()).toBe('select-voice'); // Didn't move
  });

  it('should validate customization is complete', () => {
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();
    wizard.selectVoice('coral');
    wizard.nextStep();

    expect(wizard.canProceed()).toBe(false);
  });

  it('should throw error when selecting voice on wrong step', () => {
    expect(() => wizard.selectVoice('coral')).toThrow('Not on select-voice step');
  });

  it('should throw error when customizing on wrong step', () => {
    expect(() => wizard.setCustomization('Test', 'Hola', 'friendly')).toThrow(
      'Not on customize step'
    );
  });
});

// =====================================================
// E2E TESTS: EDGE CASES
// =====================================================

describe('E2E: Wizard Edge Cases', () => {
  let wizard: WizardFlowSimulator;

  beforeEach(() => {
    wizard = new WizardFlowSimulator();
  });

  it('should handle changing selection before proceeding', () => {
    wizard.selectAssistantType('rest_basic');
    expect(wizard.getData().assistantType).toBe('rest_basic');

    wizard.selectAssistantType('rest_complete');
    expect(wizard.getData().assistantType).toBe('rest_complete');

    wizard.nextStep();
    expect(wizard.getData().assistantType).toBe('rest_complete');
  });

  it('should maintain data when navigating back and forth', () => {
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();
    wizard.selectVoice('coral');
    wizard.nextStep();
    wizard.setCustomization('María', 'Hola', 'friendly');

    // Go back to voice selection
    wizard.prevStep();
    wizard.prevStep();

    // Go forward again
    wizard.nextStep();
    wizard.nextStep();

    // Data should be preserved
    const data = wizard.getData();
    expect(data.assistantType).toBe('rest_basic');
    expect(data.voiceId).toBe('coral');
    expect(data.assistantName).toBe('María');
  });

  it('should handle failed test and retry', () => {
    wizard.selectAssistantType('rest_basic');
    wizard.nextStep();
    wizard.selectVoice('coral');
    wizard.nextStep();
    wizard.setCustomization('Test', 'Hola', 'friendly');
    wizard.nextStep();

    // First test might fail
    const firstResult = wizard.runTest();

    // Can run again
    const secondResult = wizard.runTest();

    expect(['passed', 'failed']).toContain(firstResult);
    expect(['passed', 'failed']).toContain(secondResult);
  });
});
