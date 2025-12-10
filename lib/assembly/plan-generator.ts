import {
  ClientConfig,
  ResolvedComponent,
  DeploymentPlan,
  DeploymentStep,
  DashboardWidget
} from './types';

interface PlanGeneratorInput {
  requestId: string;
  clientConfig: ClientConfig;
  proposal?: {
    id: string;
    clients?: { business_name?: string };
    recommended_plan?: string;
  } | null;
  subscription_id?: string | null;
  components: ResolvedComponent[];
}

/**
 * Generates a complete deployment plan from selected components
 */
export async function generateDeploymentPlan(
  input: PlanGeneratorInput
): Promise<DeploymentPlan> {
  const { requestId, clientConfig, proposal, subscription_id, components } = input;

  console.log(`[PlanGenerator ${requestId}] 📝 Generating deployment plan...`);

  // 1. Generate deployment steps
  const deploymentSteps: DeploymentStep[] = components.map((component, index) => ({
    order: index + 1,
    component_id: component.id,
    component_name: component.component_name,
    action: determineAction(component),
    config: mergeConfig(component.config_template, clientConfig),
    dependencies_met: component.missing_dependencies.length === 0,
    estimated_minutes: component.estimated_setup_minutes || 5,
    requires_manual: (component.estimated_setup_minutes || 0) > 15,
    manual_instructions: component.setup_instructions || undefined
  }));

  // 2. Database setup
  const databaseSetup = {
    tables_to_create: [] as Array<{ name: string; schema: string; source_component: string }>,
    rls_policies: generateRLSPolicies(components, clientConfig),
    seed_data: [] as Array<{ table: string; data: Record<string, unknown>[] }>
  };

  // 3. n8n setup
  const n8nSetup = {
    workflows_to_import: components
      .filter(c => c.workflow_file)
      .map(c => ({
        workflow_id: c.workflow_file!,
        name: `${c.component_display_name} - Workflow`,
        source_component: c.component_name,
        variables_to_set: {
          CLIENT_ID: clientConfig.client_id,
          VERTICAL: clientConfig.vertical,
          PLAN: clientConfig.plan,
          BRANCHES: String(clientConfig.branches || 1)
        }
      })),
    credentials_needed: generateCredentialsNeeded(components)
  };

  // 4. Dashboard setup
  const dashboardSetup = {
    widgets: generateWidgets(components, clientConfig),
    navigation: generateNavigation(clientConfig.vertical)
  };

  // 5. Feature flags setup
  const featureFlagsSetup = {
    flags: components.flatMap(c =>
      (c.feature_flags || []).map(flag => ({
        key: flag,
        enabled: clientConfig.feature_overrides[flag] !== false,
        source: c.component_name
      }))
    )
  };

  // 6. Post deployment
  const manualSteps = deploymentSteps.filter(s => s.requires_manual);
  const postDeployment = {
    verification_checks: generateVerificationChecks(components, clientConfig),
    client_notifications: [
      {
        type: 'email' as const,
        template: 'deployment_complete',
        variables: {
          client_name: proposal?.clients?.business_name || 'Cliente',
          plan_name: clientConfig.plan,
          dashboard_url: `${process.env.NEXT_PUBLIC_URL || ''}/dashboard`
        }
      },
      {
        type: 'whatsapp' as const,
        template: 'deployment_welcome',
        variables: {
          client_name: proposal?.clients?.business_name || 'Cliente'
        }
      }
    ]
  };

  // Calculate totals
  const totalMinutes = deploymentSteps.reduce((sum, step) => sum + step.estimated_minutes, 0);

  const plan: DeploymentPlan = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    client_id: clientConfig.client_id,
    proposal_id: proposal?.id || null,
    subscription_id: subscription_id || null,

    summary: {
      vertical: clientConfig.vertical,
      plan: clientConfig.plan,
      total_components: components.length,
      estimated_total_minutes: totalMinutes,
      requires_manual_steps: manualSteps.length > 0,
      manual_steps_count: manualSteps.length
    },

    deployment_steps: deploymentSteps,
    database_setup: databaseSetup,
    n8n_setup: n8nSetup,
    dashboard_setup: dashboardSetup,
    feature_flags_setup: featureFlagsSetup,
    post_deployment: postDeployment
  };

  console.log(`[PlanGenerator ${requestId}] ✅ Plan generated:`, {
    components: plan.summary.total_components,
    minutes: plan.summary.estimated_total_minutes,
    manual: plan.summary.manual_steps_count
  });

  return plan;
}

// Helper functions

function determineAction(component: ResolvedComponent): 'install' | 'configure' | 'activate' | 'connect' {
  switch (component.component_type) {
    case 'core':
      return 'install';
    case 'integration':
      return 'connect';
    case 'addon':
      return 'activate';
    default:
      return 'configure';
  }
}

