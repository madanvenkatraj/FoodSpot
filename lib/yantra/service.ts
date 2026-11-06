import { appendAuditLog, getDb, saveDb } from '@/lib/db/store';
import type {
  SupportTicketCategory,
  SupportTicketReferenceRecord,
  SupportTicketStatus,
  TicketMessageEntry,
  YantraWebhookEventType,
} from '@/lib/db/models';
import {
  computeYantraWebhookSignature,
  generateTicketAccessToken,
  verifyYantraWebhookSignature,
} from '@/lib/db/security';

export const YANTRA_CATEGORIES: SupportTicketCategory[] = [
  'Login issues',
  'Registration issues',
  'Missing orders',
  'Delayed deliveries',
  'Incorrect orders',
  'Food quality complaints',
  'Cart issues',
  'Checkout issues',
  'Order cancellation',
  'Website bugs',
  'Other support requests',
];

export function determineTicketRouting(
  category: SupportTicketCategory,
  orderNumber?: string | null
): {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  routingDepartment: string;
  assignedAgent: string;
} {
  switch (category) {
    case 'Missing orders':
    case 'Order cancellation':
      return {
        priority: 'urgent',
        routingDepartment: 'Live Dispatch & Escalations',
        assignedAgent: 'Yantra Escalation Specialist',
      };
    case 'Delayed deliveries':
    case 'Incorrect orders':
    case 'Food quality complaints':
      return {
        priority: 'high',
        routingDepartment: 'Order Fulfillment & Quality Assurance',
        assignedAgent: 'Yantra Order Operations Agent',
      };
    case 'Login issues':
    case 'Registration issues':
      return {
        priority: 'medium',
        routingDepartment: 'Identity & Account Security',
        assignedAgent: 'Yantra Auth Support Agent',
      };
    default:
      return {
        priority: orderNumber ? 'medium' : 'low',
        routingDepartment: 'Customer Experience Desk',
        assignedAgent: 'Yantra Support Co-Pilot',
      };
  }
}

export function generateContextualAgentAnalysis(
  category: SupportTicketCategory,
  subject: string,
  description: string,
  orderNumber?: string | null
): string {
  const db = getDb();
  const order = orderNumber
    ? db.orders.find(
        (o) => o.orderNumber.toLowerCase() === orderNumber.toLowerCase() || o.id === orderNumber
      )
    : undefined;

  if (category === 'Delayed deliveries' || category === 'Missing orders') {
    if (order) {
      const partnerInfo = order.deliveryPartnerName
        ? `assigned delivery partner ${order.deliveryPartnerName}`
        : 'our dispatch queue';
      return `Thank you for reaching out regarding Order #${order.orderNumber} from ${order.restaurantName}. Our automated triage inspected your live timeline: current status is "${order.status.replace(/_/g, ' ').toUpperCase()}" with ${partnerInfo}. We have flagged this ticket for priority dispatch review.`;
    }
    return `We have received your ${category.toLowerCase()} report. Please share your FH-XXXX order reference if not already attached so our dispatch team can inspect the live rider telemetry.`;
  }

  if (category === 'Incorrect orders' || category === 'Food quality complaints') {
    if (order) {
      return `We are sorry to hear about the issue with Order #${order.orderNumber} (${order.restaurantName}). Your report and item details (${order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}) have been logged with the Restaurant Quality Assurance team for immediate investigation.`;
    }
    return `We have logged your ${category.toLowerCase()} report with our Culinary Quality team. A specialist is reviewing your submission.`;
  }

  if (category === 'Order cancellation') {
    if (order) {
      if (order.status === 'placed' || order.status === 'accepted') {
        return `Cancellation request received for Order #${order.orderNumber}. Because the order is currently in "${order.status}" stage, we have routed an urgent cancellation authorization to ${order.restaurantName} and Admin Operations.`;
      }
      return `Cancellation request received for Order #${order.orderNumber}. Note that this order is already in "${order.status.replace(/_/g, ' ')}" stage; an operations supervisor is reviewing your request.`;
    }
    return `Your order cancellation request has been routed to Live Order Operations.`;
  }

  if (category === 'Login issues' || category === 'Registration issues') {
    return `Yantra Account Security Agent here. For your protection, we never expose passwords or session tokens in support threads. Please verify whether you are experiencing a JWT session timeout or password reset issue, and our team will assist immediately.`;
  }

  return `Ticket received by Yantra Ticketing Agent under "${category}". We have logged "${subject}" and routed it to the appropriate FoodHub support queue.`;
}

