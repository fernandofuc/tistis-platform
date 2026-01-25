# FASE 8: Testing & Quality Assurance

## Objetivo
Implementar tests completos para garantizar la calidad y estabilidad del AI Setup Assistant, incluyendo tests unitarios, de integracion, y end-to-end.

---

## Estrategia de Testing

| Tipo | Cobertura | Framework |
|------|-----------|-----------|
| **Unit Tests** | Services, Hooks, Utils | Jest + Testing Library |
| **Integration Tests** | API Routes, Database | Jest + Supertest |
| **E2E Tests** | User Flows | Playwright |
| **Visual Tests** | UI Components | Storybook |

---

## Microfases

### 8.1 Unit Tests - Services

**Archivo:** `src/features/setup-assistant/__tests__/services/usage.service.test.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Usage Service Tests
// =====================================================

import { usageService } from '../../services/usage.service';
import { createServiceClient } from '@/src/shared/lib/supabase';

// Mock Supabase
jest.mock('@/src/shared/lib/supabase', () => ({
  createServiceClient: jest.fn(),
}));

describe('UsageService', () => {
  const mockSupabase = {
    rpc: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('getUsage', () => {
    it('should return usage data for a tenant', async () => {
      const mockUsageData = [{
        messages_count: 10,
        messages_limit: 50,
        files_uploaded: 2,
        files_limit: 10,
        vision_requests: 1,
        vision_limit: 5,
        tokens_used: 5000,
        tokens_limit: 50000,
        plan_id: 'essentials',
        plan_name: 'Essentials',
        is_at_limit: false,
        reset_at: new Date().toISOString(),
      }];

      mockSupabase.rpc.mockResolvedValue({ data: mockUsageData, error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(result.messagesCount).toBe(10);
      expect(result.messagesLimit).toBe(50);
      expect(result.planId).toBe('essentials');
      expect(result.isAtLimit).toBe(false);
      expect(result.percentages.messages).toBe(20);
    });

    it('should return defaults when no data found', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(result.messagesCount).toBe(0);
      expect(result.planId).toBe('starter');
    });

    it('should throw error when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(usageService.getUsage('tenant-123')).rejects.toThrow(
        'Failed to get usage'
      );
    });
  });

  describe('canPerformAction', () => {
    it('should allow action when under limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 10,
          messages_limit: 50,
          files_uploaded: 2,
          files_limit: 10,
          vision_requests: 1,
          vision_limit: 5,
          is_at_limit: false,
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'message');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny action when at limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 50,
          messages_limit: 50,
          files_uploaded: 2,
          files_limit: 10,
          vision_requests: 1,
          vision_limit: 5,
          is_at_limit: true,
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'message');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('límite');
    });
  });

  describe('getUpgradeSuggestion', () => {
    it('should not suggest upgrade when usage is low', () => {
      const usage = {
        messagesCount: 10,
        messagesLimit: 50,
        filesUploaded: 2,
        filesLimit: 10,
        visionRequests: 1,
        visionLimit: 5,
        planId: 'essentials',
        isAtLimit: false,
        tokensUsed: 5000,
        tokensLimit: 50000,
        resetAt: new Date(),
        percentages: { messages: 20, files: 20, vision: 20, tokens: 10 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(false);
    });

    it('should suggest upgrade when nearing limit', () => {
      const usage = {
        messagesCount: 45,
        messagesLimit: 50,
        filesUploaded: 8,
        filesLimit: 10,
        visionRequests: 4,
        visionLimit: 5,
        planId: 'essentials',
        isAtLimit: false,
        tokensUsed: 40000,
        tokensLimit: 50000,
        resetAt: new Date(),
        percentages: { messages: 90, files: 80, vision: 80, tokens: 80 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(true);
      expect(result.suggestedPlan).toBe('growth');
    });
  });
});
```

