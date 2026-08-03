import { Switch, Route, Router, useLocation } from "wouter";
import { stopBecky } from "@/lib/ttsUtils";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, apiRequest, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AlarmEngine } from "@/components/AlarmEngine";
import InstallPrompt from "@/components/InstallPrompt";
import { createContext, useContext, useState, useEffect, useRef} from "react";
import { LangProvider } from "@/lib/LangContext";

// Pages
import DashboardPage from "@/pages/Dashboard";
import SchedulePage from "@/pages/Schedule";
import ActivityPage from "@/pages/Activity";
import MessagesPage from "@/pages/Messages";
import MediaPage from "@/pages/Media";
import ArchivePage from "@/pages/Archive";
import ClientPortalPage from "@/pages/ClientPortal";
import CaregiversPage from "@/pages/Caregivers";
import NotesPage from "@/pages/Notes";
import NotFound from "@/pages/not-found";
import HandoffPage from "@/pages/Handoff";
import TrendsPage from "@/pages/Trends";
import EmergencyPage from "@/pages/Emergency";
import DocumentsPage from "@/pages/Documents";
import OutingsPage from "@/pages/Outings";
import VitalsPage from "@/pages/Vitals";
import MedicationsPage from "@/pages/Medications";
import BadgesPage from "@/pages/Badges";
import ThoughtsPage from "@/pages/Thoughts";
import WellbeingPage from "@/pages/Wellbeing";
import UniversityPage from "@/pages/University";
import PatternsPage from "@/pages/Patterns";
import BeckyAdminPage from "@/pages/BeckyAdmin";
import AdminLogin, { getAdminToken, clearAdminToken } from "@/pages/AdminLogin";
import PricingPage from "@/pages/Pricing";
import BillingPage from "@/pages/Billing";
import FamilyPricingPage from "@/pages/FamilyPricing";
import CaregiverProfilePage from "@/pages/CaregiverProfile";
import FamilyProfilePage from "@/pages/FamilyProfile";
import CareScopePage from "@/pages/CareScope";
import OnboardingFlow from "@/components/OnboardingFlow";
import UpgradeTransition from "@/components/UpgradeTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Auth pages (public — no AppLayout)
import LoginPage from "@/pages/Login";
import ApplyPage from "@/pages/Apply";
import CompleteSignupPage from "@/pages/CompleteSignup";
import InviteLanding from "@/pages/InviteLanding";
import NotificationPrefs from "@/pages/NotificationPrefs";
import VerifyEmailPage from "@/pages/VerifyEmail";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";

// Legal pages (public — no AppLayout)
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import BetaAgreement from "@/pages/BetaAgreement";

// Onboarding wizard (real auth users only)
import OnboardingWizard from "@/pages/Onboarding";
import PreConnectionScreen from "@/pages/PreConnection";
import MCSetupWizard from "@/pages/MCSetupWizard";

// Layout
import AppLayout from "@/components/AppLayout";
import CareHomePage from "@/pages/CareHome";


// Role types
export type UserRole = "caregiver" | "temp_caregiver" | "multi_caregiver" | "primary_family" | "secondary_family" | "self_care";

export interface ActiveUser {
  id: number;
  name: string;
  role: UserRole;
  avatarInitials: string;
  clientId: number | null;
  tempAccessEnd?: string;
  // TODO: replace email-match with isAdmin DB column before public launch
  isAdmin?: boolean;
}

// Helper: is this user a caregiver-level role?
export function isCaregiverRole(role: UserRole) {
  return role === "caregiver" || role === "temp_caregiver" || role === "multi_caregiver";
}


export type ColorTheme = "teal" | "sage" | "slate" | "rose" | "amber" | "sand" | "navy" | "lavender";
export type PortalMode = "dedicated" | "family" | "client";

interface AppContextType {
  activeUser: ActiveUser;
  setActiveUser: (user: ActiveUser) => void;

