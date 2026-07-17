/**
 * DobPicker — three-dropdown date of birth picker (Month / Day / Year)
 *
 * Props:
 *   value       — ISO date string "YYYY-MM-DD" or ""
 *   onChange    — called with "YYYY-MM-DD" when all three parts are set, or "" when cleared
 *   required    — if true, shows "Required" label suffix and exposes hasError for parent validation
 *   showError   — parent passes true after a failed submit attempt to show inline message
 *   id          — base id for accessibility
 */

import { useMemo } from "react";
import { Label } from "@/components/ui/label";

interface DobPickerProps {
  value: string;           // "YYYY-MM-DD" or ""
  onChange: (val: string) => void;
  required?: boolean;
  showError?: boolean;     // parent sets true after submit attempt if value is empty
  id?: string;
  label?: string;          // defaults to "Date of birth"
  className?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function parseValue(value: string): { year: number; month: number; day: number } {
  if (!value) return { year: 0, month: 0, day: 0 };
  const parts = value.split("-");
  return {
    year: parseInt(parts[0]) || 0,
    month: parseInt(parts[1]) || 0,
    day: parseInt(parts[2]) || 0,
  };
}

function toIso(year: number, month: number, day: number): string {
  if (!year || !month || !day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DobPicker({
  value,
  onChange,
  required = false,
  showError = false,
  id = "dob",
  label = "Date of birth",
  className = "",
}: DobPickerProps) {
  const { year, month, day } = parseValue(value);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= 1900; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const maxDay = daysInMonth(month, year);
  const days = useMemo(() => {
    const arr: number[] = [];
    for (let d = 1; d <= maxDay; d++) arr.push(d);
    return arr;
  }, [maxDay]);

  function handleMonth(e: React.ChangeEvent<HTMLSelectElement>) {
    const m = parseInt(e.target.value) || 0;
    // Clamp day if it exceeds days in new month
    const maxD = daysInMonth(m, year);
    const clampedDay = day > maxD ? maxD : day;
    onChange(toIso(year, m, clampedDay));
  }

  function handleDay(e: React.ChangeEvent<HTMLSelectElement>) {
    const d = parseInt(e.target.value) || 0;
    onChange(toIso(year, month, d));
  }

  function handleYear(e: React.ChangeEvent<HTMLSelectElement>) {
    const y = parseInt(e.target.value) || 0;
    onChange(toIso(y, month, day));
  }

  const isIncomplete = !year || !month || !day;
  const showInlineError = showError && isIncomplete;

  const selectClass = `
    flex-1 rounded-lg border bg-background px-2 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-primary/40
    ${showInlineError ? "border-destructive" : "border-border"}
  `.trim();

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={`${id}-month`} className="text-sm font-medium">
        {label}{" "}
        {required && (
          <span className="text-xs font-normal text-muted-foreground">Required</span>
        )}
      </Label>

      <div className="flex gap-2">
        {/* Month */}
        <select
          id={`${id}-month`}
          value={month || ""}
          onChange={handleMonth}
          className={selectClass}
          aria-label="Month"
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Day */}
        <select
          value={day || ""}
          onChange={handleDay}
          className={`${selectClass} max-w-[80px]`}
          aria-label="Day"
        >
          <option value="">Day</option>
          {days.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={year || ""}
          onChange={handleYear}
          className={`${selectClass} max-w-[100px]`}
          aria-label="Year"
        >
          <option value="">Year</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {showInlineError && (
        <p className="text-xs text-destructive">
          Please complete all required fields — date of birth is needed to continue.
        </p>
      )}
    </div>
  );
}
