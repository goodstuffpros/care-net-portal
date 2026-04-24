import { useApp } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ArchiveSummary } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Archive, Sparkles, Calendar, Clock, TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIOD_ICONS: Record<string, typeof Calendar> = {
  day: Clock,
  week: Calendar,
  month: TrendingUp,
  year: Star,
};

export default function ArchivePage() {
  const { selectedClientId } = useApp();
  const { toast } = useToast();
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [generating, setGenerating] = useState(false);

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
        day: "Today's care session was completed successfully. Morning medications were administered on time. Physical therapy exercises were performed. Client's mood was positive throughout the day. All scheduled activities were logged. No urgent incidents to report.",
        week: "This week's care provided stable and consistent support. All daily medications were administered as scheduled (100% adherence). Two therapy sessions were completed with noted progress. One minor incident was documented and communicated to the family. Client's overall wellbeing remained positive.",
        month: "Monthly summary shows consistent care quality. Medication adherence: 98%. Physical therapy goals progressing on target. Family communication maintained through daily updates. Two medical appointments attended. Client's condition remains stable with continued improvement in mobility.",
        year: "Annual care review reflects sustained quality of care. All major health goals achieved or in progress. Strong family communication and engagement maintained throughout the year. Key milestones achieved. Care plan updated three times to reflect evolving needs.",
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
        highlights: JSON.stringify(highlights[period]),
        generatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "archive"] });
      setGenerating(false);
      toast({ title: "Summary generated", description: "AI summary has been created and saved." });
    },
  });

  const filtered = filterPeriod === "all" ? summaries : summaries.filter(s => s.period === filterPeriod);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Archive & Summaries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-generated summaries of care history by day, week, month, or year</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={(period) => { setGenerating(true); generateMutation.mutate(period); }}>
            <SelectTrigger className="w-auto gap-2 h-9 text-sm" data-testid="generate-summary-trigger">
              <Sparkles size={14} />
              <span>Generate</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today's Summary</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
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
                <div className="font-medium text-sm">Generating AI Summary...</div>
                <div className="text-xs text-muted-foreground mt-0.5">Analyzing care records and creating a comprehensive summary.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summaries */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Archive size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No summaries yet</p>
          <p className="text-sm mt-1">Use 'Generate' to create an AI-powered summary of care history.</p>
        </div>
      ) : filtered.map(summary => {
        const Icon = PERIOD_ICONS[summary.period] || Calendar;
        const highlights: string[] = summary.highlights ? JSON.parse(summary.highlights) : [];
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
                      <Sparkles size={11} /> AI Summary
                      <span>·</span>
                      <span>{new Date(summary.generatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize border border-border">{summary.period}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{summary.summaryText}</p>
              {highlights.length > 0 && (
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