**Criterios de aceptación:**
- [ ] Tests de getUsage
- [ ] Tests de canPerformAction
- [ ] Tests de getUpgradeSuggestion

---

### 8.2 Unit Tests - Vision Service

**Archivo:** `src/features/setup-assistant/__tests__/services/vision.service.test.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Vision Service Tests
// =====================================================

import { visionService } from '../../services/vision.service';

// Mock Google AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

describe('VisionService', () => {
  describe('analyzeImage', () => {
    it('should analyze menu image and extract items', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: 0.9,
            description: 'Menú de restaurante',
            items: [
              { name: 'Tacos', price: 50, category: 'Platos Fuertes' },
              { name: 'Coca Cola', price: 30, category: 'Bebidas' },
            ],
            suggestions: [],
          }),
        },
      };

      // Mock the model's generateContent
      const model = (visionService as any).model;
      model.generateContent.mockResolvedValue(mockResponse);

      const result = await visionService.analyzeImage({
        imageUrl: 'https://example.com/menu.jpg',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0.9);
      expect(result.extractedData.type).toBe('menu');
      expect((result.extractedData.items as any[]).length).toBe(2);
    });

    it('should handle analysis errors gracefully', async () => {
      const model = (visionService as any).model;
      model.generateContent.mockRejectedValue(new Error('API error'));

      const result = await visionService.analyzeImage({
        imageUrl: 'https://example.com/menu.jpg',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
```

**Criterios de aceptación:**
- [ ] Tests de análisis de menú
- [ ] Tests de manejo de errores

---

### 8.3 Integration Tests - API Routes

**Archivo:** `src/features/setup-assistant/__tests__/api/messages.api.test.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Messages API Tests
// =====================================================

import { createMocks } from 'node-mocks-http';
import { POST as sendMessage } from '@/app/api/setup-assistant/[conversationId]/messages/route';

// Mock auth helper
jest.mock('@/src/shared/lib/auth-helper', () => ({
  getAuthenticatedContext: jest.fn(),
  isAuthError: jest.fn().mockReturnValue(false),
  createAuthErrorResponse: jest.fn(),
}));

// Mock supabase
jest.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: jest.fn(),
  createServiceClient: jest.fn(),
}));

// Mock rate limiter
jest.mock('@/src/shared/lib/rate-limit', () => ({
  aiLimiter: jest.fn().mockResolvedValue(null),
}));

describe('Messages API', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup auth mock
    const { getAuthenticatedContext } = require('@/src/shared/lib/auth-helper');
    getAuthenticatedContext.mockResolvedValue({
      client: mockSupabase,
      tenantId: 'tenant-123',
      userId: 'user-123',
      role: 'admin',
    });
  });

  describe('POST /api/setup-assistant/[conversationId]/messages', () => {
    it('should send a message and return response', async () => {
      // Mock conversation exists
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'conv-123', status: 'active' },
        error: null,
      });

      // Mock usage check
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ messages_count: 5, messages_limit: 50 }],
        error: null,
      });

      // Mock insert user message
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'msg-user-123', role: 'user', content: 'Test' },
        error: null,
      });

      // Mock insert assistant message
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'msg-assistant-123', role: 'assistant', content: 'Response' },
        error: null,
      });

      // Mock increment usage
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      const { req, res } = createMocks({
        method: 'POST',
        body: { content: 'Test message' },
      });

      // Note: This is a simplified test structure
      // Actual implementation would need proper Next.js API route testing

      expect(true).toBe(true); // Placeholder
    });

    it('should reject when at message limit', async () => {
      // Mock conversation exists
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'conv-123', status: 'active' },
        error: null,
      });

      // Mock usage at limit
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ messages_count: 50, messages_limit: 50 }],
        error: null,
      });

      // Expect 429 response
      expect(true).toBe(true); // Placeholder for actual test
    });
  });
});
```

**Criterios de aceptación:**
- [ ] Tests de envío de mensaje exitoso
- [ ] Tests de límite alcanzado
- [ ] Tests de autenticación

