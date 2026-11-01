import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/store';
import {
  checkYantraRateLimit,
  getYantraCorsHeaders,
} from '@/lib/db/security';
import { createTicketHybrid, YANTRA_CATEGORIES } from '@/lib/yantra/service';
import type { SupportTicketCategory } from '@/lib/db/models';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getYantraCorsHeaders(),
  });
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const corsHeaders = getYantraCorsHeaders();
  const { searchParams } = new URL(req.url);
  const apiKey = req.headers.get('x-api-key') || searchParams.get('apiKey');
  const customerId = searchParams.get('customerId');

  if (db.yantraConfig.enabled === false) {
    return NextResponse.json(
      { error: 'Yantra Ticketing Agent is currently disabled.' },
      { status: 401, headers: corsHeaders }
    );
  }

  if (apiKey && apiKey !== db.yantraConfig.apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or rotated x-api-key provided for Yantra Ticketing API' },
      { status: 401, headers: corsHeaders }
    );
  }

  let tickets = db.supportTicketReferences;
  if (customerId) {
    tickets = tickets.filter((t) => t.customerId === customerId);
  }

  return NextResponse.json(
    {
      platform: 'Yantra - Your AI Co-Founder Team',
      tickets,
    },
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  const corsHeaders = getYantraCorsHeaders();
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const providedKey = req.headers.get('x-api-key') || searchParams.get('apiKey');

    if (db.yantraConfig.enabled === false) {
      return NextResponse.json(
        { error: 'Unauthorized: Yantra Ticketing Agent is turned off.' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!providedKey || providedKey !== db.yantraConfig.apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid x-api-key header (or ?apiKey=) is required.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const callerIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rateCheck = checkYantraRateLimit(callerIp, providedKey);
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

    const body = await req.json();
    const {
      customerId,
      customerName = 'Aarav Sharma',
      customerEmail = 'customer@foodhub.com',
      customerPhone = '',
      orderId = null,
      orderNumber = null,
      category = 'Other support requests',
      priority,
      subject,
      description,
      attachments = [],
    } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: 'Both subject and description are required to create a support ticket.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const validCategory: SupportTicketCategory = YANTRA_CATEGORIES.includes(category)
      ? category
      : 'Other support requests';

    const { ticket, upstreamStatus } = await createTicketHybrid({
      customerId,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim(),
      customerPhone: String(customerPhone).trim(),
      orderId,
      orderNumber: orderNumber ? String(orderNumber).trim() : null,
      category: validCategory,
      priority:
        priority && ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : undefined,
      subject: String(subject).trim(),
      description: String(description).trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      useLegacyEndpoint: false,
    });

    return NextResponse.json(
      {
        platform: 'Yantra - Your AI Co-Founder Team',
        ticketNumber: ticket.ticketNumber,
        accessToken: ticket.accessToken,
        status: ticket.status,
        priority: ticket.priority,
        assignedAgent: ticket.assignedAgent,
        routingDepartment: ticket.routingDepartment,
        upstreamStatus,
        ticket,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create ticket' },
      { status: 500, headers: corsHeaders }
    );
  }
}
