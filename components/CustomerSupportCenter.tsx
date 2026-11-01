'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  HelpCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type {
  OrderRecord,
  SupportTicketCategory,
  SupportTicketReferenceRecord,
} from '@/lib/db/models';
import type { SafeUser } from '@/components/WorkspaceContext';

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

interface CustomerSupportCenterProps {
  currentUser: SafeUser | null;
  orders: OrderRecord[];
  tickets: SupportTicketReferenceRecord[];
  activeApiKey: string;
  onRefreshState: () => Promise<void>;
  onOpenFloatingWidget: (orderNumber?: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CustomerSupportCenter({
  currentUser,
  orders,
  tickets,
  activeApiKey,
  onRefreshState,
  onOpenFloatingWidget,
  onNotify,
}: CustomerSupportCenterProps) {
  const [category, setCategory] = useState<SupportTicketCategory>('Delayed deliveries');
  const [orderNumber, setOrderNumber] = useState<string>(orders[0]?.orderNumber || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [useLegacyIntake, setUseLegacyIntake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedTicketNumber, setSelectedTicketNumber] = useState<string | null>(
    tickets[0]?.ticketNumber || null
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastPollStats, setLastPollStats] = useState<{
    since: string | null;
    newCount: number;
    checkedAt: string;
  } | null>(null);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const activeTicket = useMemo(() => {
    return (
      tickets.find((t) => t.ticketNumber === selectedTicketNumber) ||
      filteredTickets[0] ||
      tickets[0] ||
      null
    );
  }, [tickets, filteredTickets, selectedTicketNumber]);

  const getTicketToken = (tkt: SupportTicketReferenceRecord): string => {
    try {
      const local = localStorage.getItem(`yantra_token_${tkt.ticketNumber}`);
      if (local) return local;
      const session = sessionStorage.getItem(`yantra_token_${tkt.ticketNumber}`);
      if (session) return session;
    } catch {}
    return tkt.accessToken;
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      onNotify('Please enter both a subject and description.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = useLegacyIntake
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
          customerEmail: currentUser?.email || 'customer@foodhub.com',
          customerPhone: currentUser?.phone || '+1 (415) 890-2311',
          orderNumber: orderNumber || null,
          category,
          priority,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed with status ${res.status}`);
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
      onNotify(
        `Ticket ${data.ticketNumber} raised via ${endpoint} (${data.upstreamStatus === 'synced_live' ? 'Synced Live' : 'Local Agent Triage'})`,
        'success'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFetchTicketDetail = async (tkt: SupportTicketReferenceRecord) => {
    setPolling(true);
    try {
      const token = getTicketToken(tkt);
      const res = await fetch(`/api/external/ticketing/tickets/${tkt.ticketNumber}`, {
        headers: {
          'x-api-key': activeApiKey,
          'x-ticket-token': token,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Ticket read failed (${res.status})`);
      }
      await onRefreshState();
      onNotify(
        `Verified GET /tickets/${tkt.ticketNumber} (${data.messages?.length || 0} public messages)`,
        'info'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed to read ticket', 'error');
    } finally {
      setPolling(false);
    }
  };

  const handlePollIncremental = async () => {
    if (!activeTicket) return;
    setPolling(true);
    try {
      const publicMsgs = activeTicket.messages.filter((m) => !m.isInternal);
      const lastMsg = publicMsgs[publicMsgs.length - 1];
      const sinceIso = lastMsg ? lastMsg.createdAt : '';
      const query = sinceIso ? `?since=${encodeURIComponent(sinceIso)}` : '';
      const token = getTicketToken(activeTicket);

      const res = await fetch(
        `/api/external/ticketing/tickets/${activeTicket.ticketNumber}/messages${query}`,
        {
          headers: {
            'x-api-key': activeApiKey,
            'x-ticket-token': token,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Incremental poll failed (${res.status})`);
      }

      setLastPollStats({
        since: sinceIso || null,
        newCount: data.count ?? 0,
        checkedAt: new Date().toLocaleTimeString(),
      });
      await onRefreshState();
      onNotify(
        `Polled GET /messages?since=... -> ${data.count ?? 0} new message(s)`,
        'info'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Polling failed', 'error');
    } finally {
      setPolling(false);
    }
  };

  const handleSendCustomerReply = async (e: React.FormEvent, reopen = false) => {
    e.preventDefault();
    if (!activeTicket) return;
    const text =
      replyText.trim() ||
      (reopen
        ? 'Reopening resolved ticket: I still need help with this order issue.'
        : '');
    if (!text) return;

    setSendingReply(true);
    try {
      const token = getTicketToken(activeTicket);
      const res = await fetch(
        `/api/external/ticketing/tickets/${activeTicket.ticketNumber}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': activeApiKey,
          },
          body: JSON.stringify({
            accessToken: token,
            message: text,
            senderType: 'customer',
            senderName: currentUser?.name || activeTicket.customerName,
            reopen,
            autoAgentResponse: true,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Reply failed (${res.status})`);
      }

      setReplyText('');
      await onRefreshState();
      onNotify(
        data.reopened
          ? `Ticket ${activeTicket.ticketNumber} reopened to in_progress & Yantra Agent replied!`
          : `Reply delivered on ${activeTicket.ticketNumber} & Yantra Agent responded.`,
        'success'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed to post reply', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'waiting_on_customer':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600">
            <Sparkles className="w-4 h-4" />
            <span>Yantra Ticketing Agent · Customer Support Center</span>
          </div>
          <h1 className="text-2xl font-extrabold text-stone-900 mt-1">
            Order & Account Support Desk
          </h1>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Raise support tickets linked to your FoodSpot orders, track real-time Yantra AI Agent
            responses, poll incremental conversation updates, or reopen resolved tickets anytime.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => onOpenFloatingWidget(orderNumber || undefined)}
            className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-orange-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Open Floating Support Widget</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Raise a Ticket + My Tickets List */}
        <div className="lg:col-span-5 space-y-6">
          {/* Raise Ticket Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-600" />
                <span>Raise a Support Ticket</span>
              </h2>
              <span className="text-[11px] font-mono text-stone-500">x-api-key auth</span>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Issue Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-orange-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                    }
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-orange-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Link FoodSpot Order (Optional)
                </label>
                <select
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:outline-none focus:border-orange-600"
                >
                  <option value="">General Account / App Inquiry (No Order Linked)</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.orderNumber}>
                      {ord.orderNumber} · {ord.restaurantName} · ${ord.totalAmount.toFixed(2)} (
                      {ord.status.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Missing garlic dip or live delivery ETA inquiry"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details so the Yantra Ticketing Agent can inspect your order and respond..."
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-orange-600"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLegacyIntake}
                  onChange={(e) => setUseLegacyIntake(e.target.checked)}
                  className="rounded border-stone-300 text-orange-600 focus:ring-orange-600"
                />
                <span>
                  Submit via legacy compatibility intake (<code className="font-mono">POST /api/tickets/submit</code>)
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {submitting ? 'Routing to Yantra Ticketing Agent...' : 'Submit Ticket to Yantra Agent'}
              </button>
            </form>
          </div>

          {/* My Tickets List */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-bold text-stone-900">
                My Support Tickets ({filteredTickets.length})
              </h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_customer">Waiting on Customer</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-xs text-stone-500">
                  <FileText className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                  No tickets match the selected filter.
                </div>
              ) : (
                filteredTickets.map((tkt) => {
                  const isSelected = activeTicket?.ticketNumber === tkt.ticketNumber;
                  return (
                    <button
                      key={tkt.id}
                      onClick={() => setSelectedTicketNumber(tkt.ticketNumber)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-orange-600 bg-orange-50/40'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-stone-900 tabular-nums">
                          {tkt.ticketNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded border capitalize ${statusBadgeClass(
                            tkt.status
                          )}`}
                        >
                          {tkt.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-stone-900 mt-1 truncate">
                        {tkt.subject}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1.5">
                        <span>
                          {tkt.category}
                          {tkt.orderNumber ? ` · #${tkt.orderNumber}` : ''}
                        </span>
                        <span className="font-mono tabular-nums">
                          {tkt.messages.filter((m) => !m.isInternal).length} msgs
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Conversation & API Token Inspector */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 h-full flex flex-col justify-between">
            {!activeTicket ? (
              <div className="py-20 text-center space-y-2">
                <MessageSquare className="w-10 h-10 text-stone-300 mx-auto" />
                <h3 className="text-sm font-bold text-stone-900">No Ticket Selected</h3>
                <p className="text-xs text-stone-500">
                  Raise a support ticket on the left to start a conversation with the Yantra
                  Ticketing Agent.
                </p>
              </div>
            ) : (
              <>
                <div>
                  {/* Conversation Header */}
                  <div className="pb-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-stone-900 tabular-nums">
                          {activeTicket.ticketNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded border capitalize ${statusBadgeClass(
                            activeTicket.status
                          )}`}
                        >
                          {activeTicket.status.replace(/_/g, ' ')}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-mono bg-stone-100 text-stone-700 rounded">
                          Priority: {activeTicket.priority}
                        </span>
                        {activeTicket.orderNumber && (
                          <span className="px-2 py-0.5 text-xs font-mono bg-orange-50 text-orange-800 border border-orange-200 rounded">
                            Order #{activeTicket.orderNumber}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-stone-900 mt-1.5">
                        {activeTicket.subject}
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Assigned Agent: <strong className="text-stone-700">{activeTicket.assignedAgent}</strong> · Department: {activeTicket.routingDepartment}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleFetchTicketDetail(activeTicket)}
                        disabled={polling}
                        className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg cursor-pointer flex items-center gap-1.5"
                        title="GET /api/external/ticketing/tickets/:ticketNumber"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>GET Status</span>
                      </button>
                      <button
                        onClick={handlePollIncremental}
                        disabled={polling}
                        className="px-3 py-1.5 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg cursor-pointer flex items-center gap-1.5"
                        title="GET /api/external/ticketing/tickets/:ticketNumber/messages?since=..."
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${polling ? 'animate-spin' : ''}`} />
                        <span>Poll ?since=</span>
                      </button>
                    </div>
                  </div>

                  {/* Token & Incremental Polling Metadata Bar */}
                  <div className="mt-3 p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-stone-600">Ticket Access Token:</span>
                      <code className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-800">
                        {getTicketToken(activeTicket).slice(0, 22)}•••
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(getTicketToken(activeTicket));
                          onNotify('Copied ticket accessToken to clipboard', 'info');
                        }}
                        className="text-stone-500 hover:text-stone-900 cursor-pointer"
                        title="Copy full accessToken"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {lastPollStats && (
                      <span className="text-[11px] font-mono text-stone-500 tabular-nums">
                        Last poll ({lastPollStats.checkedAt}): +{lastPollStats.newCount} new
                      </span>
                    )}
                  </div>

                  {/* Resolution Banner */}
                  {activeTicket.status === 'resolved' && (
                    <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-950">
                          <span className="font-bold">Ticket Resolved: </span>
                          <span>
                            {activeTicket.resolutionSummary ||
                              'Resolved by Yantra Ticketing Agent.'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleSendCustomerReply(e, true)}
                        disabled={sendingReply}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen Ticket</span>
                      </button>
                    </div>
                  )}

                  {/* Public Conversation Messages */}
                  <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {activeTicket.messages
                      .filter((m) => !m.isInternal)
                      .map((msg) => {
                        const isCustomer = msg.senderType === 'customer';
                        const isSystem = msg.senderType === 'system';
                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-xl border text-xs ${
                              isSystem
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                : isCustomer
                                  ? 'bg-orange-50/70 border-orange-200 text-stone-900 ml-6'
                                  : 'bg-stone-50 border-stone-200 text-stone-900 mr-6'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                              <span className="font-bold text-stone-800">{msg.senderName}</span>
                              <span className="font-mono tabular-nums flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(msg.createdAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Reply Composer */}
                <form
                  onSubmit={(e) => handleSendCustomerReply(e, false)}
                  className="mt-5 pt-4 border-t border-stone-200 space-y-2"
                >
                  <label className="block text-xs font-semibold text-stone-700">
                    {activeTicket.status === 'resolved'
                      ? 'Write a reply to reopen this resolved ticket (POST /tickets/:ticketNumber/messages)'
                      : 'Reply to Yantra Ticketing Agent (POST /tickets/:ticketNumber/messages)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        activeTicket.status === 'resolved'
                          ? 'Type a follow-up message to reopen this ticket...'
                          : 'Write your message to Yantra Support...'
                      }
                      className="flex-1 px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-orange-600"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 py-2.5 bg-stone-900 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{activeTicket.status === 'resolved' ? 'Reply & Reopen' : 'Send'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