---

### 8.4 E2E Tests - User Flows

**Archivo:** `e2e/setup-assistant.spec.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant E2E Tests
// =====================================================

import { test, expect } from '@playwright/test';

test.describe('AI Setup Assistant', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display welcome screen on first visit', async ({ page }) => {
    await page.goto('/dashboard/ai-setup');

    // Check welcome elements
    await expect(page.locator('text=Asistente de Configuración')).toBeVisible();
    await expect(page.locator('text=¡Hola!')).toBeVisible();

    // Check suggestion cards
    await expect(page.locator('text=Agregar mi menú')).toBeVisible();
    await expect(page.locator('text=Programa de lealtad')).toBeVisible();
  });

  test('should send a message and receive response', async ({ page }) => {
    await page.goto('/dashboard/ai-setup');

    // Type and send message
    const input = page.locator('textarea');
    await input.fill('Quiero configurar mi programa de lealtad');
    await page.keyboard.press('Enter');

    // Wait for response
    await expect(page.locator('.typing-indicator')).toBeVisible();
    await expect(page.locator('[data-role="assistant"]')).toBeVisible({ timeout: 30000 });
  });

  test('should upload and analyze image', async ({ page }) => {
    await page.goto('/dashboard/ai-setup');

    // Click upload button
    await page.click('button[aria-label="Subir imagen"]');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-assets/menu.jpg');

    // Wait for preview
    await expect(page.locator('img[alt*="menu"]')).toBeVisible();

    // Send with message
    const input = page.locator('textarea');
    await input.fill('Agrega estos platillos a mi menú');
    await page.keyboard.press('Enter');

    // Wait for analysis
    await expect(page.locator('text=análisis')).toBeVisible({ timeout: 30000 });
  });

  test('should show usage indicator', async ({ page }) => {
    await page.goto('/dashboard/ai-setup');

    // Usage indicator should be visible
    await expect(page.locator('[data-testid="usage-indicator"]')).toBeVisible();

    // Should show message count
    await expect(page.locator('text=/\\d+\\/\\d+/')).toBeVisible();
  });

  test('should show upgrade prompt when nearing limit', async ({ page }) => {
    // This test requires mocking the usage to be near limit
    // Implementation depends on test infrastructure

    await page.goto('/dashboard/ai-setup');

    // Placeholder - would need mock data
    expect(true).toBe(true);
  });

  test('should navigate from suggestion cards', async ({ page }) => {
    await page.goto('/dashboard/ai-setup');

    // Click suggestion card
    await page.click('text=Programa de lealtad');

    // Should start conversation
    await expect(page.locator('[data-role="user"]')).toBeVisible();
    await expect(page.locator('text=lealtad')).toBeVisible();
  });
});
```

**Criterios de aceptación:**
- [ ] Test de welcome screen
- [ ] Test de envío de mensaje
- [ ] Test de upload de imagen
- [ ] Test de usage indicator

---

### 8.5 Validation Checklist

**Archivo:** `PRPs/AI-SETUP-ASSISTANT/VALIDATION-CHECKLIST.md`

