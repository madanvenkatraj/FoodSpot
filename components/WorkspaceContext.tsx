'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  AddressRecord,
  AuditLogRecord,
  CategoryRecord,
  CouponRecord,
  DeliveryPartnerRecord,
  DeliveryRecord,
  FoodItemRecord,
  NotificationRecord,
  OrderRecord,
  OrderStatus,
  RestaurantRecord,
  ReviewRecord,
  SupportTicketReferenceRecord,
  UserRecord,
  WebhookEventRecord,
  WorkspaceType,
} from '@/lib/db/models';
import {
  dispatchOrderStatusBrowserPush,
  ORDER_STATUS_CHANNEL_NAME,
  registerFoodHubPushServiceWorker,
  type OrderPushAlertPayload,
} from '@/lib/notifications/pushClient';
import { signOutFirebaseCustomer } from '@/lib/firebase/client';

export interface AppStatePayload {
  users: Omit<UserRecord, 'passwordHash' | 'mfaSecret' | 'recoveryCodes' | 'resetToken'>[];
  categories: CategoryRecord[];
  restaurants: RestaurantRecord[];
  foodItems: FoodItemRecord[];
  addresses: AddressRecord[];
  orders: OrderRecord[];
  deliveryPartners: DeliveryPartnerRecord[];
  deliveries: DeliveryRecord[];
  reviews: ReviewRecord[];
  coupons: CouponRecord[];
  notifications: NotificationRecord[];
  supportTicketReferences: SupportTicketReferenceRecord[];
  webhookEvents: WebhookEventRecord[];
  auditLogs: AuditLogRecord[];
  activeSessionsCount?: number;
  yantraConfig: {
    platformUrl: string;
    apiKey?: string;
    mode: 'hybrid_sandbox' | 'live_remote' | 'auto' | 'live' | 'fallback';
    welcomeMessage: string;
    supportTitle: string;
    primaryColor: string;
    enabled?: boolean;
    appDomain?: string;
    appDescription?: string;
    webhookUrl?: string;
    webhookEnabled?: boolean;
    webhookConsecutiveFailures?: number;
    webhookPausedUntil?: string | null;
    apiKeyMasked: string;
    webhookSecretMasked: string;
  };
}

export interface CartItem {
  cartItemId: string;
  foodItem: FoodItemRecord;
  quantity: number;
  selectedCustomizations: {
    groupTitle: string;
    optionName: string;
    price: number;
  }[];
  specialInstructions?: string;
}

export type SafeUser = Omit<
  UserRecord,
  'passwordHash' | 'mfaSecret' | 'recoveryCodes' | 'resetToken'
>;

interface WorkspaceContextValue {
  appData: AppStatePayload | null;
  loadingData: boolean;
  refreshState: (silent?: boolean) => Promise<void>;

  // Customer Workspace Auth
  customerUser: SafeUser | null;
  customerToken: string | null;
  customerAuthReady: boolean;
  setCustomerSession: (token: string, user: SafeUser) => void;
  logoutCustomer: () => Promise<void>;
  revalidateWorkspace: (workspace: WorkspaceType) => Promise<{
    authenticated: boolean;
    user: SafeUser | null;
    error?: string;
  }>;

  // Admin Workspace Auth
  adminUser: SafeUser | null;
  adminToken: string | null;
  adminAuthReady: boolean;
  setAdminSession: (token: string, user: SafeUser) => void;
  logoutAdmin: () => Promise<void>;

  // Customer Cart & Delivery Location State
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  appliedCouponCode: string;
  setAppliedCouponCode: (code: string) => void;
  deliveryZone: {
    name: string;
    address: string;
    eta: string;
    isServiceable: boolean;
  };
  setDeliveryZone: (zone: {
    name: string;
    address: string;
    eta: string;
    isServiceable: boolean;
  }) => void;
  addToCart: (
    food: FoodItemRecord,
    customizations?: { groupTitle: string; optionName: string; price: number }[],
    qty?: number,
    specialInstructions?: string
  ) => boolean;
  updateCartQty: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  conflictPendingItem: {
    food: FoodItemRecord;
    customizations: { groupTitle: string; optionName: string; price: number }[];
    quantity: number;
  } | null;
  setConflictPendingItem: React.Dispatch<
    React.SetStateAction<{
      food: FoodItemRecord;
      customizations: { groupTitle: string; optionName: string; price: number }[];
      quantity: number;
    } | null>
  >;
  confirmReplaceCartConflict: () => void;

