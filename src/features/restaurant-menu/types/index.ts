// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Types
// Type definitions for the menu management system
// =====================================================

// ======================
// ALLERGENS
// ======================
export type Allergen =
  | 'gluten'
  | 'nuts'
  | 'dairy'
  | 'shellfish'
  | 'eggs'
  | 'soy'
  | 'fish'
  | 'peanuts'
  | 'sesame'
  | 'celery'
  | 'mustard'
  | 'sulfites';

// ======================
// MENU CATEGORY
// ======================
export interface MenuCategory {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  available_times: {
    all_day?: boolean;
    breakfast?: boolean;
    lunch?: boolean;
    dinner?: boolean;
    start_time?: string;
    end_time?: string;
  };
  available_days: string[];
  icon: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  items?: MenuItem[];
  items_count?: number;
  parent?: MenuCategory | null;
  children?: MenuCategory[];
}

// ======================
// MENU ITEM
// ======================
export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  price_lunch: number | null;
  price_happy_hour: number | null;
  currency: string;
  variants: MenuItemVariant[];
  sizes: MenuItemSize[];
  add_ons: MenuItemAddOn[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  allergens: Allergen[];
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_spicy: boolean;
  spice_level: number | null;
  is_house_special: boolean;
  is_chef_recommendation: boolean;
  is_new: boolean;
  prep_time_minutes: number | null;
  cooking_instructions: string | null;
  image_url: string | null;
  image_gallery: string[];
  is_available: boolean;
  available_quantity: number | null;
  out_of_stock_until: string | null;
  display_order: number;
  is_featured: boolean;
  times_ordered: number;
  average_rating: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  category?: MenuCategory;
}

// ======================
// VARIANT, SIZE, ADD-ON
// ======================
export interface MenuItemVariant {
  name: string;
  price: number;
  description?: string;
  is_default?: boolean;
}

export interface MenuItemSize {
  name: string;
  price: number;
  description?: string;
}

export interface MenuItemAddOn {
  name: string;
  price: number;
  max_qty?: number;
  description?: string;
}

// ======================
// FORM DATA
// ======================
export interface CategoryFormData {
  branch_id: string;  // Required for API
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string | null;
  available_times?: {
    all_day?: boolean;
    breakfast?: boolean;
    lunch?: boolean;
    dinner?: boolean;
    start_time?: string;
    end_time?: string;
  };
  available_days?: string[];
  icon?: string;
  image_url?: string;
  is_active?: boolean;
  is_featured?: boolean;
}

export interface MenuItemFormData {
  category_id: string;
  name: string;
  slug?: string;
  description?: string;
  short_description?: string;
  price: number;
  price_lunch?: number | null;
  price_happy_hour?: number | null;
  variants?: MenuItemVariant[];
  sizes?: MenuItemSize[];
  add_ons?: MenuItemAddOn[];
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  allergens?: Allergen[];
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  is_spicy?: boolean;
  spice_level?: number | null;
  is_house_special?: boolean;
  is_chef_recommendation?: boolean;
  is_new?: boolean;
  prep_time_minutes?: number | null;
  cooking_instructions?: string;
  image_url?: string;
  image_gallery?: string[];
  is_available?: boolean;
  available_quantity?: number | null;
  is_featured?: boolean;
}

// ======================
// FILTERS
// ======================
export interface MenuFilters {
  category_id?: string;
  search?: string;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  is_available?: boolean;
  min_price?: number;
  max_price?: number;
  is_featured?: boolean;
}

// ======================
// STATS
// ======================
export interface MenuStats {
  total_categories: number;
  total_items: number;
  available_items: number;
  unavailable_items: number;
  featured_items: number;
  average_price: number;
  most_ordered: Array<{
    id: string;
    name: string;
    times_ordered: number;
    image_url: string | null;
  }>;
  categories_breakdown: Array<{
    id: string;
    name: string;
    items_count: number;
  }>;
  dietary_counts: {
    vegetarian: number;
    vegan: number;
    gluten_free: number;
  };
}

// ======================
// API RESPONSES
// ======================
export interface CategoriesResponse {
  success: boolean;
  data: MenuCategory[];
  error?: string;
}

export interface CategoryResponse {
  success: boolean;
  data: MenuCategory;
  error?: string;
}

export interface MenuItemsResponse {
  success: boolean;
  data: {
    items: MenuItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface MenuItemResponse {
  success: boolean;
  data: MenuItem;
  error?: string;
}

export interface MenuStatsResponse {
  success: boolean;
  data: MenuStats;
  error?: string;
}

// ======================
// ALLERGEN CONFIGURATION
// ======================
export const ALLERGEN_CONFIG: Record<Allergen, { label: string; icon: string }> = {
  gluten: { label: 'Gluten', icon: '🌾' },
  nuts: { label: 'Frutos secos', icon: '🥜' },
  dairy: { label: 'Lácteos', icon: '🥛' },
  shellfish: { label: 'Mariscos', icon: '🦐' },
  eggs: { label: 'Huevos', icon: '🥚' },
  soy: { label: 'Soya', icon: '🫘' },
  fish: { label: 'Pescado', icon: '🐟' },
  peanuts: { label: 'Cacahuates', icon: '🥜' },
  sesame: { label: 'Sésamo', icon: '🌱' },
  celery: { label: 'Apio', icon: '🥬' },
  mustard: { label: 'Mostaza', icon: '🟡' },
  sulfites: { label: 'Sulfitos', icon: '🍷' },
};

// ======================
// DIETARY LABELS
// ======================
export const DIETARY_LABELS = {
  is_vegetarian: { label: 'Vegetariano', icon: '🥬', color: 'emerald' },
  is_vegan: { label: 'Vegano', icon: '🌱', color: 'green' },
  is_gluten_free: { label: 'Sin Gluten', icon: '🌾', color: 'amber' },
  is_spicy: { label: 'Picante', icon: '🌶️', color: 'red' },
} as const;

// ======================
// SPICE LEVELS
// ======================
export const SPICE_LEVELS = [
  { value: 0, label: 'Sin picante', color: 'bg-slate-500' },
  { value: 1, label: 'Suave', color: 'bg-yellow-500' },
  { value: 2, label: 'Medio', color: 'bg-orange-400' },
  { value: 3, label: 'Picante', color: 'bg-orange-500' },
  { value: 4, label: 'Muy picante', color: 'bg-red-500' },
  { value: 5, label: 'Extra picante', color: 'bg-red-700' },
];

// ======================
// AVAILABLE DAYS
// ======================
export const AVAILABLE_DAYS = [
  { value: 'monday', label: 'Lunes', short: 'L' },
  { value: 'tuesday', label: 'Martes', short: 'M' },
  { value: 'wednesday', label: 'Miércoles', short: 'X' },
  { value: 'thursday', label: 'Jueves', short: 'J' },
  { value: 'friday', label: 'Viernes', short: 'V' },
  { value: 'saturday', label: 'Sábado', short: 'S' },
  { value: 'sunday', label: 'Domingo', short: 'D' },
];
