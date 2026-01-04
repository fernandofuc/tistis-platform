'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/auth';
import { useAppStore, useBranch } from '@/shared/stores';

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
  state: string | null;
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

  // Use the global Zustand store for branch selection (unified with Header/BranchSelector)
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const setBranchesStore = useAppStore((state) => state.setBranches);

  // Use ref to access current selectedBranchId without causing re-renders
  const selectedBranchIdRef = useRef(selectedBranchId);
  useEffect(() => {
    selectedBranchIdRef.current = selectedBranchId;
  }, [selectedBranchId]);

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
          .select('id, name, slug, city, state, is_headquarters, is_active')
          .eq('tenant_id', tenantData.id)
          .eq('is_active', true)
          .order('is_headquarters', { ascending: false });

        if (branchesData) {
          setBranches(branchesData);
          // Also sync to global Zustand store for Header/BranchSelector
          setBranchesStore(branchesData as any);

          // Only set default branch if none is selected yet in the global store
          // Use ref to get current value without causing dependency issues
          if (!selectedBranchIdRef.current) {
            const hq = branchesData.find(b => b.is_headquarters);
            if (hq) {
              setSelectedBranchId(hq.id);
            } else if (branchesData.length > 0) {
              setSelectedBranchId(branchesData[0].id);
            }
          }
        }

        // Load vertical config from local config instead of database
        // The vertical_configs table doesn't exist - use the local verticals.ts config
        // This prevents 400 errors in the console
        const { getVerticalConfig } = await import('@/src/shared/config/verticals');
        const localVerticalConfig = getVerticalConfig(tenantData.vertical);
        if (localVerticalConfig) {
          // Convert VerticalTerminology to Record<string, string>
          const terminologyRecord: Record<string, string> = {
            patient: localVerticalConfig.terminology.patient,
            patients: localVerticalConfig.terminology.patients,
            appointment: localVerticalConfig.terminology.appointment,
            appointments: localVerticalConfig.terminology.appointments,
            quote: localVerticalConfig.terminology.quote,
            quotes: localVerticalConfig.terminology.quotes,
            newPatient: localVerticalConfig.terminology.newPatient,
            newAppointment: localVerticalConfig.terminology.newAppointment,
            newQuote: localVerticalConfig.terminology.newQuote,
            patientList: localVerticalConfig.terminology.patientList,
            appointmentCalendar: localVerticalConfig.terminology.appointmentCalendar,
            todayAppointments: localVerticalConfig.terminology.todayAppointments,
            patientActive: localVerticalConfig.terminology.patientActive,
            patientInactive: localVerticalConfig.terminology.patientInactive,
          };

          setVerticalConfig({
            vertical_key: localVerticalConfig.id,
            display_name: localVerticalConfig.name,
            description: localVerticalConfig.description,
            icon: localVerticalConfig.icon,
            default_modules: localVerticalConfig.modules,
            terminology: terminologyRecord,
            settings_schema: {},
          });
        }
      }

    } catch (err) {
      console.error('Error loading tenant data:', err);
      setError('Error cargando datos del tenant');
    } finally {
      setIsLoading(false);
    }
    // selectedBranchIdRef.current is used instead of selectedBranchId to avoid infinite loops
  }, [setBranchesStore, setSelectedBranchId]);

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
        // Clear local state
        setTenant(null);
        setBranches([]);
        setUserRole(null);
        setVerticalConfig(null);
        // Clear global Zustand store
        setBranchesStore([]);
        setSelectedBranchId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadTenantData, setBranchesStore, setSelectedBranchId]);

  // Computed values
  const isSuperAdmin = userRole?.role === 'super_admin';
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'owner' || isSuperAdmin;
  const canManage = isAdmin || userRole?.role === 'manager';

  // Get terminology with fallbacks
  const terminology = {
    ...DEFAULT_TERMINOLOGY,
    ...(verticalConfig?.terminology || {}),
  };

  // Use the global store's setSelectedBranchId for switching
  const switchBranch = useCallback((branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setSelectedBranchId(branchId);
    }
  }, [branches, setSelectedBranchId]);

  // currentBranchId now reads from the global Zustand store
  // This unifies branch selection across Header, BranchSelector, and all pages
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
    currentBranchId: selectedBranchId,
  };
}

// Export types for use in other files
export type { Tenant, Branch, UserRole, VerticalConfig, TenantContextValue };
