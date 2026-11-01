'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Webhook,
} from 'lucide-react';
import type {
  SupportTicketReferenceRecord,
  SupportTicketStatus,
  WebhookEventRecord,
} from '@/lib/db/models';
import type { AppStatePayload } from '@/components/WorkspaceContext';

interface AdminYantraConsoleProps {
  appData: AppStatePayload;
  authHeaders: Record<string, string>;
  onRefreshState: () => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface E2ETestStepResult {
  id: string;
  name: string;
  mechanism: 'Widget' | 'REST API' | 'Webhook';
  httpStatus: number;
  passed: boolean;
  summary: string;
  payloadPreview?: string;
}

export default function AdminYantraConsole({
  appData,
  authHeaders,
  onRefreshState,
  onShowToast,
}: AdminYantraConsoleProps) {
  const [subTab, setSubTab] = useState<'tickets' | 'testbench' | 'webhooks' | 'config'>('tickets');

  // Ticket Queue state
  const [ticketFilter, setTicketFilter] = useState<string>('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicketNumber, setSelectedTicketNumber] = useState<string>(
    appData.supportTicketReferences[0]?.ticketNumber || ''
  );
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);

  // Configuration state
  const yCfg = appData.yantraConfig;
  const [enabled, setEnabled] = useState<boolean>(yCfg.enabled !== false);
  const [appDomain, setAppDomain] = useState<string>(yCfg.appDomain || 'foodhub.app');
  const [appDescription, setAppDescription] = useState<string>(
    yCfg.appDescription ||
      'FoodHub is an online food ordering and delivery platform with live order tracking, restaurant menus, and customer support.'
  );
  const [platformUrl, setPlatformUrl] = useState<string>(
    yCfg.platformUrl || 'https://www.yantraaicofounder.com'
  );
  const [apiKeyInput, setApiKeyInput] = useState<string>(
    yCfg.apiKey || 'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E'
  );
  const [webhookUrl, setWebhookUrl] = useState<string>(
    yCfg.webhookUrl || '/api/webhooks/yantra/tickets'
  );
  const [webhookEnabled, setWebhookEnabled] = useState<boolean>(yCfg.webhookEnabled !== false);
  const [savingConfig, setSavingConfig] = useState(false);

  // E2E Test Bench state
  const [runningE2E, setRunningE2E] = useState(false);
  const [e2eResults, setE2eResults] = useState<E2ETestStepResult[]>([]);
  const [singleTestOutput, setSingleTestOutput] = useState<string | null>(null);

