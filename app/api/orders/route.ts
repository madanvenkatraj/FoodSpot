import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, getDb, saveDb } from '@/lib/db/store';
import { verifyWorkspaceSession } from '@/lib/db/security';
import type { OrderItemRecord, OrderRecord, OrderStatus } from '@/lib/db/models';

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  accepted: 'Restaurant Accepted',
  preparing: 'Preparing Food',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const restaurantId = searchParams.get('restaurantId');
  const partnerId = searchParams.get('partnerId');

  let orders = [...db.orders];
  if (customerId) {
    orders = orders.filter((o) => o.customerId === customerId);
  }
  if (restaurantId) {
    orders = orders.filter((o) => o.restaurantId === restaurantId);
  }
  if (partnerId) {
    orders = orders.filter((o) => o.deliveryPartnerId === partnerId);
  }

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    const now = new Date().toISOString();

    const {
      customerId = 'usr_customer_1',
      restaurantId,
      items,
      couponCode,
      addressId,
      customAddress,
      contactPhone,
      deliveryInstructions = '',
    } = body;

    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Restaurant and at least one food item are required to place an order.' },
        { status: 400 }
      );
    }

    const customer = db.users.find((u) => u.id === customerId) || db.users[0];
    const restaurant = db.restaurants.find((r) => r.id === restaurantId);
    if (!restaurant) {
      return NextResponse.json({ error: 'Selected restaurant not found.' }, { status: 404 });
    }
    if (!restaurant.isAvailable || !restaurant.isApproved) {
      return NextResponse.json(
        { error: 'This restaurant is currently unavailable for orders.' },
        { status: 400 }
      );
    }

    // Prevent duplicate rapid submissions within 5 seconds from the same customer & restaurant
    const recentDuplicate = db.orders.find(
      (o) =>
        o.customerId === customer.id &&
        o.restaurantId === restaurant.id &&
        Date.now() - new Date(o.createdAt).getTime() < 5000
    );
    if (recentDuplicate) {
      return NextResponse.json(
        {
          error: `Order #${recentDuplicate.orderNumber} was just placed. Duplicate submission prevented.`,
          order: recentDuplicate,
        },
        { status: 409 }
      );
    }

    const orderId = `ord_${Date.now()}`;
    const orderNumber = `FH-${1001 + db.orders.length}`;

    const orderItems: OrderItemRecord[] = items.map(
      (
        item: {
          foodItemId: string;
          name: string;
          quantity: number;
          basePrice: number;
          selectedCustomizations?: { groupTitle: string; optionName: string; price: number }[];
          isVeg?: boolean;
        },
        idx: number
      ) => {
        const dbFood = db.foodItems.find((f) => f.id === item.foodItemId);
        const authoritativeBasePrice = dbFood ? Number(dbFood.price) : Number(item.basePrice);
        const custs = Array.isArray(item.selectedCustomizations)
          ? item.selectedCustomizations
          : [];
        const addonSum = custs.reduce((s, c) => s + Number(c.price || 0), 0);
        const unitTotal = Number((authoritativeBasePrice + addonSum).toFixed(2));
        const qty = Math.max(1, Number(item.quantity || 1));
        const lineTotal = Number((unitTotal * qty).toFixed(2));
        return {
          id: `oi_${Date.now()}_${idx}`,
          orderId,
          foodItemId: item.foodItemId,
          name: dbFood ? dbFood.name : item.name,
          quantity: qty,
          basePrice: authoritativeBasePrice,
          selectedCustomizations: custs,
          unitTotal,
          lineTotal,
          isVeg: dbFood ? Boolean(dbFood.isVeg) : Boolean(item.isVeg),
        };
      }
    );

    const subtotal = Number(orderItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
    let deliveryFee = restaurant.deliveryFee;
    let discountAmount = 0;
    let appliedCoupon: string | null = null;

    if (couponCode) {
      const coupon = db.coupons.find(
        (c) => c.code.toUpperCase() === String(couponCode).trim().toUpperCase() && c.isActive
      );
      if (coupon && subtotal >= coupon.minOrderValue) {
        appliedCoupon = coupon.code;
        if (coupon.discountType === 'free_delivery') {
          discountAmount = deliveryFee;
          deliveryFee = 0;
        } else if (coupon.discountType === 'percentage') {
          discountAmount = Math.min(
            coupon.maxDiscount,
            Number(((subtotal * coupon.discountValue) / 100).toFixed(2))
          );
        } else if (coupon.discountType === 'fixed') {
          discountAmount = Math.min(coupon.maxDiscount, coupon.discountValue);
        }
        coupon.usageCount += 1;
      }
    }

    const taxAmount = Number((subtotal * 0.08).toFixed(2));
    const totalAmount = Number(
      Math.max(0, subtotal + deliveryFee + taxAmount - discountAmount).toFixed(2)
    );

    const savedAddr = addressId
      ? db.addresses.find((a) => a.id === addressId)
      : db.addresses.find((a) => a.userId === customer.id && a.isDefault) || db.addresses[0];

    const addressSnapshot = customAddress || {
      label: savedAddr?.label || 'Home',
      recipientName: savedAddr?.recipientName || customer.name,
      phone: contactPhone || savedAddr?.phone || customer.phone,
      street: savedAddr?.street || '742 Evergreen Terrace, Apt 4B',
      city: savedAddr?.city || 'San Francisco',
      state: savedAddr?.state || 'CA',
      postalCode: savedAddr?.postalCode || '94107',
    };

    const availablePartner = db.deliveryPartners.find((dp) => dp.isAvailable) || db.deliveryPartners[0];

    const newOrder: OrderRecord = {
      id: orderId,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      deliveryPartnerId: availablePartner ? availablePartner.id : null,
      deliveryPartnerName: availablePartner ? availablePartner.name : null,
      items: orderItems,
      subtotal,
      deliveryFee: restaurant.deliveryFee,
      taxAmount,
      discountAmount,
      couponCode: appliedCoupon,
      totalAmount,
      status: 'placed',
      addressSnapshot,
      contactPhone: contactPhone || addressSnapshot.phone,
      deliveryInstructions,
      statusTimeline: [
        {
          status: 'placed',
          label: 'Order Placed',
          timestamp: now,
          note: 'Order confirmed directly without online payment processing',
          actorRole: 'customer',
        },
      ],
      cancellationReason: null,
      createdAt: now,
      updatedAt: now,
    };

    db.orders.unshift(newOrder);
    db.orderItems.push(...orderItems);

    if (availablePartner) {
      db.deliveries.unshift({
        id: `del_${Date.now()}`,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        partnerId: availablePartner.id,
        partnerName: availablePartner.name,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        pickupAddress: restaurant.address,
        dropoffAddress: `${addressSnapshot.street}, ${addressSnapshot.city}, ${addressSnapshot.state} ${addressSnapshot.postalCode}`,
        customerName: customer.name,
        customerPhone: newOrder.contactPhone,
        status: 'assigned',
        deliveryFeeEarned: 5.5,
        assignedAt: now,
        pickedUpAt: null,
        deliveredAt: null,
        updatedAt: now,
      });
    }

    // Create notifications for Customer, Restaurant, and Delivery Partner
    db.notifications.unshift(
      {
        id: `notif_${Date.now()}_cust`,
        userId: customer.id,
        targetRole: 'customer',
        type: 'order_placed',
        title: `Order #${orderNumber} Confirmed`,
        message: `Your order with ${restaurant.name} ($${totalAmount.toFixed(2)}) has been sent to the kitchen.`,
        relatedOrderId: newOrder.id,
        relatedOrderNumber: orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: now,
      },
      {
        id: `notif_${Date.now()}_rest`,
        userId: restaurant.ownerId,
        targetRole: 'restaurant',
        type: 'order_placed',
        title: `New Incoming Order #${orderNumber}`,
        message: `${customer.name} ordered ${orderItems.length} item(s) totaling $${totalAmount.toFixed(2)}.`,
        relatedOrderId: newOrder.id,
        relatedOrderNumber: orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: now,
      }
    );

    appendAuditLog({
      actorId: customer.id,
      actorName: customer.name,
      actorRole: 'customer',
      action: 'ORDER_PLACED',
      resourceType: 'Order',
      resourceId: orderNumber,
      details: `Placed order ${orderNumber} at ${restaurant.name} ($${totalAmount.toFixed(2)}) without payment gateway`,
    });

    saveDb(db);
    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, status, note, actorRole = 'admin', cancellationReason, partnerId } = body;
    const db = getDb();
    const now = new Date().toISOString();

    if (actorRole === 'admin') {
      const verification = verifyWorkspaceSession(
        req.headers.get('authorization'),
        'admin',
        db
      );
      if (!verification.authorized) {
        return NextResponse.json(
          { error: verification.reason || 'Admin authorization required' },
          { status: verification.status }
        );
      }
    }

    const order = db.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (partnerId) {
      const partner = db.deliveryPartners.find((p) => p.id === partnerId);
      if (partner) {
        order.deliveryPartnerId = partner.id;
        order.deliveryPartnerName = partner.name;
      }
    }

    let previousStatus: OrderStatus | undefined;

    if (status) {
      const nextStatus = status as OrderStatus;
      previousStatus = order.status;
      if (
        nextStatus === 'cancelled' &&
        actorRole === 'customer' &&
        order.status !== 'placed' &&
        order.status !== 'accepted'
      ) {
        return NextResponse.json(
          {
            error: `Orders can only be self-cancelled before preparation starts (current status: ${STATUS_LABELS[order.status]}). Please raise a support ticket for assistance.`,
          },
          { status: 400 }
        );
      }
      order.status = nextStatus;
      order.updatedAt = now;
      if (nextStatus === 'cancelled' && cancellationReason) {
        order.cancellationReason = cancellationReason;
      }

      order.statusTimeline.push({
        status: nextStatus,
        label: STATUS_LABELS[nextStatus] || nextStatus,
        timestamp: now,
        note:
          note ||
          (nextStatus === 'cancelled'
            ? `Order cancelled: ${cancellationReason || 'Requested by user/operations'}`
            : `Order moved from ${STATUS_LABELS[previousStatus]} to ${STATUS_LABELS[nextStatus]}`),
        actorRole,
      });

      // Synchronize delivery record
      const delivery = db.deliveries.find((d) => d.orderId === order.id);
      if (delivery) {
        if (nextStatus === 'picked_up') {
          delivery.status = 'picked_up';
          delivery.pickedUpAt = now;
        } else if (nextStatus === 'out_for_delivery') {
          delivery.status = 'out_for_delivery';
        } else if (nextStatus === 'delivered') {
          delivery.status = 'delivered';
          delivery.deliveredAt = now;
          const dp = db.deliveryPartners.find((p) => p.id === delivery.partnerId);
          if (dp) {
            dp.totalDeliveries += 1;
            dp.earningsTotal = Number((dp.earningsTotal + delivery.deliveryFeeEarned).toFixed(2));
          }
        }
        delivery.updatedAt = now;
      }

      const notifTypeMap: Record<OrderStatus, OrderRecord['status'] extends string ? any : never> = {
        placed: 'order_placed',
        accepted: 'order_accepted',
        preparing: 'order_preparing',
        ready_for_pickup: 'order_ready',
        picked_up: 'order_picked_up',
        out_for_delivery: 'order_out_for_delivery',
        delivered: 'order_delivered',
        cancelled: 'order_cancelled',
      };

      const prevReadable = STATUS_LABELS[previousStatus] || previousStatus;
      const nextReadable = STATUS_LABELS[nextStatus] || nextStatus;

      db.notifications.unshift({
        id: `notif_${Date.now()}_st`,
        userId: order.customerId,
        targetRole: 'customer',
        type: notifTypeMap[nextStatus] || 'order_accepted',
        title: `Order #${order.orderNumber}: '${prevReadable}' → '${nextReadable}'`,
        message:
          note ||
          `Your order from ${order.restaurantName} changed from '${prevReadable}' to '${nextReadable}'.`,
        relatedOrderId: order.id,
        relatedOrderNumber: order.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: now,
      });

      appendAuditLog({
        actorId: actorRole,
        actorName: actorRole.toUpperCase(),
        actorRole,
        action: `ORDER_STATUS_${nextStatus.toUpperCase()}`,
        resourceType: 'Order',
        resourceId: order.orderNumber,
        details: `Order ${order.orderNumber} updated from ${previousStatus} to ${nextStatus}`,
      });
    }

    saveDb(db);
    return NextResponse.json({ order, previousStatus });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update order' },
      { status: 500 }
    );
  }
}
