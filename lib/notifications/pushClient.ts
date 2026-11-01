'use client';

import type { OrderStatus } from '@/lib/db/models';

export const PUSH_PREF_STORAGE_KEY = 'foodhub_customer_push_enabled_v2';
export const ORDER_STATUS_CHANNEL_NAME = 'foodhub_order_status_channel_v2';

export const READABLE_ORDER_STATUS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  accepted: 'Confirmed by Restaurant',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface OrderPushAlertPayload {
  id: string;
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  previousStatus?: OrderStatus | string;
  newStatus: OrderStatus;
  title: string;
  body: string;
  timestamp: string;
}

export function getBrowserPushPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export function isPushAlertEnabledByUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(PUSH_PREF_STORAGE_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
    return 'Notification' in window && window.Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export async function registerFoodHubPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/foodhub-push-sw.js', {
      scope: '/',
    });
    return registration;
  } catch {
    return null;
  }
}

export async function requestOrderPushPermission(): Promise<{
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported', enabled: true };
  }

  // Mark preference as enabled in localStorage (window is guaranteed here)
  try {
    localStorage.setItem(PUSH_PREF_STORAGE_KEY, 'true');
  } catch {
    // ignore
  }

  await registerFoodHubPushServiceWorker();

  let permission: NotificationPermission = window.Notification.permission;
  if (permission === 'default') {
    try {
      permission = await window.Notification.requestPermission();
    } catch {
      // fallback if blocked by iframe sandbox
    }
  }

  const enabled = permission === 'granted' || permission === 'default';
  try {
    window.localStorage.setItem(PUSH_PREF_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }

  return { permission, enabled };
}

function playPushNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore audio restrictions
  }
}

export async function dispatchOrderStatusBrowserPush(params: {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  previousStatus?: OrderStatus | string;
  newStatus: OrderStatus;
  customNote?: string;
}): Promise<OrderPushAlertPayload> {
  const prevLabel = params.previousStatus
    ? READABLE_ORDER_STATUS[params.previousStatus as OrderStatus] || String(params.previousStatus)
    : null;
  const nextLabel = READABLE_ORDER_STATUS[params.newStatus] || params.newStatus;

  const title = prevLabel
    ? `Order #${params.orderNumber}: '${prevLabel}' → '${nextLabel}'`
    : `Order #${params.orderNumber} is now '${nextLabel}'`;

  const defaultBody =
    params.newStatus === 'out_for_delivery'
      ? `${params.restaurantName}: Your order status changed from '${prevLabel || 'Preparing'}' to 'Out for Delivery'! Your courier is on the way.`
      : params.newStatus === 'preparing'
        ? `${params.restaurantName}: The kitchen is now freshly preparing your order #${params.orderNumber}.`
        : params.newStatus === 'delivered'
          ? `${params.restaurantName}: Order #${params.orderNumber} has been delivered. Enjoy your meal!`
          : `${params.restaurantName}: Order #${params.orderNumber} status updated to '${nextLabel}'.`;

  const body = params.customNote || defaultBody;

  const payload: OrderPushAlertPayload = {
    id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    restaurantName: params.restaurantName,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    title,
    body,
    timestamp: new Date().toISOString(),
  };

  playPushNotificationChime();

  // 1. Dispatch in-app live push notification banner event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('foodhub:order-push-alert', { detail: payload }));
  }

  // 2. Dispatch native Browser Push Notification via Service Worker or Notification API
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body,
        icon: '/images/dish-pizza.svg',
        badge: '/images/dish-pizza.svg',
        tag: `foodhub-order-${params.orderNumber}-${params.newStatus}`,
        data: {
          orderId: params.orderId,
          orderNumber: params.orderNumber,
          url: `/customer/orders/${params.orderId}`,
        },
      };

      let shownViaSw = false;
      if ('serviceWorker' in navigator) {
        try {
          const reg =
            (await navigator.serviceWorker.getRegistration()) ||
            (await registerFoodHubPushServiceWorker());
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(title, options);
            shownViaSw = true;
          }
        } catch {
          shownViaSw = false;
        }
      }

      if (!shownViaSw) {
        try {
          const notif = new window.Notification(title, options);
          notif.onclick = () => {
            window.focus();
            window.location.href = `/customer/orders/${params.orderId}`;
            notif.close();
          };
        } catch {
          // ignore if Notification constructor requires SW on mobile
        }
      }
    }
  }

  return payload;
}

export function broadcastOrderStatusChangeAcrossTabs(event: {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  previousStatus?: OrderStatus | string;
  newStatus: OrderStatus;
  note?: string;
}): void {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(ORDER_STATUS_CHANNEL_NAME);
      channel.postMessage(event);
      channel.close();
    }
  } catch {
    // ignore
  }
}
