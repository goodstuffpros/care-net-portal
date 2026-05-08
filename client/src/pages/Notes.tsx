import { useState } from "react";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useApp, isCaregiverRole } from "@/App";
import { PriorityBadge } from "@/components/AppLayout";
import { speakText } from "@/lib/ttsUtils";
import type { MiscNote } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  StickyNote, Pin, CheckCircle2, Trash2, Plus, Volume2,
  ChevronDown, ChevronUp, Home, Wrench, ShieldAlert, HelpCircle, RotateCcw,
  MessageSquare, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LessonLauncher } from "@/components/LessonLauncher";

const CATEGORY_CONFIG = {
  household: { label: "Household", icon: Home, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900" },
  equipment: { label: "Equipment", icon: Wrench, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900" },
  safety: { label: "Safety", icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" },
  other: { label: "Other", icon: HelpCircle, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800" },
};

type Category = keyof typeof CATEGORY_CONFIG;

function NoteCard({
  note,
  canEdit,
  canResolve,
  onPin,
  onResolve,
  onDelete,
  onDiscuss,
  isDiscussing,
}: {
  note: MiscNote;
  canEdit: boolean;
  canResolve: boolean;
  onPin: (id: number, val: boolean) => void;
  onResolve: (id: number, val: boolean) => void;
  onDelete: (id: number) => void;
  onDiscuss: (note: MiscNote) => void;
  isDiscussing: boolean;
}) {
  const config = CATEGORY_CONFIG[note.category as Category] || CATEGORY_CONFIG.other;
  const Icon = config.icon;
  const ts = new Date(note.createdAt);
  const dateStr = ts.toLocaleDateString([], { month: "short", day: "numeric" });
  const timeStr = ts.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const handleListen = () => {
    speakText(`${note.title}. ${note.body}`);
  };

  return (
    <div
      data-testid={`note-card-${note.id}`}
      className={cn(
        "rounded-xl border p-4 transition-all",
        note.isResolved
          ? "opacity-60 bg-muted/40 border-border"
          : note.isPinned
          ? "bg-card border-primary/30 shadow-sm ring-1 ring-primary/10"
          : "bg-card border-border hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border", config.bg)}>
          <Icon size={15} className={config.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", config.bg, config.color)}>
                {config.label}
              </span>
              {note.isPinned && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium flex items-center gap-1">
                  <Pin size={9} /> Pinned
                </span>
              )}
              {note.isResolved && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900 font-medium flex items-center gap-1">
                  <CheckCircle2 size={9} /> Resolved
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">{dateStr} · {timeStr}</span>
          </div>

          <h3 className="font-semibold text-sm text-foreground mb-1 leading-snug">{note.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{note.body}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border flex-wrap">
        <button
          onClick={handleListen}
          data-testid={`note-listen-${note.id}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted"
        >
          <Volume2 size={13} /> Listen
        </button>

        {/* Discuss — visible to all users */}
        <button
          onClick={() => onDiscuss(note)}
          disabled={isDiscussing}
          data-testid={`note-discuss-${note.id}`}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors px-2 py-1 rounded-md hover:bg-muted disabled:opacity-50"
        >
          {isDiscussing
            ? <><Loader2 size={12} className="animate-spin" /> Creating...</>
            : <><MessageSquare size={13} /> Discuss</>}
        </button>

        {canEdit && (
          <>
            <button
              onClick={() => onPin(note.id, !note.isPinned)}
              data-testid={`note-pin-${note.id}`}
              className={cn("flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:bg-muted", note.isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <Pin size={13} /> {note.isPinned ? "Unpin" : "Pin"}
            </button>

            <button
              onClick={() => onDelete(note.id)}
              data-testid={`note-delete-${note.id}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 transition-colors px-2 py-1 rounded-md hover:bg-muted ml-auto"
            >
              <Trash2 size={13} /> Delete
            </button>
          </>
        )}

        {/* Resolve — caregiver or family can toggle */}
        {canResolve && (
          <button
            onClick={() => onResolve(note.id, !note.isResolved)}
            data-testid={`note-resolve-${note.id}`}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:bg-muted ml-auto",
              note.isResolved ? "text-amber-600" : "text-muted-foreground hover:text-emerald-600"
            )}
          >
            {note.isResolved ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Resolved</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Notes() {
  const { activeUser, selectedClientId } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";
  const canEdit = isCaregiverRole(activeUser.role) || isFamily; // MC/family can add notes too
  const canResolve = canEdit; // same as canEdit now that family can add
  const [showResolved, setShowResolved] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "household" as Category });
  const [discussingId, setDiscussingId] = useState<number | null>(null);

  const { data: notes = [], isLoading } = useQuery<MiscNote[]>({
    queryKey: ["/api/clients", selectedClientId, "notes"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/notes`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; body: string; category: string; authorId: number; createdAt: string }) =>
      apiRequest("POST", `/api/clients/${selectedClientId}/notes`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "notes"] });
      setDialogOpen(false);
      setForm({ title: "", body: "", category: "household" });
      toast({ title: "Note added", description: "Your miscellaneous note has been saved." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MiscNote> }) =>
      apiRequest("PATCH", `/api/notes/${id}`, data).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notes/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "notes"] });
      toast({ title: "Note deleted" });
    },
  });

  const discussMutation = useMutation({
    mutationFn: async (note: MiscNote) => {
      const threadRes = await apiRequest("POST", `/api/clients/${selectedClientId}/threads`, {
        name: `Note: ${note.title}`,
        members: JSON.stringify([activeUser.id]),
        createdByUserId: activeUser.id,
        isOpen: true,
        createdAt: new Date().toISOString(),
      });
      const thread = await threadRes.json();
      await apiRequest("POST", `/api/threads/${thread.id}/messages`, {
        senderId: activeUser.id,
        content: `📋 Discussing note: "${note.title}"\n\n${note.body}\n\nCategory: ${note.category} · Created ${new Date(note.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}. What are your thoughts?`,
        messageType: "text",
        priority: "green",
        sentAt: new Date().toISOString(),
        isRead: false,
        readByUserIds: JSON.stringify([activeUser.id]),
      });
      return thread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      setDiscussingId(null);
      toast({ title: "Thread created", description: "Opening the discussion in Messages." });
      window.location.hash = "#/messages";
    },
    onError: () => {
      setDiscussingId(null);
      toast({ title: "Error", description: "Could not create thread.", variant: "destructive" });
    },
  });

  const handleDiscuss = (note: MiscNote) => {
    setDiscussingId(note.id);
    discussMutation.mutate(note);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.body.trim()) return;
    createMutation.mutate({
      ...form,
      authorId: activeUser.id,
      createdAt: new Date().toISOString(),
    });
  };

  const active = notes.filter(n => !n.isResolved);
  const resolved = notes.filter(n => n.isResolved);

  const filterNotes = (list: MiscNote[]) =>
    filterCategory === "all" ? list : list.filter(n => n.category === filterCategory);

  const pinnedNotes = filterNotes(active).filter(n => n.isPinned);
  const unpinnedNotes = filterNotes(active).filter(n => !n.isPinned);

  const handleListenAll = () => {
    const allActive = filterNotes(active);
    if (allActive.length === 0) return;
    const text = allActive.map(n => `${n.title}: ${n.body}`).join(". Next note: ");
    speakText(text);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center flex-shrink-0">
            <StickyNote size={20} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("notes.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">Observations · Equipment · Safety</p>
          </div>
          <LessonLauncher pageKey="notes" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleListenAll}
            data-testid="notes-listen-all"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 flex-1 justify-center"
          >
            <Volume2 size={13} /> Listen
          </button>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" data-testid="add-note-button">
                  <Plus size={15} className="mr-1" /> {t("notes.add")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Miscellaneous Note</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v as Category }))}>
                      <SelectTrigger data-testid="note-category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="household">Household</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="safety">Safety</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Title</label>
                    <Input
                      placeholder="Brief description of the issue"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      data-testid="note-title-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Details</label>
                    <Textarea
                      placeholder="Describe what you observed, any actions taken, and what follow-up may be needed..."
                      value={form.body}
                      onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                      className="min-h-[100px]"
                      data-testid="note-body-input"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!form.title.trim() || !form.body.trim() || createMutation.isPending}
                      data-testid="note-submit-button"
                    >
                      {createMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "household", "equipment", "safety", "other"] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            data-testid={`filter-${cat}`}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
              filterCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            )}
          >
            {cat === "all" ? "All Notes" : CATEGORY_CONFIG[cat].label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filterNotes(active).length} active
        </span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Pinned notes */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Pin size={11} /> Pinned
          </h2>
          {pinnedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              canEdit={canEdit}
              canResolve={canResolve}
              onPin={(id, val) => updateMutation.mutate({ id, data: { isPinned: val } })}
              onResolve={(id, val) => updateMutation.mutate({ id, data: { isResolved: val, resolvedAt: val ? new Date().toISOString() : null } })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onDiscuss={handleDiscuss}
              isDiscussing={discussingId === note.id && discussMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Unpinned active notes */}
      {unpinnedNotes.length > 0 && (
        <div className="space-y-3">
          {pinnedNotes.length > 0 && (
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Other Active</h2>
          )}
          {unpinnedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              canEdit={canEdit}
              canResolve={canResolve}
              onPin={(id, val) => updateMutation.mutate({ id, data: { isPinned: val } })}
              onResolve={(id, val) => updateMutation.mutate({ id, data: { isResolved: val, resolvedAt: val ? new Date().toISOString() : null } })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onDiscuss={handleDiscuss}
              isDiscussing={discussingId === note.id && discussMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filterNotes(active).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <StickyNote size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No active notes</p>
          <p className="text-xs mt-1">
            Tap "Add Note" to record a household issue, equipment problem, or safety concern.
          </p>
        </div>
      )}

      {/* Resolved notes (collapsible) */}
      {resolved.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved(!showResolved)}
            data-testid="toggle-resolved"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {showResolved ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span>{showResolved ? "Hide" : "Show"} resolved notes ({resolved.length})</span>
          </button>
          {showResolved && (
            <div className="space-y-3 mt-2">
              {filterNotes(resolved).map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  canEdit={canEdit}
                  canResolve={canResolve}
                  onPin={(id, val) => updateMutation.mutate({ id, data: { isPinned: val } })}
                  onResolve={(id, val) => updateMutation.mutate({ id, data: { isResolved: val, resolvedAt: val ? new Date().toISOString() : null } })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onDiscuss={handleDiscuss}
                  isDiscussing={discussingId === note.id && discussMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
