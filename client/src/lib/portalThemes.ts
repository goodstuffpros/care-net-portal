// Shared portal theme config — kept here to avoid circular imports between
// CareHome.tsx, FamilyProfile.tsx, and App.tsx.

export const THEME_CONFIG: Record<string, { label: string; bg: string; border: string; accent: string; dot: string; text: string; card: string }> = {
  teal:  { label: "Calm Teal",   bg: "bg-teal-50 dark:bg-teal-950/30",   border: "border-teal-200 dark:border-teal-800",   accent: "bg-teal-500",  dot: "bg-teal-400", text: "text-teal-700 dark:text-teal-300", card: "hover:border-teal-400 dark:hover:border-teal-600" },
  sage:  { label: "Warm Sage",   bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", accent: "bg-green-500", dot: "bg-green-400", text: "text-green-700 dark:text-green-300", card: "hover:border-green-400 dark:hover:border-green-600" },
  slate: { label: "Calm Slate",  bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-700", accent: "bg-slate-500", dot: "bg-slate-400", text: "text-slate-700 dark:text-slate-300", card: "hover:border-slate-400 dark:hover:border-slate-500" },
  rose:  { label: "Gentle Rose", bg: "bg-rose-50 dark:bg-rose-950/30",   border: "border-rose-200 dark:border-rose-800",   accent: "bg-rose-500",  dot: "bg-rose-400",  text: "text-rose-700 dark:text-rose-300",  card: "hover:border-rose-400 dark:hover:border-rose-600" },
  amber: { label: "Muted Amber", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", accent: "bg-amber-500", dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300", card: "hover:border-amber-400 dark:hover:border-amber-600" },
};
