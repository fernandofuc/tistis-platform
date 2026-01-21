// =====================================================
// TIS TIS PLATFORM - Menu Catalog Configuration
// Configure menu items, prices, and availability for Restaurant vertical
// Displays data from restaurant_menu_items table
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';
import Link from 'next/link';
import Image from 'next/image';

// ======================
// TYPES
// ======================

interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  item_count?: number;
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  price_lunch: number | null;
  price_happy_hour: number | null;
  currency: string;
  category_id: string;
  category?: {
    id: string;
    name: string;
  };
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_spicy: boolean;
  image_url: string | null;
  display_order: number;
}

interface MenuStats {
  total_categories: number;
  total_items: number;
  available_items: number;
  unavailable_items: number;
  featured_items: number;
  average_price: number;
  dietary_counts: {
    vegetarian: number;
    vegan: number;
    gluten_free: number;
  };
}

interface MenuCatalogConfigProps {
  className?: string;
}

// ======================
// ICONS
// ======================
const icons = {
  menu: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  utensils: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  chevronUp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
  star: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  leaf: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
    </svg>
  ),
  externalLink: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  image: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

// ======================
// COMPONENT
// ======================
export function MenuCatalogConfig({ className }: MenuCatalogConfigProps) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // ======================
  // DATA FETCHING
  // ======================
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchMenuData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();

      // Fetch categories, items, and stats in parallel
      const [categoriesRes, itemsRes, statsRes] = await Promise.all([
        fetch('/api/restaurant/menu/categories?include_items=true', { headers }),
        fetch('/api/restaurant/menu/items?limit=500', { headers }),
        fetch('/api/restaurant/menu/stats', { headers }),
      ]);

      if (!categoriesRes.ok) {
        const result = await categoriesRes.json();
        throw new Error(result.error || 'Error al cargar categorías');
      }

      if (!itemsRes.ok) {
        const result = await itemsRes.json();
        throw new Error(result.error || 'Error al cargar platillos');
      }

      const categoriesData = await categoriesRes.json();
      const itemsData = await itemsRes.json();
      const statsData = statsRes.ok ? await statsRes.json() : null;

      setCategories(categoriesData.categories || []);
      setItems(itemsData.items || []);
      setStats(statsData);

      // Expand all categories by default
      const categoryIds = new Set<string>(
        (categoriesData.categories || []).map((c: MenuCategory) => c.id)
      );
      setExpandedCategories(categoryIds);
    } catch (err) {
      console.error('[MenuCatalogConfig] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  // ======================
  // HANDLERS
  // ======================
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getItemsByCategory = (categoryId: string) => {
    return items.filter(item => item.category_id === categoryId);
  };

  const formatPrice = (price: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // ======================
  // RENDER: Loading State
  // ======================
  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        {/* Categories skeleton */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[1, 2].map((j) => (
                <div key={j} className="h-16 bg-gray-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ======================
  // RENDER: Error State
  // ======================
  if (error) {
    return (
      <div className={cn('', className)}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar el menú</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={fetchMenuData} variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // ======================
  // RENDER: Empty State
  // ======================
  if (categories.length === 0 && items.length === 0) {
    return (
      <div className={cn('', className)}>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {icons.menu}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Tu Menú está Vacío
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Aún no has agregado platillos a tu menú. Configura tu carta para que el asistente de IA
            pueda informar a tus clientes sobre tus deliciosos platillos.
          </p>
          <Link href="/dashboard/menu">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
              <span className="flex items-center gap-2">
                {icons.menu}
                Configurar Menú
              </span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ======================
  // RENDER: Main Content
  // ======================
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header con enlace a gestión completa */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Menú del Restaurante</h3>
          <p className="text-sm text-gray-500">
            Platillos y precios que el asistente usa para informar a clientes
          </p>
        </div>
        <Link href="/dashboard/menu">
          <Button variant="outline" className="gap-2">
            {icons.externalLink}
            Gestionar Menú
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Platillos */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <span className="text-amber-600">{icons.utensils}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total_items}</p>
                <p className="text-xs text-gray-500">Total Platillos</p>
              </div>
            </div>
          </motion.div>

          {/* Categorías */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600">{icons.menu}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total_categories}</p>
                <p className="text-xs text-gray-500">Categorías</p>
              </div>
            </div>
          </motion.div>

          {/* Disponibles */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600">{icons.check}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.available_items}</p>
                <p className="text-xs text-gray-500">Disponibles</p>
              </div>
            </div>
          </motion.div>

          {/* Precio Promedio */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">$</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(stats.average_price)}
                </p>
                <p className="text-xs text-gray-500">Precio Promedio</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Dietary Info Banner */}
      {stats && (stats.dietary_counts.vegetarian > 0 || stats.dietary_counts.vegan > 0 || stats.dietary_counts.gluten_free > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-green-800">Opciones Dietéticas:</span>
            {stats.dietary_counts.vegetarian > 0 && (
              <Badge variant="success" className="gap-1">
                {icons.leaf}
                {stats.dietary_counts.vegetarian} Vegetarianos
              </Badge>
            )}
            {stats.dietary_counts.vegan > 0 && (
              <Badge variant="success" className="gap-1">
                {icons.leaf}
                {stats.dietary_counts.vegan} Veganos
              </Badge>
            )}
            {stats.dietary_counts.gluten_free > 0 && (
              <Badge variant="info" className="gap-1">
                {stats.dietary_counts.gluten_free} Sin Gluten
              </Badge>
            )}
          </div>
        </motion.div>
      )}

      {/* Categories with Items */}
      <div className="space-y-4">
        {categories
          .filter(cat => cat.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((category, idx) => {
            const categoryItems = getItemsByCategory(category.id);
            const isExpanded = expandedCategories.has(category.id);
            const availableCount = categoryItems.filter(i => i.is_available).length;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                      <span className="text-amber-600 font-semibold text-sm">
                        {category.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-gray-900">{category.name}</h4>
                      <p className="text-xs text-gray-500">
                        {categoryItems.length} platillos • {availableCount} disponibles
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">
                      {isExpanded ? icons.chevronUp : icons.chevronDown}
                    </span>
                  </div>
                </button>

                {/* Category Items */}
                <AnimatePresence>
                  {isExpanded && categoryItems.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100"
                    >
                      <div className="p-4 space-y-3">
                        {categoryItems
                          .sort((a, b) => a.display_order - b.display_order)
                          .map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                'flex items-center gap-4 p-3 rounded-lg border transition-all',
                                item.is_available
                                  ? 'bg-white border-gray-100 hover:border-gray-200'
                                  : 'bg-gray-50 border-gray-100 opacity-60'
                              )}
                            >
                              {/* Item Image or Placeholder */}
                              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                                {item.image_url ? (
                                  <Image
                                    src={item.image_url}
                                    alt={item.name}
                                    fill
                                    sizes="56px"
                                    className="object-cover"
                                    unoptimized={item.image_url.includes('supabase') || item.image_url.includes('cloudinary')}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    {icons.image}
                                  </div>
                                )}
                              </div>

                              {/* Item Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-gray-900 truncate">
                                    {item.name}
                                  </h5>
                                  {item.is_featured && (
                                    <span className="text-amber-500" title="Destacado">
                                      {icons.star}
                                    </span>
                                  )}
                                  {item.is_vegetarian && (
                                    <span className="text-green-500" title="Vegetariano">
                                      {icons.leaf}
                                    </span>
                                  )}
                                </div>
                                {item.short_description && (
                                  <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {item.short_description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {!item.is_available && (
                                    <Badge variant="warning" size="sm">
                                      No disponible
                                    </Badge>
                                  )}
                                  {item.is_spicy && (
                                    <Badge variant="hot" size="sm">
                                      Picante
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Price */}
                              <div className="text-right flex-shrink-0">
                                <p className="font-semibold text-gray-900">
                                  {formatPrice(item.price, item.currency)}
                                </p>
                                {item.price_lunch && item.price_lunch !== item.price && (
                                  <p className="text-xs text-gray-500">
                                    Comida: {formatPrice(item.price_lunch, item.currency)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Empty Category */}
                {isExpanded && categoryItems.length === 0 && (
                  <div className="p-6 text-center text-gray-500 border-t border-gray-100">
                    <p className="text-sm">No hay platillos en esta categoría</p>
                  </div>
                )}
              </motion.div>
            );
          })}
      </div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h4 className="font-medium text-gray-900">
              ¿Necesitas actualizar tu menú?
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Edita precios, disponibilidad y agrega nuevos platillos desde la gestión de menú.
            </p>
          </div>
          <Link href="/dashboard/menu">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white whitespace-nowrap">
              <span className="flex items-center gap-2">
                {icons.externalLink}
                Ir a Gestión de Menú
              </span>
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default MenuCatalogConfig;
