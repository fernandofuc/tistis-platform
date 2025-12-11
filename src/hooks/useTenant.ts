'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/auth';

// Types for tenant data
interface Tenant {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  plan: string;
  status: string;
  settings: Record<string, any>;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
}

interface Branch {
  id: string;
  name: string;
  slug: string;
  city: string;
  is_headquarters: boolean;
  is_active: boolean;
}

interface UserRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
}

interface VerticalConfig {
  vertical_key: string;
  display_name: string;
  description: string;
  icon: string;
  default_modules: string[];
  terminology: Record<string, string>;
  settings_schema: Record<string, any>;
}

interface TenantContextValue {
  // Data
  tenant: Tenant | null;
  branches: Branch[];
  userRole: UserRole | null;
  verticalConfig: VerticalConfig | null;

  // State
  isLoading: boolean;
  error: string | null;

  // Helpers
  isSuperAdmin: boolean;
  isAdmin: boolean;
  canManage: boolean;
  terminology: Record<string, string>;

  // Actions
  refreshTenant: () => Promise<void>;
  switchBranch: (branchId: string) => void;
  currentBranchId: string | null;
}

// Default terminology for fallback
const DEFAULT_TERMINOLOGY: Record<string, string> = {
  patient: 'Cliente',
  appointment: 'Cita',
  service: 'Servicio',
  quote: 'Cotización',
  lead: 'Prospecto',
};

// Hook to get current tenant context
export function useTenant(): TenantContextValue {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [verticalConfig, setVerticalConfig] = useState<VerticalConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const loadTenantData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('No authenticated user');
        setIsLoading(false);
        return;
      }

      // Get user's role and tenant
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          tenant_id,
          role,
          is_active,
          tenants (
            id,
            name,
            slug,
            vertical,
            plan,
            status,
            settings,
            primary_contact_name,
            primary_contact_email
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        setError('No se pudo cargar el rol del usuario');
        setIsLoading(false);
        return;
      }

      if (!roleData) {
        setError('Usuario sin rol asignado');
        setIsLoading(false);
        return;
      }

      // Set user role
      setUserRole({
        id: roleData.id,
        user_id: roleData.user_id,
        tenant_id: roleData.tenant_id,
        role: roleData.role,
        is_active: roleData.is_active,
      });

      // Set tenant data
      const tenantData = roleData.tenants as any;
      if (tenantData) {
        setTenant({
          id: tenantData.id,
          name: tenantData.name,
          slug: tenantData.slug,
          vertical: tenantData.vertical,
          plan: tenantData.plan,
          status: tenantData.status,
          settings: tenantData.settings || {},
          primary_contact_name: tenantData.primary_contact_name,
          primary_contact_email: tenantData.primary_contact_email,
        });

        // Load branches for this tenant
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name, slug, city, is_headquarters, is_active')
          .eq('tenant_id', tenantData.id)
          .eq('is_active', true)
          .order('is_headquarters', { ascending: false });

        if (branchesData) {
          setBranches(branchesData);
          // Set headquarters as default branch
          const hq = branchesData.find(b => b.is_headquarters);
          if (hq) {
            setCurrentBranchId(hq.id);
          } else if (branchesData.length > 0) {
            setCurrentBranchId(branchesData[0].id);
          }
        }

        // Load vertical config
        const { data: verticalData } = await supabase
          .from('vertical_configs')
          .select('*')
          .eq('vertical_key', tenantData.vertical)
          .single();

        if (verticalData) {
          setVerticalConfig(verticalData);
        }
      }

    } catch (err) {
      console.error('Error loading tenant data:', err);
      setError('Error cargando datos del tenant');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadTenantData();
  }, [loadTenantData]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadTenantData();
      } else if (event === 'SIGNED_OUT') {
        setTenant(null);
        setBranches([]);
        setUserRole(null);
        setVerticalConfig(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadTenantData]);

  // Computed values
  const isSuperAdmin = userRole?.role === 'super_admin';
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'owner' || isSuperAdmin;
  const canManage = isAdmin || userRole?.role === 'manager';

  // Get terminology with fallbacks
  const terminology = {
    ...DEFAULT_TERMINOLOGY,
    ...(verticalConfig?.terminology || {}),
  };

  const switchBranch = useCallback((branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setCurrentBranchId(branchId);
    }
  }, [branches]);

  return {
    tenant,
    branches,
    userRole,
    verticalConfig,
    isLoading,
    error,
    isSuperAdmin,
    isAdmin,
    canManage,
    terminology,
    refreshTenant: loadTenantData,
    switchBranch,
    currentBranchId,
  };
}

// Export types for use in other files
export type { Tenant, Branch, UserRole, VerticalConfig, TenantContextValue };
