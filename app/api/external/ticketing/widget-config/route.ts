import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/store';
import { getYantraCorsHeaders } from '@/lib/db/security';
import { YANTRA_CATEGORIES } from '@/lib/yantra/service';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getYantraCorsHeaders(),
  });
}

export async function GET(req: NextRequest) {
  const corsHeaders = getYantraCorsHeaders();
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const apiKey = req.headers.get('x-api-key') || searchParams.get('apiKey');

  if (db.yantraConfig.enabled === false) {
    return NextResponse.json(
      { error: 'Yantra Ticketing Agent is currently turned off.' },
      { status: 401, headers: corsHeaders }
    );
  }

  if (apiKey && apiKey !== db.yantraConfig.apiKey) {
    return NextResponse.json(
      {
        error:
          'Unauthorized: API key has been rotated or is invalid. Replace data-api-key in widget snippet.',
      },
      { status: 401, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    {
      platform: 'Yantra - Your AI Co-Founder Team',
      authenticatedWithKey: Boolean(apiKey && apiKey === db.yantraConfig.apiKey),
      apiKeyActive: db.yantraConfig.apiKey,
      widget: {
        enabled: true,
        title: db.yantraConfig.supportTitle,
        welcomeMessage: db.yantraConfig.welcomeMessage,
        primaryColor: db.yantraConfig.primaryColor,
        position: 'bottom-right',
        allowAttachments: true,
        allowOrderLinking: true,
        categories: YANTRA_CATEGORIES,
        endpoints: {
          createTicket: '/api/external/ticketing/tickets',
          retrieveTicket: '/api/external/ticketing/tickets/:ticketNumber',
          retrieveMessages: '/api/external/ticketing/tickets/:ticketNumber/messages',
          sendReply: '/api/external/ticketing/tickets/:ticketNumber/messages',
          legacySubmit: '/api/tickets/submit',
          webhookEndpoint: '/api/webhooks/yantra/tickets',
        },
      },
    },
    { headers: corsHeaders }
  );
}
