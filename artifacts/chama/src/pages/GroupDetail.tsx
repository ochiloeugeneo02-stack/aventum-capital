import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetGroup,
  usePayContribution,
  getGetGroupQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BackButton } from "@/components/BackButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegion } from "@/contexts/RegionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  Loader2, Users, LogOut, AlertTriangle, CheckCircle2, Clock,
  MessageCircle, Send, ArrowLeftRight, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EXIT_TERMS = [
  "I understand I must continue contributing for the full current savings cycle before my exit can be processed.",
  "I acknowledge that leaving mid-cycle may disrupt other members' payouts and that my exit is subject to admin review.",
  "I confirm that once approved, my rotation slot and any future payout eligibility in this group will be forfeited.",
  "If I have already received my rotation payout, my exit may be automatically approved once the current cycle completes.",
  "Aventum Capital reserves the right to deny my exit request if it would negatively impact the group's operations.",
];

type ExitRequestStatus = "none" | "pending" | "approved" | "denied" | "auto_approved";

interface MyExitRequest {
  id: number;
  status: ExitRequestStatus;
  reviewNote: string | null;
  autoApproveAfterCycle: number | null;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  userId: number;
  userName: string | null;
  content: string;
  createdAt: string;
}

interface SwapRequest {
  id: number;
  status: string;
  targetMemberId: number;
  reason: string | null;
  createdAt: string;
}

