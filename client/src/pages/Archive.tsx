import { useApp } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ArchiveSummary, Client } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Archive, Sparkles, Calendar, Clock, TrendingUp, Star, Stethoscope, Users, Volume2, FileDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { speakBecky } from "@/lib/ttsUtils";
import { generateMedicalSummaryPDF } from "@/lib/generateMedicalSummaryPDF";

const PERIOD_ICONS: Record<string, typeof Calendar> = {
  day: Clock, week: Calendar, month: TrendingUp, quarter: Star, year: Star,
};

export default function ArchivePage() {
  const { selectedClientId, activeUser } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [summaryView, setSummaryView] = useState<"plain" | "medical">("plain");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("GET", "/api/clients").then(r => r.json()),
  });
  const client = clients.find(c => c.id === selectedClientId);

  const { data: summaries = [], isLoading } = useQuery<ArchiveSummary[]>({
    queryKey: ["/api/clients", selectedClientId, "archive"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/archive`).then(r => r.json()),
  });

  const [genPeriod, setGenPeriod] = useState<string | null>(null);
  const generateMutation = useMutation({
    mutationFn: async (period: string) => {
      const r = await apiRequest("POST", `/api/clients/${selectedClientId}/archive/generate`, { period });
      return r.json();
    },
    onMutate: (period) => { setGenerating(true); setGenPeriod(period); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "archive"] });
      toast({ title: "Summary ready", description: "Plain-language and medical versions were written from your care log." });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "").replace(/^\d+: /, "");
      let text = msg;
      try { text = JSON.parse(msg).message || msg; } catch {}
      toast({ title: "Couldn't create the summary", description: text || "Please try again.", variant: "destructive" });
    },
    onSettled: () => { setGenerating(false); setGenPeriod(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/archive/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "archive"] }),
  });

  const filtered = filterPeriod === "all" ? summaries : summaries.filter(s => s.period === filterPeriod);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 w-full overflow-x-hidden">
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("archive.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">{t("archive.subtitle")}</p>
          </div>
        </div>

        {/* Generate Summary — written by AI strictly from this portal's records */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-foreground">Generate a summary</div>
          <div className="grid grid-cols-3 gap-2">
            {[["week", "Last 7 days"], ["month", "Last 30 days"], ["quarter", "Last 90 days"]].map(([p, label]) => (
              <Button key={p} size="sm" variant={genPeriod === p ? "default" : "outline"} disabled={generating}
                onClick={() => generateMutation.mutate(p)} data-testid={`generate-${p}`} className="h-9 text-xs">
                {genPeriod === p ? <><Sparkles size={13} className="animate-pulse" /> Writing…</> : label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{generating ? "Reading your care log and writing both versions. This takes about 15 seconds." : "Creates a plain-language version for family and a medical version for providers, using only what's in your care log, vitals, and medications."}</p>
        </div>
        {(activeUser.role === "self_care" || activeUser.role === "primary_family" || activeUser.isAdmin) && <a href="#/visit-report" className="flex items-center justify-center gap-2 w-full h-9 rounded-md text-sm font-medium border border-border hover:bg-muted">
          <Stethoscope size={14} /> Or build a Doctor Visit Report
        </a>}
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
        <button
          onClick={() => setSummaryView("plain")}
          className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", summaryView === "plain" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          data-testid="view-plain"
        >
          <Users size={14} /> Plain Language
        </button>
        <button
          onClick={() => setSummaryView("medical")}
          className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", summaryView === "medical" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          data-testid="view-medical"
        >
          <Stethoscope size={14} /> Clinical / Medical
        </button>
      </div>

      {summaryView === "medical" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
          <Stethoscope size={15} className="flex-shrink-0 mt-0.5" />
          <span>Clinical summaries use medical terminology and are formatted for healthcare providers, home health agencies, and insurance documentation.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "week", "month", "quarter"].map(p => (
          <button key={p} onClick={() => setFilterPeriod(p)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filterPeriod === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
            )} data-testid={`archive-filter-${p}`}
          >
            {({ all: "All", week: "7 days", month: "30 days", quarter: "90 days" } as Record<string, string>)[p]}
          </button>
        ))}
      </div>

      {/* Generating state */}
      {generating && generateMutation.isPending && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-primary animate-pulse" />
              <div>
                <div className="font-medium text-sm">Writing your summary…</div>
                <div className="text-xs text-muted-foreground mt-0.5">Reading the care log, vitals, and medications for this period.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summaries */}
      {isLoading ? (
        <div className="space-y-4">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Archive size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No summaries yet</p>
          <p className="text-sm mt-1">Choose 7, 30, or 90 days above to create one.</p>
        </div>
      ) : filtered.map(summary => {
        const Icon = PERIOD_ICONS[summary.period] || Calendar;
        const highlights: string[] = summary.highlights ? JSON.parse(summary.highlights) : [];
        const displayText = summaryView === "medical" && summary.summaryTextMedical
          ? summary.summaryTextMedical
          : summary.summaryText;

        return (
          <Card key={summary.id} className="border-border" data-testid={`summary-card-${summary.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{summary.periodLabel}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Sparkles size={11} />
                      {summaryView === "medical" ? "Clinical Summary" : "Plain-Language Summary"}
                      <span>·</span>
                      <span>{new Date(summary.generatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => speakBecky(displayText)}
                    data-testid={`summary-listen-${summary.id}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted border border-transparent hover:border-border"
                    title="Listen to this summary"
                  >
                    <Volume2 size={13} /> Listen
                  </button>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize border border-border">{summary.period}</span>
                  {summaryView === "medical" && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900 flex items-center gap-1">
                      <Stethoscope size={10} /> Clinical
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={cn("text-sm leading-relaxed whitespace-pre-line", summaryView === "medical" ? "text-foreground bg-muted/40 p-3 rounded-lg" : "text-muted-foreground")}>
                {displayText}
              </p>
              {highlights.length > 0 && summaryView === "plain" && (
                <div>
                  <div className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Highlights</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button variant="outline" size="sm" className="gap-2 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400"
                  disabled={!client} onClick={() => client && generateMedicalSummaryPDF(summary, client)} data-testid={`export-doctor-pdf-${summary.id}`}>
                  <FileDown size={14} /> Export for Doctor (PDF)
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="Delete summary"
                  onClick={() => { if (confirm("Delete this summary? This can't be undone.")) deleteMutation.mutate(summary.id); }}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
