/**
 * CaregiverProfile — public profile builder for caregivers
 *
 * Accessible from nav for caregiver roles only.
 * Two views:
 *  - Edit mode: form to fill in all profile sections
 *  - Preview mode: how it will appear in the public directory
 *
 * Publishing makes the profile visible in the public directory.
 * Caregivers can unpublish at any time.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp, isCaregiverRole } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  User, MapPin, BookOpen, Briefcase, GraduationCap,
  Calendar, Globe, Eye, EyeOff, Check, Pencil, Award,
  Heart, Sparkles, Shield, Star, Clock, Home, Phone, X, Navigation,
  SlidersHorizontal, Pill, Activity, CalendarCheck, Rocket, Trash2, ToggleLeft, ToggleRight
} from "lucide-react";
import type { CaregiverProfile } from "@shared/schema";

// ── Config ────────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SPECIALTY_OPTIONS = [
  "Dementia / Alzheimer's", "ALS / Parkinson's", "Post-surgery recovery",
  "Stroke recovery", "Hospice / Palliative", "Developmental disabilities",
  "Pediatric care", "Mental health support", "Diabetes management",
  "Fall prevention", "Mobility assistance", "Wound care",
];

const CARE_TYPE_OPTIONS = [
  "Companion care", "Personal care", "Skilled nursing support",
  "Medication management", "Transportation", "Meal preparation",
  "Light housekeeping", "Overnight care", "Live-in care",
];

const CERT_OPTIONS = [
  "None", "CNA", "HHA", "CPR / First Aid", "BLS", "CMA",
  "Dementia Care Specialist", "Hospice Certified", "Mental Health First Aid",
];

const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "Portuguese", "Mandarin",
  "Cantonese", "Tagalog", "Hindi", "Arabic", "Korean",
];

// ── Custom tag input ────────────────────────────────────────────────────────
// Allows caregivers to add free-form tags beyond the preset options

function CustomTagInput({
  tags, onAdd, onRemove, placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function handleAdd() {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setValue("");
    }
  }

  return (
    <div className="mt-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:text-red-500 transition-colors ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={placeholder ?? "Add custom tag…"}
          className="text-xs h-8"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} className="h-8 px-3 text-xs">
          Add
        </Button>
      </div>
    </div>
  );
}

// ── Tag toggle helper ──────────────────────────────────────────────────────────

function TagToggle({
  label, selected, onToggle, colorClass = "",
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition-all font-medium",
        selected
          ? "bg-primary text-white border-primary shadow-sm"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        colorClass
      )}
    >
      {label}
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary">{icon}</span>
        <h3 className="font-semibold text-sm text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ── Preview card ──────────────────────────────────────────────────────────────

function ProfilePreview({ profile, caregiverName, hearts }: {
  profile: Partial<CaregiverProfile>;
  caregiverName: string;
  hearts: number;
}) {
  const specialties = profile.specialties ? (() => { try { return JSON.parse(profile.specialties!); } catch { return []; } })() : [];
  const languages = profile.languages ? (() => { try { return JSON.parse(profile.languages!); } catch { return []; } })() : [];
  const certs = profile.certifications ? (() => { try { return JSON.parse(profile.certifications!); } catch { return []; } })() : [];
  const careTypes = profile.careTypes ? (() => { try { return JSON.parse(profile.careTypes!); } catch { return []; } })() : [];

  return (
    <div className="max-w-sm mx-auto bg-card border border-border rounded-2xl overflow-hidden shadow-md">
      {/* Header */}
      <div className="h-20 bg-gradient-to-r from-primary/20 to-primary/5" />
      <div className="-mt-10 px-5 pb-5">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl border-4 border-card bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary mb-3">
          {caregiverName.split(' ').map(n => n[0]).join('').slice(0,2)}
        </div>
        <div className="font-bold text-lg text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {profile.displayName || caregiverName}
        </div>
        {(profile.city || profile.state) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin size={11} />
            {[profile.city, profile.state].filter(Boolean).join(", ")}
          </div>
        )}

        {/* Hearts rating */}
        <div className="flex items-center gap-1 mt-2">
          {[1,2,3,4,5].map(i => (
            <Heart key={i} size={14} fill={i <= hearts ? "currentColor" : "none"} className={i <= hearts ? "text-rose-500" : "text-muted-foreground/30"} />
          ))}
          <span className="text-xs text-muted-foreground ml-1">{hearts}.0 / 5</span>
        </div>

        {/* Availability chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.hourlyAvailable && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40">
              Hourly
            </span>
          )}
          {profile.livesIn && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
              Live-in available
            </span>
          )}
          {profile.yearsExperience && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
              {profile.yearsExperience} yrs experience
            </span>
          )}
        </div>

        {profile.aboutMe && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-3 line-clamp-3">{profile.aboutMe}</p>
        )}

        {specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {specialties.slice(0, 4).map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s}</span>
            ))}
          </div>
        )}

        {certs.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <Shield size={11} className="text-primary" />
            {certs.map((c: string) => <span key={c} className="text-[10px] text-muted-foreground">{c}</span>)}
          </div>
        )}

        {languages.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <Globe size={11} className="text-primary" />
            <span className="text-[10px] text-muted-foreground">{languages.join(", ")}</span>
          </div>
        )}

        {/* Scope Badge */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1 mb-2">
            <SlidersHorizontal size={11} className="text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Care Scope</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { label: "Medications", icon: Pill, color: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200/60 dark:border-violet-800/40" },
              { label: "Vitals", icon: Activity, color: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40" },
              { label: "Appointments", icon: CalendarCheck, color: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40" },
              { label: "Care Log", icon: BookOpen, color: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40" },
              { label: "Messaging", icon: Award, color: "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200/60 dark:border-teal-800/40" },
            ].map(({ label, icon: Icon, color }) => (
              <span key={label} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${color}`}>
                <Icon size={9} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <Button size="sm" className="w-full mt-4 gap-2 text-xs">
          <Phone size={12} /> Send Inquiry
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CaregiverProfilePage() {
  const { activeUser, isPracticeClient, isShowcaseMode, sampleClientId } = useApp();
  const { toast } = useToast();
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // All hooks must run unconditionally before any early returns (React rules of hooks)
  const isCG = isCaregiverRole(activeUser.role);

  // Sample client data — only fetches when CG has a sample client
  const { data: practiceClient } = useQuery<any>({
    queryKey: ["/api/clients/practice", activeUser.id],
    queryFn: () => apiRequest("GET", `/api/clients/practice/${activeUser.id}`).then(r => r.json()),
    enabled: isCG && !!sampleClientId,
  });

  const showcaseMutation = useMutation({
    mutationFn: (isShowcase: boolean) =>
      apiRequest("PATCH", `/api/clients/practice/${sampleClientId}/showcase`, { isShowcase }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: isShowcaseMode ? "Showcase disabled" : "Showcase enabled", description: isShowcaseMode ? "Edit controls are visible again." : "Edit controls are hidden. You can show this portal to potential families." });
      window.location.replace("/");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/clients/practice/${sampleClientId}`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Sample client deleted", description: "Your portfolio portal has been cleared." });
      window.location.replace("/");
    },
  });

  // Only caregivers see this page — conditional return AFTER all hooks
  if (!isCG) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <User size={32} className="text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Public profiles are only available to caregivers.</p>
      </div>
    );
  }

  // Switch mutations for Option A
  const switchToSampleMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/clients/practice/switch-to-sample`, {}).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Switched to Sample Portal", description: "You are now viewing your professional showcase portal." });
      window.location.replace("/");
    },
  });

  const switchToRealMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/clients/practice/switch-to-real`, {}).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Switched to Real Portal", description: "Back to your active client portal." });
      window.location.replace("/");
    },
  });

  // Has real client = clientId exists and it isn't the sample
  const hasRealClient = !!activeUser.clientId && activeUser.clientId !== sampleClientId;

  return (
    <>
      <ProfileEditor userId={activeUser.id} caregiverName={activeUser.name} mode={mode} setMode={setMode} />

      {/* Sample Portal Management Card — visible whenever CG has a sample client */}
      {!!sampleClientId && (
        <div className="px-4 md:px-8 pb-10 max-w-3xl mx-auto">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">My Sample Portal</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {practiceClient?.primaryCondition ?? "Professional showcase"} ·{" "}
                  {isPracticeClient ? "Viewing now" : "Ready to use"}
                </p>
              </div>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium ${
                isPracticeClient
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
              }`}>
                {isPracticeClient ? "Active" : "Standby"}
              </span>
            </div>

            {/* Portal switch buttons */}
            <div className="flex gap-2 flex-wrap">
              {!isPracticeClient && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => switchToSampleMutation.mutate()}
                  disabled={switchToSampleMutation.isPending}
                  data-testid="switch-to-sample-btn"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  {switchToSampleMutation.isPending ? "Switching…" : "Switch to Sample Portal"}
                </Button>
              )}
              {isPracticeClient && hasRealClient && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => switchToRealMutation.mutate()}
                  disabled={switchToRealMutation.isPending}
                  data-testid="switch-to-real-btn"
                >
                  <User className="w-3.5 h-3.5" />
                  {switchToRealMutation.isPending ? "Switching…" : "Switch Back to Real Portal"}
                </Button>
              )}
            </div>

            {/* Showcase toggle — only when viewing sample */}
            {isPracticeClient && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                <div>
                  <p className="text-sm font-medium text-foreground">Showcase View</p>
                  <p className="text-xs text-muted-foreground">Hides edit controls — use when showing this portal to a potential family.</p>
                </div>
                <button
                  onClick={() => showcaseMutation.mutate(!isShowcaseMode)}
                  disabled={showcaseMutation.isPending}
                  className="ml-4 flex-shrink-0"
                  data-testid="showcase-toggle-btn"
                >
                  {isShowcaseMode
                    ? <ToggleRight className="w-8 h-8 text-amber-500" />
                    : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                </button>
              </div>
            )}

            {/* Delete — permanent action, shows confirmation */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400 hover:underline"
                data-testid="delete-sample-btn"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove sample portal
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 space-y-3">
                <p className="text-sm text-red-800 dark:text-red-300 font-medium">Remove sample portal permanently?</p>
                <p className="text-xs text-red-700 dark:text-red-400">All practice data will be deleted. You can always create a new one.</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="gap-1.5"
                    data-testid="confirm-delete-sample-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleteMutation.isPending ? "Removing…" : "Yes, remove it"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ProfileEditor({
  userId, caregiverName, mode, setMode,
}: {
  userId: number;
  caregiverName: string;
  mode: "edit" | "preview";
  setMode: (m: "edit" | "preview") => void;
}) {
  const { toast } = useToast();

  const { data: existing, isLoading } = useQuery<CaregiverProfile | null>({
    queryKey: ["/api/caregivers", userId, "profile"],
    queryFn: () => apiRequest("GET", `/api/caregivers/${userId}/profile`).then(r => r.json()),
  });

  // Local form state
  const [form, setForm] = useState({
    displayName: "", city: "", state: "", zipCode: "",
    travelDistance: "",
    aboutMe: "", carePhilosophy: "",
    yearsExperience: "",
    specialties: [] as string[],
    customSpecialties: [] as string[],
    careTypes: [] as string[],
    certifications: [] as string[],
    customCertifications: [] as string[],
    languages: [] as string[],
    livesIn: false, hourlyAvailable: true,
    education: "",
    availableDays: [] as string[],
    availableHours: "",
    availableStartDate: "",
    isPublic: false,
  });

  // Populate from existing profile
  useEffect(() => {
    if (!existing) return;
    const parseJSON = (v: string | null | undefined, fallback: string[]) => {
      if (!v) return fallback;
      try { return JSON.parse(v); } catch { return fallback; }
    };
    setForm({
      displayName: existing.displayName ?? "",
      city: existing.city ?? "",
      state: existing.state ?? "",
      zipCode: existing.zipCode ?? "",
      travelDistance: (existing as any).travelDistance ?? "",
      aboutMe: existing.aboutMe ?? "",
      carePhilosophy: existing.carePhilosophy ?? "",
      yearsExperience: existing.yearsExperience?.toString() ?? "",
      specialties: parseJSON(existing.specialties, []),
      customSpecialties: parseJSON((existing as any).customSpecialties, []),
      careTypes: parseJSON(existing.careTypes, []),
      certifications: parseJSON(existing.certifications, []),
      customCertifications: parseJSON((existing as any).customCertifications, []),
      languages: parseJSON(existing.languages, []),
      livesIn: existing.livesIn ?? false,
      hourlyAvailable: existing.hourlyAvailable ?? true,
      education: existing.education ?? "",
      availableDays: parseJSON(existing.availableDays, []),
      availableHours: existing.availableHours ?? "",
      availableStartDate: existing.availableStartDate ?? "",
      isPublic: existing.isPublic ?? false,
    });
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/caregivers/${userId}/profile`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caregivers", userId, "profile"] });
      toast({ title: "Profile saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save profile.", variant: "destructive" }),
  });

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  }

  function buildPayload() {
    return {
      displayName: form.displayName || null,
      city: form.city || null,
      state: form.state || null,
      zipCode: form.zipCode || null,
      travelDistance: form.travelDistance || null,
      aboutMe: form.aboutMe || null,
      carePhilosophy: form.carePhilosophy || null,
      yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
      specialties: JSON.stringify(form.specialties),
      customSpecialties: JSON.stringify(form.customSpecialties),
      careTypes: JSON.stringify(form.careTypes),
      certifications: JSON.stringify(form.certifications),
      customCertifications: JSON.stringify(form.customCertifications),
      languages: JSON.stringify(form.languages),
      livesIn: form.livesIn,
      hourlyAvailable: form.hourlyAvailable,
      education: form.education || null,
      availableDays: JSON.stringify(form.availableDays),
      availableHours: form.availableHours || null,
      availableStartDate: form.availableStartDate || null,
      isPublic: form.isPublic,
    };
  }

  const estimatedHearts = 4; // placeholder until real badge computed

  if (isLoading) {
    return <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <User size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              My Public Profile
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your profile in the Care Net Portal public directory. Families search here when looking for a caregiver.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant={mode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="gap-2"
            data-testid="profile-preview-toggle"
          >
            {mode === "edit" ? <><Eye size={14} /> Preview</> : <><Pencil size={14} /> Edit</>}
          </Button>
        </div>
      </div>

      {/* Published / unpublished banner */}
      <div className={cn(
        "flex items-center justify-between gap-3 mb-6 px-4 py-3 rounded-xl border text-sm",
        form.isPublic
          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400"
          : "bg-muted/50 border-border text-muted-foreground"
      )}>
        <div className="flex items-center gap-2">
          {form.isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>
            {form.isPublic
              ? "Your profile is published and visible in the directory."
              : "Your profile is private. Publish it to appear in the directory."}
          </span>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))}
          className={cn(
            "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
            form.isPublic
              ? "border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              : "border-primary text-primary hover:bg-primary/5"
          )}
          data-testid="profile-publish-toggle"
        >
          {form.isPublic ? "Unpublish" : "Publish Profile"}
        </button>
      </div>

      {/* PREVIEW MODE */}
      {mode === "preview" && (
        <div className="py-4">
          <p className="text-center text-xs text-muted-foreground mb-6">This is how your profile appears to families browsing the directory.</p>
          <ProfilePreview
            profile={buildPayload() as any}
            caregiverName={caregiverName}
            hearts={estimatedHearts}
          />
        </div>
      )}

      {/* EDIT MODE */}
      {mode === "edit" && (
        <div className="space-y-4">

          {/* Identity */}
          <Section icon={<User size={16} />} title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Display name</label>
                <Input
                  data-testid="profile-display-name"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder={caregiverName}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Years of experience</label>
                <Input
                  data-testid="profile-years-exp"
                  type="number" min="0" max="50"
                  value={form.yearsExperience}
                  onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))}
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">City</label>
                <Input
                  data-testid="profile-city"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Nashville"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">State</label>
                <Input
                  data-testid="profile-state"
                  value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  placeholder="e.g. TN"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Navigation size={11} /> Distance willing to travel
              </label>
              <Input
                data-testid="profile-travel-distance"
                value={form.travelDistance}
                onChange={e => setForm(f => ({ ...f, travelDistance: e.target.value }))}
                placeholder="e.g. Up to 25 miles from Nashville, TN"
              />
            </div>
          </Section>

          {/* About */}
          <Section icon={<BookOpen size={16} />} title="About Me">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Short introduction (shown in directory listing)</label>
                <Textarea
                  data-testid="profile-about"
                  value={form.aboutMe}
                  onChange={e => setForm(f => ({ ...f, aboutMe: e.target.value }))}
                  rows={2}
                  className="resize-none text-sm"
                  placeholder="A brief sentence or two about who you are as a caregiver…"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Care philosophy (shown on full profile)</label>
                <Textarea
                  data-testid="profile-philosophy"
                  value={form.carePhilosophy}
                  onChange={e => setForm(f => ({ ...f, carePhilosophy: e.target.value }))}
                  rows={4}
                  className="resize-none text-sm"
                  placeholder="What drives you in this work? What do you believe about good care?"
                />
              </div>
            </div>
          </Section>

          {/* Specialties */}
          <Section icon={<Briefcase size={16} />} title="Specialties & Care Types">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map(s => (
                    <TagToggle key={s} label={s}
                      selected={form.specialties.includes(s)}
                      onToggle={() => setForm(f => ({ ...f, specialties: toggleArray(f.specialties, s) }))}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 mb-1">Add your own specialties:</p>
                <CustomTagInput
                  tags={form.customSpecialties}
                  onAdd={tag => setForm(f => ({ ...f, customSpecialties: [...f.customSpecialties, tag] }))}
                  onRemove={tag => setForm(f => ({ ...f, customSpecialties: f.customSpecialties.filter(t => t !== tag) }))}
                  placeholder="e.g. Traumatic brain injury, Autism support…"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Types of care offered</label>
                <div className="flex flex-wrap gap-2">
                  {CARE_TYPE_OPTIONS.map(s => (
                    <TagToggle key={s} label={s}
                      selected={form.careTypes.includes(s)}
                      onToggle={() => setForm(f => ({ ...f, careTypes: toggleArray(f.careTypes, s) }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, hourlyAvailable: !f.hourlyAvailable }))}
                    className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      form.hourlyAvailable ? "bg-primary border-primary text-white" : "border-border")}
                  >
                    {form.hourlyAvailable && <Check size={11} />}
                  </div>
                  <span className="text-xs text-foreground">Available for hourly / part-time</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, livesIn: !f.livesIn }))}
                    className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      form.livesIn ? "bg-primary border-primary text-white" : "border-border")}
                  >
                    {form.livesIn && <Check size={11} />}
                  </div>
                  <span className="text-xs text-foreground">Available for live-in</span>
                </label>
              </div>
            </div>
          </Section>

          {/* Education & Credentials */}
          <Section icon={<GraduationCap size={16} />} title="Education & Credentials">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Education</label>
                <Input
                  data-testid="profile-education"
                  value={form.education}
                  onChange={e => setForm(f => ({ ...f, education: e.target.value }))}
                  placeholder="e.g. CNA Program, Nashville State Community College"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Certifications</label>
                <div className="flex flex-wrap gap-2">
                  {CERT_OPTIONS.map(c => (
                    <TagToggle key={c} label={c}
                      selected={form.certifications.includes(c)}
                      onToggle={() => setForm(f => ({ ...f, certifications: toggleArray(f.certifications, c) }))}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 mb-1">Add your own certifications:</p>
                <CustomTagInput
                  tags={form.customCertifications}
                  onAdd={tag => setForm(f => ({ ...f, customCertifications: [...f.customCertifications, tag] }))}
                  onRemove={tag => setForm(f => ({ ...f, customCertifications: f.customCertifications.filter(t => t !== tag) }))}
                  placeholder="e.g. IV Therapy, Trach Care…"
                />
              </div>
            </div>
          </Section>

          {/* Availability */}
          <Section icon={<Calendar size={16} />} title="Availability">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Available days</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map(d => (
                    <button
                      key={d}
                      onClick={() => setForm(f => ({ ...f, availableDays: toggleArray(f.availableDays, d) }))}
                      className={cn(
                        "w-11 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        form.availableDays.includes(d)
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Hours</label>
                  <Input
                    data-testid="profile-hours"
                    value={form.availableHours}
                    onChange={e => setForm(f => ({ ...f, availableHours: e.target.value }))}
                    placeholder="e.g. 7am–7pm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Available from</label>
                  <Input
                    data-testid="profile-start-date"
                    type="date"
                    value={form.availableStartDate}
                    onChange={e => setForm(f => ({ ...f, availableStartDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* Languages */}
          <Section icon={<Globe size={16} />} title="Languages">
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(l => (
                <TagToggle key={l} label={l}
                  selected={form.languages.includes(l)}
                  onToggle={() => setForm(f => ({ ...f, languages: toggleArray(f.languages, l) }))}
                />
              ))}
            </div>
          </Section>

          {/* Save button */}
          <div className="flex justify-end pt-2 pb-8">
            <Button
              onClick={() => saveMutation.mutate(buildPayload())}
              disabled={saveMutation.isPending}
              data-testid="profile-save-btn"
              className="gap-2"
            >
              {saveMutation.isPending ? "Saving…" : <><Check size={14} /> Save Profile</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