export default function GroupDetail() {
  const { formatGroupAmount, formatDate } = useRegion();
  const [, params] = useRoute("/groups/:id");
  const groupId = parseInt(params?.id ?? "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Exit request state
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [submittingExit, setSubmittingExit] = useState(false);
  const [cancellingExit, setCancellingExit] = useState(false);
  const [myExitRequest, setMyExitRequest] = useState<MyExitRequest | null>(null);
  const [exitRequestLoaded, setExitRequestLoaded] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Turn swap state
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetId, setSwapTargetId] = useState<number | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [mySwapRequest, setMySwapRequest] = useState<SwapRequest | null>(null);
  const [cancellingSwap, setCancellingSwap] = useState(false);

  const { data: group, isLoading } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId },
  });

  const payMutation = usePayContribution({
    mutation: {
      onSuccess: () => {
        toast({ title: "Contribution paid!", description: "Your payment has been recorded." });
        queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: (e: any) => {
        toast({ title: "Payment failed", description: e?.response?.data?.error ?? "Could not process payment", variant: "destructive" });
      },
    },
  });

  // Load exit request
  useEffect(() => {
    if (!groupId || !user) return;
    (async () => {
      try {
        const requests = await apiRequest<MyExitRequest[]>("/api/exit-requests/mine");
        const mine = requests.find(r => (r as any).groupId === groupId) ?? null;
        setMyExitRequest(mine as any);
      } catch {}
      setExitRequestLoaded(true);
    })();
  }, [groupId, user]);

  // Load my swap request
  useEffect(() => {
    if (!groupId || !user) return;
    (async () => {
      try {
        const reqs = await apiRequest<SwapRequest[]>(`/api/groups/${groupId}/swap-requests/my`);
        const pending = reqs.find(r => r.status === "pending") ?? null;
        setMySwapRequest(pending);
      } catch {}
    })();
  }, [groupId, user]);

  // Fetch chat messages — only update state when something actually changed
  const fetchMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      const msgs = await apiRequest<ChatMessage[]>(`/api/groups/${groupId}/messages?limit=100`);
      setMessages(prev => {
        if (
          prev.length === msgs.length &&
          (prev.length === 0 || prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id)
        ) {
          return prev; // no change — preserve reference so auto-scroll doesn't fire
        }
        return msgs;
      });
    } catch {}
    setChatLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchMessages();
    chatPollingRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (chatPollingRef.current) clearInterval(chatPollingRef.current);
    };
  }, [fetchMessages]);

  // Track last message ID to only scroll when genuinely new messages arrive
  const lastScrolledIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.id;
    if (lastId !== lastScrolledIdRef.current) {
      lastScrolledIdRef.current = lastId ?? null;
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      const msg = await apiRequest<ChatMessage>(`/api/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: newMessage.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setMessages(prev => [...prev, msg]);
      setNewMessage("");
    } catch (err: any) {
      toast({ title: "Could not send message", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCancelExit = async () => {
    setCancellingExit(true);
    try {
      const result = await apiRequest<{ message: string }>(`/api/groups/${groupId}/exit-request/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setMyExitRequest(null);
      toast({ title: "Request cancelled", description: result.message });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not cancel request", variant: "destructive" });
    } finally {
      setCancellingExit(false);
    }
  };

  const handleSubmitExit = async () => {
    if (!termsChecked) return;
    setSubmittingExit(true);
    try {
      await apiRequest<any>(`/api/support/tickets`, {
        method: "POST",
        body: JSON.stringify({
          category: "exit_request",
          groupId,
          subject: `Exit request — ${group?.name ?? `Group #${groupId}`}`,
          message: exitReason?.trim() || "I would like to exit this savings group. I have read and accepted the terms.",
        }),
        headers: { "Content-Type": "application/json" },
      });
      setMyExitRequest({ id: 0, status: "pending", reviewNote: null, autoApproveAfterCycle: null, createdAt: new Date().toISOString() });
      setShowExitModal(false);
      setExitReason("");
      setTermsChecked(false);
      toast({ title: "Exit request submitted", description: "Our team will review your request and get back to you shortly. Check Support for updates." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not submit exit request", variant: "destructive" });
    } finally {
      setSubmittingExit(false);
    }
  };

  const handleSubmitSwap = async () => {
    if (!swapTargetId) return;
    setSubmittingSwap(true);
    try {
      const result = await apiRequest<SwapRequest>(`/api/groups/${groupId}/swap-requests`, {
        method: "POST",
        body: JSON.stringify({ targetMemberId: swapTargetId, reason: swapReason || undefined }),
        headers: { "Content-Type": "application/json" },
      });
      setMySwapRequest(result);
      setShowSwapModal(false);
      setSwapTargetId(null);
      setSwapReason("");
      toast({ title: "Swap request submitted", description: "The group admin will review your request." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not submit request", variant: "destructive" });
    } finally {
      setSubmittingSwap(false);
    }
  };

  const handleCancelSwap = async () => {
    if (!mySwapRequest) return;
    setCancellingSwap(true);
    try {
      await apiRequest(`/api/swap-requests/${mySwapRequest.id}`, { method: "DELETE" });
      setMySwapRequest(null);
      toast({ title: "Request cancelled" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not cancel", variant: "destructive" });
    } finally {
      setCancellingSwap(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 text-muted-foreground">Group not found.</div>
      </DashboardLayout>
    );
  }

  const g = group as any;
  const myMembership = g.members?.find((m: any) => m.userId === user?.id);
  const myStatus = myMembership?.contributionStatus ?? "none";
  const totalPayout = g.contributionAmount * g.members?.length;
  const isAdmin = g.adminId === user?.id;
  const otherMembers = (g.members ?? []).filter((m: any) => m.userId !== user?.id);

  const handlePay = () => {
    if (!g.id) return;
    payMutation.mutate({ data: { groupId: g.id, cycleId: g.currentCycle } });
  };

  const exitStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Exit request submitted — pending Aventum Capital review", color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock },
    approved: { label: "Your exit request was approved", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
    denied: { label: "Your exit request was denied", color: "text-red-700 bg-red-50 border-red-200", icon: AlertTriangle },
    auto_approved: { label: "Your exit was auto-approved after cycle completion", color: "text-blue-700 bg-blue-50 border-blue-200", icon: CheckCircle2 },
    cancelled: { label: "Your exit request was cancelled", color: "text-muted-foreground bg-muted/40 border-border", icon: AlertTriangle },
  };

  function formatMessageTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatMessageDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Group messages by day for date separators
  const messageGroups: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatMessageDate(msg.createdAt);
    const last = messageGroups[messageGroups.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      messageGroups.push({ date, messages: [msg] });
    }
  }

  const swapStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Turn swap request pending admin review", color: "text-amber-700 bg-amber-50 border-amber-200" },
    approved: { label: "Turn swap request approved", color: "text-green-700 bg-green-50 border-green-200" },
    denied: { label: "Turn swap request was denied", color: "text-red-700 bg-red-50 border-red-200" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <BackButton to="/groups" label="All Groups" />
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{g.name}</h1>
            <p className="text-muted-foreground text-sm mt-1 capitalize">{g.schedule} contributions • Cycle {g.currentCycle}</p>
          </div>
          <StatusBadge status={g.status} />
        </div>

        {/* Exit request status banner */}
        {exitRequestLoaded && myExitRequest && myExitRequest.status !== "none" && (
          <div className={cn("flex items-start gap-3 p-4 rounded-xl border text-sm", exitStatusConfig[myExitRequest.status]?.color)}>
            {(() => { const Icon = exitStatusConfig[myExitRequest.status]?.icon; return Icon ? <Icon className="w-4 h-4 mt-0.5 shrink-0" /> : null; })()}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{exitStatusConfig[myExitRequest.status]?.label}</p>
              {myExitRequest.autoApproveAfterCycle && myExitRequest.status === "pending" && (
                <p className="text-xs mt-0.5 opacity-80">Eligible for auto-approval after cycle {myExitRequest.autoApproveAfterCycle} completes</p>
              )}
              {myExitRequest.reviewNote && (
                <p className="text-xs mt-0.5 opacity-80">Note: {myExitRequest.reviewNote}</p>
              )}
            </div>
            {myExitRequest.status === "pending" && (
              <button
                onClick={handleCancelExit}
                disabled={cancellingExit}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-current opacity-80 hover:opacity-100 transition-opacity"
              >
                {cancellingExit ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Cancel request
              </button>
            )}
          </div>
        )}

        {/* Swap request status banner */}
        {mySwapRequest && mySwapRequest.status !== "cancelled" && (
          <div className={cn("flex items-center gap-3 p-4 rounded-xl border text-sm", swapStatusConfig[mySwapRequest.status]?.color ?? "text-muted-foreground bg-muted/40 border-border")}>
            <ArrowLeftRight className="w-4 h-4 shrink-0" />
            <p className="flex-1 font-medium">{swapStatusConfig[mySwapRequest.status]?.label ?? "Swap request submitted"}</p>
            {mySwapRequest.status === "pending" && (
              <button
                onClick={handleCancelSwap}
                disabled={cancellingSwap}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-current opacity-80 hover:opacity-100 transition-opacity"
              >
                {cancellingSwap ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Contribution", value: formatGroupAmount(g.contributionAmount, g.currency ?? "KES") },
            { label: "Pool size", value: formatGroupAmount(totalPayout, g.currency ?? "KES") },
            { label: "Members", value: `${g.totalMembers}/${g.maxMembers}` },
            { label: "Paid this cycle", value: `${g.paidCount}/${g.totalMembers}` },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Cycle progress</span>
            <span className="text-muted-foreground">{g.paidCount} of {g.totalMembers} members paid</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(g.paidCount / Math.max(g.totalMembers, 1)) * 100}%` }}
            />
          </div>
          {g.nextDueDate && (
            <p className="text-xs text-muted-foreground mt-2">Due by {formatDate(g.nextDueDate)}</p>
          )}
        </div>

        {/* Two column: pay + recipient */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Your Contribution</h3>
            <p className="text-sm text-muted-foreground mb-3">Pay for the current cycle to keep the rotation going</p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={myStatus} />
            </div>
            {myStatus !== "paid" ? (
              <Button className="w-full" onClick={handlePay} disabled={payMutation.isPending || g.status !== "active"}>
                {payMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Pay {formatGroupAmount(g.contributionAmount, g.currency ?? "KES")}
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>Paid for this cycle</Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Current Recipient</h3>
            <p className="text-sm text-muted-foreground mb-3">Who receives the payout when all members pay</p>
            {g.currentRecipient ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {g.currentRecipient.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium">{g.currentRecipient.name}</div>
                  <div className="text-sm text-muted-foreground">Will receive {formatGroupAmount(totalPayout, g.currency ?? "KES")}</div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recipient yet</p>
            )}
          </div>
        </div>

        {/* Members & Rotation */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold">Members & Rotation Order</h3>
            </div>
            {!isAdmin && myMembership && !mySwapRequest && otherMembers.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-xs"
                onClick={() => setShowSwapModal(true)}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Request turn swap
              </Button>
            )}
          </div>
          <div className="divide-y divide-border">
            {g.members?.length > 0 ? (
              g.members.map((member: any, idx: number) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                      {member.user?.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                    </div>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {member.user?.name ?? "Unknown"}
                        {member.userId === user?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{member.user?.email}</div>
                    </div>
                    {member.rotationOrder === g.currentRotationIndex && (
                      <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">Next</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {member.hasReceivedPayout && (
                      <span className="text-xs text-muted-foreground">Received payout</span>
                    )}
                    <StatusBadge status={member.contributionStatus} />
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No members</div>
            )}
          </div>
        </div>

        {/* Group Chat */}
        <div className="bg-card border border-border rounded-xl flex flex-col">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Group Chat</h3>
            <span className="ml-auto text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Message list */}
          <div className="flex flex-col gap-0 px-5 py-4 min-h-[280px] max-h-[420px] overflow-y-auto">
            {chatLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : messageGroups.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
                <MessageCircle className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No messages yet. Say hello to your group!</p>
              </div>
            ) : (
              messageGroups.map(group => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">{group.date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {group.messages.map((msg, i) => {
                    const isMe = msg.userId === user?.id;
                    const prevMsg = group.messages[i - 1];
                    const isSameSender = prevMsg && prevMsg.userId === msg.userId;
                    return (
                      <div key={msg.id} className={cn("flex gap-2 mb-1", isMe ? "flex-row-reverse" : "flex-row", isSameSender ? "mt-0.5" : "mt-3")}>
                        {!isMe && !isSameSender && (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0 mt-0.5">
                            {(msg.userName ?? "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        {!isMe && isSameSender && <div className="w-7 shrink-0" />}
                        <div className={cn("max-w-[70%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
                          {!isSameSender && !isMe && (
                            <span className="text-xs text-muted-foreground mb-1 ml-1">{msg.userName}</span>
                          )}
                          <div className={cn(
                            "px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                            isMe
                              ? "bg-[#3A5A40] text-white rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          )}>
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">{formatMessageTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Message input */}
          <div className="p-4 border-t border-border">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1"
                maxLength={1000}
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon"
                className="bg-[#3A5A40] hover:bg-[#344E41] shrink-0"
                disabled={!newMessage.trim() || sendingMessage}
              >
                {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>

        {/* Leave group */}
        {!isAdmin && myMembership && exitRequestLoaded && (!myExitRequest || myExitRequest.status === "cancelled" || myExitRequest.status === "denied") && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-destructive">Leave this group</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Submit a request to exit. You must complete your contribution obligations before leaving.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/5 gap-2 shrink-0"
                onClick={() => setShowExitModal(true)}
              >
                <LogOut className="w-4 h-4" />
                Request to leave
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Exit request modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <h2 className="text-lg font-bold">Request to leave group</h2>
              </div>
              <p className="text-sm text-muted-foreground ml-13">
                Your request will be reviewed by Aventum Capital. Please read and agree to the terms below.
              </p>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Terms & Conditions for Group Exit
                </h3>
                <ul className="space-y-2.5">
                  {EXIT_TERMS.map((term, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      {term}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason for leaving (optional)</label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Tell us why you want to leave..."
                  value={exitReason}
                  onChange={e => setExitReason(e.target.value)}
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="mt-0.5">
                  <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} className="w-4 h-4 accent-[#3A5A40]" />
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  I have read and agree to the terms above.
                </span>
              </label>
            </div>
            <div className="p-6 border-t border-border flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowExitModal(false); setExitReason(""); setTermsChecked(false); }} disabled={submittingExit}>Cancel</Button>
              <Button className="flex-1 bg-destructive hover:bg-destructive/90" disabled={!termsChecked || submittingExit} onClick={handleSubmitExit}>
                {submittingExit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit exit request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Turn Swap Request modal */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#3A5A40]/10 flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-[#3A5A40]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Request turn swap</h2>
                  <p className="text-xs text-muted-foreground">Ask to swap your payout position with another member</p>
                </div>
              </div>
              <button onClick={() => setShowSwapModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Swap with</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/30 pr-8"
                    value={swapTargetId ?? ""}
                    onChange={e => setSwapTargetId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Select a member…</option>
                    {otherMembers.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.user?.name ?? "Unknown"}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground">Your rotation positions will be swapped if approved</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/30"
                  placeholder="Why do you need to change your turn?"
                  value={swapReason}
                  onChange={e => setSwapReason(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowSwapModal(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-[#3A5A40] hover:bg-[#344E41]"
                disabled={!swapTargetId || submittingSwap}
                onClick={handleSubmitSwap}
              >
                {submittingSwap && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit request
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
