import { useApp } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { Stethoscope, Search, Share2, Printer, MonitorSmartphone, Plus, Check, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildVisitReportPDF, visitReportFileName, priorityLabel, fmtDate, fmtDateTime, historyDate, medLine,
  CATEGORY_NAMES, HISTORY_TYPE_NAMES, ROLE_NAMES, ADDENDUM_NAMES,
  type VisitEntry, type VisitMedication, type VisitHistory,
} from "@/lib/generateVisitReportPDF";

interface ReportData {
  client: { name: string; dateOfBirth?: string | null; primaryCondition?: string | null; allergies?: string | null; diagnoses?: string | null };
  preparedBy: { name: string; role: string };
  entries: VisitEntry[];
  medications: VisitMedication[];
  healthHistory: VisitHistory[];
  questions: { id: number; text: string; author_user_id: number; created_at: string }[];
}

type RangeMode = "since" | "30" | "60" | "90" | "custom";
type ShowMode = "all" | "concerns" | "emergencies";

const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDay = (iso: string) => toYMD(new Date(iso));
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toYMD(d); };
const historyYMD = (h: VisitHistory) => h.date_year && h.date_month ? `${h.date_year}-${pad(h.date_month)}-${pad(h.date_day || 1)}` : null;
const ymdLabel = (ymd: string) => fmtDate(ymd + "T12:00:00");

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q || q.length < 2 || !text) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="bg-amber-200/70 dark:bg-amber-700/50 rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function VisitReportPage() {
  const { selectedClientId, activeUser } = useApp();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ["/api/clients", selectedClientId, "visit-report"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/clients/${selectedClientId}/visit-report`);
      return r.json();
    },
    enabled: !!selectedClientId,
    retry: false,
  });

  // ── 1. Time period ─────────────────────────────────────────────────────
  const anchors = useMemo(() => (data?.healthHistory ?? [])
    .map(h => ({ h, ymd: historyYMD(h) }))
    .filter((a): a is { h: VisitHistory; ymd: string } => !!a.ymd && a.ymd <= toYMD(new Date()))
    .sort((a, b) => b.ymd.localeCompare(a.ymd)), [data]);

  const [rangeMode, setRangeMode] = useState<RangeMode>("60");
  const [anchorId, setAnchorId] = useState<number | null>(null);
  const [customFrom, setCustomFrom] = useState(daysAgo(60));
  const [customTo, setCustomTo] = useState(toYMD(new Date()));
  const [initialized, setInitialized] = useState(false);

  // Default: since the most recent surgery in the last two years, otherwise 60 days
  useEffect(() => {
    if (!data || initialized) return;
    const surgery = anchors.find(a => a.h.entry_type === "surgery" && a.ymd >= daysAgo(730));
    if (surgery) { setRangeMode("since"); setAnchorId(surgery.h.id); }
    else if (anchors.length) setAnchorId(anchors[0].h.id);
    setInitialized(true);
  }, [data, anchors, initialized]);

  const anchor = anchors.find(a => a.h.id === anchorId) ?? null;
  const today = toYMD(new Date());
  const [from, to] = useMemo<[string, string]>(() => {
    if (rangeMode === "since" && anchor) return [anchor.ymd, today];
    if (rangeMode === "custom") return customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    const n = rangeMode === "since" ? 60 : Number(rangeMode);
    return [daysAgo(n), today];
  }, [rangeMode, anchor, customFrom, customTo, today]);

  const periodLabel = `${ymdLabel(from)} to ${ymdLabel(to)}${rangeMode === "since" && anchor ? ` (since ${anchor.h.title})` : ""}`;

  // ── 2. Choosing entries ────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [show, setShow] = useState<ShowMode>("all");
  const [author, setAuthor] = useState("all");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const inRange = useMemo(() => (data?.entries ?? []).filter(e => {
    const d = localDay(e.loggedAt);
    return d >= from && d <= to;
  }), [data, from, to]);

  const categories = useMemo(() => Array.from(new Set(inRange.map(e => e.category))), [inRange]);
  const authors = useMemo(() => Array.from(new Set(inRange.map(e => e.loggedByName))), [inRange]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inRange.filter(e => {
      if (cat !== "all" && e.category !== cat) return false;
      if (show === "concerns" && !(e.priority === "yellow" || e.priority === "red" || e.isEmergency)) return false;
      if (show === "emergencies" && !e.isEmergency) return false;
      if (author !== "all" && e.loggedByName !== author) return false;
      if (needle.length >= 2) {
        const hay = [e.title, e.description, e.notes, ...e.addenda.map(a => a.note)].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    }).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  }, [inRange, q, cat, show, author]);

  const included = shown.filter(e => !excluded.has(e.id));
  const toggle = (id: number) => setExcluded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAllShown = (on: boolean) => setExcluded(prev => { const n = new Set(prev); shown.forEach(e => on ? n.delete(e.id) : n.add(e.id)); return n; });

  // ── 3. Questions ───────────────────────────────────────────────────────
  const [newQ, setNewQ] = useState("");
  const [skipQ, setSkipQ] = useState<Set<number>>(new Set());
  const questions = data?.questions ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "visit-report"] });

  const addQ = useMutation({
    mutationFn: (text: string) => apiRequest("POST", `/api/clients/${selectedClientId}/visit-questions`, { text }),
    onSuccess: () => { setNewQ(""); refresh(); },
    onError: () => toast({ title: "Could not save that question", variant: "destructive" }),
  });
  const resolveQ = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/visit-questions/${id}/resolve`),
    onSuccess: () => { refresh(); toast({ title: "Marked as asked", description: "It won't appear on future reports." }); },
  });
  const deleteQ = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/visit-questions/${id}`),
    onSuccess: refresh,
    onError: () => toast({ title: "Only the person who wrote it can delete it", variant: "destructive" }),
  });

  // ── 4. Extras ──────────────────────────────────────────────────────────
  const [incMeds, setIncMeds] = useState(true);
  const [incHistory, setIncHistory] = useState(true);
  const [allHistory, setAllHistory] = useState(false);
  const [visitWith, setVisitWith] = useState("");
  const [visitReason, setVisitReason] = useState("");
  const [screenOpen, setScreenOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const historyForReport = useMemo(() => (data?.healthHistory ?? []).filter(h => {
    if (allHistory) return true;
    const ymd = historyYMD(h);
    return !!h.is_significant || (ymd !== null && ymd >= from);
  }), [data, allHistory, from]);

  const reportInput = () => ({
    client: data!.client,
    preparedBy: data!.preparedBy,
    visitWith: visitWith.trim(),
    visitReason: visitReason.trim(),
    periodLabel,
    entries: included,
    questions: questions.filter(x => !skipQ.has(x.id)).map(x => x.text),
    medications: incMeds ? data!.medications : null,
    healthHistory: incHistory ? historyForReport : null,
  });

  async function sharePdf() {
    if (!data) return;
    setBusy(true);
    try {
      const doc = buildVisitReportPDF(reportInput());
      const name = visitReportFileName(data.client.name);
      const file = new File([doc.output("blob")], name, { type: "application/pdf" });
      const nav = navigator as any;
      // Phones/tablets: open the share sheet (text, email, AirDrop, Files…). Computers: download.
      const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
      if (isTouch && nav.canShare && nav.canShare({ files: [file] })) {
        setBusy(false);
        try { await nav.share({ files: [file], title: "Doctor Visit Report" }); return; }
        catch (e: any) { if (e?.name === "AbortError") return; }
      }
      doc.save(name);
      toast({ title: "PDF saved", description: "Check your Downloads folder." });
    } catch (e) {
      console.error(e);
      toast({ title: "Could not create the PDF", variant: "destructive" });
    } finally { setBusy(false); }
  }

  function printPdf() {
    if (!data) return;
    const doc = buildVisitReportPDF(reportInput());
    doc.autoPrint();
    const url = doc.output("bloburl") as unknown as string;
    const w = window.open(url, "_blank");
    if (!w) { doc.save(visitReportFileName(data.client.name)); toast({ title: "PDF saved", description: "Open it and choose Print." }); }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-4 max-w-3xl mx-auto space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  if (error || !data) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-2">
        <Stethoscope className="mx-auto text-muted-foreground" />
        <p className="font-medium">Doctor Visit Reports are prepared by the person this portal is for, or their Main Contact.</p>
        <p className="text-sm text-muted-foreground">If you should have access, ask the Main Contact.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 w-full overflow-x-hidden pb-28">
      <div className="pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Stethoscope size={20} className="text-primary" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Doctor Visit Report</h1>
            <p className="text-xs text-muted-foreground">Show the care team what life has looked like between visits.</p>
          </div>
        </div>
      </div>

      {/* 1. Time period */}
      <Card><CardContent className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">1. Time period</h2>
        <div className="flex flex-wrap gap-2">
          {anchors.length > 0 && <Chip active={rangeMode === "since"} onClick={() => setRangeMode("since")}>Since an event</Chip>}
          <Chip active={rangeMode === "30"} onClick={() => setRangeMode("30")}>Last 30 days</Chip>
          <Chip active={rangeMode === "60"} onClick={() => setRangeMode("60")}>Last 60 days</Chip>
          <Chip active={rangeMode === "90"} onClick={() => setRangeMode("90")}>Last 90 days</Chip>
          <Chip active={rangeMode === "custom"} onClick={() => setRangeMode("custom")}>Pick dates</Chip>
        </div>
        {rangeMode === "since" && (
          <select
            value={anchorId ?? ""}
            onChange={e => setAnchorId(Number(e.target.value))}
            className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background"
          >
            {anchors.map(a => (
              <option key={a.h.id} value={a.h.id}>
                {historyDate(a.h)} - {HISTORY_TYPE_NAMES[a.h.entry_type] ?? a.h.entry_type}: {a.h.title}
              </option>
            ))}
          </select>
        )}
        {rangeMode === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground space-y-1">From<Input type="date" value={customFrom} max={today} onChange={e => setCustomFrom(e.target.value)} /></label>
            <label className="text-xs text-muted-foreground space-y-1">To<Input type="date" value={customTo} max={today} onChange={e => setCustomTo(e.target.value)} /></label>
          </div>
        )}
        <p className="text-sm"><span className="text-muted-foreground">Report covers:</span> {periodLabel}</p>
      </CardContent></Card>

      {/* 2. Entries */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-sm">2. Care log entries</h2>
          <span className="text-xs text-muted-foreground">{included.length} of {inRange.length} in report</span>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search, e.g. "pain" or "swelling"' className="pl-8 pr-8" />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={show === "all"} onClick={() => setShow("all")}>Everything</Chip>
          <Chip active={show === "concerns"} onClick={() => setShow("concerns")}>Concerns and urgent</Chip>
          <Chip active={show === "emergencies"} onClick={() => setShow("emergencies")}>Emergencies</Chip>
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>All types</Chip>
            {categories.map(c => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{CATEGORY_NAMES[c] ?? c}</Chip>)}
          </div>
        )}
        {authors.length > 1 && (
          <select value={author} onChange={e => setAuthor(e.target.value)} className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background">
            <option value="all">Logged by anyone</option>
            {authors.map(a => <option key={a} value={a}>Logged by {a}</option>)}
          </select>
        )}

        <p className="text-xs text-muted-foreground">What's listed here goes in the report. Uncheck anything you want to leave out.</p>
        {shown.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setAllShown(true)}>Include all listed</Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setAllShown(false)}>Uncheck all listed</Button>
          </div>
        )}

        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {shown.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No entries match. Try a wider time period or clear the search.</p>}
          {shown.map(e => {
            const on = !excluded.has(e.id);
            const tag = e.isEmergency ? "Emergency" : priorityLabel(e.priority);
            return (
              <label key={e.id} className={cn("flex gap-3 p-3 rounded-lg border cursor-pointer", on ? "border-border bg-card" : "border-dashed border-border/60 opacity-60")}>
                <Checkbox checked={on} onCheckedChange={() => toggle(e.id)} className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-sm"><Highlight text={e.title} q={q} /></span>
                    {tag && (
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded",
                        e.priority === "red" || e.isEmergency ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300")}>{tag}</span>
                    )}
                  </div>
                  {e.description && <p className="text-xs text-muted-foreground line-clamp-3"><Highlight text={e.description} q={q} /></p>}
                  <p className="text-[11px] text-muted-foreground/80">{fmtDateTime(e.loggedAt)} · {e.loggedByName} · {CATEGORY_NAMES[e.category] ?? e.category}</p>
                </div>
              </label>
            );
          })}
        </div>
      </CardContent></Card>

      {/* 3. Questions */}
      <Card><CardContent className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">3. Questions for the doctor</h2>
        <p className="text-xs text-muted-foreground">Add questions any time between visits. They're saved here and print on the first page.</p>
        {questions.map(x => (
          <div key={x.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border">
            <Checkbox checked={!skipQ.has(x.id)} onCheckedChange={() => setSkipQ(p => { const n = new Set(p); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n; })} className="mt-0.5" />
            <p className="text-sm flex-1 min-w-0">{x.text}</p>
            <button onClick={() => resolveQ.mutate(x.id)} className="text-xs text-primary flex items-center gap-1 shrink-0" title="Mark as asked"><Check size={13} /> Asked</button>
            {x.author_user_id === activeUser.id && (
              <button onClick={() => deleteQ.mutate(x.id)} className="text-muted-foreground shrink-0" aria-label="Delete question"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (newQ.trim()) addQ.mutate(newQ.trim()); }}>
          <Input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="e.g. Is the swelling in my leg normal?" maxLength={500} />
          <Button type="submit" size="sm" className="h-10 shrink-0" disabled={!newQ.trim() || addQ.isPending}><Plus size={14} /> Add</Button>
        </form>
      </CardContent></Card>

      {/* 4. Extras */}
      <Card><CardContent className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">4. Also include</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Medications <span className="text-xs text-muted-foreground">({data.medications.filter(m => m.status === "active").length} current)</span></span>
          <Switch checked={incMeds} onCheckedChange={setIncMeds} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Health history</span>
          <Switch checked={incHistory} onCheckedChange={setIncHistory} />
        </label>
        {incHistory && (
          <div className="flex flex-wrap gap-2 pl-1">
            <Chip active={!allHistory} onClick={() => setAllHistory(false)}>Important + this period ({(data.healthHistory ?? []).filter(h => !!h.is_significant || ((historyYMD(h) ?? "") >= from)).length})</Chip>
            <Chip active={allHistory} onClick={() => setAllHistory(true)}>All ({data.healthHistory.length})</Chip>
          </div>
        )}
        <div className="grid gap-2 pt-1">
          <Input value={visitWith} onChange={e => setVisitWith(e.target.value)} placeholder="Visit with (optional), e.g. Dr. Smith, Neurosurgery" />
          <Input value={visitReason} onChange={e => setVisitReason(e.target.value)} placeholder="Reason for visit (optional), e.g. 2-month post-surgery check" />
        </div>
      </CardContent></Card>

      {/* Actions */}
      <div className="space-y-2">
        <Button className="w-full h-11" onClick={sharePdf} disabled={busy || included.length === 0}><Share2 size={16} /> Save or share PDF</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={printPdf} disabled={included.length === 0}><Printer size={16} /> Print</Button>
          <Button variant="outline" className="h-11" onClick={() => setScreenOpen(true)} disabled={included.length === 0}><MonitorSmartphone size={16} /> Show on screen</Button>
        </div>
        {included.length === 0 && <p className="text-xs text-center text-muted-foreground">Choose at least one care log entry to create a report.</p>}
        <p className="text-[11px] text-center text-muted-foreground">Reports show corrected wording only. Marked "reported by the patient and family, not a medical record."</p>
      </div>

      {/* Show on screen — large text, hand the phone to the doctor */}
      <Dialog open={screenOpen} onOpenChange={setScreenOpen}>
        <DialogContent className="max-w-2xl w-[96vw] h-[92vh] overflow-y-auto p-5">
          <DialogHeader><DialogTitle className="text-2xl">{data.client.name}</DialogTitle></DialogHeader>
          <div className="space-y-5 text-base leading-relaxed">
            <p className="text-muted-foreground">{periodLabel}{visitReason ? ` · ${visitReason}` : ""}</p>
            <p><strong>{included.length}</strong> entries · <strong>{included.filter(e => e.priority !== "green" || e.isEmergency).length}</strong> concerns · <strong>{included.filter(e => e.isEmergency).length}</strong> emergencies</p>
            {questions.filter(x => !skipQ.has(x.id)).length > 0 && (
              <section><h3 className="text-lg font-bold mb-1">Questions</h3>
                <ol className="list-decimal pl-6 space-y-1">{questions.filter(x => !skipQ.has(x.id)).map(x => <li key={x.id}>{x.text}</li>)}</ol>
              </section>
            )}
            {incMeds && data.medications.length > 0 && (
              <section><h3 className="text-lg font-bold mb-1">Medications</h3>
                <ul className="space-y-1">{data.medications.filter(m => m.status === "active").map(m => <li key={m.id}>{medLine(m)}</li>)}</ul>
              </section>
            )}
            <section><h3 className="text-lg font-bold mb-2">Day by day</h3>
              <div className="space-y-4">
                {[...included].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)).map(e => (
                  <div key={e.id} className="border-b border-border pb-3">
                    <p className="text-sm text-muted-foreground">{fmtDateTime(e.loggedAt)} · {e.loggedByName}{e.loggedByRole && ROLE_NAMES[e.loggedByRole] ? ` (${ROLE_NAMES[e.loggedByRole]})` : ""}</p>
                    <p className={cn("font-semibold text-lg", (e.priority === "red" || e.isEmergency) && "text-red-700 dark:text-red-400", e.priority === "yellow" && "text-amber-700 dark:text-amber-400")}>
                      {e.title}{(e.isEmergency || e.priority !== "green") ? ` · ${e.isEmergency ? "Emergency" : priorityLabel(e.priority)}` : ""}
                    </p>
                    {e.description && <p>{e.description}</p>}
                    {e.notes && <p className="text-muted-foreground">Notes: {e.notes}</p>}
                    {e.corrections.map((c, i) => c.correctedText ? <p key={i} className="text-sm">Corrected: {c.correctedText}</p> : null)}
                    {e.addenda.map((a, i) => <p key={i} className="text-sm text-muted-foreground">Added {fmtDate(a.createdAt)} ({ADDENDUM_NAMES[a.tag] ?? "Note"}): {a.note}</p>)}
                  </div>
                ))}
              </div>
            </section>
            <p className="text-xs text-muted-foreground">Reported by the patient and family, not a medical record.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
