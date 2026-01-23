// =====================================================
// TIS TIS PLATFORM - Inventory Components Tests
// Unit tests for UI components
// =====================================================

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the cn utility
vi.mock('@/shared/utils', () => ({
  cn: (...classes: (string | undefined | null | boolean)[]) =>
    classes.filter(Boolean).join(' '),
}));

// Mock the config
vi.mock('@/features/inventory-management/config/inventory-config', () => ({
  STOCK_STATUS_CONFIG: {
    in_stock: {
      label: 'En Stock',
      colors: {
        bg: 'bg-tis-green-100',
        text: 'text-tis-green-700',
        icon: 'text-tis-green-500',
      },
    },
    low_stock: {
      label: 'Stock Bajo',
      colors: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: 'text-amber-500',
      },
    },
    out_of_stock: {
      label: 'Agotado',
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        icon: 'text-red-500',
      },
    },
    overstocked: {
      label: 'Exceso',
      colors: {
        bg: 'bg-tis-purple-100',
        text: 'text-tis-purple-700',
        icon: 'text-tis-purple-500',
      },
    },
  },
  MOVEMENT_TYPE_CONFIG: {
    purchase: {
      label: 'Compra',
      shortLabel: 'C',
      isInbound: true,
      colors: {
        bg: 'bg-tis-green-100',
        text: 'text-tis-green-700',
      },
    },
    sale: {
      label: 'Venta',
      shortLabel: 'V',
      isInbound: false,
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
      },
    },
    adjustment: {
      label: 'Ajuste',
      shortLabel: 'A',
      isInbound: true,
      colors: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
      },
    },
    transfer_in: {
      label: 'Transferencia Entrada',
      shortLabel: 'T+',
      isInbound: true,
      colors: {
        bg: 'bg-tis-blue-100',
        text: 'text-tis-blue-700',
      },
    },
    transfer_out: {
      label: 'Transferencia Salida',
      shortLabel: 'T-',
      isInbound: false,
      colors: {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
      },
    },
    waste: {
      label: 'Merma',
      shortLabel: 'M',
      isInbound: false,
      colors: {
        bg: 'bg-rose-100',
        text: 'text-rose-700',
      },
    },
    production: {
      label: 'Producción',
      shortLabel: 'P',
      isInbound: true,
      colors: {
        bg: 'bg-indigo-100',
        text: 'text-indigo-700',
      },
    },
    consumption: {
      label: 'Consumo',
      shortLabel: 'X',
      isInbound: false,
      colors: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
      },
    },
  },
}));

// Import components after mocks
import {
  StockStatusBadge,
  StockLevelIndicator,
  StockValueDisplay,
} from '@/features/inventory-management/components/StockStatusBadge';

import {
  MovementTypeBadge,
  MovementDirection,
} from '@/features/inventory-management/components/MovementTypeBadge';

// ========================================
// STOCK STATUS BADGE TESTS
// ========================================