```markdown
# AI Setup Assistant - Validation Checklist

## Pre-Launch Checklist

### Database
- [ ] Migration 160 applied successfully
- [ ] Migration 161 applied successfully
- [ ] All tables created: setup_assistant_conversations, setup_assistant_messages, setup_assistant_usage
- [ ] RLS policies working correctly
- [ ] RPC functions return expected data

### API Routes
- [ ] GET /api/setup-assistant - List conversations
- [ ] POST /api/setup-assistant - Create conversation
- [ ] GET /api/setup-assistant/[id] - Get conversation with messages
- [ ] POST /api/setup-assistant/[id]/messages - Send message
- [ ] POST /api/setup-assistant/upload - Upload file
- [ ] POST /api/setup-assistant/analyze - Analyze image
- [ ] GET /api/setup-assistant/usage - Get usage info

### LangGraph Agent
- [ ] Supervisor node detects intents correctly
- [ ] Config handlers process requests
- [ ] Executor creates entities in database
- [ ] Error handling works correctly

### Vision
- [ ] Menu analysis extracts items
- [ ] Services analysis extracts services
- [ ] Auto-detect context works
- [ ] Error handling returns suggestions

### UI
- [ ] Welcome screen displays
- [ ] Chat input works (text + files)
- [ ] Messages render correctly
- [ ] Typing indicator animates
- [ ] Usage indicator updates
- [ ] Upgrade prompt shows at 80%
- [ ] Mobile responsive
- [ ] Dark mode works

### Limits
- [ ] Message limit enforced
- [ ] File limit enforced
- [ ] Vision limit enforced
- [ ] Reset at midnight works
- [ ] Upgrade prompt shows

### Integrations
- [ ] Loyalty program creation
- [ ] Services from Vision
- [ ] FAQ creation
- [ ] AI Learning feedback

### Performance
- [ ] Page load < 2s
- [ ] Message response < 5s
- [ ] Vision analysis < 10s
- [ ] No memory leaks

### Security
- [ ] Auth required on all endpoints
- [ ] Tenant isolation verified
- [ ] Rate limiting working
- [ ] File upload validation

## Test Commands

```bash
# Run all tests
npm run test

# Run setup-assistant tests only
npm run test -- --testPathPattern=setup-assistant

# Run E2E tests
npx playwright test e2e/setup-assistant.spec.ts

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Sign-off

| Area | Reviewer | Date | Status |
|------|----------|------|--------|
| Database | | | ⬜ |
| API | | | ⬜ |
| Agent | | | ⬜ |
| UI | | | ⬜ |
| Security | | | ⬜ |
| Performance | | | ⬜ |

---

**All checks must pass before production deployment.**
```

**Criterios de aceptación:**
- [ ] Checklist completo
- [ ] Comandos de test documentados
- [ ] Sign-off section

---

## Validación de Fase 8

```bash
# Ejecutar todos los tests
npm run test

# Ejecutar tests específicos
npm run test -- --testPathPattern=setup-assistant

# Ejecutar E2E
npx playwright test

# Verificar cobertura
npm run test -- --coverage
```

---

## Checklist de Fase 8

- [ ] 8.1 Unit tests de services
- [ ] 8.2 Unit tests de vision
- [ ] 8.3 Integration tests de API
- [ ] 8.4 E2E tests de user flows
- [ ] 8.5 Validation checklist creado
- [ ] Todos los tests pasan
- [ ] Cobertura > 70%
- [ ] E2E flows funcionan

---

## Post-Implementation

### Monitoreo
- Agregar métricas de uso a analytics
- Configurar alertas de errores
- Monitorear costos de Gemini API

### Documentación
- Actualizar CLAUDE.md con nueva feature
- Crear guía de usuario
- Documentar API en Postman/Swagger

### Iteración
- Recopilar feedback de usuarios
- Analizar patrones de AI Learning
- Optimizar prompts basado en resultados

---

## Resumen de Implementación Completa

| Fase | Microfases | Estado |
|------|------------|--------|
| 1. Database | 5 | ⬜ Pendiente |
| 2. API | 6 | ⬜ Pendiente |
| 3. LangGraph | 7 | ⬜ Pendiente |
| 4. Vision | 4 | ⬜ Pendiente |
| 5. UI | 8 | ⬜ Pendiente |
| 6. Limits | 4 | ⬜ Pendiente |
| 7. Integrations | 6 | ⬜ Pendiente |
| 8. Testing | 5 | ⬜ Pendiente |
| **Total** | **45** | **0/45** |

---

*Documento completado - Listo para ejecución por fases*
*TIS TIS Platform v4.7.0*
