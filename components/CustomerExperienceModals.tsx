'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Check,
  X,
  AlertTriangle,
  Heart,
  Star,
  Clock,
  Sparkles,
  Home,
  Briefcase,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import type { RestaurantRecord } from '@/lib/db/models';

export interface DeliveryZoneOption {
  id: string;
  name: string;
  city: string;
  etaBonusMinutes: number;
  feeSurcharge: number;
  isServiceable: boolean;
  tagline: string;
}

export const DELIVERY_ZONES: DeliveryZoneOption[] = [
  {
    id: 'zone_mission',
    name: 'Mission District',
    city: 'San Francisco, CA 94103',
    etaBonusMinutes: 0,
    feeSurcharge: 0,
    isServiceable: true,
    tagline: '6 restaurants • Express 20–28 min delivery',
  },
  {
    id: 'zone_soma',
    name: 'SoMa',
    city: 'San Francisco, CA 94105',
    etaBonusMinutes: 2,
    feeSurcharge: 0,
    isServiceable: true,
    tagline: '6 restaurants • Hub priority zone',
  },
  {
    id: 'zone_downtown',
    name: 'Downtown San Francisco',
    city: 'San Francisco, CA 94108',
    etaBonusMinutes: 3,
    feeSurcharge: 0,
    isServiceable: true,
    tagline: '6 restaurants • Financial & Union Square',
  },
  {
    id: 'zone_marina',
    name: 'Marina District',
    city: 'San Francisco, CA 94123',
    etaBonusMinutes: 4,
    feeSurcharge: 0.5,
    isServiceable: true,
    tagline: '6 restaurants • Waterfront corridor',
  },
  {
    id: 'zone_pac_heights',
    name: 'Pacific Heights',
    city: 'San Francisco, CA 94115',
    etaBonusMinutes: 5,
    feeSurcharge: 1.0,
    isServiceable: true,
    tagline: '6 restaurants • +$1.00 distance fee',
  },
  {
    id: 'zone_out_of_range',
    name: 'Oakland Hills (Out of Zone)',
    city: 'Oakland, CA 94611',
    etaBonusMinutes: 0,
    feeSurcharge: 0,
    isServiceable: false,
    tagline: 'Outside current FoodHub kitchen radius',
  },
];

interface LocationModalProps {
  open: boolean;
  selectedZone: DeliveryZoneOption;
  onSelectZone: (zone: DeliveryZoneOption) => void;
  onClose: () => void;
}