describe('StockStatusBadge', () => {
  describe('rendering', () => {
    it('should render in_stock status correctly', () => {
      render(<StockStatusBadge status="in_stock" />);
      expect(screen.getByText('En Stock')).toBeInTheDocument();
    });

    it('should render low_stock status correctly', () => {
      render(<StockStatusBadge status="low_stock" />);
      expect(screen.getByText('Stock Bajo')).toBeInTheDocument();
    });

    it('should render out_of_stock status correctly', () => {
      render(<StockStatusBadge status="out_of_stock" />);
      expect(screen.getByText('Agotado')).toBeInTheDocument();
    });

    it('should render overstocked status correctly', () => {
      render(<StockStatusBadge status="overstocked" />);
      expect(screen.getByText('Exceso')).toBeInTheDocument();
    });

    it('should return null for invalid status', () => {
      // @ts-expect-error - Testing invalid status
      const { container } = render(<StockStatusBadge status="invalid_status" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('sizes', () => {
    it('should apply small size styles', () => {
      render(<StockStatusBadge status="in_stock" size="sm" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.className).toContain('px-2');
      expect(badge.className).toContain('text-xs');
    });

    it('should apply medium size styles by default', () => {
      render(<StockStatusBadge status="in_stock" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.className).toContain('px-2.5');
    });

    it('should apply large size styles', () => {
      render(<StockStatusBadge status="in_stock" size="lg" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.className).toContain('px-3');
      expect(badge.className).toContain('text-sm');
    });
  });

  describe('dot indicator', () => {
    it('should show dot by default', () => {
      render(<StockStatusBadge status="in_stock" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      // Check for the dot element (span with rounded-full class)
      const dots = badge.querySelectorAll('span.rounded-full');
      expect(dots.length).toBeGreaterThan(0);
    });

    it('should hide dot when showDot is false', () => {
      render(<StockStatusBadge status="in_stock" showDot={false} data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      // The badge itself has rounded-full, but there should be no inner dot
      const innerDots = badge.querySelectorAll('span > span.rounded-full');
      expect(innerDots.length).toBe(0);
    });
  });

  describe('custom className', () => {
    it('should accept custom className', () => {
      render(<StockStatusBadge status="in_stock" className="custom-class" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.className).toContain('custom-class');
    });
  });

  describe('forwardRef', () => {
    it('should have correct displayName', () => {
      expect(StockStatusBadge.displayName).toBe('StockStatusBadge');
    });
  });
});

// ========================================
// STOCK LEVEL INDICATOR TESTS
// ========================================

describe('StockLevelIndicator', () => {
  describe('rendering', () => {
    it('should render progress bar', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={100}
          data-testid="indicator"
        />
      );
      expect(screen.getByTestId('indicator')).toBeInTheDocument();
    });

    it('should not show labels by default', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={100}
          data-testid="indicator"
        />
      );
      expect(screen.queryByText(/mín/)).not.toBeInTheDocument();
    });

    it('should show labels when showLabels is true', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={100}
          showLabels={true}
          data-testid="indicator"
        />
      );
      expect(screen.getByText(/mín/)).toBeInTheDocument();
    });
  });

  describe('percentage calculation', () => {
    it('should calculate percentage based on maximum when provided', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={10}
          maximumStock={100}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      // The progress bar is inside: div.w-full > div.bg-slate-100 > div (progress)
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should use 2x minimum as max reference when maximum is not provided', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={50}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      // 50 / (50 * 2) * 100 = 50%
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should cap percentage at 100%', () => {
      render(
        <StockLevelIndicator
          currentStock={200}
          minimumStock={50}
          maximumStock={100}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('bar colors', () => {
    it('should show red for out of stock', () => {
      render(
        <StockLevelIndicator
          currentStock={0}
          minimumStock={10}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      expect(progressBar?.className).toContain('bg-red-500');
    });

    it('should show amber for low stock', () => {
      render(
        <StockLevelIndicator
          currentStock={5}
          minimumStock={10}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      expect(progressBar?.className).toContain('bg-amber-500');
    });

    it('should show purple for overstocked', () => {
      render(
        <StockLevelIndicator
          currentStock={150}
          minimumStock={10}
          maximumStock={100}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      expect(progressBar?.className).toContain('bg-tis-purple-500');
    });

    it('should show green for in stock', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={10}
          maximumStock={100}
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const progressBar = indicator.querySelector('.bg-slate-100 > div');
      expect(progressBar?.className).toContain('bg-tis-green-500');
    });
  });

  describe('sizes', () => {
    it('should apply small height', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={10}
          size="sm"
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const barContainer = indicator.querySelector('.bg-slate-100');
      expect(barContainer?.className).toContain('h-1.5');
    });

    it('should apply large height', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={10}
          size="lg"
          data-testid="indicator"
        />
      );
      const indicator = screen.getByTestId('indicator');
      const barContainer = indicator.querySelector('.bg-slate-100');
      expect(barContainer?.className).toContain('h-3');
    });
  });

  describe('forwardRef', () => {
    it('should have correct displayName', () => {
      expect(StockLevelIndicator.displayName).toBe('StockLevelIndicator');
    });
  });
});

// ========================================
// STOCK VALUE DISPLAY TESTS
// ========================================

describe('StockValueDisplay', () => {
  describe('rendering', () => {
    it('should render formatted currency value', () => {
      render(<StockValueDisplay value={1000} data-testid="display" />);
      const display = screen.getByTestId('display');
      // Should contain MXN currency format
      expect(display.textContent).toContain('$');
      expect(display.textContent).toContain('1');
    });

    it('should format with 2 decimal places', () => {
      render(<StockValueDisplay value={100.5} data-testid="display" />);
      const display = screen.getByTestId('display');
      expect(display.textContent).toContain('.50');
    });
  });

  describe('currency', () => {
    it('should default to MXN', () => {
      render(<StockValueDisplay value={100} data-testid="display" />);
      // The Intl.NumberFormat will format with MXN by default
      expect(screen.getByTestId('display')).toBeInTheDocument();
    });

    it('should accept different currency', () => {
      render(<StockValueDisplay value={100} currency="USD" data-testid="display" />);
      expect(screen.getByTestId('display')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should apply small size', () => {
      render(<StockValueDisplay value={100} size="sm" data-testid="display" />);
      const display = screen.getByTestId('display');
      const value = display.querySelector('span');
      expect(value?.className).toContain('text-sm');
    });

    it('should apply medium size by default', () => {
      render(<StockValueDisplay value={100} data-testid="display" />);
      const display = screen.getByTestId('display');
      const value = display.querySelector('span');
      expect(value?.className).toContain('text-base');
    });

    it('should apply large size', () => {
      render(<StockValueDisplay value={100} size="lg" data-testid="display" />);
      const display = screen.getByTestId('display');
      const value = display.querySelector('span');
      expect(value?.className).toContain('text-lg');
    });
  });

  describe('trend indicator', () => {
    it('should not show trend when not provided', () => {
      render(<StockValueDisplay value={100} data-testid="display" />);
      const display = screen.getByTestId('display');
      // Only one span (the value)
      expect(display.querySelectorAll('span').length).toBe(1);
    });

    it('should show up trend with + prefix', () => {
      render(
        <StockValueDisplay
          value={100}
          trend="up"
          trendValue="10%"
          data-testid="display"
        />
      );
      expect(screen.getByText(/\+10%/)).toBeInTheDocument();
    });

    it('should show down trend with - prefix', () => {
      render(
        <StockValueDisplay
          value={100}
          trend="down"
          trendValue="5%"
          data-testid="display"
        />
      );
      expect(screen.getByText(/-5%/)).toBeInTheDocument();
    });

    it('should show neutral trend without prefix', () => {
      render(
        <StockValueDisplay
          value={100}
          trend="neutral"
          trendValue="0%"
          data-testid="display"
        />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should apply correct color for up trend', () => {
      render(
        <StockValueDisplay
          value={100}
          trend="up"
          trendValue="10%"
          data-testid="display"
        />
      );
      const trendSpan = screen.getByText(/\+10%/);
      expect(trendSpan.className).toContain('text-tis-green-600');
    });

    it('should apply correct color for down trend', () => {
      render(
        <StockValueDisplay
          value={100}
          trend="down"
          trendValue="5%"
          data-testid="display"
        />
      );
      const trendSpan = screen.getByText(/-5%/);
      expect(trendSpan.className).toContain('text-red-600');
    });

    it('should not show trend indicator if only trend is provided without trendValue', () => {
      render(
        <StockValueDisplay
          value={100}
          trend="up"
          data-testid="display"
        />
      );
      const display = screen.getByTestId('display');
      // Should only have the value span
      expect(display.querySelectorAll('span').length).toBe(1);
    });
  });

  describe('forwardRef', () => {
    it('should have correct displayName', () => {
      expect(StockValueDisplay.displayName).toBe('StockValueDisplay');
    });
  });
});

// ========================================
// MOVEMENT TYPE BADGE TESTS
// ========================================

describe('MovementTypeBadge', () => {
  describe('rendering', () => {
    it('should render purchase type correctly', () => {
      render(<MovementTypeBadge type="purchase" />);
      expect(screen.getByText('Compra')).toBeInTheDocument();
    });

    it('should render sale type correctly', () => {
      render(<MovementTypeBadge type="sale" />);
      expect(screen.getByText('Venta')).toBeInTheDocument();
    });

    it('should render adjustment type correctly', () => {
      render(<MovementTypeBadge type="adjustment" />);
      expect(screen.getByText('Ajuste')).toBeInTheDocument();
    });

    it('should render transfer_in type correctly', () => {
      render(<MovementTypeBadge type="transfer_in" />);
      expect(screen.getByText('Transferencia Entrada')).toBeInTheDocument();
    });

    it('should render transfer_out type correctly', () => {
      render(<MovementTypeBadge type="transfer_out" />);
      expect(screen.getByText('Transferencia Salida')).toBeInTheDocument();
    });

    it('should render waste type correctly', () => {
      render(<MovementTypeBadge type="waste" />);
      expect(screen.getByText('Merma')).toBeInTheDocument();
    });

    it('should render production type correctly', () => {
      render(<MovementTypeBadge type="production" />);
      expect(screen.getByText('Producción')).toBeInTheDocument();
    });

    it('should render consumption type correctly', () => {
      render(<MovementTypeBadge type="consumption" />);
      expect(screen.getByText('Consumo')).toBeInTheDocument();
    });

    it('should return null for invalid type', () => {
      // @ts-expect-error - Testing invalid type
      const { container } = render(<MovementTypeBadge type="invalid_type" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('compact mode', () => {
    it('should show full label by default', () => {
      render(<MovementTypeBadge type="purchase" />);
      expect(screen.getByText('Compra')).toBeInTheDocument();
    });

    it('should show short label when compact is true', () => {
      render(<MovementTypeBadge type="purchase" compact={true} />);
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.queryByText('Compra')).not.toBeInTheDocument();
    });

    it('should show short label for sale in compact mode', () => {
      render(<MovementTypeBadge type="sale" compact={true} />);
      expect(screen.getByText('V')).toBeInTheDocument();
    });
  });

  describe('direction indicator', () => {
    it('should show direction icon by default', () => {
      render(<MovementTypeBadge type="purchase" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.querySelector('svg')).toBeInTheDocument();
    });

    it('should hide direction icon when showDirection is false', () => {
      render(<MovementTypeBadge type="purchase" showDirection={false} data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should show inbound direction color for purchase', () => {
      render(<MovementTypeBadge type="purchase" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      const directionSpan = badge.querySelector('span.flex-shrink-0');
      expect(directionSpan?.className).toContain('text-tis-green-600');
    });

    it('should show outbound direction color for sale', () => {
      render(<MovementTypeBadge type="sale" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      const directionSpan = badge.querySelector('span.flex-shrink-0');
      expect(directionSpan?.className).toContain('text-red-500');
    });
  });

  describe('sizes', () => {
    it('should apply small size styles', () => {
      render(<MovementTypeBadge type="purchase" size="sm" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.className).toContain('px-2');
      expect(badge.className).toContain('text-xs');
    });

    it('should apply large size styles', () => {
      render(<MovementTypeBadge type="purchase" size="lg" data-testid="badge" />);
      const badge = screen.getByTestId('badge');
      expect(badge.className).toContain('px-3');
      expect(badge.className).toContain('text-sm');
    });
  });

  describe('forwardRef', () => {
    it('should have correct displayName', () => {
      expect(MovementTypeBadge.displayName).toBe('MovementTypeBadge');
    });
  });
});

// ========================================
// MOVEMENT DIRECTION TESTS
// ========================================

describe('MovementDirection', () => {
  describe('rendering', () => {
    it('should render quantity with unit', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      expect(screen.getByText(/100/)).toBeInTheDocument();
      expect(screen.getByText(/kg/)).toBeInTheDocument();
    });

    it('should format quantity with locale', () => {
      render(
        <MovementDirection
          quantity={1000}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      // es-MX uses comma as thousands separator
      expect(screen.getByText(/1,000/)).toBeInTheDocument();
    });

    it('should format decimal quantities', () => {
      render(
        <MovementDirection
          quantity={10.55}
          unit="l"
          isInbound={true}
          data-testid="direction"
        />
      );
      expect(screen.getByText(/10\.55/)).toBeInTheDocument();
    });
  });

  describe('inbound/outbound', () => {
    it('should show + prefix for inbound', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      expect(screen.getByText(/\+100/)).toBeInTheDocument();
    });

    it('should show - prefix for outbound', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={false}
          data-testid="direction"
        />
      );
      expect(screen.getByText(/-100/)).toBeInTheDocument();
    });

    it('should show green color for inbound', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      const direction = screen.getByTestId('direction');
      expect(direction.className).toContain('text-tis-green-600');
    });

    it('should show red color for outbound', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={false}
          data-testid="direction"
        />
      );
      const direction = screen.getByTestId('direction');
      expect(direction.className).toContain('text-red-600');
    });

    it('should use absolute value for negative quantities', () => {
      render(
        <MovementDirection
          quantity={-50}
          unit="kg"
          isInbound={false}
          data-testid="direction"
        />
      );
      // Should show 50, not -50
      expect(screen.getByText(/-50 kg/)).toBeInTheDocument();
    });
  });

  describe('direction icons', () => {
    it('should show down arrow for inbound', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      const direction = screen.getByTestId('direction');
      expect(direction.querySelector('svg')).toBeInTheDocument();
    });

    it('should show up arrow for outbound', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={false}
          data-testid="direction"
        />
      );
      const direction = screen.getByTestId('direction');
      expect(direction.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should apply small size', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={true}
          size="sm"
          data-testid="direction"
        />
      );
      const direction = screen.getByTestId('direction');
      expect(direction.className).toContain('text-sm');
    });

    it('should apply large size', () => {
      render(
        <MovementDirection
          quantity={100}
          unit="kg"
          isInbound={true}
          size="lg"
          data-testid="direction"
        />
      );
      const direction = screen.getByTestId('direction');
      expect(direction.className).toContain('text-lg');
    });
  });

  describe('forwardRef', () => {
    it('should have correct displayName', () => {
      expect(MovementDirection.displayName).toBe('MovementDirection');
    });
  });
});

// ========================================
// EDGE CASES AND ACCESSIBILITY
// ========================================

describe('Component Accessibility', () => {
  describe('StockStatusBadge', () => {
    it('should accept aria attributes', () => {
      render(
        <StockStatusBadge
          status="in_stock"
          aria-label="Stock status: In Stock"
          data-testid="badge"
        />
      );
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('aria-label', 'Stock status: In Stock');
    });
  });

  describe('MovementTypeBadge', () => {
    it('should accept aria attributes', () => {
      render(
        <MovementTypeBadge
          type="purchase"
          aria-label="Movement type: Purchase"
          data-testid="badge"
        />
      );
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('aria-label', 'Movement type: Purchase');
    });
  });

  describe('StockValueDisplay', () => {
    it('should accept aria attributes', () => {
      render(
        <StockValueDisplay
          value={1000}
          aria-label="Stock value: $1,000 MXN"
          data-testid="display"
        />
      );
      const display = screen.getByTestId('display');
      expect(display).toHaveAttribute('aria-label', 'Stock value: $1,000 MXN');
    });
  });
});

describe('Edge Cases', () => {
  describe('StockLevelIndicator edge cases', () => {
    it('should handle zero minimum stock', () => {
      render(
        <StockLevelIndicator
          currentStock={50}
          minimumStock={0}
          data-testid="indicator"
        />
      );
      // Should not crash, uses 0 * 2 = 0 as max, but percentage calculation should handle gracefully
      expect(screen.getByTestId('indicator')).toBeInTheDocument();
    });

    it('should handle negative current stock', () => {
      render(
        <StockLevelIndicator
          currentStock={-10}
          minimumStock={100}
          data-testid="indicator"
        />
      );
      expect(screen.getByTestId('indicator')).toBeInTheDocument();
    });
  });

  describe('MovementDirection edge cases', () => {
    it('should handle zero quantity', () => {
      render(
        <MovementDirection
          quantity={0}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      expect(screen.getByText(/\+0/)).toBeInTheDocument();
    });

    it('should handle very large quantities', () => {
      render(
        <MovementDirection
          quantity={1000000}
          unit="kg"
          isInbound={true}
          data-testid="direction"
        />
      );
      // Should format with locale separators
      expect(screen.getByTestId('direction')).toBeInTheDocument();
    });
  });

  describe('StockValueDisplay edge cases', () => {
    it('should handle zero value', () => {
      render(<StockValueDisplay value={0} data-testid="display" />);
      expect(screen.getByTestId('display').textContent).toContain('0');
    });

    it('should handle very large values', () => {
      render(<StockValueDisplay value={1000000000} data-testid="display" />);
      expect(screen.getByTestId('display')).toBeInTheDocument();
    });

    it('should handle negative values', () => {
      render(<StockValueDisplay value={-100} data-testid="display" />);
      expect(screen.getByTestId('display').textContent).toContain('-');
    });
  });
});
