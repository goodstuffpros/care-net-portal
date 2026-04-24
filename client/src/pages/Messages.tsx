import { useApp } from "@/App";
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
import { MessageSquare, Plus, Send, Mic, MicOff, Lock, Unlock, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { toast } = useToast();
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [msgText, setMsgText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [msgPriority, setMsgPriority] = useState("green");
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadName, setNewThreadName] = useState("");
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
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads", activeThreadId, "messages"] });
      setMsgText("");
    },
  });

  const closeThreadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/threads/${id}`, { isOpen: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      toast({ title: "Thread closed", description: "This chat has been archived." });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/threads`, {
      name: newThreadName,
      members: JSON.stringify([activeUser.id]),
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
      {/* Thread List */}
      <div className={cn("flex flex-col border-r border-border bg-background", activeThreadId ? "hidden md:flex w-72 flex-shrink-0" : "flex-1 md:w-72 md:flex-none")}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-base font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Messages</h1>
          <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" data-testid="new-thread-btn">
                <Plus size={14} /> New
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
            {activeUser.role === "caregiver" && activeThread?.isOpen && (
              <Button
                variant="ghost" size="sm"
                onClick={() => closeThreadMutation.mutate(activeThreadId)}
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                data-testid="close-thread-btn"
              >
                <Lock size={13} /> Close Thread
              </Button>
            )}
          </div>

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
                        title={p === "green" ? "Routine" : p === "yellow" ? "Important" : "Urgent"}
                        data-testid={`priority-dot-${p}`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">{msgPriority === "red" ? "Urgent" : msgPriority === "yellow" ? "Important" : "Routine"}</span>
                  </div>
                  <Input
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && msgText.trim() && sendMutation.mutate()}
                    placeholder="Type a message or use voice..."
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
                <Button onClick={() => msgText.trim() && sendMutation.mutate()} disabled={!msgText.trim() || sendMutation.isPending} className="h-10 rounded-xl px-4 flex-shrink-0" data-testid="send-btn">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          )}
          {activeThread && !activeThread.isOpen && (
            <div className="p-4 border-t border-border text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Lock size={13} /> This thread has been closed
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
