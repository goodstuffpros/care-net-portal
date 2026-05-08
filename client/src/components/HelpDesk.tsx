/**
 * HelpDesk — AI-powered floating support chat
 * Floating button on every page. Opens a slide-up panel.
 * Color follows portal mode (teal CG / rose MC).
 * Powered by GPT-4o via /api/helpdesk/chat.
 * Escalates to portal@carenetportal.com with full context on request.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircleHeart, X, Send, ChevronDown, Loader2, AlertCircle, ArrowUpRight, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/App";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface EscalationState {
  offered: boolean;
  sent: boolean;
  sending: boolean;
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/schedule": "Schedule",
  "/care-log": "Care Log",
  "/messages": "Messages",
  "/media": "Media",
  "/archive": "Archive",
  "/medications": "Medications",
  "/vitals": "Vitals",
  "/patterns": "Health Patterns",
  "/university": "Care Net University",
  "/badges": "Badges",
  "/care-scope": "Care Scope",
  "/thoughts": "Collection of Thoughts",
  "/outings": "Outings",
  "/settings": "Settings",
  "/pricing": "Pricing",
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

interface HelpDeskProps {
  /** When true, the "Hey CareNet" wake word is already managed by AppLayout's HFM — skip the built-in listener */
  hfmActive?: boolean;
}

