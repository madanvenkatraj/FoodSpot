'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Copy,
  Flame,
  Heart,
  HelpCircle,
  Home,
  Layers,
  LogOut,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import {
  AddAddressModal,
  DELIVERY_ZONES,
  LocationSelectorModal,
  MultiRestaurantConflictModal,
  SwiggyZomatoRestaurantCard,
} from '@/components/CustomerExperienceModals';
import OrderTrackingMap from '@/components/OrderTrackingMap';
import YantraSupportWidget from '@/components/YantraSupportWidget';
import CustomerSupportCenter from '@/components/CustomerSupportCenter';
import type { FoodItemRecord, OrderStatus } from '@/lib/db/models';
import {
  broadcastOrderStatusChangeAcrossTabs,
  dispatchOrderStatusBrowserPush,
  getBrowserPushPermission,
  isPushAlertEnabledByUser,
  requestOrderPushPermission,
} from '@/lib/notifications/pushClient';

export type CustomerRouteSection =
  | 'home'
  | 'restaurants'
  | 'restaurant-detail'
  | 'search'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'order-detail'
  | 'favorites'
  | 'profile'
  | 'addresses'
  | 'support';

interface CustomerWorkspaceAppProps {
  section: CustomerRouteSection;
  entityId?: string;
}

const ORDER_STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'placed', label: 'Order Placed', desc: 'Sent to restaurant kitchen' },
  { status: 'accepted', label: 'Confirmed', desc: 'Restaurant accepted your order' },
  { status: 'preparing', label: 'Preparing Food', desc: 'Chef is freshly preparing your meal' },
  { status: 'out_for_delivery', label: 'Out for Delivery', desc: 'Courier is on the way to you' },
  { status: 'delivered', label: 'Delivered', desc: 'Enjoy your meal!' },
];

