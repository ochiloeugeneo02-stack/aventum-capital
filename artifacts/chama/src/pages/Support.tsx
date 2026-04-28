import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Plus, ChevronLeft, Send, Loader2, Clock, CheckCircle2,
  X, AlertTriangle, LogOut, Trash2, HelpCircle, RefreshCw,
} from "lucide-react";

interface DeleteRequest {
  id: number;
  groupId: number;
  groupName: string | null;
  reason: string;
  status: string;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

interface Ticket {
  id: number;
  category: string;
  subject: string;
  status: string;
  priority: string;
  groupId: number | null;
  groupName: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  unreadAdmin: number;
}

interface Message {
  id: number;
  message: string;
  isAdmin: boolean;
  readAt: string | null;
  createdAt: string;
  senderName: string | null;
}

interface TicketDetail extends Ticket {
  messages: Message[];
}

const CATEGORY_OPTIONS = [
  { value: "general", label: "General question", icon: HelpCircle, color: "text-blue-600 bg-blue-50" },
  { value: "exit_request", label: "Request to leave a group", icon: LogOut, color: "text-amber-600 bg-amber-50" },
  { value: "group_deletion", label: "Close / delete a group", icon: Trash2, color: "text-red-600 bg-red-50" },
  { value: "payment", label: "Payment issue", icon: AlertTriangle, color: "text-orange-600 bg-orange-50" },
  { value: "other", label: "Something else", icon: MessageCircle, color: "text-gray-600 bg-gray-50" },
];

function categoryMeta(cat: string) {
  return CATEGORY_OPTIONS.find(c => c.value === cat) ?? CATEGORY_OPTIONS[0];
}

function statusColor(s: string) {
  if (s === "open") return "bg-blue-50 text-blue-700 border border-blue-200";
  if (s === "in_progress") return "bg-amber-50 text-amber-700 border border-amber-200";
  if (s === "resolved") return "bg-green-50 text-green-700 border border-green-200";
  if (s === "closed") return "bg-gray-100 text-gray-500 border border-gray-200";
  return "bg-gray-100 text-gray-500 border border-gray-200";
}

function statusLabel(s: string) {
  if (s === "in_progress") return "In progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function Support() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);

  const [newCategory, setNewCategory] = useState("general");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await apiRequest<Ticket[]>("/api/support/tickets"));
    } catch {}
    setLoading(false);
  }, []);

  const openTicket = useCallback(async (id: number) => {
    setTicketLoading(true);
    setActiveTicket(null);
    try {
      const data = await apiRequest<TicketDetail>(`/api/support/tickets/${id}`);
      setActiveTicket(data);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, unreadAdmin: 0 } : t));
    } catch {}
    setTicketLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();
    apiRequest<DeleteRequest[]>("/api/groups/delete-requests/mine")
      .then(setDeleteRequests)
      .catch(() => {});
  }, [loadTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTicket?.messages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ category: newCategory, subject: newSubject.trim(), message: newMessage.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: "Ticket opened!", description: "We'll get back to you shortly." });
      setShowNew(false);
      setNewCategory("general");
      setNewSubject("");
      setNewMessage("");
      await loadTickets();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not create ticket", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSending(true);
    try {
      await apiRequest(`/api/support/tickets/${activeTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setReply("");
      await openTicket(activeTicket.id);
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openTickets = tickets.filter(t => t.status !== "closed");
  const closedTickets = tickets.filter(t => t.status === "closed");
  const totalUnread = tickets.reduce((s, t) => s + (t.unreadAdmin ?? 0), 0);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <BackButton />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Support</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Get help from the Aventum Capital team
              {totalUnread > 0 && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{totalUnread} new {totalUnread === 1 ? "reply" : "replies"}</span>}
            </p>
          </div>
          {!showNew && !activeTicket && (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-[#3A5A40] hover:bg-[#344E41] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New ticket
            </button>
          )}
        </div>

        {/* ── Group closure requests ────────────────────────────── */}
        {deleteRequests.length > 0 && !activeTicket && (
          <div className="bg-card border border-red-200/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-red-100 flex items-center gap-2.5 bg-red-50/40">
              <Trash2 className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold text-sm">Group closure requests</h3>
              <span className="ml-auto text-xs text-muted-foreground">{deleteRequests.length} request{deleteRequests.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-border">
              {deleteRequests.map(dr => {
                const statusMap: Record<string, { label: string; cls: string }> = {
                  pending:  { label: "Under review",  cls: "bg-amber-50 text-amber-700 border border-amber-200" },
                  approved: { label: "Approved",       cls: "bg-green-50 text-green-700 border border-green-200" },
                  rejected: { label: "Rejected",       cls: "bg-red-50 text-red-700 border border-red-200" },
                };
                const s = statusMap[dr.status] ?? { label: dr.status, cls: "bg-muted text-muted-foreground border border-border" };
                return (
                  <div key={dr.id} className="px-5 py-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{dr.groupName ?? `Group #${dr.groupId}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{dr.reason}"</p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
                    </div>
                    {dr.reviewNote && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                        <span className="font-medium">Aventum note:</span> {dr.reviewNote}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Submitted {formatTime(dr.requestedAt)}
                      {dr.reviewedAt && ` · Reviewed ${formatTime(dr.reviewedAt)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── New ticket form ───────────────────────────────────── */}
        {showNew && !activeTicket && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold">Open a support ticket</h3>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="text-sm font-medium block mb-2">What can we help you with?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewCategory(opt.value)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 text-left text-sm font-medium transition-all",
                          newCategory === opt.value ? "border-[#3A5A40] bg-[#F0F5F1]" : "border-border hover:border-[#3A5A40]/40"
                        )}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${opt.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Subject</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-input rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20"
                  placeholder="Brief summary of your issue…"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Message</label>
                <textarea
                  className="w-full px-3 py-2.5 border border-input rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20 resize-none"
                  rows={4}
                  placeholder="Describe your issue in detail…"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newSubject.trim() || !newMessage.trim()}
                  className="flex items-center gap-2 bg-[#3A5A40] hover:bg-[#344E41] disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Open ticket
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Ticket detail (chat view) ─────────────────────────── */}
        {activeTicket && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: "520px" }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-start gap-3">
              <button onClick={() => setActiveTicket(null)} className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm truncate">{activeTicket.subject}</h3>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", statusColor(activeTicket.status))}>
                    {statusLabel(activeTicket.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {(() => {
                    const m = categoryMeta(activeTicket.category);
                    const Icon = m.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.color}`}>
                        <Icon className="w-3 h-3" /> {m.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground">Opened {formatTime(activeTicket.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#FAFAFA]">
              {activeTicket.messages.map(msg => (
                <div key={msg.id} className={cn("flex gap-3", msg.isAdmin ? "justify-start" : "justify-end")}>
                  {msg.isAdmin && (
                    <div className="w-8 h-8 rounded-full bg-[#3A5A40] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">A</div>
                  )}
                  <div className={cn("max-w-[78%] space-y-1", msg.isAdmin ? "" : "items-end flex flex-col")}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.isAdmin
                        ? "bg-white border border-border rounded-tl-sm text-foreground"
                        : "bg-[#3A5A40] text-white rounded-tr-sm"
                    )}>
                      {msg.message}
                    </div>
                    <span className="text-[11px] text-muted-foreground px-1">
                      {msg.isAdmin ? "Aventum Capital" : (user?.name ?? "You")} · {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  {!msg.isAdmin && (
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5">
                      {user?.name?.charAt(0) ?? "Y"}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            {activeTicket.status !== "closed" ? (
              <div className="px-4 py-4 border-t border-border bg-background">
                <div className="flex gap-2 items-end">
                  <textarea
                    className="flex-1 px-3 py-2.5 border border-input rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20 resize-none min-h-[42px] max-h-28"
                    rows={1}
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim()}
                    className="w-10 h-10 rounded-xl bg-[#3A5A40] hover:bg-[#344E41] disabled:opacity-50 flex items-center justify-center shrink-0 text-white transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 border-t border-border bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">This ticket has been closed. <button className="text-[#3A5A40] font-medium hover:underline" onClick={() => setShowNew(true)}>Open a new ticket</button> if you need further help.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Ticket list ───────────────────────────────────────── */}
        {!showNew && !activeTicket && (
          <div className="space-y-5">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
            ) : tickets.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-semibold text-[#1F2937]">No support tickets yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Need help? Open a ticket and our team will get back to you quickly.</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="mt-5 inline-flex items-center gap-2 bg-[#3A5A40] hover:bg-[#344E41] text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Open your first ticket
                </button>
              </div>
            ) : (
              <>
                {openTickets.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Open tickets</h3>
                    <div className="space-y-2">
                      {openTickets.map(ticket => {
                        const meta = categoryMeta(ticket.category);
                        const Icon = meta.icon;
                        return (
                          <button
                            key={ticket.id}
                            onClick={() => openTicket(ticket.id)}
                            className="w-full bg-card border border-border hover:border-[#3A5A40]/40 rounded-2xl p-4 flex items-start gap-4 text-left transition-all hover:shadow-sm group"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-medium text-sm truncate">{ticket.subject}</span>
                                {ticket.unreadAdmin > 0 && (
                                  <span className="shrink-0 text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{ticket.unreadAdmin} new</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={cn("px-1.5 py-0.5 rounded-full font-medium", statusColor(ticket.status))}>{statusLabel(ticket.status)}</span>
                                <span>·</span>
                                <span>{formatTime(ticket.updatedAt)}</span>
                                {ticket.groupName && <><span>·</span><span className="truncate">{ticket.groupName}</span></>}
                              </div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {closedTickets.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Closed tickets</h3>
                    <div className="space-y-2">
                      {closedTickets.map(ticket => {
                        const meta = categoryMeta(ticket.category);
                        const Icon = meta.icon;
                        return (
                          <button
                            key={ticket.id}
                            onClick={() => openTicket(ticket.id)}
                            className="w-full bg-muted/30 border border-border rounded-2xl p-4 flex items-start gap-4 text-left transition-all hover:bg-card group opacity-70 hover:opacity-100"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 opacity-60 ${meta.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{ticket.subject}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 border border-gray-200">Closed</span>
                                <span>·</span>
                                <span>{formatTime(ticket.closedAt ?? ticket.updatedAt)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
