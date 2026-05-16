import { Switch, Route, Router, useLocation } from "wouter";
import { stopBecky } from "@/lib/ttsUtils";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, apiRequest, clearAuthToken, getAuthToken } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AlarmEngine } from "@/components/AlarmEngine";
import { createContext, useContext, useState, useEffect } from "react";
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
import PricingPage from "@/pages/Pricing";
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

// Role types
export type UserRole = "caregiver" | "temp_caregiver" | "multi_caregiver" | "primary_family" | "secondary_family";

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


export type ColorTheme = "teal" | "sand" | "navy" | "lavender";
export type PortalMode = "dedicated" | "family";

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
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  showUpgradeTransition: boolean;
  triggerUpgradeTransition: (targetMode: PortalMode) => void;
  isRealSession: boolean; // always true — demo mode removed
  isPreConnection: boolean; // true when real CG session but no clientId yet
  isPracticeClient: boolean; // true when CG is connected to a practice/sample client
  isShowcaseMode: boolean; // true when CG has enabled showcase view for their sample client
  navOverlayOpen: boolean;
  setNavOverlayOpen: (open: boolean) => void;
  realUserEmail: string; // email of the logged-in real user (used for demo detection)
  onLogout: () => void;  // call to log out + reset to login screen
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

interface RealUser {
  id?: number;
  name?: string;
  role?: string;
  email: string;
  clientId?: number | null;
  onboardingCompletedAt?: string | null;
  mcSetupCompletedAt?: string | null;
  carePathChoice?: string | null;
}

function MainApp({ realUser }: { realUser?: RealUser | null }) {
  // Pre-connection CGs (no clientId yet) fall through to the main app in demo mode.
  // A banner in AppLayout explains the situation and offers an invite shortcut.

  // Real MC who just completed setup — start in family portal mode
  const isMCReal = realUser?.role === "primary_family" || realUser?.role === "secondary_family";
  const startPortalMode: PortalMode = isMCReal ? "family" : "dedicated";

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
  const isPreConnection = !realUser?.clientId;

  const [activeUser, setActiveUser] = useState<ActiveUser>(initialActiveUser);
  const [selectedClientId, setSelectedClientId] = useState(realUser?.clientId ?? 1);
  const [isPracticeClient, setIsPracticeClient] = useState(false);
  const [isShowcaseMode, setIsShowcaseMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>("teal");
  const [portalMode, setPortalModeState] = useState<PortalMode>(startPortalMode);
  const [showUpgradeTransition, setShowUpgradeTransition] = useState(false);
  const [navOverlayOpen, setNavOverlayOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const attr = portalMode === "family" ? "rose" : colorTheme;
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

  // Fetch client to detect isPractice / isShowcase flags
  useEffect(() => {
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
        setIsPracticeClient(!!c?.isPractice);
        setIsShowcaseMode(!!c?.isShowcase);
      })
      .catch(() => {});
  }, [activeUser.clientId]);

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
        portalMode,
        setPortalMode,
        showUpgradeTransition,
        triggerUpgradeTransition,
        isRealSession,
        isPreConnection,
        isPracticeClient,
        isShowcaseMode,
        navOverlayOpen,
        setNavOverlayOpen,
        realUserEmail: realUser?.email ?? "",
        onLogout: () => {
          clearAuthToken();
          fetch("/api/auth/logout", { method: "POST", credentials: "include" })
            .finally(() => { window.location.replace("/"); });
        },
      }}>
        <LangProvider>
        <AlarmEngine />
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

  // BeckyAdmin check
  const isBeckyAdmin =
    effectivePath === "/becky-admin" ||
    effectivePath.startsWith("/becky-admin") ||
    qp.get("admin") === "becky";

  if (isBeckyAdmin) {
    return (
      <QueryClientProvider client={queryClient}>
        <BeckyAdminPage />
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
function RealAuthGate() {
  const [checking, setChecking] = useState(true);
  const [realUser, setRealUser] = useState<RealUser | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);

  // If user clicked "Go to University" from pre-connection, let them into the demo
  const demoPreview = typeof window !== "undefined" && sessionStorage.getItem("cnp_demo_preview") === "1";

  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem("cnp_just_logged_in") === "1";

    async function checkMe(retrying = false) {
      try {
        // Use apiRequest so the URL goes through API_BASE (Railway proxy on Perplexity preview)
        // and the Bearer token header is added automatically via authHeaders().
        const res = await apiRequest("GET", "/api/auth/me");
        const data = await res.json();
        if (data?.email && !data?.isDemoMode) {
          sessionStorage.removeItem("cnp_just_logged_in");
          setRealUser({
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
            clientId: data.clientId ?? null,
            onboardingCompletedAt: data.onboardingCompletedAt ?? null,
            mcSetupCompletedAt: data.mcSetupCompletedAt ?? null,
            carePathChoice: data.carePathChoice ?? null,
          });
          if (data.onboardingCompletedAt) setOnboardingDone(true);
          if (data.clientId) sessionStorage.removeItem("cnp_demo_preview");
        } else if (justLoggedIn && !retrying) {
          setTimeout(() => checkMe(true), 500);
          return;
        }
      } catch {
        // 401 or network error — retry once if we just logged in
        if (justLoggedIn && !retrying) {
          setTimeout(() => checkMe(true), 500);
          return;
        }
      }
      setChecking(false);
    }

    checkMe();
  }, []);

  if (checking) return null; // brief flicker prevention

  // Real user who hasn't completed onboarding wizard yet
  if (realUser && !onboardingDone) {
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
  // secondary_family arrives via invite (already connected) — they skip MC setup
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

  // Real user, onboarding done — always pass realUser into MainApp.
  return <MainApp realUser={realUser} />;
}
