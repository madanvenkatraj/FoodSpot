'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { OrderRecord } from '@/lib/db/models';

const OrderTrackingMapInner = dynamic(() => import('./OrderTrackingMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-2xl border border-stone-200 bg-stone-100 animate-pulse flex items-center justify-center text-xs text-stone-500 font-mono">
      Loading Interactive Leaflet.js Real-Time GPS Map...
    </div>
  ),
});

interface OrderTrackingMapProps {
  order: OrderRecord;
}

export default function OrderTrackingMap({ order }: OrderTrackingMapProps) {
  return <OrderTrackingMapInner order={order} />;
}