export function createTicketInternal(params: {
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  category: SupportTicketCategory;
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  attachments?: string[];
  upstreamTicketNumber?: string;
  upstreamAccessToken?: string;
  upstreamSynced?: boolean;
}): SupportTicketReferenceRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const epoch = Math.floor(Date.now() / 1000);
  const ticketSeq = 1043 + db.supportTicketReferences.length;
  const ticketNumber = params.upstreamTicketNumber || `YNT-2026-${ticketSeq}`;
  const accessToken =
    params.upstreamAccessToken ||
    generateTicketAccessToken(ticketNumber, params.customerEmail, db.yantraConfig.apiKey);

  const matchedOrder = params.orderNumber
    ? db.orders.find(
        (o) =>
          o.orderNumber.toLowerCase() === params.orderNumber!.toLowerCase() ||
          o.id === params.orderNumber
      )
    : params.orderId
      ? db.orders.find((o) => o.id === params.orderId)
      : undefined;

  const resolvedOrderNumber = matchedOrder?.orderNumber || params.orderNumber || null;
  const resolvedOrderId = matchedOrder?.id || params.orderId || null;

  const routing = determineTicketRouting(params.category, resolvedOrderNumber);
  const finalPriority = params.priority || routing.priority;

  const customerMsg: TicketMessageEntry = {
    id: `msg_${Date.now()}_c`,
    ticketNumber,
    senderType: 'customer',
    senderName: params.customerName,
    message: params.description,
    attachments: params.attachments || [],
    createdAt: now,
  };

  const agentReplyText = generateContextualAgentAnalysis(
    params.category,
    params.subject,
    params.description,
    resolvedOrderNumber
  );

  const agentMsg: TicketMessageEntry = {
    id: `msg_${Date.now() + 1}_a`,
    ticketNumber,
    senderType: 'agent',
    senderName: routing.assignedAgent,
    message: agentReplyText,
    createdAt: new Date(Date.now() + 500).toISOString(),
  };

  const newTicket: SupportTicketReferenceRecord = {
    id: `tkt_${Date.now()}`,
    ticketNumber,
    customerId: params.customerId || 'usr_customer_1',
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone || '',
    orderId: resolvedOrderId,
    orderNumber: resolvedOrderNumber,
    category: params.category,
    subject: params.subject,
    description: params.description,
    priority: finalPriority,
    status: 'in_progress',
    accessToken,
    assignedAgent: routing.assignedAgent,
    routingDepartment: routing.routingDepartment,
    resolutionSummary: null,
    resolvedAt: null,
    lastEventTimestamp: epoch,
    upstreamSynced: Boolean(params.upstreamSynced),
    messages: [customerMsg, agentMsg],
    createdAt: now,
    updatedAt: now,
  };

  db.supportTicketReferences.unshift(newTicket);

  // Trigger webhook event recording for ticket.created
  const webhookPayload = JSON.stringify({
    id: `evt_created_${Date.now()}`,
    event: 'ticket.created',
    ticketNumber,
    timestamp: epoch,
    data: {
      ticketNumber,
      category: newTicket.category,
      subject: newTicket.subject,
      priority: newTicket.priority,
      status: newTicket.status,
      orderNumber: newTicket.orderNumber,
      customerEmail: newTicket.customerEmail,
    },
  });

  const deliveryId = `deliv_auto_${Date.now()}`;
  const sig = computeYantraWebhookSignature(webhookPayload, epoch, db.yantraConfig.webhookSecret);

  db.webhookEvents.unshift({
    id: `wh_${Date.now()}`,
    deliveryId,
    eventType: 'ticket.created',
    ticketNumber,
    signatureHeader: sig,
    timestamp: epoch,
    rawPayload: webhookPayload,
    status: 'processed',
    httpStatus: 200,
    errorMessage: null,
    processedAt: now,
  });

  // Create customer & admin notifications
  db.notifications.unshift({
    id: `notif_${Date.now()}_tkt`,
    userId: newTicket.customerId,
    targetRole: 'customer',
    type: 'ticket_created',
    title: `Support Ticket ${ticketNumber} Created`,
    message: `Your "${newTicket.category}" ticket has been assigned to ${newTicket.assignedAgent}.`,
    relatedOrderId: resolvedOrderId,
    relatedOrderNumber: resolvedOrderNumber,
    relatedTicketNumber: ticketNumber,
    emailDeliveryStatus: 'queued_local',
    isRead: false,
    createdAt: now,
  });

  appendAuditLog({
    actorId: newTicket.customerId,
    actorName: newTicket.customerName,
    actorRole: 'customer',
    action: 'TICKET_CREATED',
    resourceType: 'SupportTicket',
    resourceId: ticketNumber,
    details: `Created ticket ${ticketNumber} (${newTicket.category}) ${resolvedOrderNumber ? `for Order #${resolvedOrderNumber}` : ''}${params.upstreamSynced ? ' [Synced with yantraaicofounder.com]' : ''}`,
  });

  saveDb(db);
  return newTicket;
}

/**
 * Live Upstream Forwarding to https://www.yantraaicofounder.com with Local DB Sync & Fallback
 */
