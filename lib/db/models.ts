export type UserRole = 'customer' | 'restaurant' | 'delivery' | 'admin';
export type WorkspaceType = 'customer' | 'admin';

export interface UserRecord {
  id: string;
  name: string;
  username?: string;
  email: string;
  passwordHash: string;
  phone: string;
  role: UserRole;
  allowedWorkspaces: WorkspaceType[];
  mfaEnabled?: boolean;
  mfaSecret?: string | null;
  recoveryCodes?: string[];
  favorites: string[]; // restaurantIds
  isActive: boolean;
  resetToken?: string | null;
  resetTokenExpiry?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  workspace: WorkspaceType;
  mfaVerified: boolean;
  userAgent?: string;
  lastActiveAt?: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
  createdAt: string;
}

export type MenuSectionName =
  | 'Recommended'
  | 'Bestseller'
  | 'Starters'
  | 'Main Course'
  | 'Rice and Biryani'
  | 'Pizza and Burgers'
  | 'Desserts'
  | 'Beverages';

export interface RestaurantRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  cuisine: string[];
  image: string;
  bannerImage?: string;
  address: string;
  phone: string;
  openingHours: string;
  isAvailable: boolean;
  isApproved: boolean;
  rating: number;
  reviewCount: number;
  deliveryTimeMinutes: number;
  minOrderAmount: number;
  deliveryFee: number;
  featured: boolean;
  costForTwo?: number;
  isPureVeg?: boolean;
  offerBadge?: string;
  promoTag?: string;
  serviceableZones?: string[];
  menuSections?: string[];
  isRecommended?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FoodCustomizationOption {
  name: string;
  price: number;
}

export interface FoodCustomizationGroup {
  id: string;
  title: string;
  required: boolean;
  options: FoodCustomizationOption[];
}

