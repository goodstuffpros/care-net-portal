import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, CheckCircle2, AlertCircle, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceCommandResult } from "@/lib/voiceCommands";

export interface VoiceCommandConfirmState {
  result: VoiceCommandResult;
  onConfirm: (data: { text: string; category: string; priority: string }) => void;
  onCancel: () => void;
}

interface VoiceCommandModalProps {
  confirmState: VoiceCommandConfirmState | null;
  isSubmitting?: boolean;
  lastConfirmed?: { type: string; text?: string } | null;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "medication", label: "Medication" },
  { value: "hygiene", label: "Hygiene" },
  { value: "meal", label: "Meal" },
  { value: "mood", label: "Mood" },
  { value: "medical", label: "Medical" },
];

const PRIORITIES = [
  { value: "green", label: "Normal" },
  { value: "yellow", label: "Important" },
  { value: "red", label: "Urgent" },
];

export default function VoiceCommandModal({
  confirmState,
  isSubmitting,
  lastConfirmed,
}: VoiceCommandModalProps) {
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [editPriority, setEditPriority] = useState("green");
  const [successVisible, setSuccessVisible] = useState(false);

  // Populate form when a new confirmation arrives
  useEffect(() => {
    if (confirmState?.result) {
      setEditText(confirmState.result.text || confirmState.result.raw || "");
      setEditCategory(confirmState.result.category || "general");
      setEditPriority(confirmState.result.priority || "green");
    }
  }, [confirmState]);

  // Show brief success flash
  useEffect(() => {
    if (lastConfirmed) {
      setSuccessVisible(true);
      const t = setTimeout(() => setSuccessVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [lastConfirmed]);

  if (!confirmState && !successVisible) return null;

  // Success state
  if (!confirmState && successVisible && lastConfirmed) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-200">
        <CheckCircle2 size={16} />
        {lastConfirmed.type === "log_activity" ? "Activity logged" : "Message sent"}
        {lastConfirmed.text && (
          <span className="opacity-75 ml-1 max-w-[200px] truncate">— {lastConfirmed.text}</span>
        )}
      </div>
    );
  }

  if (!confirmState) return null;

  const isLogActivity = confirmState.result.type === "log_activity";
  const isSendMessage = confirmState.result.type === "send_message";

  return (
    <Dialog open={!!confirmState} onOpenChange={(open) => { if (!open) confirmState?.onCancel(); }}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mic size={16} className="text-primary" />
            {isLogActivity ? "Confirm Voice Log Entry" : isSendMessage ? "Confirm Voice Message" : "Voice Command"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Transcribed text display */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-start gap-2">
            <Mic size={12} className="mt-0.5 flex-shrink-0 text-primary/60" />
            <span className="italic leading-relaxed">"{confirmState.result.raw}"</span>
          </div>

          {(isLogActivity || isSendMessage) && (
            <>
              {/* Editable text */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Pencil size={11} />
                  {isLogActivity ? "Entry text" : "Message"} <span className="text-muted-foreground/60">(edit if needed)</span>
                </label>
                <Textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="min-h-[72px] text-sm resize-none"
                  data-testid="voice-confirm-text"
                />
              </div>

              {/* Category + Priority (activity only) */}
              {isLogActivity && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger className="h-8 text-xs" data-testid="voice-confirm-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger className="h-8 text-xs" data-testid="voice-confirm-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Inferred badges */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>CareNet inferred:</span>
                <Badge variant="outline" className="text-xs capitalize">{editCategory}</Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs", editPriority === "red" ? "border-red-300 text-red-600 dark:text-red-400" : editPriority === "yellow" ? "border-amber-300 text-amber-600 dark:text-amber-400" : "border-emerald-300 text-emerald-600 dark:text-emerald-400")}
                >
                  {PRIORITIES.find(p => p.value === editPriority)?.label}
                </Badge>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={confirmState.onCancel}
              data-testid="voice-confirm-cancel"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={isSubmitting || !editText.trim()}
              onClick={() => confirmState.onConfirm({ text: editText.trim(), category: editCategory, priority: editPriority })}
              data-testid="voice-confirm-submit"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
              {isLogActivity ? "Log Entry" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
