import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import CaregiverProfilePage from "@/pages/CaregiverProfile";
import CareScopePage from "@/pages/CareScope";
import OnboardingFlow from "@/components/OnboardingFlow";
import UpgradeTransition from "@/components/UpgradeTransition";

// Auth pages (public — no AppLayout)
import LoginPage from "@/pages/Login";
import ApplyPage from "@/pages/Apply";
import CompleteSignupPage from "@/pages/CompleteSignup";
import VerifyEmailPage from "@/pages/VerifyEmail";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";

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
}

// Helper: is this user a caregiver-level role?
export function isCaregiverRole(role: UserRole) {
  return role === "caregiver" || role === "temp_caregiver" || role === "multi_caregiver";
}

const DEMO_USERS: ActiveUser[] = [
  // Client 1 — Robert Johnson (caregiver mode)
  { id: 1, name: "Becky M.", role: "caregiver", avatarInitials: "BM", clientId: 1 },
  { id: 2, name: "Marcus T.", role: "multi_caregiver", avatarInitials: "MT", clientId: 1 },
  { id: 3, name: "Diana P.", role: "temp_caregiver", avatarInitials: "DP", clientId: 1, tempAccessEnd: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0] },
  { id: 4, name: "Robert Jr.", role: "primary_family", avatarInitials: "RJ", clientId: 1 },
  { id: 5, name: "Linda J.", role: "secondary_family", avatarInitials: "LJ", clientId: 1 },
  // Client 2 — Eleanor Williams (caregiver mode)
  { id: 6, name: "Sarah W.", role: "primary_family", avatarInitials: "SW", clientId: 2 },
  // Client 3 — Frank Garcia (pre-care mode)

];

export type ColorTheme = "teal" | "sand" | "navy" | "lavender";
export type PortalMode = "dedicated" | "family";

interface AppContextType {
  activeUser: ActiveUser;
  setActiveUser: (user: ActiveUser) => void;
  demoUsers: ActiveUser[];
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
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

function MainApp() {
  const [activeUser, setActiveUser] = useState<ActiveUser>(DEMO_USERS[0]);
  const [selectedClientId, setSelectedClientId] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>("teal");
  const [portalMode, setPortalModeState] = useState<PortalMode>("dedicated");
  const [showUpgradeTransition, setShowUpgradeTransition] = useState(false);

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
    if (mode === "family" && isCaregiverRole(activeUser.role)) {
      const familyUser = DEMO_USERS.find(u => u.role === "primary_family" && u.clientId === selectedClientId)
        || DEMO_USERS.find(u => u.role === "primary_family");
      if (familyUser) setActiveUser(familyUser);
    }
  }

  function triggerUpgradeTransition() { setShowUpgradeTransition(false); }

  // When role changes, auto-select their client
  useEffect(() => {
    if (activeUser.clientId) {
      setSelectedClientId(activeUser.clientId);
    }
  }, [activeUser]);

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

  // Determine app mode based on selected client (in real app, fetched from DB)
  const appMode = selectedClientId === 3 ? "precare" : "caregiver";

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{
        activeUser,
        setActiveUser,
        demoUsers: DEMO_USERS,
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
                  clientName={selectedClientId === 1 ? "Robert Johnson" : selectedClientId === 2 ? "Eleanor Williams" : "the client"}
                />
              )} />
              <Route path="/becky-admin" component={BeckyAdminPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/my-profile" component={CaregiverProfilePage} />
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

// Auth pages that render standalone (no AppLayout, no context needed)
const AUTH_ROUTES: Record<string, React.ComponentType> = {
  "/login": LoginPage,
  "/apply": ApplyPage,
  "/complete-signup": CompleteSignupPage,
  "/verify-email": VerifyEmailPage,
  "/forgot-password": ForgotPasswordPage,
  "/reset-password": ResetPasswordPage,
};

export default function App() {
  const [hash, setHash] = useState(
    typeof window !== "undefined" ? window.location.hash : ""
  );

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
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

  // Auth page check — hash path OR ?page= query param
  const AuthPage = AUTH_ROUTES[effectivePath];
  if (AuthPage) {
    // If a token was passed via query param (email links), inject it into the hash
    // so the page's getTokenFromHash() can read it
    if (tokenParam && typeof window !== "undefined" && !window.location.hash.includes("token=")) {
      window.location.hash = `${effectivePath}?token=${tokenParam}`;
    }
    return (
      <QueryClientProvider client={queryClient}>
        <AuthPage />
      </QueryClientProvider>
    );
  }

  return <MainApp />;
}
