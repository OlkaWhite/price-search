"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          router.replace("/");
          return;
        }

        if (!mounted) return;

        if (profile?.role === "admin") {
          setAllowed(true);
        } else {
          router.replace("/");
        }
      } catch (e) {
        console.error(e);
        router.replace("/");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return <div style={{ padding: 24 }}>Проверяю доступ к админке...</div>;
  }

  if (!allowed) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "calc(100vh - 65px)"
      }}
    >
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24 }}>{children}</div>
    </div>
  );
}
