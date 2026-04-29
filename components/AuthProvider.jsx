"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

function withTimeout(promise, ms, fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallbackValue), ms);
    })
  ]);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  async function loadProfile(nextSession) {
    if (!nextSession?.user) {
      setProfile(null);
      return null;
    }

    try {
      const result = await withTimeout(
        supabase
          .from("profiles")
          .select("role")
          .eq("id", nextSession.user.id)
          .maybeSingle(),
        8000,
        { data: null, error: new Error("Profile request timeout") }
      );

      if (result?.error) {
        console.error("Profile load error:", result.error);
        setProfile(null);
        return null;
      }

      setProfile(result?.data || null);
      return result?.data || null;
    } catch (error) {
      console.error("Profile load exception:", error);
      setProfile(null);
      return null;
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setAuthReady(false);

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          8000,
          { data: { session: null }, error: new Error("Session request timeout") }
        );

        if (!mounted) return;

        const currentSession = sessionResult?.data?.session || null;

        setSession(currentSession);
        await loadProfile(currentSession);
      } catch (error) {
        console.error("Auth init error:", error);

        if (!mounted) return;

        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    }

    initAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);

      // Важно: не await внутри onAuthStateChange, чтобы не ловить подвисания
      setTimeout(async () => {
        if (!mounted) return;

        try {
          await loadProfile(nextSession);
        } catch (error) {
          console.error("Auth state profile reload error:", error);
          setProfile(null);
        } finally {
          if (mounted) {
            setAuthReady(true);
          }
        }
      }, 0);
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
      isAdmin: profile?.role === "admin"
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
