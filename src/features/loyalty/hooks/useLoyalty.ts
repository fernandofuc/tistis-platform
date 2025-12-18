// =====================================================
// TIS TIS PLATFORM - Loyalty Hook
// React hook for loyalty system state management
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import * as loyaltyService from '../services/loyalty.service';
import type {
  LoyaltyProgram,
  LoyaltyStats,
  TokenRule,
  LoyaltyReward,
  MembershipPlan,
  MessageTemplate,
} from '../types';

// ======================
// LOYALTY PROGRAM HOOK
// ======================
export function useLoyaltyProgram() {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgram = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loyaltyService.getProgram();
      setProgram(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar programa');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProgram = useCallback(async (updates: Partial<LoyaltyProgram>) => {
    try {
      setError(null);
      const updated = await loyaltyService.updateProgram(updates);
      setProgram(updated);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar programa';
      setError(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  return {
    program,
    loading,
    error,
    refresh: fetchProgram,
    updateProgram,
  };
}

// ======================
// LOYALTY STATS HOOK
// ======================
export function useLoyaltyStats(period: number = 30) {
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loyaltyService.getStats(period);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}

// ======================
// TOKEN RULES HOOK
// ======================
export function useTokenRules() {
  const [rules, setRules] = useState<TokenRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loyaltyService.getTokenRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reglas');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRule = useCallback(async (rule: Partial<TokenRule>) => {
    const newRule = await loyaltyService.createTokenRule(rule);
    setRules((prev) => [...prev, newRule]);
    return newRule;
  }, []);

  const updateRule = useCallback(async (id: string, updates: Partial<TokenRule>) => {
    const updated = await loyaltyService.updateTokenRule(id, updates);
    setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    await loyaltyService.deleteTokenRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    loading,
    error,
    refresh: fetchRules,
    createRule,
    updateRule,
    deleteRule,
  };
}

// ======================
// REWARDS HOOK
// ======================
export function useRewards(includeInactive: boolean = false) {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loyaltyService.getRewards(includeInactive);
      setRewards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar recompensas');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  const createReward = useCallback(async (reward: Partial<LoyaltyReward>) => {
    const newReward = await loyaltyService.createReward(reward);
    setRewards((prev) => [...prev, newReward]);
    return newReward;
  }, []);

  const updateReward = useCallback(async (id: string, updates: Partial<LoyaltyReward>) => {
    const updated = await loyaltyService.updateReward(id, updates);
    setRewards((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteReward = useCallback(async (id: string) => {
    await loyaltyService.deleteReward(id);
    setRewards((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  return {
    rewards,
    loading,
    error,
    refresh: fetchRewards,
    createReward,
    updateReward,
    deleteReward,
  };
}

// ======================
// MEMBERSHIP PLANS HOOK
// ======================
export function useMembershipPlans(includeInactive: boolean = false) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loyaltyService.getMembershipPlans(includeInactive);
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  const createPlan = useCallback(async (plan: Partial<MembershipPlan>) => {
    const newPlan = await loyaltyService.createMembershipPlan(plan);
    setPlans((prev) => [...prev, newPlan]);
    return newPlan;
  }, []);

  const updatePlan = useCallback(async (id: string, updates: Partial<MembershipPlan>) => {
    const updated = await loyaltyService.updateMembershipPlan(id, updates);
    setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    await loyaltyService.deleteMembershipPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    loading,
    error,
    refresh: fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
  };
}

// ======================
// MESSAGE TEMPLATES HOOK
// ======================
export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loyaltyService.getMessageTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (template: Partial<MessageTemplate>) => {
    const newTemplate = await loyaltyService.createMessageTemplate(template);
    setTemplates((prev) => [...prev, newTemplate]);
    return newTemplate;
  }, []);

  const updateTemplate = useCallback(async (id: string, updates: Partial<MessageTemplate>) => {
    const updated = await loyaltyService.updateMessageTemplate(id, updates);
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    await loyaltyService.deleteMessageTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refresh: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
