/**
 * Care Net Portal — Auth client helpers
 * Provides useAuth hook + AuthContext for the entire app.
 * DEMO_MODE: if VITE_DEMO_MODE=true, auth is bypassed and demo user switcher works normally.
 */

import { createContext, useContext } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface AuthUser {
  id: number;           // portal user id
  name: string;
  email: string;
  role: string;
  clientId: number | null;
  avatarInitials: string;
  onboardingCompletedAt: string | null;
}

export interface AuthContextType {
  authUser: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  authUser: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refresh: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Whether the app is running in demo mode (VITE_DEMO_MODE=true)
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || true; // default true for dev
