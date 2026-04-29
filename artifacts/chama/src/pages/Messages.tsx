import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Loader2, Send, MessageSquare, ArrowLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  last_message: string;
  last_message_at: string;
  last_from_id: number;
  unread_count: number;
}

interface DmMessage {
  id: number;
  from_user_id: number;
  to_user_id: number;
  content: string;
  read_at: string | null;
  created_at: string;
  from_name: string;
  from_avatar?: string | null;
}

interface ChatUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiRequest<Conversation[]>("/api/dm/conversations");
      setConversations(data);
    } catch {
      // silent
    } finally {
      setConvsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-open conversation from ?user=X query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user");
    if (userId && !selectedUser) {
      const numId = parseInt(userId);
      if (!isNaN(numId)) {
        setMessagesLoading(true);
        apiRequest<{ user: ChatUser; messages: DmMessage[] }>(`/api/dm/${numId}`)
          .then(data => {
            setMessages(data.messages);
            setSelectedUser(data.user);
            loadConversations();
          })
          .catch(() => {})
          .finally(() => setMessagesLoading(false));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = useCallback(async (userId: number) => {
    try {
      const data = await apiRequest<{ user: ChatUser; messages: DmMessage[] }>(`/api/dm/${userId}`);
      setMessages(data.messages);
      setSelectedUser(data.user);
      loadConversations();
    } catch {
      toast({ title: "Error", description: "Could not load messages", variant: "destructive" });
    } finally {
      setMessagesLoading(false);
    }
  }, [loadConversations, toast]);

  useEffect(() => {
    if (selectedUser) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadMessages(selectedUser.id), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedUser, loadMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openConversation = async (conv: Conversation) => {
    setMessagesLoading(true);
    setMessages([]);
    setSelectedUser({ id: conv.id, name: conv.name, email: conv.email, avatar: conv.avatar });
    await loadMessages(conv.id);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");
    try {
      await apiRequest(`/api/dm/${selectedUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      await loadMessages(selectedUser.id);
    } catch {
      toast({ title: "Error", description: "Could not send message", variant: "destructive" });
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const filteredConvs = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="mb-4 flex items-center gap-3">
          {selectedUser && (
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSelectedUser(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-sm text-muted-foreground">{totalUnread} unread message{totalUnread !== 1 ? "s" : ""}</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation list */}
          <div className={cn(
            "w-full lg:w-80 xl:w-96 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col min-h-0",
            selectedUser ? "hidden lg:flex" : "flex"
          )}>
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {convsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchQuery ? "No matching conversations" : "Message a group member from their profile"}
                    </p>
                  </div>
                </div>
              ) : (
                filteredConvs.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0",
                      selectedUser?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="relative">
                      <UserAvatar name={conv.name} avatar={conv.avatar} size="md" />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                          {conv.unread_count > 9 ? "9+" : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm truncate", conv.unread_count > 0 ? "font-semibold" : "font-medium")}>
                          {conv.name}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className={cn("text-xs truncate mt-0.5", conv.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                        {conv.last_from_id === user?.id ? "You: " : ""}{conv.last_message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat window */}
          <div className={cn(
            "flex-1 bg-card border border-border rounded-xl flex flex-col min-h-0 min-w-0",
            !selectedUser ? "hidden lg:flex" : "flex"
          )}>
            {!selectedUser ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-primary/40" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Your messages</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Select a conversation or message a member from your group page
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <UserAvatar name={selectedUser.name} avatar={selectedUser.avatar} size="md" />
                  <div>
                    <p className="font-semibold text-sm">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center flex-1">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                      <p className="text-4xl">👋</p>
                      <p className="text-sm text-muted-foreground">
                        Start a conversation with {selectedUser.name}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.from_user_id === user?.id;
                      const prev = messages[i - 1];
                      const isSameSender = prev?.from_user_id === msg.from_user_id;
                      const showAvatar = !isMe && !isSameSender;

                      return (
                        <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row", isSameSender ? "mt-0.5" : "mt-3")}>
                          {!isMe && (
                            <div className="w-7 shrink-0 mt-0.5">
                              {showAvatar ? (
                                <UserAvatar name={msg.from_name} avatar={msg.from_avatar} size="sm" />
                              ) : null}
                            </div>
                          )}
                          <div className={cn("max-w-[75%] flex flex-col", isMe ? "items-end" : "items-start")}>
                            {showAvatar && !isMe && (
                              <span className="text-xs text-muted-foreground mb-1 ml-1">{msg.from_name}</span>
                            )}
                            <div className={cn(
                              "px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-sm",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            )}>
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                              {formatMessageTime(msg.created_at)}
                              {isMe && msg.read_at && " · Read"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input */}
                <div className="p-3 sm:p-4 border-t border-border">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder={`Message ${selectedUser.name}…`}
                      className="flex-1"
                      maxLength={2000}
                      autoComplete="off"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="shrink-0"
                      disabled={!newMessage.trim() || sending}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
