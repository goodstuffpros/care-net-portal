import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Check, X, BookHeart, AlertTriangle, ChevronDown, ChevronUp, Save, Users, Clock, CheckCircle2, XCircle, Mail, MessageCircleHeart, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LibraryItem {
  id: number;
  theme: string;
  examplePrompt: string;
  response: string;
  isPlaceholder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

const THEME_LABELS: Record<string, string> = {
  burnout: "Exhaustion / Burnout",
  family_stress: "Personal Life Bleeding In",
  difficult_family: "Difficult Family Dynamics",
  client_decline: "Hard Client Moments / Grief",
  personal_crisis: "Caregiver Personal Crisis",
  lonely: "Loneliness / Feeling Unseen",
  unappreciated: "Feeling Unappreciated",
  general: "General / Unspecified",
};

function themeLabel(theme: string) {
  return THEME_LABELS[theme] || theme.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Entry Card ────────────────────────────────────────────────────────────────
function EntryCard({ item, onSaved, onDeleted }: {
  item: LibraryItem;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(item.isPlaceholder === 1);
  const [prompt, setPrompt] = useState(item.examplePrompt);
  const [response, setResponse] = useState(item.response);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LibraryItem>) =>
      apiRequest("PATCH", `/api/becky-library/${item.id}`, data).then(r => r.json()),
    onSuccess: () => {
      setEditing(false);
      onSaved();
      toast({ title: "Saved", description: "Response updated successfully." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/becky-library/${item.id}`).then(r => r.json()),
    onSuccess: () => {
      onDeleted();
      toast({ title: "Deleted", description: "Entry removed from the library." });
    },
  });

  const toggleActive = () => {
    apiRequest("PATCH", `/api/becky-library/${item.id}`, { isActive: item.isActive ? 0 : 1 })
      .then(() => onSaved());
  };

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      item.isPlaceholder ? "border-amber-300 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/10" :
        "border-border bg-card",
      !item.isActive && "opacity-50"
    )}>
      {/* Card header */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={() => !editing && setExpanded(v => !v)}
      >
        {item.isPlaceholder ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full border border-amber-300 dark:border-amber-700/40">
            <AlertTriangle size={9} /> Placeholder
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-0.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <Check size={9} /> Becky's
          </div>
        )}
        <p className="flex-1 text-sm text-muted-foreground italic leading-snug line-clamp-2">
          "{item.examplePrompt}"
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {editing ? (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Example Caregiver Prompt</label>
                <Textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                  placeholder="Example caregiver message that would match this response..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Becky's Response</label>
                <Textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  rows={8}
                  className="text-sm resize-none"
                  placeholder="Write your response here, in your own voice..."
                />
                <p className="text-xs text-muted-foreground mt-1">{response.length} characters</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({
                    examplePrompt: prompt,
                    response,
                    isPlaceholder: 0,
                  })}
                  disabled={updateMutation.isPending || !prompt.trim() || !response.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Save size={13} /> {updateMutation.isPending ? "Saving..." : "Save Response"}
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { setEditing(false); setPrompt(item.examplePrompt); setResponse(item.response); }}
                  className="gap-1"
                >
                  <X size={13} /> Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Becky's Response</div>
                <p className="text-sm leading-relaxed text-foreground">{item.response}</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm" variant="outline"
                  onClick={() => setEditing(true)}
                  className="gap-1.5 text-xs"
                >
                  <Pencil size={12} /> {item.isPlaceholder ? "Write My Version" : "Edit"}
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={toggleActive}
                  className={cn("gap-1.5 text-xs", item.isActive ? "text-muted-foreground" : "text-emerald-600")}
                >
                  {item.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="gap-1.5 text-xs text-destructive hover:text-destructive ml-auto"
                >
                  <Trash2 size={12} /> Delete
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Entry Form ─────────────────────────────────────────────────────────────
function NewEntryForm({ themes, onSaved }: { themes: string[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("general");
  const [customTheme, setCustomTheme] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: { theme: string; examplePrompt: string; response: string }) =>
      apiRequest("POST", "/api/becky-library", data).then(r => r.json()),
    onSuccess: () => {
      setOpen(false);
      setPrompt(""); setResponse(""); setCustomTheme("");
      onSaved();
      toast({ title: "Added", description: "New response added to the library." });
    },
  });

  const finalTheme = theme === "__custom__" ? customTheme.trim() : theme;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus size={16} /> Add New Response
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Plus size={14} /> New Response Entry
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Theme</label>
        <select
          value={theme}
          onChange={e => setTheme(e.target.value)}
          className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2"
        >
          {themes.map(t => (
            <option key={t} value={t}>{themeLabel(t)}</option>
          ))}
          <option value="__custom__">+ Create new theme...</option>
        </select>
        {theme === "__custom__" && (
          <Input
            value={customTheme}
            onChange={e => setCustomTheme(e.target.value)}
            placeholder="New theme name (e.g. boundary_setting)"
            className="mt-2 text-sm"
          />
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Example Caregiver Prompt</label>
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          className="text-sm resize-none"
          placeholder="What might a caregiver say that should get this response?"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Your Response</label>
        <Textarea
          value={response}
          onChange={e => setResponse(e.target.value)}
          rows={8}
          className="text-sm resize-none"
          placeholder="Write your response in your own voice..."
        />
        <p className="text-xs text-muted-foreground mt-1">{response.length} characters</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => createMutation.mutate({ theme: finalTheme, examplePrompt: prompt, response })}
          disabled={createMutation.isPending || !prompt.trim() || !response.trim() || (theme === "__custom__" && !customTheme.trim())}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <Save size={13} /> {createMutation.isPending ? "Saving..." : "Save to Library"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="gap-1">
          <X size={13} /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Application Types ────────────────────────────────────────────────────────
interface BetaApplication {
  id: number;
  name: string;
  email: string;
  role: string;
  currentlyInCare: string;
  intent: string;
  agreedToConfidentiality: number;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  emailVerified?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  caregiver: "Professional Caregiver",
  family: "Family / Main Contact",
  both: "Family Caregiver",
  other: "Other",
};

const CARE_LABELS: Record<string, string> = {
  yes: "Currently in care",
  no: "Not currently",
  soon: "Starting soon",
};

function ApplicationCard({ app, onRefresh }: { app: BetaApplication; onRefresh: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(app.status === "pending");

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/applications/${app.id}/approve`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Approved", description: `Invite sent to ${app.email}` });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const denyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/applications/${app.id}/deny`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Denied", description: `Denial email sent to ${app.email}` });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = app.status === "pending" ? "border-amber-700/40 bg-amber-950/20"
    : app.status === "approved" ? "border-emerald-700/40 bg-emerald-950/20"
    : "border-red-900/40 bg-red-950/20";

  return (
    <div className={cn("rounded-xl border transition-all", statusColor)}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold truncate">{app.name}</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide",
              app.status === "pending" ? "bg-amber-500/20 text-amber-300"
                : app.status === "approved" ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300"
            )}>
              {app.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
              <span className="text-white/40 text-xs truncate">{app.email}</span>
              {app.emailVerified
                ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold uppercase tracking-wide flex-shrink-0">Verified</span>
                : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 font-semibold uppercase tracking-wide flex-shrink-0">Unverified</span>
              }
            </div>
        </div>
        <div className="text-white/30 text-xs flex-shrink-0">
          {new Date(app.createdAt).toLocaleDateString()}
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">Role</div>
              <div className="text-white/80 text-sm">{ROLE_LABELS[app.role] || app.role}</div>
            </div>
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">Care Status</div>
              <div className="text-white/80 text-sm">{CARE_LABELS[app.currentlyInCare] || app.currentlyInCare}</div>
            </div>
          </div>
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wide mb-1">Why they want access</div>
            <p className="text-white/70 text-sm leading-relaxed">{app.intent}</p>
          </div>
          <div className="text-[10px] text-white/30">
            Confidentiality agreed: {app.agreedToConfidentiality ? "Yes" : "No"}
          </div>

          {app.status === "pending" && (
            <div className="flex gap-3 pt-1">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || denyMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1"
              >
                <CheckCircle2 size={13} />
                {approveMutation.isPending ? "Sending invite…" : "Approve + Send Invite"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => denyMutation.mutate()}
                disabled={approveMutation.isPending || denyMutation.isPending}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 gap-1.5"
              >
                <XCircle size={13} />
                {denyMutation.isPending ? "Denying…" : "Deny"}
              </Button>
            </div>
          )}

          {app.status === "approved" && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs pt-1">
              <CheckCircle2 size={12} />
              {app.emailVerified ? "Email verified — account active" : "Auto-approved — waiting for email verification"}
            </div>
          )}
          {app.status === "denied" && (
            <div className="flex items-center gap-2 text-red-400 text-xs pt-1">
              <XCircle size={12} /> Denial email sent
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationsTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "denied">("pending");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/applications"],
    queryFn: () => apiRequest("GET", "/api/admin/applications").then(r => r.json()),
    staleTime: 15000,
  });

  // API returns array directly
  const apps: BetaApplication[] = Array.isArray(data) ? data : (data?.applications ?? []);
  const filtered = statusFilter === "all" ? apps : apps.filter(a => a.status === statusFilter);
  const pendingCount = apps.filter(a => a.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-white text-lg font-bold">{apps.length}</div>
          <div className="text-white/40 text-[10px] mt-0.5">Total</div>
        </div>
        <div className="rounded-xl bg-amber-900/20 border border-amber-700/30 p-3 text-center">
          <div className="text-amber-400 text-lg font-bold">{pendingCount}</div>
          <div className="text-amber-500/60 text-[10px] mt-0.5">Pending</div>
        </div>
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/30 p-3 text-center">
          <div className="text-emerald-400 text-lg font-bold">{apps.filter(a => a.status === "approved").length}</div>
          <div className="text-emerald-500/60 text-[10px] mt-0.5">Approved</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["pending", "approved", "denied", "all"] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border capitalize",
              statusFilter === s
                ? "bg-rose-600 border-rose-500 text-white"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
            )}
          >
            {s}{s === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          {statusFilter === "pending" ? "No pending applications." : `No ${statusFilter} applications.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <ApplicationCard key={app.id} app={app} onRefresh={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Help Desk Tab ───────────────────────────────────────────────────────────────
interface HelpEscalation {
  id: number;
  userEmail: string | null;
  userRole: string | null;
  portalMode: string | null;
  transcript: string;
  summary: string | null;
  resolved: number;
  resolvedNote: string | null;
  createdAt: string;
}

function HelpdeskTab() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [filterResolved, setFilterResolved] = useState<"all" | "open" | "resolved">("open");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/helpdesk"],
    queryFn: () => apiRequest("GET", "/api/admin/helpdesk").then(r => r.json()),
    staleTime: 15000,
  });

  const escalations: HelpEscalation[] = data?.escalations ?? [];

  const filtered = escalations.filter(e => {
    if (filterResolved === "open") return !e.resolved;
    if (filterResolved === "resolved") return !!e.resolved;
    return true;
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiRequest("PATCH", `/api/admin/helpdesk/${id}`, { resolvedNote: note }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Marked resolved", description: "Escalation closed." });
      setNoteId(null);
      setNoteText("");
      refetch();
    },
    onError: () => toast({ title: "Error", description: "Could not mark resolved.", variant: "destructive" }),
  });

  const openCount = escalations.filter(e => !e.resolved).length;

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function roleColor(role: string | null) {
    if (!role) return "bg-white/10 text-white/50";
    if (role.includes("caregiver") || role === "caregiver") return "bg-teal-900/40 text-teal-300";
    if (role.includes("family") || role.includes("contact")) return "bg-rose-900/40 text-rose-300";
    return "bg-white/10 text-white/50";
  }

  return (
    <div className="space-y-4">
      {/* Stats + filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-center">
            <div className="text-white font-bold text-lg">{openCount}</div>
            <div className="text-white/40 text-[10px]">Open</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-center">
            <div className="text-emerald-400 font-bold text-lg">{escalations.filter(e => !!e.resolved).length}</div>
            <div className="text-white/40 text-[10px]">Resolved</div>
          </div>
        </div>
        <div className="flex gap-1">
          {(["open", "all", "resolved"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterResolved(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                filterResolved === f
                  ? "bg-rose-600 border-rose-500 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          {filterResolved === "open" ? "No open escalations. Great work!" : "Nothing here yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(esc => (
            <div key={esc.id} className={cn(
              "rounded-xl border p-4 space-y-3 transition-all",
              esc.resolved
                ? "bg-white/3 border-white/8 opacity-60"
                : "bg-white/5 border-white/15"
            )}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", roleColor(esc.userRole))}>
                      {esc.userRole ?? "unknown"}
                    </span>
                    {esc.portalMode && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/8 text-white/50">
                        {esc.portalMode}
                      </span>
                    )}
                    {esc.resolved ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-900/40 text-emerald-300">Resolved</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-900/40 text-amber-300">Open</span>
                    )}
                  </div>
                  <div className="text-white/50 text-xs mt-1">{esc.userEmail ?? "Anonymous"} &middot; {formatDate(esc.createdAt)}</div>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === esc.id ? null : esc.id)}
                  className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                >
                  {expandedId === esc.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Summary */}
              {esc.summary && (
                <div className="text-white/70 text-sm leading-relaxed">{esc.summary}</div>
              )}

              {/* Expanded transcript */}
              {expandedId === esc.id && (
                <div className="rounded-lg bg-black/20 border border-white/8 p-3">
                  <div className="text-white/40 text-[10px] font-medium mb-2 uppercase tracking-wider">Full Transcript</div>
                  <pre className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap font-sans">{esc.transcript}</pre>
                </div>
              )}

              {/* Resolution note (if already resolved) */}
              {esc.resolved && esc.resolvedNote && (
                <div className="rounded-lg bg-emerald-950/30 border border-emerald-700/30 px-3 py-2 text-emerald-300/80 text-xs">
                  <span className="font-medium">Note: </span>{esc.resolvedNote}
                </div>
              )}

              {/* Resolve action */}
              {!esc.resolved && (
                noteId === esc.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a resolution note (optional)..."
                      className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-sm resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => resolveMutation.mutate({ id: esc.id, note: noteText })}
                        disabled={resolveMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      >
                        <Check size={12} className="mr-1" /> Mark Resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setNoteId(null); setNoteText(""); }}
                        className="text-white/40 hover:text-white text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNoteId(esc.id); setNoteText(""); }}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 transition-colors"
                  >
                    <CheckCircle2 size={13} /> Resolve this escalation
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BeckyAdminPage() {
  const [activeTab, setActiveTab] = useState<"library" | "applications" | "helpdesk">("library");
  const [activeTheme, setActiveTheme] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/becky-library", activeTheme],
    queryFn: () => apiRequest("GET", `/api/becky-library${activeTheme !== "all" ? `?theme=${activeTheme}` : ""}`).then(r => r.json()),
    staleTime: 10000,
  });

  const items: LibraryItem[] = data?.items ?? [];
  const themes: string[] = data?.themes ?? [];
  const allThemes = ["all", ...themes];

  const placeholderCount = items.filter(i => i.isPlaceholder).length;
  const totalActive = items.filter(i => i.isActive).length;

  return (
    <div className="min-h-screen bg-background" style={{ background: "hsl(345 18% 5%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 px-5 py-4" style={{ background: "hsl(345 18% 7%)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
              <BookHeart size={18} className="text-rose-400" />
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-base" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                Becky Admin
              </div>
              <div className="text-white/50 text-xs">Care Net Portal — Private</div>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("library")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === "library" ? "bg-rose-600/30 text-rose-300 border border-rose-600/40" : "text-white/40 hover:text-white/70"
              )}
            >
              <BookHeart size={14} /> Response Library
            </button>
            <button
              onClick={() => setActiveTab("applications")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === "applications" ? "bg-rose-600/30 text-rose-300 border border-rose-600/40" : "text-white/40 hover:text-white/70"
              )}
            >
              <Users size={14} /> Beta Applications
            </button>
            <button
              onClick={() => setActiveTab("helpdesk")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                activeTab === "helpdesk" ? "bg-rose-600/30 text-rose-300 border border-rose-600/40" : "text-white/40 hover:text-white/70"
              )}
            >
              <MessageCircleHeart size={14} /> Help Desk
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Applications tab */}
        {activeTab === "applications" && <ApplicationsTab />}

        {/* Help Desk tab */}
        {activeTab === "helpdesk" && <HelpdeskTab />}

        {/* Library tab — only render when on library tab */}
        {activeTab === "library" && (<>

        {/* Stats row */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <div className="text-white text-lg font-bold">{data?.items?.length ?? 0}</div>
              <div className="text-white/40 text-[10px] mt-0.5">Total Entries</div>
            </div>
            <div className="rounded-xl bg-amber-900/20 border border-amber-700/30 p-3 text-center">
              <div className="text-amber-400 text-lg font-bold">{data?.items?.filter((i: LibraryItem) => i.isPlaceholder).length ?? 0}</div>
              <div className="text-amber-500/60 text-[10px] mt-0.5">Need Your Edit</div>
            </div>
            <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/30 p-3 text-center">
              <div className="text-emerald-400 text-lg font-bold">{data?.items?.filter((i: LibraryItem) => !i.isPlaceholder && i.isActive).length ?? 0}</div>
              <div className="text-emerald-500/60 text-[10px] mt-0.5">Your Responses</div>
            </div>
          </div>
        )}

        {/* Placeholder notice */}
        {placeholderCount > 0 && (
          <div className="rounded-xl border border-amber-600/30 bg-amber-950/20 px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-amber-300 text-sm font-medium">{placeholderCount} placeholder {placeholderCount === 1 ? "entry needs" : "entries need"} your voice</div>
              <div className="text-amber-500/70 text-xs mt-0.5 leading-relaxed">
                These responses were written as stand-ins. Tap "Write My Version" on any entry to replace it with your own words.
              </div>
            </div>
          </div>
        )}

        {/* Theme filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {allThemes.map(t => (
            <button
              key={t}
              onClick={() => setActiveTheme(t)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                activeTheme === t
                  ? "bg-rose-600 border-rose-500 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
              )}
            >
              {t === "all" ? "All Themes" : themeLabel(t)}
            </button>
          ))}
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">No entries for this theme yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <EntryCard
                key={item.id}
                item={item}
                onSaved={() => refetch()}
                onDeleted={() => refetch()}
              />
            ))}
          </div>
        )}

        {/* New entry form */}
        <NewEntryForm themes={themes.length > 0 ? themes : Object.keys(THEME_LABELS)} onSaved={() => refetch()} />

        <div className="h-8" />
        </>)}
      </div>
    </div>
  );
}