export default function HelpDesk({ hfmActive }: HelpDeskProps = {}) {
  const { activeUser, portalMode } = useApp();
  const [location] = useLocation();
  const isFamilyPortal = portalMode === "family";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [escalation, setEscalation] = useState<EscalationState>({
    offered: false,
    sent: false,
    sending: false,
  });
  const [sessionId] = useState(() => generateId());
  const [listening, setListening] = useState(false);
  const [voiceSupported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const [wakeWordActive, setWakeWordActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const wakeRecognitionRef = useRef<any>(null);

  const currentPage = PAGE_LABELS[location] || location;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ── Voice input ───────────────────────────────────────────────────────────
  function createRecognition(onResult: (transcript: string) => void, onEnd?: () => void) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onend = () => {
      onEnd?.();
    };
    recognition.onerror = () => {
      onEnd?.();
    };
    return recognition;
  }

  function startListening() {
    if (!voiceSupported || listening) return;
    // Stop any existing session
    recognitionRef.current?.abort();
    const recognition = createRecognition(
      (transcript) => {
        setInput(transcript);
        setListening(false);
        // Auto-send after brief delay so user can see what was transcribed
        setTimeout(() => sendMessage(transcript), 600);
      },
      () => setListening(false)
    );
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // "Hey CareNet" wake word — always-on background listener
  // Starts when component mounts, stops when unmounted
  const startWakeWordListener = useCallback(() => {
    if (!voiceSupported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const wake = new SpeechRecognition();
    wake.continuous = true;
    wake.interimResults = true;
    wake.lang = "en-US";

    wake.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        if (transcript.includes("hey carenet") || transcript.includes("hey care net")) {
          // Wake word detected
          wake.stop();
          setWakeWordActive(true);
          setOpen(true);
          // Brief pause then start listening for the actual question
          setTimeout(() => {
            setWakeWordActive(false);
            startListening();
          }, 800);
          return;
        }
      }
    };

    wake.onend = () => {
      // Restart continuously
      if (!open) {
        setTimeout(() => {
          try { wake.start(); } catch {}
        }, 500);
      }
    };

    wakeRecognitionRef.current = wake;
    try { wake.start(); } catch {}
  }, [voiceSupported, open]);

  // Wake word listener is NOT auto-started on mount — only starts after the user
  // has opened the HelpDesk at least once (opt-in to mic permission).
  // If hfmActive is passed from AppLayout, that already handles "Hey CareNet" globally — skip the built-in listener.
  const [wakeListenerEnabled, setWakeListenerEnabled] = useState(false);

  useEffect(() => {
    return () => {
      wakeRecognitionRef.current?.abort();
      recognitionRef.current?.abort();
    };
  }, []);

  // Stop wake listener while chat is open, or when AppLayout's HFM is managing it
  useEffect(() => {
    if (!wakeListenerEnabled || hfmActive) {
      wakeRecognitionRef.current?.abort();
      return;
    }
    if (open) {
      wakeRecognitionRef.current?.abort();
    } else {
      startWakeWordListener();
    }
  }, [open, wakeListenerEnabled, hfmActive]);

  // Show welcome message on first open
  function handleOpen() {
    setOpen(true);
    // Enable wake word listener after first explicit open (opt-in to mic permission)
    if (!wakeListenerEnabled) setWakeListenerEnabled(true);
    if (messages.length === 0) {
      setMessages([{
        id: generateId(),
        role: "assistant",
        content: `Hi${activeUser?.name ? ` ${activeUser.name.split(" ")[0]}` : ""}! I'm here to help with anything in Care Net Portal. What can I help you with?`,
        timestamp: new Date(),
      }]);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiRequest("POST", "/api/helpdesk/chat", {
        sessionId,
        message: text.trim(),
        context: {
          userName: activeUser?.name,
          userRole: activeUser?.role,
          portalMode,
          currentPage,
        },
        history: messages.map(m => ({ role: m.role, content: m.content })),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Check if escalation should be offered
      if (data.shouldEscalate && !escalation.offered && !escalation.sent) {
        setEscalation(prev => ({ ...prev, offered: true }));
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: "assistant",
        content: "I'm having trouble connecting right now. For immediate help, email portal@carenetportal.com.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEscalate() {
    setEscalation(prev => ({ ...prev, sending: true }));
    try {
      await apiRequest("POST", "/api/helpdesk/escalate", {
        sessionId,
        userName: activeUser?.name,
        userRole: activeUser?.role,
        currentPage,
        history: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
      });
      setEscalation({ offered: false, sent: true, sending: false });
      setMessages(prev => [...prev, {
        id: generateId(),
        role: "assistant",
        content: "Done — I've sent your question and our full conversation to the Care Net Portal team at portal@carenetportal.com. You don't need to explain anything again. Someone will follow up with you soon.",
        timestamp: new Date(),
      }]);
    } catch {
      setEscalation(prev => ({ ...prev, sending: false }));
      setMessages(prev => [...prev, {
        id: generateId(),
        role: "assistant",
        content: "I wasn't able to send that automatically. Please email portal@carenetportal.com directly — I'm sorry for the extra step.",
        timestamp: new Date(),
      }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Help Desk always uses app primary (teal) — visually distinct from rose Need a Moment button
  const accentColor = "bg-primary hover:bg-primary/90";
  const accentText = "text-primary";
  const accentBorder = "border-primary/20";
  const accentBubble = "bg-primary text-primary-foreground";

  return (
    <>
      {/* Floating button — teal, always bottom-5 right-5 */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        data-testid="helpdesk-toggle"
        className={cn(
          "fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full shadow-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
          wakeWordActive ? "bg-green-500" : accentColor,
          "text-white"
        )}
        aria-label="App Help"
      >
        {wakeWordActive
          ? <Mic className="w-5 h-5 animate-pulse" />
          : open
          ? <ChevronDown className="w-4 h-4" />
          : <MessageCircleHeart className="w-4 h-4" />
        }
        {!wakeWordActive && (
          <span className="text-[8px] font-semibold leading-none tracking-wide opacity-90">
            {open ? "Close" : "App Help"}
          </span>
        )}
      </button>

      {/* Wake word hint — visible in all portals */}
      {voiceSupported && !open && (
        <div className="fixed bottom-20 right-5 z-40 pointer-events-none">
          <div className="text-xs text-muted-foreground/50 text-right pr-1">
            Say “Hey CareNet”
          </div>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-20 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)]",
            "rounded-2xl border border-border bg-background shadow-2xl",
            "flex flex-col overflow-hidden",
            "animate-in slide-in-from-bottom-4 duration-200"
          )}
          style={{ height: "480px" }}
          data-testid="helpdesk-panel"
        >
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-border",
            isFamilyPortal ? "bg-rose-600" : "bg-primary"
          )}>
            <div className="flex items-center gap-2">
              <MessageCircleHeart className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">Care Net Support</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              data-testid="helpdesk-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? accentBubble
                      : "bg-muted text-foreground rounded-tl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}

            {/* Escalation offer */}
            {escalation.offered && !escalation.sent && (
              <div className={cn(
                "mx-1 p-3 rounded-xl border text-sm",
                accentBorder,
                "bg-muted/40"
              )}>
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className={cn("w-4 h-4 mt-0.5 flex-shrink-0", accentText)} />
                  <p className="text-foreground/80">
                    Want me to send this to the Care Net Portal team? I'll include our full conversation so you don't have to explain it again.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleEscalate}
                  disabled={escalation.sending}
                  className={cn("w-full gap-2 text-xs", accentColor, "text-white")}
                >
                  {escalation.sending
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
                    : <><ArrowUpRight className="w-3 h-3" /> Yes, send to support team</>
                  }
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-2 flex items-end gap-2">
            {/* Mic button */}
            {voiceSupported && (
              <button
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  listening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                data-testid="helpdesk-mic"
                title={listening ? "Stop listening" : "Speak your question"}
              >
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? "Listening…" : "Ask anything about Care Net Portal…"}
              rows={1}
              className="flex-1 resize-none text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 max-h-24 py-1.5 leading-relaxed"
              data-testid="helpdesk-input"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading || listening}
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                input.trim() && !loading && !listening
                  ? cn(accentColor, "text-white")
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              data-testid="helpdesk-send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