function mergeConfig(
  configTemplate: { required_vars: string[]; optional_vars: string[] },
  clientConfig: ClientConfig
): Record<string, unknown> {
  return {
    client_id: clientConfig.client_id,
    vertical: clientConfig.vertical,
    plan: clientConfig.plan,
    branches: clientConfig.branches || 1,
    required_vars: configTemplate.required_vars,
    optional_vars: configTemplate.optional_vars
  };
}

function generateRLSPolicies(
  components: ResolvedComponent[],
  config: ClientConfig
): Array<{ table: string; policy_name: string; definition: string }> {
  // Generate RLS policies for feature flags
  return [{
    table: 'feature_flags',
    policy_name: 'client_feature_flags_isolation',
    definition: `client_id = '${config.client_id}'::uuid`
  }];
}

function generateCredentialsNeeded(
  components: ResolvedComponent[]
): Array<{ type: string; name: string; required_fields: string[] }> {
  const credentials: Array<{ type: string; name: string; required_fields: string[] }> = [];

  for (const component of components) {
    if (component.component_type === 'integration') {
      credentials.push({
        type: component.component_name,
        name: component.component_display_name,
        required_fields: component.config_template.required_vars
      });
    }
  }

  return credentials;
}

function generateWidgets(
  components: ResolvedComponent[],
  config: ClientConfig
): DashboardWidget[] {
  const widgets: DashboardWidget[] = [];
  let position = { x: 0, y: 0 };

  for (const component of components) {
    const componentWidgets = component.dashboard_widgets || [];
    for (const widget of componentWidgets) {
      widgets.push({
        ...widget,
        widget_id: `${config.client_id}_${widget.widget_id}`,
        position: {
          x: position.x,
          y: position.y,
          w: 6,
          h: 4
        }
      });

      position.x += 6;
      if (position.x >= 12) {
        position.x = 0;
        position.y += 4;
      }
    }
  }

  return widgets;
}

function generateNavigation(vertical: string): Array<{
  id: string;
  label: string;
  icon: string;
  path: string;
  order: number;
}> {
  const baseNav = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', order: 1 }
  ];

  const verticalNav: Record<string, Array<{ id: string; label: string; icon: string; path: string; order: number }>> = {
    dental: [
      { id: 'patients', label: 'Pacientes', icon: 'Users', path: '/dashboard/patients', order: 2 },
      { id: 'appointments', label: 'Citas', icon: 'Calendar', path: '/dashboard/appointments', order: 3 },
      { id: 'quotes', label: 'Presupuestos', icon: 'FileText', path: '/dashboard/quotes', order: 4 },
      { id: 'treatments', label: 'Tratamientos', icon: 'Stethoscope', path: '/dashboard/treatments', order: 5 }
    ],
    clinic: [
      { id: 'patients', label: 'Pacientes', icon: 'Users', path: '/dashboard/patients', order: 2 },
      { id: 'appointments', label: 'Citas', icon: 'Calendar', path: '/dashboard/appointments', order: 3 },
      { id: 'records', label: 'Expedientes', icon: 'FileText', path: '/dashboard/records', order: 4 }
    ],
    restaurant: [
      { id: 'menu', label: 'Menú', icon: 'UtensilsCrossed', path: '/dashboard/menu', order: 2 },
      { id: 'orders', label: 'Pedidos', icon: 'ShoppingBag', path: '/dashboard/orders', order: 3 },
      { id: 'inventory', label: 'Inventario', icon: 'Package', path: '/dashboard/inventory', order: 4 },
      { id: 'reservations', label: 'Reservaciones', icon: 'Calendar', path: '/dashboard/reservations', order: 5 }
    ]
  };

  return [
    ...baseNav,
    ...(verticalNav[vertical] || []),
    { id: 'settings', label: 'Configuración', icon: 'Settings', path: '/dashboard/settings', order: 99 }
  ];
}

function generateVerificationChecks(
  components: ResolvedComponent[],
  config: ClientConfig
): Array<{ name: string; type: 'api' | 'database' | 'ui' | 'integration'; endpoint_or_query: string; expected_result: string }> {
  return [
    {
      name: 'Feature flags configured',
      type: 'database',
      endpoint_or_query: `SELECT COUNT(*) FROM feature_flags WHERE client_id = '${config.client_id}'`,
      expected_result: `>= ${components.flatMap(c => c.feature_flags || []).length}`
    },
    {
      name: 'Dashboard accessible',
      type: 'ui',
      endpoint_or_query: `/dashboard`,
      expected_result: 'HTTP 200'
    },
    {
      name: 'API health check',
      type: 'api',
      endpoint_or_query: `/api/health`,
      expected_result: '{"status": "healthy"}'
    }
  ];
}