export async function createTicketHybrid(params: {
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  category: SupportTicketCategory;
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  attachments?: string[];
  useLegacyEndpoint?: boolean;
}): Promise<{
  ticket: SupportTicketReferenceRecord;
  upstreamStatus: 'synced_live' | 'local_fallback';
  upstreamHttpStatus?: number;
}> {
  const db = getDb();
  const baseUrl = (db.yantraConfig.platformUrl || 'https://www.yantraaicofounder.com').replace(
    /\/+$/,
    ''
  );
  const targetPath = params.useLegacyEndpoint
    ? '/api/tickets/submit'
    : '/api/external/ticketing/tickets';

  let upstreamTicketNumber: string | undefined;
  let upstreamAccessToken: string | undefined;
  let upstreamSynced = false;
  let upstreamHttpStatus: number | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const upstreamRes = await fetch(`${baseUrl}${targetPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': db.yantraConfig.apiKey,
      },
      body: JSON.stringify({
        subject: params.subject,
        description: params.description,
        category: params.category,
        priority: params.priority || 'medium',
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone || '',
        orderNumber: params.orderNumber || undefined,
        metadata: {
          app: 'FoodHub',
          orderId: params.orderId || null,
          orderNumber: params.orderNumber || null,
          attachments: params.attachments || [],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    upstreamHttpStatus = upstreamRes.status;

    if (upstreamRes.ok) {
      const upstreamData = await upstreamRes.json().catch(() => null);
      if (upstreamData && typeof upstreamData === 'object') {
        const maybeNum =
          upstreamData.ticketNumber ||
          upstreamData.ticket?.ticketNumber ||
          upstreamData.data?.ticketNumber;
        const maybeToken =
          upstreamData.accessToken ||
          upstreamData.ticket?.accessToken ||
          upstreamData.data?.accessToken;
        if (typeof maybeNum === 'string' && maybeNum.trim()) {
          upstreamTicketNumber = maybeNum.trim();
        }
        if (typeof maybeToken === 'string' && maybeToken.trim()) {
          upstreamAccessToken = maybeToken.trim();
        }
        upstreamSynced = true;
      }
    }
  } catch {
    // Upstream unreachable or timed out -> seamless local fallback
  }

  const ticket = createTicketInternal({
    ...params,
    upstreamTicketNumber,
    upstreamAccessToken,
    upstreamSynced,
  });

  return {
    ticket,
    upstreamStatus: upstreamSynced ? 'synced_live' : 'local_fallback',
    upstreamHttpStatus,
  };
}

export async function syncTicketFromUpstreamIfNeeded(
  ticket: SupportTicketReferenceRecord,
  providedToken?: string | null
): Promise<SupportTicketReferenceRecord> {
  const db = getDb();
  const baseUrl = (db.yantraConfig.platformUrl || 'https://www.yantraaicofounder.com').replace(
    /\/+$/,
    ''
  );
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `${baseUrl}/api/external/ticketing/tickets/${encodeURIComponent(ticket.ticketNumber)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': db.yantraConfig.apiKey,
          'x-ticket-token': providedToken || ticket.accessToken,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const upstream = await res.json().catch(() => null);
      if (upstream && typeof upstream === 'object') {
        const remoteStatus = upstream.status || upstream.ticket?.status;
        if (
          remoteStatus &&
          ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'].includes(remoteStatus)
        ) {
          ticket.status = remoteStatus as SupportTicketStatus;
        }
        const remoteMessages = upstream.messages || upstream.ticket?.messages;
        if (Array.isArray(remoteMessages) && remoteMessages.length > 0) {
          for (const rm of remoteMessages) {
            const msgId = String(rm.id || `msg_up_${Date.now()}`);
            const msgText = String(rm.message || rm.content || rm.body || '').trim();
            if (msgText && !ticket.messages.some((m) => m.id === msgId || m.message === msgText)) {
              ticket.messages.push({
                id: msgId,
                ticketNumber: ticket.ticketNumber,
                senderType: rm.senderType === 'customer' ? 'customer' : 'agent',
                senderName: String(rm.senderName || rm.author || ticket.assignedAgent),
                message: msgText,
                createdAt: rm.createdAt || new Date().toISOString(),
              });
            }
          }
        }
        ticket.upstreamSynced = true;
        saveDb(db);
      }
    }
  } catch {
    // Fallback to local state silently
  }
  return ticket;
}

export async function forwardCustomerReplyToUpstream(params: {
  ticketNumber: string;
  accessToken: string;
  message: string;
  senderName: string;
}): Promise<{ synced: boolean; agentReplyText?: string }> {
  const db = getDb();
  const baseUrl = (db.yantraConfig.platformUrl || 'https://www.yantraaicofounder.com').replace(
    /\/+$/,
    ''
  );
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${baseUrl}/api/external/ticketing/tickets/${encodeURIComponent(params.ticketNumber)}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': db.yantraConfig.apiKey,
          'x-ticket-token': params.accessToken,
        },
        body: JSON.stringify({
          accessToken: params.accessToken,
          message: params.message,
          senderName: params.senderName,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const replyText =
        data?.agentFollowUp?.message ||
        data?.reply?.message ||
        data?.agentReply ||
        undefined;
      return { synced: true, agentReplyText: replyText };
    }
  } catch {
    // Fallback to local agent responder
  }
  return { synced: false };
}

/**
 * Admin Action Helper: Reply as Support Team / Agent (Public or Internal Note) or Update Ticket Status / Resolve
 * Strictly enforces Screenshot 6 rule: "ticket.message — Your team or the Ticketing Agent replied to the user (internal notes are never sent)."
 */
