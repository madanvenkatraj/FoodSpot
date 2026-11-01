import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, getDb, saveDb } from '@/lib/db/store';
import {
  checkYantraRateLimit,
  computeYantraWebhookSignature,
  getYantraCorsHeaders,
  verifyTicketAccessToken,
} from '@/lib/db/security';
import {
  forwardCustomerReplyToUpstream,
  syncTicketFromUpstreamIfNeeded,
} from '@/lib/yantra/service';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getYantraCorsHeaders(),
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ ticketNumber: string }> }
) {
  const corsHeaders = getYantraCorsHeaders();
  const { ticketNumber } = await context.params;
  const db = getDb();

  if (db.yantraConfig.enabled === false) {
    return NextResponse.json(
      { error: 'Unauthorized: Yantra Ticketing Agent is disabled.' },
      { status: 401, headers: corsHeaders }
    );
  }

  let ticket = db.supportTicketReferences.find(
    (t) => t.ticketNumber.toLowerCase() === ticketNumber.toLowerCase()
  );

  if (!ticket) {
    return NextResponse.json(
      { error: `Ticket ${ticketNumber} not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  const { searchParams } = new URL(req.url);
  const ticketToken =
    req.headers.get('x-ticket-token') || searchParams.get('accessToken');
  const apiKey = req.headers.get('x-api-key') || searchParams.get('apiKey');

  if (apiKey && apiKey !== db.yantraConfig.apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or rotated x-api-key' },
      { status: 401, headers: corsHeaders }
    );
  }

  const isTokenValid = verifyTicketAccessToken({
    providedToken: ticketToken,
    ticketNumber: ticket.ticketNumber,
    customerEmail: ticket.customerEmail,
    currentApiKey: db.yantraConfig.apiKey,
    storedAccessToken: ticket.accessToken,
  });

  if (!isTokenValid) {
    return NextResponse.json(
      {
        error:
          'Unauthorized: Valid x-ticket-token header (or ?accessToken=) is required to poll ticket messages.',
      },
      { status: 401, headers: corsHeaders }
    );
  }

  ticket = await syncTicketFromUpstreamIfNeeded(ticket, ticketToken);

  const since = searchParams.get('since');
  let messages = ticket.messages.filter((m) => !m.isInternal);

  if (since) {
    const sinceTime = new Date(since).getTime();
    if (!Number.isNaN(sinceTime)) {
      messages = messages.filter((m) => new Date(m.createdAt).getTime() > sinceTime);
    }
  }

  return NextResponse.json(
    {
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      since: since || null,
      count: messages.length,
      messages,
    },
    { headers: corsHeaders }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ticketNumber: string }> }
) {
  const corsHeaders = getYantraCorsHeaders();
  try {
    const { ticketNumber } = await context.params;
    const db = getDb();

    if (db.yantraConfig.enabled === false) {
      return NextResponse.json(
        { error: 'Unauthorized: Yantra Ticketing Agent is disabled.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const apiKey =
      req.headers.get('x-api-key') || searchParams.get('apiKey') || db.yantraConfig.apiKey;

    if (apiKey !== db.yantraConfig.apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or rotated x-api-key' },
        { status: 401, headers: corsHeaders }
      );
    }

    const callerIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rateCheck = checkYantraRateLimit(callerIp, apiKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.reason || 'Rate limit exceeded (10 per caller IP, 300 per key, every 60s)',
          retryAfter: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': String(rateCheck.retryAfterSeconds),
          },
        }
      );
    }

    const ticket = db.supportTicketReferences.find(
      (t) => t.ticketNumber.toLowerCase() === ticketNumber.toLowerCase()
    );

    if (!ticket) {
      return NextResponse.json(
        { error: `Ticket ${ticketNumber} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const {
      accessToken,
      message,
      senderType = 'customer',
      senderName,
      reopen = false,
      autoAgentResponse = true,
    } = body;

    const providedToken = accessToken || req.headers.get('x-ticket-token');
    const isAgentWithApiKey = apiKey === db.yantraConfig.apiKey && senderType === 'agent';

    const isTokenValid = verifyTicketAccessToken({
      providedToken,
      ticketNumber: ticket.ticketNumber,
      customerEmail: ticket.customerEmail,
      currentApiKey: db.yantraConfig.apiKey,
      storedAccessToken: ticket.accessToken,
    });

    if (!isAgentWithApiKey && !isTokenValid) {
      return NextResponse.json(
        {
          error:
            'Unauthorized: Valid accessToken in request body derived from the active API key is required when posting customer replies.',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!message || !String(message).trim()) {
      return NextResponse.json(
        { error: 'Message content cannot be empty.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const nowIso = new Date().toISOString();
    const epoch = Math.floor(Date.now() / 1000);

    const wasResolved = ticket.status === 'resolved' || ticket.status === 'closed';
    if (senderType === 'customer' && (wasResolved || reopen)) {
      ticket.status = 'in_progress';
      ticket.resolutionSummary = null;
      ticket.resolvedAt = null;
    }

    const newMsg = {
      id: `msg_${Date.now()}`,
      ticketNumber: ticket.ticketNumber,
      senderType: senderType as 'customer' | 'agent' | 'system',
      senderName:
        senderName ||
        (senderType === 'customer' ? ticket.customerName : ticket.assignedAgent),
      message: String(message).trim(),
      createdAt: nowIso,
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = nowIso;
    ticket.lastEventTimestamp = epoch;

    // Forward customer reply to live upstream yantraaicofounder.com if available
    let upstreamReplyText: string | undefined;
    if (senderType === 'customer') {
      const upstreamReply = await forwardCustomerReplyToUpstream({
        ticketNumber: ticket.ticketNumber,
        accessToken: providedToken || ticket.accessToken,
        message: newMsg.message,
        senderName: newMsg.senderName,
      });
      if (upstreamReply.synced) {
        ticket.upstreamSynced = true;
        upstreamReplyText = upstreamReply.agentReplyText;
      }
    }

    let followUpAgentMessage = null;
    if (senderType === 'customer' && autoAgentResponse) {
      const followUpIso = new Date(Date.now() + 400).toISOString();
      const followUpText =
        upstreamReplyText ||
        (wasResolved
          ? `We have reopened Ticket ${ticket.ticketNumber} based on your reply. ${ticket.assignedAgent} is reviewing your update "${String(message).trim().slice(0, 60)}" right now.`
          : `Thank you for the update, ${ticket.customerName}. ${ticket.assignedAgent} has logged your reply on ${ticket.orderNumber ? `Order #${ticket.orderNumber}` : `Ticket ${ticket.ticketNumber}`} and is coordinating with the operations desk.`);

      followUpAgentMessage = {
        id: `msg_${Date.now() + 1}_agent`,
        ticketNumber: ticket.ticketNumber,
        senderType: 'agent' as const,
        senderName: ticket.assignedAgent,
        message: followUpText,
        createdAt: followUpIso,
      };
      ticket.messages.push(followUpAgentMessage);

      const whPayload = JSON.stringify({
        id: `evt_reply_${Date.now()}`,
        event: 'ticket.message',
        ticketNumber: ticket.ticketNumber,
        timestamp: epoch,
        data: {
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          message: followUpAgentMessage,
        },
      });

      db.webhookEvents.unshift({
        id: `wh_${Date.now()}`,
        deliveryId: `deliv_reply_${Date.now()}`,
        eventType: 'ticket.message',
        ticketNumber: ticket.ticketNumber,
        signatureHeader: computeYantraWebhookSignature(
          whPayload,
          epoch,
          db.yantraConfig.webhookSecret
        ),
        timestamp: epoch,
        rawPayload: whPayload,
        status: 'processed',
        httpStatus: 200,
        errorMessage: null,
        processedAt: followUpIso,
      });

      db.notifications.unshift({
        id: `notif_${Date.now()}_rep`,
        userId: ticket.customerId,
        targetRole: 'customer',
        type: 'ticket_reply',
        title: `Yantra Agent Replied on ${ticket.ticketNumber}`,
        message: followUpText,
        relatedTicketNumber: ticket.ticketNumber,
        relatedOrderNumber: ticket.orderNumber,
        emailDeliveryStatus: 'queued_local',
        isRead: false,
        createdAt: followUpIso,
      });
    }

    appendAuditLog({
      actorId: ticket.customerId,
      actorName: newMsg.senderName,
      actorRole: senderType === 'customer' ? 'customer' : 'admin',
      action: wasResolved ? 'TICKET_REOPENED_AND_REPLIED' : 'TICKET_MESSAGE_POSTED',
      resourceType: 'SupportTicket',
      resourceId: ticket.ticketNumber,
      details: `Posted reply on ${ticket.ticketNumber}`,
    });

    saveDb(db);

    return NextResponse.json(
      {
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        reopened: wasResolved,
        message: newMsg,
        agentFollowUp: followUpAgentMessage,
        ticket: {
          ...ticket,
          messages: ticket.messages.filter((m) => !m.isInternal),
        },
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post ticket message' },
      { status: 500, headers: corsHeaders }
    );
  }
}
