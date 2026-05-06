import { useApp, isCaregiverRole } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Document } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FolderOpen, FileText, Image, File, Lock, Plus, Trash2,
  ExternalLink, Download, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Insurance", "Legal", "Medical", "Financial", "Other"] as const;
const CATEGORY_COLORS: Record<string, string> = {
  insurance: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  legal: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
  medical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  financial: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  other: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
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
  const canDelete = isCaregiverRole(activeUser.role);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "medical", description: "", fileType: "pdf", isConfidential: false,
  });

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/clients", selectedClientId, "documents"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/documents`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/documents`, {
      ...form,
      uploadedByUserId: activeUser.id,
      uploadedAt: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "documents"] });
      setAddOpen(false);
      setForm({ title: "", category: "medical", description: "", fileType: "pdf", isConfidential: false });
      toast({ title: "Document added", description: "Document saved to the vault." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const filtered = categoryFilter === "All"
    ? documents
    : documents.filter(d => d.category.toLowerCase() === categoryFilter.toLowerCase());

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden" data-testid="documents-page">
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} className="text-slate-600 dark:text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("documents.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">Documents · Records · Insurance</p>
          </div>
        </div>
        {canDelete && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 w-full" data-testid="add-document-btn">
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
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
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
                    placeholder="Brief description of this document..."
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confidential"
                    checked={form.isConfidential}
                    onChange={e => setForm(f => ({ ...f, isConfidential: e.target.checked }))}
                    className="rounded"
                    data-testid="doc-confidential-checkbox"
                  />
                  <Label htmlFor="confidential" className="cursor-pointer">Mark as confidential</Label>
                </div>
                <Button
                  className="w-full"
                  onClick={() => addMutation.mutate()}
                  disabled={!form.title || addMutation.isPending}
                  data-testid="save-document-btn"
                >
                  {addMutation.isPending ? "Saving..." : "Add to Vault"}
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
          <p className="text-sm mt-1">{canDelete ? "Add documents using the button above." : "No documents have been uploaded yet."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(doc => (
            <div
              key={doc.id}
              className="p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow space-y-3"
              data-testid={`doc-card-${doc.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <FileTypeIcon type={doc.fileType} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm truncate">{doc.title}</div>
                    {doc.isConfidential && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                        <Lock size={10} /> Confidential
                      </span>
                    )}
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize mt-1 inline-block", CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.other)}>
                    {doc.category}
                  </span>
                </div>
              </div>
              {doc.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
              )}
              <div className="text-xs text-muted-foreground">
                Uploaded {new Date(doc.uploadedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs flex-1"
                  onClick={() => toast({ title: "Opening document...", description: `${doc.title} — ${doc.fileType.toUpperCase()}` })}
                  data-testid={`view-doc-${doc.id}`}
                >
                  <ExternalLink size={12} /> View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs flex-1"
                  onClick={() => toast({ title: "Downloading...", description: `${doc.title} download started.` })}
                  data-testid={`download-doc-${doc.id}`}
                >
                  <Download size={12} /> Download
                </Button>
                {canDelete && (
                  <Button
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
