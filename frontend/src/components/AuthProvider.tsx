"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getToken, clearToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  setUser: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Beim Laden pruefen ob ein Token existiert und User-Daten aus localStorage lesen
    const token = getToken();
    const stored = localStorage.getItem("user");
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  function handleSetUser(u: User | null) {
    setUser(u);
    if (u) {
      localStorage.setItem("user", JSON.stringify(u));
    } else {
      localStorage.removeItem("user");
    }
  }

  function logout() {
    clearToken();
    handleSetUser(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, setUser: handleSetUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
