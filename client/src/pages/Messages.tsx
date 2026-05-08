import { useApp } from "@/App";
import { LessonLauncher } from "@/components/LessonLauncher";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatThread, Message } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Plus, Send, Mic, MicOff, Lock, Users, ChevronRight, CheckCircle2, Circle, Volume2, AlertTriangle, PhoneCall, UserPlus, UserMinus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { speakBecky } from "@/lib/ttsUtils";
import ModuleIntro from "@/components/ModuleIntro";

const DEMO_USERS: Record<number, { name: string; initials: string; role: string }> = {
  1: { name: "Becky M.", initials: "BM", role: "caregiver" },
  2: { name: "Robert Jr.", initials: "RJ", role: "primary_family" },
  3: { name: "Linda J.", initials: "LJ", role: "secondary_family" },
  4: { name: "Sarah W.", initials: "SW", role: "primary_family" },
};

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { activeUser, selectedClientId } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);

  // Voice: "Hey Care Net, message to Robert Johnson Jr" — auto-selects matching thread
  useEffect(() => {
    const handler = (e: Event) => {
      const { threadId } = (e as CustomEvent).detail || {};
      if (threadId) setActiveThreadId(threadId);
    };
    window.addEventListener("voice:open-message", handler);
    return () => window.removeEventListener("voice:open-message", handler);
  }, []);

  const [msgText, setMsgText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [msgPriority, setMsgPriority] = useState("green");
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadName, setNewThreadName] = useState("");
  const [urgentPromptOpen, setUrgentPromptOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threads = [], isLoading: threadsLoading } = useQuery<ChatThread[]>({
    queryKey: ["/api/clients", selectedClientId, "threads"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/threads`).then(r => r.json()),
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/threads", activeThreadId, "messages"],
    queryFn: () => apiRequest("GET", `/api/threads/${activeThreadId}/messages`).then(r => r.json()),
    enabled: !!activeThreadId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/threads/${activeThreadId}/messages`, {
      senderId: activeUser.id,
      content: msgText,
      messageType: "text",
      priority: msgPriority,
      sentAt: new Date().toISOString(),
      isRead: false,
      readByUserIds: JSON.stringify([activeUser.id]),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads", activeThreadId, "messages"] });
      setMsgText("");
      setUrgentPromptOpen(false);
    },
  });

  // Family roles sending urgent/red messages get a pre-send prompt
  const isFamilyRole = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  function handleSend() {
    if (!msgText.trim()) return;
    if (isFamilyRole && msgPriority === "red") {
      setUrgentPromptOpen(true);
    } else {
      sendMutation.mutate();
    }
  }

  const readReceiptMutation = useMutation({
    mutationFn: (messageId: number) => apiRequest("PATCH", `/api/messages/${messageId}/read`, { userId: activeUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads", activeThreadId, "messages"] });
    },
  });

  // All users in the portal for this client — real API, not hardcoded
  const { data: portalUsers = [] } = useQuery<{ id: number; name: string; avatarInitials: string; role: string }[]>({
    queryKey: ["/api/clients", selectedClientId, "family"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/family`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  // Normalise for display — works for both real users and demo fallback
  const ALL_PORTAL_USERS = portalUsers.map(u => ({
    id: u.id,
    name: u.name,
    initials: u.avatarInitials || u.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
    role: u.role,
  }));

  const addMemberMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("PATCH", `/api/threads/${activeThreadId}/members/add`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      toast({ title: "Member added", description: "They can now see and send messages in this thread." });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("PATCH", `/api/threads/${activeThreadId}/members/remove`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      toast({ title: "Member removed" });
    },
  });

  const closeThreadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/threads/${id}`, { isOpen: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      toast({ title: "Thread closed", description: "This chat has been archived." });
    },
  });

  const leaveThreadMutation = useMutation({
    mutationFn: async (threadId: number) => {
      // 1. Remove self from members
      await apiRequest("PATCH", `/api/threads/${threadId}/members/remove`, { userId: activeUser.id });
      // 2. Post system notification message
      await apiRequest("POST", `/api/threads/${threadId}/messages`, {
        senderId: activeUser.id,
        content: `${activeUser.name} has left this thread.`,
        messageType: "system",
        priority: "green",
        sentAt: new Date().toISOString(),
        isRead: false,
        readByUserIds: JSON.stringify([activeUser.id]),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/threads", activeThreadId, "messages"] });
      setActiveThreadId(null);
      setManageMembersOpen(false);
      toast({ title: "You have left the thread.", description: "You will no longer receive messages from this conversation." });
    },
    onError: () => toast({ title: "Could not leave thread", variant: "destructive" }),
  });

  const createThreadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/threads`, {
      name: newThreadName,
      members: JSON.stringify(ALL_PORTAL_USERS.length > 0 ? ALL_PORTAL_USERS.map(u => u.id) : [activeUser.id]),
      createdByUserId: activeUser.id,
      isOpen: true,
      createdAt: new Date().toISOString(),
    }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      setNewThreadOpen(false);
      setNewThreadName("");
      r.json().then((t: ChatThread) => setActiveThreadId(t.id));
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark unread messages as read when thread is opened
  useEffect(() => {
    if (!activeThreadId || messages.length === 0) return;
    const unreadFromOthers = messages.filter(m => m.senderId !== activeUser.id && !m.isRead);
    unreadFromOthers.forEach(m => readReceiptMutation.mutate(m.id));
  }, [activeThreadId, messages.length]);

  const toggleVoice = () => {
    if (!isRecording && "webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setMsgText(prev => prev ? prev + " " + text : text);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      <ModuleIntro moduleKey="messages" />
      {/* Thread List */}
      <div className={cn("flex flex-col border-r border-border bg-background", activeThreadId ? "hidden md:flex w-72 flex-shrink-0" : "flex-1 md:w-72 md:flex-none")}>
        <div className="p-4 border-b border-border">
          <h1 className="text-base font-bold mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("messages.title")}</h1>
          <div className="flex items-center justify-between gap-2">
            <LessonLauncher pageKey="messages" />
            <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white" data-testid="new-thread-btn">
                  <Plus size={14} /> {t("messages.newThread")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Chat Group</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Group Name</Label>
                    <Input value={newThreadName} onChange={e => setNewThreadName(e.target.value)} placeholder="e.g. Urgent Updates, Weekend Team" data-testid="thread-name-input" />
                  </div>
                  <Button className="w-full" onClick={() => createThreadMutation.mutate()} disabled={!newThreadName || createThreadMutation.isPending} data-testid="create-thread-btn">
                    Create Chat Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-4 space-y-3">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground p-4">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-25" />
              <p className="text-sm">No chat groups yet</p>
            </div>
          ) : threads.map(thread => {
            const memberIds: number[] = JSON.parse(thread.members || "[]");
            return (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={cn("w-full text-left p-4 border-b border-border/50 transition-colors hover:bg-muted/50", activeThreadId === thread.id && "bg-accent/50")}
                data-testid={`thread-item-${thread.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Users size={14} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{thread.name}</div>
                      <div className="text-xs text-muted-foreground">{memberIds.length} members</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!thread.isOpen && <Lock size={12} className="text-muted-foreground" />}
                    {thread.isOpen && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message Thread */}
      {activeThreadId ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background flex-shrink-0">
            <button onClick={() => setActiveThreadId(null)} className="md:hidden p-1.5 rounded-lg hover:bg-muted">
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Users size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{activeThread?.name}</div>
              {activeThread && (
                <div className="text-xs text-muted-foreground">
                  {JSON.parse(activeThread.members || "[]").map((id: number) => DEMO_USERS[id]?.name).filter(Boolean).join(", ")}
                </div>
              )}
            </div>
            {/* Listen to thread */}
            <button
              onClick={() => {
                if (!messages.length) return;
                const text = messages.map(m => {
                  const sender = DEMO_USERS[m.senderId]?.name || "Someone";
                  return `${sender} said: ${m.content}`;
                }).join(". ");
                speakBecky(text);
              }}
              data-testid="thread-listen"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
            >
              <Volume2 size={14} /> Listen
            </button>
            {/* Manage Members button — caregiver + primary_family only */}
            {(activeUser.role === "caregiver" || activeUser.role === "primary_family") && activeThread?.isOpen && (
              <Button
                variant="ghost" size="sm"
                onClick={() => setManageMembersOpen(o => !o)}
                className={cn("text-xs gap-1.5", manageMembersOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                data-testid="manage-members-btn"
              >
                <Users size={13} /> Members
              </Button>
            )}
            {activeUser.role === "caregiver" && activeThread?.isOpen && (
              <Button
                variant="ghost" size="sm"
                onClick={() => closeThreadMutation.mutate(activeThreadId)}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                data-testid="close-thread-btn"
              >
                <Lock size={13} /> Close
              </Button>
            )}
          </div>

          {/* Manage Members Panel */}
          {manageMembersOpen && activeThread && (() => {
            const memberIds: number[] = JSON.parse(activeThread.members || "[]");
            const nonMembers = ALL_PORTAL_USERS.filter(u => !memberIds.includes(u.id));
            return (
              <div className="border-b border-border bg-muted/30 px-4 py-3 space-y-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Manage Members</span>
                  <button onClick={() => setManageMembersOpen(false)} className="p-1 rounded hover:bg-muted"><X size={14} /></button>
                </div>
                {/* Current members */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Current members</div>
                  <div className="flex flex-wrap gap-2">
                    {memberIds.map(id => {
                      const user = ALL_PORTAL_USERS.find(u => u.id === id);
                      if (!user) return null;
                      const isMe = id === activeUser.id;
                      const canManagerRemove = (activeUser.role === "caregiver" || activeUser.role === "primary_family") && !isMe && memberIds.length > 1;
                      return (
                        <div key={id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-background border border-border text-xs">
                          <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">{user.initials}</div>
                          <span className="font-medium">{user.name}</span>
                          <span className="text-muted-foreground">· {user.role}</span>
                          {isMe && <span className="text-[10px] text-primary">(you)</span>}
                          {/* Every user can leave their own thread */}
                          {isMe && memberIds.length > 1 && (
                            <button
                              onClick={() => leaveThreadMutation.mutate(activeThreadId!)}
                              disabled={leaveThreadMutation.isPending}
                              className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Leave this thread"
                              data-testid="leave-thread-btn"
                            >
                              <UserMinus size={12} />
                            </button>
                          )}
                          {/* Caregiver/MC can remove others */}
                          {canManagerRemove && (
                            <button
                              onClick={() => removeMemberMutation.mutate(id)}
                              disabled={removeMemberMutation.isPending}
                              className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Remove from thread"
                              data-testid={`remove-member-${id}`}
                            >
                              <UserMinus size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Add members */}
                {nonMembers.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Add to thread</div>
                    <div className="flex flex-wrap gap-2">
                      {nonMembers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => addMemberMutation.mutate(user.id)}
                          disabled={addMemberMutation.isPending}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-dashed border-primary/40 text-xs text-primary hover:bg-primary/5 transition-colors"
                          data-testid={`add-member-${user.id}`}
                        >
                          <UserPlus size={11} />
                          {user.name}
                          <span className="text-muted-foreground">· {user.role}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgsLoading ? (
              <div className="space-y-3">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className={cn("h-14 rounded-xl", i % 2 === 0 ? "mr-20" : "ml-20")} />)}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <MessageSquare size={36} className="mx-auto mb-2 opacity-25" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            ) : messages.map(msg => {
              // System messages: centered italic gray pill
              if (msg.messageType === "system") {
                return (
                  <div key={msg.id} className="flex justify-center py-1" data-testid={`message-${msg.id}`}>
                    <span className="text-xs italic text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }
              const sender = DEMO_USERS[msg.senderId];
              const isMe = msg.senderId === activeUser.id;
              return (
                <div key={msg.id} className={cn("flex gap-2.5 max-w-[80%]", isMe ? "ml-auto flex-row-reverse" : "")} data-testid={`message-${msg.id}`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                      {sender?.initials || "?"}
                    </div>
                  )}
                  <div className={cn("space-y-1", isMe ? "items-end flex flex-col" : "")}>
                    {!isMe && <div className="text-xs text-muted-foreground px-1">{sender?.name}</div>}
                    <div className={cn("px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed", isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-muted-foreground">{formatMsgTime(msg.sentAt)}</span>
                      {msg.priority && msg.priority !== "green" && <PriorityBadge priority={msg.priority} />}
                      {/* Read receipts — only show on sender's messages */}
                      {isMe && (() => {
                        const readers: number[] = JSON.parse(msg.readByUserIds || "[]");
                        const readByOthers = readers.filter(id => id !== activeUser.id).length > 0;
                        return readByOthers ? (
                          <span title="Read" className="text-primary" data-testid={`read-receipt-${msg.id}`}>
                            <CheckCircle2 size={12} />
                          </span>
                        ) : (
                          <span title="Delivered" className="text-muted-foreground/50" data-testid={`unread-receipt-${msg.id}`}>
                            <Circle size={12} />
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {(activeThread?.isOpen || !activeThread) && (
            <div className="p-4 border-t border-border bg-background flex-shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    {["green", "yellow", "red"].map(p => (
                      <button key={p} onClick={() => setMsgPriority(p)}
                        className={cn("w-4 h-4 rounded-full border-2 transition-all", {
                          "bg-emerald-500 border-emerald-600": p === "green" && msgPriority === "green",
                          "bg-amber-500 border-amber-600": p === "yellow" && msgPriority === "yellow",
                          "bg-red-500 border-red-600": p === "red" && msgPriority === "red",
                          "bg-transparent border-emerald-400": p === "green" && msgPriority !== "green",
                          "bg-transparent border-amber-400": p === "yellow" && msgPriority !== "yellow",
                          "bg-transparent border-red-400": p === "red" && msgPriority !== "red",
                        })}
                        title={p === "green" ? t("messages.priority.green") : p === "yellow" ? t("messages.priority.yellow") : t("messages.priority.red")}
                        data-testid={`priority-dot-${p}`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">{msgPriority === "red" ? t("messages.priority.red") : msgPriority === "yellow" ? t("messages.priority.yellow") : t("messages.priority.green")}</span>
                  </div>
                  <Input
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && msgText.trim() && handleSend()}
                    placeholder={t("messages.typeMessage")}
                    className="rounded-xl"
                    data-testid="message-input"
                  />
                </div>
                <button
                  onClick={toggleVoice}
                  className={cn("h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0 transition-colors", isRecording ? "bg-red-500 text-white border-red-500 recording-pulse" : "bg-background border-input hover:bg-muted")}
                  data-testid="voice-msg-btn"
                >
                  {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
                <Button onClick={() => handleSend()} disabled={!msgText.trim() || sendMutation.isPending} className="h-10 rounded-xl px-4 flex-shrink-0" data-testid="send-btn">
                  <Send size={16} /> {t("messages.send")}
                </Button>
              </div>
            </div>
          )}
          {activeThread && !activeThread.isOpen && (
            <div className="p-4 border-t border-border text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Lock size={13} /> {t("messages.closed")}
            </div>
          )}

          {/* Urgent message pre-send dialog */}
          {urgentPromptOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t("messages.urgent.title")}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t("messages.urgent.body")}
                    </p>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  <strong>{t("messages.urgent.preview")}:</strong> "{msgText.length > 80 ? msgText.slice(0, 80) + "..." : msgText}"
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUrgentPromptOpen(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                    data-testid="urgent-cancel-btn"
                  >
                    {t("messages.urgent.cancel")}
                  </button>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                    data-testid="urgent-send-btn"
                  >
                    <Send size={14} /> {t("messages.urgent.send")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
            <p>Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
