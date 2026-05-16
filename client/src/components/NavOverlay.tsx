/**
 * NavOverlay — full-screen navigation grid
 * Replaces the dropdown menu. Tapping the hamburger opens this overlay.
 * Users can hold-and-drag tiles to reorder. Order is saved per user in the DB.
 *
 * Also hosts language, theme, color-palette, and user-switcher controls
 * (previously in sidebar only — now accessible from the overlay too).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Sun, Moon, BookHeart, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";
import { useApp, type ActiveUser, isCaregiverRole, type ColorTheme, type PortalMode } from "@/App";
import { ROLE_LABELS } from "@/components/AppLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavItem {
  path: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  emergency?: boolean;
}

// ── Tile color palette ────────────────────────────────────────────────────────
// Single calm tile style — white/off-white surface with teal icon accent.
// Emergency overrides to red at render time (intentional standout).
export const NAV_COLORS: Record<string, { color: string; bg: string }> = {};

// Shared tile classes — same for every module
// Light: white + gray keyboard-key shadow | Dark: near-black + subtle light shadow
const TILE_BG    = "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700";
const TILE_BG_FC = "bg-white dark:bg-zinc-900 border-rose-100  dark:border-zinc-700";
const TILE_ICON_COLOR    = "text-teal-600 dark:text-teal-400";
const TILE_ICON_COLOR_FC = "text-rose-500 dark:text-rose-400";
const TILE_LABEL_COLOR    = "text-teal-700 dark:text-teal-300";
const TILE_LABEL_COLOR_FC = "text-rose-600 dark:text-rose-300";

// ── Color swatches ────────────────────────────────────────────────────────────

const COLOR_SWATCHES: { key: ColorTheme; color: string; label: string }[] = [
  { key: "teal",     color: "#2a8c7a", label: "Teal" },
  { key: "sand",     color: "#7a4a1f", label: "Sand" },
  { key: "navy",     color: "#2a4a9a", label: "Navy" },
  { key: "lavender", color: "#6a3a9a", label: "Lavender" },
];

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
// Strategy: two-phase pick-up model
//   Phase 1 — HOLD: finger down + still for HOLD_MS → tile lifts (picked up)
//             Movement > CANCEL_THRESHOLD before HOLD_MS fires → scroll, cancel
//   Phase 2 — HOVER: dragged tile tracks pointer; overIdx updates smoothly
//             On pointer-up → drop at overIdx (or back to fromIdx if none)
//   Keys:
//   • CANCEL_THRESHOLD raised to 18px — prevents accidental scroll cancellation
//   • HOLD_MS lowered to 300ms — feels snappy without being hair-trigger
//   • overIdx only committed on pointer-up, not mid-drag — no hopping
//   • Haptic feedback (vibrate) on pickup if supported

const CANCEL_THRESHOLD = 18;
const HOLD_MS = 300;

interface DragState {
  fromIdx: number;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  isDragging: boolean;
  scrollCancelled: boolean;
  pointerId: number;
  currentOverIdx: number | null;
}

function useDragOrder<T extends { path: string }>(
  initialItems: T[],
  onSave: (paths: string[]) => void
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ds = useRef<DragState | null>(null);

  useEffect(() => { setItems(initialItems); }, [initialItems.map(i => i.path).join(",")]);

  // ── Document-level listeners ──────────────────────────────────────────────
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = ds.current;
      if (!d || e.pointerId !== d.pointerId) return;

      if (!d.isDragging) {
        // Pre-drag: cancel if finger moved too far (scroll gesture)
        if (!d.scrollCancelled) {
          const dx = Math.abs(e.clientX - d.startX);
          const dy = Math.abs(e.clientY - d.startY);
          if (dx > CANCEL_THRESHOLD || dy > CANCEL_THRESHOLD) {
            d.scrollCancelled = true;
            if (d.timer) { clearTimeout(d.timer); d.timer = null; }
          }
        }
        return;
      }

      // Active drag: track which tile pointer is hovering
      let found: number | null = null;
      tileRefs.current.forEach((el, i) => {
        if (!el || i === d.fromIdx) return;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top  && e.clientY <= r.bottom) {
          found = i;
        }
      });
      // Update visual highlight only — actual swap happens on pointer-up
      d.currentOverIdx = found;
      setOverIdx(found);
    }

    function onUp(e: PointerEvent) {
      const d = ds.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.timer) { clearTimeout(d.timer); d.timer = null; }
      // Commit the drop here at document level — reliable on mobile
      if (d.isDragging) {
        const from = d.fromIdx;
        const over = d.currentOverIdx;
        if (over !== null && over !== from) {
          setItems(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(over, 0, moved);
            onSave(next.map(i => i.path));
            return next;
          });
        }
        ds.current = null;
        setDraggingIdx(null);
        setOverIdx(null);
      }
    }

    function onCancel(e: PointerEvent) {
      const d = ds.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.timer) { clearTimeout(d.timer); d.timer = null; }
      ds.current = null;
      setDraggingIdx(null);
      setOverIdx(null);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [onSave]);

  // ── Per-tile handlers ─────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;

    const timer = setTimeout(() => {
      const d = ds.current;
      if (!d || d.scrollCancelled || d.pointerId !== pointerId) return;
      d.isDragging = true;
      d.currentOverIdx = null;
      setDraggingIdx(idx);
      // Haptic feedback on pickup
      if (navigator.vibrate) navigator.vibrate(30);
    }, HOLD_MS);

    ds.current = { fromIdx: idx, startX, startY, timer, isDragging: false, scrollCancelled: false, pointerId, currentOverIdx: null };
  }, []);

  const handlePointerUp = useCallback((_e: React.PointerEvent, idx: number) => {
    const d = ds.current;
    if (!d) return false;
    // If document-level onUp already handled the drop, ds.current is null — nothing to do
    // This handler only runs if document onUp didn't fire (e.g. fast tap)
    const wasDragging = d.isDragging;
    const wasScroll = d.scrollCancelled;
    if (!wasDragging) {
      // Clean up timers on fast tap
      if (d.timer) { clearTimeout(d.timer); d.timer = null; }
      ds.current = null;
    }
    return wasDragging || wasScroll;
  }, []);

  return { items, tileRefs, draggingIdx, overIdx, handlePointerDown, handlePointerUp };
}

// ── Main component ────────────────────────────────────────────────────────────

interface NavOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  userId: number;
  savedOrder: string[] | null;
  onOrderSave: (paths: string[]) => void;
}

export default function NavOverlay({
  isOpen,
  onClose,
  navItems,
  userId,
  savedOrder,
  onOrderSave,
}: NavOverlayProps) {
  const [, navigate] = useLocation();
  const { t, lang, setLang } = useLang();
  const { activeUser, theme, toggleTheme, colorTheme, setColorTheme, portalMode, setPortalMode, isRealSession } = useApp();

  // Apply saved order
  const orderedItems = (() => {
    if (!savedOrder || savedOrder.length === 0) return navItems;
    const map = new Map(navItems.map(i => [i.path, i]));
    const ordered: NavItem[] = [];
    savedOrder.forEach(p => { const item = map.get(p); if (item) ordered.push(item); });
    navItems.forEach(i => { if (!savedOrder.includes(i.path)) ordered.push(i); });
    return ordered;
  })();

  const { items, tileRefs, draggingIdx, overIdx, handlePointerDown, handlePointerUp } =
    useDragOrder(orderedItems, onOrderSave);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleTileClick = (path: string) => {
    navigate(path);
    onClose();
  };

  const FCP_HIDDEN_PATHS = ["/badges", "/thoughts", "/care-scope", "/wellbeing", "/my-profile", "/trends", "/university"];
  const regularItems = items
    .filter(i => !i.emergency)
    .filter(i => portalMode !== "family" || !FCP_HIDDEN_PATHS.includes(i.path));
  const emergencyItem = items.find(i => i.emergency);


  const isDraggingAny = draggingIdx !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Overlay panel */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-250 ease-out overflow-y-auto",
          isOpen ? "translate-y-0 pointer-events-auto" : "-translate-y-full pointer-events-none"
        )}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* ── How This Works — fires once on first ever open ── */}
        {/* ModuleIntro disabled during bug sweep — re-enable when nav is finalized */}
        {/* {isOpen && <ModuleIntro moduleKey="nav-overlay" />} */}

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2
              className="text-base font-bold text-foreground"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
            >
              Navigate
            </h2>
            <p className="text-[11px] text-muted-foreground">Hold a tile to drag &amp; reorder</p>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1.5">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border"
              aria-label="Toggle language"
              data-testid="nav-overlay-lang"
            >
              {lang === "en" ? "ES" : "EN"}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle theme"
              data-testid="nav-overlay-theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Becky Admin — David (11) and Becky (12) only, never visible to other users */}
            {(activeUser.id === 11 || activeUser.id === 12) && (
              <a
                href={`${"__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__"}/becky-admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Response Library"
                data-testid="nav-overlay-admin"
                title="Becky's Response Library"
              >
                <BookHeart size={16} />
              </a>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close menu"
              data-testid="nav-overlay-close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="flex-1 p-2">
          {/* 4 columns always — compact tiles for all screen sizes */}
          <div
            className="grid grid-cols-4 gap-1"
            style={{ touchAction: isDraggingAny ? "none" : "pan-y" }}
          >
            {regularItems.map((item, idx) => {
              const Icon = item.icon;
              const label = t(item.labelKey);
              const isDragging = draggingIdx === idx;
              const isOver = overIdx === idx && draggingIdx !== idx;
              const isFC = portalMode === "family";

              return (
                <div
                  key={item.path}
                  ref={el => { tileRefs.current[idx] = el; }}
                  onPointerDown={e => handlePointerDown(e, idx)}
                  onPointerUp={e => {
                    const suppress = handlePointerUp(e, idx);
                    if (!suppress) handleTileClick(item.path);
                  }}
                  data-testid={`nav-tile-${item.path.replace("/", "") || "home"}`}
                  style={{
                    touchAction: isDraggingAny ? "none" : "pan-y",
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 px-1 py-2.5 h-[72px] rounded-xl border cursor-pointer select-none",
                    "transition-all duration-150",
                    // Light: white tile, gray keyboard-key drop-shadow
                    // Dark: near-black tile, subtle light-gray keyboard-key drop-shadow
                    "[box-shadow:0_4px_0_0_rgba(0,0,0,0.18),0_1px_4px_rgba(0,0,0,0.10)] dark:[box-shadow:0_4px_0_0_rgba(255,255,255,0.07),0_1px_4px_rgba(0,0,0,0.40)]",
                    isFC ? TILE_BG_FC : TILE_BG,
                    isDragging && "opacity-40 scale-95 ring-2 ring-primary/40",
                    isOver && "ring-2 ring-primary ring-offset-1 scale-[1.04]",
                    !isDragging && !isOver && "active:scale-95 active:translate-y-[3px] [&:active]:[box-shadow:0_1px_0_0_rgba(0,0,0,0.18)] dark:[&:active]:[box-shadow:0_1px_0_0_rgba(255,255,255,0.07)] hover:scale-[1.02]"
                  )}
                >
                  <Icon size={24} className={isFC ? TILE_ICON_COLOR_FC : TILE_ICON_COLOR} />
                  <span className={cn(
                    "text-xs font-semibold text-center leading-tight",
                    isFC ? TILE_LABEL_COLOR_FC : TILE_LABEL_COLOR
                  )}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Emergency — pinned at bottom */}
          {emergencyItem && (() => {
            const Icon = emergencyItem.icon;
            return (
              <div className="mt-3">
                <div
                  onClick={() => handleTileClick(emergencyItem.path)}
                  data-testid="nav-tile-emergency"
                  className="flex items-center gap-3 p-3.5 rounded-2xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/60 dark:bg-black/20">
                    <Icon size={18} className="text-red-700 dark:text-red-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {t(emergencyItem.labelKey)}
                    </span>
                    <p className="text-[11px] text-red-500">Always accessible — pinned</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Footer: Color Palette + User Switcher ── */}
        <div className="shrink-0 px-4 pt-2 pb-3 border-t border-border space-y-2.5">
          {/* Portal Mode Toggle — demo users + admin accounts only.
               Regular real users cannot switch portals; their role determines it.
               TODO: replace isAdmin email-match with DB flag pre-launch. */}
          {(!isRealSession || activeUser.isAdmin) && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground flex-shrink-0">Portal mode</span>
            <div className="flex items-center rounded-lg border border-border overflow-hidden ml-1" style={{ fontSize: 11 }}>
              <button
                onClick={() => setPortalMode("family")}
                data-testid="portal-mode-family"
                className={cn(
                  "px-2.5 py-1 font-medium transition-colors",
                  portalMode === "family"
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={portalMode === "family" ? { background: "hsl(345, 52%, 36%)" } : {}}
              >
                Family Care
              </button>
              <button
                onClick={() => setPortalMode("dedicated")}
                data-testid="portal-mode-dedicated"
                className={cn(
                  "px-2.5 py-1 font-medium transition-colors",
                  portalMode === "dedicated"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Dedicated CG
              </button>
            </div>
          </div>
          )}

          {/* Color palette row — hidden in family mode (fixed rose) */}
          {portalMode !== "family" && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Color theme</span>
            <div className="flex items-center gap-1.5 ml-1">
              {COLOR_SWATCHES.map(({ key, color, label }) => (
                <button
                  key={key}
                  onClick={() => setColorTheme(key)}
                  title={label}
                  aria-label={`Color theme: ${label}`}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-all",
                    colorTheme === key ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          )}
          {/* Notification Preferences link */}
          <button
            onClick={() => { onClose(); navigate("/notification-prefs"); }}
            data-testid="nav-overlay-notif-prefs"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Bell size={14} className="flex-shrink-0" />
            <span>Notification preferences</span>
          </button>

          {/* User identity pill */}
          <div
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30"
            data-testid="nav-overlay-user-pill"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {activeUser.avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{activeUser.name}</div>
              <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[activeUser.role]}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
