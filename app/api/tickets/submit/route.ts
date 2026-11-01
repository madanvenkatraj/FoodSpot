import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/store';
import { checkYantraRateLimit } from '@/lib/db/security';
import { createTicketHybrid, YANTRA_CATEGORIES } from '@/lib/yantra/service';
import type { SupportTicketCategory } from '@/lib/db/models';

/**
 * Legacy Ticket Submission Endpoint: POST /api/tickets/submit
 * Same key, limits, and handling as POST /api/external/ticketing/tickets,
 * but answers no browser preflight (server-to-server / legacy intake compatibility).
 */
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const providedKey =
      req.headers.get('x-api-key') || searchParams.get('apiKey') || db.yantraConfig.apiKey;

    if (db.yantraConfig.enabled === false) {
      return NextResponse.json(
        { error: 'Unauthorized: Yantra Ticketing Agent is disabled.' },
        { status: 401 }
      );
    }

    if (providedKey !== db.yantraConfig.apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or rotated x-api-key for POST /api/tickets/submit' },
        { status: 401 }
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
            'Retry-After': String(rateCheck.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json();
    const {
      customerId,
      customerName = 'Aarav Sharma',
      customerEmail = 'customer@foodspot.app',
      customerPhone = '',
      orderId = null,
      orderNumber = null,
      category = 'Other support requests',
      priority,
      subject = 'Legacy Support Request',
      description = 'Submitted via legacy /api/tickets/submit endpoint.',
      attachments = [],
    } = body;

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
      useLegacyEndpoint: true,
    });

    return NextResponse.json(
      {
        legacyCompatibility: true,
        preferredEndpoint: '/api/external/ticketing/tickets',
        ticketNumber: ticket.ticketNumber,
        accessToken: ticket.accessToken,
        status: ticket.status,
        upstreamStatus,
        ticket,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Legacy ticket submission failed' },
      { status: 500 }
    );
  }
}