  const tickets = useMemo(
    () => appData.supportTicketReferences || [],
    [appData.supportTicketReferences]
  );
  const webhookEvents = useMemo(
    () => appData.webhookEvents || [],
    [appData.webhookEvents]
  );

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    return tickets
      .filter((t) => (ticketFilter === 'all' ? true : t.status === ticketFilter))
      .filter((t) => {
        if (!q) return true;
        return (
          t.ticketNumber.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q) ||
          (t.orderNumber || '').toLowerCase().includes(q)
        );
      });
  }, [tickets, ticketFilter, ticketSearch]);

  const activeTicket: SupportTicketReferenceRecord | null = useMemo(() => {
    return (
      tickets.find((t) => t.ticketNumber === selectedTicketNumber) ||
      filteredTickets[0] ||
      tickets[0] ||
      null
    );
  }, [tickets, filteredTickets, selectedTicketNumber]);

  const activeApiKey = yCfg.apiKey || 'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E';

  const widgetSnippet = `<!-- yantra-support-widget:start -->
<script src="https://www.yantraaicofounder.com/api/external/ticketing/widget.js" data-api-key="${activeApiKey}" defer></script>
<!-- yantra-support-widget:end -->`;

  const handleAdminTicketAction = async (params: {
    replyMessage?: string;
    internal?: boolean;
    newStatus?: SupportTicketStatus;
    resSummary?: string;
  }) => {
    if (!activeTicket) return;
    setUpdatingTicket(true);
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'admin_update_ticket',
          ticketNumber: activeTicket.ticketNumber,
          replyMessage: params.replyMessage,
          isInternalNote: params.internal,
          newStatus: params.newStatus,
          resolutionSummary: params.resSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update ticket');
      }
      setAdminReplyText('');
      setResolutionSummary('');
      await onRefreshState();
      onShowToast(
        params.internal
          ? `Added internal note on ${activeTicket.ticketNumber} (kept private; no webhook emitted)`
          : `Updated ${activeTicket.ticketNumber}${data.webhookEmitted ? ` & dispatched ${data.webhookEmitted} webhook` : ''}`,
        'success'
      );
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : 'Ticket update failed', 'error');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'update_yantra_config',
          enabled,
          appDomain,
          appDescription,
          platformUrl,
          apiKey: apiKeyInput,
          webhookUrl,
          webhookEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      await onRefreshState();
      onShowToast('Saved Yantra Ticketing Agent configuration.', 'success');
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : 'Failed to save configuration', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRotateApiKey = async (restoreDefault = false) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'rotate_yantra_api_key',
          restoreDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to rotate API key');
      }
      if (data.apiKey) {
        setApiKeyInput(data.apiKey);
      }
      await onRefreshState();
      onShowToast(
        restoreDefault
          ? 'Restored default Yantra API key (ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E).'
          : 'Rotated Yantra API key! All previous ticket access tokens are now invalidated.',
        'info'
      );
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : 'Key rotation failed', 'error');
    }
  };

  const handleRunWebhookScenario = async (scenario: string) => {
    try {
      const res = await fetch('/api/webhooks/yantra/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testScenario: scenario,
          ticketNumber: activeTicket?.ticketNumber || 'YNT-2026-1042',
        }),
      });
      const data = await res.json();
      setSingleTestOutput(JSON.stringify(data, null, 2));
      await onRefreshState();
      onShowToast(
        `Webhook scenario "${scenario}" -> HTTP ${data.httpStatus}`,
        data.httpStatus === 200 ? 'success' : 'info'
      );
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : 'Webhook test failed', 'error');
    }
  };

  const handleRunFullE2ESuite = async () => {
    setRunningE2E(true);
    setE2eResults([]);
    const steps: E2ETestStepResult[] = [];

    try {
      // First reset rate limits & pause state so the full test suite starts clean
      await fetch('/api/state', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'reset_yantra_rate_limits' }),
      });

      const currentKey =
        appData.yantraConfig.apiKey || 'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E';

      // 1. Test Support Widget Script (GET /api/external/ticketing/widget.js - no key required)
      const wJsRes = await fetch('/api/external/ticketing/widget.js');
      const wJsText = await wJsRes.text();
      steps.push({
        id: 'step_1',
        name: 'GET /api/external/ticketing/widget.js (No Key Required)',
        mechanism: 'Widget',
        httpStatus: wJsRes.status,
        passed: wJsRes.status === 200 && wJsText.includes('YantraSupportWidget'),
        summary: 'Loaded widget.js script reading data-api-key attribute.',
      });

      // 2. Test Widget Config (GET /api/external/ticketing/widget-config with x-api-key)
      const wCfgRes = await fetch('/api/external/ticketing/widget-config', {
        headers: { 'x-api-key': currentKey },
      });
      const wCfgData = await wCfgRes.json();
      steps.push({
        id: 'step_2',
        name: 'GET /api/external/ticketing/widget-config (x-api-key)',
        mechanism: 'Widget',
        httpStatus: wCfgRes.status,
        passed: wCfgRes.status === 200 && Boolean(wCfgData.widget),
        summary: `Authenticated widget config: ${wCfgData.widget?.categories?.length || 0} categories loaded.`,
      });

      // 3. Test Create Ticket via REST API (POST /api/external/ticketing/tickets)
      const createRes = await fetch('/api/external/ticketing/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': currentKey,
        },
        body: JSON.stringify({
          customerName: 'Aarav Sharma',
          customerEmail: 'customer@foodhub.com',
          orderNumber: 'FH-1001',
          category: 'Delayed deliveries',
          priority: 'high',
          subject: 'E2E Automated Verification Ticket',
          description: 'Verifying live upstream forwarding + local DB sync and accessToken generation.',
        }),
      });
      const createData = await createRes.json();
      const createdTicketNum = createData.ticketNumber || 'YNT-2026-1042';
      const createdToken = createData.accessToken || '';
      steps.push({
        id: 'step_3',
        name: 'POST /api/external/ticketing/tickets (Raise Ticket)',
        mechanism: 'REST API',
        httpStatus: createRes.status,
        passed: createRes.status === 201 && Boolean(createdToken),
        summary: `Created ${createdTicketNum} with key-derived token ${createdToken.slice(0, 14)}••• (${createData.upstreamStatus})`,
      });

      // 4. Test Read Ticket Status & Conversation (GET /api/external/ticketing/tickets/:ticketNumber)
      const getTktRes = await fetch(
        `/api/external/ticketing/tickets/${encodeURIComponent(createdTicketNum)}`,
        {
          headers: {
            'x-api-key': currentKey,
            'x-ticket-token': createdToken,
          },
        }
      );
      const getTktData = await getTktRes.json();
      steps.push({
        id: 'step_4',
        name: `GET /api/external/ticketing/tickets/${createdTicketNum} (x-ticket-token)`,
        mechanism: 'REST API',
        httpStatus: getTktRes.status,
        passed: getTktRes.status === 200 && getTktData.ticketNumber === createdTicketNum,
        summary: `Retrieved status "${getTktData.status}" & ${getTktData.messages?.length || 0} public messages.`,
      });

      // 5. Test Incremental Message Polling (GET /api/external/ticketing/tickets/:ticketNumber/messages?since=...)
      const sinceIso = new Date(Date.now() - 60000).toISOString();
      const pollRes = await fetch(
        `/api/external/ticketing/tickets/${encodeURIComponent(createdTicketNum)}/messages?since=${encodeURIComponent(sinceIso)}`,
        {
          headers: {
            'x-api-key': currentKey,
            'x-ticket-token': createdToken,
          },
        }
      );
      const pollData = await pollRes.json();
      steps.push({
        id: 'step_5',
        name: `GET /tickets/${createdTicketNum}/messages?since=...`,
        mechanism: 'REST API',
        httpStatus: pollRes.status,
        passed: pollRes.status === 200 && Array.isArray(pollData.messages),
        summary: `Incremental poll returned ${pollData.count ?? 0} message(s) since ${sinceIso.slice(11, 19)}.`,
      });

      // 6. Test Webhook: ticket.resolved
      const whRes = await fetch('/api/webhooks/yantra/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testScenario: 'ticket.resolved',
          ticketNumber: createdTicketNum,
          customMessage: 'Order delivered and verified via E2E webhook test.',
        }),
      });
      const whResData = await whRes.json();
      steps.push({
        id: 'step_6',
        name: 'POST /api/webhooks/yantra/tickets (ticket.resolved)',
        mechanism: 'Webhook',
        httpStatus: whResData.httpStatus,
        passed: whResData.httpStatus === 200,
        summary: `Verified HMAC-SHA256 & marked ${createdTicketNum} resolved.`,
      });

      // 7. Test Customer Reply Reopening Resolved Ticket (POST /api/external/ticketing/tickets/:ticketNumber/messages)
      const replyRes = await fetch(
        `/api/external/ticketing/tickets/${encodeURIComponent(createdTicketNum)}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': currentKey,
          },
          body: JSON.stringify({
            accessToken: createdToken,
            message: 'Customer follow-up reply: reopening resolved ticket to verify agent response.',
            senderType: 'customer',
            senderName: 'Aarav Sharma',
          }),
        }
      );
      const replyData = await replyRes.json();
      steps.push({
        id: 'step_7',
        name: `POST /tickets/${createdTicketNum}/messages (Reply & Reopen)`,
        mechanism: 'REST API',
        httpStatus: replyRes.status,
        passed: replyRes.status === 201 && replyData.reopened === true,
        summary: `Reopened resolved ticket -> status "${replyData.status}" & agent replied.`,
      });

      // 8. Test Legacy Intake Endpoint (POST /api/tickets/submit)
      const legRes = await fetch('/api/tickets/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': currentKey,
        },
        body: JSON.stringify({
          customerName: 'Aarav Sharma',
          customerEmail: 'customer@foodhub.com',
          category: 'Checkout issues',
          subject: 'Legacy Endpoint Compatibility Test',
          description: 'Testing POST /api/tickets/submit intake.',
        }),
      });
      const legData = await legRes.json();
      steps.push({
        id: 'step_8',
        name: 'POST /api/tickets/submit (Legacy Intake Compatibility)',
        mechanism: 'REST API',
        httpStatus: legRes.status,
        passed: legRes.status === 201 && Boolean(legData.ticketNumber),
        summary: `Legacy intake created ${legData.ticketNumber}.`,
      });

      // 9. Test Webhook Idempotency (Duplicate X-Yantra-Delivery)
      const dupRes = await fetch('/api/webhooks/yantra/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testScenario: 'duplicate_delivery',
          ticketNumber: createdTicketNum,
        }),
      });
      const dupData = await dupRes.json();
      steps.push({
        id: 'step_9',
        name: 'Webhook Idempotency (Duplicate X-Yantra-Delivery)',
        mechanism: 'Webhook',
        httpStatus: dupData.httpStatus,
        passed: dupData.httpStatus === 200 && dupData.response?.idempotentDuplicate === true,
        summary: 'Duplicate delivery ID acknowledged with 200 OK without re-applying state.',
      });

      // 10. Test Out-of-Order Webhook Protection
      const oooRes = await fetch('/api/webhooks/yantra/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testScenario: 'out_of_order',
          ticketNumber: createdTicketNum,
        }),
      });
      const oooData = await oooRes.json();
      steps.push({
        id: 'step_10',
        name: 'Webhook Out-of-Order Timestamp Protection',
        mechanism: 'Webhook',
        httpStatus: oooData.httpStatus,
        passed: oooData.httpStatus === 200 && oooData.response?.outOfOrderIgnored === true,
        summary: 'Older event timestamp safely ignored to preserve newer ticket state.',
      });

      // 11. Test Invalid HMAC Signature Rejection (401)
      const badSigRes = await fetch('/api/webhooks/yantra/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testScenario: 'invalid_signature',
          ticketNumber: createdTicketNum,
        }),
      });
      const badSigData = await badSigRes.json();
      steps.push({
        id: 'step_11',
        name: 'Webhook Invalid HMAC-SHA256 Signature Rejection',
        mechanism: 'Webhook',
        httpStatus: badSigData.httpStatus,
        passed: badSigData.httpStatus === 401,
        summary: 'Tampered X-Yantra-Signature rejected with HTTP 401 Unauthorized.',
      });

      // Reset consecutive failures after testing invalid signature
      await fetch('/api/state', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'reset_yantra_rate_limits' }),
      });

      setE2eResults(steps);
      await onRefreshState();
      const passedCount = steps.filter((s) => s.passed).length;
      onShowToast(
        `Completed E2E Yantra Verification: ${passedCount}/${steps.length} checks passed!`,
        passedCount === steps.length ? 'success' : 'info'
      );
    } catch (err: unknown) {
      onShowToast(err instanceof Error ? err.message : 'E2E suite error', 'error');
    } finally {
      setRunningE2E(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Top Metrics */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-orange-600">
            <Webhook className="w-4 h-4" />
            <span>Yantra Ticketing Agent · Admin Control Center</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mt-1">
            Support Widget, Ticketing REST APIs & Webhooks
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Platform: <code className="font-mono text-slate-900">{yCfg.platformUrl}</code> · Active
            Key: <code className="font-mono text-slate-900">{activeApiKey.slice(0, 16)}•••</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'tickets', label: `Live Tickets (${tickets.length})` },
              { id: 'testbench', label: 'E2E API & Webhook Test Bench' },
              { id: 'webhooks', label: `Webhook Delivery Log (${webhookEvents.length})` },
              { id: 'config', label: 'Agent & Key Configuration' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pause Alert Banner if 5 consecutive webhook failures occurred */}
      {yCfg.webhookPausedUntil && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950">
              <p className="font-bold">
                Webhook Deliveries Paused (5 Consecutive Failures Circuit Breaker)
              </p>
              <p className="mt-0.5">
                Deliveries are paused until{' '}
                <span className="font-mono font-semibold">
                  {new Date(yCfg.webhookPausedUntil).toLocaleTimeString()}
                </span>
                . Per Yantra rules, sending a valid test delivery immediately ends the pause.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleRunWebhookScenario('reset_webhook_pause')}
            className="px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shrink-0 cursor-pointer"
          >
            Send Test Delivery & End Pause
          </button>
        </div>
      )}

      {/* TAB 1: LIVE TICKETS QUEUE & AGENT RESPONDER */}
      {subTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Customer Support Queue ({filteredTickets.length})
              </h2>
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_customer">Waiting on Customer</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <input
              type="text"
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              placeholder="Search ticket #, order #, subject, or customer email..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredTickets.map((tkt) => {
                const selected = activeTicket?.ticketNumber === tkt.ticketNumber;
                return (
                  <button
                    key={tkt.id}
                    onClick={() => setSelectedTicketNumber(tkt.ticketNumber)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? 'border-orange-600 bg-orange-50/40'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {tkt.ticketNumber}
                      </span>
                      <span className="font-mono text-[11px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {tkt.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 mt-1 truncate">
                      {tkt.subject}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>
                        {tkt.customerName} · {tkt.category}
                      </span>
                      <span className="font-mono tabular-nums">
                        {tkt.orderNumber ? `#${tkt.orderNumber}` : 'No Order'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            {!activeTicket ? (
              <div className="py-16 text-center text-xs text-slate-500">
                Select a ticket from the queue to inspect or respond.
              </div>
            ) : (
              <>
                <div>
                  <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-slate-900 tabular-nums">
                          {activeTicket.ticketNumber}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-800 rounded">
                          {activeTicket.status}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-mono bg-orange-50 text-orange-800 rounded">
                          Priority: {activeTicket.priority}
                        </span>
                        {activeTicket.orderNumber && (
                          <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-800 rounded">
                            Order #{activeTicket.orderNumber}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1.5">
                        {activeTicket.subject}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customer: {activeTicket.customerName} ({activeTicket.customerEmail}) · Token:{' '}
                        <code className="font-mono">{activeTicket.accessToken.slice(0, 16)}•••</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={activeTicket.status}
                        disabled={updatingTicket}
                        onChange={(e) =>
                          handleAdminTicketAction({
                            newStatus: e.target.value as SupportTicketStatus,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="waiting_on_customer">waiting_on_customer</option>
                        <option value="resolved">resolved</option>
                      </select>
                    </div>
                  </div>

                  {/* Conversation Thread (Shows both Public Messages & Admin Internal Notes) */}
                  <div className="mt-4 space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {activeTicket.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl border text-xs ${
                          msg.isInternal
                            ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                            : msg.senderType === 'customer'
                              ? 'bg-slate-50 border-slate-200 text-slate-900'
                              : 'bg-blue-50/50 border-blue-200 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            {msg.senderName}
                            {msg.isInternal && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-200 text-amber-900 rounded">
                                INTERNAL NOTE · NEVER SENT OVER WEBHOOK
                              </span>
                            )}
                          </span>
                          <span className="font-mono tabular-nums">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="leading-relaxed">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Admin Reply / Internal Note / Resolve Controls */}
                <div className="mt-5 pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600"
                      />
                      <span>
                        Post as Internal Team Note (Private — never triggers{' '}
                        <code className="font-mono">ticket.message</code> webhook)
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? 'Write an internal note for support teammates...'
                          : 'Write a public reply to customer (emits ticket.message webhook)...'
                      }
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                    />
                    <button
                      onClick={() =>
                        handleAdminTicketAction({
                          replyMessage: adminReplyText,
                          internal: isInternalNote,
                        })
                      }
                      disabled={updatingTicket || !adminReplyText.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isInternalNote ? 'Save Internal Note' : 'Send Public Reply'}</span>
                    </button>
                  </div>

                  {/* Quick Resolve Bar */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Resolution notes (emits ticket.resolved webhook)..."
                      className="flex-1 px-3 py-2 text-xs bg-emerald-50/50 border border-emerald-200 rounded-lg text-slate-900"
                    />
                    <button
                      onClick={() =>
                        handleAdminTicketAction({
                          newStatus: 'resolved',
                          resSummary:
                            resolutionSummary ||
                            'Issue resolved and verified by FoodHub Operations.',
                        })
                      }
                      disabled={updatingTicket}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: END-TO-END INTERACTIVE API & WEBHOOK TEST BENCH */}
      {subTab === 'testbench' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                End-to-End Integration Verification Suite (Widget + REST APIs + Webhooks)
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Executes live HTTP calls against every Yantra endpoint and webhook scenario to
                verify authentication, key-derived tokens, incremental polling, legacy compatibility,
                idempotency, out-of-order protection, and HMAC-SHA256 verification.
              </p>
            </div>
            <button
              onClick={handleRunFullE2ESuite}
              disabled={runningE2E}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Play className="w-4 h-4" />
              <span>
                {runningE2E ? 'Running 11-Step E2E Suite...' : 'Run All 11 E2E Checks Now'}
              </span>
            </button>
          </div>

          {e2eResults.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between text-xs font-mono">
                <span>END-TO-END VERIFICATION REPORT</span>
                <span>
                  PASSED: {e2eResults.filter((r) => r.passed).length}/{e2eResults.length}
                </span>
              </div>
              <div className="divide-y divide-slate-200">
                {e2eResults.map((step) => (
                  <div
                    key={step.id}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          step.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {step.passed ? 'PASS' : 'FAIL'} · HTTP {step.httpStatus}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                        {step.mechanism}
                      </span>
                      <span className="font-mono font-semibold text-slate-900">{step.name}</span>
                    </div>
                    <span className="text-slate-600">{step.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual Webhook & Security Scenario Simulators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Webhook Event & Security Scenario Simulators
              </h3>
              <p className="text-xs text-slate-600">
                Trigger individual signed or tampered webhook deliveries to{' '}
                <code className="font-mono">/api/webhooks/yantra/tickets</code>:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'ticket.created', label: '1. Emit ticket.created (200)' },
                  { id: 'ticket.message', label: '2. Emit ticket.message (200)' },
                  { id: 'ticket.status_changed', label: '3. Emit ticket.status_changed (200)' },
                  { id: 'ticket.resolved', label: '4. Emit ticket.resolved (200)' },
                  { id: 'duplicate_delivery', label: '5. Duplicate X-Yantra-Delivery (200)' },
                  { id: 'out_of_order', label: '6. Out-of-Order Timestamp (200)' },
                  { id: 'invalid_signature', label: '7. Tampered HMAC Signature (401)' },
                  { id: 'simulate_5_failures_pause', label: '8. Trip 5-Failure Pause (5m)' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => handleRunWebhookScenario(btn.id)}
                    className="px-3 py-2 text-left text-xs font-mono font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 cursor-pointer"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-5 font-mono text-xs overflow-x-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                <span>LIVE WEBHOOK / API RESPONSE INSPECTOR</span>
                {singleTestOutput && (
                  <button
                    onClick={() => setSingleTestOutput(null)}
                    className="text-[11px] hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap">
                {singleTestOutput ||
                  '// Click any scenario button on the left to inspect the exact HTTP headers, HMAC-SHA256 signature, and JSON response.'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WEBHOOK DELIVERY LOG (30-DAY RETENTION) */}
      {subTab === 'webhooks' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Webhook Delivery Log (30-Day Retention)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every incoming webhook is verified on its raw body with{' '}
                <code className="font-mono">X-Yantra-Signature: t=&lt;unix-seconds&gt;,v1=&lt;hex-hmac&gt;</code>
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Consecutive Failures: {yCfg.webhookConsecutiveFailures || 0}/5
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Delivery ID (X-Yantra-Delivery)</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4">HTTP</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {webhookEvents.map((wh: WebhookEventRecord) => (
                  <tr key={wh.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-900">{wh.deliveryId}</td>
                    <td className="py-2.5 px-4 text-slate-800">{wh.eventType}</td>
                    <td className="py-2.5 px-4 text-slate-900 font-bold">{wh.ticketNumber}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          wh.status === 'processed'
                            ? 'bg-emerald-50 text-emerald-800'
                            : wh.status === 'duplicate_ignored' ||
                                wh.status === 'out_of_order_ignored'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {wh.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">{wh.httpStatus}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                      {new Date(wh.processedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TICKETING AGENT & WEBHOOK CONFIGURATION (MATCHES SCREENSHOTS 1-6) */}
      {subTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Ticketing Agent Configuration
                </h2>
                <p className="text-xs text-slate-500">
                  Connect FoodHub and configure how the Yantra Ticketing Agent answers users
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600"
                />
                <span>Enable Embeddable Widget & API</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your App Domain
                </label>
                <input
                  type="text"
                  value={appDomain}
                  onChange={(e) => setAppDomain(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Platform Address
                </label>
                <input
                  type="text"
                  value={platformUrl}
                  onChange={(e) => setPlatformUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                What your app does (Agent grounding context)
              </label>
              <textarea
                rows={2}
                value={appDescription}
                onChange={(e) => setAppDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Project API Key (<code className="font-mono">x-api-key</code> /{' '}
                  <code className="font-mono">data-api-key</code>)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRotateApiKey(false)}
                    className="text-xs text-orange-600 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rotate Key</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateApiKey(true)}
                    className="text-xs text-slate-600 hover:underline font-semibold cursor-pointer"
                  >
                    Restore Default Key
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(apiKeyInput);
                    onShowToast('Copied Yantra API key', 'info');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Rotating the key stops the old one at once and invalidates every ticket{' '}
                <code className="font-mono">accessToken</code> derived from it. The webhook signing
                secret is separate and unchanged.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Webhook — Tell FoodHub What Happened
                </span>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webhookEnabled}
                    onChange={(e) => setWebhookEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600"
                  />
                  <span>Active</span>
                </label>
              </div>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="font-mono">ticket.created</strong> — A ticket was raised
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="font-mono">ticket.message</strong> — Agent/team replied (no internal notes)
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="font-mono">ticket.status_changed</strong> — Status moved
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="font-mono">ticket.resolved</strong> — Resolved with summary
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {savingConfig ? 'Saving Configuration...' : 'Save Configuration'}
            </button>
          </form>

          {/* Right Column: Support Widget Snippet & Endpoint Reference */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  Support Widget Embed Snippet
                </h3>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(widgetSnippet);
                    onShowToast('Copied widget script snippet', 'info');
                  }}
                  className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-black/50 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                {widgetSnippet}
              </pre>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5 text-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Active Ticketing REST Endpoints & Auth Contract
              </h3>
              {[
                {
                  method: 'POST',
                  path: '/api/external/ticketing/tickets',
                  auth: 'x-api-key',
                },
                {
                  method: 'GET',
                  path: '/api/external/ticketing/tickets/:ticketNumber',
                  auth: 'x-api-key + x-ticket-token',
                },
                {
                  method: 'GET',
                  path: '/api/external/ticketing/tickets/:ticketNumber/messages?since=',
                  auth: 'x-api-key + x-ticket-token',
                },
                {
                  method: 'POST',
                  path: '/api/external/ticketing/tickets/:ticketNumber/messages',
                  auth: 'x-api-key + accessToken',
                },
                {
                  method: 'GET',
                  path: '/api/external/ticketing/widget-config',
                  auth: 'x-api-key',
                },
                {
                  method: 'GET',
                  path: '/api/external/ticketing/widget.js',
                  auth: 'No key',
                },
                {
                  method: 'POST',
                  path: '/api/tickets/submit',
                  auth: 'x-api-key (Legacy)',
                },
              ].map((ep) => (
                <div
                  key={`${ep.method}_${ep.path}`}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 font-mono text-[11px]"
                >
                  <div className="truncate">
                    <span className="font-bold text-orange-600 mr-2">{ep.method}</span>
                    <span className="text-slate-800">{ep.path}</span>
                  </div>
                  <span className="text-slate-500 shrink-0">{ep.auth}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
