import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, getDb, saveDb } from '@/lib/db/store';
import {
  generateNewYantraApiKey,
  generateRecoveryCodes,
  generateTotpSecret,
  hashPassword,
  resetYantraRateLimits,
  verifyPassword,
  verifyWorkspaceSession,
} from '@/lib/db/security';
import { adminUpdateTicketAndDispatchWebhook } from '@/lib/yantra/service';
import type { SupportTicketStatus, WorkspaceType } from '@/lib/db/models';

export async function GET() {
  const db = getDb();
  const safeUsers = db.users.map(
    ({ passwordHash: _ph, mfaSecret: _ms, recoveryCodes: _rc, resetToken: _rt, ...u }) => u
  );
  return NextResponse.json({
    users: safeUsers,
    categories: db.categories,
    restaurants: db.restaurants,
    foodItems: db.foodItems,
    addresses: db.addresses,
    orders: db.orders,
    deliveryPartners: db.deliveryPartners,
    deliveries: db.deliveries,
    reviews: db.reviews,
    coupons: db.coupons,
    notifications: db.notifications,
    supportTicketReferences: db.supportTicketReferences,
    webhookEvents: db.webhookEvents,
    auditLogs: db.auditLogs,
    activeSessionsCount: (db.sessions || []).filter(
      (s) => !s.revokedAt && new Date(s.expiresAt).getTime() > Date.now()
    ).length,
    yantraConfig: {
      platformUrl: db.yantraConfig.platformUrl,
      apiKey: db.yantraConfig.apiKey,
      mode: db.yantraConfig.mode,
      welcomeMessage: db.yantraConfig.welcomeMessage,
      supportTitle: db.yantraConfig.supportTitle,
      primaryColor: db.yantraConfig.primaryColor,
      enabled: db.yantraConfig.enabled !== false,
      appDomain: db.yantraConfig.appDomain || 'foodhub.app',
      appDescription:
        db.yantraConfig.appDescription ||
        'FoodHub is an online food ordering and delivery platform with live order tracking, restaurant menus, and customer support.',
      webhookUrl: db.yantraConfig.webhookUrl || '/api/webhooks/yantra/tickets',
      webhookEnabled: db.yantraConfig.webhookEnabled !== false,
      webhookConsecutiveFailures: db.yantraConfig.webhookConsecutiveFailures || 0,
      webhookPausedUntil: db.yantraConfig.webhookPausedUntil || null,
      apiKeyMasked: `${db.yantraConfig.apiKey.slice(0, 12)}••••••••`,
      webhookSecretMasked: `${db.yantraConfig.webhookSecret.slice(0, 12)}••••••••`,
    },
  });
}

