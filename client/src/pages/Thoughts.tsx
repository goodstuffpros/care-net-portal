import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp, isCaregiverRole } from "@/App";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BookHeart, Plus, Lock, Unlock, Heart, Pencil, Trash2,
  ChevronDown, ChevronUp, Sparkles, Gift, X, Check
} from "lucide-react";
import type { ThoughtEntry } from "@shared/schema";
import ModuleIntro from "@/components/ModuleIntro";
import { LessonLauncher } from "@/components/LessonLauncher";

// ── Mood config ───────────────────────────────────────────────────────────────

const MOODS: { value: string; label: string; emoji: string; bg: string; text: string }[] = [
  { value: "reflective",   label: "Reflective",   emoji: "🌿", bg: "bg-teal-50 dark:bg-teal-950/30",     text: "text-teal-700 dark:text-teal-300" },
  { value: "joyful",       label: "Joyful",       emoji: "☀️", bg: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-700 dark:text-amber-400" },
  { value: "nostalgic",    label: "Nostalgic",    emoji: "📻", bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300" },
  { value: "peaceful",     label: "Peaceful",     emoji: "🕊️", bg: "bg-sky-50 dark:bg-sky-950/30",       text: "text-sky-700 dark:text-sky-300" },
  { value: "humorous",     label: "Humorous",     emoji: "😄", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  { value: "bittersweet",  label: "Bittersweet",  emoji: "🍂", bg: "bg-rose-50 dark:bg-rose-950/30",     text: "text-rose-700 dark:text-rose-300" },
];

function getMood(value?: string | null) {
  return MOODS.find(m => m.value === value) ?? null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

// ── Entry card (caregiver view) ───────────────────────────────────────────────

function ThoughtCard({
  entry,
  caregiverName,
  onEdit,
  onDelete,
}: {
  entry: ThoughtEntry;
  caregiverName: string;
  onEdit: (entry: ThoughtEntry) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mood = getMood(entry.mood);
  const PREVIEW_LEN = 220;
  const isLong = entry.body.length > PREVIEW_LEN;
  const displayBody = !isLong || expanded ? entry.body : entry.body.slice(0, PREVIEW_LEN) + "…";

  return (
    <div
      data-testid={`thought-card-${entry.id}`}
      className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
    >
      {/* Mood pill top-right */}
      {mood && (
        <div className={cn("absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", mood.bg, mood.text)}>
          <span>{mood.emoji}</span>
          <span>{mood.label}</span>
        </div>
      )}

      {/* Title + body */}
      <div className="pr-24">
        {entry.title && (
          <h3 className="font-semibold text-base text-foreground mb-1" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {entry.title}
          </h3>
        )}
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
          {displayBody}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1.5 text-xs text-primary hover:underline flex items-center gap-1"
          >
            {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read more</>}
          </button>
        )}
      </div>

      {/* Footer meta */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <span>{formatDate(entry.recordedAt)}</span>
          <span className="mx-1.5">·</span>
          <span>{caregiverName}</span>
          {entry.editedAt && <span className="ml-1.5 opacity-60">(edited)</span>}
        </div>
        {/* Edit / delete — hidden until hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            data-testid={`thought-edit-${entry.id}`}
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit entry"
          >
            <Pencil size={14} />
          </button>
          <button
            data-testid={`thought-delete-${entry.id}`}
            onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete entry"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Family read-only card (after unlock) ──────────────────────────────────────

function GiftCard({ entry }: { entry: ThoughtEntry }) {
  const [expanded, setExpanded] = useState(false);
  const mood = getMood(entry.mood);
  const PREVIEW_LEN = 300;
  const isLong = entry.body.length > PREVIEW_LEN;
  const displayBody = !isLong || expanded ? entry.body : entry.body.slice(0, PREVIEW_LEN) + "…";

  return (
    <div
      data-testid={`gift-card-${entry.id}`}
      className="relative bg-card border border-rose-100 dark:border-rose-900/30 rounded-2xl p-6 shadow-sm"
    >
      {mood && (
        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-3", mood.bg, mood.text)}>
          <span>{mood.emoji}</span>
          <span>{mood.label}</span>
        </div>
      )}
      {entry.title && (
        <h3 className="font-semibold text-lg text-foreground mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {entry.title}
        </h3>
      )}
      <p className="text-sm text-foreground/85 leading-loose whitespace-pre-line">
        {displayBody}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
        >
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read more</>}
        </button>
      )}
      <div className="mt-4 pt-3 border-t border-rose-100 dark:border-rose-900/30 text-xs text-muted-foreground">
        {formatDate(entry.recordedAt)}
      </div>
    </div>
  );
}

// ── Add / Edit dialog ─────────────────────────────────────────────────────────

interface EntryForm {
  title: string;
  body: string;
  mood: string;
  tags: string;
}

function EntryDialog({
  open,
  onClose,
  onSave,
  isSaving,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: EntryForm) => void;
  isSaving: boolean;
  initialValues?: Partial<EntryForm>;
}) {
  const [form, setForm] = useState<EntryForm>({
    title: initialValues?.title ?? "",
    body: initialValues?.body ?? "",
    mood: initialValues?.mood ?? "",
    tags: initialValues?.tags ?? "",
  });

  // Reset when dialog opens with new values
  const handleOpen = () => {
    setForm({
      title: initialValues?.title ?? "",
      body: initialValues?.body ?? "",
      mood: initialValues?.mood ?? "",
      tags: initialValues?.tags ?? "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg bg-white dark:bg-zinc-900" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookHeart size={18} className="text-primary" />
            {initialValues?.body ? "Edit Entry" : "New Entry"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Capture a memory, story, or thought shared by your client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title — optional */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Title <span className="normal-case font-normal">(optional)</span>
            </label>
            <Input
              data-testid="thought-title-input"
              placeholder="e.g. The summer of '58"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Body — required */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Entry <span className="text-red-500">*</span>
            </label>
            <Textarea
              data-testid="thought-body-input"
              placeholder="Write what your client shared — in their words, as best you can remember…"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Mood selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Mood
            </label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  data-testid={`mood-btn-${m.value}`}
                  onClick={() => setForm(f => ({ ...f, mood: f.mood === m.value ? "" : m.value }))}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    form.mood === m.value
                      ? cn(m.bg, m.text, "border-current shadow-sm scale-105")
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags — optional */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Tags <span className="normal-case font-normal">(comma-separated, optional)</span>
            </label>
            <Input
              data-testid="thought-tags-input"
              placeholder="e.g. family, childhood, faith"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving} data-testid="thought-cancel-btn">
              Cancel
            </Button>
            <Button
              onClick={() => onSave(form)}
              disabled={!form.body.trim() || isSaving}
              data-testid="thought-save-btn"
              className="gap-2"
            >
              {isSaving ? "Saving…" : initialValues?.body ? "Save Changes" : "Add Entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Unlock dialog ─────────────────────────────────────────────────────────────

function UnlockDialog({
  open,
  onClose,
  onConfirm,
  isUnlocking,
  entryCount,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  isUnlocking: boolean;
  entryCount: number;
}) {
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setConfirmed(false); setNote(""); } }}>
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift size={18} className="text-rose-500" />
            Gift This Collection to the Family
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            This will share all {entryCount} {entryCount === 1 ? "entry" : "entries"} with the family — a lasting gift of your client's words and memories. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Personal message */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Personal message to the family <span className="normal-case font-normal">(optional)</span>
            </label>
            <Textarea
              data-testid="unlock-note-input"
              placeholder="e.g. Your father shared these with me during our time together. I hope they bring you comfort and joy."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Confirm checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setConfirmed(c => !c)}
              data-testid="unlock-confirm-check"
              className={cn(
                "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                confirmed
                  ? "bg-rose-500 border-rose-500 text-white"
                  : "border-border group-hover:border-rose-400"
              )}
            >
              {confirmed && <Check size={12} />}
            </div>
            <span className="text-sm text-foreground/80 leading-snug">
              I understand that unlocking this collection is permanent and will make these entries visible to the family.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { onClose(); setConfirmed(false); setNote(""); }} disabled={isUnlocking}>
              Cancel
            </Button>
            <Button
              data-testid="unlock-confirm-btn"
              disabled={!confirmed || isUnlocking}
              onClick={() => onConfirm(note)}
              className="gap-2 bg-rose-500 hover:bg-rose-600 text-white border-0"
            >
              <Gift size={15} />
              {isUnlocking ? "Unlocking…" : "Gift to Family"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ThoughtsPage() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();

  const isCaregiver = isCaregiverRole(activeUser.role);
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery<ThoughtEntry[]>({
    queryKey: ["/api/clients", selectedClientId, "thoughts"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/thoughts`).then(r => r.json()),
  });

  const { data: unlockStatus } = useQuery<{ isUnlocked: boolean; unlockedAt: string | null; unlockNote: string | null }>({
    queryKey: ["/api/clients", selectedClientId, "thoughts", "unlock-status"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/thoughts/unlock-status-full`).then(r => r.json()),
  });

  const isUnlocked = unlockStatus?.isUnlocked ?? false;

  // Caregiver always sees all entries; family only sees them after unlock
  const visibleEntries = isCaregiver ? entries : (isUnlocked ? entries : []);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ThoughtEntry | null>(null);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/clients/${selectedClientId}/thoughts`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "thoughts"] });
      setShowAddDialog(false);
      toast({ title: "Entry added", description: "Your thought has been saved." });
    },
    onError: () => toast({ title: "Error", description: "Could not save entry.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/thoughts/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "thoughts"] });
      setEditingEntry(null);
      toast({ title: "Entry updated" });
    },
    onError: () => toast({ title: "Error", description: "Could not update entry.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/thoughts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "thoughts"] });
      setDeleteConfirmId(null);
      toast({ title: "Entry deleted" });
    },
    onError: () => toast({ title: "Error", description: "Could not delete entry.", variant: "destructive" }),
  });

  const unlockMutation = useMutation({
    mutationFn: (note: string) =>
      apiRequest("POST", `/api/clients/${selectedClientId}/thoughts/unlock`, {
        unlockedByUserId: activeUser.id,
        unlockNote: note || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "thoughts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "thoughts", "unlock-status"] });
      setShowUnlockDialog(false);
      toast({
        title: "Collection gifted",
        description: "The family can now read these memories.",
      });
    },
    onError: () => toast({ title: "Error", description: "Could not unlock collection.", variant: "destructive" }),
  });

  // ── Form helpers ──────────────────────────────────────────────────────────
  function buildPayload(form: { title: string; body: string; mood: string; tags: string }, extras?: object) {
    const tagsArr = form.tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    return {
      title: form.title.trim() || null,
      body: form.body.trim(),
      mood: form.mood || null,
      tags: tagsArr.length ? JSON.stringify(tagsArr) : null,
      ...extras,
    };
  }

  function handleCreate(form: { title: string; body: string; mood: string; tags: string }) {
    createMutation.mutate(
      buildPayload(form, {
        clientId: selectedClientId,
        recordedByUserId: activeUser.id,
        entryType: "text",
        recordedAt: new Date().toISOString(),
      })
    );
  }

  function handleUpdate(form: { title: string; body: string; mood: string; tags: string }) {
    if (!editingEntry) return;
    updateMutation.mutate({ id: editingEntry.id, data: buildPayload(form) });
  }

  // Find caregiver name from userId (approximation from demo data)
  function getCaregiverName(userId: number): string {
    const names: Record<number, string> = {
      1: "Becky M.", 2: "Marcus T.", 3: "Diana P.",
    };
    return names[userId] ?? "Caregiver";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Family: only visible after unlock — if not unlocked, render nothing (route doesn't appear in their nav)
  if (isFamily && !isUnlocked) return null;

  // ACCESS GATE: Family sees the gift view after unlock
  if (isFamily && isUnlocked) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-2xl mx-auto">
        {/* Gift header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/30 mb-4">
            <Gift size={30} className="text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            A Collection of Thoughts
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            A gift from your care team — memories, stories, and musings your loved one shared during their care journey.
          </p>
          {/* Unlock note */}
          {unlockStatus?.unlockNote && (
            <div className="mt-5 mx-auto max-w-sm bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl px-5 py-4 text-sm text-foreground/80 italic leading-relaxed">
              "{unlockStatus.unlockNote}"
            </div>
          )}
          {unlockStatus?.unlockedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Shared on {formatDate(unlockStatus.unlockedAt)}
            </p>
          )}
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : visibleEntries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No entries found.</p>
        ) : (
          <div className="space-y-5">
            {visibleEntries.map(entry => (
              <GiftCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* Hearts footer */}
        <div className="mt-12 text-center text-muted-foreground/40 flex justify-center gap-1.5">
          {[1,2,3,4,5].map(i => <Heart key={i} size={14} fill="currentColor" />)}
        </div>
      </div>
    );
  }

  // ── CAREGIVER VIEW ────────────────────────────────────────────────────────
  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
      <ModuleIntro moduleKey="thoughts" />
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <BookHeart size={22} className="text-primary" />
            <h1
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
              data-testid="thoughts-page-title"
            >
              A Collection of Thoughts
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Private journal of memories, stories, and musings — locked until care concludes.
          </p>
        </div>
        <LessonLauncher pageKey="thoughts" />

        {!isUnlocked && (
          <Button
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="gap-2 flex-shrink-0"
            data-testid="add-thought-btn"
          >
            <Plus size={15} />
            New Entry
          </Button>
        )}
      </div>

      {/* Locked badge */}
      {!isUnlocked && (
        <div className="flex items-center gap-2.5 mb-6 px-4 py-2.5 bg-muted/50 rounded-lg border border-border/60 text-sm text-muted-foreground">
          <Lock size={14} className="text-muted-foreground/70 flex-shrink-0" />
          <span>
            This collection is <strong>locked</strong> — only you and your care team can see it.
            When care concludes, you can gift it to the family.
          </span>
        </div>
      )}

      {/* Already unlocked banner */}
      {isUnlocked && (
        <div className="flex items-center gap-2.5 mb-6 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/40 text-sm text-emerald-700 dark:text-emerald-400">
          <Unlock size={14} className="flex-shrink-0" />
          <span>
            This collection has been gifted to the family.
            {unlockStatus?.unlockedAt && ` Shared on ${formatDate(unlockStatus.unlockedAt)}.`}
          </span>
        </div>
      )}

      {/* Entry list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Sparkles size={24} className="text-muted-foreground/50" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No entries yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            When your client shares a memory or story, tap <strong>New Entry</strong> to capture it before it fades.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <ThoughtCard
              key={entry.id}
              entry={entry}
              caregiverName={getCaregiverName(entry.recordedByUserId)}
              onEdit={e => setEditingEntry(e)}
              onDelete={id => setDeleteConfirmId(id)}
            />
          ))}
        </div>
      )}

      {/* Gift to family button — bottom, only if not yet unlocked and has entries */}
      {!isUnlocked && entries.length > 0 && (
        <div className="mt-10 border-t border-border pt-7 flex flex-col items-center text-center gap-3">
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            When care has concluded, you can gift this entire collection to the family as a lasting keepsake.
          </p>
          <Button
            data-testid="gift-collection-btn"
            variant="outline"
            className="gap-2 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300"
            onClick={() => setShowUnlockDialog(true)}
          >
            <Gift size={15} />
            Gift this collection to the family
          </Button>
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Add new */}
      <EntryDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleCreate}
        isSaving={createMutation.isPending}
      />

      {/* Edit */}
      <EntryDialog
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={handleUpdate}
        isSaving={updateMutation.isPending}
        initialValues={
          editingEntry
            ? {
                title: editingEntry.title ?? "",
                body: editingEntry.body,
                mood: editingEntry.mood ?? "",
                tags: editingEntry.tags
                  ? (() => { try { return JSON.parse(editingEntry.tags!).join(", "); } catch { return ""; } })()
                  : "",
              }
            : undefined
        }
      />

      {/* Unlock */}
      <UnlockDialog
        open={showUnlockDialog}
        onClose={() => setShowUnlockDialog(false)}
        onConfirm={note => unlockMutation.mutate(note)}
        isUnlocking={unlockMutation.isPending}
        entryCount={entries.length}
      />

      {/* Delete confirm */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={v => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              This memory will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="thought-delete-confirm-btn"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
