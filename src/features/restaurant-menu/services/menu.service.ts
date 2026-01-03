// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Service
// API client for menu management system
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  MenuCategory,
  MenuItem,
  CategoryFormData,
  MenuItemFormData,
  MenuFilters,
  MenuStats,
  CategoriesResponse,
  CategoryResponse,
  MenuItemsResponse,
  MenuItemResponse,
  MenuStatsResponse,
} from '../types';

// ======================
// HELPER
// ======================
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ======================
// CATEGORIES
// ======================

export async function getCategories(includeInactive: boolean = false): Promise<CategoriesResponse> {
  const params = new URLSearchParams();
  if (includeInactive) params.set('include_inactive', 'true');

  const queryString = params.toString();
  const url = `/api/restaurant/menu/categories${queryString ? `?${queryString}` : ''}`;

  return fetchWithAuth(url);
}

export async function getCategory(id: string): Promise<CategoryResponse> {
  return fetchWithAuth(`/api/restaurant/menu/categories/${id}`);
}

export async function createCategory(data: CategoryFormData): Promise<CategoryResponse> {
  return fetchWithAuth('/api/restaurant/menu/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: string, data: Partial<CategoryFormData>): Promise<CategoryResponse> {
  return fetchWithAuth(`/api/restaurant/menu/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<{ success: boolean }> {
  return fetchWithAuth(`/api/restaurant/menu/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderCategories(
  updates: Array<{ id: string; display_order: number }>
): Promise<{ success: boolean }> {
  return fetchWithAuth('/api/restaurant/menu/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
}

// ======================
// MENU ITEMS
// ======================

export async function getMenuItems(
  filters: MenuFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<MenuItemsResponse> {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());

  if (filters.category_id) params.set('category_id', filters.category_id);
  if (filters.search) params.set('search', filters.search);
  if (filters.is_vegetarian) params.set('is_vegetarian', 'true');
  if (filters.is_vegan) params.set('is_vegan', 'true');
  if (filters.is_gluten_free) params.set('is_gluten_free', 'true');
  if (filters.is_available !== undefined) params.set('is_available', filters.is_available.toString());
  if (filters.min_price) params.set('min_price', filters.min_price.toString());
  if (filters.max_price) params.set('max_price', filters.max_price.toString());
  if (filters.is_featured) params.set('is_featured', 'true');

  return fetchWithAuth(`/api/restaurant/menu/items?${params}`);
}

export async function getMenuItem(id: string): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`);
}

export async function createMenuItem(data: MenuItemFormData): Promise<MenuItemResponse> {
  return fetchWithAuth('/api/restaurant/menu/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMenuItem(id: string, data: Partial<MenuItemFormData>): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteMenuItem(id: string): Promise<{ success: boolean }> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'DELETE',
  });
}

export async function toggleItemAvailability(id: string, isAvailable: boolean): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_available: isAvailable }),
  });
}

export async function reorderItems(
  updates: Array<{ id: string; display_order: number }>
): Promise<{ success: boolean }> {
  return fetchWithAuth('/api/restaurant/menu/items/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
}

export async function duplicateItem(id: string, newName: string): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ name: newName }),
  });
}

export async function bulkUpdateItems(
  ids: string[],
  updates: Partial<MenuItemFormData>
): Promise<{ success: boolean; updated: number }> {
  return fetchWithAuth('/api/restaurant/menu/items/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ ids, updates }),
  });
}

// ======================
// STATS
// ======================

export async function getMenuStats(): Promise<MenuStatsResponse> {
  return fetchWithAuth('/api/restaurant/menu/stats');
}

// ======================
// IMPORT/EXPORT
// ======================

export async function exportMenu(format: 'json' | 'csv' = 'json'): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(`/api/restaurant/menu/export?format=${format}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Error al exportar menú');
  }

  return response.blob();
}

export async function importMenu(file: File): Promise<{
  success: boolean;
  imported: { categories: number; items: number };
  errors: string[];
}> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/restaurant/menu/import', {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al importar menú');
  }

  return data;
}

// ======================
// QUICK ACTIONS
// ======================

export async function setItemOutOfStock(
  id: string,
  outOfStockUntil?: string
): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      is_available: false,
      out_of_stock_until: outOfStockUntil || null,
    }),
  });
}

export async function setItemInStock(id: string): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      is_available: true,
      out_of_stock_until: null,
    }),
  });
}

export async function updateItemPrice(
  id: string,
  price: number,
  priceLunch?: number,
  priceHappyHour?: number
): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      price,
      price_lunch: priceLunch || null,
      price_happy_hour: priceHappyHour || null,
    }),
  });
}

export async function toggleItemFeatured(id: string, isFeatured: boolean): Promise<MenuItemResponse> {
  return fetchWithAuth(`/api/restaurant/menu/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_featured: isFeatured }),
  });
}
