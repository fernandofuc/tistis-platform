// =====================================================
// TIS TIS PLATFORM - Loyalty Integration
// Sprint 5: Setup Assistant module integrations
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { MessageAction } from '../types';

// =====================================================
// TYPES
// =====================================================

export interface CreateLoyaltyProgramInput {
  tenantId: string;
  name: string;
  description?: string;
  pointsPerCurrency?: number;
  tokensName?: string;
  tokensNamePlural?: string;
}

export interface CreateLoyaltyRewardInput {
  programId: string;
  name: string;
  description?: string;
  pointsCost: number;
  type: 'discount_percentage' | 'discount_fixed' | 'free_service' | 'gift' | 'upgrade' | 'custom';
  discountValue?: number;
  validDays?: number;
}

// =====================================================
// LOYALTY INTEGRATION CLASS
// =====================================================

export class LoyaltyIntegration {
  private supabase = createServerClient();

  // ======================
  // CREATE PROGRAM
  // ======================

  /**
   * Create a loyalty program for a tenant
   * Note: Each tenant can only have ONE loyalty program (unique constraint)
   */
  async createLoyaltyProgram(
    input: CreateLoyaltyProgramInput
  ): Promise<{ programId: string; actions: MessageAction[] }> {
    const actions: MessageAction[] = [];

    try {
      // Check if tenant already has a program
      const { data: existingProgram } = await this.supabase
        .from('loyalty_programs')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .single();

      if (existingProgram) {
        // Return existing program instead of creating new
        actions.push({
          type: 'configure',
          module: 'loyalty',
          entityType: 'loyalty_program',
          entityId: existingProgram.id,
          status: 'success',
          details: {
            message: 'Programa de lealtad existente encontrado',
            existingProgram: true,
          },
        });
        return { programId: existingProgram.id, actions };
      }

      // Create new program with correct column names
      const { data: program, error: programError } = await this.supabase
        .from('loyalty_programs')
        .insert({
          tenant_id: input.tenantId,
          program_name: input.name,
          program_description: input.description,
          tokens_per_currency: input.pointsPerCurrency || 1,
          tokens_name: input.tokensName || 'Puntos',
          tokens_name_plural: input.tokensNamePlural || 'Puntos',
          is_active: true,
          tokens_enabled: true,
          membership_enabled: true,
        })
        .select('id')
        .single();

      if (programError) throw programError;

      actions.push({
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_program',
        entityId: program.id,
        status: 'success',
        details: { name: input.name },
      });

      return { programId: program.id, actions };
    } catch (error) {
      console.error('[LoyaltyIntegration] Error creating program:', error);
      actions.push({
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_program',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error;
    }
  }

  // ======================
  // CREATE REWARD
  // ======================

  /**
   * Create a reward for a loyalty program
   */
  async createReward(input: CreateLoyaltyRewardInput): Promise<MessageAction> {
    try {
      const { data: reward, error } = await this.supabase
        .from('loyalty_rewards')
        .insert({
          program_id: input.programId,
          reward_name: input.name,
          reward_description: input.description,
          tokens_required: input.pointsCost,
          reward_type: input.type,
          discount_type: input.type === 'discount_percentage' ? 'percentage' :
                        input.type === 'discount_fixed' ? 'fixed' : null,
          discount_value: input.discountValue,
          valid_days: input.validDays || 30,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_reward',
        entityId: reward.id,
        status: 'success',
        details: { name: input.name, pointsCost: input.pointsCost },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'loyalty',
        entityType: 'loyalty_reward',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ======================
  // CREATE COMPLETE PROGRAM
  // ======================

  /**
   * Create a complete loyalty program with default rewards based on vertical
   * Note: Tiers are managed via tier field in loyalty_balances, not a separate table
   */
  async createCompleteProgram(
    tenantId: string,
    programName: string,
    vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym'
  ): Promise<MessageAction[]> {
    const actions: MessageAction[] = [];

    // Create program
    const { programId, actions: programActions } = await this.createLoyaltyProgram({
      tenantId,
      name: programName,
      description: this.getVerticalDescription(vertical),
      pointsPerCurrency: vertical === 'restaurant' ? 10 : 1,
      tokensName: vertical === 'restaurant' ? 'Puntos' : 'Puntos',
      tokensNamePlural: vertical === 'restaurant' ? 'Puntos' : 'Puntos',
    });

    actions.push(...programActions);

    // Create default rewards based on vertical
    const rewards = this.getDefaultRewards(vertical);

    for (const reward of rewards) {
      const rewardAction = await this.createReward({
        programId,
        ...reward,
      });
      actions.push(rewardAction);
    }

    return actions;
  }

  // ======================
  // HELPER METHODS
  // ======================

  /**
   * Get vertical-specific description
   */
  private getVerticalDescription(vertical: string): string {
    const descriptions: Record<string, string> = {
      restaurant: 'Gana puntos con cada compra y canjealos por recompensas exclusivas',
      dental: 'Acumula puntos en tus consultas y obtén beneficios exclusivos',
      clinic: 'Recibe puntos por cada visita y disfruta de beneficios especiales',
      beauty: 'Acumula puntos con cada servicio y obtén tratamientos gratis',
      veterinary: 'Gana puntos cuidando a tu mascota y recibe recompensas',
      gym: 'Acumula puntos por tu dedicación y obtén beneficios exclusivos',
    };
    return descriptions[vertical] || descriptions.dental;
  }

  /**
   * Get default rewards for a vertical
   */
  private getDefaultRewards(vertical: string): Array<{
    name: string;
    description?: string;
    pointsCost: number;
    type: CreateLoyaltyRewardInput['type'];
    discountValue?: number;
  }> {
    const rewardsByVertical: Record<string, Array<{
      name: string;
      description?: string;
      pointsCost: number;
      type: CreateLoyaltyRewardInput['type'];
      discountValue?: number;
    }>> = {
      restaurant: [
        { name: '10% de descuento', pointsCost: 100, type: 'discount_percentage', discountValue: 10 },
        { name: 'Postre gratis', pointsCost: 200, type: 'free_service', description: 'Un postre a elegir del menú' },
        { name: '20% de descuento', pointsCost: 400, type: 'discount_percentage', discountValue: 20 },
      ],
      dental: [
        { name: 'Limpieza con 20% desc.', pointsCost: 150, type: 'discount_percentage', discountValue: 20 },
        { name: 'Consulta gratis', pointsCost: 300, type: 'free_service', description: 'Consulta de valoración sin costo' },
        { name: 'Blanqueamiento 30% desc.', pointsCost: 500, type: 'discount_percentage', discountValue: 30 },
      ],
      clinic: [
        { name: 'Consulta con 15% desc.', pointsCost: 100, type: 'discount_percentage', discountValue: 15 },
        { name: 'Estudio de laboratorio gratis', pointsCost: 300, type: 'free_service' },
        { name: '25% en tratamientos', pointsCost: 500, type: 'discount_percentage', discountValue: 25 },
      ],
      beauty: [
        { name: '15% de descuento', pointsCost: 100, type: 'discount_percentage', discountValue: 15 },
        { name: 'Tratamiento facial gratis', pointsCost: 350, type: 'free_service' },
        { name: '30% en servicios premium', pointsCost: 600, type: 'discount_percentage', discountValue: 30 },
      ],
      veterinary: [
        { name: 'Vacuna con 20% desc.', pointsCost: 150, type: 'discount_percentage', discountValue: 20 },
        { name: 'Baño gratis', pointsCost: 250, type: 'free_service' },
        { name: '25% en consultas', pointsCost: 400, type: 'discount_percentage', discountValue: 25 },
      ],
      gym: [
        { name: '1 semana gratis', pointsCost: 200, type: 'free_service', description: 'Una semana adicional de membresía' },
        { name: 'Clase personal gratis', pointsCost: 300, type: 'free_service' },
        { name: '30% en renovación', pointsCost: 500, type: 'discount_percentage', discountValue: 30 },
      ],
    };

    return rewardsByVertical[vertical] || rewardsByVertical.dental;
  }

  // ======================
  // GET PROGRAM STATUS
  // ======================

  /**
   * Get loyalty program status for a tenant
   */
  async getProgramStatus(tenantId: string): Promise<{
    hasProgram: boolean;
    programId?: string;
    programName?: string;
    rewardsCount?: number;
    isActive?: boolean;
  }> {
    try {
      const { data: program } = await this.supabase
        .from('loyalty_programs')
        .select(`
          id,
          program_name,
          is_active,
          loyalty_rewards(count)
        `)
        .eq('tenant_id', tenantId)
        .single();

      if (!program) {
        return { hasProgram: false };
      }

      // Supabase returns count in nested structure
      const loyaltyRewards = program.loyalty_rewards as Array<{ count: number }> | undefined;
      const rewardsCount = loyaltyRewards?.[0]?.count || 0;

      return {
        hasProgram: true,
        programId: program.id,
        programName: program.program_name,
        rewardsCount,
        isActive: program.is_active,
      };
    } catch {
      return { hasProgram: false };
    }
  }
}

// Singleton instance export
export const loyaltyIntegration = new LoyaltyIntegration();
