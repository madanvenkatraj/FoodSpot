import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/store';
import {
  getYantraCorsHeaders,
  verifyTicketAccessToken,
} from '@/lib/db/security';
import { syncTicketFromUpstreamIfNeeded } from '@/lib/yantra/service';

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
          'Unauthorized: Valid x-ticket-token (or ?accessToken=) derived from the active API key is required to read this ticket.',
      },
      { status: 401, headers: corsHeaders }
    );
  }

  ticket = await syncTicketFromUpstreamIfNeeded(ticket, ticketToken);
  const publicMessages = ticket.messages.filter((m) => !m.isInternal);

  return NextResponse.json(
    {
      platform: 'Yantra - Your AI Co-Founder Team',
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      subject: ticket.subject,
      orderNumber: ticket.orderNumber,
      assignedAgent: ticket.assignedAgent,
      routingDepartment: ticket.routingDepartment,
      resolutionSummary: ticket.resolutionSummary,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      messages: publicMessages,
    },
    { headers: corsHeaders }
  );
}