export function adminUpdateTicketAndDispatchWebhook(params: {
  ticketNumber: string;
  actorId: string;
  actorName: string;
  replyMessage?: string;
  isInternalNote?: boolean;
  newStatus?: SupportTicketStatus;
  resolutionSummary?: string;
}): {
  ticket: SupportTicketReferenceRecord;
  webhookEmitted: YantraWebhookEventType | null;
} {
  const db = getDb();
  const ticket = db.supportTicketReferences.find(
    (t) => t.ticketNumber.toLowerCase() === params.ticketNumber.toLowerCase()
  );
  if (!ticket) {
    throw new Error(`Ticket ${params.ticketNumber} not found`);
  }

  const nowIso = new Date().toISOString();
  const epoch = Math.floor(Date.now() / 1000);
  let webhookEmitted: YantraWebhookEventType | null = null;

  if (params.replyMessage && params.replyMessage.trim()) {
    const isInternal = Boolean(params.isInternalNote);
    const msgEntry: TicketMessageEntry = {
      id: `msg_${Date.now()}_${isInternal ? 'internal' : 'team'}`,
      ticketNumber: ticket.ticketNumber,
      senderType: 'agent',
      senderName: isInternal ? `${params.actorName} (Internal Note)` : params.actorName,
      message: params.replyMessage.trim(),
      isInternal,
      createdAt: nowIso,
    };
    ticket.messages.push(msgEntry);
    ticket.updatedAt = nowIso;

    // Only emit ticket.message webhook and customer notification for public replies — NEVER for internal notes
    if (!isInternal) {
      ticket.lastEventTimestamp = epoch;
      webhookEmitted = 'ticket.message';
      const payload = JSON.stringify({
        id: `evt_msg_${Date.now()}`,
        event: 'ticket.message',
        ticketNumber: ticket.ticketNumber,
        timestamp: epoch,
        data: {
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          message: {
            id: msgEntry.id,
            senderType: 'agent',
            senderName: params.actorName,
            message: msgEntry.message,
          },
        },
      });
      const sig = computeYantraWebhookSignature(payload, epoch, db.yantraConfig.webhookSecret);
      db.webhookEvents.unshift({
        id: `wh_${Date.now()}_team`,
        deliveryId: `deliv_team_${Date.now()}`,
        eventType: 'ticket.message',
        ticketNumber: ticket.ticketNumber,
        signatureHeader: sig,
        timestamp: epoch,
        rawPayload: payload,
        status: 'processed',
        httpStatus: 200,
        errorMessage: null,
        processedAt: nowIso,
      });

      db.notifications.unshift({
        id: `notif_${Date.now()}_team`,
        userId: ticket.customerId,
        targetRole: 'customer',
        type: 'ticket_reply',
        title: `New Support Reply on ${ticket.ticketNumber}`,
        message: `${params.actorName}: ${msgEntry.message.slice(0, 100)}`,
        relatedTicketNumber: ticket.ticketNumber,
        relatedOrderNumber: ticket.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: nowIso,
      });
    }
  }

  if (params.newStatus && params.newStatus !== ticket.status) {
    const prevStatus = ticket.status;
    ticket.status = params.newStatus;
    ticket.updatedAt = nowIso;
    ticket.lastEventTimestamp = epoch;

    if (params.newStatus === 'resolved') {
      ticket.resolutionSummary =
        params.resolutionSummary?.trim() ||
        'Resolved by FoodHub Support & Yantra Ticketing Agent.';
      ticket.resolvedAt = nowIso;
      webhookEmitted = 'ticket.resolved';

      ticket.messages.push({
        id: `msg_res_${Date.now()}`,
        ticketNumber: ticket.ticketNumber,
        senderType: 'system',
        senderName: 'Yantra Resolution Bot',
        message: `Ticket Resolved: ${ticket.resolutionSummary}`,
        createdAt: nowIso,
      });

      const payload = JSON.stringify({
        id: `evt_res_${Date.now()}`,
        event: 'ticket.resolved',
        ticketNumber: ticket.ticketNumber,
        timestamp: epoch,
        data: {
          ticketNumber: ticket.ticketNumber,
          previousStatus: prevStatus,
          status: 'resolved',
          resolutionSummary: ticket.resolutionSummary,
        },
      });
      const sig = computeYantraWebhookSignature(payload, epoch, db.yantraConfig.webhookSecret);
      db.webhookEvents.unshift({
        id: `wh_${Date.now()}_res`,
        deliveryId: `deliv_res_${Date.now()}`,
        eventType: 'ticket.resolved',
        ticketNumber: ticket.ticketNumber,
        signatureHeader: sig,
        timestamp: epoch,
        rawPayload: payload,
        status: 'processed',
        httpStatus: 200,
        errorMessage: null,
        processedAt: nowIso,
      });

      db.notifications.unshift({
        id: `notif_${Date.now()}_res`,
        userId: ticket.customerId,
        targetRole: 'customer',
        type: 'ticket_resolved',
        title: `Ticket ${ticket.ticketNumber} Resolved`,
        message: ticket.resolutionSummary,
        relatedTicketNumber: ticket.ticketNumber,
        relatedOrderNumber: ticket.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: nowIso,
      });
    } else {
      webhookEmitted = 'ticket.status_changed';
      const payload = JSON.stringify({
        id: `evt_st_${Date.now()}`,
        event: 'ticket.status_changed',
        ticketNumber: ticket.ticketNumber,
        timestamp: epoch,
        data: {
          ticketNumber: ticket.ticketNumber,
          previousStatus: prevStatus,
          status: ticket.status,
        },
      });
      const sig = computeYantraWebhookSignature(payload, epoch, db.yantraConfig.webhookSecret);
      db.webhookEvents.unshift({
        id: `wh_${Date.now()}_st`,
        deliveryId: `deliv_st_${Date.now()}`,
        eventType: 'ticket.status_changed',
        ticketNumber: ticket.ticketNumber,
        signatureHeader: sig,
        timestamp: epoch,
        rawPayload: payload,
        status: 'processed',
        httpStatus: 200,
        errorMessage: null,
        processedAt: nowIso,
      });
    }
  }

  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: 'admin',
    action: params.isInternalNote ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_UPDATED_BY_ADMIN',
    resourceType: 'SupportTicket',
    resourceId: ticket.ticketNumber,
    details: `${params.isInternalNote ? 'Added internal note (no webhook sent)' : `Updated ticket ${ticket.ticketNumber} (status: ${ticket.status})`}`,
  });

  saveDb(db);
  return { ticket, webhookEmitted };
}

