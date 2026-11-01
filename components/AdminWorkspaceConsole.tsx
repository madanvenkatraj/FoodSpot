'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Edit3,
  ExternalLink,
  Flame,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import AdminYantraConsole from '@/components/AdminYantraConsole';
import type { OrderStatus, WorkspaceType } from '@/lib/db/models';
import { broadcastOrderStatusChangeAcrossTabs } from '@/lib/notifications/pushClient';

export type AdminRouteSection =
  | 'dashboard'
  | 'restaurants'
  | 'restaurant-create'
  | 'restaurant-detail'
  | 'menu'
  | 'orders'
  | 'order-detail'
  | 'customers'
  | 'offers'
  | 'support'
  | 'settings';

interface AdminWorkspaceConsoleProps {
  section: AdminRouteSection;
  entityId?: string;
}

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'placed', label: 'Placed' },
  { value: 'accepted', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminWorkspaceConsole({
  section,
  entityId,
}: AdminWorkspaceConsoleProps) {
  const router = useRouter();
  const {
    appData,
    loadingData,
    refreshState,
    adminUser,
    adminToken,
    logoutAdmin,
    showToast,
  } = useWorkspace();

  // Restaurant filter & form state
  const [restSearch, setRestSearch] = useState('');
  const [restForm, setRestForm] = useState({
    name: '',
    cuisine: 'Italian, Wood-Fired Pizza',
    description: 'Artisanal neighborhood kitchen freshly preparing signature dishes.',
    address: '450 Mission Street, San Francisco, CA 94105',
    phone: '+1 (415) 555-0188',
    openingHours: '10:00 AM – 11:00 PM',
    deliveryTimeMinutes: 26,
    deliveryFee: 2.49,
    minOrderAmount: 15,
    costForTwo: 35,
    image: '/images/dish-pizza.svg',
    promoTag: '20% OFF UPTO $10',
    isAvailable: true,
  });

  // Menu item filter & form state
  const [selectedRestForMenu, setSelectedRestForMenu] = useState<string>('rest_1');
  const [menuSearch, setMenuSearch] = useState('');
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState({
    name: '',
    categoryId: 'cat_pizza',
    sectionName: 'Recommended',
    description: '',
    price: 16.99,
    image: '/images/dish-pizza.svg',
    isVeg: true,
    isAvailable: true,
    isBestseller: false,
  });

  // Category quick creation state
  const [catName, setCatName] = useState('');
  const [catImage, setCatImage] = useState('/images/dish-pizza.svg');

  // Orders filter state
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState('');

  // Customers filter state
  const [customerSearch, setCustomerSearch] = useState('');

  // Coupon form state
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed' | 'free_delivery',
    discountValue: 25,
    minOrderValue: 20,
    maxDiscount: 12,
    expiresAt: '2027-12-31T23:59:59.000Z',
  });

  // Admin Settings & Provisioning state
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [rotatedMfaData, setRotatedMfaData] = useState<{
    mfaSecret: string;
    recoveryCodes: string[];
  } | null>(null);

  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    email: '',
    phone: '+1 (415) 890-9900',
    password: '',
    grantCustomerWorkspace: false,
  });
  const [provisionedAdminResult, setProvisionedAdminResult] = useState<{
    email: string;
    mfaSecret: string;
    recoveryCodes: string[];
  } | null>(null);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    }),
    [adminToken]
  );

  // Dashboard Metrics
  const metrics = useMemo(() => {
    if (!appData) {
      return {
        totalRestaurants: 0,
        totalMenuItems: 0,
        totalOrders: 0,
        activeOrders: 0,
        completedOrders: 0,
        totalCustomers: 0,
        totalRevenue: 0,
      };
    }
    const activeStatuses: OrderStatus[] = [
      'placed',
      'accepted',
      'preparing',
      'ready_for_pickup',
      'picked_up',
      'out_for_delivery',
    ];
    const completed = appData.orders.filter((o) => o.status === 'delivered');
    const active = appData.orders.filter((o) => activeStatuses.includes(o.status));
    const revenue = appData.orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      totalRestaurants: appData.restaurants.length,
      totalMenuItems: appData.foodItems.length,
      totalOrders: appData.orders.length,
      activeOrders: active.length,
      completedOrders: completed.length,
      totalCustomers: appData.users.filter((u) => u.allowedWorkspaces?.includes('customer')).length,
      totalRevenue: Number(revenue.toFixed(2)),
    };
  }, [appData]);

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        orderId,
        status: nextStatus,
        actorRole: 'admin',
        note: `Updated to ${nextStatus.replace(/_/g, ' ')} via FoodHub Admin Console`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to update order status', 'error');
      return;
    }
    if (data.order) {
      broadcastOrderStatusChangeAcrossTabs({
        orderId: data.order.id,
        orderNumber: data.order.orderNumber,
        restaurantName: data.order.restaurantName,
        previousStatus: data.previousStatus,
        newStatus: data.order.status,
      });
    }
    await refreshState(true);
    showToast(`Order status updated to ${nextStatus.replace(/_/g, ' ').toUpperCase()}`);
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'create_restaurant',
        restaurant: {
          ...restForm,
          cuisine: restForm.cuisine
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not create restaurant', 'error');
      return;
    }
    await refreshState(true);
    showToast(`Created restaurant "${data.restaurant.name}"!`);
    router.push('/admin/restaurants');
  };

  const handleDeleteRestaurant = async (restaurantId: string, name: string) => {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'delete_restaurant',
        restaurantId,
      }),
    });
    if (!res.ok) {
      showToast('Failed to delete restaurant', 'error');
      return;
    }
    await refreshState(true);
    showToast(`Deleted restaurant "${name}".`, 'info');
  };

  const handleUpsertFoodItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'upsert_food_item',
        item: {
          ...(editingFoodId ? { id: editingFoodId } : {}),
          restaurantId: selectedRestForMenu,
          ...foodForm,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to save menu item', 'error');
      return;
    }
    setEditingFoodId(null);
    setFoodForm({
      name: '',
      categoryId: 'cat_pizza',
      sectionName: 'Recommended',
      description: '',
      price: 16.99,
      image: '/images/dish-pizza.svg',
      isVeg: true,
      isAvailable: true,
      isBestseller: false,
    });
    await refreshState(true);
    showToast('Menu item saved!');
  };

  if (loadingData && !appData) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 p-8">
        <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
          <div className="h-14 rounded-2xl bg-stone-800" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-32 rounded-2xl bg-stone-800" />
            <div className="h-32 rounded-2xl bg-stone-800" />
            <div className="h-32 rounded-2xl bg-stone-800" />
            <div className="h-32 rounded-2xl bg-stone-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col lg:flex-row">
      {/* Left Admin Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 bg-stone-950 text-stone-200 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-stone-800">
        <div>
          <div className="flex items-center justify-between px-5 py-5 border-b border-stone-800">
            <Link href="/admin/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-stone-950 font-extrabold shadow-md">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display text-base font-extrabold text-white block leading-none">
                  FoodHub
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Admin Console
                </span>
              </div>
            </Link>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'dashboard'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>

            <Link
              href="/admin/restaurants"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'restaurants' ||
                section === 'restaurant-create' ||
                section === 'restaurant-detail'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <Store className="h-4 w-4" />
              Restaurants
            </Link>

            <Link
              href="/admin/menu"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'menu'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Menus &amp; Categories
            </Link>

            <Link
              href="/admin/orders"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'orders' || section === 'order-detail'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Orders ({metrics.activeOrders} active)
            </Link>

            <Link
              href="/admin/customers"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'customers'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Customers &amp; RBAC
            </Link>

            <Link
              href="/admin/offers"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'offers'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <Tag className="h-4 w-4" />
              Offers &amp; Coupons
            </Link>

            <Link
              href="/admin/support"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'support'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <Activity className="h-4 w-4" />
              Yantra Support &amp; Webhooks
            </Link>

            <Link
              href="/admin/settings"
              className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                section === 'settings'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings &amp; Security
            </Link>
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-stone-800 space-y-2">
          <div className="rounded-xl bg-stone-900 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin MFA Session
            </div>
            <p className="mt-1 truncate font-semibold text-white">
              {adminUser?.name || 'Administrator'}
            </p>
            <p className="truncate text-[11px] text-stone-400">{adminUser?.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex-1 rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-center text-xs font-bold text-stone-300 hover:bg-stone-800"
            >
              Switch Workspace
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logoutAdmin();
                router.push('/admin/login');
              }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-extrabold text-stone-900 capitalize">
              {section.replace(/-/g, ' ')}
            </h1>
            <p className="text-xs text-stone-500">
              FoodHub Administrative Operations • Real-Time Synchronization with Customer App
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshState(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link
              href="/"
              className="lg:hidden rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700"
            >
              Workspaces
            </Link>
          </div>
        </header>

        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* ==================== 6.A ADMIN DASHBOARD ==================== */}
          {section === 'dashboard' && appData && (
            <div className="space-y-6">
              {/* 7 Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-stone-400">
                    Restaurants
                  </span>
                  <div className="mt-1 font-display text-2xl font-extrabold text-stone-900">
                    {metrics.totalRestaurants}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-stone-400">Menu Items</span>
                  <div className="mt-1 font-display text-2xl font-extrabold text-stone-900">
                    {metrics.totalMenuItems}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-stone-400">
                    Total Orders
                  </span>
                  <div className="mt-1 font-display text-2xl font-extrabold text-stone-900">
                    {metrics.totalOrders}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-amber-800">
                    Active Orders
                  </span>
                  <div className="mt-1 font-display text-2xl font-extrabold text-amber-900">
                    {metrics.activeOrders}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-emerald-800">
                    Completed
                  </span>
                  <div className="mt-1 font-display text-2xl font-extrabold text-emerald-900">
                    {metrics.completedOrders}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-stone-400">Customers</span>
                  <div className="mt-1 font-display text-2xl font-extrabold text-stone-900">
                    {metrics.totalCustomers}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-900 bg-stone-900 text-white p-4 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-amber-400">Revenue</span>
                  <div className="mt-1 font-display text-2xl font-extrabold">
                    ${metrics.totalRevenue.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Recent Orders & Restaurant Status */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-extrabold text-stone-900">
                      Recent Platform Orders
                    </h2>
                    <Link
                      href="/admin/orders"
                      className="text-xs font-bold text-orange-600 hover:underline"
                    >
                      Manage All Orders →
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400 uppercase">
                          <th className="py-2.5">Order #</th>
                          <th className="py-2.5">Customer</th>
                          <th className="py-2.5">Restaurant</th>
                          <th className="py-2.5">Total</th>
                          <th className="py-2.5">Status</th>
                          <th className="py-2.5 text-right">Quick Update</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {appData.orders.slice(0, 8).map((ord) => (
                          <tr key={ord.id}>
                            <td className="py-3 font-mono font-bold text-orange-600">
                              <Link href={`/admin/orders/${ord.id}`}>#{ord.orderNumber}</Link>
                            </td>
                            <td className="py-3 font-semibold text-stone-800">
                              {ord.customerName}
                            </td>
                            <td className="py-3 text-stone-600">{ord.restaurantName}</td>
                            <td className="py-3 font-bold">${ord.totalAmount.toFixed(2)}</td>
                            <td className="py-3">
                              <span className="rounded-lg bg-stone-100 px-2.5 py-1 font-bold uppercase text-[10px]">
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <select
                                value={ord.status}
                                onChange={(e) =>
                                  handleUpdateOrderStatus(ord.id, e.target.value as OrderStatus)
                                }
                                className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-bold"
                              >
                                {ORDER_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Restaurant Status & Popular Items */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-extrabold text-stone-900">
                        Restaurant Status
                      </h2>
                      <Link
                        href="/admin/restaurants/create"
                        className="text-xs font-bold text-orange-600 hover:underline"
                      >
                        + Add New
                      </Link>
                    </div>
                    <div className="space-y-2.5">
                      {appData.restaurants.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-stone-900">{r.name}</p>
                            <p className="text-[11px] text-stone-500">
                              ★ {r.rating.toFixed(1)} • {r.deliveryTimeMinutes}m
                            </p>
                          </div>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              r.isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.isAvailable ? 'Open' : 'Closed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6.B RESTAURANT MANAGEMENT ==================== */}
          {section === 'restaurants' && appData && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={restSearch}
                    onChange={(e) => setRestSearch(e.target.value)}
                    placeholder="Search restaurants by name, cuisine or address..."
                    className="w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 py-2.5 text-xs"
                  />
                </div>
                <Link
                  href="/admin/restaurants/create"
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-stone-800"
                >
                  <Plus className="h-4 w-4" />
                  Add New Restaurant
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {appData.restaurants
                  .filter(
                    (r) =>
                      !restSearch.trim() ||
                      r.name.toLowerCase().includes(restSearch.toLowerCase()) ||
                      r.cuisine.join(' ').toLowerCase().includes(restSearch.toLowerCase())
                  )
                  .map((rest) => (
                    <div
                      key={rest.id}
                      className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-display text-lg font-extrabold text-stone-900">
                              {rest.name}
                            </h3>
                            <p className="text-xs text-stone-500">{rest.cuisine.join(' • ')}</p>
                          </div>
                          <span
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                              rest.isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {rest.isAvailable ? 'Open' : 'Closed'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-stone-600">{rest.address}</p>
                        <div className="mt-3 flex items-center gap-3 text-xs font-bold text-stone-700">
                          <span>★ {rest.rating.toFixed(1)}</span>
                          <span>•</span>
                          <span>{rest.deliveryTimeMinutes} mins</span>
                          <span>•</span>
                          <span>Fee ${rest.deliveryFee.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100">
                        <Link
                          href={`/admin/restaurants/${rest.id}`}
                          className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100"
                        >
                          Edit Details
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch('/api/state', {
                              method: 'POST',
                              headers: authHeaders,
                              body: JSON.stringify({
                                action: 'update_restaurant',
                                restaurantId: rest.id,
                                updates: { isAvailable: !rest.isAvailable },
                              }),
                            });
                            await refreshState(true);
                            showToast(`Updated ${rest.name} availability.`);
                          }}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
                        >
                          {rest.isAvailable ? 'Set Closed' : 'Set Open'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRestaurant(rest.id, rest.name)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Create or Edit Restaurant */}
          {(section === 'restaurant-create' || section === 'restaurant-detail') && appData && (
            <div className="max-w-2xl rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-extrabold text-stone-900">
                  {section === 'restaurant-create'
                    ? 'Add New Partner Restaurant'
                    : 'Edit Restaurant Details'}
                </h2>
                <Link
                  href="/admin/restaurants"
                  className="text-xs font-bold text-stone-500 hover:text-stone-900"
                >
                  ← Back to Restaurants
                </Link>
              </div>

              {(() => {
                const existing =
                  section === 'restaurant-detail'
                    ? appData.restaurants.find((r) => r.id === entityId)
                    : null;

                return (
                  <form
                    onSubmit={async (e) => {
                      if (section === 'restaurant-create') {
                        await handleCreateRestaurant(e);
                      } else if (existing) {
                        e.preventDefault();
                        await fetch('/api/state', {
                          method: 'POST',
                          headers: authHeaders,
                          body: JSON.stringify({
                            action: 'update_restaurant',
                            restaurantId: existing.id,
                            updates: {
                              name: restForm.name || existing.name,
                              description: restForm.description || existing.description,
                              address: restForm.address || existing.address,
                              deliveryTimeMinutes: Number(restForm.deliveryTimeMinutes),
                              deliveryFee: Number(restForm.deliveryFee),
                              promoTag: restForm.promoTag,
                            },
                          }),
                        });
                        await refreshState(true);
                        showToast('Restaurant updated!');
                        router.push('/admin/restaurants');
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                          Restaurant Name
                        </label>
                        <input
                          type="text"
                          required
                          defaultValue={existing?.name || restForm.name}
                          onChange={(e) => setRestForm({ ...restForm, name: e.target.value })}
                          placeholder="e.g. Bella Napoli Artisanal Kitchen"
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                          Cuisines (comma separated)
                        </label>
                        <input
                          type="text"
                          defaultValue={existing?.cuisine.join(', ') || restForm.cuisine}
                          onChange={(e) => setRestForm({ ...restForm, cuisine: e.target.value })}
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        required
                        defaultValue={existing?.address || restForm.address}
                        onChange={(e) => setRestForm({ ...restForm, address: e.target.value })}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                          Delivery Time (mins)
                        </label>
                        <input
                          type="number"
                          defaultValue={
                            existing?.deliveryTimeMinutes || restForm.deliveryTimeMinutes
                          }
                          onChange={(e) =>
                            setRestForm({
                              ...restForm,
                              deliveryTimeMinutes: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                          Delivery Fee ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={existing?.deliveryFee ?? restForm.deliveryFee}
                          onChange={(e) =>
                            setRestForm({ ...restForm, deliveryFee: Number(e.target.value) })
                          }
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                          Promotional Tag
                        </label>
                        <input
                          type="text"
                          defaultValue={existing?.promoTag || restForm.promoTag}
                          onChange={(e) => setRestForm({ ...restForm, promoTag: e.target.value })}
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="rounded-2xl bg-stone-900 px-6 py-3 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                    >
                      {section === 'restaurant-create'
                        ? 'Create Restaurant'
                        : 'Save Restaurant Changes'}
                    </button>
                  </form>
                );
              })()}
            </div>
          )}

          {/* ==================== 6.C MENU & FOOD ITEM MANAGEMENT ==================== */}
          {section === 'menu' && appData && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Form: Add / Edit Food Item + Category Manager */}
              <div className="lg:col-span-4 space-y-6">
                <form
                  onSubmit={handleUpsertFoodItem}
                  className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4"
                >
                  <h2 className="font-display text-base font-extrabold text-stone-900">
                    {editingFoodId ? 'Edit Menu Dish' : 'Add New Menu Dish'}
                  </h2>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Target Restaurant
                    </label>
                    <select
                      value={selectedRestForMenu}
                      onChange={(e) => setSelectedRestForMenu(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold"
                    >
                      {appData.restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Dish Name
                    </label>
                    <input
                      type="text"
                      required
                      value={foodForm.name}
                      onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                      placeholder="e.g. Truffle Burrata Wood-Fired Pizza"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={foodForm.price}
                        onChange={(e) =>
                          setFoodForm({ ...foodForm, price: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                        Menu Section
                      </label>
                      <input
                        type="text"
                        value={foodForm.sectionName}
                        onChange={(e) => setFoodForm({ ...foodForm, sectionName: e.target.value })}
                        placeholder="Recommended, Mains..."
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={foodForm.description}
                      onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={foodForm.isVeg}
                        onChange={(e) => setFoodForm({ ...foodForm, isVeg: e.target.checked })}
                      />
                      Vegetarian
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={foodForm.isBestseller}
                        onChange={(e) =>
                          setFoodForm({ ...foodForm, isBestseller: e.target.checked })
                        }
                      />
                      ★ Bestseller
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={foodForm.isAvailable}
                        onChange={(e) =>
                          setFoodForm({ ...foodForm, isAvailable: e.target.checked })
                        }
                      />
                      In Stock
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-stone-900 py-3 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                  >
                    {editingFoodId ? 'Update Menu Item' : 'Add Dish to Menu'}
                  </button>
                </form>

                {/* Quick Food Category Manager */}
                <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
                  <h3 className="font-display text-sm font-extrabold text-stone-900">
                    Add Food Category ({appData.categories.length})
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Category name (e.g. Tacos)"
                      className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!catName.trim()) return;
                        await fetch('/api/state', {
                          method: 'POST',
                          headers: authHeaders,
                          body: JSON.stringify({
                            action: 'upsert_category',
                            category: { name: catName.trim(), image: catImage },
                          }),
                        });
                        setCatName('');
                        await refreshState(true);
                        showToast('Category added!');
                      }}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-stone-950 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Menu Items List */}
              <div className="lg:col-span-8 rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="font-display text-base font-extrabold text-stone-900">
                    Menu Items (
                    {
                      appData.foodItems.filter((f) => f.restaurantId === selectedRestForMenu)
                        .length
                    }
                    )
                  </h2>
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Filter menu items..."
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="divide-y divide-stone-100">
                  {appData.foodItems
                    .filter((f) => f.restaurantId === selectedRestForMenu)
                    .filter(
                      (f) =>
                        !menuSearch.trim() ||
                        f.name.toLowerCase().includes(menuSearch.toLowerCase())
                    )
                    .map((food) => (
                      <div
                        key={food.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                food.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                              }`}
                            />
                            <span className="text-sm font-bold text-stone-900">{food.name}</span>
                            <span className="text-xs font-extrabold text-orange-600">
                              ${food.price.toFixed(2)}
                            </span>
                            {food.isBestseller && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                ★ Bestseller
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500">{food.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch('/api/state', {
                                method: 'POST',
                                headers: authHeaders,
                                body: JSON.stringify({
                                  action: 'upsert_food_item',
                                  item: { ...food, isAvailable: !food.isAvailable },
                                }),
                              });
                              await refreshState(true);
                              showToast(`Updated ${food.name} stock status.`);
                            }}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                              food.isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-600'
                            }`}
                          >
                            {food.isAvailable ? 'In Stock' : 'Out of Stock'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingFoodId(food.id);
                              setFoodForm({
                                name: food.name,
                                categoryId: food.categoryId,
                                sectionName: food.sectionName || 'Recommended',
                                description: food.description,
                                price: food.price,
                                image: food.image,
                                isVeg: food.isVeg,
                                isAvailable: food.isAvailable,
                                isBestseller: Boolean(food.isBestseller),
                              });
                            }}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await fetch('/api/state', {
                                method: 'POST',
                                headers: authHeaders,
                                body: JSON.stringify({
                                  action: 'delete_food_item',
                                  foodItemId: food.id,
                                }),
                              });
                              await refreshState(true);
                              showToast('Menu item deleted.', 'info');
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6.D ORDER MANAGEMENT ==================== */}
          {(section === 'orders' || section === 'order-detail') && appData && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {['all', ...ORDER_STATUS_OPTIONS.map((o) => o.value)].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatusFilter(st)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase cursor-pointer ${
                        orderStatusFilter === st
                          ? 'bg-stone-900 text-white'
                          : 'bg-white border border-stone-200 text-stone-600'
                      }`}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by Order # or Customer name..."
                  className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-4">
                {appData.orders
                  .filter((o) =>
                    section === 'order-detail' && entityId
                      ? o.id === entityId || o.orderNumber === entityId
                      : true
                  )
                  .filter((o) =>
                    orderStatusFilter === 'all' ? true : o.status === orderStatusFilter
                  )
                  .filter(
                    (o) =>
                      !orderSearch.trim() ||
                      o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
                      o.customerName.toLowerCase().includes(orderSearch.toLowerCase())
                  )
                  .map((ord) => (
                    <div
                      key={ord.id}
                      className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-extrabold text-orange-600">
                              #{ord.orderNumber}
                            </span>
                            <span className="rounded-lg bg-stone-100 px-2.5 py-0.5 text-xs font-bold uppercase">
                              {ord.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h3 className="font-display text-lg font-extrabold text-stone-900 mt-1">
                            {ord.customerName} ({ord.customerEmail}) → {ord.restaurantName}
                          </h3>
                          <p className="text-xs text-stone-500">
                            Delivery to: {ord.addressSnapshot.street}, {ord.addressSnapshot.city} •
                            Phone: {ord.contactPhone}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-500">Set Status:</span>
                          <select
                            value={ord.status}
                            onChange={(e) =>
                              handleUpdateOrderStatus(ord.id, e.target.value as OrderStatus)
                            }
                            className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-900"
                          >
                            {ORDER_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                        <div className="space-y-1">
                          {ord.items.map((item) => (
                            <div key={item.id} className="font-semibold text-stone-800">
                              {item.quantity}× {item.name} (${item.lineTotal.toFixed(2)})
                            </div>
                          ))}
                        </div>
                        <div className="text-right">
                          <div className="text-stone-500">
                            Subtotal ${ord.subtotal.toFixed(2)} • Tax ${ord.taxAmount.toFixed(2)}
                          </div>
                          <div className="text-base font-extrabold text-stone-950">
                            Grand Total: ${ord.totalAmount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ==================== 6.E CUSTOMER & WORKSPACE RBAC MANAGEMENT ==================== */}
          {section === 'customers' && appData && (
            <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-stone-900">
                    Registered Users &amp; Workspace Permissions
                  </h2>
                  <p className="text-xs text-stone-500">
                    Manage account status and independent Customer App / Admin Console access
                  </p>
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 uppercase">
                      <th className="py-3">Name &amp; Email</th>
                      <th className="py-3">Phone</th>
                      <th className="py-3">Orders &amp; Spend</th>
                      <th className="py-3">Allowed Workspaces</th>
                      <th className="py-3">Status</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {appData.users
                      .filter(
                        (u) =>
                          !customerSearch.trim() ||
                          u.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(customerSearch.toLowerCase())
                      )
                      .map((u) => {
                        const custOrders = appData.orders.filter((o) => o.customerId === u.id);
                        const spend = custOrders.reduce((s, o) => s + o.totalAmount, 0);
                        const workspaces = u.allowedWorkspaces || ['customer'];

                        return (
                          <tr key={u.id}>
                            <td className="py-3.5">
                              <div className="font-bold text-stone-900">{u.name}</div>
                              <div className="text-stone-500">{u.email}</div>
                            </td>
                            <td className="py-3.5 text-stone-600">{u.phone}</td>
                            <td className="py-3.5">
                              <span className="font-bold">{custOrders.length} orders</span> • $
                              {spend.toFixed(2)}
                            </td>
                            <td className="py-3.5">
                              <div className="flex items-center gap-1.5">
                                {(['customer', 'admin'] as WorkspaceType[]).map((ws) => {
                                  const active = workspaces.includes(ws);
                                  return (
                                    <button
                                      key={ws}
                                      type="button"
                                      onClick={async () => {
                                        const next = active
                                          ? workspaces.filter((w) => w !== ws)
                                          : [...workspaces, ws];
                                        const res = await fetch('/api/state', {
                                          method: 'POST',
                                          headers: authHeaders,
                                          body: JSON.stringify({
                                            action: 'update_user_workspaces',
                                            userId: u.id,
                                            allowedWorkspaces: next,
                                          }),
                                        });
                                        const data = await res.json();
                                        if (!res.ok) {
                                          showToast(data.error || 'Cannot update workspaces', 'error');
                                          return;
                                        }
                                        await refreshState(true);
                                        showToast(`Updated workspace permissions for ${u.email}`);
                                      }}
                                      className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase cursor-pointer ${
                                        active
                                          ? ws === 'admin'
                                            ? 'bg-stone-900 text-amber-400'
                                            : 'bg-orange-100 text-orange-800'
                                          : 'bg-stone-100 text-stone-400'
                                      }`}
                                    >
                                      {ws} {active ? '✓' : '+'}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                                  u.isActive
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {u.isActive ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch('/api/state', {
                                    method: 'POST',
                                    headers: authHeaders,
                                    body: JSON.stringify({
                                      action: 'toggle_user_status',
                                      userId: u.id,
                                    }),
                                  });
                                  await refreshState(true);
                                  showToast(`Updated account status for ${u.name}`);
                                }}
                                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== 6.F OFFERS & PROMOTIONS ==================== */}
          {section === 'offers' && appData && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/state', {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                      action: 'upsert_coupon',
                      coupon: couponForm,
                    }),
                  });
                  if (!res.ok) {
                    showToast('Failed to save offer', 'error');
                    return;
                  }
                  setCouponForm({
                    code: '',
                    description: '',
                    discountType: 'percentage',
                    discountValue: 25,
                    minOrderValue: 20,
                    maxDiscount: 12,
                    expiresAt: '2027-12-31T23:59:59.000Z',
                  });
                  await refreshState(true);
                  showToast('Promotional coupon created!');
                }}
                className="lg:col-span-4 rounded-3xl border border-stone-200 bg-white p-6 space-y-4 h-fit"
              >
                <h2 className="font-display text-base font-extrabold text-stone-900">
                  Create Promotional Offer
                </h2>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    required
                    value={couponForm.code}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. WEEKEND30"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={couponForm.description}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, description: e.target.value })
                    }
                    placeholder="30% OFF up to $12 on orders above $20"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Discount Type
                    </label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) =>
                        setCouponForm({
                          ...couponForm,
                          discountType: e.target.value as typeof couponForm.discountType,
                        })
                      }
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Flat Discount ($)</option>
                      <option value="free_delivery">Free Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      value={couponForm.discountValue}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-stone-900 py-3 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer"
                >
                  Publish Offer to Customer App
                </button>
              </form>

              <div className="lg:col-span-8 rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                <h2 className="font-display text-base font-extrabold text-stone-900">
                  Active &amp; Scheduled Coupons ({appData.coupons.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appData.coupons.map((cpn) => (
                    <div
                      key={cpn.id}
                      className="rounded-2xl border border-stone-200 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-lg bg-orange-600 px-2.5 py-0.5 font-mono text-xs font-extrabold text-white">
                            {cpn.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              cpn.isActive ? 'text-emerald-600' : 'text-stone-400'
                            }`}
                          >
                            {cpn.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-stone-900">{cpn.description}</p>
                        <p className="text-[11px] text-stone-500">
                          Min Order ${cpn.minOrderValue} • Used {cpn.usageCount} times
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-stone-100 text-xs">
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch('/api/state', {
                              method: 'POST',
                              headers: authHeaders,
                              body: JSON.stringify({
                                action: 'toggle_coupon',
                                couponId: cpn.id,
                              }),
                            });
                            await refreshState(true);
                            showToast(`Updated ${cpn.code} status.`);
                          }}
                          className="font-bold text-stone-700 hover:underline cursor-pointer"
                        >
                          {cpn.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch('/api/state', {
                              method: 'POST',
                              headers: authHeaders,
                              body: JSON.stringify({
                                action: 'delete_coupon',
                                couponId: cpn.id,
                              }),
                            });
                            await refreshState(true);
                            showToast('Offer deleted.', 'info');
                          }}
                          className="font-bold text-red-600 hover:underline ml-auto cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6.G ADMIN SETTINGS, MFA & PROVISIONING ==================== */}
          {section === 'settings' && appData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Admin Password & TOTP MFA Rotation */}
                <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-5">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-stone-900">
                      Administrator Security &amp; MFA
                    </h2>
                    <p className="text-xs text-stone-500">
                      Rotate your administrator password or regenerate RFC 6238 TOTP MFA secrets
                    </p>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="password"
                      value={currentAdminPassword}
                      onChange={(e) => setCurrentAdminPassword(e.target.value)}
                      placeholder="Current Administrator Password"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                    />
                    <input
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="New Administrator Password (min 8 chars)"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch('/api/state', {
                          method: 'POST',
                          headers: authHeaders,
                          body: JSON.stringify({
                            action: 'change_admin_password',
                            currentPassword: currentAdminPassword,
                            newPassword: newAdminPassword,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          showToast(data.error || 'Password update failed', 'error');
                          return;
                        }
                        setCurrentAdminPassword('');
                        setNewAdminPassword('');
                        showToast('Administrator password updated!');
                      }}
                      className="rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                    >
                      Update Admin Password
                    </button>
                  </div>

                  <div className="pt-4 border-t border-stone-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-extrabold uppercase text-stone-700">
                          Authenticator-App TOTP &amp; Recovery Codes
                        </h3>
                        <p className="text-[11px] text-stone-500">
                          Generate a fresh TOTP secret and single-use backup codes
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch('/api/state', {
                            method: 'POST',
                            headers: authHeaders,
                            body: JSON.stringify({ action: 'rotate_admin_mfa' }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setRotatedMfaData(data);
                            showToast('Rotated TOTP MFA secret and recovery codes!');
                          }
                        }}
                        className="rounded-xl border border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 cursor-pointer"
                      >
                        Rotate MFA Secret
                      </button>
                    </div>

                    {rotatedMfaData && (
                      <div className="rounded-2xl bg-stone-950 text-stone-100 p-4 text-xs font-mono space-y-2">
                        <div className="text-amber-400 font-bold">
                          New TOTP Secret: {rotatedMfaData.mfaSecret}
                        </div>
                        <div>
                          Recovery Codes: {rotatedMfaData.recoveryCodes.join(' • ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controlled Administrator Account Provisioning (Section 13.C) */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/auth', {
                      method: 'POST',
                      headers: authHeaders,
                      body: JSON.stringify({
                        action: 'provision_admin',
                        ...newAdminForm,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showToast(data.error || 'Could not provision administrator', 'error');
                      return;
                    }
                    setProvisionedAdminResult({
                      email: data.admin.email,
                      mfaSecret: data.provisioningSetup.mfaSecret,
                      recoveryCodes: data.provisioningSetup.recoveryCodes,
                    });
                    setNewAdminForm({
                      name: '',
                      email: '',
                      phone: '+1 (415) 890-9900',
                      password: '',
                      grantCustomerWorkspace: false,
                    });
                    await refreshState(true);
                    showToast(`Provisioned administrator ${data.admin.email}!`);
                  }}
                  className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4"
                >
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-stone-900">
                      Controlled Administrator Provisioning
                    </h2>
                    <p className="text-xs text-stone-500">
                      Public admin signup is disabled. Provision authorized administrators here.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newAdminForm.name}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                      placeholder="Full Name"
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                    />
                    <input
                      type="email"
                      required
                      value={newAdminForm.email}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                      placeholder="admin.ops@foodhub.com"
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                    />
                  </div>

                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newAdminForm.password}
                    onChange={(e) =>
                      setNewAdminForm({ ...newAdminForm, password: e.target.value })
                    }
                    placeholder="Initial Strong Password (min 8 characters)"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs"
                  />

                  <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAdminForm.grantCustomerWorkspace}
                      onChange={(e) =>
                        setNewAdminForm({
                          ...newAdminForm,
                          grantCustomerWorkspace: e.target.checked,
                        })
                      }
                    />
                    Also grant Customer App workspace permission (dual-workspace authorization)
                  </label>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-amber-500 py-3 text-xs font-extrabold text-stone-950 hover:bg-amber-400 cursor-pointer"
                  >
                    Provision Administrator Account with TOTP MFA
                  </button>

                  {provisionedAdminResult && (
                    <div className="rounded-2xl bg-stone-950 text-stone-100 p-4 text-xs font-mono space-y-1.5">
                      <div className="text-emerald-400 font-bold">
                        ✓ Provisioned {provisionedAdminResult.email}
                      </div>
                      <div>TOTP Secret: {provisionedAdminResult.mfaSecret}</div>
                      <div>
                        Recovery Codes: {provisionedAdminResult.recoveryCodes.join(', ')}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Sanitized Administrative Audit Logs (Section 13.I) */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
                <h2 className="font-display text-base font-extrabold text-stone-900">
                  Security &amp; Administrative Audit Logs (Sanitized)
                </h2>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-400 uppercase">
                        <th className="py-2">Timestamp</th>
                        <th className="py-2">Actor</th>
                        <th className="py-2">Action</th>
                        <th className="py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {appData.auditLogs.slice(0, 25).map((log) => (
                        <tr key={log.id}>
                          <td className="py-2.5 font-mono text-[11px] text-stone-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 font-bold text-stone-800">
                            {log.actorName} ({log.actorRole})
                          </td>
                          <td className="py-2.5">
                            <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-[10px] font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 text-stone-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {section === 'support' && appData && (
            <AdminYantraConsole
              appData={appData}
              authHeaders={authHeaders}
              onRefreshState={async () => {
                await refreshState(true);
              }}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}
