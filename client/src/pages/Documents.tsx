import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Document } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  FolderOpen, FileText, Image, File, Lock, LockOpen, Eye,
  Plus, Trash2, ExternalLink, Download, Shield, AlertTriangle,
  ChevronDown, ChevronUp, ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonLauncher } from "@/components/LessonLauncher";

const CATEGORIES = ["All", "Medical", "Emergency", "Legal", "Insurance", "Personal", "Financial", "Other"] as const;

// Default CG access by category (used when MC adds a new document)
const CATEGORY_DEFAULT_ACCESS: Record<string, string> = {
  medical: "read",      // CG needs for daily care
  emergency: "read",    // Life-critical
  legal: "none",
  insurance: "none",
  personal: "none",
  financial: "none",
  other: "none",
};

const CATEGORY_COLORS: Record<string, string> = {
  insurance:  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  legal:      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
  medical:    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  emergency:  "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900",
  financial:  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  personal:   "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900",
  other:      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

// Human-readable labels for cgAccess values
const ACCESS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  none: {
    label: "Private",
    icon: <Lock size={11} />,
    color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
  read: {
    label: "CG Read-Only",
    icon: <Eye size={11} />,
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
  },
  full: {
    label: "CG Full Access",
    icon: <LockOpen size={11} />,
    color: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900",
  },
};

// CG-facing badge (visible to caregiver showing what access they have)
const CG_ACCESS_BADGE: Record<string, { label: string; color: string }> = {
  read: { label: "Read-Only", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900" },
  full: { label: "Full Access", color: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900" },
};

function FileTypeIcon({ type }: { type: string }) {
  if (type === "image") return <Image size={20} className="text-teal-500" />;
  if (type === "doc") return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="text-red-500" />;
}

export default function DocumentsPage() {
  const { selectedClientId, activeUser } = useApp();
  const { t } = useLang();
  const { toast } = useToast();

  const isMC = activeUser.role === "primary_family";
  const isCG = isCaregiverRole(activeUser.role);

  // Only MC can upload or delete
  const canUpload = isMC;
  const canDelete = isMC;

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", category: "medical", description: "", fileType: "pdf",
  });

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/clients", selectedClientId, "documents"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/documents`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/documents`, {
      ...form,
      cgAccess: CATEGORY_DEFAULT_ACCESS[form.category] ?? "none",
      uploadedByUserId: activeUser.id,
      uploadedAt: new Date().toISOString(),
      isConfidential: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "documents"] });
      setAddOpen(false);
      setForm({ title: "", category: "medical", description: "", fileType: "pdf" });
      toast({ title: "Document added", description: "Document saved to the vault." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "documents"] });
      toast({ title: "Document removed" });
    },
  });

  const accessMutation = useMutation({
    mutationFn: ({ id, cgAccess }: { id: number; cgAccess: string }) =>
      apiRequest("PATCH", `/api/documents/${id}/access`, { cgAccess }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "documents"] });
    },
    onError: () => toast({ title: "Could not update access", variant: "destructive" }),
  });

  // Log CG access (view/download) and notify MC
  const logAccessMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      apiRequest("POST", `/api/documents/${id}/access-log`, { action }),
  });

  // Filter: CG only sees docs where cgAccess !== 'none'
  const visibleDocs = isCG
    ? documents.filter(d => d.cgAccess && d.cgAccess !== "none")
    : documents;

  const filtered = categoryFilter === "All"
    ? visibleDocs
    : visibleDocs.filter(d => d.category.toLowerCase() === categoryFilter.toLowerCase());

  // Access log query per-document (lazy, only fetches when MC expands)
  const { data: accessLog = [] } = useQuery({
    queryKey: ["/api/documents", expandedLog, "access-log"],
    queryFn: () => expandedLog
      ? apiRequest("GET", `/api/documents/${expandedLog}/access-log`).then(r => r.json())
      : Promise.resolve([]),
    enabled: !!expandedLog && isMC,
  });

  function handleView(doc: Document) {
    if (isCG) {
      logAccessMutation.mutate({ id: doc.id, action: "view" });
    }
    toast({ title: "Opening document…", description: `${doc.title} — ${doc.fileType.toUpperCase()}` });
  }

  function handleDownload(doc: Document) {
    if (isCG) {
      logAccessMutation.mutate({ id: doc.id, action: "download" });
    }
    toast({ title: "Downloading…", description: `${doc.title} download started.` });
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5 w-full overflow-x-hidden" data-testid="documents-page">

      {/* Header */}
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} className="text-slate-600 dark:text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              {t("documents.title")}
            </h1>
            <p className="text-xs text-muted-foreground">Documents · Records · Insurance</p>
          </div>
        </div>
        <LessonLauncher pageKey="documents" />

        {/* MC Legal Disclaimer */}
        {isMC && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <span className="font-semibold">Document Responsibility Notice:</span> You are responsible for ensuring that any documents stored here comply with the digital document laws of your state, which may vary. Care Net Portal does not provide legal advice regarding document validity or storage requirements.
            </p>
          </div>
        )}

        {/* CG info banner */}
        {isCG && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900">
            <Shield size={14} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
              Only documents shared with you by the Main Contact are visible here. The family manages all document permissions.
            </p>
          </div>
        )}

        {/* Add Document — MC only */}
        {canUpload && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white"
                data-testid="add-document-btn"
              >
                <Plus size={15} /> Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Document Title</Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Insurance Card"
                    data-testid="doc-title-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="emergency">Emergency / DNR</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="personal">Personal (ID, SSN)</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>File Type</Label>
                    <Select value={form.fileType} onValueChange={v => setForm(f => ({ ...f, fileType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="doc">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of this document…"
                    rows={2}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  CG access is set automatically by category and can be changed after saving.
                </p>
                <Button
                  type="button"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => addMutation.mutate()}
                  disabled={!form.title || addMutation.isPending}
                  data-testid="save-document-btn"
                >
                  {addMutation.isPending ? "Saving…" : "Add to Vault"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              categoryFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
            data-testid={`filter-${cat.toLowerCase()}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">
            {canUpload
              ? "Add documents using the button above."
              : "No documents have been shared with you yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(doc => {
            const cgAccessInfo = ACCESS_LABELS[doc.cgAccess ?? "none"] ?? ACCESS_LABELS.none;
            const cgBadge = CG_ACCESS_BADGE[doc.cgAccess ?? "none"];
            const isLogExpanded = expandedLog === doc.id;

            return (
              <div
                key={doc.id}
                className="p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow space-y-3"
                data-testid={`doc-card-${doc.id}`}
              >
                {/* Doc header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileTypeIcon type={doc.fileType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{doc.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize inline-flex items-center", CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other)}>
                        {doc.category}
                      </span>
                      {/* MC sees the lock tier; CG sees their access badge */}
                      {isMC && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1", cgAccessInfo.color)}>
                          {cgAccessInfo.icon} {cgAccessInfo.label}
                        </span>
                      )}
                      {isCG && cgBadge && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1", cgBadge.color)}>
                          <Eye size={10} /> {cgBadge.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {doc.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
                )}
                <div className="text-xs text-muted-foreground">
                  Uploaded {new Date(doc.uploadedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs flex-1"
                    onClick={() => handleView(doc)}
                    data-testid={`view-doc-${doc.id}`}
                  >
                    <ExternalLink size={12} /> View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs flex-1"
                    onClick={() => handleDownload(doc)}
                    disabled={isCG && doc.cgAccess === "read"}
                    data-testid={`download-doc-${doc.id}`}
                  >
                    <Download size={12} />
                    {isCG && doc.cgAccess === "read" ? "View Only" : "Download"}
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`delete-doc-${doc.id}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>

                {/* MC: CG Access Lock Toggle */}
                {isMC && (
                  <div className="pt-1 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Shield size={11} /> Caregiver Access
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {(["none", "read", "full"] as const).map(tier => {
                        const info = ACCESS_LABELS[tier];
                        const isActive = (doc.cgAccess ?? "none") === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => {
                              if (!isActive) accessMutation.mutate({ id: doc.id, cgAccess: tier });
                            }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              isActive
                                ? "bg-teal-600 text-white border-teal-600"
                                : "bg-background border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                            )}
                            data-testid={`access-tier-${tier}-${doc.id}`}
                          >
                            {info.icon}
                            <span className="hidden sm:inline">{tier === "none" ? "Private" : tier === "read" ? "Read" : "Full"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MC: Access Log */}
                {isMC && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedLog(isLogExpanded ? null : doc.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      data-testid={`access-log-toggle-${doc.id}`}
                    >
                      <ClipboardList size={11} />
                      Access Log
                      {isLogExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    {isLogExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {accessLog.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No access events recorded.</p>
                        ) : (
                          accessLog.slice(0, 8).map((entry: any) => (
                            <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                              <span className="capitalize">{entry.action}ed</span>
                              <span>{new Date(entry.accessedAt).toLocaleDateString([], { month: "short", day: "numeric" })} {new Date(entry.accessedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