export default function CustomerWorkspaceApp({
  section,
  entityId,
}: CustomerWorkspaceAppProps) {
  const router = useRouter();
  const {
    appData,
    loadingData,
    refreshState,
    customerUser,
    logoutCustomer,
    cart,
    appliedCouponCode,
    setAppliedCouponCode,
    deliveryZone,
    setDeliveryZone,
    addToCart,
    updateCartQty,
    clearCart,
    conflictPendingItem,
    setConflictPendingItem,
    confirmReplaceCartConflict,
    showToast,
  } = useWorkspace();

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [rating4Plus, setRating4Plus] = useState(false);
  const [fastDeliveryOnly, setFastDeliveryOnly] = useState(false);
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false);
  const [under15Only, setUnder15Only] = useState(false);
  const [sortBy, setSortBy] = useState<
    'relevance' | 'rating' | 'delivery_time' | 'cost_asc' | 'cost_desc'
  >('relevance');

  // Restaurant Menu internal filter states
  const [menuSearch, setMenuSearch] = useState('');
  const [menuVegOnly, setMenuVegOnly] = useState(false);
  const [menuNonVegOnly, setMenuNonVegOnly] = useState(false);
  const [menuBestsellerOnly, setMenuBestsellerOnly] = useState(false);
  const [activeMenuSection, setActiveMenuSection] = useState<string>('All');

  // Modals & Drawers
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [addAddressModalOpen, setAddAddressModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [supportModalOrder, setSupportModalOrder] = useState<string | undefined>(undefined);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Dish customization modal
  const [customizingFood, setCustomizingFood] = useState<FoodItemRecord | null>(null);
  const [selectedCustomizations, setSelectedCustomizations] = useState<
    { groupTitle: string; optionName: string; price: number }[]
  >([]);
  const [customQty, setCustomQty] = useState(1);
  const [customNotes, setCustomNotes] = useState('');

  // Checkout states
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    'Leave at front concierge desk / ring bell'
  );
  const [placingOrder, setPlacingOrder] = useState(false);
  const [couponInput, setCouponInput] = useState(appliedCouponCode);

  // Profile & Review states
  const [profileName, setProfileName] = useState(customerUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(customerUser?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => isPushAlertEnabledByUser());
  const [pushPermission, setPushPermission] = useState<string>(() => getBrowserPushPermission());
  const [simulatingOrderId, setSimulatingOrderId] = useState<string | null>(null);

  const activeUser = useMemo(() => {
    if (!appData) return customerUser;
    if (customerUser) {
      return appData.users.find((u) => u.id === customerUser.id) || customerUser;
    }
    return null;
  }, [appData, customerUser]);

  const userFavorites = useMemo(() => activeUser?.favorites || [], [activeUser]);

  const userAddresses = useMemo(() => {
    if (!appData || !activeUser) return [];
    return appData.addresses.filter((a) => a.userId === activeUser.id);
  }, [appData, activeUser]);

  const userOrders = useMemo(() => {
    if (!appData || !activeUser) return [];
    return appData.orders.filter((o) => o.customerId === activeUser.id);
  }, [appData, activeUser]);

  // Filtered & sorted restaurants
  const filteredRestaurants = useMemo(() => {
    if (!appData) return [];
    const q = searchQuery.trim().toLowerCase();

    return appData.restaurants
      .filter((r) => r.isApproved)
      .filter((r) => {
        if (!deliveryZone.isServiceable) return false;
        if (
          r.serviceableZones &&
          r.serviceableZones.length > 0 &&
          !r.serviceableZones.some((z) => z.toLowerCase() === deliveryZone.name.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .filter((r) => {
        if (selectedCategoryId === 'all') return true;
        return appData.foodItems.some(
          (f) => f.restaurantId === r.id && f.categoryId === selectedCategoryId
        );
      })
      .filter((r) => {
        if (dietFilter === 'all') return true;
        const restFoods = appData.foodItems.filter((f) => f.restaurantId === r.id);
        if (dietFilter === 'veg') return restFoods.some((f) => f.isVeg);
        return restFoods.some((f) => !f.isVeg);
      })
      .filter((r) => (rating4Plus ? r.rating >= 4.0 : true))
      .filter((r) => (fastDeliveryOnly ? r.deliveryTimeMinutes <= 25 : true))
      .filter((r) => (freeDeliveryOnly ? r.deliveryFee === 0 : true))
      .filter((r) => {
        if (!under15Only) return true;
        return appData.foodItems.some((f) => f.restaurantId === r.id && f.price <= 15);
      })
      .filter((r) => {
        if (!q) return true;
        const nameMatch = r.name.toLowerCase().includes(q);
        const cuisineMatch = r.cuisine.some((c) => c.toLowerCase().includes(q));
        const dishMatch = appData.foodItems.some(
          (f) => f.restaurantId === r.id && f.name.toLowerCase().includes(q)
        );
        return nameMatch || cuisineMatch || dishMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'delivery_time') return a.deliveryTimeMinutes - b.deliveryTimeMinutes;
        if (sortBy === 'cost_asc') return (a.costForTwo || 30) - (b.costForTwo || 30);
        if (sortBy === 'cost_desc') return (b.costForTwo || 30) - (a.costForTwo || 30);
        return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
      });
  }, [
    appData,
    deliveryZone,
    selectedCategoryId,
    dietFilter,
    rating4Plus,
    fastDeliveryOnly,
    freeDeliveryOnly,
    under15Only,
    searchQuery,
    sortBy,
  ]);

  // Cart Pricing Calculations
  const cartRestaurant = useMemo(() => {
    if (!appData || cart.length === 0) return null;
    return appData.restaurants.find((r) => r.id === cart[0].foodItem.restaurantId) || null;
  }, [appData, cart]);

  const cartSummary = useMemo(() => {
    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = Number(
      cart
        .reduce((sum, i) => {
          const addons = i.selectedCustomizations.reduce((s, c) => s + c.price, 0);
          return sum + (i.foodItem.price + addons) * i.quantity;
        }, 0)
        .toFixed(2)
    );
    const baseDeliveryFee = cartRestaurant ? cartRestaurant.deliveryFee : 0;
    const packagingFee = cart.length > 0 ? 1.25 : 0;
    let discountAmount = 0;
    let deliveryFee = baseDeliveryFee;

    if (appData && appliedCouponCode && subtotal > 0) {
      const coupon = appData.coupons.find(
        (c) => c.code.toUpperCase() === appliedCouponCode.toUpperCase() && c.isActive
      );
      if (coupon && subtotal >= coupon.minOrderValue) {
        if (coupon.discountType === 'free_delivery') {
          discountAmount = baseDeliveryFee;
          deliveryFee = 0;
        } else if (coupon.discountType === 'percentage') {
          discountAmount = Math.min(
            coupon.maxDiscount,
            Number(((subtotal * coupon.discountValue) / 100).toFixed(2))
          );
        } else {
          discountAmount = Math.min(coupon.maxDiscount, coupon.discountValue);
        }
      }
    }

    const taxes = Number((subtotal * 0.08).toFixed(2));
    const grandTotal = Number(
      Math.max(0, subtotal + deliveryFee + packagingFee + taxes - discountAmount).toFixed(2)
    );

    return {
      itemCount,
      subtotal,
      deliveryFee,
      packagingFee,
      taxes,
      discountAmount,
      grandTotal,
    };
  }, [cart, cartRestaurant, appData, appliedCouponCode]);

  const handleToggleFavorite = async (restaurantId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeUser) return;
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_favorite',
        userId: activeUser.id,
        restaurantId,
      }),
    });
    await refreshState(true);
    showToast(
      userFavorites.includes(restaurantId)
        ? 'Removed from your Favorites'
        : 'Saved to your Favorites!'
    );
  };

  const openFoodAddition = (food: FoodItemRecord) => {
    if (food.customizations && food.customizations.length > 0) {
      const defaults: { groupTitle: string; optionName: string; price: number }[] = [];
      food.customizations.forEach((grp) => {
        if (grp.required && grp.options.length > 0) {
          defaults.push({
            groupTitle: grp.title,
            optionName: grp.options[0].name,
            price: grp.options[0].price,
          });
        }
      });
      setCustomizingFood(food);
      setSelectedCustomizations(defaults);
      setCustomQty(1);
      setCustomNotes('');
    } else {
      addToCart(food, [], 1);
    }
  };

  const handleApplyCoupon = async (codeToValidate: string) => {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate_coupon',
        code: codeToValidate,
        subtotal: cartSummary.subtotal,
        deliveryFee: cartRestaurant?.deliveryFee || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.valid) {
      showToast(data.error || 'Coupon not eligible for current cart', 'error');
      return;
    }
    setAppliedCouponCode(codeToValidate.toUpperCase());
    setCouponInput(codeToValidate.toUpperCase());
    showToast(`Applied ${codeToValidate.toUpperCase()} — Saved $${data.discountAmount.toFixed(2)}!`);
  };

  const handlePlaceOrder = async () => {
    if (!activeUser || !cartRestaurant || cart.length === 0) return;
    setPlacingOrder(true);
    try {
      const chosenAddrId =
        selectedAddressId ||
        userAddresses.find((a) => a.isDefault)?.id ||
        userAddresses[0]?.id ||
        '';
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeUser.id,
          restaurantId: cartRestaurant.id,
          addressId: chosenAddrId,
          couponCode: appliedCouponCode || null,
          deliveryInstructions,
          items: cart.map((i) => ({
            foodItemId: i.foodItem.id,
            name: i.foodItem.name,
            quantity: i.quantity,
            basePrice: i.foodItem.price,
            selectedCustomizations: i.selectedCustomizations,
            isVeg: i.foodItem.isVeg,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not place order', 'error');
        return;
      }
      clearCart();
      await refreshState(true);
      showToast(`Order #${data.order.orderNumber} confirmed!`);
      router.push(`/customer/orders/${data.order.id}`);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        status: 'cancelled',
        actorRole: 'customer',
        cancellationReason: 'Customer requested cancellation before preparation',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Unable to cancel order', 'error');
      return;
    }
    await refreshState(true);
    showToast('Order cancelled.', 'info');
  };

  const handleEnableBrowserPush = async () => {
    const result = await requestOrderPushPermission();
    setPushPermission(result.permission);
    setPushEnabled(result.enabled);
    if (result.permission === 'granted') {
      showToast('Browser Push Notifications enabled for live order status updates!');
    } else if (result.permission === 'denied') {
      showToast(
        'Browser blocked native notifications; live in-app push alerts remain active.',
        'info'
      );
    } else {
      showToast('Live Order Push Notifications activated!');
    }
  };

  const handleTriggerOrderStatusPush = async (
    orderId: string,
    nextStatus: OrderStatus,
    forceFromPreparing = false
  ) => {
    setSimulatingOrderId(orderId);
    try {
      await requestOrderPushPermission();
      setPushPermission(getBrowserPushPermission());
      setPushEnabled(true);

      if (forceFromPreparing) {
        // Ensure order passes through 'preparing' first if needed, then 'out_for_delivery'
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            status: 'preparing',
            actorRole: 'restaurant',
            note: 'Kitchen is preparing your order',
          }),
        });
      }

      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: nextStatus,
          actorRole: nextStatus === 'out_for_delivery' ? 'delivery' : 'restaurant',
          note:
            nextStatus === 'out_for_delivery'
              ? "Order status changed from 'Preparing' to 'Out for Delivery' — courier is en route!"
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not update order status', 'error');
        return;
      }

      if (data.order) {
        await dispatchOrderStatusBrowserPush({
          orderId: data.order.id,
          orderNumber: data.order.orderNumber,
          restaurantName: data.order.restaurantName,
          previousStatus: forceFromPreparing ? 'preparing' : data.previousStatus,
          newStatus: data.order.status,
        });
        broadcastOrderStatusChangeAcrossTabs({
          orderId: data.order.id,
          orderNumber: data.order.orderNumber,
          restaurantName: data.order.restaurantName,
          previousStatus: forceFromPreparing ? 'preparing' : data.previousStatus,
          newStatus: data.order.status,
        });
      }

      await refreshState(true);
    } finally {
      setSimulatingOrderId(null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewOrderId || !activeUser || !appData) return;
    const ord = appData.orders.find((o) => o.id === reviewOrderId);
    if (!ord) return;
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_review',
        customerId: activeUser.id,
        customerName: activeUser.name,
        restaurantId: ord.restaurantId,
        orderId: ord.id,
        rating: reviewRating,
        comment: reviewComment,
      }),
    });
    setReviewOrderId(null);
    setReviewComment('');
    await refreshState(true);
    showToast('Thank you! Your review has been published.');
  };

  if (loadingData && !appData) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] p-6">
        <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
          <div className="h-16 rounded-2xl bg-stone-200" />
          <div className="h-64 rounded-3xl bg-stone-200" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-72 rounded-3xl bg-stone-200" />
            <div className="h-72 rounded-3xl bg-stone-200" />
            <div className="h-72 rounded-3xl bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col justify-between pb-20 md:pb-0">
      {/* Sticky Customer Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Brand + Delivery Location Selector */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/customer/home" className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-md shadow-orange-600/20">
                <Flame className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <span className="font-display text-lg font-extrabold tracking-tight text-stone-950">
                  FoodHub
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-orange-600">
                  Customer App
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50/40 transition-colors max-w-[230px] sm:max-w-xs cursor-pointer"
            >
              <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
              <div className="truncate">
                <div className="flex items-center gap-1 text-xs font-extrabold text-stone-900">
                  <span className="truncate">{deliveryZone.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                </div>
                <p className="truncate text-[11px] text-stone-500">{deliveryZone.address}</p>
              </div>
            </button>
          </div>

          {/* Global Search Input */}
          <div className="hidden lg:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (section !== 'search' && section !== 'restaurants' && section !== 'home') {
                    router.push('/customer/search');
                  }
                }}
                placeholder="Search for restaurants, cuisines or dishes..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 py-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Primary Customer Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/customer/home"
              className={`hidden md:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                section === 'home'
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              href="/customer/restaurants"
              className={`hidden md:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                section === 'restaurants' || section === 'restaurant-detail'
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Store className="h-4 w-4" />
              Restaurants
            </Link>
            <Link
              href="/customer/favorites"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                section === 'favorites'
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Heart className="h-4 w-4" />
              Favorites
            </Link>
            <Link
              href="/customer/orders"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                section === 'orders' || section === 'order-detail'
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Package className="h-4 w-4" />
              Orders
            </Link>
            <Link
              href="/customer/support"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                section === 'support'
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              Support
            </Link>

            {/* Browser Push Notifications Toggle */}
            <button
              type="button"
              onClick={() => void handleEnableBrowserPush()}
              title="Browser Push Notifications for Order Status Updates"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                pushEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-orange-50 hover:border-orange-200'
              }`}
            >
              {pushEnabled ? (
                <BellRing className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Bell className="h-3.5 w-3.5 text-orange-600" />
              )}
              <span className="hidden xl:inline">
                {pushEnabled ? 'Push Alerts On' : 'Enable Push'}
              </span>
            </button>

            {/* Cart Button */}
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="relative inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4 text-orange-400" />
              <span className="hidden sm:inline">Cart</span>
              <span className="rounded-full bg-orange-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {cartSummary.itemCount}
              </span>
            </button>

            {/* Profile Link */}
            <Link
              href="/customer/profile"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                section === 'profile' || section === 'addresses'
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <User className="h-4 w-4 text-orange-600" />
              <span className="hidden lg:inline truncate max-w-[100px]">
                {activeUser?.name?.split(' ')[0] || 'Account'}
              </span>
            </Link>

            {/* Switch Workspace */}
            <Link
              href="/"
              title="Switch Workspace"
              className="hidden xl:inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] font-bold text-stone-600 hover:bg-stone-100"
            >
              Workspaces
            </Link>

            {/* Logout */}
            <button
              type="button"
              onClick={async () => {
                await logoutCustomer();
                router.push('/customer/login');
              }}
              title="Sign Out of Customer App"
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2 text-stone-500 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* ==================== 1. HOME / RESTAURANTS / SEARCH ==================== */}
        {(section === 'home' || section === 'restaurants' || section === 'search') && (
          <div className="space-y-8">
            {/* Hero Banner on Home */}
            {section === 'home' && (
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-stone-950 via-stone-900 to-orange-950 text-white p-6 sm:p-10 shadow-xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 border border-orange-400/30 px-3.5 py-1 text-xs font-bold text-orange-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      DELIVERING TO {deliveryZone.name.toUpperCase()} IN {deliveryZone.eta}
                    </div>
                    <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                      Craving Something{' '}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                        Extraordinary?
                      </span>
                    </h1>
                    <p className="text-sm sm:text-base text-stone-300 max-w-xl leading-relaxed">
                      Order wood-fired artisanal pizzas, royal Dum biryanis, gourmet smash burgers
                      and handcrafted desserts from top-rated neighborhood kitchens.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Link
                        href="/customer/restaurants"
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/30 hover:from-orange-500 hover:to-red-500 transition-all"
                      >
                        Explore All Restaurants
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/customer/orders"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-bold text-white hover:bg-white/15 transition-all"
                      >
                        <Truck className="h-4 w-4 text-orange-400" />
                        Track Active Orders
                      </Link>
                    </div>
                  </div>

                  <div className="lg:col-span-5 relative h-56 sm:h-64 rounded-2xl overflow-hidden border border-white/10">
                    <Image
                      src="/images/hero-food-banner.svg"
                      alt="FoodHub Culinary Feast"
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Promotional Coupons Carousel on Home */}
            {section === 'home' && appData && appData.coupons.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-extrabold text-stone-900 flex items-center gap-2">
                    <Tag className="h-5 w-5 text-orange-600" />
                    Best Offers &amp; Promo Codes For You
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {appData.coupons
                    .filter((c) => c.isActive)
                    .map((cpn) => (
                      <div
                        key={cpn.id}
                        className="flex items-center justify-between rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/60 p-4 shadow-xs"
                      >
                        <div>
                          <span className="inline-block rounded-lg bg-orange-600 px-2.5 py-0.5 font-mono text-xs font-extrabold text-white">
                            {cpn.code}
                          </span>
                          <p className="mt-1.5 text-xs font-bold text-stone-800">
                            {cpn.description}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            Min order ${cpn.minOrderValue.toFixed(0)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedCouponCode(cpn.code);
                            setCouponInput(cpn.code);
                            showToast(`Promo code ${cpn.code} ready for your order!`);
                          }}
                          className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-600 hover:text-white transition-colors cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {appliedCouponCode === cpn.code ? 'Applied' : 'Use Code'}
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* 10 Food Categories Scroller */}
            {appData && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg sm:text-xl font-extrabold text-stone-900">
                    What&apos;s on your mind?
                  </h2>
                  {selectedCategoryId !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId('all')}
                      className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      Clear Category Filter
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-3 min-w-[92px] transition-all cursor-pointer ${
                      selectedCategoryId === 'all'
                        ? 'border-orange-600 bg-orange-50/80 shadow-sm'
                        : 'border-stone-200/80 bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-stone-800">All Food</span>
                  </button>

                  {appData.categories
                    .filter((c) => c.isActive)
                    .map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setSelectedCategoryId((prev) => (prev === cat.id ? 'all' : cat.id))
                        }
                        className={`flex flex-col items-center gap-2 rounded-2xl border p-3 min-w-[96px] transition-all cursor-pointer ${
                          selectedCategoryId === cat.id
                            ? 'border-orange-600 bg-orange-50/80 shadow-sm'
                            : 'border-stone-200/80 bg-white hover:border-orange-300'
                        }`}
                      >
                        <div className="relative h-12 w-12 overflow-hidden rounded-full bg-stone-100">
                          <Image
                            src={cat.image}
                            alt={cat.name}
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="text-xs font-bold text-stone-800 truncate max-w-[84px]">
                          {cat.name}
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            )}

            {/* Search & Filter Bar */}
            <section className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by restaurant name, cuisine (Italian, Indian, Sushi) or dish..."
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 py-2.5 text-xs font-medium text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-500">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-800 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="rating">Rating (High to Low)</option>
                    <option value="delivery_time">Delivery Time</option>
                    <option value="cost_asc">Cost: Low to High</option>
                    <option value="cost_desc">Cost: High to Low</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDietFilter((p) => (p === 'veg' ? 'all' : 'veg'))}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    dietFilter === 'veg'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Pure Veg
                </button>
                <button
                  type="button"
                  onClick={() => setDietFilter((p) => (p === 'nonveg' ? 'all' : 'nonveg'))}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    dietFilter === 'nonveg'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Non-Veg
                </button>
                <button
                  type="button"
                  onClick={() => setRating4Plus((p) => !p)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    rating4Plus
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Rating 4.0+ ★
                </button>
                <button
                  type="button"
                  onClick={() => setFastDeliveryOnly((p) => !p)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    fastDeliveryOnly
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Fast Delivery (≤25m)
                </button>
                <button
                  type="button"
                  onClick={() => setFreeDeliveryOnly((p) => !p)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    freeDeliveryOnly
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Free Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setUnder15Only((p) => !p)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    under15Only
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Dishes Under $15
                </button>
              </div>
            </section>

            {/* Restaurant Grid */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-extrabold text-stone-900">
                  {section === 'search'
                    ? `Search Results (${filteredRestaurants.length})`
                    : `Top Restaurants in ${deliveryZone.name} (${filteredRestaurants.length})`}
                </h2>
              </div>

              {filteredRestaurants.length === 0 ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center">
                  <Store className="mx-auto h-10 w-10 text-stone-400 mb-3" />
                  <h3 className="font-display text-lg font-bold text-stone-900">
                    No matching restaurants found
                  </h3>
                  <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
                    Try clearing your active filters or switching to a serviceable San Francisco
                    delivery zone.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategoryId('all');
                      setDietFilter('all');
                      setRating4Plus(false);
                      setFastDeliveryOnly(false);
                      setFreeDeliveryOnly(false);
                      setUnder15Only(false);
                    }}
                    className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRestaurants.map((rest) => (
                    <SwiggyZomatoRestaurantCard
                      key={rest.id}
                      restaurant={rest}
                      isFavorite={userFavorites.includes(rest.id)}
                      onToggleFavorite={(id) => void handleToggleFavorite(id)}
                      onSelect={(id) => router.push(`/customer/restaurant/${id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================== 2. RESTAURANT DETAIL & MENU PAGE ==================== */}
        {section === 'restaurant-detail' && appData && (
          <div>
            {(() => {
              const restaurant =
                appData.restaurants.find((r) => r.id === entityId) || appData.restaurants[0];
              if (!restaurant) return null;

              const restFoods = appData.foodItems
                .filter((f) => f.restaurantId === restaurant.id)
                .filter((f) =>
                  menuSearch.trim()
                    ? f.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                      f.description.toLowerCase().includes(menuSearch.toLowerCase())
                    : true
                )
                .filter((f) => (menuVegOnly ? f.isVeg : true))
                .filter((f) => (menuNonVegOnly ? !f.isVeg : true))
                .filter((f) => (menuBestsellerOnly ? f.isBestseller || f.isPopular : true))
                .filter((f) =>
                  activeMenuSection === 'All'
                    ? true
                    : (f.sectionName || 'Recommended') === activeMenuSection
                );

              const sections = [
                'All',
                ...Array.from(
                  new Set(
                    appData.foodItems
                      .filter((f) => f.restaurantId === restaurant.id)
                      .map((f) => f.sectionName || 'Recommended')
                  )
                ),
              ];

              return (
                <div className="space-y-6">
                  <button
                    type="button"
                    onClick={() => router.push('/customer/restaurants')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Restaurants
                  </button>

                  {/* Restaurant Hero Header */}
                  <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                    <div className="relative h-52 sm:h-64 w-full bg-stone-900">
                      <Image
                        src={restaurant.bannerImage || restaurant.image}
                        alt={restaurant.name}
                        fill
                        className="object-cover opacity-85"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                      <div className="absolute bottom-5 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-xs font-extrabold">
                              ★ {restaurant.rating.toFixed(1)} ({restaurant.reviewCount}+ ratings)
                            </span>
                            <span className="rounded-lg bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold">
                              {restaurant.deliveryTimeMinutes} mins
                            </span>
                            <span
                              className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                                restaurant.isAvailable ? 'bg-emerald-500/30' : 'bg-red-500/40'
                              }`}
                            >
                              {restaurant.isAvailable ? 'Open Now' : 'Currently Closed'}
                            </span>
                          </div>
                          <h1 className="font-display text-2xl sm:text-4xl font-extrabold">
                            {restaurant.name}
                          </h1>
                          <p className="text-xs sm:text-sm text-stone-200 mt-1">
                            {restaurant.cuisine.join(' • ')} — {restaurant.address}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(restaurant.id, e)}
                          className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                            userFavorites.includes(restaurant.id)
                              ? 'bg-red-600 text-white'
                              : 'bg-white/95 text-stone-900 hover:bg-white'
                          }`}
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              userFavorites.includes(restaurant.id) ? 'fill-white' : ''
                            }`}
                          />
                          {userFavorites.includes(restaurant.id) ? 'Saved' : 'Save Restaurant'}
                        </button>
                      </div>
                    </div>

                    {/* Menu Search & Dietary Filters */}
                    <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          type="text"
                          value={menuSearch}
                          onChange={(e) => setMenuSearch(e.target.value)}
                          placeholder={`Search in ${restaurant.name} menu...`}
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 py-2 text-xs font-medium focus:border-orange-500 focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuVegOnly((p) => !p);
                            setMenuNonVegOnly(false);
                          }}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                            menuVegOnly
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-stone-200 bg-white text-stone-700'
                          }`}
                        >
                          Veg Only
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuNonVegOnly((p) => !p);
                            setMenuVegOnly(false);
                          }}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                            menuNonVegOnly
                              ? 'border-red-600 bg-red-50 text-red-700'
                              : 'border-stone-200 bg-white text-stone-700'
                          }`}
                        >
                          Non-Veg Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setMenuBestsellerOnly((p) => !p)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                            menuBestsellerOnly
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-stone-200 bg-white text-stone-700'
                          }`}
                        >
                          ★ Bestsellers
                        </button>
                      </div>
                    </div>

                    {/* Sticky Menu Category Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 bg-stone-50 border-b border-stone-200/70">
                      {sections.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setActiveMenuSection(sec)}
                          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            activeMenuSection === sec
                              ? 'bg-stone-900 text-white'
                              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {sec}
                        </button>
                      ))}
                    </div>

                    {/* Dish Items List */}
                    <div className="divide-y divide-stone-100 p-4 sm:p-6">
                      {restFoods.map((food) => {
                        const qtyInCart = cart
                          .filter((i) => i.foodItem.id === food.id)
                          .reduce((s, i) => s + i.quantity, 0);

                        return (
                          <div
                            key={food.id}
                            className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start justify-between gap-4"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-4 w-4 items-center justify-center rounded-xs border ${
                                    food.isVeg ? 'border-emerald-600' : 'border-red-600'
                                  }`}
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      food.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                                    }`}
                                  />
                                </span>
                                {(food.isBestseller || food.isPopular) && (
                                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                                    ★ BESTSELLER
                                  </span>
                                )}
                                <span className="text-[11px] font-semibold text-stone-400">
                                  {food.sectionName || 'Recommended'}
                                </span>
                              </div>
                              <h3 className="font-display text-base font-bold text-stone-900">
                                {food.name}
                              </h3>
                              <div className="text-sm font-extrabold text-stone-900">
                                ${food.price.toFixed(2)}
                              </div>
                              <p className="text-xs text-stone-500 leading-relaxed max-w-xl">
                                {food.description}
                              </p>
                            </div>

                            <div className="flex sm:flex-col items-center gap-3 self-end sm:self-center">
                              <div className="relative h-24 w-28 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                                <Image
                                  src={food.image}
                                  alt={food.name}
                                  fill
                                  className="object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>

                              {!food.isAvailable || !restaurant.isAvailable ? (
                                <span className="rounded-xl bg-stone-100 px-3 py-1.5 text-[11px] font-bold text-stone-400">
                                  Unavailable
                                </span>
                              ) : qtyInCart > 0 &&
                                (!food.customizations || food.customizations.length === 0) ? (
                                <div className="inline-flex items-center gap-3 rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const entry = cart.find((i) => i.foodItem.id === food.id);
                                      if (entry) updateCartQty(entry.cartItemId, -1);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span>{qtyInCart}</span>
                                  <button
                                    type="button"
                                    onClick={() => openFoodAddition(food)}
                                    className="cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openFoodAddition(food)}
                                  className="rounded-xl border-2 border-orange-600 bg-orange-50/60 px-5 py-1.5 text-xs font-extrabold text-orange-600 hover:bg-orange-600 hover:text-white transition-colors cursor-pointer"
                                >
                                  ADD +
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ==================== 3. CART PAGE ==================== */}
        {section === 'cart' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-extrabold text-stone-900">
                Your FoodHub Cart
              </h1>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center space-y-4">
                <ShoppingBag className="mx-auto h-12 w-12 text-stone-300" />
                <h2 className="font-display text-xl font-bold text-stone-900">Your cart is empty</h2>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Explore top-rated local restaurants and add your favorite dishes to get started.
                </p>
                <Link
                  href="/customer/restaurants"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-6 py-3 text-xs font-bold text-white hover:bg-orange-700"
                >
                  Browse Restaurants
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                  {cartRestaurant && (
                    <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-orange-600">
                          Ordering From
                        </span>
                        <h3 className="font-display text-lg font-extrabold text-stone-900">
                          {cartRestaurant.name}
                        </h3>
                      </div>
                      <Link
                        href={`/customer/restaurant/${cartRestaurant.id}`}
                        className="text-xs font-bold text-orange-600 hover:underline"
                      >
                        + Add More Items
                      </Link>
                    </div>
                  )}

                  <div className="divide-y divide-stone-100">
                    {cart.map((item) => {
                      const addonTotal = item.selectedCustomizations.reduce(
                        (s, c) => s + c.price,
                        0
                      );
                      const linePrice = (item.foodItem.price + addonTotal) * item.quantity;
                      return (
                        <div
                          key={item.cartItemId}
                          className="py-4 flex items-center justify-between gap-4"
                        >
                          <div>
                            <h4 className="text-sm font-bold text-stone-900">
                              {item.foodItem.name}
                            </h4>
                            {item.selectedCustomizations.length > 0 && (
                              <p className="text-[11px] text-stone-500">
                                {item.selectedCustomizations.map((c) => c.optionName).join(', ')}
                              </p>
                            )}
                            <span className="text-xs font-bold text-stone-700">
                              ${linePrice.toFixed(2)}
                            </span>
                          </div>

                          <div className="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.cartItemId, -1)}
                              className="text-stone-600 hover:text-orange-600 cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.cartItemId, 1)}
                              className="text-stone-600 hover:text-orange-600 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bill Breakdown */}
                <div className="lg:col-span-5 rounded-3xl border border-stone-200 bg-white p-6 space-y-4 h-fit">
                  <h3 className="font-display text-base font-extrabold text-stone-900">
                    Offers &amp; Bill Summary
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter promo code"
                      className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-mono font-bold uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon(couponInput)}
                      className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-stone-100 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Item Subtotal</span>
                      <span className="font-semibold">${cartSummary.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Delivery Partner Fee</span>
                      <span className="font-semibold">${cartSummary.deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Restaurant Packaging</span>
                      <span className="font-semibold">${cartSummary.packagingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Taxes &amp; Charges (8%)</span>
                      <span className="font-semibold">${cartSummary.taxes.toFixed(2)}</span>
                    </div>
                    {cartSummary.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Coupon Discount ({appliedCouponCode})</span>
                        <span>-${cartSummary.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-3 border-t border-stone-200 text-base font-extrabold text-stone-950">
                      <span>To Pay</span>
                      <span>${cartSummary.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/customer/checkout')}
                    className="w-full rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 hover:from-orange-700 hover:to-red-700 cursor-pointer"
                  >
                    Proceed to Checkout →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 4. CHECKOUT PAGE ==================== */}
        {section === 'checkout' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <button
              type="button"
              onClick={() => router.push('/customer/cart')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Cart
            </button>

            <h1 className="font-display text-2xl font-extrabold text-stone-900">
              Confirm Delivery &amp; Place Order
            </h1>

            {cart.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center">
                <p className="text-sm text-stone-600">Your cart is empty.</p>
                <Link
                  href="/customer/restaurants"
                  className="mt-4 inline-block rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white"
                >
                  Browse Restaurants
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-5">
                  {/* Delivery Address Selector */}
                  <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-extrabold text-stone-900 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-orange-600" />
                        Select Delivery Address
                      </h2>
                      <button
                        type="button"
                        onClick={() => setAddAddressModalOpen(true)}
                        className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                      >
                        + Add New Address
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {userAddresses.map((addr) => {
                        const isSelected =
                          (selectedAddressId || userAddresses.find((a) => a.isDefault)?.id) ===
                          addr.id;
                        return (
                          <div
                            key={addr.id}
                            onClick={() => setSelectedAddressId(addr.id)}
                            className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-orange-600 bg-orange-50/40'
                                : 'border-stone-200 bg-stone-50/40 hover:border-stone-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="rounded-md bg-stone-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                {addr.label}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-orange-600" />
                              )}
                            </div>
                            <p className="mt-2 text-xs font-bold text-stone-900">
                              {addr.recipientName} • {addr.phone}
                            </p>
                            <p className="text-xs text-stone-600">
                              {addr.street}, {addr.city}, {addr.state} {addr.postalCode}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Instructions */}
                  <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
                    <h2 className="font-display text-base font-extrabold text-stone-900">
                      Delivery Instructions
                    </h2>
                    <textarea
                      rows={2}
                      value={deliveryInstructions}
                      onChange={(e) => setDeliveryInstructions(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-800 focus:border-orange-500 focus:bg-white focus:outline-none"
                      placeholder="Gate code, drop-off preference, landmark..."
                    />
                  </div>
                </div>

                {/* One-Click Order Confirmation Card */}
                <div className="lg:col-span-5 rounded-3xl border border-stone-200 bg-white p-6 space-y-4 h-fit">
                  <h3 className="font-display text-base font-extrabold text-stone-900">
                    Order Summary ({cartRestaurant?.name})
                  </h3>

                  <div className="space-y-2 text-xs border-b border-stone-100 pb-3">
                    {cart.map((i) => (
                      <div key={i.cartItemId} className="flex justify-between">
                        <span>
                          {i.quantity}× {i.foodItem.name}
                        </span>
                        <span className="font-semibold">
                          ${(i.foodItem.price * i.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span>${cartSummary.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Delivery &amp; Packaging</span>
                      <span>
                        ${(cartSummary.deliveryFee + cartSummary.packagingFee).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Taxes</span>
                      <span>${cartSummary.taxes.toFixed(2)}</span>
                    </div>
                    {cartSummary.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Discount ({appliedCouponCode})</span>
                        <span>-${cartSummary.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-stone-200 text-base font-extrabold text-stone-950">
                      <span>Total Payable</span>
                      <span>${cartSummary.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={placingOrder}
                    onClick={handlePlaceOrder}
                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {placingOrder
                      ? 'Confirming Order with Kitchen...'
                      : `Place Order Instantly ($${cartSummary.grandTotal.toFixed(2)})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 5. ORDERS & LIVE TRACKING ==================== */}
        {(section === 'orders' || section === 'order-detail') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-stone-900">
                  {section === 'order-detail' ? 'Live Order Tracking' : 'Your Orders'}
                </h1>
                <p className="text-xs text-stone-500">
                  Real-time kitchen preparation &amp; courier GPS status
                </p>
              </div>
                {section === 'order-detail' && (
                  <Link
                    href="/customer/orders"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All Orders
                  </Link>
                )}
              </div>

              {/* Browser Push Notification Control Bar */}
              <div className="rounded-3xl border border-orange-200/90 bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-extrabold text-stone-900">
                        Browser Push Notifications for Live Order Status
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          pushEnabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pushEnabled
                          ? `Active (${pushPermission === 'granted' ? 'Browser Native + In-App' : 'Live Push Ready'})`
                          : 'Permission Needed'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-600">
                      Get instant browser push alerts whenever your order status changes — such as
                      from <strong>&apos;Preparing&apos;</strong> to{' '}
                      <strong>&apos;Out for Delivery&apos;</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleEnableBrowserPush()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-50 cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5 text-orange-600" />
                    {pushEnabled ? 'Re-Verify Push Permission' : 'Enable Browser Push'}
                  </button>

                  {userOrders[0] && (
                    <button
                      type="button"
                      disabled={simulatingOrderId === userOrders[0].id}
                      onClick={() =>
                        void handleTriggerOrderStatusPush(
                          userOrders[0].id,
                          'out_for_delivery',
                          true
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer disabled:opacity-60"
                    >
                      <Truck className="h-3.5 w-3.5 text-orange-400" />
                      {simulatingOrderId === userOrders[0].id
                        ? 'Sending Push Alert...'
                        : "Alert: 'Preparing' → 'Out for Delivery'"}
                    </button>
                  )}
                </div>
              </div>

            {userOrders.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center space-y-3">
                <Package className="mx-auto h-10 w-10 text-stone-300" />
                <h3 className="font-display text-lg font-bold text-stone-900">No orders yet</h3>
                <Link
                  href="/customer/restaurants"
                  className="inline-block rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white"
                >
                  Order Your First Meal
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {(section === 'order-detail'
                  ? userOrders.filter((o) => o.id === entityId || o.orderNumber === entityId)
                  : userOrders
                ).map((order) => {
                  const currentStepIdx = ORDER_STEPS.findIndex((s) => s.status === order.status);
                  return (
                    <div
                      key={order.id}
                      className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-sm font-extrabold text-orange-600">
                              #{order.orderNumber}
                            </span>
                            <span className="rounded-full bg-stone-100 px-3 py-0.5 text-xs font-bold uppercase text-stone-800">
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h2 className="font-display text-xl font-extrabold text-stone-900 mt-1">
                            {order.restaurantName}
                          </h2>
                          <p className="text-xs text-stone-500">
                            Ordered on {new Date(order.createdAt).toLocaleString()} • Total $
                            {order.totalAmount.toFixed(2)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/customer/orders/${order.id}`}
                            className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-800 hover:bg-stone-100"
                          >
                            Track Order
                          </Link>

                          {(order.status === 'placed' || order.status === 'accepted') && (
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(order.id)}
                              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                            >
                              Cancel Order
                            </button>
                          )}

                          {order.status === 'delivered' && (
                            <button
                              type="button"
                              onClick={() => setReviewOrderId(order.id)}
                              className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                            >
                              ★ Rate Order
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={simulatingOrderId === order.id}
                            onClick={() =>
                              void handleTriggerOrderStatusPush(
                                order.id,
                                order.status === 'preparing' ? 'out_for_delivery' : 'out_for_delivery',
                                order.status !== 'preparing'
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 cursor-pointer disabled:opacity-60"
                          >
                            <BellRing className="h-3.5 w-3.5 text-orange-600" />
                            {order.status === 'preparing'
                              ? "Move to 'Out for Delivery' (Push Alert)"
                              : "Test 'Preparing' → 'Out for Delivery' Push"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSupportModalOrder(order.orderNumber);
                              setSupportModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
                          >
                            <HelpCircle className="h-3.5 w-3.5 text-orange-600" />
                            Support
                          </button>
                        </div>
                      </div>

                      {/* 5-Stage Progress Tracker */}
                      {order.status !== 'cancelled' && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {ORDER_STEPS.map((st, idx) => {
                            const done =
                              order.status === 'delivered' ||
                              (currentStepIdx >= 0 && idx <= currentStepIdx);
                            return (
                              <div
                                key={st.status}
                                className={`rounded-2xl border p-3 ${
                                  done
                                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                                    : 'border-stone-200 bg-stone-50 text-stone-400'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 text-xs font-extrabold">
                                  <CheckCircle2
                                    className={`h-4 w-4 ${
                                      done ? 'text-emerald-600' : 'text-stone-300'
                                    }`}
                                  />
                                  <span>{st.label}</span>
                                </div>
                                <p className="mt-1 text-[11px] opacity-80">{st.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Live Map on Order Detail or Active Delivery */}
                      {(section === 'order-detail' ||
                        order.status === 'preparing' ||
                        order.status === 'out_for_delivery') && (
                        <OrderTrackingMap order={order} />
                      )}

                      {/* Items list */}
                      <div className="rounded-2xl bg-stone-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 text-xs">
                          {order.items.map((item) => (
                            <div key={item.id} className="font-semibold text-stone-800">
                              {item.quantity}× {item.name} — ${item.lineTotal.toFixed(2)}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!appData) return;
                            clearCart();
                            order.items.forEach((oi) => {
                              const found = appData.foodItems.find((f) => f.id === oi.foodItemId);
                              if (found) addToCart(found, oi.selectedCustomizations, oi.quantity);
                            });
                            router.push('/customer/cart');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-stone-800 self-start sm:self-center cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reorder Items
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== 6. FAVORITES PAGE ==================== */}
        {section === 'favorites' && appData && (
          <div className="space-y-6">
            <h1 className="font-display text-2xl font-extrabold text-stone-900">
              Saved Favorite Restaurants
            </h1>
            {userFavorites.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center space-y-3">
                <Heart className="mx-auto h-10 w-10 text-stone-300" />
                <h3 className="font-display text-lg font-bold text-stone-900">
                  No favorites saved yet
                </h3>
                <p className="text-xs text-stone-500">
                  Tap the heart icon on any restaurant card to save it here for quick ordering.
                </p>
                <Link
                  href="/customer/restaurants"
                  className="inline-block rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white"
                >
                  Discover Restaurants
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {appData.restaurants
                  .filter((r) => userFavorites.includes(r.id))
                  .map((rest) => (
                    <SwiggyZomatoRestaurantCard
                      key={rest.id}
                      restaurant={rest}
                      isFavorite={true}
                      onToggleFavorite={(id) => void handleToggleFavorite(id)}
                      onSelect={(id) => router.push(`/customer/restaurant/${id}`)}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== 7. PROFILE & SAVED ADDRESSES ==================== */}
        {(section === 'profile' || section === 'addresses') && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
              <Link
                href="/customer/profile"
                className={`rounded-xl px-4 py-2 text-xs font-bold ${
                  section === 'profile'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white text-stone-700 border border-stone-200'
                }`}
              >
                Profile &amp; Security
              </Link>
              <Link
                href="/customer/addresses"
                className={`rounded-xl px-4 py-2 text-xs font-bold ${
                  section === 'addresses'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white text-stone-700 border border-stone-200'
                }`}
              >
                Saved Delivery Addresses ({userAddresses.length})
              </Link>
            </div>

            {section === 'profile' ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
                <div>
                  <h1 className="font-display text-xl font-extrabold text-stone-900">
                    Customer Profile Settings
                  </h1>
                  <p className="text-xs text-stone-500">
                    Manage your personal details and customer account password
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileName || activeUser?.name || ''}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      disabled
                      value={activeUser?.email || ''}
                      className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-sm text-stone-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profilePhone || activeUser?.phone || ''}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Authorized Workspaces
                    </label>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-bold text-stone-700">
                      {(activeUser?.allowedWorkspaces || ['customer']).join(', ').toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Current Password (optional for password update)
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={async () => {
                    if (!activeUser) return;
                    setSavingProfile(true);
                    try {
                      const res = await fetch('/api/state', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'update_profile',
                          userId: activeUser.id,
                          name: profileName || activeUser.name,
                          phone: profilePhone || activeUser.phone,
                          currentPassword: currentPassword || undefined,
                          newPassword: newPassword || undefined,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        showToast(data.error || 'Failed to update profile', 'error');
                        return;
                      }
                      setCurrentPassword('');
                      setNewPassword('');
                      await refreshState(true);
                      showToast('Profile settings saved!');
                    } finally {
                      setSavingProfile(false);
                    }
                  }}
                  className="rounded-2xl bg-orange-600 px-6 py-3 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-extrabold text-stone-900">
                    Saved Delivery Addresses
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAddAddressModalOpen(true)}
                    className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
                  >
                    + Add New Address
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="rounded-2xl border border-stone-200 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-stone-900 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                            {addr.label}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[11px] font-bold text-emerald-600">
                              ✓ Default Address
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs font-bold text-stone-900">
                          {addr.recipientName} • {addr.phone}
                        </p>
                        <p className="text-xs text-stone-600">
                          {addr.street}, {addr.city}, {addr.state} {addr.postalCode}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-2 border-t border-stone-100 text-xs">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!activeUser) return;
                              await fetch('/api/state', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'set_default_address',
                                  userId: activeUser.id,
                                  addressId: addr.id,
                                }),
                              });
                              await refreshState(true);
                              showToast('Default delivery address updated.');
                            }}
                            className="font-bold text-orange-600 hover:underline cursor-pointer"
                          >
                            Set as Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch('/api/state', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'delete_address',
                                addressId: addr.id,
                              }),
                            });
                            await refreshState(true);
                            showToast('Address removed.', 'info');
                          }}
                          className="font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {section === 'support' && (
          <CustomerSupportCenter
            currentUser={activeUser || null}
            orders={userOrders}
            tickets={appData?.supportTicketReferences || []}
            activeApiKey={
              appData?.yantraConfig.apiKey ||
              'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E'
            }
            onRefreshState={async () => {
              await refreshState(true);
            }}
            onOpenFloatingWidget={(ordNum) => {
              setSupportModalOrder(ordNum);
              setSupportModalOpen(true);
            }}
            onNotify={showToast}
          />
        )}
      </main>

      {/* Sticky Bottom Cart Bar when items are in cart */}
      {cart.length > 0 && section !== 'cart' && section !== 'checkout' && (
        <div className="fixed bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl rounded-2xl bg-emerald-700 px-5 py-3.5 text-white shadow-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider">
              {cartSummary.itemCount} {cartSummary.itemCount === 1 ? 'Item' : 'Items'} • $
              {cartSummary.subtotal.toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-100">
              From {cartRestaurant?.name || 'FoodHub Kitchen'}
            </div>
          </div>
          <Link
            href="/customer/cart"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-50"
          >
            View Cart &amp; Checkout
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Slide-Over Cart Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full flex flex-col justify-between p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <h2 className="font-display text-lg font-extrabold text-stone-900">
                Quick Cart ({cartSummary.itemCount})
              </h2>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 divide-y divide-stone-100">
              {cart.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-12">Your cart is empty.</p>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-stone-900">{item.foodItem.name}</p>
                      <p className="text-[11px] text-stone-500">
                        ${(item.foodItem.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.cartItemId, -1)}
                        className="cursor-pointer"
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.cartItemId, 1)}
                        className="cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-stone-200 pt-4 space-y-3">
                <div className="flex justify-between text-sm font-extrabold">
                  <span>Estimated Total</span>
                  <span>${cartSummary.grandTotal.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      router.push('/customer/cart');
                    }}
                    className="rounded-xl border border-stone-200 py-3 text-xs font-bold text-stone-800 hover:bg-stone-50 cursor-pointer"
                  >
                    Open Full Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      router.push('/customer/checkout');
                    }}
                    className="rounded-xl bg-orange-600 py-3 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
                  >
                    Checkout →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dish Customization Modal */}
      {customizingFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-extrabold text-stone-900">
                  Customize {customizingFood.name}
                </h3>
                <p className="text-xs text-stone-500">Base price ${customizingFood.price.toFixed(2)}</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingFood(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {customizingFood.customizations.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-800">{group.title}</span>
                    <span className="text-[10px] font-bold uppercase text-stone-400">
                      {group.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.options.map((opt) => {
                      const isChecked = selectedCustomizations.some(
                        (c) => c.groupTitle === group.title && c.optionName === opt.name
                      );
                      return (
                        <label
                          key={opt.name}
                          className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2 text-xs cursor-pointer hover:bg-stone-50"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedCustomizations((prev) => {
                                  if (isChecked) {
                                    return prev.filter(
                                      (c) =>
                                        !(
                                          c.groupTitle === group.title &&
                                          c.optionName === opt.name
                                        )
                                    );
                                  }
                                  const withoutGroup = group.required
                                    ? prev.filter((c) => c.groupTitle !== group.title)
                                    : prev;
                                  return [
                                    ...withoutGroup,
                                    {
                                      groupTitle: group.title,
                                      optionName: opt.name,
                                      price: opt.price,
                                    },
                                  ];
                                });
                              }}
                            />
                            <span className="font-semibold text-stone-800">{opt.name}</span>
                          </div>
                          <span className="text-stone-500">
                            {opt.price > 0 ? `+$${opt.price.toFixed(2)}` : 'Free'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                addToCart(customizingFood, selectedCustomizations, customQty, customNotes);
                setCustomizingFood(null);
              }}
              className="w-full rounded-2xl bg-orange-600 py-3 text-xs font-extrabold text-white hover:bg-orange-700 cursor-pointer"
            >
              Add Item to Cart
            </button>
          </div>
        </div>
      )}

      {/* Rate & Review Modal */}
      {reviewOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <form
            onSubmit={handleSubmitReview}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-display text-lg font-extrabold text-stone-900">
              Rate Your Order Experience
            </h3>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className={`rounded-xl px-3 py-2 text-sm font-bold cursor-pointer ${
                    reviewRating >= star
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  ★ {star}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              required
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share feedback on food quality, packaging, and delivery speed..."
              className="w-full rounded-xl border border-stone-200 p-3 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewOrderId(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-bold text-white"
              >
                Submit Review
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Location Selector, Multi-Restaurant Conflict, Add Address & Support Modals */}
      <LocationSelectorModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        selectedZone={
          DELIVERY_ZONES.find(
            (z) => z.name.toLowerCase() === deliveryZone.name.toLowerCase()
          ) || DELIVERY_ZONES[0]
        }
        onSelectZone={(zone) => {
          setDeliveryZone({
            name: zone.name,
            address: zone.city,
            eta: `${20 + zone.etaBonusMinutes}–${28 + zone.etaBonusMinutes} mins`,
            isServiceable: zone.isServiceable,
          });
          setLocationModalOpen(false);
        }}
      />

      <MultiRestaurantConflictModal
        open={Boolean(conflictPendingItem)}
        existingRestaurantName={cartRestaurant?.name || 'current restaurant'}
        newRestaurantName={
          appData?.restaurants.find((r) => r.id === conflictPendingItem?.food.restaurantId)?.name ||
          'new restaurant'
        }
        onCancel={() => setConflictPendingItem(null)}
        onConfirmReplace={confirmReplaceCartConflict}
      />

      <AddAddressModal
        open={addAddressModalOpen}
        onClose={() => setAddAddressModalOpen(false)}
        defaultRecipientName={activeUser?.name || 'Customer'}
        defaultPhone={activeUser?.phone || '+1 (415) 555-0199'}
        onSave={async (addr) => {
          if (!activeUser) return;
          await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_address',
              userId: activeUser.id,
              address: addr,
            }),
          });
          setAddAddressModalOpen(false);
          await refreshState(true);
          showToast('Saved new delivery address!');
        }}
      />

      <YantraSupportWidget
        currentUser={activeUser || null}
        orders={userOrders}
        tickets={appData?.supportTicketReferences || []}
        activeApiKey={
          appData?.yantraConfig.apiKey ||
          'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E'
        }
        onRefreshState={async () => {
          await refreshState(true);
        }}
        externalOpenRequest={
          supportModalOpen
            ? {
                open: true,
                orderNumber: supportModalOrder,
              }
            : null
        }
        onClearExternalRequest={() => setSupportModalOpen(false)}
        onNotify={showToast}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-stone-200 bg-white py-2.5 text-[11px] font-bold text-stone-600">
        <Link
          href="/customer/home"
          className={`flex flex-col items-center gap-0.5 ${
            section === 'home' ? 'text-orange-600' : ''
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </Link>
        <Link
          href="/customer/restaurants"
          className={`flex flex-col items-center gap-0.5 ${
            section === 'restaurants' ? 'text-orange-600' : ''
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Restaurants</span>
        </Link>
        <Link
          href="/customer/orders"
          className={`flex flex-col items-center gap-0.5 ${
            section === 'orders' ? 'text-orange-600' : ''
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Orders</span>
        </Link>
        <Link
          href="/customer/support"
          className={`flex flex-col items-center gap-0.5 ${
            section === 'support' ? 'text-orange-600' : ''
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Support</span>
        </Link>
        <Link
          href="/customer/profile"
          className={`flex flex-col items-center gap-0.5 ${
            section === 'profile' ? 'text-orange-600' : ''
          }`}
        >
          <User className="h-4 w-4" />
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  );
}
