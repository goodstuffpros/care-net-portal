import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { createContext, useContext, useState, useEffect } from "react";

// Pages
import DashboardPage from "@/pages/Dashboard";
import SchedulePage from "@/pages/Schedule";
import ActivityPage from "@/pages/Activity";
import MessagesPage from "@/pages/Messages";
import MediaPage from "@/pages/Media";
import ArchivePage from "@/pages/Archive";
import ClientPortalPage from "@/pages/ClientPortal";
import NotFound from "@/pages/not-found";

// Layout
import AppLayout from "@/components/AppLayout";

// Role Context
export type UserRole = "caregiver" | "primary_family" | "secondary_family";
export interface ActiveUser {
  id: number;
  name: string;
  role: UserRole;
  avatarInitials: string;
  clientId: number | null;
}

const DEMO_USERS: ActiveUser[] = [
  { id: 1, name: "Becky M.", role: "caregiver", avatarInitials: "BM", clientId: null },
  { id: 2, name: "Robert Jr.", role: "primary_family", avatarInitials: "RJ", clientId: 1 },
  { id: 3, name: "Linda J.", role: "secondary_family", avatarInitials: "LJ", clientId: 1 },
  { id: 4, name: "Sarah W.", role: "primary_family", avatarInitials: "SW", clientId: 2 },
];

interface AppContextType {
  activeUser: ActiveUser;
  setActiveUser: (user: ActiveUser) => void;
  demoUsers: ActiveUser[];
  selectedClientId: number;
  setSelectedClientId: (id: number) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

export default function App() {
  const [activeUser, setActiveUser] = useState<ActiveUser>(DEMO_USERS[0]);
  const [selectedClientId, setSelectedClientId] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // When role changes, auto-select their client
  useEffect(() => {
    if (activeUser.clientId) {
      setSelectedClientId(activeUser.clientId);
    }
  }, [activeUser]);

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

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
      }}>
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
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </Router>
        <Toaster />
      </AppContext.Provider>
    </QueryClientProvider>
  );
}