  // Toast Notification
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const CUSTOMER_TOKEN_KEY = 'foodhub_customer_token_v2';
export const CUSTOMER_USER_KEY = 'foodhub_customer_user_v2';
export const ADMIN_TOKEN_KEY = 'foodhub_admin_token_v2';
export const ADMIN_USER_KEY = 'foodhub_admin_user_v2';
export const CART_STORAGE_KEY = 'foodhub_cart_v2';
export const ZONE_STORAGE_KEY = 'foodhub_delivery_zone_v2';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [appData, setAppData] = useState<AppStatePayload | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [customerUser, setCustomerUser] = useState<SafeUser | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [customerAuthReady, setCustomerAuthReady] = useState(false);

  const [adminUser, setAdminUser] = useState<SafeUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminAuthReady, setAdminAuthReady] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('FOODHUB20');
  const [deliveryZone, setDeliveryZoneState] = useState<{
    name: string;
    address: string;
    eta: string;
    isServiceable: boolean;
  }>({
    name: 'SoMa',
    address: '742 Evergreen Terrace, Apt 4B, San Francisco',
    eta: '22–28 mins',
    isServiceable: true,
  });

  const [conflictPendingItem, setConflictPendingItem] = useState<{
    food: FoodItemRecord;
    customizations: { groupTitle: string; optionName: string; price: number }[];
    quantity: number;
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [activePushBanner, setActivePushBanner] = useState<OrderPushAlertPayload | null>(null);
  const prevOrderStatusesRef = useRef<Record<string, OrderStatus>>({});
  const orderSnapshotsInitializedRef = useRef(false);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    []
  );

  const refreshState = useCallback(async (silent = false) => {
    // Skip polling when tab is backgrounded — avoids unnecessary server load
    if (silent && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (!silent) setLoadingData(true);
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      const data: AppStatePayload = await res.json();
      setAppData(data);
    } catch {
      // keep existing state on network error
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  const revalidateWorkspace = useCallback(
    async (
      workspace: WorkspaceType
    ): Promise<{ authenticated: boolean; user: SafeUser | null; error?: string }> => {
      const storageTokenKey = workspace === 'admin' ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY;
      const storageUserKey = workspace === 'admin' ? ADMIN_USER_KEY : CUSTOMER_USER_KEY;
      const savedToken =
        typeof window !== 'undefined' ? window.localStorage.getItem(storageTokenKey) : null;

      if (!savedToken) {
        if (workspace === 'admin') {
          setAdminToken(null);
          setAdminUser(null);
          setAdminAuthReady(true);
        } else {
          setCustomerToken(null);
          setCustomerUser(null);
          setCustomerAuthReady(true);
        }
        return { authenticated: false, user: null };
      }

      try {
        const res = await fetch(`/api/auth?workspace=${workspace}`, {
          headers: { Authorization: `Bearer ${savedToken}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && data.authenticated && data.user) {
          if (workspace === 'admin') {
            setAdminToken(savedToken);
            setAdminUser(data.user);
            setAdminAuthReady(true);
          } else {
            setCustomerToken(savedToken);
            setCustomerUser(data.user);
            setCustomerAuthReady(true);
          }
          window.localStorage.setItem(storageUserKey, JSON.stringify(data.user));
          return { authenticated: true, user: data.user };
        } else {
          window.localStorage.removeItem(storageTokenKey);
          window.localStorage.removeItem(storageUserKey);
          if (workspace === 'admin') {
            setAdminToken(null);
            setAdminUser(null);
            setAdminAuthReady(true);
          } else {
            setCustomerToken(null);
            setCustomerUser(null);
            setCustomerAuthReady(true);
          }
          return { authenticated: false, user: null, error: data.error };
        }
      } catch {
        if (workspace === 'admin') setAdminAuthReady(true);
        else setCustomerAuthReady(true);
        return { authenticated: false, user: null };
      }
    },
    []
  );

  // Hydrate initial state, sessions, cart, and delivery zone
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void refreshState(false);

      try {
        const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
        if (rawCart) {
          const parsed = JSON.parse(rawCart);
          if (Array.isArray(parsed)) setCart(parsed);
        }
        const rawZone = window.localStorage.getItem(ZONE_STORAGE_KEY);
        if (rawZone) {
          const parsedZone = JSON.parse(rawZone);
          if (parsedZone?.name) setDeliveryZoneState(parsedZone);
        }
      } catch {
        // ignore storage errors
      }

      void revalidateWorkspace('customer');
      void revalidateWorkspace('admin');
    });

    const interval = setInterval(() => {
      void refreshState(true);
    }, 12000); // poll every 12s (was 6s — reduced to ease server load during dev compilation)

    return () => {
      window.cancelAnimationFrame(frameId);
      clearInterval(interval);
    };
  }, [refreshState, revalidateWorkspace]);

  // Register Service Worker & listen for live push alerts and cross-tab order status changes
  useEffect(() => {
    void registerFoodHubPushServiceWorker();

    const handlePushAlertEvent = (e: Event) => {
      const customEvent = e as CustomEvent<OrderPushAlertPayload>;
      if (customEvent.detail) {
        setActivePushBanner(customEvent.detail);
      }
    };

    window.addEventListener('foodspot:order-push-alert', handlePushAlertEvent);

    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(ORDER_STATUS_CHANNEL_NAME);
        channel.onmessage = (event) => {
          const data = event.data;
          if (data && data.orderId && data.newStatus) {
            prevOrderStatusesRef.current[data.orderId] = data.newStatus;
            void dispatchOrderStatusBrowserPush({
              orderId: data.orderId,
              orderNumber: data.orderNumber || data.orderId,
              restaurantName: data.restaurantName || 'FoodSpot Restaurant',
              previousStatus: data.previousStatus,
              newStatus: data.newStatus,
              customNote: data.note,
            });
            void refreshState(true);
          }
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      window.removeEventListener('foodspot:order-push-alert', handlePushAlertEvent);
      if (channel) channel.close();
    };
  }, [refreshState]);

  // Detect order status transitions (e.g. 'Preparing' -> 'Out for Delivery') and fire Browser Push Notification
  useEffect(() => {
    if (!appData?.orders) return;

    if (!orderSnapshotsInitializedRef.current) {
      const initialMap: Record<string, OrderStatus> = {};
      appData.orders.forEach((ord) => {
        initialMap[ord.id] = ord.status;
      });
      prevOrderStatusesRef.current = initialMap;
      orderSnapshotsInitializedRef.current = true;
      return;
    }

    appData.orders.forEach((ord) => {
      const prevStatus = prevOrderStatusesRef.current[ord.id];
      if (prevStatus && prevStatus !== ord.status) {
        prevOrderStatusesRef.current[ord.id] = ord.status;
        // Alert customer when their order status changes (or any watched order in Customer App)
        if (!customerUser || ord.customerId === customerUser.id) {
          void dispatchOrderStatusBrowserPush({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            restaurantName: ord.restaurantName,
            previousStatus: prevStatus,
            newStatus: ord.status,
          });
        }
      } else if (!prevStatus) {
        prevOrderStatusesRef.current[ord.id] = ord.status;
      }
    });
  }, [appData?.orders, customerUser]);

  // Persist cart changes
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  const setDeliveryZone = useCallback(
    (zone: { name: string; address: string; eta: string; isServiceable: boolean }) => {
      setDeliveryZoneState(zone);
      try {
        window.localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(zone));
      } catch {
        // ignore
      }
    },
    []
  );

  const setCustomerSession = useCallback((token: string, user: SafeUser) => {
    setCustomerToken(token);
    setCustomerUser(user);
    setCustomerAuthReady(true);
    try {
      window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
      window.localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  }, []);

  const logoutCustomer = useCallback(async () => {
    const token =
      customerToken ||
      (typeof window !== 'undefined' ? window.localStorage.getItem(CUSTOMER_TOKEN_KEY) : null);
    if (token) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'logout', token }),
        });
      } catch {
        // ignore network error on logout
      }
    }
    setCustomerToken(null);
    setCustomerUser(null);
    void signOutFirebaseCustomer();
    try {
      window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      window.localStorage.removeItem(CUSTOMER_USER_KEY);
    } catch {
      // ignore
    }
    showToast('Signed out of Customer App.', 'info');
  }, [customerToken, showToast]);

  const setAdminSession = useCallback((token: string, user: SafeUser) => {
    setAdminToken(token);
    setAdminUser(user);
    setAdminAuthReady(true);
    try {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
      window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    const token =
      adminToken ||
      (typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_TOKEN_KEY) : null);
    if (token) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'logout', token }),
        });
      } catch {
        // ignore
      }
    }
    setAdminToken(null);
    setAdminUser(null);
    try {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.localStorage.removeItem(ADMIN_USER_KEY);
    } catch {
      // ignore
    }
    showToast('Signed out of Admin Console.', 'info');
  }, [adminToken, showToast]);

  const commitAddToCart = useCallback(
    (
      food: FoodItemRecord,
      customizations: { groupTitle: string; optionName: string; price: number }[],
      qty: number,
      replaceExisting = false,
      specialInstructions?: string
    ) => {
      const custKey = customizations
        .map((c) => `${c.groupTitle}:${c.optionName}`)
        .sort()
        .join('|');
      const cartItemId = `${food.id}__${custKey}`;

      setCart((prev) => {
        const baseCart = replaceExisting ? [] : prev;
        const existing = baseCart.find((i) => i.cartItemId === cartItemId);
        if (existing) {
          return baseCart.map((i) =>
            i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + qty } : i
          );
        }
        return [
          ...baseCart,
          {
            cartItemId,
            foodItem: food,
            quantity: qty,
            selectedCustomizations: customizations,
            specialInstructions,
          },
        ];
      });
      showToast(`Added ${qty}× ${food.name} to cart`);
    },
    [showToast]
  );

  const addToCart = useCallback(
    (
      food: FoodItemRecord,
      customizations: { groupTitle: string; optionName: string; price: number }[] = [],
      qty = 1,
      specialInstructions?: string
    ): boolean => {
      if (cart.length > 0 && cart[0].foodItem.restaurantId !== food.restaurantId) {
        setConflictPendingItem({
          food,
          customizations,
          quantity: qty,
        });
        return false;
      }
      commitAddToCart(food, customizations, qty, false, specialInstructions);
      return true;
    },
    [cart, commitAddToCart]
  );

  const confirmReplaceCartConflict = useCallback(() => {
    if (!conflictPendingItem) return;
    commitAddToCart(
      conflictPendingItem.food,
      conflictPendingItem.customizations,
      conflictPendingItem.quantity,
      true
    );
    setConflictPendingItem(null);
  }, [conflictPendingItem, commitAddToCart]);

  const updateCartQty = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        appData,
        loadingData,
        refreshState,
        customerUser,
        customerToken,
        customerAuthReady,
        setCustomerSession,
        logoutCustomer,
        revalidateWorkspace,
        adminUser,
        adminToken,
        adminAuthReady,
        setAdminSession,
        logoutAdmin,
        cart,
        setCart,
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
        toast,
        showToast,
      }}
    >
      {children}
      {activePushBanner && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[94%] max-w-lg rounded-2xl border border-orange-500/40 bg-stone-950/95 p-4 text-white shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
                  Browser Push Notification • Live Order Alert
                </span>
              </div>
              <p className="text-sm font-extrabold text-white">{activePushBanner.title}</p>
              <p className="text-xs text-stone-300 leading-relaxed">{activePushBanner.body}</p>
              <div className="pt-2 flex items-center gap-2">
                <a
                  href={`/customer/orders/${activePushBanner.orderId}`}
                  onClick={() => setActivePushBanner(null)}
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-orange-500"
                >
                  Track Order #{activePushBanner.orderNumber}
                </a>
                <button
                  type="button"
                  onClick={() => setActivePushBanner(null)}
                  className="rounded-lg border border-stone-700 px-3 py-1.5 text-[11px] font-bold text-stone-300 hover:bg-stone-800 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePushBanner(null)}
              className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-top-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              toast.type === 'error'
                ? 'bg-red-500'
                : toast.type === 'info'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            }`}
          />
          <span>{toast.message}</span>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
