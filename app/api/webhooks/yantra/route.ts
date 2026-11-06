import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db/store';
import { computeYantraWebhookSignature } from '@/lib/db/security';
import { processYantraWebhookPayload } from '@/lib/yantra/service';
import type { YantraWebhookEventType } from '@/lib/db/models';

/**
 * Dedicated Yantra Webhook Receiver: POST /api/webhooks/yantra
 * Validates X-Yantra-Signature: t=<timestamp>,v1=<signature> over raw request body,
 * checks X-Yantra-Event and X-Yantra-Delivery headers, prevents duplicates, and handles
 * ticket.created, ticket.message, ticket.status_changed, and ticket.resolved.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-yantra-signature');
  const eventHeader = req.headers.get('x-yantra-event');
  const deliveryHeader = req.headers.get('x-yantra-delivery');
  const bypassWindow = req.headers.get('x-yantra-test-ooo') === 'true';
  const isManualTestReset = req.headers.get('x-yantra-test-reset') === 'true';

  const result = processYantraWebhookPayload({
    rawBody,
    signatureHeader,
    eventHeader,
    deliveryHeader,
    bypassTimestampTolerance: bypassWindow,
    isManualTestReset,
  });

  if (result.httpStatus === 204) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(result.body, { status: result.httpStatus });
}

/**
 * Webhook Test & Simulation Dispatcher: PUT /api/webhooks/yantra
 * Allows testing all 4 documented webhook events, duplicate delivery detection,
 * out-of-order event handling, invalid HMAC signature rejection, and 5-failure pause/resume.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    const {
      testScenario = 'ticket.message',
      ticketNumber: requestedTicketNumber,
      customMessage,
      customStatus,
    } = body;

    const targetTicket =
      db.supportTicketReferences.find((t) => t.ticketNumber === requestedTicketNumber) ||
      db.supportTicketReferences[0];

    const ticketNum = targetTicket?.ticketNumber || 'YNT-2026-1042';
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (testScenario === 'simulate_5_failures_pause') {
      // Trigger 5 consecutive invalid deliveries to trip the 5-minute pause circuit breaker
      let lastRes: { httpStatus: number; body: Record<string, unknown> } = {
        httpStatus: 401,
        body: {},
      };
      for (let i = 1; i <= 5; i++) {
        const failPayload = JSON.stringify({
          id: `evt_fail_${Date.now()}_${i}`,
          event: 'ticket.message',
          ticketNumber: ticketNum,
          timestamp: nowEpoch,
          data: { ticketNumber: ticketNum },
        });
        lastRes = processYantraWebhookPayload({
          rawBody: failPayload,
          signatureHeader: `t=${nowEpoch},v1=invalid_hmac_attempt_${i}`,
          eventHeader: 'ticket.message',
          deliveryHeader: `deliv_fail_${Date.now()}_${i}`,
        });
      }
      return NextResponse.json({
        scenario: testScenario,
        httpStatus: lastRes.httpStatus,
        response: lastRes.body,
        pausedUntil: getDb().yantraConfig.webhookPausedUntil,
      });
    }

    if (testScenario === 'reset_webhook_pause') {
      db.yantraConfig.webhookConsecutiveFailures = 0;
      db.yantraConfig.webhookPausedUntil = null;
      saveDb(db);
    }

    let eventType: YantraWebhookEventType = 'ticket.message';
    let deliveryId = `deliv_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let timestamp = nowEpoch;
    let payloadObj: Record<string, unknown> = {};
    let forceInvalidSig = false;
    let bypassTimestampTolerance = false;
    const isManualTestReset = testScenario !== 'invalid_signature';

    if (testScenario === 'ticket.created') {
      eventType = 'ticket.created';
      const newNum = `YNT-2026-${1050 + db.supportTicketReferences.length}`;
      payloadObj = {
        id: deliveryId,
        event: 'ticket.created',
        ticketNumber: newNum,
        timestamp,
        data: {
          ticketNumber: newNum,
          customerId: 'usr_customer_1',
          customerName: 'Aarav Sharma',
          customerEmail: 'customer@foodspot.app',
          orderNumber: db.orders[0]?.orderNumber || 'FS-1001',
          category: 'Delayed deliveries',
          subject: `Webhook Test Ticket (${newNum})`,
          description: 'Created via verified Yantra ticket.created webhook test delivery.',
          status: 'open',
        },
      };
    } else if (testScenario === 'ticket.message' || testScenario === 'reset_webhook_pause') {
      eventType = 'ticket.message';
      payloadObj = {
        id: deliveryId,
        event: 'ticket.message',
        ticketNumber: ticketNum,
        timestamp,
        data: {
          ticketNumber: ticketNum,
          status: 'in_progress',
          message: {
            id: `msg_wh_${Date.now()}`,
            senderType: 'agent',
            senderName: 'Yantra Senior Support Specialist',
            message:
              customMessage ||
              `[Verified Webhook Reply] We checked Order #${targetTicket?.orderNumber || 'FH-1001'} status with the kitchen and rider. Everything is on track!`,
          },
        },
      };
    } else if (testScenario === 'ticket.status_changed') {
      eventType = 'ticket.status_changed';
      payloadObj = {
        id: deliveryId,
        event: 'ticket.status_changed',
        ticketNumber: ticketNum,
        timestamp,
        data: {
          ticketNumber: ticketNum,
          status: customStatus || 'waiting_on_customer',
        },
      };
    } else if (testScenario === 'ticket.resolved') {
      eventType = 'ticket.resolved';
      payloadObj = {
        id: deliveryId,
        event: 'ticket.resolved',
        ticketNumber: ticketNum,
        timestamp,
        data: {
          ticketNumber: ticketNum,
          status: 'resolved',
          resolutionSummary:
            customMessage ||
            'Order delivered and customer confirmed satisfaction via Yantra support workflow.',
        },
      };
    } else if (testScenario === 'duplicate_delivery') {
      eventType = 'ticket.message';
      const lastProcessed = db.webhookEvents.find((e) => e.status === 'processed');
      deliveryId = lastProcessed?.deliveryId || 'deliv_yantra_init_001';
      payloadObj = {
        id: deliveryId,
        event: 'ticket.message',
        ticketNumber: ticketNum,
        timestamp,
        data: {
          ticketNumber: ticketNum,
          message: {
            id: 'msg_dup_test',
            senderType: 'agent',
            senderName: 'Yantra Ticketing Agent',
            message: 'Duplicate webhook delivery replay test.',
          },
        },
      };
    } else if (testScenario === 'out_of_order') {
      eventType = 'ticket.status_changed';
      // 1 hour older than current ticket timestamp
      timestamp = (targetTicket?.lastEventTimestamp || nowEpoch) - 3600;
      bypassTimestampTolerance = true;
      payloadObj = {
        id: deliveryId,
        event: 'ticket.status_changed',
        ticketNumber: ticketNum,
        timestamp,
        data: {
          ticketNumber: ticketNum,
          status: 'open',
        },
      };
    } else if (testScenario === 'invalid_signature') {
      eventType = 'ticket.message';
      forceInvalidSig = true;
      payloadObj = {
        id: deliveryId,
        event: 'ticket.message',
        ticketNumber: ticketNum,
        timestamp,
        data: {
          ticketNumber: ticketNum,
          message: {
            id: 'msg_untrusted',
            senderType: 'agent',
            senderName: 'Untrusted Caller',
            message: 'This payload has a tampered HMAC-SHA256 signature and must be rejected.',
          },
        },
      };
    }

    const rawBody = JSON.stringify(payloadObj);
    const signatureHeader = forceInvalidSig
      ? `t=${timestamp},v1=deadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd`
      : computeYantraWebhookSignature(rawBody, timestamp, db.yantraConfig.webhookSecret);

    const result = processYantraWebhookPayload({
      rawBody,
      signatureHeader,
      eventHeader: eventType,
      deliveryHeader: deliveryId,
      bypassTimestampTolerance,
      isManualTestReset,
    });

    return NextResponse.json({
      scenario: testScenario,
      httpStatus: result.httpStatus,
      headersSent: {
        'X-Yantra-Event': eventType,
        'X-Yantra-Delivery': deliveryId,
        'X-Yantra-Signature': signatureHeader,
      },
      response: result.body,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook test execution failed' },
      { status: 500 }
    );
  }
}
