import { useApp } from "@/App";
import { LessonLauncher } from "@/components/LessonLauncher";
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
import { Archive, Sparkles, Calendar, Clock, TrendingUp, Star, Stethoscope, Users, Volume2, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { speakBecky } from "@/lib/ttsUtils";
import { generateDoctorPDF } from "@/lib/generateDoctorPDF";

const PERIOD_ICONS: Record<string, typeof Calendar> = {
  day: Clock, week: Calendar, month: TrendingUp, year: Star,
};

const MEDICAL_SUMMARIES: Record<string, string> = {
  day: "Patient presented stable hemodynamic status throughout the 24-hour care period. ADL assistance provided per care plan. Pharmacological regimen administered per prescribed schedule without adverse events. One safety incident documented (fall-risk behavior, no injury). Vital signs within acceptable parameters: BP 138/84 mmHg. Cognitive status: baseline per MCI diagnosis. No acute changes in neurological presentation. PRN analgesic administered for mild cephalgia, resolved within 60 minutes.",
  week: "7-day care summary: Pharmacological adherence rate 100%. Two scheduled physiotherapy sessions completed; functional improvement noted in UE grip strength (L side). One safety incident documented involving unsupported ambulation attempt; no injury sustained, family notified per protocol. Hemodynamic monitoring: mean BP trending elevated (138/86 mmHg avg); flagged for attending neurologist review at upcoming appointment. Cognitive baseline stable. Affect: euthymic, increased social interaction noted.",
  month: "30-day clinical summary: Medication reconciliation current. ADL performance: moderate assistance required for bathing, grooming; independent for oral feeding with setup. Physiotherapy goals progressing on established timeline. Neurologist follow-up completed; pharmacological adjustments under consideration. No hospitalizations or acute medical events. Caregiver–patient rapport well-established.",
  year: "Annual care documentation review: Longitudinal functional assessment indicates stable trajectory with incremental decline in left-side motor function consistent with post-CVA prognosis. Medication regimen reviewed and updated three times over reporting period. All scheduled specialist consultations completed. No emergency department visits or acute hospitalizations. Psychosocial wellbeing: positive family engagement maintained. Care plan updated Q4 months per interdisciplinary review.",
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

  const generateMutation = useMutation({
    mutationFn: (period: string) => {
      const labels: Record<string, string> = {
        day: new Date().toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }),
        week: "Week of " + new Date().toLocaleDateString([], { month: "long", day: "numeric" }),
        month: new Date().toLocaleDateString([], { month: "long", year: "numeric" }),
        year: new Date().getFullYear().toString(),
      };
      const summaryTemplates: Record<string, string> = {
        day: "Today's care session was completed successfully. Morning medications were administered on time. Physical therapy exercises were performed. The client's mood was positive throughout the day. All scheduled activities were logged. No urgent incidents to report.",
        week: "This week's care provided stable and consistent support. All daily medications were administered as scheduled with 100% adherence. Two therapy sessions were completed with noted progress. One minor incident was documented and communicated to the family. The client's overall wellbeing remained positive.",
        month: "Monthly summary shows consistent care quality. Medication adherence: 98%. Physical therapy goals progressing on target. Family communication maintained through daily updates. Two medical appointments attended. The client's condition remains stable with continued improvement in mobility.",
        year: "Annual care review reflects sustained quality of care. All major health goals were achieved or remain in progress. Strong family communication and engagement was maintained throughout the year. Key milestones were achieved and the care plan was updated three times to reflect evolving needs.",
      };
      const highlights: Record<string, string[]> = {
        day: ["Medications: ✓ On time", "PT exercises completed", "Good appetite and mood", "No incidents"],
        week: ["Medication adherence: 100%", "2 therapy sessions completed", "1 minor incident documented", "Mood: Positive"],
        month: ["Medication adherence: 98%", "PT goals on track", "2 medical appointments", "Condition: Stable"],
        year: ["All care goals met", "Family engagement high", "Care plan updated 3×", "Strong progress overall"],
      };
      return apiRequest("POST", `/api/clients/${selectedClientId}/archive`, {
        period,
        periodLabel: labels[period],
        summaryText: summaryTemplates[period],
        summaryTextMedical: MEDICAL_SUMMARIES[period],
        highlights: JSON.stringify(highlights[period]),
        generatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "archive"] });
      setGenerating(false);
      toast({ title: "Summary generated", description: "Both plain-language and clinical versions created." });
    },
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
        <LessonLauncher pageKey="archive" />
        <Select onValueChange={(period) => { setGenerating(true); generateMutation.mutate(period); }}>
          <SelectTrigger className="w-full gap-2 h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90 border-primary" data-testid="generate-summary-trigger">
            <Sparkles size={14} />
            <span>{t("archive.generateSummary")}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Today's Summary</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
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
        {["all", "day", "week", "month", "year"].map(p => (
          <button key={p} onClick={() => setFilterPeriod(p)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filterPeriod === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
            )} data-testid={`archive-filter-${p}`}
          >
            {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
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
                <div className="font-medium text-sm">Generating CareNet Summaries...</div>
                <div className="text-xs text-muted-foreground mt-0.5">Creating both plain-language and clinical versions.</div>
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
          <p className="text-sm mt-1">Use 'Generate' to create CareNet care summaries.</p>
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
              <p className={cn("text-sm leading-relaxed", summaryView === "medical" ? "text-foreground font-mono text-xs bg-muted/40 p-3 rounded-lg" : "text-muted-foreground")}>
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
              {summary.period === "month" && client && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                  onClick={() => generateDoctorPDF(summary, client)}
                  data-testid={`export-doctor-pdf-${summary.id}`}
                >
                  <FileDown size={14} /> {t("archive.exportDoctor")}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
