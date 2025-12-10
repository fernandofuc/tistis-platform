import { SupabaseClient } from '@supabase/supabase-js';
import { Component, ResolvedComponent } from './types';

/**
 * Resolves dependencies recursively, adding missing dependencies
 * and ordering components for correct deployment
 */
export async function resolveDependencies(
  supabase: SupabaseClient,
  components: Component[]
): Promise<ResolvedComponent[]> {
  console.log('[DependencyResolver] 🔗 Resolving dependencies...');

  const componentMap = new Map(components.map(c => [c.id, c]));
  const componentNameMap = new Map(components.map(c => [c.component_name, c]));
  const resolved: ResolvedComponent[] = [];
  const resolving = new Set<string>();
  const resolved_ids = new Set<string>();

  // Recursive function to resolve a component and its dependencies
  async function resolveComponent(component: Component): Promise<ResolvedComponent> {
    // Prevent cycles
    if (resolving.has(component.id)) {
      throw new Error(`Dependency cycle detected: ${component.component_name}`);
    }

    // Already resolved?
    const alreadyResolved = resolved.find(r => r.id === component.id);
    if (alreadyResolved) {
      return alreadyResolved;
    }

    resolving.add(component.id);

    const resolvedDeps: string[] = [];
    const missingDeps: string[] = [];

    // Resolve each dependency
    const dependencies = component.dependencies || [];
    for (const depName of dependencies) {
      let depComponent = componentNameMap.get(depName);

      if (!depComponent) {
        // Fetch from registry
        const { data: depFromRegistry } = await supabase
          .from('component_registry')
          .select('*')
          .eq('component_name', depName)
          .eq('is_active', true)
          .single();

        if (depFromRegistry) {
          console.log(`[DependencyResolver] ➕ Adding missing dependency: ${depName}`);
          depComponent = depFromRegistry;
          components.push(depFromRegistry);
          componentMap.set(depFromRegistry.id, depFromRegistry);
          componentNameMap.set(depFromRegistry.component_name, depFromRegistry);
        }
      }

      if (depComponent) {
        await resolveComponent(depComponent);
        resolvedDeps.push(depName);
      } else {
        console.warn(`[DependencyResolver] ⚠️ Dependency not found: ${depName}`);
        missingDeps.push(depName);
      }
    }

    const resolvedComponent: ResolvedComponent = {
      ...component,
      resolved_dependencies: resolvedDeps,
      missing_dependencies: missingDeps
    };

    if (!resolved_ids.has(component.id)) {
      resolved.push(resolvedComponent);
      resolved_ids.add(component.id);
    }

    resolving.delete(component.id);

    return resolvedComponent;
  }

  // Resolve all components
  for (const component of components) {
    await resolveComponent(component);
  }

  // Sort by deployment_order
  resolved.sort((a, b) => (a.deployment_order || 100) - (b.deployment_order || 100));

  // Log warnings for missing dependencies
  const criticalMissing = resolved.filter(c => c.missing_dependencies.length > 0);
  if (criticalMissing.length > 0) {
    console.warn('[DependencyResolver] ⚠️ Components with missing dependencies:',
      criticalMissing.map(c => ({
        name: c.component_name,
        missing: c.missing_dependencies
      }))
    );
  }

  console.log(`[DependencyResolver] ✅ Resolution complete: ${resolved.length} components`);

  return resolved;
}
