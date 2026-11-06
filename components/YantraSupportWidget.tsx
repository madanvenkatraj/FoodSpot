'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Send,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  FileText,
} from 'lucide-react';
import type {
  OrderRecord,
  SupportTicketCategory,
  SupportTicketReferenceRecord,
  UserRecord,
} from '@/lib/db/models';

const CATEGORIES: SupportTicketCategory[] = [
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

interface YantraSupportWidgetProps {
  currentUser: Omit<UserRecord, 'passwordHash'> | null;
  orders: OrderRecord[];
  tickets: SupportTicketReferenceRecord[];
  onRefreshState: () => Promise<void>;
  externalOpenRequest?: {
    open: boolean;
    orderNumber?: string;
    category?: SupportTicketCategory;
    subject?: string;
  } | null;
  onClearExternalRequest?: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * In-app Yantra contact desk.
 * The official support widget is loaded once from app/layout.tsx.
 * This control stays beside that launcher and never covers it.
 */
export default function YantraSupportWidget({
  currentUser,
  orders,
  tickets,
  onRefreshState,
  externalOpenRequest,
  onClearExternalRequest,
  onNotify,
  activeApiKey = 'ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E',
}: YantraSupportWidgetProps & { activeApiKey?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'tickets' | 'conversation'>('new');
  const [widgetConfig, setWidgetConfig] = useState<{
    title: string;
    welcomeMessage: string;
    primaryColor: string;
  }>({
    title: 'FoodSpot × Yantra Ticketing Agent',
    welcomeMessage:
      'Welcome to FoodSpot Support powered by Yantra Ticketing Agent. Select an issue or link an order for immediate assistance.',
    primaryColor: '#EA580C',
  });

  // Ticket creation form state
  const [category, setCategory] = useState<SupportTicketCategory>('Delayed deliveries');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [useLegacyEndpoint, setUseLegacyEndpoint] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selected ticket conversation state
  const [selectedTicketNumber, setSelectedTicketNumber] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [pollingLoading, setPollingLoading] = useState(false);

  // Load local widget copy (title, welcome text). The launcher script itself lives in the root layout.
  useEffect(() => {
    fetch('/api/external/ticketing/widget-config', {
      headers: {
        'x-api-key': activeApiKey,
      },
    })
      .then((r) => {
        if (r.status === 401) {
          setWidgetEnabled(false);
          return null;
        }
        setWidgetEnabled(true);
        return r.json();
      })
      .then((data) => {
        if (data?.widget) {
          setWidgetConfig({
            title: data.widget.title,
            welcomeMessage: data.widget.welcomeMessage,
            primaryColor: data.widget.primaryColor || '#EA580C',
          });
        }
      })
      .catch(() => {});

    const handleOpenEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        orderNumber?: string;
        category?: SupportTicketCategory;
        subject?: string;
      }>;
      setIsOpen(true);
      if (customEv.detail?.orderNumber) setOrderNumber(customEv.detail.orderNumber);
      if (customEv.detail?.category) setCategory(customEv.detail.category);
      if (customEv.detail?.subject) setSubject(customEv.detail.subject);
    };
    const handleCloseEvent = () => setIsOpen(false);

    window.addEventListener('yantra:open-widget', handleOpenEvent);
    window.addEventListener('yantra:close-widget', handleCloseEvent);
    return () => {
      window.removeEventListener('yantra:open-widget', handleOpenEvent);
      window.removeEventListener('yantra:close-widget', handleCloseEvent);
    };
  }, [activeApiKey]);

  // Handle external open requests (e.g., "Report Issue" button on an order card)
  useEffect(() => {
    if (!externalOpenRequest?.open) return;
    const raf = window.requestAnimationFrame(() => {
      setIsOpen(true);
      setActiveTab('new');
      if (externalOpenRequest.orderNumber) {
        setOrderNumber(externalOpenRequest.orderNumber);
      }
      if (externalOpenRequest.category) {
        setCategory(externalOpenRequest.category);
      }
      if (externalOpenRequest.subject) {
        setSubject(externalOpenRequest.subject);
      }
      onClearExternalRequest?.();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [externalOpenRequest, onClearExternalRequest]);

  const activeTicket =
    tickets.find((t) => t.ticketNumber === selectedTicketNumber) || tickets[0] || null;

  const getStoredTicketToken = (tkt: SupportTicketReferenceRecord): string => {
    try {
      const fromLocal = localStorage.getItem(`yantra_token_${tkt.ticketNumber}`);
      if (fromLocal) return fromLocal;
      const fromSession = sessionStorage.getItem(`yantra_token_${tkt.ticketNumber}`);
      if (fromSession) return fromSession;
    } catch {}
    return tkt.accessToken;
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      onNotify('Please provide both a subject and detailed description.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = useLegacyEndpoint
        ? '/api/tickets/submit'
        : '/api/external/ticketing/tickets';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey,
        },
        body: JSON.stringify({
          customerId: currentUser?.id || 'usr_customer_1',
          customerName: currentUser?.name || 'Aarav Sharma',
          customerEmail: currentUser?.email || 'customer@foodspot.app',
          customerPhone: currentUser?.phone || '+1 (415) 890-2311',
          orderNumber: orderNumber || null,
          category,
          priority,
          subject: subject.trim(),
          description: description.trim(),
          attachments: attachmentNote.trim() ? [attachmentNote.trim()] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit support ticket');
      }

      if (data.ticketNumber && data.accessToken) {
        try {
          localStorage.setItem(`yantra_token_${data.ticketNumber}`, data.accessToken);
          sessionStorage.setItem(`yantra_token_${data.ticketNumber}`, data.accessToken);
        } catch {}
      }

      await onRefreshState();
      setSelectedTicketNumber(data.ticketNumber);
      setSubject('');
      setDescription('');
      setAttachmentNote('');
      setActiveTab('conversation');
      onNotify(
        `Ticket ${data.ticketNumber} created & routed to ${data.assignedAgent || 'Yantra Agent'}!`,
        'success'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ticket creation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePollIncrementalMessages = async () => {
    if (!activeTicket) return;
    setPollingLoading(true);
    try {
      const publicMsgs = activeTicket.messages.filter((m) => !m.isInternal);
      const lastMsg = publicMsgs[publicMsgs.length - 1];
      const sinceParam = lastMsg ? `?since=${encodeURIComponent(lastMsg.createdAt)}` : '';
      const tokenToUse = getStoredTicketToken(activeTicket);
      const res = await fetch(
        `/api/external/ticketing/tickets/${activeTicket.ticketNumber}/messages${sinceParam}`,
        {
          headers: {
            'x-api-key': activeApiKey,
            'x-ticket-token': tokenToUse,
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Polling failed (${res.status})`);
      }
      await onRefreshState();
      onNotify(
        `Polled ${activeTicket.ticketNumber}: ${data.count ?? 0} new message(s) since last check`,
        'info'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed to poll messages', 'error');
    } finally {
      setPollingLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent, reopenTicket = false) => {
    e.preventDefault();
    if (!activeTicket) return;
    const messageToSend =
      replyText.trim() ||
      (reopenTicket ? 'Reopening ticket: I need additional assistance with this issue.' : '');
    if (!messageToSend) return;

    setSendingReply(true);
    try {
      const tokenToUse = getStoredTicketToken(activeTicket);
      const res = await fetch(
        `/api/external/ticketing/tickets/${activeTicket.ticketNumber}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': activeApiKey,
          },
          body: JSON.stringify({
            accessToken: tokenToUse,
            message: messageToSend,
            senderType: 'customer',
            senderName: currentUser?.name || activeTicket.customerName,
            reopen: reopenTicket,
            autoAgentResponse: true,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reply');
      }
      setReplyText('');
      await onRefreshState();
      onNotify(
        data.reopened
          ? `Ticket ${activeTicket.ticketNumber} reopened and reply delivered.`
          : `Reply sent on ${activeTicket.ticketNumber}.`,
        'success'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  if (!isOpen) {
    if (!widgetEnabled) return null;
    const openCount = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;
    return (
      <div className="yantra-contact-support fixed z-[100000] bottom-[152px] right-5 md:bottom-5 md:right-[92px]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex h-14 max-w-[calc(100vw-6.5rem)] items-center gap-2.5 rounded-full border border-stone-200 bg-white pl-2 pr-4 text-sm font-semibold text-stone-900 shadow-xl transition hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98] cursor-pointer"
          aria-label="Yantra contact support"
          title="Yantra contact support"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white">
            <FileText className="h-4 w-4" />
          </span>
          <span className="truncate">Yantra contact support</span>
          {openCount > 0 && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{widgetConfig.title}</h3>
            <p className="text-xs text-stone-300 mt-0.5">
              Yantra Ticketing Agent · Widget + REST API + Webhooks
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-stone-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Close Order Ticket Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Navigation */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-stone-100 border-b border-stone-200">
          <button
            onClick={() => setActiveTab('new')}
            className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'new'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Raise Ticket
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'tickets'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            My Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab('conversation')}
            className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'conversation'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Conversation
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'new' && (
            <form onSubmit={handleCreateTicket} className="space-y-3.5">
              <p className="text-xs text-stone-600 leading-relaxed">
                {widgetConfig.welcomeMessage}
              </p>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Issue Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-orange-600"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Associated Order Reference (Optional)
                </label>
                <select
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-orange-600 font-mono"
                >
                  <option value="">No specific order linked</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.orderNumber}>
                      {ord.orderNumber} · {ord.restaurantName} · ${ord.totalAmount.toFixed(2)} (
                      {ord.status.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Missing item or delayed delivery for my order"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened so Yantra Ticketing Agent can investigate..."
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Evidence / Attachment Note (Optional)
                </label>
                <input
                  type="text"
                  value={attachmentNote}
                  onChange={(e) => setAttachmentNote(e.target.value)}
                  placeholder="e.g., photo_receipt_fh1001.jpg or packaging seal note"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-orange-600"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLegacyEndpoint}
                  onChange={(e) => setUseLegacyEndpoint(e.target.checked)}
                  className="rounded border-stone-300 text-orange-600 focus:ring-orange-600"
                />
                <span>Use legacy compatibility endpoint (POST /api/tickets/submit)</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Submitting to Yantra Ticketing Agent...'
                  : 'Submit Support Ticket'}
              </button>
            </form>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-2.5">
              {tickets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-7 h-7 text-stone-400 mx-auto mb-2" />
                  <p className="text-xs text-stone-600">No support tickets raised yet.</p>
                </div>
              ) : (
                tickets.map((tkt) => (
                  <button
                    key={tkt.id}
                    onClick={() => {
                      setSelectedTicketNumber(tkt.ticketNumber);
                      setActiveTab('conversation');
                    }}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-orange-600 transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-stone-900 tabular-nums">
                        {tkt.ticketNumber}
                      </span>
                      <span className="text-stone-500 capitalize">
                        {tkt.status.replace(/_/g, ' ')} · {tkt.priority}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-stone-900 truncate">{tkt.subject}</p>
                    <p className="text-[11px] text-stone-500">
                      {tkt.category}
                      {tkt.orderNumber ? ` · Order #${tkt.orderNumber}` : ''} ·{' '}
                      {tkt.messages.length} msgs
                    </p>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'conversation' && (
            <div className="space-y-3">
              {!activeTicket ? (
                <p className="text-xs text-stone-500 text-center py-6">
                  Select or create a ticket to view the conversation.
                </p>
              ) : (
                <>
                  <div className="pb-2.5 border-b border-stone-200 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono tabular-nums">
                        <span className="font-semibold text-stone-900">
                          {activeTicket.ticketNumber}
                        </span>
                        <span>·</span>
                        <span className="capitalize">
                          {activeTicket.status.replace(/_/g, ' ')}
                        </span>
                        {activeTicket.orderNumber && (
                          <>
                            <span>·</span>
                            <span>#{activeTicket.orderNumber}</span>
                          </>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-stone-900 mt-0.5">
                        {activeTicket.subject}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Assigned: {activeTicket.assignedAgent}
                      </p>
                    </div>
                    <button
                      onClick={handlePollIncrementalMessages}
                      disabled={pollingLoading}
                      title="Poll incremental messages (GET /messages?since=...)"
                      className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${pollingLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>

                  {activeTicket.status === 'resolved' && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          Resolved: {activeTicket.resolutionSummary || 'Issue resolved'}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleSendReply(e, true)}
                        className="px-2 py-1 bg-white border border-emerald-300 rounded text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reopen
                      </button>
                    </div>
                  )}

                  {/* Messages list */}
                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                    {activeTicket.messages.map((msg) => {
                      const isCustomer = msg.senderType === 'customer';
                      return (
                        <div
                          key={msg.id}
                          className={`p-2.5 rounded-xl text-xs ${
                            isCustomer
                              ? 'bg-orange-50 border border-orange-200 text-stone-900 ml-4'
                              : 'bg-stone-100 border border-stone-200 text-stone-900 mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                            <span className="font-semibold text-stone-800">
                              {msg.senderName}
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
                      );
                    })}
                  </div>

                  {/* Customer Reply Input */}
                  <form onSubmit={(e) => handleSendReply(e, false)} className="pt-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={
                          activeTicket.status === 'resolved'
                            ? 'Reply to reopen this ticket...'
                            : 'Write a reply to Yantra Agent...'
                        }
                        className="flex-1 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-orange-600"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !replyText.trim()}
                        className="px-3 py-2 bg-stone-900 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-400 font-mono truncate">
                      Token: {activeTicket.accessToken.slice(0, 18)}••• (Authorized)
                    </p>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
