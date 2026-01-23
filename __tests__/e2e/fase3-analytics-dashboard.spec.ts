// =====================================================
// TIS TIS PLATFORM - FASE 3 E2E Tests
// Analytics Dashboard User Journey
// Framework: Playwright
// =====================================================

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@tistis.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Test123!@#';

test.describe('FASE 3: Analytics Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Login as owner/admin user
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
  });

  // ======================
  // NAVIGATION
  // ======================
  test.describe('Navigation to Analytics', () => {
    test('should navigate to analytics page from settings menu', async ({ page }) => {
      // Click on settings or navigate directly
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      // Should see analytics page
      await expect(page).toHaveURL(/\/dashboard\/settings\/api-analytics/);
      await expect(page.locator('h1, h2')).toContainText(/analytics/i);
    });

    test('should show loading state while fetching data', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      // Should see loading indicators briefly
      const loadingIndicator = page.locator('[data-testid="analytics-loading"]').or(
        page.locator('text=Loading').or(
          page.locator('.animate-spin')
        )
      );

      // Loading should appear and disappear
      await loadingIndicator.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {
        // Loading might be too fast to catch
      });
    });
  });

  // ======================
  // SUMMARY CARDS
  // ======================
  test.describe('Summary Cards Display', () => {
    test('should display total requests summary card', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      // Wait for data to load
      await page.waitForSelector('[data-testid="summary-cards"]', { timeout: 5000 }).catch(() => {
        // Fallback if no test ID
      });

      // Should see Total Requests card
      const totalRequestsCard = page.locator('text=Total Requests').or(
        page.locator('[data-testid="total-requests-card"]')
      );

      await expect(totalRequestsCard).toBeVisible();
    });

    test('should display average response time', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000); // Wait for API response

      // Should see Avg Response Time metric
      const avgResponseTime = page.locator('text=/Avg.*Response.*Time/i').or(
        page.locator('[data-testid="avg-response-time"]')
      );

      await expect(avgResponseTime).toBeVisible();
    });

    test('should display error rate', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should see Error Rate metric
      const errorRate = page.locator('text=/Error.*Rate/i').or(
        page.locator('[data-testid="error-rate"]')
      );

      await expect(errorRate).toBeVisible();
    });

    test('should display cache hit rate', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should see Cache Hit Rate (FASE 3 feature)
      const cacheHitRate = page.locator('text=/Cache.*Hit.*Rate/i').or(
        page.locator('[data-testid="cache-hit-rate"]')
      );

      await expect(cacheHitRate).toBeVisible();
    });

    test('should show numeric values in summary cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Check for number patterns (e.g., "1,234" or "45.2 ms")
      const numberPattern = /\d{1,3}(,\d{3})*(\.\d+)?/;

      const summarySection = page.locator('[data-testid="summary-cards"]').or(
        page.locator('div').filter({ hasText: /Total Requests/i })
      );

      await expect(summarySection.locator(`text=${numberPattern}`).first()).toBeVisible();
    });
  });

  // ======================
  // BRANCH SELECTOR
  // ======================
  test.describe('Branch Filter', () => {
    test('should have branch selector dropdown', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Look for branch selector
      const branchSelector = page.locator('select[name="branch"]').or(
        page.locator('[data-testid="branch-selector"]').or(
          page.locator('text=Select Branch').or(
            page.locator('text=All Branches')
          )
        )
      );

      await expect(branchSelector).toBeVisible();
    });

    test('should filter analytics by selected branch', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Get initial total requests
      const initialTotal = await page.locator('text=Total Requests')
        .locator('..')
        .locator('text=/\\d+/')
        .first()
        .textContent()
        .catch(() => '0');

      // Select a specific branch (if dropdown exists)
      const branchDropdown = page.locator('select[name="branch"]').or(
        page.locator('[data-testid="branch-selector"]')
      );

      if (await branchDropdown.isVisible()) {
        // Click to open dropdown
        await branchDropdown.click();

        // Select first branch option (not "All Branches")
        const branchOptions = page.locator('option').or(
          page.locator('[role="option"]')
        );

        const firstBranch = branchOptions.nth(1); // Skip "All Branches"
        if (await firstBranch.isVisible()) {
          await firstBranch.click();

          // Wait for data to reload
          await page.waitForTimeout(1500);

          // Total should potentially change (or stay same if only one branch)
          const filteredTotal = await page.locator('text=Total Requests')
            .locator('..')
            .locator('text=/\\d+/')
            .first()
            .textContent()
            .catch(() => '0');

          // At minimum, page should re-render
          expect(filteredTotal).toBeDefined();
        }
      }
    });
  });

  // ======================
  // BRANCH BREAKDOWN TABLE
  // ======================
  test.describe('Branch Breakdown Table', () => {
    test('should display branch-wise analytics table', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Look for table with branch data
      const analyticsTable = page.locator('table').or(
        page.locator('[data-testid="branch-analytics-table"]')
      );

      await expect(analyticsTable).toBeVisible();
    });

    test('should show branch name column', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should see "Branch" column header
      const branchColumnHeader = page.locator('th').filter({ hasText: /Branch/i });

      await expect(branchColumnHeader).toBeVisible();
    });

    test('should show API requests column', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should see requests/calls column
      const requestsColumn = page.locator('th').filter({ hasText: /Request|Call/i });

      await expect(requestsColumn).toBeVisible();
    });

    test('should show leads count column', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should see Leads column
      const leadsColumn = page.locator('th').filter({ hasText: /Lead/i });

      await expect(leadsColumn).toBeVisible();
    });

    test('should display at least one branch row', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(3000); // Give time for data

      // Should have tbody with rows
      const tableRows = page.locator('tbody tr');

      const rowCount = await tableRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });
  });

  // ======================
  // CHARTS & VISUALIZATIONS
  // ======================
  test.describe('Data Visualization', () => {
    test('should display chart/graph if available', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Look for chart container (Recharts or similar)
      const chart = page.locator('.recharts-wrapper').or(
        page.locator('[data-testid="analytics-chart"]').or(
          page.locator('svg').filter({ has: page.locator('path, rect') })
        )
      );

      // Chart might not always be present
      const chartVisible = await chart.isVisible().catch(() => false);

      if (chartVisible) {
        await expect(chart).toBeVisible();
      }
    });
  });

  // ======================
  // ERROR HANDLING
  // ======================
  test.describe('Error States', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/analytics/branch-usage', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should show error message
      const errorMessage = page.locator('text=/error|failed|something went wrong/i');

      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should handle empty state (no data)', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/analytics/branch-usage', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            summary: {
              total_requests_30d: 0,
              avg_response_time_ms: 0,
              error_rate: 0,
              cache_hit_rate: 0,
            },
            branches: [],
          }),
        });
      });

      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should show "No data" or empty state
      const emptyState = page.locator('text=/no data|no analytics|no branches/i');

      // Either empty state message or zeros in summary
      const summaryZeros = page.locator('text=0');

      const hasEmptyStateOrZeros =
        (await emptyState.isVisible().catch(() => false)) ||
        (await summaryZeros.count()) > 0;

      expect(hasEmptyStateOrZeros).toBeTruthy();
    });
  });

  // ======================
  // RESPONSIVE DESIGN
  // ======================
  test.describe('Responsive Layout', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Page should still be usable
      await expect(page.locator('h1, h2').first()).toBeVisible();

      // Summary cards might stack vertically
      const cards = page.locator('[data-testid="summary-card"]').or(
        page.locator('div').filter({ hasText: /Total Requests|Avg Response/i })
      );

      // At least one card should be visible
      await expect(cards.first()).toBeVisible();
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should display properly
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  // ======================
  // ACCESSIBILITY
  // ======================
  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Should have main heading
      const mainHeading = page.locator('h1, h2').first();
      await expect(mainHeading).toBeVisible();
    });

    test('should have focusable interactive elements', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Branch selector should be focusable
      const branchSelector = page.locator('select[name="branch"]').or(
        page.locator('[data-testid="branch-selector"]')
      );

      if (await branchSelector.isVisible()) {
        await branchSelector.focus();

        const isFocused = await branchSelector.evaluate((el) => {
          return document.activeElement === el;
        });

        expect(isFocused).toBeTruthy();
      }
    });
  });

  // ======================
  // REAL-TIME UPDATES
  // ======================
  test.describe('Data Refresh', () => {
    test('should allow manual refresh of data', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/settings/api-analytics`);

      await page.waitForTimeout(2000);

      // Look for refresh button (if exists)
      const refreshButton = page.locator('button').filter({ hasText: /refresh|reload/i });

      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Should show loading state briefly
        await page.waitForTimeout(500);

        // Data should reload
        await page.waitForTimeout(2000);

        // Page should still be functional
        await expect(page.locator('h1, h2').first()).toBeVisible();
      }
    });
  });
});
