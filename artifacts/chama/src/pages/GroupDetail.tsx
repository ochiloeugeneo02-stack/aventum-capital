import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  useGetGroup,
  getGetGroupQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BackButton } from "@/components/BackButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ContributionPaymentDialog } from "@/components/ContributionPaymentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useRegion } from "@/contexts/RegionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  Loader2, Users, LogOut, AlertTriangle, CheckCircle2, Clock,
  MessageCircle, Send, ArrowLeftRight, X, ChevronDown, UserPlus, Copy, Check, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import handsTogetherImage from "@assets/pexels-pixabay-461049_1776748558410.jpg";

const EXIT_TERMS = [
  "I understand I must continue contributing for the full current savings cycle before my exit can be processed.",
  "I acknowledge that leaving mid-cycle may disrupt other members' payouts and that my exit is subject to admin review.",
  "I confirm that once approved, my rotation slot and any future payout eligibility in this group will be forfeited.",
  "If I have already received my rotation payout, my exit may be automatically approved once the current cycle completes.",
  "Aventum Capital reserves the right to deny my exit request if it would negatively impact the group's operations.",
];

function CommunityDialogFrame({
  eyebrow,
  title,
  description,
  children,
  contentClassName,
  imagePanelClassName,
  gridClassName,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  imagePanelClassName?: string;
  gridClassName?: string;
}) {
  return (
    <div className="overflow-hidden bg-white text-[#1f2f27]">
      <div className={cn("grid sm:grid-cols-[260px_minmax(0,1fr)]", gridClassName)}>
        <div className={cn("relative h-44 sm:h-auto min-h-full overflow-hidden bg-[#344E41]", imagePanelClassName)}>
          <img
            src={handsTogetherImage}
            alt="Hands joined together"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#344E41]/25" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/90">Aventum</p>
            <p className="mt-1 text-sm font-medium leading-snug text-white">Community savings, together.</p>
          </div>
        </div>
        <div className={cn("p-6 pt-9 sm:p-8", contentClassName)}>
          <DialogHeader className="mb-5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#588157]">{eyebrow}</p>
            <DialogTitle className="mt-2 text-2xl font-bold leading-tight text-[#1f2f27]">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-[#5f6f64]">{description}</DialogDescription>
          </DialogHeader>
          {children}
        </div>
      </div>
    </div>
  );
}

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
  const { region, formatGroupAmount, formatDate } = useRegion();
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

  // Invite state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; email: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: group, isLoading } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId },
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInvitingMember(true);
    try {
      const result = await apiRequest<any>(`/api/groups/${groupId}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      if (result.inviteUrl) {
        setInviteResult({ url: result.inviteUrl, email: inviteEmail.trim() });
        toast({ title: "Invite link generated", description: result.emailSent ? `Invite email sent to ${inviteEmail}` : "Share the link below with your contact." });
      } else {
        toast({ title: "Member added!", description: result.message ?? `${inviteEmail} joined the group.` });
        setShowInviteDialog(false);
        setInviteEmail("");
        queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
      }
    } catch (err: any) {
      toast({ title: "Invite failed", description: err?.data?.error ?? "Could not send invite.", variant: "destructive" });
    } finally {
      setInvitingMember(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteResult?.url) return;
    await navigator.clipboard.writeText(inviteResult.url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
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
    if (!g.id || !g.currentCycleId) return;
    setPaymentOpen(true);
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{g.name}</h1>
            <p className="text-muted-foreground text-sm mt-1 capitalize">{g.schedule} contributions • Cycle {g.currentCycle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <StatusBadge status={g.status} />
            {/* Invite button — group admin only */}
            {isAdmin && (
              <Button
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => { setInviteResult(null); setInviteEmail(""); setShowInviteDialog(true); }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite Member
              </Button>
            )}
            {/* Exit request button — non-admin members only */}
            {!isAdmin && myMembership && exitRequestLoaded && (!myExitRequest || myExitRequest.status === "cancelled" || myExitRequest.status === "denied") && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-destructive text-destructive hover:bg-destructive/5 flex-1 sm:flex-none"
                onClick={() => setShowExitModal(true)}
              >
                <LogOut className="w-3.5 h-3.5" />
                Request to leave
              </Button>
            )}
          </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Contribution", value: formatGroupAmount(g.contributionAmount, g.currency ?? "USD") },
            { label: "Pool size", value: formatGroupAmount(totalPayout, g.currency ?? "USD") },
            { label: "Members", value: `${g.totalMembers}/${g.maxMembers}` },
            { label: "Paid this cycle", value: `${g.paidCount}/${g.totalMembers}` },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center min-w-0">
              <div className="text-base sm:text-xl font-bold break-words">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm mb-2">
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
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="font-semibold mb-1">Your Contribution</h3>
            <p className="text-sm text-muted-foreground mb-3">Pay for the current cycle to keep the rotation going</p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={myStatus} />
            </div>
            {myStatus !== "paid" ? (
              <Button className="w-full" onClick={handlePay} disabled={g.status !== "active" || !g.currentCycleId}>
                Pay {formatGroupAmount(g.contributionAmount, g.currency ?? "USD")}
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>Paid for this cycle</Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h3 className="font-semibold mb-1">Current Recipient</h3>
            <p className="text-sm text-muted-foreground mb-3">Who receives the payout when all members pay</p>
            {g.currentRecipient ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {g.currentRecipient.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.currentRecipient.name}</div>
                  <div className="text-sm text-muted-foreground break-words">Will receive {formatGroupAmount(totalPayout, g.currency ?? "USD")}</div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recipient yet</p>
            )}
          </div>
        </div>

        {/* Members & Rotation */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold">Members & Rotation Order</h3>
            </div>
            {!isAdmin && myMembership && !mySwapRequest && otherMembers.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-xs w-full sm:w-auto"
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
                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                      {member.user?.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                        <span className="truncate">{member.user?.name ?? "Unknown"}</span>
                        {member.userId === user?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">{member.user?.email}</div>
                    </div>
                    {member.rotationOrder === g.currentRotationIndex && (
                      <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">Next</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
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
          <div className="p-4 sm:p-5 border-b border-border flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Group Chat</h3>
            <span className="ml-auto text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Message list */}
          <div className="flex flex-col gap-0 px-4 sm:px-5 py-4 min-h-[240px] sm:min-h-[280px] max-h-[420px] overflow-y-auto">
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
                        <div className={cn("max-w-[82%] sm:max-w-[70%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
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
          <div className="p-3 sm:p-4 border-t border-border">
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
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-destructive">Leave this group</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Submit a request to exit. You must complete your contribution obligations before leaving.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/5 gap-2 shrink-0 w-full sm:w-auto"
                onClick={() => setShowExitModal(true)}
              >
                <LogOut className="w-4 h-4" />
                Request to leave
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Invite Member Dialog ──────────────────────────────────── */}
      <Dialog open={showInviteDialog} onOpenChange={open => { setShowInviteDialog(open); if (!open) { setInviteResult(null); setInviteEmail(""); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-[880px] sm:max-w-none overflow-hidden border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
          {!inviteResult ? (
            <CommunityDialogFrame
              eyebrow="Grow your chama"
              title={<span className="inline-flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" />Invite a member</span>}
              description="Enter their email. If they already have an account they're added instantly — otherwise you'll get a shareable link."
              imagePanelClassName="sm:min-h-[390px]"
              gridClassName="sm:grid-cols-[330px_minmax(0,1fr)]"
            >
              <form onSubmit={handleInvite} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email address</label>
                  <Input
                    type="email"
                    required
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={invitingMember || !inviteEmail.trim()} className="w-full">
                  {invitingMember ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</> : <><Mail className="w-4 h-4 mr-2" />Send invite</>}
                </Button>
              </form>
            </CommunityDialogFrame>
          ) : (
            <CommunityDialogFrame
              eyebrow="Invite ready"
              title={<span className="inline-flex items-center gap-2"><Check className="w-5 h-5 text-green-600" />Invite link ready</span>}
              description={<>Share this link with <strong className="text-[#1f2f27]">{inviteResult.email}</strong>. It's valid for 7 days.</>}
              imagePanelClassName="sm:min-h-[390px]"
              gridClassName="sm:grid-cols-[330px_minmax(0,1fr)]"
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <span className="block break-all text-xs leading-relaxed text-muted-foreground font-mono select-all">{inviteResult.url}</span>
                  <button
                    onClick={copyInviteLink}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                  >
                    {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedInvite ? "Copied!" : "Copy link"}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" className="w-full" onClick={() => { setInviteResult(null); setInviteEmail(""); }}>
                    Invite another
                  </Button>
                  <Button className="w-full" onClick={() => { setShowInviteDialog(false); setInviteResult(null); setInviteEmail(""); }}>
                    Done
                  </Button>
                </div>
              </div>
            </CommunityDialogFrame>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Exit Request Dialog ───────────────────────────────────── */}
      <Dialog open={showExitModal} onOpenChange={open => { setShowExitModal(open); if (!open) { setExitReason(""); setTermsChecked(false); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl overflow-hidden border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
          <CommunityDialogFrame
            eyebrow="Group exit"
            title={<span className="inline-flex items-center gap-2"><LogOut className="w-5 h-5 text-destructive" />Request to leave group</span>}
            description="Your request will be reviewed by Aventum Capital. Please read and agree to the terms below."
            contentClassName="max-h-[82vh] overflow-y-auto"
          >
          <div className="space-y-5 py-2">
            <div className="bg-muted/40 rounded-xl p-3 sm:p-4 border border-border">
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
              <label className="text-sm font-medium">Reason for leaving <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Tell us why you want to leave..."
                value={exitReason}
                onChange={e => setExitReason(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#3A5A40]" />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I have read and agree to the terms above.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitModal(false)} disabled={submittingExit}>Cancel</Button>
              <Button className="flex-1 bg-destructive hover:bg-destructive/90" disabled={!termsChecked || submittingExit} onClick={handleSubmitExit}>
                {submittingExit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit exit request
              </Button>
            </div>
          </div>
          </CommunityDialogFrame>
        </DialogContent>
      </Dialog>

      {/* ── Turn Swap Dialog ──────────────────────────────────────── */}
      <Dialog open={showSwapModal} onOpenChange={setShowSwapModal}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-hidden border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
          <CommunityDialogFrame
            eyebrow="Rotation change"
            title={<span className="inline-flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" />Request turn swap</span>}
            description="Ask to swap your payout position with another member. The group admin will review your request."
          >
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Swap with</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
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
                className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Why do you need to change your turn?"
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowSwapModal(false)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={!swapTargetId || submittingSwap}
                onClick={handleSubmitSwap}
              >
                {submittingSwap && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit request
              </Button>
            </div>
          </div>
          </CommunityDialogFrame>
        </DialogContent>
      </Dialog>
      <ContributionPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        groupId={g.id}
        cycleId={g.currentCycleId}
        amountLabel={formatGroupAmount(g.contributionAmount, g.currency ?? "USD")}
        groupName={g.name}
        currency={region.currency}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        }}
      />
    </DashboardLayout>
  );
}
