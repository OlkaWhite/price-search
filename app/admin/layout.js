"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "../../components/AuthProvider";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { authReady, user, isAdmin } = useAuthState();

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/");
    }
  }, [authReady, user, isAdmin, router]);

  if (!authReady) {
    return <div style={{ padding: 24 }}>Проверяю доступ к админке...</div>;
  }

  if (!user || !isAdmin) {
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
