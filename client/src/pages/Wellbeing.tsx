import { Heart, Clock, Shield } from "lucide-react";
import { LessonLauncher } from "@/components/LessonLauncher";

export default function WellbeingPage() {
  return (
    <div className="p-4 space-y-5 max-w-xl mx-auto pb-10">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="pb-3 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <Heart size={20} className="text-rose-600 dark:text-rose-400 fill-rose-600 dark:fill-rose-400" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Your Wellbeing
            </h1>
            <p className="text-xs text-muted-foreground">A private space — just for you.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Caregiving is one of the hardest jobs there is. This is a space to check in
          on yourself — share how you are feeling and receive real feedback and
          encouragement from an experienced caregiver. Everything here is completely
          private. No one else ever sees it.
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Shield size={12} className="flex-shrink-0" />
          <span>Never shared with clients, families, or employers.</span>
        </div>

        {/* Page Tutorial pill */}
        <LessonLauncher pageKey="wellbeing" />
      </div>

      {/* ── Coming Soon banner ──────────────────────────────── */}
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-rose-500 flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-rose-500">Coming Soon</span>
        </div>
        <p className="text-sm font-medium leading-snug text-foreground">
          Check in here when you need some feedback or encouragement from an experienced caregiver.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We are putting the finishing touches on this feature to make sure it is ready
          for you. It will be available soon — watch for the update.
        </p>
      </div>

    </div>
  );
}