const ADMIN_PROTECTED_ACTIONS = new Set([
  'create_restaurant',
  'update_restaurant',
  'delete_restaurant',
  'toggle_restaurant_approval',
  'upsert_food_item',
  'delete_food_item',
  'upsert_category',
  'upsert_coupon',
  'toggle_coupon',
  'delete_coupon',
  'toggle_user_status',
  'update_user_workspaces',
  'update_yantra_config',
  'rotate_yantra_api_key',
  'admin_update_ticket',
  'reset_yantra_rate_limits',
  'change_admin_password',
  'rotate_admin_mfa',
  'revoke_user_sessions',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const db = getDb();
    if (!Array.isArray(db.sessions)) {
      db.sessions = [];
    }
    const now = new Date().toISOString();

    let adminActor = {
      id: 'usr_admin_1',
      name: 'Platform Admin',
      email: 'admin@foodhub.com',
    };

    if (ADMIN_PROTECTED_ACTIONS.has(action)) {
      const verification = verifyWorkspaceSession(
        req.headers.get('authorization'),
        'admin',
        db
      );
      if (!verification.authorized || !verification.user) {
        return NextResponse.json(
          { error: verification.reason || 'Admin authorization required' },
          { status: verification.status }
        );
      }
      adminActor = {
        id: verification.user.id,
        name: verification.user.name,
        email: verification.user.email,
      };
    }

    // 1. Admin Restaurant Creation & Updates
    if (action === 'create_restaurant') {
      const { restaurant } = body;
      if (!restaurant?.name || !restaurant?.address) {
        return NextResponse.json(
          { error: 'Restaurant name and address are required.' },
          { status: 400 }
        );
      }
      const newRest = {
        id: `rest_${Date.now()}`,
        ownerId: adminActor.id,
        name: String(restaurant.name).trim(),
        description: String(
          restaurant.description || 'Chef-curated culinary kitchen on FoodHub.'
        ).trim(),
        cuisine: Array.isArray(restaurant.cuisine)
          ? restaurant.cuisine
          : String(restaurant.cuisine || 'Popular, Chef Specials')
              .split(',')
              .map((c: string) => c.trim())
              .filter(Boolean),
        image: restaurant.image || '/images/dish-pizza.svg',
        bannerImage: restaurant.bannerImage || restaurant.image || '/images/hero-food-banner.svg',
        address: String(restaurant.address).trim(),
        phone: String(restaurant.phone || '+1 (415) 555-0190').trim(),
        openingHours: String(restaurant.openingHours || '10:00 AM – 11:00 PM').trim(),
        isAvailable: restaurant.isAvailable !== false,
        isApproved: true,
        rating: Number(restaurant.rating || 4.8),
        reviewCount: Number(restaurant.reviewCount || 12),
        deliveryTimeMinutes: Number(restaurant.deliveryTimeMinutes || 28),
        minOrderAmount: Number(restaurant.minOrderAmount || 15),
        deliveryFee: Number(restaurant.deliveryFee ?? 2.49),
        costForTwo: Number(restaurant.costForTwo || 35),
        featured: Boolean(restaurant.featured),
        promoTag: restaurant.promoTag ? String(restaurant.promoTag).trim() : 'NEW ON FOODHUB',
        serviceableZones: Array.isArray(restaurant.serviceableZones)
          ? restaurant.serviceableZones
          : ['SoMa', 'Mission District', 'Downtown', 'Castro', 'Marina District', 'Hayes Valley'],
        menuSections: Array.isArray(restaurant.menuSections)
          ? restaurant.menuSections
          : ['Recommended', 'Mains', 'Sides', 'Beverages'],
        createdAt: now,
        updatedAt: now,
      };
      db.restaurants.unshift(newRest);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'RESTAURANT_CREATED',
        resourceType: 'Restaurant',
        resourceId: newRest.id,
        details: `Created restaurant "${newRest.name}" (${newRest.address})`,
      });
      saveDb(db);
      return NextResponse.json({ restaurant: newRest }, { status: 201 });
    }

    if (action === 'update_restaurant') {
      const { restaurantId, updates } = body;
      const rest = db.restaurants.find((r) => r.id === restaurantId);
      if (!rest) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
      Object.assign(rest, updates, { updatedAt: now });
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'RESTAURANT_UPDATED',
        resourceType: 'Restaurant',
        resourceId: rest.id,
        details: `Updated restaurant profile/status for ${rest.name}`,
      });
      saveDb(db);
      return NextResponse.json({ restaurant: rest });
    }

    if (action === 'delete_restaurant') {
      const { restaurantId } = body;
      const rest = db.restaurants.find((r) => r.id === restaurantId);
      if (!rest) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
      db.restaurants = db.restaurants.filter((r) => r.id !== restaurantId);
      db.foodItems = db.foodItems.filter((f) => f.restaurantId !== restaurantId);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'RESTAURANT_DELETED',
        resourceType: 'Restaurant',
        resourceId: restaurantId,
        details: `Deleted restaurant "${rest.name}" and its menu items`,
      });
      saveDb(db);
      return NextResponse.json({ deleted: true });
    }

    // 2. Menu Item Add / Edit / Delete
    if (action === 'upsert_food_item') {
      const { item } = body;
      if (item.id) {
        const existing = db.foodItems.find((f) => f.id === item.id);
        if (existing) {
          Object.assign(existing, item, {
            price: Number(item.price),
            updatedAt: now,
          });
          appendAuditLog({
            actorId: adminActor.id,
            actorName: adminActor.name,
            actorRole: 'admin',
            action: 'MENU_ITEM_UPDATED',
            resourceType: 'FoodItem',
            resourceId: existing.id,
            details: `Updated menu item "${existing.name}" ($${existing.price.toFixed(2)})`,
          });
          saveDb(db);
          return NextResponse.json({ foodItem: existing });
        }
      }
      const newFood = {
        id: `food_${Date.now()}`,
        restaurantId: item.restaurantId || 'rest_1',
        categoryId: item.categoryId || 'cat_pizza',
        sectionName: item.sectionName || 'Recommended',
        name: String(item.name).trim(),
        description: String(item.description || 'Chef crafted house specialty.').trim(),
        price: Number(item.price || 14.99),
        image: item.image || '/images/dish-pizza.svg',
        isVeg: Boolean(item.isVeg),
        isAvailable: item.isAvailable !== false,
        isPopular: Boolean(item.isPopular),
        isBestseller: Boolean(item.isBestseller),
        spiceLevel: item.spiceLevel || 'medium',
        prepTimeMinutes: Number(item.prepTimeMinutes || 18),
        calories: Number(item.calories || 520),
        serves: String(item.serves || 'Serves 1'),
        customizations: Array.isArray(item.customizations) ? item.customizations : [],
        rating: 4.8,
        reviewCount: 1,
        createdAt: now,
        updatedAt: now,
      };
      db.foodItems.unshift(newFood);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'MENU_ITEM_CREATED',
        resourceType: 'FoodItem',
        resourceId: newFood.id,
        details: `Added menu item "${newFood.name}" ($${newFood.price.toFixed(2)})`,
      });
      saveDb(db);
      return NextResponse.json({ foodItem: newFood }, { status: 201 });
    }

    if (action === 'delete_food_item') {
      const { foodItemId } = body;
      const target = db.foodItems.find((f) => f.id === foodItemId);
      db.foodItems = db.foodItems.filter((f) => f.id !== foodItemId);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'MENU_ITEM_DELETED',
        resourceType: 'FoodItem',
        resourceId: String(foodItemId),
        details: `Deleted menu item "${target?.name || foodItemId}"`,
      });
      saveDb(db);
      return NextResponse.json({ deleted: true });
    }

    // 3. Customer Saved Addresses
    if (action === 'add_address') {
      const { userId = 'usr_customer_1', address } = body;
      const newAddr = {
        id: `addr_${Date.now()}`,
        userId,
        label: address.label || 'Home',
        recipientName: address.recipientName || 'Aarav Sharma',
        phone: address.phone || '+1 (415) 890-2311',
        street: address.street,
        city: address.city || 'San Francisco',
        state: address.state || 'CA',
        postalCode: address.postalCode || '94107',
        instructions: address.instructions || '',
        isDefault: Boolean(address.isDefault),
        createdAt: now,
      };
      if (newAddr.isDefault) {
        db.addresses.forEach((a) => {
          if (a.userId === userId) a.isDefault = false;
        });
      }
      db.addresses.unshift(newAddr);
      saveDb(db);
      return NextResponse.json({ address: newAddr }, { status: 201 });
    }

    if (action === 'update_address') {
      const { addressId, updates } = body;
      const addr = db.addresses.find((a) => a.id === addressId);
      if (!addr) return NextResponse.json({ error: 'Address not found' }, { status: 404 });
      Object.assign(addr, updates);
      if (updates?.isDefault) {
        db.addresses.forEach((a) => {
          if (a.userId === addr.userId) a.isDefault = a.id === addr.id;
        });
      }
      saveDb(db);
      return NextResponse.json({ address: addr });
    }

    if (action === 'delete_address') {
      const { addressId } = body;
      db.addresses = db.addresses.filter((a) => a.id !== addressId);
      saveDb(db);
      return NextResponse.json({ deleted: true });
    }

    if (action === 'set_default_address') {
      const { userId = 'usr_customer_1', addressId } = body;
      db.addresses.forEach((a) => {
        if (a.userId === userId) {
          a.isDefault = a.id === addressId;
        }
      });
      saveDb(db);
      return NextResponse.json({ addresses: db.addresses });
    }

    if (action === 'validate_coupon') {
      const { code, subtotal = 0, deliveryFee = 0 } = body;
      const normalized = String(code || '').trim().toUpperCase();
      const coupon = db.coupons.find((c) => c.code.toUpperCase() === normalized);
      if (!coupon || !coupon.isActive) {
        return NextResponse.json(
          { valid: false, error: 'Invalid or inactive coupon code.' },
          { status: 400 }
        );
      }
      if (new Date(coupon.expiresAt).getTime() < Date.now()) {
        return NextResponse.json(
          { valid: false, error: `Coupon ${coupon.code} has expired.` },
          { status: 400 }
        );
      }
      if (Number(subtotal) < coupon.minOrderValue) {
        return NextResponse.json(
          {
            valid: false,
            error: `Minimum item subtotal of $${coupon.minOrderValue.toFixed(2)} required for ${coupon.code}.`,
          },
          { status: 400 }
        );
      }
      let discountAmount = 0;
      if (coupon.discountType === 'free_delivery') {
        discountAmount = Number(deliveryFee);
      } else if (coupon.discountType === 'percentage') {
        discountAmount = Math.min(
          coupon.maxDiscount,
          Number(((Number(subtotal) * coupon.discountValue) / 100).toFixed(2))
        );
      } else {
        discountAmount = Math.min(coupon.maxDiscount, coupon.discountValue);
      }
      return NextResponse.json({
        valid: true,
        coupon,
        discountAmount,
      });
    }

    if (action === 'check_serviceability') {
      const { zoneName } = body;
      const normalizedZone = String(zoneName || '').trim();
      const serviceableRestaurants = db.restaurants.filter(
        (r) =>
          r.isApproved &&
          (!r.serviceableZones ||
            r.serviceableZones.some((z) => z.toLowerCase() === normalizedZone.toLowerCase()))
      );
      return NextResponse.json({
        zoneName: normalizedZone,
        isServiceable:
          serviceableRestaurants.length > 0 &&
          !normalizedZone.toLowerCase().includes('out of zone'),
        restaurantCount: serviceableRestaurants.length,
        surgeSurcharge: normalizedZone.toLowerCase().includes('pacific heights') ? 1.0 : 0,
      });
    }

    // 4. Customer Profile & Favorites
    if (action === 'update_profile') {
      const { userId, name, phone, currentPassword, newPassword } = body;
      const user = db.users.find((u) => u.id === userId);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (name) user.name = String(name).trim();
      if (phone) user.phone = String(phone).trim();
      if (newPassword) {
        if (currentPassword && !verifyPassword(String(currentPassword), user.passwordHash)) {
          return NextResponse.json(
            { error: 'Current password verification failed.' },
            { status: 400 }
          );
        }
        if (String(newPassword).length < 8) {
          return NextResponse.json(
            { error: 'New password must be at least 8 characters long.' },
            { status: 400 }
          );
        }
        user.passwordHash = hashPassword(String(newPassword));
      }
      user.updatedAt = now;
      saveDb(db);
      const {
        passwordHash: _ph,
        mfaSecret: _ms,
        recoveryCodes: _rc,
        resetToken: _rt,
        ...safeUser
      } = user;
      return NextResponse.json({ user: safeUser });
    }

    if (action === 'toggle_favorite') {
      const { userId = 'usr_customer_1', restaurantId } = body;
      const user = db.users.find((u) => u.id === userId);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (user.favorites.includes(restaurantId)) {
        user.favorites = user.favorites.filter((id) => id !== restaurantId);
      } else {
        user.favorites.push(restaurantId);
      }
      saveDb(db);
      return NextResponse.json({ favorites: user.favorites });
    }

    // 5. Reviews
    if (action === 'add_review') {
      const {
        customerId = 'usr_customer_1',
        customerName = 'Aarav Sharma',
        restaurantId,
        foodItemId = null,
        orderId = null,
        rating,
        comment,
      } = body;
      const rest = db.restaurants.find((r) => r.id === restaurantId);
      const newRev = {
        id: `rev_${Date.now()}`,
        customerId,
        customerName,
        restaurantId,
        restaurantName: rest?.name || 'FoodHub Restaurant',
        foodItemId,
        orderId,
        rating: Math.min(5, Math.max(1, Number(rating || 5))),
        comment: String(comment || '').trim(),
        createdAt: now,
      };
      db.reviews.unshift(newRev);
      if (rest) {
        const restReviews = db.reviews.filter((r) => r.restaurantId === rest.id);
        const avg =
          restReviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, restReviews.length);
        rest.rating = Number(avg.toFixed(1));
        rest.reviewCount = restReviews.length;
      }
      saveDb(db);
      return NextResponse.json({ review: newRev }, { status: 201 });
    }

    // 6. Admin Categories, Coupons, Users, Workspaces & Security
    if (action === 'upsert_category') {
      const { category } = body;
      const newCat = {
        id: category.id || `cat_${Date.now()}`,
        name: String(category.name).trim(),
        slug: String(category.name).trim().toLowerCase().replace(/\s+/g, '-'),
        description: String(category.description || 'Curated food category').trim(),
        image: category.image || '/images/dish-pizza.svg',
        isActive: category.isActive !== false,
        createdAt: now,
      };
      const idx = db.categories.findIndex((c) => c.id === newCat.id);
      if (idx >= 0) db.categories[idx] = newCat;
      else db.categories.push(newCat);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'CATEGORY_UPSERTED',
        resourceType: 'Category',
        resourceId: newCat.id,
        details: `Upserted food category "${newCat.name}"`,
      });
      saveDb(db);
      return NextResponse.json({ category: newCat });
    }

    if (action === 'upsert_coupon') {
      const { coupon } = body;
      const newCpn = {
        id: coupon.id || `cpn_${Date.now()}`,
        code: String(coupon.code).trim().toUpperCase(),
        description: String(coupon.description || 'Promotional discount').trim(),
        discountType: coupon.discountType || 'percentage',
        discountValue: Number(coupon.discountValue || 20),
        minOrderValue: Number(coupon.minOrderValue || 15),
        maxDiscount: Number(coupon.maxDiscount || 10),
        isActive: coupon.isActive !== false,
        expiresAt: coupon.expiresAt || '2027-12-31T23:59:59.000Z',
        usageCount: Number(coupon.usageCount || 0),
        createdAt: now,
      };
      const idx = db.coupons.findIndex((c) => c.id === newCpn.id);
      if (idx >= 0) db.coupons[idx] = newCpn;
      else db.coupons.unshift(newCpn);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'COUPON_UPSERTED',
        resourceType: 'Coupon',
        resourceId: newCpn.code,
        details: `Upserted promotional offer ${newCpn.code} (${newCpn.discountType})`,
      });
      saveDb(db);
      return NextResponse.json({ coupon: newCpn });
    }

    if (action === 'toggle_coupon') {
      const { couponId } = body;
      const cpn = db.coupons.find((c) => c.id === couponId);
      if (cpn) {
        cpn.isActive = !cpn.isActive;
        appendAuditLog({
          actorId: adminActor.id,
          actorName: adminActor.name,
          actorRole: 'admin',
          action: 'COUPON_TOGGLED',
          resourceType: 'Coupon',
          resourceId: cpn.code,
          details: `Set coupon ${cpn.code} active=${cpn.isActive}`,
        });
      }
      saveDb(db);
      return NextResponse.json({ coupon: cpn });
    }

    if (action === 'delete_coupon') {
      const { couponId } = body;
      const cpn = db.coupons.find((c) => c.id === couponId);
      db.coupons = db.coupons.filter((c) => c.id !== couponId);
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'COUPON_DELETED',
        resourceType: 'Coupon',
        resourceId: cpn?.code || String(couponId),
        details: `Deleted promotional offer ${cpn?.code || couponId}`,
      });
      saveDb(db);
      return NextResponse.json({ deleted: true });
    }

    if (action === 'toggle_user_status') {
      const { userId } = body;
      const user = db.users.find((u) => u.id === userId);
      if (user) {
        user.isActive = !user.isActive;
        user.updatedAt = now;
        if (!user.isActive) {
          db.sessions.forEach((s) => {
            if (s.userId === user.id && !s.revokedAt) s.revokedAt = now;
          });
        }
        appendAuditLog({
          actorId: adminActor.id,
          actorName: adminActor.name,
          actorRole: 'admin',
          action: user.isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
          resourceType: 'User',
          resourceId: user.id,
          details: `${user.isActive ? 'Activated' : 'Suspended'} account ${user.email}`,
        });
      }
      saveDb(db);
      return NextResponse.json({ success: true });
    }

    if (action === 'update_user_workspaces') {
      const { userId, allowedWorkspaces } = body;
      const user = db.users.find((u) => u.id === userId);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const validWorkspaces = (Array.isArray(allowedWorkspaces) ? allowedWorkspaces : []).filter(
        (w): w is WorkspaceType => w === 'customer' || w === 'admin'
      );
      if (validWorkspaces.length === 0) {
        return NextResponse.json(
          { error: 'At least one workspace permission must remain assigned.' },
          { status: 400 }
        );
      }

      user.allowedWorkspaces = validWorkspaces;
      if (validWorkspaces.includes('admin')) {
        user.role = 'admin';
        if (!user.mfaSecret) {
          user.mfaEnabled = true;
          user.mfaSecret = generateTotpSecret();
          user.recoveryCodes = generateRecoveryCodes();
        }
      } else {
        user.role = 'customer';
      }
      user.updatedAt = now;

      // Immediately revoke sessions for any workspace no longer permitted
      db.sessions.forEach((s) => {
        if (s.userId === user.id && !validWorkspaces.includes(s.workspace) && !s.revokedAt) {
          s.revokedAt = now;
        }
      });

      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'USER_WORKSPACES_UPDATED',
        resourceType: 'User',
        resourceId: user.id,
        details: `Updated workspace permissions for ${user.email} to [${validWorkspaces.join(', ')}]`,
      });
      saveDb(db);
      return NextResponse.json({ success: true, allowedWorkspaces: user.allowedWorkspaces });
    }

    if (action === 'toggle_restaurant_approval') {
      const { restaurantId } = body;
      const rest = db.restaurants.find((r) => r.id === restaurantId);
      if (rest) {
        rest.isApproved = !rest.isApproved;
        rest.updatedAt = now;
        appendAuditLog({
          actorId: adminActor.id,
          actorName: adminActor.name,
          actorRole: 'admin',
          action: 'RESTAURANT_APPROVAL_TOGGLED',
          resourceType: 'Restaurant',
          resourceId: rest.id,
          details: `Set restaurant "${rest.name}" isApproved=${rest.isApproved}`,
        });
      }
      saveDb(db);
      return NextResponse.json({ restaurant: rest });
    }

    if (action === 'change_admin_password') {
      const { currentPassword, newPassword } = body;
      const adminUser = db.users.find((u) => u.id === adminActor.id);
      if (!adminUser) return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
      if (!verifyPassword(String(currentPassword || ''), adminUser.passwordHash)) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }
      if (String(newPassword || '').length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long.' },
          { status: 400 }
        );
      }
      adminUser.passwordHash = hashPassword(String(newPassword));
      adminUser.updatedAt = now;
      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'ADMIN_PASSWORD_CHANGED',
        resourceType: 'User',
        resourceId: adminUser.id,
        details: `Administrator ${adminUser.email} rotated their account password`,
      });
      saveDb(db);
      return NextResponse.json({ success: true });
    }

    if (action === 'rotate_admin_mfa') {
      const adminUser = db.users.find((u) => u.id === adminActor.id);
      if (!adminUser) return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
      const newSecret = generateTotpSecret();
      const newRecoveryCodes = generateRecoveryCodes();
      adminUser.mfaEnabled = true;
      adminUser.mfaSecret = newSecret;
      adminUser.recoveryCodes = newRecoveryCodes;
      adminUser.updatedAt = now;

      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'ADMIN_MFA_ROTATED',
        resourceType: 'User',
        resourceId: adminUser.id,
        details: `Rotated TOTP MFA secret and regenerated recovery codes for ${adminUser.email}`,
      });
      saveDb(db);
      return NextResponse.json({
        mfaSecret: newSecret,
        recoveryCodes: newRecoveryCodes,
      });
    }

    if (action === 'mark_notifications_read') {
      const { userId } = body;
      db.notifications.forEach((n) => {
        if (!userId || n.userId === userId) n.isRead = true;
      });
      saveDb(db);
      return NextResponse.json({ success: true });
    }

    if (action === 'update_yantra_config') {
      const {
        platformUrl,
        apiKey,
        webhookSecret,
        mode,
        welcomeMessage,
        supportTitle,
        enabled,
        appDomain,
        appDescription,
        webhookUrl,
        webhookEnabled,
      } = body;
      if (platformUrl) db.yantraConfig.platformUrl = String(platformUrl).trim();
      if (apiKey && !String(apiKey).includes('••')) db.yantraConfig.apiKey = String(apiKey).trim();
      if (webhookSecret && !String(webhookSecret).includes('••')) {
        db.yantraConfig.webhookSecret = String(webhookSecret).trim();
      }
      if (mode) db.yantraConfig.mode = mode;
      if (welcomeMessage) db.yantraConfig.welcomeMessage = welcomeMessage;
      if (supportTitle) db.yantraConfig.supportTitle = String(supportTitle).trim();
      if (typeof enabled === 'boolean') db.yantraConfig.enabled = enabled;
      if (appDomain) db.yantraConfig.appDomain = String(appDomain).trim();
      if (appDescription) db.yantraConfig.appDescription = String(appDescription).trim();
      if (webhookUrl) db.yantraConfig.webhookUrl = String(webhookUrl).trim();
      if (typeof webhookEnabled === 'boolean') db.yantraConfig.webhookEnabled = webhookEnabled;

      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'YANTRA_CONFIG_UPDATED',
        resourceType: 'YantraConfig',
        resourceId: 'global',
        details: `Updated Yantra Ticketing Agent configuration (enabled: ${db.yantraConfig.enabled}, mode: ${db.yantraConfig.mode})`,
      });
      saveDb(db);
      return NextResponse.json({ success: true, yantraConfig: db.yantraConfig });
    }

    if (action === 'rotate_yantra_api_key') {
      const { restoreDefault } = body;
      const previousKey = db.yantraConfig.apiKey;
      const nextKey = restoreDefault
        ? 'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E'
        : generateNewYantraApiKey();
      db.yantraConfig.apiKey = nextKey;

      appendAuditLog({
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: 'admin',
        action: 'YANTRA_API_KEY_ROTATED',
        resourceType: 'YantraConfig',
        resourceId: 'global',
        details: `Rotated Yantra API key from ${previousKey.slice(0, 12)}••• to ${nextKey.slice(0, 12)}••• (invalidated prior ticket access tokens; webhook signing secret unchanged)`,
      });
      saveDb(db);
      return NextResponse.json({
        success: true,
        apiKey: nextKey,
        message:
          'API key rotated. All previously issued ticket access tokens are now invalidated; webhook signing secret remains unchanged.',
      });
    }

    if (action === 'admin_update_ticket') {
      const { ticketNumber, replyMessage, isInternalNote, newStatus, resolutionSummary } = body;
      if (!ticketNumber) {
        return NextResponse.json({ error: 'ticketNumber is required' }, { status: 400 });
      }
      const { ticket, webhookEmitted } = adminUpdateTicketAndDispatchWebhook({
        ticketNumber: String(ticketNumber),
        actorId: adminActor.id,
        actorName: adminActor.name,
        replyMessage: replyMessage ? String(replyMessage) : undefined,
        isInternalNote: Boolean(isInternalNote),
        newStatus: newStatus as SupportTicketStatus | undefined,
        resolutionSummary: resolutionSummary ? String(resolutionSummary) : undefined,
      });
      return NextResponse.json({
        success: true,
        ticket,
        webhookEmitted,
      });
    }

    if (action === 'reset_yantra_rate_limits') {
      resetYantraRateLimits();
      db.yantraConfig.webhookConsecutiveFailures = 0;
      db.yantraConfig.webhookPausedUntil = null;
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: 'Yantra rate limit windows and webhook pause state reset.',
      });
    }

    return NextResponse.json({ error: 'Unknown state mutation action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mutation error' },
      { status: 500 }
    );
  }
}
