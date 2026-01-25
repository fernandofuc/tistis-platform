/**
 * TIS TIS Platform - CalendarTabs Tests
 * FASE 8 - Testing: Micro-fase 8.2
 *
 * Tests for CalendarTabs component that provides
 * Apple-style tab navigation for calendar sections.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarTabs, CALENDAR_TABS } from '@/app/(dashboard)/dashboard/calendario/components/CalendarTabs';

// Mock the useVerticalTerminology hook
vi.mock('@/src/hooks/useVerticalTerminology', () => ({
  useVerticalTerminology: vi.fn(),
}));

import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';

const mockUseVerticalTerminology = useVerticalTerminology as ReturnType<typeof vi.fn>;

// ==============================================
// CALENDAR TABS TESTS
// ==============================================
describe('CalendarTabs', () => {
  const mockOnTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to dental vertical
    mockUseVerticalTerminology.mockReturnValue({
      vertical: 'dental',
      terminology: {},
      t: vi.fn((key: string) => key),
      isLoading: false,
    });
  });

  describe('Rendering', () => {
    it('renders navigation container with correct aria-label', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      expect(screen.getByRole('navigation', { name: 'Calendar sections' })).toBeInTheDocument();
    });

    it('renders both desktop and mobile tab lists', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      // Both desktop and mobile should have tablists
      const tablists = screen.getAllByRole('tablist', { name: 'Calendar tabs' });
      expect(tablists).toHaveLength(2);
    });

    it('renders all defined tabs', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      // Should render agenda and estados tabs (2 each for desktop and mobile = 4)
      const allTabs = screen.getAllByRole('tab');
      expect(allTabs).toHaveLength(4); // 2 tabs x 2 (desktop + mobile)
    });

    it('renders icons for each tab', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      // SVG icons should be present
      const svgIcons = container.querySelectorAll('svg');
      expect(svgIcons.length).toBeGreaterThanOrEqual(4); // At least 4 icons (2 tabs x 2 views)
    });
  });

  describe('Tab Labels - Dental Vertical', () => {
    beforeEach(() => {
      mockUseVerticalTerminology.mockReturnValue({
        vertical: 'dental',
        terminology: {},
        t: vi.fn((key: string) => key),
        isLoading: false,
      });
    });

    it('shows "Citas" for agenda tab in dental vertical', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      expect(screen.getAllByText('Citas')).toHaveLength(2); // Desktop + mobile
    });

    it('shows "Estados" for estados tab', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      expect(screen.getAllByText('Estados')).toHaveLength(2);
    });

    it('shows correct description for dental agenda', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const agendaTabs = screen.getAllByRole('tab', { name: /Citas/i });
      expect(agendaTabs[0]).toHaveAttribute('title', 'Calendario de citas');
    });
  });

  describe('Tab Labels - Restaurant Vertical', () => {
    beforeEach(() => {
      mockUseVerticalTerminology.mockReturnValue({
        vertical: 'restaurant',
        terminology: {},
        t: vi.fn((key: string) => key),
        isLoading: false,
      });
    });

    it('shows "Reservaciones" for agenda tab in restaurant vertical', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      expect(screen.getAllByText('Reservaciones')).toHaveLength(2);
    });

    it('shows correct description for restaurant reservations', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const agendaTabs = screen.getAllByRole('tab', { name: /Reservaciones/i });
      expect(agendaTabs[0]).toHaveAttribute('title', 'Calendario de reservaciones');
    });

    it('shows restaurant-specific estados description', () => {
      render(<CalendarTabs activeTab="estados" onTabChange={mockOnTabChange} />);

      const estadosTabs = screen.getAllByRole('tab', { name: /Estados/i });
      expect(estadosTabs[0]).toHaveAttribute(
        'title',
        'Estados de reservaciones y confirmaciones'
      );
    });
  });

  describe('Active Tab State', () => {
    it('sets aria-selected=true for active tab', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const agendaTabs = screen.getAllByRole('tab', { name: /Citas/i });
      const estadosTabs = screen.getAllByRole('tab', { name: /Estados/i });

      agendaTabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected', 'true');
      });
      estadosTabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected', 'false');
      });
    });

    it('sets tabIndex=0 for active tab and -1 for inactive', () => {
      render(<CalendarTabs activeTab="estados" onTabChange={mockOnTabChange} />);

      const agendaTabs = screen.getAllByRole('tab', { name: /Citas/i });
      const estadosTabs = screen.getAllByRole('tab', { name: /Estados/i });

      agendaTabs.forEach((tab) => {
        expect(tab).toHaveAttribute('tabindex', '-1');
      });
      estadosTabs.forEach((tab) => {
        expect(tab).toHaveAttribute('tabindex', '0');
      });
    });

    it('applies active styling classes to active tab', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      // Desktop active tab should have white background
      const desktopNav = container.querySelector('.hidden.md\\:block nav');
      const activeButton = desktopNav?.querySelector('[aria-selected="true"]');
      expect(activeButton).toHaveClass('bg-white');
    });

    it('updates aria-controls attribute correctly', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const agendaTab = screen.getAllByRole('tab', { name: /Citas/i })[0];
      expect(agendaTab).toHaveAttribute('aria-controls', 'tabpanel-agenda');
    });
  });

  describe('Tab Interaction', () => {
    it('calls onTabChange when clicking a tab', async () => {
      const user = userEvent.setup();
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const estadosTab = screen.getAllByRole('tab', { name: /Estados/i })[0];
      await user.click(estadosTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('estados');
    });

    it('calls onTabChange with correct tab key for agenda', async () => {
      const user = userEvent.setup();
      render(<CalendarTabs activeTab="estados" onTabChange={mockOnTabChange} />);

      const agendaTab = screen.getAllByRole('tab', { name: /Citas/i })[0];
      await user.click(agendaTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('agenda');
    });

    it('calls onTabChange for each tab click', async () => {
      const user = userEvent.setup();
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const estadosTabs = screen.getAllByRole('tab', { name: /Estados/i });

      // Click desktop version
      await user.click(estadosTabs[0]);
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);

      // Click mobile version
      await user.click(estadosTabs[1]);
      expect(mockOnTabChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Stats Badge', () => {
    it('shows badge on estados tab when stats are provided', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 3, activeHolds: 2 }}
        />
      );

      // Badge should show 5 (3 + 2)
      expect(screen.getAllByText('5')).toHaveLength(2); // Desktop + mobile
    });

    it('does not show badge when stats total is 0', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 0, activeHolds: 0 }}
        />
      );

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('does not show badge when stats are not provided', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      // Badge elements have rounded-full class - should only be 0 badges
      const badges = container.querySelectorAll('.rounded-full.text-xs');
      expect(badges).toHaveLength(0);
    });

    it('handles only pendingConfirmation stat', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 7 }}
        />
      );

      expect(screen.getAllByText('7')).toHaveLength(2);
    });

    it('handles only activeHolds stat', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ activeHolds: 4 }}
        />
      );

      expect(screen.getAllByText('4')).toHaveLength(2);
    });

    it('does not show badge on agenda tab', () => {
      const { container } = render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 10, activeHolds: 5 }}
        />
      );

      // Only estados tab should have badges
      const agendaTabs = screen.getAllByRole('tab', { name: /Citas/i });
      agendaTabs.forEach((tab) => {
        expect(tab.querySelector('.text-xs.font-medium.rounded-full')).not.toBeInTheDocument();
      });
    });

    it('applies correct badge styling when tab is active', () => {
      const { container } = render(
        <CalendarTabs
          activeTab="estados"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 3 }}
        />
      );

      // Active estados tab badge should have amber styling
      const desktopNav = container.querySelector('.hidden.md\\:block nav');
      const badge = desktopNav?.querySelector('[aria-selected="true"] .text-xs');
      expect(badge).toHaveClass('bg-amber-100');
    });
  });

  describe('Accessibility', () => {
    it('has proper role="tablist" on tab containers', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const tablists = screen.getAllByRole('tablist');
      expect(tablists).toHaveLength(2);
    });

    it('has proper role="tab" on tab buttons', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4); // 2 tabs x 2 views
    });

    it('has unique IDs for each tab', () => {
      render(<CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />);

      const tabs = screen.getAllByRole('tab');
      const ids = tabs.map((tab) => tab.id);

      // Check desktop IDs
      expect(ids).toContain('tab-agenda');
      expect(ids).toContain('tab-estados');
      // Check mobile IDs
      expect(ids).toContain('tab-mobile-agenda');
      expect(ids).toContain('tab-mobile-estados');
    });

    it('icons have aria-hidden="true"', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      const iconContainers = container.querySelectorAll('[aria-hidden="true"]');
      expect(iconContainers.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('CALENDAR_TABS Export', () => {
    it('exports CALENDAR_TABS constant', () => {
      expect(CALENDAR_TABS).toBeDefined();
      expect(Array.isArray(CALENDAR_TABS)).toBe(true);
    });

    it('has agenda tab defined', () => {
      const agendaTab = CALENDAR_TABS.find((t) => t.key === 'agenda');
      expect(agendaTab).toBeDefined();
      expect(agendaTab?.labelKey).toBe('agenda');
    });

    it('has estados tab defined', () => {
      const estadosTab = CALENDAR_TABS.find((t) => t.key === 'estados');
      expect(estadosTab).toBeDefined();
      expect(estadosTab?.labelKey).toBe('estados');
    });

    it('all tabs have required properties', () => {
      CALENDAR_TABS.forEach((tab) => {
        expect(tab).toHaveProperty('key');
        expect(tab).toHaveProperty('labelKey');
        expect(tab).toHaveProperty('icon');
        expect(tab).toHaveProperty('descriptionKey');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles stats with only zero values', () => {
      const { container } = render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 0, activeHolds: 0 }}
        />
      );

      // No badges should be shown for zero values
      const badges = container.querySelectorAll('.rounded-full.text-xs');
      expect(badges).toHaveLength(0);
    });

    it('handles undefined stats object', () => {
      const { container } = render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={undefined}
        />
      );

      // Should render without errors
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('handles empty stats object', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{}}
        />
      );

      // Should render without errors and no badges
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('renders correctly when only pendingConfirmation has value', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ pendingConfirmation: 5 }}
        />
      );

      // Should show badge with 5
      expect(screen.getAllByText('5')).toHaveLength(2); // Desktop + mobile
    });

    it('renders correctly when only activeHolds has value', () => {
      render(
        <CalendarTabs
          activeTab="agenda"
          onTabChange={mockOnTabChange}
          stats={{ activeHolds: 3 }}
        />
      );

      // Should show badge with 3
      expect(screen.getAllByText('3')).toHaveLength(2); // Desktop + mobile
    });
  });

  describe('Mobile Specific', () => {
    it('mobile tabs have minimum touch target size', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      const mobileContainer = container.querySelector('.md\\:hidden');
      const mobileButtons = mobileContainer?.querySelectorAll('button');

      mobileButtons?.forEach((button) => {
        expect(button).toHaveClass('min-h-[44px]');
      });
    });

    it('mobile tabs have whitespace-nowrap to prevent wrapping', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      const mobileContainer = container.querySelector('.md\\:hidden');
      const mobileButtons = mobileContainer?.querySelectorAll('button');

      mobileButtons?.forEach((button) => {
        expect(button).toHaveClass('whitespace-nowrap');
      });
    });

    it('mobile container is horizontally scrollable', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      const scrollContainer = container.querySelector('.md\\:hidden > div');
      expect(scrollContainer).toHaveClass('overflow-x-auto');
    });

    it('mobile active tab has coral background', () => {
      const { container } = render(
        <CalendarTabs activeTab="agenda" onTabChange={mockOnTabChange} />
      );

      const mobileContainer = container.querySelector('.md\\:hidden');
      const activeButton = mobileContainer?.querySelector('[aria-selected="true"]');
      expect(activeButton).toHaveClass('bg-tis-coral');
    });
  });
});
