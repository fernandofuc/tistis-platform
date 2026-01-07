// =====================================================
// TIS TIS PLATFORM - Menu Item Card Component
// Individual menu item display card with actions
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/shared/utils';
import type { MenuItem, Allergen } from '../types';
import { ALLERGEN_CONFIG, DIETARY_LABELS } from '../types';

// ======================
// PRICE DISPLAY
// ======================
interface PriceDisplayProps {
  price: number;
  priceLunch?: number | null;
  priceHappyHour?: number | null;
  currency?: string;
}

function PriceDisplay({ price, priceLunch, priceHappyHour, currency = 'MXN' }: PriceDisplayProps) {
  const formatPrice = (p: number) => `$${p.toLocaleString('es-MX')}`;

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-bold text-slate-900">{formatPrice(price)}</span>
      {priceLunch && (
        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          Comida: {formatPrice(priceLunch)}
        </span>
      )}
    </div>
  );
}

// ======================
// DIETARY BADGES
// ======================
interface DietaryBadgesProps {
  item: MenuItem;
}

function DietaryBadges({ item }: DietaryBadgesProps) {
  const badges = [];

  if (item.is_vegetarian) badges.push({ key: 'is_vegetarian', ...DIETARY_LABELS.is_vegetarian });
  if (item.is_vegan) badges.push({ key: 'is_vegan', ...DIETARY_LABELS.is_vegan });
  if (item.is_gluten_free) badges.push({ key: 'is_gluten_free', ...DIETARY_LABELS.is_gluten_free });
  if (item.is_spicy) badges.push({ key: 'is_spicy', ...DIETARY_LABELS.is_spicy });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-50 text-slate-600"
          title={badge.label}
        >
          {badge.icon}
        </span>
      ))}
    </div>
  );
}

// ======================
// ALLERGEN BADGES
// ======================
interface AllergenBadgesProps {
  allergens: Allergen[];
  maxShow?: number;
}

function AllergenBadges({ allergens, maxShow = 4 }: AllergenBadgesProps) {
  if (allergens.length === 0) return null;

  const visible = allergens.slice(0, maxShow);
  const remaining = allergens.length - maxShow;

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 mr-0.5">Alérgenos:</span>
      {visible.map((allergen) => {
        const config = ALLERGEN_CONFIG[allergen];
        return (
          <span
            key={allergen}
            className="text-xs"
            title={config.label}
          >
            {config.icon}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] text-slate-400">+{remaining}</span>
      )}
    </div>
  );
}

// ======================
// AVAILABILITY BADGE
// ======================
interface AvailabilityBadgeProps {
  isAvailable: boolean;
  outOfStockUntil?: string | null;
}

function AvailabilityBadge({ isAvailable, outOfStockUntil }: AvailabilityBadgeProps) {
  if (isAvailable) return null;

  const untilDate = outOfStockUntil ? new Date(outOfStockUntil) : null;
  const isTemporary = untilDate && untilDate > new Date();

  return (
    <span
      className={cn(
        'absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-medium',
        isTemporary ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
      )}
    >
      {isTemporary
        ? `Hasta ${untilDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
        : 'Agotado'}
    </span>
  );
}

// ======================
// FEATURED BADGE
// ======================
function FeaturedBadge() {
  return (
    <span className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-1">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      Destacado
    </span>
  );
}

// ======================
// ITEM CARD MENU
// ======================
interface ItemCardMenuProps {
  item: MenuItem;
  onEdit: () => void;
  onToggleAvailability: () => void;
  onToggleFeatured: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function ItemCardMenu({
  item,
  onEdit,
  onToggleAvailability,
  onToggleFeatured,
  onDuplicate,
  onDelete,
}: ItemCardMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position menu to the left of the button
      setMenuPosition({
        top: rect.top,
        left: rect.left - 180 - 8, // menu width (w-44 = 176px) + gap
      });
    }
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>

            <button
              onClick={() => { onToggleAvailability(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.is_available ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              {item.is_available ? 'Marcar agotado' : 'Marcar disponible'}
            </button>

            <button
              onClick={() => { onToggleFeatured(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill={item.is_featured ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              {item.is_featured ? 'Quitar destacado' : 'Destacar'}
            </button>

            <button
              onClick={() => { onDuplicate(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicar
            </button>

            <div className="border-t border-slate-100 my-1" />

            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  onToggleFeatured: (item: MenuItem) => void;
  onDuplicate: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  compact?: boolean;
}

export function MenuItemCard({
  item,
  onEdit,
  onToggleAvailability,
  onToggleFeatured,
  onDuplicate,
  onDelete,
  compact = false,
}: MenuItemCardProps) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-4 p-3 rounded-xl border transition-all duration-200',
          item.is_available
            ? 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300'
            : 'border-slate-100 bg-slate-50 opacity-70'
        )}
      >
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            width={48}
            height={48}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-900 truncate">{item.name}</h3>
            <DietaryBadges item={item} />
          </div>
          <p className="text-sm text-slate-500 truncate">{item.short_description || item.category?.name}</p>
        </div>

        <PriceDisplay price={item.price} priceLunch={item.price_lunch} />

        <ItemCardMenu
          item={item}
          onEdit={() => onEdit(item)}
          onToggleAvailability={() => onToggleAvailability(item)}
          onToggleFeatured={() => onToggleFeatured(item)}
          onDuplicate={() => onDuplicate(item)}
          onDelete={() => onDelete(item)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border overflow-hidden transition-all duration-200',
        item.is_available
          ? 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300/80'
          : 'border-slate-100 bg-slate-50/50 opacity-80'
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-slate-100">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {item.is_featured && <FeaturedBadge />}
        <AvailabilityBadge isAvailable={item.is_available} outOfStockUntil={item.out_of_stock_until} />
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-slate-900 line-clamp-1">{item.name}</h3>
            {item.category && (
              <p className="text-xs text-slate-500">{item.category.name}</p>
            )}
          </div>
          <ItemCardMenu
            item={item}
            onEdit={() => onEdit(item)}
            onToggleAvailability={() => onToggleAvailability(item)}
            onToggleFeatured={() => onToggleFeatured(item)}
            onDuplicate={() => onDuplicate(item)}
            onDelete={() => onDelete(item)}
          />
        </div>

        {item.short_description && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-3">
            {item.short_description}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <PriceDisplay
            price={item.price}
            priceLunch={item.price_lunch}
            priceHappyHour={item.price_happy_hour}
          />
          <DietaryBadges item={item} />
        </div>

        {item.allergens.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <AllergenBadges allergens={item.allergens} />
          </div>
        )}
      </div>
    </div>
  );
}

export { PriceDisplay, DietaryBadges, AllergenBadges };