export function LocationSelectorModal({
  open,
  selectedZone,
  onSelectZone,
  onClose,
}: LocationModalProps) {
  const [query, setQuery] = useState('');

  if (!open) return null;

  const filteredZones = DELIVERY_ZONES.filter(
    (z) =>
      z.name.toLowerCase().includes(query.toLowerCase()) ||
      z.city.toLowerCase().includes(query.toLowerCase()) ||
      z.tagline.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Select delivery location"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Choose Delivery Location</h3>
              <p className="text-xs text-slate-500">
                Real-time restaurant availability & delivery fees depend on your zone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-stone-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Navigation className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search neighborhood, street, or ZIP code..."
              className="w-full rounded-xl border border-stone-300 bg-stone-50 py-2.5 pr-4 pl-10 text-sm text-slate-900 focus:border-rose-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {filteredZones.map((zone) => {
              const isSelected = selectedZone.id === zone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => {
                    onSelectZone(zone);
                    onClose();
                  }}
                  className={`flex w-full items-start justify-between rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-rose-600 bg-rose-50/50'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        zone.isServiceable
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {zone.isServiceable ? (
                        <MapPin className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{zone.name}</span>
                        {!zone.isServiceable && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                            Unserviceable Demo Zone
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{zone.city}</p>
                      <p className="mt-1 text-xs font-medium text-slate-600">{zone.tagline}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MultiRestaurantConflictModalProps {
  open: boolean;
  existingRestaurantName: string;
  newRestaurantName: string;
  onConfirmReplace: () => void;
  onCancel: () => void;
}

export function MultiRestaurantConflictModal({
  open,
  existingRestaurantName,
  newRestaurantName,
  onConfirmReplace,
  onCancel,
}: MultiRestaurantConflictModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Replace cart items confirmation"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Replace items already in your cart?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your cart currently contains dishes from{' '}
          <span className="font-semibold text-slate-900">{existingRestaurantName}</span>. To ensure
          hot, fresh single-rider delivery, orders can only be placed from one restaurant at a time.
          Would you like to discard your current selection and add items from{' '}
          <span className="font-semibold text-slate-900">{newRestaurantName}</span>?
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-stone-50"
          >
            No, Keep Existing
          </button>
          <button
            type="button"
            onClick={onConfirmReplace}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-500"
          >
            Yes, Start Fresh Cart
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddAddressModalProps {
  open: boolean;
  defaultRecipientName: string;
  defaultPhone: string;
  onSave: (addr: {
    label: 'Home' | 'Work' | 'Other';
    recipientName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    instructions: string;
    isDefault: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export function AddAddressModal({
  open,
  defaultRecipientName,
  defaultPhone,
  onSave,
  onClose,
}: AddAddressModalProps) {
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [phone, setPhone] = useState(defaultPhone);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('San Francisco');
  const [state, setState] = useState('CA');
  const [postalCode, setPostalCode] = useState('94103');
  const [instructions, setInstructions] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!street.trim() || street.trim().length < 5) {
      setError('Please enter a complete street address and apartment/suite number.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setError('Please enter a valid contact phone number for delivery updates.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSave({
        label,
        recipientName: recipientName.trim() || defaultRecipientName,
        phone: phone.trim(),
        street: street.trim(),
        city: city.trim() || 'San Francisco',
        state: state.trim() || 'CA',
        postalCode: postalCode.trim() || '94103',
        instructions: instructions.trim(),
        isDefault,
      });
      setStreet('');
      setInstructions('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Add new delivery address"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">Add New Delivery Address</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close address modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-stone-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase">
              Address Label
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['Home', 'Work', 'Other'] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setLabel(tag)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                    label === tag
                      ? 'border-rose-600 bg-rose-50 text-rose-700'
                      : 'border-stone-200 bg-white text-slate-600 hover:bg-stone-50'
                  }`}
                >
                  {tag === 'Home' ? (
                    <Home className="h-3.5 w-3.5" />
                  ) : tag === 'Work' ? (
                    <Briefcase className="h-3.5 w-3.5" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Recipient Name
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Contact Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Flat / House No., Building, Street Address *
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="e.g., 850 Mission Street, Apt 12C"
              required
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">ZIP Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Delivery Instructions (Landmark / Gate Code)
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Ring bell #12 or leave with building security"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-rose-600"
            />
            Set as default delivery address
          </label>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {submitting ? 'Saving Address...' : 'Save Delivery Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RestaurantCardProps {
  restaurant: RestaurantRecord;
  isFavorite: boolean;
  etaBonusMinutes?: number;
  feeSurcharge?: number;
  onSelect: (restaurantId: string) => void;
  onToggleFavorite: (restaurantId: string) => void;
}

export function SwiggyZomatoRestaurantCard({
  restaurant,
  isFavorite,
  etaBonusMinutes = 0,
  feeSurcharge = 0,
  onSelect,
  onToggleFavorite,
}: RestaurantCardProps) {
  const effectiveEta = restaurant.deliveryTimeMinutes + etaBonusMinutes;
  const effectiveFee =
    restaurant.deliveryFee === 0
      ? 0
      : Number((restaurant.deliveryFee + feeSurcharge).toFixed(2));
  const costForTwo = restaurant.costForTwo ?? 32;

  return (
    <div
      onClick={() => onSelect(restaurant.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(restaurant.id);
        }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition duration-200 hover:-translate-y-1 hover:border-stone-300 hover:shadow-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
    >
      {/* Cover Image Container */}
      <div className="relative h-48 w-full overflow-hidden bg-stone-100">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="
          pointer-events-none absolute inset-0
          bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent
        " />

        {/* Top Left Pure Veg / Featured Badge */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          {restaurant.isPureVeg && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" /> PURE VEG
            </span>
          )}
          {!restaurant.isAvailable && (
            <span className="rounded-lg bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-rose-300">
              CURRENTLY CLOSED
            </span>
          )}
        </div>

        {/* Top Right Wishlist Heart Button */}
        <button
          type="button"
          aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(restaurant.id);
          }}
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:scale-110"
        >
          <Heart
            className={`h-4 w-4 ${
              isFavorite ? 'fill-rose-600 text-rose-600' : 'text-slate-600'
            }`}
          />
        </button>

        {/* Bottom Offer Overlay (Swiggy/Zomato Signature Style) */}
        <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
          {restaurant.offerBadge ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-600/95 px-2.5 py-1 text-xs font-extrabold tracking-tight text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {restaurant.offerBadge}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-lg bg-white/95 px-2.5 py-1 font-mono text-xs font-bold text-slate-900 shadow-sm">
            {effectiveEta}–{effectiveEta + 5} min
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-base font-extrabold text-slate-900 group-hover:text-rose-600">
              {restaurant.name}
            </h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
              <Star className="h-3 w-3 fill-white text-white" />
              {restaurant.rating.toFixed(1)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <p className="line-clamp-1 font-medium text-slate-600">
              {restaurant.cuisine.join(', ')}
            </p>
            <span className="shrink-0 font-mono text-xs font-semibold text-slate-700">
              ${costForTwo} for two
            </span>
          </div>

          <p className="mt-1.5 line-clamp-1 text-xs text-slate-400">{restaurant.address}</p>
        </div>

        {/* Footer Metadata */}
        <div className="mt-3.5 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
          <div className="flex items-center gap-3 text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {effectiveEta} mins
            </span>
            <span className="text-stone-300">•</span>
            <span
              className={`font-mono font-bold ${
                effectiveFee === 0 ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              {effectiveFee === 0 ? 'FREE DELIVERY' : `$${effectiveFee.toFixed(2)} delivery`}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            ({restaurant.reviewCount} reviews)
          </span>
        </div>
      </div>
    </div>
  );
}
