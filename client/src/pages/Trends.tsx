import { useState } from "react";
import { useLang } from "@/lib/useLang";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Deterministic simulated data — 90 days
const generateMedData = (days: number) => {
  const base = [
    98, 97, 100, 95, 98, 99, 100, 92, 97, 98, 100, 96, 98, 99, 65, 98, 97, 100, 95, 98,
    99, 100, 98, 97, 95, 100, 98, 70, 99, 100, 97, 98, 99, 95, 100, 97, 98, 99, 100, 95,
    98, 97, 100, 62, 98, 99, 100, 97, 95, 98, 99, 100, 97, 98, 95, 100, 99, 98, 97, 95,
    100, 98, 99, 97, 95, 98, 100, 68, 97, 99, 100, 98, 95, 97, 99, 100, 98, 97, 95, 100,
    98, 99, 97, 95, 100, 97, 98, 99, 100, 95,
  ];
  const now = new Date();
  return base.slice(0, days).map((v, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString([], { month: "short", day: "numeric" }), value: v };
  });
};

const generateMoodData = (days: number) => {
  const base = [
    4, 3, 4, 4, 3, 4, 5, 3, 4, 4, 3, 4, 4, 4, 3, 5, 4, 3, 4, 4,
    3, 4, 5, 4, 3, 4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 4, 5, 4, 3, 4,
    4, 3, 4, 4, 5, 3, 4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 4, 5, 4, 3,
    4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 4, 5, 4,
    3, 4, 4, 3, 4, 5, 4, 3, 4, 4,
  ];
  const now = new Date();
  return base.slice(0, days).map((v, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString([], { month: "short", day: "numeric" }), value: v };
  });
};

const generateActivityData = (days: number) => {
  const base = [
    88, 92, 85, 90, 95, 88, 100, 85, 90, 92, 88, 95, 90, 85, 88, 92, 95, 88, 90, 85,
    92, 95, 88, 90, 85, 92, 88, 95, 90, 85, 92, 88, 90, 95, 85, 92, 88, 90, 85, 95,
    92, 88, 90, 85, 92, 95, 88, 90, 85, 92, 88, 95, 90, 85, 92, 88, 90, 95, 85, 92,
    88, 90, 85, 92, 95, 88, 90, 85, 92, 88, 95, 90, 85, 92, 88, 90, 95, 85, 92, 88,
    90, 85, 92, 95, 88, 90, 85, 92, 88, 95,
  ];
  const now = new Date();
  return base.slice(0, days).map((v, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString([], { month: "short", day: "numeric" }), value: v };
  });
};

// Weekly incident data (last 12 weeks)
const incidentData = [
  { week: "Wk 1", count: 0 }, { week: "Wk 2", count: 1 }, { week: "Wk 3", count: 0 },
  { week: "Wk 4", count: 2 }, { week: "Wk 5", count: 0 }, { week: "Wk 6", count: 1 },
  { week: "Wk 7", count: 0 }, { week: "Wk 8", count: 1 }, { week: "Wk 9", count: 0 },
  { week: "Wk 10", count: 2 }, { week: "Wk 11", count: 0 }, { week: "Wk 12", count: 1 },
];

const TIME_RANGE_VALUES = [7, 30, 90];

function tickEvery(data: { day: string; value: number }[], n: number) {
  return data.filter((_, i) => i % n === 0 || i === data.length - 1);
}

export default function TrendsPage() {
  const { t } = useLang();
  const [range, setRange] = useState(30);
  const TIME_RANGES = [
    { label: t("trends.7days"), value: 7 },
    { label: t("trends.30days"), value: 30 },
    { label: t("trends.90days"), value: 90 },
  ];
  const medData = generateMedData(range);
  const moodData = generateMoodData(range);
  const activityData = generateActivityData(range);
  const tickStep = range === 7 ? 1 : range === 30 ? 5 : 15;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 w-full overflow-x-hidden" data-testid="trends-page">
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("trends.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">Medications · Mood · Tasks</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-full">
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={cn(
                "flex-1 py-1.5 rounded-md text-sm font-medium transition-all",
                range === value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`range-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Medication Adherence */}
        <Card className="border-border" data-testid="chart-medication">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              Medication Adherence
            </CardTitle>
            <p className="text-xs text-muted-foreground">% of daily medications marked complete</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={medData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickStep - 1}
                />
                <YAxis
                  domain={[50, 100]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [`${v}%`, "Adherence"]}
                />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Incident Log */}
        <Card className="border-border" data-testid="chart-incidents">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              Incident Log
            </CardTitle>
            <p className="text-xs text-muted-foreground">Red/yellow priority activity logs per week</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={incidentData.slice(range === 7 ? 11 : range === 30 ? 8 : 0)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [v, "Incidents"]}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Mood Score */}
        <Card className="border-border" data-testid="chart-mood">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              Mood Score
            </CardTitle>
            <p className="text-xs text-muted-foreground">Scale 1–5 per day (5 = excellent)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={moodData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickStep - 1}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [v, "Mood"]}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#moodGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Completion */}
        <Card className="border-border" data-testid="chart-activity">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
              Activity Completion
            </CardTitle>
            <p className="text-xs text-muted-foreground">% of daily tasks completed</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={activityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickStep - 1}
                />
                <YAxis
                  domain={[60, 100]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [`${v}%`, "Completion"]}
                />
                <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Med Adherence", value: "96%", color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Avg Mood Score", value: "3.9/5", color: "text-blue-600 dark:text-blue-400" },
          { label: "Total Incidents", value: "7", color: "text-amber-600 dark:text-amber-400" },
          { label: "Avg Task Completion", value: "90%", color: "text-emerald-700 dark:text-emerald-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl border border-border bg-card text-center">
            <div className={cn("text-2xl font-bold", color)} style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
