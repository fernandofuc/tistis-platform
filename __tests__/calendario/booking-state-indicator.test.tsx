/**
 * TIS TIS Platform - BookingStateIndicator Tests
 * FASE 8 - Testing: Micro-fase 8.1
 *
 * Tests for BookingStateIndicator and BookingStateDot components
 * that display combined booking states with visual indicators.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  BookingStateIndicator,
  BookingStateDot,
} from '@/app/(dashboard)/dashboard/calendario/components/BookingStateIndicator';

// ==============================================
// BOOKING STATE INDICATOR TESTS
// ==============================================
describe('BookingStateIndicator', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<BookingStateIndicator appointmentStatus="scheduled" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Programado')).toBeInTheDocument();
    });

    it('renders without label when showLabel is false', () => {
      render(
        <BookingStateIndicator appointmentStatus="scheduled" showLabel={false} />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByText('Programado')).not.toBeInTheDocument();
    });

    it('applies correct aria-label for accessibility', () => {
      render(<BookingStateIndicator appointmentStatus="confirmed" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Estado: Confirmado'
      );
    });
  });

  describe('Combined State Logic', () => {
    it('shows hold_active when hasActiveHold is true', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          hasActiveHold={true}
        />
      );

      expect(screen.getByText('En Proceso')).toBeInTheDocument();
    });

    it('shows pending_deposit when depositStatus is required', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          depositStatus="required"
        />
      );

      expect(screen.getByText('Pendiente Depósito')).toBeInTheDocument();
    });

    it('shows pending_deposit when depositStatus is pending', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          depositStatus="pending"
        />
      );

      expect(screen.getByText('Pendiente Depósito')).toBeInTheDocument();
    });

    it('shows pending_confirmation when confirmationStatus is pending', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          confirmationStatus="pending"
        />
      );

      expect(screen.getByText('Pendiente Confirmar')).toBeInTheDocument();
    });

    it('prioritizes hold over deposit status', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          hasActiveHold={true}
          depositStatus="required"
        />
      );

      expect(screen.getByText('En Proceso')).toBeInTheDocument();
    });

    it('prioritizes deposit over confirmation status', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          depositStatus="required"
          confirmationStatus="pending"
        />
      );

      expect(screen.getByText('Pendiente Depósito')).toBeInTheDocument();
    });

    it('shows confirmed state correctly', () => {
      render(<BookingStateIndicator appointmentStatus="confirmed" />);

      expect(screen.getByText('Confirmado')).toBeInTheDocument();
    });

    it('shows in_progress state correctly', () => {
      render(<BookingStateIndicator appointmentStatus="in_progress" />);

      expect(screen.getByText('En Progreso')).toBeInTheDocument();
    });

    it('shows completed state correctly', () => {
      render(<BookingStateIndicator appointmentStatus="completed" />);

      expect(screen.getByText('Completado')).toBeInTheDocument();
    });

    it('shows no_show state correctly', () => {
      render(<BookingStateIndicator appointmentStatus="no_show" />);

      expect(screen.getByText('No Asistió')).toBeInTheDocument();
    });

    it('shows cancelled state correctly', () => {
      render(<BookingStateIndicator appointmentStatus="cancelled" />);

      expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      const { container } = render(
        <BookingStateIndicator appointmentStatus="scheduled" size="sm" />
      );

      // Check that the small text class is applied
      expect(container.querySelector('.text-xs')).toBeInTheDocument();
    });

    it('renders medium size correctly', () => {
      const { container } = render(
        <BookingStateIndicator appointmentStatus="scheduled" size="md" />
      );

      expect(container.querySelector('.text-sm')).toBeInTheDocument();
    });

    it('renders large size correctly', () => {
      const { container } = render(
        <BookingStateIndicator appointmentStatus="scheduled" size="lg" />
      );

      expect(container.querySelector('.text-base')).toBeInTheDocument();
    });
  });

  describe('Trust Badge', () => {
    it('does not show trust badge by default', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={85}
        />
      );

      // Shield icon should not be present without showTrustBadge
      expect(screen.queryByLabelText(/Nivel de confianza/)).not.toBeInTheDocument();
    });

    it('shows trust badge when showTrustBadge is true', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={85}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Nivel de confianza: Cliente Confiable/)).toBeInTheDocument();
    });

    it('shows correct trust level for trusted score (>=80)', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={80}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Cliente Confiable/)).toBeInTheDocument();
    });

    it('shows correct trust level for standard score (50-79)', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={60}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Cliente Estándar/)).toBeInTheDocument();
    });

    it('shows correct trust level for cautious score (30-49)', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={40}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Requiere Confirmación/)).toBeInTheDocument();
    });

    it('shows correct trust level for high_risk score (<30)', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={20}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Alto Riesgo/)).toBeInTheDocument();
    });

    it('shows score in trust badge title', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={85}
          showTrustBadge={true}
        />
      );

      const trustBadge = screen.getByLabelText(/Nivel de confianza/);
      expect(trustBadge).toHaveAttribute('title', 'Score: 85');
    });
  });

  describe('Additional Indicators', () => {
    it('shows pending confirmation indicator when confirmation is pending but not primary state', () => {
      // When hasActiveHold is true, combinedState becomes 'hold_active'
      // but confirmationStatus is still 'pending', so additional indicator should show
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          confirmationStatus="pending"
          hasActiveHold={true}
        />
      );

      // Primary state is hold_active, so pending confirmation shows as additional indicator
      expect(screen.getByLabelText('Confirmación pendiente')).toBeInTheDocument();
    });

    it('shows deposit required indicator when deposit is required but not primary state', () => {
      // When hasActiveHold is true, combinedState becomes 'hold_active'
      // but depositStatus is still 'required', so additional indicator should show
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          depositStatus="required"
          hasActiveHold={true}
        />
      );

      // Primary state is hold_active, so deposit required shows as additional indicator
      expect(screen.getByLabelText('Depósito requerido')).toBeInTheDocument();
    });

    it('does not show confirmation indicator when it is the primary state', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          confirmationStatus="pending"
        />
      );

      // Primary state is pending_confirmation, so no additional indicator
      expect(screen.queryByLabelText('Confirmación pendiente')).not.toBeInTheDocument();
    });

    it('does not show deposit indicator when it is the primary state', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          depositStatus="required"
        />
      );

      // Primary state is pending_deposit, so no additional indicator
      expect(screen.queryByLabelText('Depósito requerido')).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          className="custom-test-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-test-class');
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown appointment status gracefully', () => {
      render(<BookingStateIndicator appointmentStatus="unknown_status" />);

      // Should fall back to scheduled state
      expect(screen.getByText('Programado')).toBeInTheDocument();
    });

    it('handles empty string appointment status', () => {
      render(<BookingStateIndicator appointmentStatus="" />);

      // Should fall back to scheduled state
      expect(screen.getByText('Programado')).toBeInTheDocument();
    });

    it('handles all optional props as undefined', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          confirmationStatus={undefined}
          depositStatus={undefined}
          trustScore={undefined}
          hasActiveHold={undefined}
        />
      );

      expect(screen.getByText('Programado')).toBeInTheDocument();
    });

    it('handles trustScore of 0 correctly', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={0}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Alto Riesgo/)).toBeInTheDocument();
    });

    it('handles trustScore of exactly 80 (boundary)', () => {
      render(
        <BookingStateIndicator
          appointmentStatus="scheduled"
          trustScore={80}
          showTrustBadge={true}
        />
      );

      expect(screen.getByLabelText(/Cliente Confiable/)).toBeInTheDocument();
    });
  });
});

// ==============================================
// BOOKING STATE DOT TESTS
// ==============================================
describe('BookingStateDot', () => {
  describe('Rendering', () => {
    it('renders as a span element', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" />
      );

      expect(container.querySelector('span')).toBeInTheDocument();
    });

    it('has correct role and aria-label for accessibility', () => {
      render(<BookingStateDot appointmentStatus="scheduled" />);

      const dot = screen.getByRole('img');
      expect(dot).toHaveAttribute('aria-label', 'Programado');
    });

    it('has title attribute for tooltip', () => {
      render(<BookingStateDot appointmentStatus="confirmed" />);

      const dot = screen.getByRole('img');
      expect(dot).toHaveAttribute('title', 'Confirmado');
    });
  });

  describe('Color Mapping', () => {
    it('shows amber color for hold_active state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" hasActiveHold={true} />
      );

      expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
    });

    it('shows orange color for pending_confirmation state', () => {
      const { container } = render(
        <BookingStateDot
          appointmentStatus="scheduled"
          confirmationStatus="pending"
        />
      );

      expect(container.querySelector('.bg-orange-500')).toBeInTheDocument();
    });

    it('shows yellow color for pending_deposit state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" depositStatus="required" />
      );

      expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument();
    });

    it('shows green color for confirmed state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="confirmed" />
      );

      expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    });

    it('shows blue color for scheduled state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" />
      );

      expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
    });

    it('shows indigo color for in_progress state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="in_progress" />
      );

      expect(container.querySelector('.bg-indigo-500')).toBeInTheDocument();
    });

    it('shows emerald color for completed state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="completed" />
      );

      expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
    });

    it('shows red color for no_show state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="no_show" />
      );

      expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    });

    it('shows gray color for cancelled state', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="cancelled" />
      );

      expect(container.querySelector('.bg-gray-400')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size with w-2 h-2', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" size="sm" />
      );

      expect(container.querySelector('.w-2.h-2')).toBeInTheDocument();
    });

    it('renders medium size with w-2.5 h-2.5', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" size="md" />
      );

      expect(container.querySelector('.w-2\\.5.h-2\\.5')).toBeInTheDocument();
    });

    it('renders large size with w-3 h-3', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" size="lg" />
      );

      expect(container.querySelector('.w-3.h-3')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('does not animate by default', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" hasActiveHold={true} />
      );

      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });

    it('animates when animated=true and state is hold_active', () => {
      const { container } = render(
        <BookingStateDot
          appointmentStatus="scheduled"
          hasActiveHold={true}
          animated={true}
        />
      );

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('animates when animated=true and state is in_progress', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="in_progress" animated={true} />
      );

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('does not animate for scheduled state even when animated=true', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="scheduled" animated={true} />
      );

      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });

    it('does not animate for completed state even when animated=true', () => {
      const { container } = render(
        <BookingStateDot appointmentStatus="completed" animated={true} />
      );

      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <BookingStateDot
          appointmentStatus="scheduled"
          className="custom-dot-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-dot-class');
    });
  });

  describe('Combined State Priority', () => {
    it('prioritizes hasActiveHold over other statuses', () => {
      const { container } = render(
        <BookingStateDot
          appointmentStatus="confirmed"
          confirmationStatus="pending"
          depositStatus="required"
          hasActiveHold={true}
        />
      );

      // Should show amber for hold_active
      expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
    });

    it('prioritizes deposit status over confirmation status', () => {
      const { container } = render(
        <BookingStateDot
          appointmentStatus="scheduled"
          confirmationStatus="pending"
          depositStatus="required"
        />
      );

      // Should show yellow for pending_deposit
      expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument();
    });
  });
});
