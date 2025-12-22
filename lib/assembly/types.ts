// Assembly Engine Types

export interface Component {
  id: string;
  component_name: string;
  component_display_name: string;
  component_description: string;
  component_type: 'core' | 'plan_feature' | 'vertical_module' | 'addon' | 'integration';
  vertical_applicable: string[] | null;
  min_plan_required: string | null;
  workflow_file: string | null;
  dependencies: string[];
  config_template: {
    required_vars: string[];
    optional_vars: string[];
  };
  feature_flags: string[];
  dashboard_widgets: DashboardWidget[];
  setup_instructions: string | null;
  estimated_setup_minutes: number;
  deployment_order: number;
  is_active: boolean;
  is_deprecated: boolean;
}

export interface DashboardWidget {
  widget_id: string;
  widget_name: string;
  widget_type: string;
  size: string;
  position?: { x: number; y: number; w: number; h: number };
}

export interface ClientConfig {
  client_id: string;
  vertical: string;
  plan: 'starter' | 'essentials' | 'growth';
  addons: string[];
  legacy_system: string | null;
  custom_requirements: string[];
  feature_overrides: Record<string, boolean>;
  branches?: number;
}

export interface ResolvedComponent extends Component {
  resolved_dependencies: string[];
  missing_dependencies: string[];
}

export interface DeploymentStep {
  order: number;
  component_id: string;
  component_name: string;
  action: 'install' | 'configure' | 'activate' | 'connect';
  config: Record<string, unknown>;
  dependencies_met: boolean;
  estimated_minutes: number;
  requires_manual: boolean;
  manual_instructions?: string;
}

export interface DeploymentPlan {
  version: '1.0';
  generated_at: string;
  client_id: string;
  proposal_id: string | null;
  subscription_id: string | null;

  summary: {
    vertical: string;
    plan: string;
    total_components: number;
    estimated_total_minutes: number;
    requires_manual_steps: boolean;
    manual_steps_count: number;
  };

  deployment_steps: DeploymentStep[];

  database_setup: {
    tables_to_create: Array<{ name: string; schema: string; source_component: string }>;
    rls_policies: Array<{ table: string; policy_name: string; definition: string }>;
    seed_data: Array<{ table: string; data: Record<string, unknown>[] }>;
  };

  n8n_setup: {
    workflows_to_import: Array<{
      workflow_id: string;
      name: string;
      source_component: string;
      variables_to_set: Record<string, string>;
    }>;
    credentials_needed: Array<{
      type: string;
      name: string;
      required_fields: string[];
    }>;
  };

  dashboard_setup: {
    widgets: DashboardWidget[];
    navigation: Array<{
      id: string;
      label: string;
      icon: string;
      path: string;
      order: number;
    }>;
  };

  feature_flags_setup: {
    flags: Array<{
      key: string;
      enabled: boolean;
      source: string;
    }>;
  };

  post_deployment: {
    verification_checks: Array<{
      name: string;
      type: 'api' | 'database' | 'ui' | 'integration';
      endpoint_or_query: string;
      expected_result: string;
    }>;
    client_notifications: Array<{
      type: 'email' | 'whatsapp' | 'sms';
      template: string;
      variables: Record<string, string>;
    }>;
  };
}

export interface AssembleRequest {
  proposal_id?: string;
  client_id: string;
  subscription_id?: string;
  vertical: string;
  plan: 'starter' | 'essentials' | 'growth';
  addons?: string[];
  branches?: number;
  legacy_system?: string;
  custom_requirements?: string[];
  feature_overrides?: Record<string, boolean>;
}

export interface AssemblyResult {
  success: boolean;
  data?: {
    deployment_id: string;
    deployment_plan: DeploymentPlan;
    components_count: number;
    estimated_duration_minutes: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  };
  error?: string;
  message?: string;
  requestId: string;
}
