"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  async function loadProfile(nextSession) {
    if (!nextSession?.user) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", nextSession.user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
      setProfile(null);
      return;
    }

    setProfile(data || null);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      await loadProfile(currentSession);

      if (!mounted) return;
      setAuthReady(true);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      await loadProfile(nextSession);

      if (!mounted) return;
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      authReady,
      isAdmin: profile?.role === "admin",
    }),
    [session, profile, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuthState must be used inside AuthProvider");
  }

  return ctx;
}