export interface FoodItemRecord {
  id: string;
  restaurantId: string;
  categoryId: string;
  sectionName?: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isVeg: boolean;
  isAvailable: boolean;
  isPopular: boolean;
  isBestseller?: boolean;
  spiceLevel?: string;
  prepTimeMinutes?: number;
  calories?: number;
  serves?: string;
  menuSection?: MenuSectionName;
  customizations: FoodCustomizationGroup[];
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemEntry {
  id: string;
  foodItemId: string;
  name: string;
  price: number;
  image: string;
  isVeg: boolean;
  quantity: number;
  selectedCustomizations: { groupTitle: string; optionName: string; price: number }[];
  unitTotal: number;
}

export interface CartRecord {
  id: string;
  userId: string;
  restaurantId: string | null;
  items: CartItemEntry[];
  couponCode: string | null;
  updatedAt: string;
}

export interface AddressRecord {
  id: string;
  userId: string;
  label: 'Home' | 'Work' | 'Other';
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  instructions: string;
  isDefault: boolean;
  createdAt: string;
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderTimelineStep {
  status: OrderStatus;
  label: string;
  timestamp: string;
  note?: string;
  actorRole?: UserRole | 'system';
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  foodItemId: string;
  name: string;
  quantity: number;
  basePrice: number;
  selectedCustomizations: { groupTitle: string; optionName: string; price: number }[];
  unitTotal: number;
  lineTotal: number;
  isVeg: boolean;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  restaurantId: string;
  restaurantName: string;
  deliveryPartnerId: string | null;
  deliveryPartnerName: string | null;
  items: OrderItemRecord[];
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discountAmount: number;
  couponCode: string | null;
  totalAmount: number;
  status: OrderStatus;
  addressSnapshot: {
    label: string;
    recipientName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };
  contactPhone: string;
  deliveryInstructions: string;
  statusTimeline: OrderTimelineStep[];
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryPartnerRecord {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  vehicleType: 'Motorcycle' | 'Scooter' | 'Electric Bike' | 'Bicycle';
  vehicleNumber: string;
  isAvailable: boolean;
  currentZone: string;
  totalDeliveries: number;
  rating: number;
  earningsTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName: string;
  restaurantId: string;
  restaurantName: string;
  pickupAddress: string;
  dropoffAddress: string;
  customerName: string;
  customerPhone: string;
  status: 'assigned' | 'accepted' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'rejected';
  deliveryFeeEarned: number;
  assignedAt: string;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  customerId: string;
  customerName: string;
  restaurantId: string;
  restaurantName: string;
  foodItemId?: string | null;
  orderId?: string | null;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CouponRecord {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_delivery';
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number;
  isActive: boolean;
  expiresAt: string;
  usageCount: number;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  targetRole?: UserRole | 'all';
  type:
    | 'order_placed'
    | 'order_accepted'
    | 'order_preparing'
    | 'order_ready'
    | 'order_picked_up'
    | 'order_out_for_delivery'
    | 'order_delivered'
    | 'order_cancelled'
    | 'ticket_created'
    | 'ticket_reply'
    | 'ticket_status_changed'
    | 'ticket_resolved';
  title: string;
  message: string;
  relatedOrderId?: string | null;
  relatedOrderNumber?: string | null;
  relatedTicketNumber?: string | null;
  emailDeliveryStatus: 'queued_local' | 'confirmed_smtp' | 'not_configured';
  isRead: boolean;
  createdAt: string;
}

export type SupportTicketCategory =
  | 'Login issues'
  | 'Registration issues'
  | 'Missing orders'
  | 'Delayed deliveries'
  | 'Incorrect orders'
  | 'Food quality complaints'
  | 'Cart issues'
  | 'Checkout issues'
  | 'Order cancellation'
  | 'Website bugs'
  | 'Other support requests';

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'resolved'
  | 'closed';

export interface TicketMessageEntry {
  id: string;
  ticketNumber: string;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  message: string;
  isInternal?: boolean;
  attachments?: string[];
  createdAt: string;
}

export interface SupportTicketReferenceRecord {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  category: SupportTicketCategory;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: SupportTicketStatus;
  accessToken: string;
  assignedAgent: string;
  routingDepartment: string;
  resolutionSummary?: string | null;
  resolvedAt?: string | null;
  lastEventTimestamp: number;
  upstreamSynced?: boolean;
  messages: TicketMessageEntry[];
  createdAt: string;
  updatedAt: string;
}

export type YantraWebhookEventType =
  | 'ticket.created'
  | 'ticket.message'
  | 'ticket.status_changed'
  | 'ticket.resolved';

export interface WebhookEventRecord {
  id: string;
  deliveryId: string; // X-Yantra-Delivery
  eventType: YantraWebhookEventType;
  ticketNumber: string;
  signatureHeader: string;
  timestamp: number;
  rawPayload: string;
  status:
    | 'processed'
    | 'duplicate_ignored'
    | 'out_of_order_ignored'
    | 'invalid_signature'
    | 'invalid_timestamp'
    | 'paused_ignored';
  httpStatus: number;
  errorMessage?: string | null;
  processedAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | 'system' | 'yantra_webhook';
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  sessions?: SessionRecord[];
  categories: CategoryRecord[];
  restaurants: RestaurantRecord[];
  foodItems: FoodItemRecord[];
  carts: CartRecord[];
  addresses: AddressRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  deliveryPartners: DeliveryPartnerRecord[];
  deliveries: DeliveryRecord[];
  reviews: ReviewRecord[];
  coupons: CouponRecord[];
  notifications: NotificationRecord[];
  supportTicketReferences: SupportTicketReferenceRecord[];
  webhookEvents: WebhookEventRecord[];
  auditLogs: AuditLogRecord[];
  yantraConfig: {
    platformUrl: string;
    apiKey: string;
    webhookSecret: string;
    mode: 'hybrid_sandbox' | 'live_remote';
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
  };
}