  selectedClientId: number;
  setSelectedClientId: (id: number) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  appMode: "caregiver" | "precare";
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  triggerOnboarding: () => void;
  hasMultiplePortals: boolean;
  activeClientName: string;
  isTemporarilyElevated: boolean;
  elevationExpiresAt: string | null;
  returnToCareHome: () => void;
  switchPortal: (clientId: number, colorTheme: string) => void;
  multiPortalNudgeSnoozedUntil: string | null;
  mcBannerSnoozedUntil: string | null;
  setMcBannerSnoozedUntil: (val: string | null) => void;
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  showUpgradeTransition: boolean;
  triggerUpgradeTransition: (targetMode: PortalMode) => void;
  isRealSession: boolean; // always true — demo mode removed
  isPreConnection: boolean; // true when real CG session but no clientId yet
  sampleClientId: number | null; // permanent anchor — the CG's sample client (never cleared)
  isInSampleMode: boolean; // true when active clientId === sampleClientId
  isPracticeClient: boolean; // alias for isInSampleMode — kept for backward compat
  isShowcaseMode: boolean; // true when CG has enabled showcase view for their sample client
  isClientPortal: boolean; // true when user is self_care role (client viewing their own record)
  clientPermissionLevel: 'observer' | 'contributor' | 'self_care_mc' | null; // self_care users only
  contributorWelcomeSeen: boolean; // Phase 2: whether graduation banner has been dismissed
  setContributorWelcomeSeen: (seen: boolean) => void; // called after banner dismissal
  hasSeenMcInvitePrompt: boolean; // self_care only — one-time post-signup MC invite popup
  setHasSeenMcInvitePrompt: (seen: boolean) => void;
  loginCount: number;
  hasSeenHighFive: boolean;
  setHasSeenHighFive: (seen: boolean) => void;
  hasSeenOpenHand: boolean;
  setHasSeenOpenHand: (seen: boolean) => void;
  navOverlayOpen: boolean;
  setNavOverlayOpen: (open: boolean) => void;
  realUserEmail: string; // email of the logged-in real user (used for demo detection)
  onLogout: () => void;  // call to log out + reset to login screen
  fontSizePreference: "normal" | "large" | "x-large";
  setFontSizePreference: (size: "normal" | "large" | "x-large") => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

interface RealUser {
  id?: number;
  name?: string;
  role?: string;
  email: string;
  clientId?: number | null;
  sampleClientId?: number | null;
  permissionLevel?: string | null;
  contributorWelcomeSeen?: boolean;
  onboardingCompletedAt?: string | null;
  mcSetupCompletedAt?: string | null;
  carePathChoice?: string | null;
  multiPortalNudgeSnoozedUntil?: string | null;
  mcBannerSnoozedUntil?: string | null;
  elevatedUntil?: string | null;
  hasSeenMcInvitePrompt?: boolean;
  loginCount?: number;
  hasSeenHighFive?: boolean;
  hasSeenOpenHand?: boolean;
}

function MainApp({ realUser, onReturnToCareHome, onSwitchPortal, hasMultiplePortals: hasManyPortals, goToDashboard }: { realUser?: RealUser | null; onReturnToCareHome?: () => void; onSwitchPortal?: (clientId: number, colorTheme: string) => void; hasMultiplePortals?: boolean; goToDashboard?: boolean }) {
  // Pre-connection CGs (no clientId yet) fall through to the main app in demo mode.
  // A banner in AppLayout explains the situation and offers an invite shortcut.

  // Real MC who just completed setup — start in family portal mode
  const isMCReal = realUser?.role === "primary_family" || realUser?.role === "secondary_family";
  const isClientRole = realUser?.role === "self_care";
  // CGs start in dedicated mode — their own caregiver view with full CG nav
  const startPortalMode: PortalMode = isClientRole ? "client" : isMCReal ? "family" : "dedicated";

  // Admin email list — temporary until isAdmin DB column is wired pre-launch
  const ADMIN_EMAILS = ["goodstuffpros@gmail.com", "becky@carenetportal.com"];
  const isAdminEmail = ADMIN_EMAILS.includes(realUser?.email ?? "");

  // Build an ActiveUser from the real session
  const buildRealActiveUser = (): ActiveUser | null => {
    if (!realUser?.id || !realUser?.name || !realUser?.role) return null;
    return {
      id: realUser.id,
      name: realUser.name,
      role: realUser.role as UserRole,
      avatarInitials: realUser.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
      clientId: realUser.clientId ?? null,
      isAdmin: isAdminEmail,
    };
  };
  const initialActiveUser = buildRealActiveUser() ?? { id: 0, name: "Guest", role: "caregiver" as UserRole, avatarInitials: "G", clientId: null };
  const isRealSession = true; // demo mode removed
  const isPreConnection = !realUser?.clientId && realUser?.role !== 'self_care';

  const [activeUser, setActiveUser] = useState<ActiveUser>(initialActiveUser);
  const [selectedClientId, setSelectedClientId] = useState(realUser?.clientId ?? 1);
  const [sampleClientId, setSampleClientId] = useState<number | null>(realUser?.sampleClientId ?? null);
  const [isPracticeClient, setIsPracticeClient] = useState(false);
  const [isShowcaseMode, setIsShowcaseMode] = useState(false);
  const isClientPortal = realUser?.role === "self_care";
  const [clientPermissionLevel, setClientPermissionLevel] = useState<'observer' | 'contributor' | 'self_care_mc' | null>(
    (realUser?.permissionLevel as 'observer' | 'contributor' | 'self_care_mc' | null) ?? null
  );
  // Keep clientPermissionLevel in sync whenever realUser updates (e.g. after login)
  useEffect(() => {
    setClientPermissionLevel((realUser?.permissionLevel as 'observer' | 'contributor' | 'self_care_mc' | null) ?? null);
  }, [realUser?.permissionLevel]);
  const [contributorWelcomeSeen, setContributorWelcomeSeen] = useState<boolean>(realUser?.contributorWelcomeSeen ?? false);
  const [hasSeenMcInvitePrompt, setHasSeenMcInvitePrompt] = useState<boolean>(realUser?.hasSeenMcInvitePrompt ?? false);
  const [mcBannerSnoozedUntil, setMcBannerSnoozedUntil] = useState<string | null>((realUser as any)?.mcBannerSnoozedUntil ?? null);
  const [hasSeenHighFive, setHasSeenHighFive] = useState<boolean>(realUser?.hasSeenHighFive ?? false);
  const [hasSeenOpenHand, setHasSeenOpenHand] = useState<boolean>(realUser?.hasSeenOpenHand ?? false);
  const loginCount = realUser?.loginCount ?? 0;
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  // CG roles always use teal — portal color theme is the MC's choice, not the CG's
  const isCGRole = realUser?.role === "caregiver" || realUser?.role === "multi_caregiver" || realUser?.role === "temp_caregiver";
  const [colorTheme, setColorTheme] = useState<ColorTheme>(isCGRole ? "teal" : ((realUser as any)?._entryColorTheme || "teal"));
  const [portalMode, setPortalModeState] = useState<PortalMode>(startPortalMode);
  const [showUpgradeTransition, setShowUpgradeTransition] = useState(false);
  const [navOverlayOpen, setNavOverlayOpen] = useState(false);
  const [fontSizePreference, setFontSizePref] = useState<"normal" | "large" | "x-large">("normal");
  const setFontSizePreference = (size: "normal" | "large" | "x-large") => {
    setFontSizePref(size);
    apiRequest("PATCH", "/api/user/font-size", { fontSizePreference: size }).catch(() => {});
  };
  const [activeClientName, setActiveClientName] = useState<string>("");
  const isTemporarilyElevated = realUser?.role === "secondary_family" && !!realUser?.elevatedUntil && new Date(realUser.elevatedUntil) > new Date();
  const elevationExpiresAt = isTemporarilyElevated ? (realUser?.elevatedUntil ?? null) : null;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // ── On mount: redirect unbilled SC/MC to /portal first ───────────────────
  // So the billing gate has a consistent starting point.
  useEffect(() => {
    const isBillableRole = realUser?.role === "self_care" || realUser?.role === "primary_family";
    if (!isBillableRole) return;
    // Don’t redirect if already on billing or portal page
    const currentPath = window.location.hash.replace(/^#/, "").split("?")[0];
    if (currentPath === "/billing" || currentPath === "/portal") return;

    fetch("/api/billing/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const isActive = data.founderTier === "beta" || data.subscriptionStatus === "active";
        if (!isActive) {
          window.location.hash = "/portal";
        }
      })
      .catch(() => {}); // fail open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Billing gate — SC and MC portal creators only ────────────────────────
  // Fires when they navigate away from /portal before billing is complete.
  // Beta users (free forever) pass straight through.
  useEffect(() => {
    const isBillableRole = realUser?.role === "self_care" || realUser?.role === "primary_family";
    if (!isBillableRole) return;

    let billingActive = false; // cached result
    let checked = false;

    async function checkBilling() {
      if (checked) return billingActive;
      checked = true;
      try {
        const res = await fetch("/api/billing/status", { credentials: "include" });
        const data = await res.json();
        billingActive = data.founderTier === "beta" || data.subscriptionStatus === "active";
      } catch {
        billingActive = true; // fail open — don’t gate on error
      }
      return billingActive;
    }

    const onHashChange = async (e: HashChangeEvent) => {
      const newHash = new URL(e.newURL).hash;
      const newPath = newHash.replace(/^#/, "").split("?")[0];
      const oldHash = new URL(e.oldURL).hash;
      const oldPath = oldHash.replace(/^#/, "").split("?")[0];

      // Only intercept navigation AWAY from /portal to somewhere else in the app
      const isLeavingPortal = oldPath === "/portal" && newPath !== "/portal" && newPath !== "/billing";
      if (!isLeavingPortal) return;

      const isActive = await checkBilling();
      if (!isActive) {
        // Block the navigation — redirect to billing
        e.preventDefault?.();
        window.location.hash = "/billing";
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [realUser?.role]);

  useEffect(() => {
    const attr = portalMode === "client" ? "client" : colorTheme;
    document.documentElement.setAttribute("data-color-theme", attr);
    document.documentElement.setAttribute("data-portal-mode", portalMode);
  }, [colorTheme, portalMode]);

  function setPortalMode(mode: PortalMode) {
    if (mode === "dedicated" && portalMode === "family") {
      setShowUpgradeTransition(true);
    }
    setPortalModeState(mode);

  }

  function triggerUpgradeTransition() { setShowUpgradeTransition(false); }

  // When role changes, auto-select their client
  useEffect(() => {
    if (activeUser.clientId) {
      setSelectedClientId(activeUser.clientId);
    }
  }, [activeUser]);

  // When portal switches via Care Home, sync selectedClientId and colorTheme and go to dashboard
  const [, navigateTo] = useLocation();
  const isFirstPortalMount = useRef(true);
  useEffect(() => {
    if (realUser?.clientId) {
      setSelectedClientId(realUser.clientId);
    }
    // CG roles always stay teal — don't let portal switch override their color
    if ((realUser as any)?._entryColorTheme && !isCGRole) {
      setColorTheme((realUser as any)._entryColorTheme as ColorTheme);
    }
    // Skip navigation on first mount — only navigate on actual portal switches
    if (isFirstPortalMount.current) {
      isFirstPortalMount.current = false;
      return;
    }
    // Portal switched — always land on dashboard
    navigateTo("/");
  }, [realUser?.clientId]);

  // If coming from Care Home portal selection, navigate to dashboard on mount
  useEffect(() => {
    if (goToDashboard) {
      navigateTo("/");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs only on mount

  // Option A: detect sample mode and showcase flag.
  // sampleClientId is fetched from the user record (permanent anchor).
  // isInSampleMode = activeUser.clientId === sampleClientId.
  useEffect(() => {
    // Fetch user record to get sampleClientId (the permanent showcase anchor)
    if (activeUser.id) {
      fetch(`/api/users/${activeUser.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
        .then(r => r.json())
        .then((u: any) => {
          const scId: number | null = u?.sampleClientId ?? null;
          setSampleClientId(scId);
          // isInSampleMode = currently viewing sample client
          const inSample = scId !== null && activeUser.clientId === scId;
          setIsPracticeClient(inSample);
          if (!inSample) setIsShowcaseMode(false);
        })
        .catch(() => {});
      // Fetch font size preference
      fetch("/api/user/font-size", { headers: { Authorization: `Bearer ${getAuthToken()}` } })
        .then(r => r.json())
        .then((d: any) => { if (d?.fontSizePreference) setFontSizePref(d.fontSizePreference); })
        .catch(() => {});
    }
    // If in sample mode, also check showcase flag on the client record
    if (!activeUser.clientId) {
      setIsPracticeClient(false);
      setIsShowcaseMode(false);
      return;
    }
    fetch(`/api/clients/${activeUser.clientId}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then(r => r.json())
      .then((c: any) => {
        // isPractice flag is still the authoritative source on the client record
        // but isInSampleMode from above (clientId === sampleClientId) takes precedence
        if (c?.isPractice) {
          setIsShowcaseMode(!!c?.isShowcase);
        }
        if (c?.name) setActiveClientName(c.name);
      })
      .catch(() => {});
  }, [activeUser.id, activeUser.clientId]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  // ── Onboarding state ──────────────────────────────────────────────────────
  // Track per-user whether onboarding has been dismissed in this session.
  // The server is the source of truth (onboardingCompletedAt); we check it
  // once per user switch and show the flow if null.
  const [onboardingDismissed, setOnboardingDismissed] = useState<Record<number, boolean>>({});
  const [onboardingUserFetched, setOnboardingUserFetched] = useState<Record<number, boolean>>({});
  const [userOnboardingDone, setUserOnboardingDone] = useState<Record<number, boolean>>({});

  // Fetch user record to check onboardingCompletedAt when active user changes
  useEffect(() => {
    const uid = activeUser.id;
    if (!isCaregiverRole(activeUser.role)) return;
    if (onboardingUserFetched[uid]) return;
    setOnboardingUserFetched(prev => ({ ...prev, [uid]: true }));
    fetch(`/api/users/${uid}`)
      .then(r => r.json())
      .then((u: any) => {
        if (u?.onboardingCompletedAt) {
          setUserOnboardingDone(prev => ({ ...prev, [uid]: true }));
        }
      })
      .catch(() => {});
  }, [activeUser.id, activeUser.role]);

  const showOnboarding =
    isCaregiverRole(activeUser.role) &&
    !onboardingDismissed[activeUser.id] &&
    onboardingUserFetched[activeUser.id] === true &&
    !userOnboardingDone[activeUser.id];

  function triggerOnboarding() {
    const uid = activeUser.id;
    setOnboardingDismissed(prev => ({ ...prev, [uid]: false }));
    setUserOnboardingDone(prev => ({ ...prev, [uid]: false }));
  }

  function handleOnboardingComplete() {
    setOnboardingDismissed(prev => ({ ...prev, [activeUser.id]: true }));
    setUserOnboardingDone(prev => ({ ...prev, [activeUser.id]: true }));
  }

  // App mode is always caregiver now that pre-care demo client is removed
  const appMode: "caregiver" | "precare" = "caregiver";

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{
        activeUser,
        setActiveUser,

        selectedClientId,
        setSelectedClientId,
        theme,
        toggleTheme,
        appMode,
        colorTheme,
        setColorTheme,
        triggerOnboarding,
        hasMultiplePortals: hasManyPortals ?? false,
        activeClientName,
        isTemporarilyElevated,
        elevationExpiresAt,
        returnToCareHome: onReturnToCareHome ?? (() => {}),
        switchPortal: onSwitchPortal ?? (() => {}),
        multiPortalNudgeSnoozedUntil: (realUser as any)?.multiPortalNudgeSnoozedUntil ?? null,
        mcBannerSnoozedUntil,
        setMcBannerSnoozedUntil,

        portalMode,
        setPortalMode,
        showUpgradeTransition,
        triggerUpgradeTransition,
        isRealSession,
        isPreConnection,
        sampleClientId,
        isInSampleMode: isPracticeClient,
        isPracticeClient,
        isShowcaseMode,
        isClientPortal,
        clientPermissionLevel,
        contributorWelcomeSeen,
        setContributorWelcomeSeen,
        hasSeenMcInvitePrompt,
        setHasSeenMcInvitePrompt,
        loginCount,
        hasSeenHighFive,
        setHasSeenHighFive,
        hasSeenOpenHand,
        setHasSeenOpenHand,
        navOverlayOpen,
        setNavOverlayOpen,
        realUserEmail: realUser?.email ?? "",
        onLogout: () => {
          clearAuthToken();
          // Clear the session cookie client-side as well — belt and suspenders.
          // The server also clears it, but this ensures it's gone even if the
          // server response is delayed or the browser has a stale cache.
          document.cookie = "cn_session=; Max-Age=0; path=/; SameSite=Lax";
          // Clear React Query cache so no stale auth data survives the reload
          queryClient.clear();
          // Clear service worker caches so next user doesn't get stale auth state
          if (typeof caches !== "undefined") {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
          }
          fetch("/api/auth/logout", { method: "POST", credentials: "include" })
            .finally(() => { window.location.replace("/#/login"); });
        },
        fontSizePreference,
        setFontSizePreference,
      }}>
        <LangProvider>
        <AlarmEngine />
        <InstallPrompt ready={true} />
        <Router hook={useHashLocation}>
          <AppLayout>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/schedule" component={SchedulePage} />
              <Route path="/activity" component={ActivityPage} />
              <Route path="/messages" component={MessagesPage} />
              <Route path="/media" component={MediaPage} />
              <Route path="/archive" component={ArchivePage} />
              <Route path="/portal" component={ClientPortalPage} />
              <Route path="/caregivers" component={CaregiversPage} />
              <Route path="/notes" component={NotesPage} />
              <Route path="/handoff" component={HandoffPage} />
              <Route path="/trends" component={TrendsPage} />
              <Route path="/emergency" component={EmergencyPage} />
              <Route path="/documents" component={DocumentsPage} />
              <Route path="/outings" component={OutingsPage} />
              <Route path="/vitals" component={VitalsPage} />
              <Route path="/medications" component={MedicationsPage} />
              <Route path="/badges" component={BadgesPage} />
              <Route path="/thoughts" component={ThoughtsPage} />
              <Route path="/wellbeing" component={WellbeingPage} />
              <Route path="/university" component={UniversityPage} />
              <Route path="/patterns" component={() => (
                <PatternsPage
                  activeUser={activeUser}
                  selectedClientId={selectedClientId}
                  clientName="the client"
                />
              )} />
              <Route path="/becky-admin" component={BeckyAdminPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/family-pricing" component={FamilyPricingPage} />
              <Route path="/billing" component={BillingPage} />
              <Route path="/notification-prefs" component={() => (
                <NotificationPrefs portalMode={activeUser.portalMode} />
              )} />
              <Route path="/my-profile" component={CaregiverProfilePage} />
              <Route path="/my-profile-family" component={FamilyProfilePage} />
              <Route path="/care-scope" component={CareScopePage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </Router>
        </LangProvider>
        {showOnboarding && (
          <OnboardingFlow
            userId={activeUser.id}
            onComplete={handleOnboardingComplete}
            onNavigate={(path) => {
              handleOnboardingComplete();
              window.location.hash = path;
            }}
            onOpenUniversity={() => {
              handleOnboardingComplete();
              window.location.hash = "/university";
            }}
          />
        )}
        {showUpgradeTransition && (
          <UpgradeTransition onComplete={triggerUpgradeTransition} />
        )}
        <Toaster />
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

// Auth + legal pages that render standalone (no AppLayout, no context needed)
const AUTH_ROUTES: Record<string, React.ComponentType> = {
  "/login": LoginPage,
  "/apply": ApplyPage,
  "/complete-signup": CompleteSignupPage,
  "/verify-email": VerifyEmailPage,
  "/forgot-password": ForgotPasswordPage,
  "/reset-password": ResetPasswordPage,
  "/terms": TermsOfService,
  "/privacy": PrivacyPolicy,
  "/beta-agreement": BetaAgreement,
};

// Known path-based routes that should map to hash routes.
// Handles users pasting bare URLs like /login instead of /#/login.
const PATH_TO_HASH_ROUTES: Record<string, string> = {
  "/login": "#/login",
  "/apply": "#/apply",
  "/signup": "#/apply",
  "/register": "#/apply",
  "/forgot-password": "#/forgot-password",
};

export default function App() {
  // loggedIn flag — set to true after successful login so we go straight to
  // RealAuthGate without any window.location navigation (which breaks in iframes).
  const [loggedIn, setLoggedIn] = useState(false);

  // One-time redirect to '#/' after login — must live in useEffect, NOT in render,
  // because the render block re-runs on every hashchange and would trap navigation.
  useEffect(() => {
    if (loggedIn && typeof window !== "undefined") {
      const h = window.location.hash;
      if (h && h !== "#/" && h !== "") {
        window.location.hash = "/";
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const [hash, setHash] = useState(
    typeof window !== "undefined" ? window.location.hash : ""
  );

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
      stopBecky(); // stop any playing lesson audio whenever the route changes
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Redirect bare path URLs (/login, /apply, etc.) to their hash equivalents.
  // Handles users pasting links without the #.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    const target = PATH_TO_HASH_ROUTES[pathname];
    if (target && !window.location.hash) {
      window.location.replace("/#" + target.slice(1)); // e.g. /#/login
    }
  }, []);

  // Extract path from hash: "#/apply?token=..." -> "/apply"
  const hashPath = hash.replace(/^#/, "").split("?")[0];

  // Query param fallback — works through Perplexity's iframe wrapper
  // e.g. ?page=apply  ?page=login  ?page=forgot-password
  const qp = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const pageParam = qp.get("page");
  const tokenParam = qp.get("token"); // for complete-signup and reset-password links

  // If a ?page= param is present, treat it as the route
  const effectivePath = pageParam ? `/${pageParam}` : hashPath;

  // Admin office — check real pathname first (direct URL visit), then hash path
  const realPathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isAdminPath =
    realPathname === "/admin" ||
    realPathname.startsWith("/admin/") ||
    effectivePath === "/becky-admin" ||
    effectivePath.startsWith("/becky-admin") ||
    qp.get("admin") === "becky";

  if (isAdminPath) {
    const adminToken = getAdminToken();
    if (!adminToken) {
      return (
        <QueryClientProvider client={queryClient}>
          <AdminLogin onSuccess={() => window.location.reload()} />
        </QueryClientProvider>
      );
    }
    return (
      <QueryClientProvider client={queryClient}>
        <BeckyAdminPage onAdminSignOut={() => { clearAdminToken(); window.location.reload(); }} />
      </QueryClientProvider>
    );
  }

  // Invite landing — /#/invite/:token (public, no auth required)
  const inviteMatch = effectivePath.match(/^\/invite\/([a-zA-Z0-9]+)$/);
  if (inviteMatch) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <InviteLanding token={inviteMatch[1]} />
        </Router>
      </QueryClientProvider>
    );
  }

  // Email verification — /#/verify-email/:token (public)
  const verifyMatch = effectivePath.match(/^\/verify-email\/([a-zA-Z0-9]+)$/);
  if (verifyMatch) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <VerifyEmailPage token={verifyMatch[1]} />
        </Router>
      </QueryClientProvider>
    );
  }

  // Successful login sets this flag — go straight to RealAuthGate.
  // Do NOT touch window.location.hash here — this block re-runs on every
  // hashchange, so any hash assignment here would cancel every navigation.
  // The one-time redirect to '/' is handled by a useEffect below.
  if (loggedIn) {
    return <RealAuthGate />;
  }

  // Auth page check — hash path OR ?page= query param
  const AuthPage = AUTH_ROUTES[effectivePath];
  if (AuthPage) {
    // If a token was passed via query param (email links), inject it into the hash
    // so the page's getTokenFromHash() can read it
    if (tokenParam && typeof window !== "undefined" && !window.location.hash.includes("token=")) {
      window.location.hash = `${effectivePath}?token=${tokenParam}`;
    }
    // For login page — pass onLoginSuccess so it can trigger RealAuthGate without navigation
    if (effectivePath === "/login") {
      return (
        <QueryClientProvider client={queryClient}>
          <Router hook={useHashLocation}>
            <LoginPage onLoginSuccess={() => setLoggedIn(true)} />
          </Router>
        </QueryClientProvider>
      );
    }
    return (
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <AuthPage />
        </Router>
      </QueryClientProvider>
    );
  }

  return <RealAuthGate />;
}

/**
 * RealAuthGate — checks if the user is logged in with a real session.
 * If yes and onboarding not done → show OnboardingWizard.
 * If yes and onboarding done → show MainApp.
 * If no real session → show MainApp (demo mode takes over).
 */
interface PortalInfo {
  clientId: number;
  colorTheme: string;
  isPrimary: boolean;
  clientName: string;
  role: string;
}

function RealAuthGate() {
  const [checking, setChecking] = useState(true);
  const [realUser, setRealUser] = useState<RealUser | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [portals, setPortals] = useState<PortalInfo[]>([]);
  const [showCareHome, setShowCareHome] = useState(false);
  const [activePortalClientId, setActivePortalClientId] = useState<number | null>(null);
  const [activePortalTheme, setActivePortalTheme] = useState<string>("teal");
  const [goToDashboardOnMount, setGoToDashboardOnMount] = useState(false);

  // If user clicked "Go to University" from pre-connection, let them into the demo
  const demoPreview = typeof window !== "undefined" && sessionStorage.getItem("cnp_demo_preview") === "1";

  // Bootstrap session token from URL if present — handles in-app browser webviews
  // that block cookies and localStorage. Token travels in hash query: /#/onboarding?session=xxx
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hashQuery = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(hashQuery);
    const sessionToken = params.get("session");
    if (sessionToken && !getAuthToken()) {
      setAuthToken(sessionToken);
      // Strip the ?session= param from the URL cleanly
      window.location.hash = window.location.hash.split("?")[0];
    }
  }, []);

  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem("cnp_just_logged_in") === "1";

    async function checkMe(retrying = false) {
      try {
        const res = await apiRequest("GET", "/api/auth/me");
        const data = await res.json();
        if (data?.email && !data?.isDemoMode) {
          sessionStorage.removeItem("cnp_just_logged_in");
          const user: RealUser = {
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
            clientId: data.clientId ?? null,
            sampleClientId: data.sampleClientId ?? null,
            permissionLevel: data.permissionLevel ?? null,
            contributorWelcomeSeen: data.contributorWelcomeSeen ?? false,
            onboardingCompletedAt: data.onboardingCompletedAt ?? null,
            mcSetupCompletedAt: data.mcSetupCompletedAt ?? null,
            carePathChoice: data.carePathChoice ?? null,
            multiPortalNudgeSnoozedUntil: data.multiPortalNudgeSnoozedUntil ?? null,
            mcBannerSnoozedUntil: data.mcBannerSnoozedUntil ?? null,
            hasSeenMcInvitePrompt: data.hasSeenMcInvitePrompt ?? false,
            loginCount: data.loginCount ?? 0,
            hasSeenHighFive: data.hasSeenHighFive ?? false,
            hasSeenOpenHand: data.hasSeenOpenHand ?? false,
          };
          setRealUser(user);
          if (data.onboardingCompletedAt) setOnboardingDone(true);
          if (data.clientId) sessionStorage.removeItem("cnp_demo_preview");

          // Fetch portals to decide whether to show Care Home
          if (data.id && data.onboardingCompletedAt) {
            try {
              const pr = await apiRequest("GET", "/api/me/portals");
              const pdata: PortalInfo[] = await pr.json();
              if (Array.isArray(pdata) && pdata.length >= 2) {
                setPortals(pdata);
                // Find the primary portal — load that one by default
                const primary = pdata.find(p => p.isPrimary) || pdata[0];
                setActivePortalClientId(primary.clientId);
                setActivePortalTheme(primary.colorTheme || "teal");
                setShowCareHome(true);
              }
            } catch { /* not fatal — just show normal single portal */ }
          }
        } else if (justLoggedIn && !retrying) {
          setTimeout(() => checkMe(true), 500);
          return;
        }
      } catch {
        if (justLoggedIn && !retrying) {
          setTimeout(() => checkMe(true), 500);
          return;
        }
      }
      setChecking(false);
    }

    checkMe();
  }, []);

  if (checking) return null;

  // No session — if running as installed PWA (standalone), redirect to login
  // instead of falling into demo mode which creates a confusing loop
  if (!realUser) {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone && !window.location.hash.includes("/login")) {
      window.location.hash = "/login";
      return null;
    }
  }

  // Real user who hasn't completed onboarding wizard yet
  // Caregivers/family who already have a clientId (e.g. arrived via invite token) also skip —
  // they have a real portal waiting and can complete their profile inside the app.
  // SC users now go through the wizard too — it collects their client name, DOB, condition.
  const cgWithPortal = realUser?.clientId && (realUser?.role === "caregiver" || realUser?.role === "multi_caregiver" || realUser?.role === "temp_caregiver");
  if (realUser && !onboardingDone && !cgWithPortal) {
    return (
      <QueryClientProvider client={queryClient}>
        <OnboardingWizard
          email={realUser.email}
          onComplete={() => setOnboardingDone(true)}
          initialRole={realUser.role as any}
        />
      </QueryClientProvider>
    );
  }

  // MC user who hasn't completed the setup wizard yet
  // Skip if user is a caregiver (role may have been changed from primary_family by admin)
  const isMCRole = realUser?.role === "primary_family";
  if (realUser && onboardingDone && isMCRole && !realUser.mcSetupCompletedAt) {
    return (
      <QueryClientProvider client={queryClient}>
        <MCSetupWizard
          name={realUser.name || ""}
          email={realUser.email}
          onComplete={() => window.location.reload()}
        />
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Show Care Home — either multi-portal on login, or single-portal MC adding a second
  if (showCareHome && realUser) {
    // Build a realUser override with the chosen portal's clientId and colorTheme
    const portalUser: RealUser & { _entryColorTheme?: string } = {
      ...realUser!,
      clientId: activePortalClientId,
      _entryColorTheme: activePortalTheme,
    };

    return (
      <QueryClientProvider client={queryClient}>
        <CareHomePage
          onEnterPortal={async (clientId, colorTheme) => {
            setActivePortalClientId(clientId);
            setActivePortalTheme(colorTheme);
            setGoToDashboardOnMount(true);
            // Re-fetch portals so hasMultiplePortals is accurate inside MainApp
            try {
              const pr = await apiRequest("GET", "/api/me/portals");
              const pdata: PortalInfo[] = await pr.json();
              if (Array.isArray(pdata)) setPortals(pdata);
            } catch { /* non-fatal */ }
            setShowCareHome(false);
          }}
          userName={realUser?.name}
          userRole={realUser?.role}
        />
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Single-portal or already chose a portal — enter MainApp with the selected portal
  const portalUser: RealUser & { _entryColorTheme?: string } = realUser
    ? { ...realUser, clientId: activePortalClientId ?? realUser.clientId, _entryColorTheme: activePortalTheme }
    : null as any;

  return (
    <MainApp
      realUser={portalUser || realUser}
      hasMultiplePortals={portals.length >= 2}
      goToDashboard={goToDashboardOnMount}
      onReturnToCareHome={() => setShowCareHome(true)}
      onSwitchPortal={async (clientId, colorTheme) => {
        setActivePortalClientId(clientId);
        setActivePortalTheme(colorTheme);
        setGoToDashboardOnMount(false); // switch handled via clientId effect
        // Re-fetch portals to keep count fresh
        try {
          const pr = await apiRequest("GET", "/api/me/portals");
          const pdata: PortalInfo[] = await pr.json();
          if (Array.isArray(pdata)) setPortals(pdata);
        } catch { /* non-fatal */ }
        setShowCareHome(false);
      }}
    />
  );
}
