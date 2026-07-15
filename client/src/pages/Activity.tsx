import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ActivityLog, ActivityLogAddendum, Client, HealthHistoryEntry } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Plus, CheckCircle2, Circle, ClipboardList, Mic, MicOff, Pill, Utensils, Heart, Activity, Stethoscope, Eye, Loader2, Clock, CheckCheck, AlertTriangle, Siren, UserRound, Volume2, Search, X, Trash2, FilePenLine, ChevronDown, ChevronUp } from "lucide-react";
import { speakBecky } from "@/lib/ttsUtils";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, typeof ClipboardList> = {
  medication: Pill,
  hygiene: Heart,
  meal: Utensils,
  mood: Activity,
  medical: Stethoscope,
  general: ClipboardList,
};

const CATEGORY_COLORS: Record<string, string> = {
  medication: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  hygiene: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  meal: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  mood: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  medical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  general: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};


function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " today";
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const ADDENDUM_TAG_LABELS: Record<string, string> = {
  typo: "Typo / Spelling",
  incomplete: "Incomplete Entry",
  wrong_data: "Wrong Data",
  additional_detail: "Additional Detail",
  timing_correction: "Timing Correction",
};

function AddendumSection({ logId, currentUserId, logAuthorId }: { logId: number; currentUserId: number; logAuthorId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const isAuthor = currentUserId === logAuthorId;

  const { data: addendums = [], refetch } = useQuery<ActivityLogAddendum[]>({
    queryKey: ["/api/activity/addendums", logId],
    queryFn: () => apiRequest("GET", `/api/activity/${logId}/addendums`).then(r => r.json()),
    enabled: open,
    staleTime: 30000,
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/activity/${logId}/addendums`, { tag, note }),
    onSuccess: () => {
      setNote(""); setTag(""); setShowForm(false);
      refetch();
      toast({ title: "Addendum saved" });
    },
    onError: () => toast({ title: "Failed to save addendum", variant: "destructive" }),
  });

  return (
    <div className="mt-2 border-t border-border/30 pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <FilePenLine size={11} />
        {open ? <><ChevronUp size={11} /> Hide addendums</> : <><ChevronDown size={11} /> {addendums.length > 0 ? `${addendums.length} addendum${addendums.length > 1 ? "s" : ""}` : "Addendums"}</>}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Existing addendums */}
          {addendums.map(a => (
            <div key={a.id} className="ml-3 pl-3 border-l-2 border-amber-400/40 space-y-0.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                {ADDENDUM_TAG_LABELS[a.tag] ?? a.tag}
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">{a.note}</p>
              <p className="text-[10px] text-muted-foreground/60">{new Date(a.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          ))}

          {/* Add Note button — original author only */}
          {isAuthor && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="ml-3 text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus size={11} /> Add note
            </button>
          )}

          {/* Addendum form */}
          {isAuthor && showForm && (
            <div className="ml-3 space-y-2 pt-1">
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADDENDUM_TAG_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add your note here…"
                className="text-xs min-h-[64px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!tag || !note.trim() || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowForm(false); setTag(""); setNote(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { activeUser, selectedClientId, isRealSession, clientPermissionLevel, isClientPortal } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const isContributor = isClientPortal && (clientPermissionLevel === "contributor" || clientPermissionLevel === "self_care_mc");
  const [addOpen, setAddOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Voice: "Hey Care Net, open new care log entry" — auto-opens the form
  useEffect(() => {
    const handler = () => setAddOpen(true);
    window.addEventListener("voice:open-log", handler);
    return () => window.removeEventListener("voice:open-log", handler);
  }, []);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(val.trim()), 350);
  }
  function clearSearch() {
    setSearchInput("");
    setSearchQuery("");
  }
  const [discussingId, setDiscussingId] = useState<number | null>(null);
  const [excuseDialogId, setExcuseDialogId] = useState<number | null>(null);
  const [excuseNote, setExcuseNote] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Helper: extract first sentence from a description
  const firstSentence = (text: string): string => {
    const match = text.match(/^[^.!?]*[.!?]/);
    return match ? match[0].trim() : text.slice(0, 80).trim() + (text.length > 80 ? "…" : "");
  };
  const canEdit = activeUser.role === "caregiver" || activeUser.role === "self_care" || isContributor;
  const { isTemporarilyElevated } = useApp();
  const isFamilyPrimary = activeUser.role === "primary_family" || activeUser.role === "self_care" || isTemporarilyElevated;
  const isFamily = activeUser.role === "primary_family" || activeUser.role === "secondary_family";

  // Health history entries for the "link to event" picker
  const { data: healthHistory = [] } = useQuery<HealthHistoryEntry[]>({
    queryKey: ["/api/clients", selectedClientId, "health-history"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/health-history`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  const [form, setForm] = useState({
    title: "", description: "", priority: "green", category: "general", healthHistoryEntryId: null as number | null,
  });

  // MC Log Entry state
  const [mcLogOpen, setMcLogOpen] = useState(false);
  const [mcLogForm, setMcLogForm] = useState({
    title: "",
    description: "",
    priority: "green",
    category: "general",
    isEmergency: false,
    emergencyType: "fall",
    notes: "",
    healthHistoryEntryId: null as number | null,
  });

  const mcLogMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/activity`, {
      title: mcLogForm.title,
      description: mcLogForm.description,
      priority: mcLogForm.isEmergency ? "red" : mcLogForm.priority,
      category: mcLogForm.category,
      loggedByRole: activeUser.role,
      loggedByUserId: activeUser.id,
      isEmergency: mcLogForm.isEmergency,
      emergencyType: mcLogForm.isEmergency ? mcLogForm.emergencyType : null,
      notes: mcLogForm.notes,
      healthHistoryEntryId: mcLogForm.healthHistoryEntryId || null,
      loggedAt: new Date().toISOString(),
      isChecked: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      setMcLogOpen(false);
      setMcLogForm({ title: "", description: "", priority: "green", category: "general", isEmergency: false, emergencyType: "fall", notes: "", healthHistoryEntryId: null });
      toast({
        title: mcLogForm.isEmergency ? "🚨 Emergency entry logged" : "Entry logged",
        description: mcLogForm.isEmergency
          ? "Caregiver has been urgently notified. An emergency thread has been created."
          : "Your log entry has been added. The caregiver has been notified.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save entry. Please try again.", variant: "destructive" });
    },
  });

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/clients", selectedClientId, "activity"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/activity`).then(r => r.json()),
  });

  // Search query — fires when searchQuery has 2+ chars
  const isSearching = searchQuery.length >= 2;
  const { data: searchResults = [], isFetching: searchFetching } = useQuery<(ActivityLog & { loggedByName: string })[]>({
    queryKey: ["/api/clients", selectedClientId, "activity", "search", searchQuery],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/activity/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()),
    enabled: isSearching && !!selectedClientId,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);

  // All portal users for this client — used to auto-populate discuss threads
  const { data: portalUsers = [] } = useQuery<{ id: number }[]>({
    queryKey: ["/api/clients", selectedClientId, "family"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/family`).then(r => r.json()),
    enabled: !!selectedClientId,
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/activity`, {
      ...form,
      loggedByUserId: activeUser.id,
      loggedAt: new Date().toISOString(),
      isChecked: false,
      healthHistoryEntryId: form.healthHistoryEntryId || null,
      // Phase 2: tag self_care contributor entries
      ...(isContributor ? { loggedByRole: "self_care" } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
      setAddOpen(false);
      setForm({ title: "", description: "", priority: "green", category: "general", healthHistoryEntryId: null });
      toast({ title: isContributor ? "Added to your record" : "Activity logged", description: isContributor ? "Your entry was saved." : "Entry added to activity log." });
    },
  });

  const checkMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/activity/${id}`, { isChecked: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] }),
  });

  const excuseMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiRequest("POST", `/api/activity/${id}/excuse`, { excuseNote: note, excusedByUserId: activeUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
      setExcuseDialogId(null);
      setExcuseNote("");
      toast({ title: "Flag excused", description: "This late entry has been marked as excused and will not affect the caregiver rating." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/activity/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
      setDeleteConfirmId(null);
      toast({ title: "Entry deleted", description: "The care log entry has been removed." });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  // Phase 2: MC approves a pending-review entry from a minor contributor
  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/activity/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "activity"] });
      toast({ title: "Entry approved", description: "The entry is now visible to the care team." });
    },
    onError: () => toast({ title: "Approval failed", variant: "destructive" }),
  });

  const discussMutation = useMutation({
    mutationFn: async (log: ActivityLog) => {
      const allMemberIds = portalUsers.length > 0 ? portalUsers.map((u: { id: number }) => u.id) : [activeUser.id];
      // 1. Create a new thread named after the entry
      const threadRes = await apiRequest("POST", `/api/clients/${selectedClientId}/threads`, {
        name: `Discuss: ${log.title}`,
        members: JSON.stringify(allMemberIds),
        createdByUserId: activeUser.id,
        isOpen: true,
        createdAt: new Date().toISOString(),
      });
      const thread = await threadRes.json();
      // 2. Post the quoted entry as the first message
      await apiRequest("POST", `/api/threads/${thread.id}/messages`, {
        senderId: activeUser.id,
        content: `📋 Re: "${log.title}"\n\n${log.description ? log.description + "\n\n" : ""}Logged by caregiver${log.loggedAt ? " at " + new Date(log.loggedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}. What are your thoughts?`,
        messageType: "text",
        priority: log.priority || "green",
        sentAt: new Date().toISOString(),
        isRead: false,
        readByUserIds: JSON.stringify([activeUser.id]),
      });
      return thread;
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "threads"] });
      setDiscussingId(null);
      toast({ title: "Thread created", description: "Opening the new discussion in Messages." });
      // Navigate to messages — the new thread will appear at the top
      window.location.hash = "#/messages";
    },
    onError: () => {
      setDiscussingId(null);
      toast({ title: "Error", description: "Could not create thread. Please try again.", variant: "destructive" });
    },
  });

  const toggleVoice = (field: "title" | "description") => {
    if (!isRecording && "webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setForm(f => ({ ...f, [field]: f[field] ? f[field] + " " + text : text }));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    }
  };

  const filtered = logs.filter(l =>
    (filterPriority === "all" || (filterPriority === "checked" ? l.isChecked : l.priority === filterPriority)) &&
    (filterCategory === "all" || l.category === filterCategory)
  );

  const stats = {
    red: logs.filter(l => l.priority === "red").length,
    yellow: logs.filter(l => l.priority === "yellow").length,
    green: logs.filter(l => l.priority === "green").length,
    checked: logs.filter(l => l.isChecked).length,
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <ClipboardList size={20} className="text-orange-600 dark:text-orange-400" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("activity.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">{t("activity.subtitle")}</p>
          </div>
        </div>

        {/* MC Log Entry Button */}
        {isFamilyPrimary && (
          <Dialog open={mcLogOpen} onOpenChange={setMcLogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 w-full bg-teal-600 hover:bg-teal-700 text-white"
                data-testid="mc-add-log-btn"
              >
                <Plus size={16} /> Add Family Log Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserRound size={16} className="text-violet-600" /> Family Log Entry
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Emergency Banner */}
                {mcLogForm.isEmergency && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 px-3 py-2.5 flex items-start gap-2">
                    <Siren size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                      <span className="font-semibold block">Emergency mode active</span>
                      Priority is set to Urgent. Caregiver will receive an immediate alert and an emergency message thread will be created automatically.
                    </div>
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1.5">
                  <Label>Entry Title <span className="text-red-500">*</span></Label>
                  <Input
                    value={mcLogForm.title}
                    onChange={e => setMcLogForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Client had a fall at 7pm"
                    data-testid="mc-log-title-input"
                  />
                </div>

                {/* Category + Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={mcLogForm.category} onValueChange={v => setMcLogForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger data-testid="mc-log-category-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="meal">Meal / Nutrition</SelectItem>
                        <SelectItem value="hygiene">Hygiene</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="mood">Mood / Behavior</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={mcLogForm.isEmergency ? "red" : mcLogForm.priority}
                      onValueChange={v => setMcLogForm(f => ({ ...f, priority: v }))}
                      disabled={mcLogForm.isEmergency}
                    >
                      <SelectTrigger data-testid="mc-log-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">🔴 Urgent</SelectItem>
                        <SelectItem value="yellow">🟡 Important</SelectItem>
                        <SelectItem value="green">🟢 Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={mcLogForm.description}
                    onChange={e => setMcLogForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe what happened..."
                    rows={3}
                    data-testid="mc-log-description-input"
                  />
                </div>

                {/* Emergency Toggle */}
                <div className={cn(
                  "rounded-lg border p-3 space-y-3 transition-colors",
                  mcLogForm.isEmergency
                    ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                    : "border-border bg-muted/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className={mcLogForm.isEmergency ? "text-red-600" : "text-muted-foreground"} />
                      <span className={cn("text-sm font-medium", mcLogForm.isEmergency ? "text-red-700 dark:text-red-400" : "")}>
                        This is an emergency
                      </span>
                    </div>
                    <Switch
                      checked={mcLogForm.isEmergency}
                      onCheckedChange={v => setMcLogForm(f => ({ ...f, isEmergency: v, priority: v ? "red" : f.priority }))}
                      data-testid="mc-log-emergency-toggle"
                    />
                  </div>
                  {mcLogForm.isEmergency && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-red-700 dark:text-red-400">Emergency Type</Label>
                      <Select value={mcLogForm.emergencyType} onValueChange={v => setMcLogForm(f => ({ ...f, emergencyType: v }))}>
                        <SelectTrigger className="border-red-300 dark:border-red-700" data-testid="mc-log-emergency-type-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fall">🩹 Fall</SelectItem>
                          <SelectItem value="er_visit">🚨 ER Visit</SelectItem>
                          <SelectItem value="hospital_admission">🏥 Hospital Admission</SelectItem>
                          <SelectItem value="medical_event">💊 Acute Medical Event</SelectItem>
                          <SelectItem value="other">⚠️ Other Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Link to health event */}
                {healthHistory.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Link to health event <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Select
                      value={mcLogForm.healthHistoryEntryId ? String(mcLogForm.healthHistoryEntryId) : "none"}
                      onValueChange={v => setMcLogForm(f => ({ ...f, healthHistoryEntryId: v === "none" ? null : Number(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {healthHistory.map((h: HealthHistoryEntry) => (
                          <SelectItem key={h.id} value={String(h.id)}>{h.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Additional Notes */}
                <div className="space-y-1.5">
                  <Label>Additional Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    value={mcLogForm.notes}
                    onChange={e => setMcLogForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional context for the caregiver..."
                    rows={2}
                    data-testid="mc-log-notes-input"
                  />
                </div>

                <Button
                  className={cn(
                    "w-full gap-2",
                    mcLogForm.isEmergency
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-violet-600 hover:bg-violet-700 text-white"
                  )}
                  onClick={() => mcLogMutation.mutate()}
                  disabled={!mcLogForm.title.trim() || mcLogMutation.isPending}
                  data-testid="mc-log-submit-btn"
                >
                  {mcLogMutation.isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                    : mcLogForm.isEmergency
                      ? <><Siren size={14} /> Log Emergency Entry</>
                      : <><Plus size={14} /> Log Entry</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className={`gap-1.5 w-full text-white ${isContributor ? "bg-emerald-600 hover:bg-emerald-700" : "bg-teal-600 hover:bg-teal-700"}`}
                data-testid="add-activity-btn"
              >
                <Plus size={16} /> {isContributor ? "Add to My Record" : t("activity.addEntry")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{isContributor ? "Add to My Care Record" : "Log Activity"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Activity Title
                    <button onClick={() => toggleVoice("title")} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Voice</>}
                    </button>
                  </Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Morning medications given" data-testid="activity-title-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger data-testid="activity-category-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="meal">Meal / Nutrition</SelectItem>
                        <SelectItem value="hygiene">Hygiene</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="mood">Mood / Behavior</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger data-testid="activity-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">🔴 Urgent</SelectItem>
                        <SelectItem value="yellow">🟡 Important</SelectItem>
                        <SelectItem value="green">🟢 Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Description
                    <button onClick={() => toggleVoice("description")} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Voice</>}
                    </button>
                  </Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add details — or use voice to speak your notes..." rows={4} data-testid="activity-description-input" />
                </div>
                {healthHistory.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Link to health event <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Select
                      value={form.healthHistoryEntryId ? String(form.healthHistoryEntryId) : "none"}
                      onValueChange={v => setForm(f => ({ ...f, healthHistoryEntryId: v === "none" ? null : Number(v) }))}
                    >
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {healthHistory.map((h: HealthHistoryEntry) => (
                          <SelectItem key={h.id} value={String(h.id)}>{h.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.title || addMutation.isPending} data-testid="save-activity-btn">
                  {addMutation.isPending ? "Logging..." : "Log Activity"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search care log entries..."
          className="pl-8 pr-8 h-9 text-sm"
          data-testid="carelog-search-input"
        />
        {searchInput && (
          <button
            onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {isSearching && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {searchFetching
              ? "Searching..."
              : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`
            }
          </p>
          {!searchFetching && searchResults.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No entries found matching "{searchQuery}"
            </div>
          )}
          {searchResults.map(log => {
            const Icon = CATEGORY_ICONS[log.category] || ClipboardList;
            return (
              <Card key={log.id} className="border border-border">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Icon size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        <Highlight text={log.title} query={searchQuery} />
                      </p>
                      {log.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <Highlight text={log.description} query={searchQuery} />
                        </p>
                      )}
                      {log.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <Highlight text={log.notes} query={searchQuery} />
                        </p>
                      )}
                    </div>
                    <PriorityBadge priority={log.priority} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTime(log.loggedAt)}</span>
                    <span>·</span>
                    <span>{(log as any).loggedByName ?? "Unknown"}</span>
                    <span className={cn("ml-auto px-1.5 py-0.5 rounded text-xs capitalize", CATEGORY_COLORS[log.category])}>
                      {log.category}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Priority filter pills — counts embedded, replaces stat cards — hidden while searching */}
      {!isSearching && (
      <div className="__search_filter_wrapper">
      <div className="space-y-2">
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex gap-2 min-w-max">
            {[
              { p: "all",    label: "All",       count: logs.length,   activeClass: "bg-foreground text-background border-foreground",                                                             inactiveClass: "bg-background border-border text-muted-foreground hover:text-foreground" },
              { p: "red",    label: "Urgent",    count: stats.red,     activeClass: "bg-red-500 text-white border-red-500",     inactiveClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50" },
              { p: "yellow", label: "Important", count: stats.yellow,  activeClass: "bg-amber-500 text-white border-amber-500", inactiveClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50" },
              { p: "green",  label: "Normal",    count: stats.green,   activeClass: "bg-emerald-500 text-white border-emerald-500", inactiveClass: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50" },
              { p: "checked",label: "Checked",   count: stats.checked, activeClass: "bg-primary text-primary-foreground border-primary", inactiveClass: "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10" },
            ].map(({ p, label, count, activeClass, inactiveClass }) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={cn(
                  "flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap",
                  filterPriority === p ? activeClass : inactiveClass
                )}
                data-testid={`priority-filter-${p}`}
              >
                <span>{label}</span>
                <span className={cn(
                  "min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-bold px-1",
                  filterPriority === p ? "bg-white/20" : "bg-black/8 dark:bg-white/10"
                )}>{count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex gap-1.5 min-w-max">
            {["all", "medication", "meal", "medical", "general"].map(c => (
              <button key={c} onClick={() => setFilterCategory(c)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                  filterCategory === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
                )} data-testid={`category-filter-${c}`}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log Entries */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No activity logged yet</p>
          <p className="text-sm mt-1">{canEdit ? "Tap 'Log Activity' or use voice to add your first entry." : "No entries found."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const Icon = CATEGORY_ICONS[log.category] || ClipboardList;
            const seenBy: string[] = []; // future: pull from DB via read-receipts API
            return (
              <div
                key={log.id}
                className={cn(
                  "p-4 rounded-xl border bg-card transition-all relative overflow-hidden",
                  (log as any).isEmergency
                    ? "border-red-400 dark:border-red-700 shadow-[0_0_0_1px_rgb(248_113_113/0.3)] emergency-pulse-border"
                    : (log as any).isOffShiftEntry
                      ? "border-l-4 border-l-amber-400 dark:border-l-amber-600"
                      : (log as any).loggedByRole === "primary_family" || (log as any).loggedByRole === "secondary_family"
                        ? "border-l-4 border-l-violet-400 dark:border-l-violet-600"
                        : (log as any).loggedByRole === "self_care"
                          ? "border-l-4 border-l-emerald-400 dark:border-l-emerald-600"
                          : ""
                )}
                data-testid={`activity-card-${log.id}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon + status stacked */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", CATEGORY_COLORS[log.category])}>
                      <Icon size={16} />
                    </div>
                    {/* Status below icon */}
                    {canEdit && !log.isChecked ? (
                      <button
                        onClick={() => checkMutation.mutate(log.id)}
                        className="w-7 h-7 rounded-full border-2 border-border hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                        data-testid={`check-activity-${log.id}`}
                      >
                        <Circle size={13} className="text-muted-foreground" />
                      </button>
                    ) : log.isChecked ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-white" />
                      </div>
                    ) : null}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.title}</span>
                      <PriorityBadge priority={log.priority} />
                      {/* Emergency badge */}
                      {(log as any).isEmergency && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                          <Siren size={9} /> Emergency
                        </span>
                      )}
                      {/* Off-shift badge (non-emergency) */}
                      {(log as any).isOffShiftEntry && !(log as any).isEmergency && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                          <Clock size={9} /> Off-Shift
                        </span>
                      )}
                      {/* Family log badge */}
                      {((log as any).loggedByRole === "primary_family" || (log as any).loggedByRole === "secondary_family") && !((log as any).isEmergency) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800">
                          <UserRound size={9} /> Family Log
                        </span>
                      )}
                      {/* Self-reported badge (self_care contributor entries) */}
                      {(log as any).loggedByRole === "self_care" && !(log as any).pendingReview && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                          <UserRound size={9} /> Self-reported
                        </span>
                      )}
                      {/* Pending review badge (minor contributor, MC approval on) */}
                      {(log as any).pendingReview && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                          <Clock size={9} /> Pending review
                        </span>
                      )}
                      {/* Emergency type label */}
                      {(log as any).isEmergency && (log as any).emergencyType && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                          {{
                            fall: "🩹 Fall",
                            er_visit: "🚨 ER Visit",
                            hospital_admission: "🏥 Hospital Admission",
                            medical_event: "💊 Acute Medical Event",
                            other: "⚠️ Emergency",
                          }[(log as any).emergencyType as string] || (log as any).emergencyType}
                        </span>
                      )}
                      {log.isLateEntry && !log.isExcused && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800">
                          <Clock size={9} /> {t("activity.late")}
                        </span>
                      )}
                      {log.isLateEntry && log.isExcused && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                          <CheckCheck size={9} /> {t("activity.excused")}
                        </span>
                      )}
                    </div>
                    {log.description && (() => {
                      const isCollapsed = log.isChecked && !expandedIds.has(log.id);
                      const preview = firstSentence(log.description);
                      const hasMore = log.description.trim() !== preview.replace(/…$/, "").trim() &&
                                      log.description.length > preview.replace(/…$/, "").length;
                      return (
                        <div className="mt-1">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {isCollapsed ? preview : log.description}
                          </p>
                          {isCollapsed && hasMore && (
                            <button
                              onClick={() => toggleExpanded(log.id)}
                              className="text-xs text-primary font-medium hover:underline mt-0.5"
                            >
                              See more
                            </button>
                          )}
                          {!isCollapsed && log.isChecked && (
                            <button
                              onClick={() => toggleExpanded(log.id)}
                              className="text-xs text-muted-foreground hover:underline mt-0.5 block"
                            >
                              See less
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted-foreground">{formatTime(log.loggedAt)}</span>
                      {log.description && (
                        <button
                          onClick={() => speakBecky(`${log.title}. ${log.description}`)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          title="Listen to this entry"
                        >
                          <Volume2 size={11} /> Listen
                        </button>
                      )}
                    </div>
                    {log.isExcused && log.excuseNote && (
                      <div className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-md px-2.5 py-1.5 leading-relaxed">
                        <span className="font-semibold">Excuse note:</span> {log.excuseNote}
                      </div>
                    )}

                    {/* Seen by */}
                    {seenBy.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Eye size={10} />
                        <span>Seen by {seenBy.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Addendum section — visible to anyone with portal access */}
                <AddendumSection
                  logId={log.id}
                  currentUserId={activeUser.id}
                  logAuthorId={log.loggedByUserId}
                />

                {/* Bottom action row — family and CG */}
                {(isFamily || isCaregiverRole(activeUser.role)) && (
                  <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
                    {/* Approve pending-review entry (minor contributor) — MC only */}
                    {isFamilyPrimary && (log as any).pendingReview ? (
                      <button
                        onClick={() => approveMutation.mutate(log.id)}
                        disabled={approveMutation.isPending}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5 font-medium disabled:opacity-60"
                        data-testid={`approve-activity-${log.id}`}
                      >
                        <CheckCircle2 size={11} /> Approve entry
                      </button>
                    ) : activeUser.role === "primary_family" && log.isLateEntry && !log.isExcused ? (
                      <button
                        onClick={() => { setExcuseDialogId(log.id); setExcuseNote(""); }}
                        className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline flex items-center gap-1.5"
                        data-testid={`excuse-flag-${log.id}`}
                      >
                        <Clock size={11} /> {t("activity.excuse")}
                      </button>
                    ) : <span />}

                    {isFamily && (
                      <button
                        onClick={() => {
                          setDiscussingId(log.id);
                          discussMutation.mutate(log);
                        }}
                        disabled={discussingId === log.id && discussMutation.isPending}
                        className="text-xs text-primary hover:underline flex items-center gap-1.5 disabled:opacity-60"
                        data-testid={`discuss-activity-${log.id}`}
                      >
                        {discussingId === log.id && discussMutation.isPending
                          ? <><Loader2 size={11} className="animate-spin" /> Creating thread...</>
                          : <>💬 Discuss with family</>}
                      </button>
                    )}

                    {/* Delete — MC or CG only */}
                    {(isFamilyPrimary || isCaregiverRole(activeUser.role)) && (
                      <button
                        onClick={() => setDeleteConfirmId(log.id)}
                        className="text-xs text-red-500/70 hover:text-red-600 hover:underline flex items-center gap-1 ml-auto"
                        data-testid={`delete-activity-${log.id}`}
                        title="Delete this entry"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Excuse Flag Dialog */}
      <Dialog open={excuseDialogId !== null} onOpenChange={open => { if (!open) { setExcuseDialogId(null); setExcuseNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock size={16} className="text-yellow-500" /> Excuse Late Entry Flag
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Adding an excuse note will clear this flag and prevent it from affecting the caregiver's rating. Please briefly explain the context.
            </p>
            <div className="space-y-1.5">
              <Label>{t("activity.excuseReason")} <span className="text-red-500">*</span></Label>
              <Textarea
                value={excuseNote}
                onChange={e => setExcuseNote(e.target.value)}
                placeholder="e.g. Doctor appointment ran late, Robert needed extra rest this morning, traffic delay..."
                rows={3}
                data-testid="excuse-note-input"
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!excuseNote.trim() || excuseMutation.isPending}
              onClick={() => excuseDialogId !== null && excuseMutation.mutate({ id: excuseDialogId, note: excuseNote.trim() })}
              data-testid="submit-excuse-btn"
            >
              {excuseMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><CheckCheck size={14} /> {t("activity.excuseConfirm")}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 size={16} className="text-red-500" /> Delete care log entry?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will permanently remove this entry from the care log. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={deleteMutation.isPending}
                onClick={() => deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)}
                data-testid="confirm-delete-activity-btn"
              >
                {deleteMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete entry</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      )}
    </div>
  );
}

// Highlights matching text within a string
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