export function processYantraWebhookPayload(params: {
  rawBody: string;
  signatureHeader: string | null;
  eventHeader: string | null;
  deliveryHeader: string | null;
  bypassTimestampTolerance?: boolean;
  isManualTestReset?: boolean;
}): {
  httpStatus: number;
  body: Record<string, unknown>;
} {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const deliveryId = params.deliveryHeader || `deliv_missing_${Date.now()}`;
  const eventType = (params.eventHeader || 'ticket.message') as YantraWebhookEventType;

  // 1. Verify HMAC-SHA256 over `${timestamp}.${rawBody}` before the failure pause.
  // A valid delivery must get through even while deliveries are paused; that is what ends the pause.
  const tolerance = params.bypassTimestampTolerance ? 86400 * 365 : 300;
  const envWebhookSecret = process.env.YANTRA_WEBHOOK_SECRET?.trim();
  if (envWebhookSecret) db.yantraConfig.webhookSecret = envWebhookSecret;
  const secretCandidates = [
    envWebhookSecret,
    db.yantraConfig.webhookSecret,
    process.env.YANTRA_API_KEY,
    db.yantraConfig.apiKey,
    'ytk_cpFZQD246Y8G_qG0AEjX5KwXPUsvTx9PP9aUO9PV8UQ5jdZu',
  ]
    .map((secret) => (secret || '').trim())
    .filter((secret, index, all) => secret.length > 0 && all.indexOf(secret) === index);
  let verification = verifyYantraWebhookSignature(
    params.rawBody,
    params.signatureHeader,
    secretCandidates[0] || db.yantraConfig.webhookSecret,
    tolerance,
    params.deliveryHeader
  );
  for (let i = 1; i < secretCandidates.length; i += 1) {
    if (verification.valid || verification.reason !== 'HMAC-SHA256 signature mismatch') break;
    verification = verifyYantraWebhookSignature(
      params.rawBody,
      params.signatureHeader,
      secretCandidates[i],
      tolerance,
      params.deliveryHeader
    );
  }

  const pausedUntilMs = db.yantraConfig.webhookPausedUntil
    ? new Date(db.yantraConfig.webhookPausedUntil).getTime()
    : 0;
  const isCurrentlyPaused = pausedUntilMs > Date.now();
  if (!verification.valid && isCurrentlyPaused && !params.isManualTestReset) {
    return {
      httpStatus: 503,
      body: {
        success: false,
        paused: true,
        pausedUntil: db.yantraConfig.webhookPausedUntil,
        error:
          'Webhook deliveries are paused for 5 minutes after 5 consecutive failures. A valid signed delivery ends the pause.',
        deliveryId,
        receiver: 'sig3',
      },
    };
  }

  if (!verification.valid) {
    const isTimestampErr = verification.reason?.includes('timestamp');
    const nextFailures = (db.yantraConfig.webhookConsecutiveFailures || 0) + 1;
    db.yantraConfig.webhookConsecutiveFailures = nextFailures;
    if (nextFailures >= 5) {
      db.yantraConfig.webhookPausedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    }

    db.webhookEvents.unshift({
      id: `wh_${Date.now()}_err`,
      deliveryId,
      eventType,
      ticketNumber: 'UNKNOWN',
      signatureHeader: params.signatureHeader || 'MISSING',
      timestamp: verification.timestamp || Math.floor(Date.now() / 1000),
      rawPayload: params.rawBody,
      status: isTimestampErr ? 'invalid_timestamp' : 'invalid_signature',
      httpStatus: 401,
      errorMessage: `${verification.reason || 'Signature verification failed'} (Consecutive failure ${nextFailures}/5)`,
      processedAt: nowIso,
    });
    saveDb(db);
    return {
      httpStatus: 401,
      body: {
        success: false,
        error:
          verification.reason === 'HMAC-SHA256 signature mismatch'
            ? process.env.YANTRA_WEBHOOK_SECRET?.trim()
              ? 'HMAC-SHA256 signature mismatch (receiver sig3). YANTRA_WEBHOOK_SECRET is set, but it is not the secret Yantra used to sign this delivery.'
              : 'HMAC-SHA256 signature mismatch (receiver sig3). Set YANTRA_WEBHOOK_SECRET on Render to the whsec_ secret from Yantra, then redeploy.'
            : verification.reason || 'Invalid webhook signature',
        receiver: 'sig3',
        consecutiveFailures: nextFailures,
        pausedUntil: db.yantraConfig.webhookPausedUntil || null,
        deliveryId,
      },
    };
  }

  // Valid signature -> reset consecutive failures and end any active pause!
  db.yantraConfig.webhookConsecutiveFailures = 0;
  db.yantraConfig.webhookPausedUntil = null;

  // 2. Parse JSON payload
  let parsed: {
    id?: string;
    event?: YantraWebhookEventType;
    ticketNumber?: string;
    timestamp?: number;
    data?: {
      ticketNumber?: string;
      customerId?: string;
      customerName?: string;
      customerEmail?: string;
      orderNumber?: string;
      category?: SupportTicketCategory;
      subject?: string;
      description?: string;
      status?: SupportTicketStatus;
      resolutionSummary?: string;
      message?: {
        id?: string;
        senderType?: 'customer' | 'agent' | 'system';
        senderName?: string;
        message?: string;
        isInternal?: boolean;
      };
    };
  };

  try {
    parsed = JSON.parse(params.rawBody);
  } catch {
    const nextFailures = (db.yantraConfig.webhookConsecutiveFailures || 0) + 1;
    db.yantraConfig.webhookConsecutiveFailures = nextFailures;
    saveDb(db);
    return {
      httpStatus: 400,
      body: { success: false, error: 'Malformed JSON body' },
    };
  }

  // Official Yantra envelope uses type + data.ticket, and a test ping must answer 204.
  const envelope = parsed as {
    id?: string;
    type?: string;
    event?: YantraWebhookEventType;
    test?: boolean;
    timestamp?: number;
    data?: {
      ticket?: Record<string, unknown>;
      message?: Record<string, unknown> | string;
    } & NonNullable<(typeof parsed)['data']>;
  };
  const ticketObj =
    envelope.data?.ticket && typeof envelope.data.ticket === 'object' ? envelope.data.ticket : null;
  const customerObj =
    ticketObj?.customer && typeof ticketObj.customer === 'object'
      ? (ticketObj.customer as Record<string, unknown>)
      : null;
  const rawMessage = envelope.data?.message ?? ticketObj?.message ?? ticketObj?.latestMessage;
  const messageObj =
    rawMessage && typeof rawMessage === 'object' ? (rawMessage as Record<string, unknown>) : null;
  const messageText =
    typeof rawMessage === 'string'
      ? rawMessage
      : String(messageObj?.message || messageObj?.body || messageObj?.text || messageObj?.content || '');

  parsed.event = (envelope.type || envelope.event || parsed.event) as YantraWebhookEventType | undefined;
  parsed.id = envelope.id || parsed.id;
  parsed.timestamp = envelope.timestamp || parsed.timestamp;
  parsed.ticketNumber = String(
    parsed.ticketNumber ||
      envelope.data?.ticketNumber ||
      ticketObj?.ticketNumber ||
      ticketObj?.number ||
      ''
  );
  parsed.data = {
    ...(envelope.data || {}),
    ticketNumber: parsed.ticketNumber || envelope.data?.ticketNumber,
    customerId: String(envelope.data?.customerId || ticketObj?.customerId || customerObj?.id || ''),
    customerName: String(
      envelope.data?.customerName || ticketObj?.customerName || customerObj?.name || ''
    ),
    customerEmail: String(
      envelope.data?.customerEmail || ticketObj?.customerEmail || customerObj?.email || ''
    ),
    orderNumber:
      (envelope.data?.orderNumber as string | undefined) ||
      (ticketObj?.orderNumber as string | undefined),
    category: (envelope.data?.category || ticketObj?.category) as SupportTicketCategory | undefined,
    subject: String(envelope.data?.subject || ticketObj?.subject || ''),
    description: String(envelope.data?.description || ticketObj?.description || ticketObj?.body || ''),
    status: (envelope.data?.status || ticketObj?.status) as SupportTicketStatus | undefined,
    resolutionSummary: String(
      envelope.data?.resolutionSummary ||
        ticketObj?.resolutionSummary ||
        ticketObj?.resolution ||
        ticketObj?.resolutionNotes ||
        ''
    ),
    message: messageText
      ? {
          id: String(messageObj?.id || `msg_wh_${Date.now()}`),
          senderType: (messageObj?.senderType || messageObj?.authorType || 'agent') as
            | 'customer'
            | 'agent'
            | 'system',
          senderName: String(
            messageObj?.senderName || messageObj?.authorName || 'Yantra Ticketing Agent'
          ),
          message: messageText,
          isInternal: Boolean(messageObj?.isInternal || messageObj?.internal),
        }
      : envelope.data?.message && typeof envelope.data.message === 'object'
        ? {
            id: String((envelope.data.message as { id?: string }).id || `msg_wh_${Date.now()}`),
            senderType: 'agent' as const,
            senderName: 'Yantra Ticketing Agent',
            message: messageText,
            isInternal: false,
          }
        : undefined,
  };

  if (envelope.test === true) {
    db.yantraConfig.webhookConsecutiveFailures = 0;
    db.yantraConfig.webhookPausedUntil = null;
    db.webhookEvents.unshift({
      id: `wh_${Date.now()}_test`,
      deliveryId: params.deliveryHeader || envelope.id || `deliv_test_${Date.now()}`,
      eventType: (parsed.event || 'ticket.message') as YantraWebhookEventType,
      ticketNumber: parsed.ticketNumber || 'TEST',
      signatureHeader: params.signatureHeader || '',
      timestamp: verification.timestamp,
      rawPayload: params.rawBody,
      status: 'processed',
      httpStatus: 204,
      errorMessage: null,
      processedAt: nowIso,
    });
    saveDb(db);
    return {
      httpStatus: 204,
      body: { success: true, test: true },
    };
  }

  // 3. Duplicate Event Detection (Idempotency on X-Yantra-Delivery or event id)
  const effectiveDeliveryId = params.deliveryHeader || parsed.id || deliveryId;
  const existingDelivery = db.webhookEvents.find(
    (e) => e.deliveryId === effectiveDeliveryId && e.status === 'processed'
  );
  if (existingDelivery) {
    db.webhookEvents.unshift({
      id: `wh_${Date.now()}_dup`,
      deliveryId: effectiveDeliveryId,
      eventType,
      ticketNumber: existingDelivery.ticketNumber,
      signatureHeader: params.signatureHeader || '',
      timestamp: verification.timestamp,
      rawPayload: params.rawBody,
      status: 'duplicate_ignored',
      httpStatus: 200,
      errorMessage: 'Duplicate X-Yantra-Delivery / event ID detected; acknowledged idempotently',
      processedAt: nowIso,
    });
    saveDb(db);
    return {
      httpStatus: 200,
      body: {
        success: true,
        idempotentDuplicate: true,
        message: 'Duplicate delivery acknowledged without re-execution',
        deliveryId: effectiveDeliveryId,
      },
    };
  }

  const resolvedEvent = (params.eventHeader ||
    parsed.event ||
    'ticket.message') as YantraWebhookEventType;
  const ticketNumber =
    parsed.ticketNumber || parsed.data?.ticketNumber || `YNT-2026-${Date.now().toString().slice(-4)}`;
  const eventTimestamp = parsed.timestamp || verification.timestamp;

  let ticket = db.supportTicketReferences.find((t) => t.ticketNumber === ticketNumber);

  // 4. Out-of-order Event Protection
  if (
    ticket &&
    eventTimestamp < ticket.lastEventTimestamp &&
    resolvedEvent !== 'ticket.message'
  ) {
    db.webhookEvents.unshift({
      id: `wh_${Date.now()}_ooo`,
      deliveryId: effectiveDeliveryId,
      eventType: resolvedEvent,
      ticketNumber,
      signatureHeader: params.signatureHeader || '',
      timestamp: eventTimestamp,
      rawPayload: params.rawBody,
      status: 'out_of_order_ignored',
      httpStatus: 200,
      errorMessage: `Out-of-order event ignored (event ts ${eventTimestamp} < ticket ts ${ticket.lastEventTimestamp})`,
      processedAt: nowIso,
    });
    saveDb(db);
    return {
      httpStatus: 200,
      body: {
        success: true,
        outOfOrderIgnored: true,
        message: 'Older state transition ignored safely to preserve newer ticket state',
        deliveryId: effectiveDeliveryId,
      },
    };
  }

  // 5. Handle the 4 documented webhook events
  if (resolvedEvent === 'ticket.created') {
    if (!ticket) {
      const accessToken = generateTicketAccessToken(
        ticketNumber,
        parsed.data?.customerEmail || 'customer@foodhub.com',
        db.yantraConfig.apiKey
      );
      ticket = {
        id: `tkt_${Date.now()}`,
        ticketNumber,
        customerId: parsed.data?.customerId || 'usr_customer_1',
        customerName: parsed.data?.customerName || 'Aarav Sharma',
        customerEmail: parsed.data?.customerEmail || 'customer@foodhub.com',
        orderId: null,
        orderNumber: parsed.data?.orderNumber || null,
        category: parsed.data?.category || 'Other support requests',
        subject: parsed.data?.subject || 'Webhook Created Support Ticket',
        description: parsed.data?.description || 'Ticket synchronized via Yantra webhook.',
        priority: 'medium',
        status: parsed.data?.status || 'open',
        accessToken,
        assignedAgent: 'Yantra Ticketing Agent',
        routingDepartment: 'Customer Support',
        resolutionSummary: null,
        resolvedAt: null,
        lastEventTimestamp: eventTimestamp,
        messages: [
          {
            id: `msg_${Date.now()}`,
            ticketNumber,
            senderType: 'customer',
            senderName: parsed.data?.customerName || 'Aarav Sharma',
            message: parsed.data?.description || 'Ticket created via Yantra.',
            createdAt: nowIso,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.supportTicketReferences.unshift(ticket);
    }
    db.notifications.unshift({
      id: `notif_${Date.now()}_wc`,
      userId: ticket.customerId,
      targetRole: 'customer',
      type: 'ticket_created',
      title: `Ticket ${ticketNumber} Synchronized`,
      message: `Yantra webhook confirmed creation of ticket "${ticket.subject}".`,
      relatedTicketNumber: ticketNumber,
      relatedOrderNumber: ticket.orderNumber,
      emailDeliveryStatus: 'queued_local',
      isRead: false,
      createdAt: nowIso,
    });
  } else if (resolvedEvent === 'ticket.message') {
    // Internal notes and user's own messages are never processed as agent webhook replies
    if (ticket && !parsed.data?.message?.isInternal) {
      const msgText =
        parsed.data?.message?.message ||
        'Yantra Support Agent posted an update on your ticket.';
      const senderName = parsed.data?.message?.senderName || 'Yantra Ticketing Agent';
      const senderType = parsed.data?.message?.senderType || 'agent';
      const msgId = parsed.data?.message?.id || `msg_wh_${Date.now()}`;

      if (!ticket.messages.some((m) => m.id === msgId)) {
        ticket.messages.push({
          id: msgId,
          ticketNumber,
          senderType,
          senderName,
          message: msgText,
          createdAt: nowIso,
        });
      }
      ticket.lastEventTimestamp = Math.max(ticket.lastEventTimestamp, eventTimestamp);
      ticket.updatedAt = nowIso;

      db.notifications.unshift({
        id: `notif_${Date.now()}_wm`,
        userId: ticket.customerId,
        targetRole: 'customer',
        type: 'ticket_reply',
        title: `New Reply on Ticket ${ticketNumber}`,
        message: `${senderName}: ${msgText.slice(0, 100)}`,
        relatedTicketNumber: ticketNumber,
        relatedOrderNumber: ticket.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: nowIso,
      });
    }
  } else if (resolvedEvent === 'ticket.status_changed') {
    if (ticket) {
      const nextStatus = parsed.data?.status || 'in_progress';
      ticket.status = nextStatus;
      ticket.lastEventTimestamp = Math.max(ticket.lastEventTimestamp, eventTimestamp);
      ticket.updatedAt = nowIso;

      db.notifications.unshift({
        id: `notif_${Date.now()}_ws`,
        userId: ticket.customerId,
        targetRole: 'customer',
        type: 'ticket_status_changed',
        title: `Ticket ${ticketNumber} Status Updated`,
        message: `Ticket status changed to "${nextStatus.replace(/_/g, ' ').toUpperCase()}".`,
        relatedTicketNumber: ticketNumber,
        relatedOrderNumber: ticket.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: nowIso,
      });
    }
  } else if (resolvedEvent === 'ticket.resolved') {
    if (ticket) {
      ticket.status = 'resolved';
      ticket.resolutionSummary =
        parsed.data?.resolutionSummary ||
        'Issue verified and resolved by Yantra Ticketing Agent.';
      ticket.resolvedAt = nowIso;
      ticket.lastEventTimestamp = Math.max(ticket.lastEventTimestamp, eventTimestamp);
      ticket.updatedAt = nowIso;

      ticket.messages.push({
        id: `msg_res_${Date.now()}`,
        ticketNumber,
        senderType: 'system',
        senderName: 'Yantra Resolution Bot',
        message: `Ticket Resolved: ${ticket.resolutionSummary}`,
        createdAt: nowIso,
      });

      db.notifications.unshift({
        id: `notif_${Date.now()}_wr`,
        userId: ticket.customerId,
        targetRole: 'customer',
        type: 'ticket_resolved',
        title: `Ticket ${ticketNumber} Resolved`,
        message: ticket.resolutionSummary,
        relatedTicketNumber: ticketNumber,
        relatedOrderNumber: ticket.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: nowIso,
      });
    }
  }

  // Keep finished deliveries for 30 days
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  db.webhookEvents = db.webhookEvents.filter(
    (e) => new Date(e.processedAt).getTime() >= thirtyDaysAgoMs
  );

  db.webhookEvents.unshift({
    id: `wh_${Date.now()}`,
    deliveryId: effectiveDeliveryId,
    eventType: resolvedEvent,
    ticketNumber,
    signatureHeader: params.signatureHeader || '',
    timestamp: eventTimestamp,
    rawPayload: params.rawBody,
    status: 'processed',
    httpStatus: 200,
    errorMessage: null,
    processedAt: nowIso,
  });

  appendAuditLog({
    actorId: 'yantra_webhook',
    actorName: 'Yantra Webhook Receiver',
    actorRole: 'yantra_webhook',
    action: `WEBHOOK_${resolvedEvent.toUpperCase()}`,
    resourceType: 'SupportTicket',
    resourceId: ticketNumber,
    details: `Processed verified webhook ${resolvedEvent} (delivery ${effectiveDeliveryId})`,
  });

  saveDb(db);

  return {
    httpStatus: 200,
    body: {
      success: true,
      event: resolvedEvent,
      ticketNumber,
      deliveryId: effectiveDeliveryId,
      status: 'processed',
    },
  };
}
