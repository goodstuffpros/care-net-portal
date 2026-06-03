import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Check, X, BookHeart, AlertTriangle, ChevronDown, ChevronUp, Save, Users, Clock, CheckCircle2, XCircle, Mail, MessageCircleHeart, ChevronRight, Download, Eraser, ShieldAlert, User, UserX, CalendarDays, NotebookPen, Pill, Activity, Image, FolderOpen, Heart, Lightbulb, Tag, RefreshCw } from "lucide-react";
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
    mutationFn: async (data: Partial<LibraryItem>) => {
      const res = await apiRequest("PATCH", `/api/becky-library/${item.id}`, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server returned ${res.status}`);
      }
      const saved = await res.json();
      // Verify the save actually landed
      if (data.isPlaceholder === 0 && saved.isPlaceholder !== 0) {
        throw new Error("Save appeared to succeed but the record was not updated. Try again.");
      }
      return saved;
    },
    onSuccess: (saved) => {
      setEditing(false);
      onSaved();
      toast({
        title: "\u2705 Saved",
        description: `Response saved at ${new Date(saved.updatedAt).toLocaleTimeString()}.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "\u274C Save failed — your work was NOT saved",
        description: err.message || "Something went wrong. Copy your response text before closing this page.",
        variant: "destructive",
      });
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
      item.isPlaceholder ? "border-teal-300 dark:border-teal-600/60 bg-white dark:bg-slate-800" :
        "border-border bg-card",
      !item.isActive && "opacity-50"
    )}>
      {/* Card header */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={() => !editing && setExpanded(v => !v)}
      >
        {item.isPlaceholder ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-teal-700 dark:text-teal-300 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 bg-teal-50 dark:bg-teal-900/40 px-2 py-1 rounded-full border border-teal-300 dark:border-teal-600/60">
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

function DeactivateUserButton({ email, onRefresh }: { email: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const deactivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/users/deactivate", { email }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Account deactivated", description: `${email} can no longer sign in.` });
      setConfirming(false);
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-[10px]">Deactivate?</span>
        <button
          onClick={() => deactivateMutation.mutate()}
          disabled={deactivateMutation.isPending}
          className="text-[10px] px-2 py-1 rounded-lg bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 transition-colors"
        >
          {deactivateMutation.isPending ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[10px] text-white/25 hover:text-red-400 transition-colors flex items-center gap-1"
    >
      <UserX size={11} /> Deactivate
    </button>
  );
}

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
    onError: () => toast({ title: "Deny failed", description: "You may need to sign in again.", variant: "destructive" }),
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
              <div className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">Joined</div>
              <div className="text-white/80 text-sm">{new Date(app.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
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
            <div className="flex items-start justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle2 size={12} />
                {app.emailVerified ? "Email verified — account active" : "Auto-approved — waiting for email verification"}
              </div>
              <DeactivateUserButton email={app.email} onRefresh={onRefresh} />
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

  const { data: allUsersData, isLoading: allUsersLoading } = useQuery({
    queryKey: ["/api/admin/engagement"],
    queryFn: () => apiRequest("GET", "/api/admin/engagement").then(r => r.json()),
    staleTime: 30000,
  });

  const apps: BetaApplication[] = Array.isArray(data) ? data : (data?.applications ?? []);
  const filtered = statusFilter === "all" ? apps : apps.filter(a => a.status === statusFilter);
  const pendingCount = apps.filter(a => a.status === "pending").length;
  const allUsers: EngagementUser[] = Array.isArray(allUsersData) ? allUsersData : [];

  function roleLabel(role: string) {
    const map: Record<string, string> = {
      caregiver: "Caregiver", multi_caregiver: "Caregiver",
      primary_family: "Main Contact", secondary_family: "Family",
      self_care: "Self Care",
    };
    return map[role] ?? role;
  }

  function roleColor(role: string) {
    if (role === "caregiver" || role === "multi_caregiver") return "text-teal-400";
    if (role === "primary_family") return "text-blue-400";
    if (role === "secondary_family") return "text-slate-400";
    if (role === "self_care") return "text-rose-400";
    return "text-white/50";
  }

  return (
    <div className="space-y-6">

      {/* ALL CURRENT USERS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">All Current Users</div>
          <div className="text-white/40 text-xs">{allUsers.length} users</div>
        </div>
        {allUsersLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : allUsers.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">No users found.</div>
        ) : (
          <div className="space-y-2">
            {allUsers.map(u => (
              <div key={u.id} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">{u.name}</div>
                  <div className="text-white/40 text-xs truncate">{u.email}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={cn("text-xs font-medium", roleColor(u.role))}>{roleLabel(u.role)}</div>
                  <div className="text-white/30 text-[10px]">
                    {u.lastLoginAt ? `Last login: ${new Date(u.lastLoginAt).toLocaleDateString()}` : "Never logged in"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DIVIDER */}
      <div className="border-t border-white/10" />

      {/* PUBLIC SIGNUP QUEUE (for future use) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">Public Signup Queue</div>
          {pendingCount > 0 && (
            <div className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
              {pendingCount} pending
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-3">
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

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">
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

// ── Beta Cleanup Tab ─────────────────────────────────────────────────────────────────

interface CleanupUser {
  id: number;
  name: string;
  role: string;
  email: string;
  clientId: number | null;
  counts: Record<string, number>;
}

const CATEGORY_META: { key: string; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "careLogs",       label: "Care Log",       icon: <NotebookPen size={13} />,  color: "text-teal-400" },
  { key: "scheduleEvents", label: "Schedule",       icon: <CalendarDays size={13} />, color: "text-blue-400" },
  { key: "vitals",         label: "Vitals",         icon: <Activity size={13} />,     color: "text-red-400" },
  { key: "medications",    label: "Medications",    icon: <Pill size={13} />,         color: "text-purple-400" },
  { key: "thoughts",       label: "Coll. of Thoughts", icon: <Heart size={13} />,    color: "text-rose-400" },
  { key: "media",          label: "Media",          icon: <Image size={13} />,        color: "text-amber-400" },
  { key: "documents",      label: "Documents",      icon: <FolderOpen size={13} />,   color: "text-emerald-400" },
];

function RolePill({ role }: { role: string }) {
  const colors: Record<string, string> = {
    caregiver: "bg-teal-900/50 text-teal-300 border-teal-700",
    primary_family: "bg-blue-900/50 text-blue-300 border-blue-700",
    secondary_family: "bg-slate-700/50 text-slate-300 border-slate-600",
    multi_caregiver: "bg-purple-900/50 text-purple-300 border-purple-700",
  };
  const label: Record<string, string> = {
    caregiver: "Caregiver",
    primary_family: "Main Contact",
    secondary_family: "Family",
    multi_caregiver: "CG",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", colors[role] ?? "bg-slate-700 text-slate-300 border-slate-600")}>
      {label[role] ?? role}
    </span>
  );
}

// ── Engagement Tab ───────────────────────────────────────────────────────────────────

interface EngagementUser {
  id: number;
  name: string;
  email: string;
  role: string;
  tier: "active" | "moderate" | "quiet";
  daysSinceLogin: number | null;
  daysSinceActivity: number | null;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  totalEntries: number;
}

interface FeedbackEntry {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  triggerType: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

function EngagementTab() {
  const { toast } = useToast();
  const [view, setView] = useState<"users" | "feedback">("users");

  const { data: engData, isLoading: engLoading, refetch: refetchEng } = useQuery<EngagementUser[]>({
    queryKey: ["/api/admin/engagement"],
    queryFn: () => apiRequest("GET", "/api/admin/engagement").then(r => r.json()),
    staleTime: 30000,
  });

  const { data: fbData, isLoading: fbLoading, refetch: refetchFb } = useQuery<FeedbackEntry[]>({
    queryKey: ["/api/admin/feedback"],
    queryFn: () => apiRequest("GET", "/api/admin/feedback").then(r => r.json()),
    staleTime: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/feedback/${id}/read`),
    onSuccess: () => {
      refetchFb();
      toast({ title: "Marked as read" });
    },
  });

  const users: EngagementUser[] = Array.isArray(engData) ? engData : [];
  const feedback: FeedbackEntry[] = Array.isArray(fbData) ? fbData : [];

  const unreadCount = feedback.filter(f => !f.readAt).length;

  function tierBadge(tier: string) {
    if (tier === "active") return "bg-teal-900/40 border-teal-700/50 text-teal-300";
    if (tier === "moderate") return "bg-amber-900/30 border-amber-700/40 text-amber-300";
    return "bg-white/5 border-white/15 text-white/40";
  }

  function tierLabel(tier: string) {
    if (tier === "active") return "Active";
    if (tier === "moderate") return "Moderate";
    return "Quiet";
  }

  function roleColor(role: string) {
    if (role === "caregiver" || role === "multi_caregiver") return "text-teal-400";
    if (role === "primary_family") return "text-blue-400";
    if (role === "secondary_family") return "text-slate-400";
    if (role === "self_care") return "text-rose-400";
    return "text-white/50";
  }

  function roleLabel(role: string) {
    const map: Record<string, string> = {
      caregiver: "CG",
      multi_caregiver: "CG",
      primary_family: "MC",
      secondary_family: "Family",
      self_care: "Self Care",
    };
    return map[role] ?? role;
  }

  function daysAgo(n: number | null) {
    if (n === null) return "never";
    if (n === 0) return "today";
    if (n === 1) return "1 day ago";
    return `${n}d ago`;
  }

  function formatTs(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  const activeCount = users.filter(u => u.tier === "active").length;
  const moderateCount = users.filter(u => u.tier === "moderate").length;
  const quietCount = users.filter(u => u.tier === "quiet").length;

  return (
    <div className="space-y-5">
      {/* Sub-nav */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("users")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
            view === "users"
              ? "bg-rose-600/30 text-rose-300 border-rose-600/40"
              : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
          )}
        >
          <Activity size={13} /> User Activity
        </button>
        <button
          onClick={() => setView("feedback")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border relative",
            view === "feedback"
              ? "bg-rose-600/30 text-rose-300 border-rose-600/40"
              : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
          )}
        >
          <MessageCircleHeart size={13} /> Feedback
          {unreadCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">{unreadCount}</span>
          )}
        </button>
        <button
          onClick={() => { refetchEng(); refetchFb(); toast({ title: "Refreshed" }); }}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border bg-white/5 border-white/10 text-white/40 hover:text-white/70 transition-all"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── User Activity view ── */}
      {view === "users" && (
        <div className="space-y-4">
          {/* Tier summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-teal-900/20 border border-teal-700/30 p-3 text-center">
              <div className="text-teal-300 text-lg font-bold">{activeCount}</div>
              <div className="text-teal-500/60 text-[10px] mt-0.5">Active</div>
            </div>
            <div className="rounded-xl bg-amber-900/20 border border-amber-700/30 p-3 text-center">
              <div className="text-amber-300 text-lg font-bold">{moderateCount}</div>
              <div className="text-amber-500/60 text-[10px] mt-0.5">Moderate</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <div className="text-white/50 text-lg font-bold">{quietCount}</div>
              <div className="text-white/30 text-[10px] mt-0.5">Quiet</div>
            </div>
          </div>

          {engLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="rounded-xl border border-white/10 bg-white/4 px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium truncate">{u.name}</span>
                      <span className={cn("text-[10px] font-medium", roleColor(u.role))}>{roleLabel(u.role)}</span>
                    </div>
                    <div className="text-white/35 text-xs mt-0.5 truncate">{u.email}</div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-white/40 text-[11px]">
                        <span className="text-white/25">Login: </span>{daysAgo(u.daysSinceLogin)}
                      </span>
                      <span className="text-white/40 text-[11px]">
                        <span className="text-white/25">Activity: </span>{daysAgo(u.daysSinceActivity)}
                      </span>
                      {u.totalEntries > 0 && (
                        <span className="text-white/40 text-[11px]">
                          <span className="text-white/25">Entries: </span>{u.totalEntries}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-0.5",
                    tierBadge(u.tier)
                  )}>
                    {tierLabel(u.tier)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Feedback view ── */}
      {view === "feedback" && (
        <div className="space-y-3">
          {fbLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">No feedback submitted yet.</div>
          ) : (
            feedback.map(f => (
              <div
                key={f.id}
                className={cn(
                  "rounded-xl border p-4 space-y-2 transition-all",
                  f.readAt ? "bg-white/3 border-white/8 opacity-60" : "bg-white/5 border-white/15"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{f.userName}</span>
                      <span className={cn("text-[10px] font-medium", roleColor(f.userRole))}>{roleLabel(f.userRole)}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                        f.triggerType === "high-five"
                          ? "bg-teal-900/30 border-teal-700/40 text-teal-300"
                          : "bg-slate-800/40 border-slate-600/40 text-slate-300"
                      )}>
                        {f.triggerType === "high-five" ? "High Five" : "Open Hand"}
                      </span>
                      {!f.readAt && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/30 border border-rose-700/40 text-rose-300 font-medium">Unread</span>
                      )}
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">{f.userEmail} &middot; {formatTs(f.createdAt)}</div>
                  </div>
                  {!f.readAt && (
                    <button
                      onClick={() => markReadMutation.mutate(f.id)}
                      disabled={markReadMutation.isPending}
                      className="flex-shrink-0 text-xs text-white/30 hover:text-emerald-400 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Read
                    </button>
                  )}
                </div>
                <div className="rounded-lg bg-black/20 border border-white/8 px-3 py-2.5 text-white/75 text-sm leading-relaxed">
                  {f.message}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Beta Cleanup Tab ─────────────────────────────────────────────────────────────────

function BetaCleanupTab() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<CleanupUser | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastWipeResult, setLastWipeResult] = useState<Record<string, number> | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery<CleanupUser[]>({
    queryKey: ["/api/admin/beta-cleanup/users"],
    queryFn: () => apiRequest("GET", "/api/admin/beta-cleanup/users").then(r => r.json()),
  });

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const wipeMutation = useMutation({
    mutationFn: (payload: { userId: number; clientId: number; categories: string[] }) =>
      apiRequest("POST", "/api/admin/beta-cleanup/wipe", payload).then(r => r.json()),
    onSuccess: (data) => {
      setLastWipeResult(data.wiped);
      setConfirmOpen(false);
      setSelectedCats(new Set());
      refetch();
      toast({ title: "Wipe complete", description: `${Object.values(data.wiped as Record<string,number>).reduce((a,b)=>a+b,0)} entries removed.` });
    },
    onError: (err: any) => toast({ title: "Wipe failed", description: err?.message, variant: "destructive" }),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("DELETE", `/api/admin/users/${userId}`).then(r => r.json()),
    onSuccess: (data) => {
      setSelectedUser(null);
      setDeleteConfirm(false);
      setSelectedCats(new Set());
      setLastWipeResult(null);
      refetch();
      toast({ title: "Account deleted", description: `${data.email ?? "User"} removed completely.` });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });

  function toggleCat(key: string) {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAllCats() {
    setSelectedCats(new Set(CATEGORY_META.map(c => c.key)));
  }

  function clearAllCats() {
    setSelectedCats(new Set());
  }

  function handleWipe() {
    if (!selectedUser || !selectedUser.clientId || selectedCats.size === 0) return;
    wipeMutation.mutate({
      userId: selectedUser.id,
      clientId: selectedUser.clientId,
      categories: Array.from(selectedCats),
    });
  }

  const totalToWipe = selectedUser
    ? Array.from(selectedCats).reduce((sum, key) => sum + (selectedUser.counts[key] ?? 0), 0)
    : 0;

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/30 border border-amber-700/40">
        <ShieldAlert size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          <span className="font-semibold text-amber-300">Beta Cleanup Tool</span> — Selectively wipe test data for any real user while keeping their account and profile intact. Demo users (seed data) are excluded from this list. This action is permanent.
        </p>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="text-white/40 text-sm text-center py-8">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="text-white/40 text-sm text-center py-8">No beta users yet.</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Select a user</p>
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setSelectedUser(u); setSelectedCats(new Set()); setLastWipeResult(null); }}
              className={cn(
                "w-full text-left p-3 rounded-xl border transition-all",
                selectedUser?.id === u.id
                  ? "bg-rose-900/30 border-rose-600/50"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
              data-testid={`cleanup-user-${u.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={14} className="text-white/40 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{u.name}</div>
                    <div className="text-white/40 text-xs truncate">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RolePill role={u.role} />
                  <span className={cn(
                    "text-xs font-mono px-2 py-0.5 rounded-full border",
                    u.counts.total > 0
                      ? "bg-rose-900/40 text-rose-300 border-rose-700/50"
                      : "bg-white/5 text-white/30 border-white/10"
                  )}>
                    {u.counts.total} entries
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected user — category picker */}
      {selectedUser && (
        <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{selectedUser.name}</p>
            <div className="flex gap-2">
              <button type="button" onClick={selectAllCats} className="text-xs text-white/40 hover:text-white/70 transition-colors">Select all</button>
              <span className="text-white/20">|</span>
              <button type="button" onClick={clearAllCats} className="text-xs text-white/40 hover:text-white/70 transition-colors">Clear</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_META.map(cat => {
              const count = selectedUser.counts[cat.key] ?? 0;
              const isSelected = selectedCats.has(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => toggleCat(cat.key)}
                  disabled={count === 0}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-all",
                    count === 0
                      ? "opacity-30 cursor-not-allowed bg-white/3 border-white/5"
                      : isSelected
                        ? "bg-rose-900/40 border-rose-600/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                  data-testid={`cat-toggle-${cat.key}`}
                >
                  <span className={cn("flex items-center gap-1.5 text-xs", isSelected ? "text-rose-200" : "text-white/60")}>
                    <span className={cat.color}>{cat.icon}</span>
                    {cat.label}
                  </span>
                  <span className={cn(
                    "text-xs font-mono px-1.5 py-0.5 rounded border",
                    isSelected ? "bg-rose-800/50 text-rose-200 border-rose-600/50" : "bg-white/5 text-white/40 border-white/10"
                  )}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Wipe button */}
          {selectedCats.size > 0 && (
            <div className="pt-1">
              {!confirmOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-700/30 border border-rose-600/40 text-rose-300 text-sm font-medium hover:bg-rose-700/50 transition-all"
                  data-testid="wipe-btn"
                >
                  <Eraser size={14} />
                  Wipe {totalToWipe} {totalToWipe === 1 ? "entry" : "entries"} from {Array.from(selectedCats).length} {Array.from(selectedCats).length === 1 ? "category" : "categories"}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-rose-300 text-center">
                    Permanently delete {totalToWipe} entries for <span className="font-semibold">{selectedUser.name}</span>? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleWipe}
                      disabled={wipeMutation.isPending}
                      className="flex-1 py-2 rounded-lg bg-rose-700 border border-rose-600 text-white text-sm font-semibold hover:bg-rose-600 transition-all disabled:opacity-50"
                      data-testid="wipe-confirm-btn"
                    >
                      {wipeMutation.isPending ? "Wiping…" : "Yes, wipe it"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last wipe result */}
          {lastWipeResult && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-700/40">
              <p className="text-xs text-emerald-300 font-semibold mb-1.5">Wipe complete — entries removed:</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(lastWipeResult).map(([key, count]) => {
                  const meta = CATEGORY_META.find(c => c.key === key);
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-emerald-200/70">
                      <span className={meta?.color ?? "text-white/40"}>{meta?.icon}</span>
                      {meta?.label ?? key}: <span className="font-mono text-emerald-300">{String(count)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Danger zone — Delete Account */}
          <div className="pt-2 mt-2 border-t border-white/10">
            <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">Danger Zone</p>
            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-transparent border border-red-800/50 text-red-400 text-xs font-medium hover:bg-red-950/30 transition-all"
                data-testid="delete-account-btn"
              >
                <Trash2 size={12} /> Delete Entire Account
              </button>
            ) : (
              <div className="space-y-2 p-3 rounded-lg bg-red-950/30 border border-red-700/50">
                <p className="text-xs text-red-300 text-center leading-relaxed">
                  Permanently delete <span className="font-semibold">{selectedUser.name}</span>'s account, login credentials, and all session data? Care entries are unaffected unless wiped above first.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAccountMutation.mutate(selectedUser.id)}
                    disabled={deleteAccountMutation.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-red-700 border border-red-600 text-white text-xs font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
                    data-testid="delete-account-confirm-btn"
                  >
                    {deleteAccountMutation.isPending ? "Deleting…" : "Yes, delete account"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ideas Tab ────────────────────────────────────────────────────────────────
const CARE_CONTEXT_LABELS: Record<string, string> = {
  universal: "Universal",
  elderly: "Elderly Care",
  special_needs: "Special Needs",
  short_term: "Short-Term Care",
  self_managed: "Self-Managed",
};
const IDEA_TYPE_LABELS: Record<string, string> = {
  missing_feature: "Missing Feature",
  friction_point: "Friction Point",
  emotional_need: "Emotional Need",
  safety: "Safety",
};
const CARE_CONTEXT_COLORS: Record<string, string> = {
  universal: "bg-teal-900/40 text-teal-300 border-teal-700/40",
  elderly: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  special_needs: "bg-purple-900/40 text-purple-300 border-purple-700/40",
  short_term: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  self_managed: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
};
const IDEA_TYPE_COLORS: Record<string, string> = {
  missing_feature: "bg-rose-900/40 text-rose-300 border-rose-700/40",
  friction_point: "bg-orange-900/40 text-orange-300 border-orange-700/40",
  emotional_need: "bg-pink-900/40 text-pink-300 border-pink-700/40",
  safety: "bg-red-900/40 text-red-300 border-red-700/40",
};
const STATUS_OPTIONS = ["new", "reviewed", "promoted", "dismissed"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-zinc-700 text-zinc-200",
  reviewed: "bg-blue-900/60 text-blue-300",
  promoted: "bg-emerald-900/60 text-emerald-300",
  dismissed: "bg-zinc-800 text-zinc-500",
};

interface IdeaCluster {
  clusterId: string;
  clusterLabel: string;
  count: number;
  ideas: {
    id: number;
    userId: number | null;
    userRole: string | null;
    text: string;
    page: string | null;
    careContext: string | null;
    ideaType: string | null;
    clusterId: string | null;
    clusterLabel: string | null;
    geminiSummary: string | null;
    status: string;
    adminNote: string | null;
    createdAt: string;
  }[];
}

function IdeasTab() {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const { toast } = useToast();

  const { data: clusters = [], isLoading, refetch } = useQuery<IdeaCluster[]>({
    queryKey: ["/api/admin/ideas"],
    queryFn: () => apiRequest("GET", "/api/admin/ideas").then(r => r.json()),
    staleTime: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, string> }) =>
      apiRequest("PATCH", `/api/admin/ideas/${id}`, patch).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ideas"] }),
    onError: () => toast({ title: "Could not update idea", variant: "destructive" }),
  });

  const totalIdeas = clusters.reduce((sum, c) => sum + c.count, 0);
  const newCount = clusters.reduce((sum, c) => sum + c.ideas.filter(i => i.status === "new").length, 0);

  function toggleCluster(id: string) {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold">{totalIdeas} idea{totalIdeas !== 1 ? "s" : ""} submitted</p>
          {newCount > 0 && <p className="text-xs text-amber-400">{newCount} unreviewed</p>}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-white/40 text-sm">Loading ideas…</div>
      )}

      {!isLoading && clusters.length === 0 && (
        <div className="text-center py-16">
          <Lightbulb className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No ideas submitted yet.</p>
          <p className="text-white/25 text-xs mt-1">Ideas will appear here once users submit them via the App Help button.</p>
        </div>
      )}

      {/* Cluster cards */}
      {clusters.map(cluster => {
        const isExpanded = expandedClusters.has(cluster.clusterId);
        const clusterNewCount = cluster.ideas.filter(i => i.status === "new").length;
        // Representative idea for cluster summary
        const repIdea = cluster.ideas.find(i => i.geminiSummary) || cluster.ideas[0];

        return (
          <div key={cluster.clusterId} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Cluster header */}
            <button
              onClick={() => toggleCluster(cluster.clusterId)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-600/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-rose-300">{cluster.count}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{cluster.clusterLabel || cluster.clusterId}</p>
                  {repIdea?.geminiSummary && (
                    <p className="text-xs text-white/50 truncate">{repIdea.geminiSummary}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {clusterNewCount > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
                    {clusterNewCount} new
                  </span>
                )}
                {isExpanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
              </div>
            </button>

            {/* Tag row */}
            {!isExpanded && repIdea && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {repIdea.careContext && (
                  <span className={cn("text-[10px] border rounded-full px-2 py-0.5", CARE_CONTEXT_COLORS[repIdea.careContext] || "bg-zinc-800 text-zinc-400 border-zinc-700")}>
                    {CARE_CONTEXT_LABELS[repIdea.careContext] || repIdea.careContext}
                  </span>
                )}
                {repIdea.ideaType && (
                  <span className={cn("text-[10px] border rounded-full px-2 py-0.5", IDEA_TYPE_COLORS[repIdea.ideaType] || "bg-zinc-800 text-zinc-400 border-zinc-700")}>
                    {IDEA_TYPE_LABELS[repIdea.ideaType] || repIdea.ideaType}
                  </span>
                )}
              </div>
            )}

            {/* Expanded: individual ideas */}
            {isExpanded && (
              <div className="border-t border-white/10 divide-y divide-white/5">
                {cluster.ideas.map(idea => (
                  <div key={idea.id} className="px-4 py-3 space-y-2">
                    {/* Idea text */}
                    <p className="text-sm text-white/90 leading-relaxed">“{idea.text}”</p>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-1.5">
                      {idea.careContext && (
                        <span className={cn("text-[10px] border rounded-full px-2 py-0.5", CARE_CONTEXT_COLORS[idea.careContext] || "bg-zinc-800 text-zinc-400 border-zinc-700")}>
                          {CARE_CONTEXT_LABELS[idea.careContext] || idea.careContext}
                        </span>
                      )}
                      {idea.ideaType && (
                        <span className={cn("text-[10px] border rounded-full px-2 py-0.5", IDEA_TYPE_COLORS[idea.ideaType] || "bg-zinc-800 text-zinc-400 border-zinc-700")}>
                          {IDEA_TYPE_LABELS[idea.ideaType] || idea.ideaType}
                        </span>
                      )}
                      {idea.page && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2 py-0.5">
                          {idea.page}
                        </span>
                      )}
                      {idea.userRole && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2 py-0.5">
                          {idea.userRole}
                        </span>
                      )}
                    </div>

                    {/* Status + admin note row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={idea.status}
                        onChange={e => updateMutation.mutate({ id: idea.id, patch: { status: e.target.value } })}
                        className={cn("text-[11px] rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer", STATUS_COLORS[idea.status] || "bg-zinc-700 text-zinc-200")}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {editingNote === idea.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            className="flex-1 text-xs bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-white outline-none"
                            placeholder="Add a note…"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                updateMutation.mutate({ id: idea.id, patch: { adminNote: noteText } });
                                setEditingNote(null);
                              }
                              if (e.key === "Escape") setEditingNote(null);
                            }}
                          />
                          <button
                            onClick={() => { updateMutation.mutate({ id: idea.id, patch: { adminNote: noteText } }); setEditingNote(null); }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300"
                          >Save</button>
                          <button onClick={() => setEditingNote(null)} className="text-[10px] text-white/30 hover:text-white/60">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingNote(idea.id); setNoteText(idea.adminNote || ""); }}
                          className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1"
                        >
                          <NotebookPen size={10} />
                          {idea.adminNote ? idea.adminNote : "Add note"}
                        </button>
                      )}
                    </div>

                    {/* Gemini summary if different from cluster rep */}
                    {idea.geminiSummary && (
                      <p className="text-[11px] text-white/35 italic">{idea.geminiSummary}</p>
                    )}

                    <p className="text-[10px] text-white/20">
                      {new Date(idea.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BeckyAdminPage() {
  const [activeTab, setActiveTab] = useState<"library" | "applications" | "helpdesk" | "cleanup" | "ideas" | "engagement">("applications");
  const [activeTheme, setActiveTheme] = useState<string>("all");
  const { toast } = useToast();

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

  const exportLibrary = async () => {
    try {
      // Fetch ALL items regardless of active theme filter
      const res = await apiRequest("GET", "/api/becky-library");
      const allData = await res.json();
      const allItems: LibraryItem[] = allData?.items ?? [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `becky-response-library-${timestamp}.json`;
      const blob = new Blob([JSON.stringify(allItems, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "✅ Export saved", description: `${allItems.length} entries saved to ${filename}` });
    } catch {
      toast({ title: "❌ Export failed", description: "Could not download library data.", variant: "destructive" });
    }
  };

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
            <button
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                  .finally(() => { window.location.href = "/"; });
              }}
              className="text-white/30 hover:text-white/70 text-xs px-2 py-1 rounded border border-white/10 hover:border-white/30 transition-all"
            >
              Sign Out
            </button>
          </div>
          {/* Tab bar — horizontally scrollable on mobile */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {([
              { key: "library",      icon: <BookHeart size={14} />,           label: "Library" },
              { key: "applications", icon: <Users size={14} />,               label: "Users" },
              { key: "engagement",   icon: <Activity size={14} />,            label: "Engagement" },
              { key: "helpdesk",     icon: <MessageCircleHeart size={14} />,  label: "Help Desk" },
              { key: "cleanup",      icon: <Eraser size={14} />,              label: "Cleanup" },
              { key: "ideas",        icon: <Lightbulb size={14} />,           label: "Ideas" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap",
                  activeTab === tab.key ? "bg-rose-600/30 text-rose-300 border border-rose-600/40" : "text-white/40 hover:text-white/70"
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Applications tab */}
        {activeTab === "applications" && <ApplicationsTab />}

        {/* Engagement tab */}
        {activeTab === "engagement" && <EngagementTab />}

        {/* Help Desk tab */}
        {activeTab === "helpdesk" && <HelpdeskTab />}

        {/* Beta Cleanup tab */}
        {activeTab === "cleanup" && <BetaCleanupTab />}

        {/* Ideas tab */}
        {activeTab === "ideas" && <IdeasTab />}

        {/* Library tab — only render when on library tab */}
        {activeTab === "library" && (<>

        {/* Library toolbar: Export button */}
        <div className="flex justify-end">
          <button
            onClick={exportLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
            data-testid="button-export-library"
          >
            <Download size={13} />
            Export Backup
          </button>
        </div>

        {/* Stats row */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <div className="text-white text-lg font-bold">{data?.items?.length ?? 0}</div>
              <div className="text-white/40 text-[10px] mt-0.5">Total Entries</div>
            </div>
            <div className="rounded-xl bg-teal-900/20 border border-teal-700/30 p-3 text-center">
              <div className="text-teal-300 text-lg font-bold">{data?.items?.filter((i: LibraryItem) => i.isPlaceholder).length ?? 0}</div>
              <div className="text-teal-400/70 text-[10px] mt-0.5">Need Your Edit</div>
            </div>
            <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/30 p-3 text-center">
              <div className="text-emerald-400 text-lg font-bold">{data?.items?.filter((i: LibraryItem) => !i.isPlaceholder && i.isActive).length ?? 0}</div>
              <div className="text-emerald-500/60 text-[10px] mt-0.5">Your Responses</div>
            </div>
          </div>
        )}

        {/* Placeholder notice */}
        {placeholderCount > 0 && (
          <div className="rounded-xl border border-teal-600/30 bg-teal-950/20 px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-teal-200 text-sm font-medium">{placeholderCount} placeholder {placeholderCount === 1 ? "entry needs" : "entries need"} your voice</div>
              <div className="text-teal-400/70 text-xs mt-0.5 leading-relaxed">
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
