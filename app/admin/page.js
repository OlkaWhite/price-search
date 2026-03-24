"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    suppliers: 0,
    searches: 0
  });

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      const [usersRes, ordersRes, suppliersRes, searchesRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("pricelists").select("*", { count: "exact", head: true }),
        supabase.from("search_logs").select("*", { count: "exact", head: true })
      ]);

      if (!mounted) return;

      setStats({
        users: usersRes.count || 0,
        orders: ordersRes.count || 0,
        suppliers: suppliersRes.count || 0,
        searches: searchesRes.count || 0
      });
    }

    loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Дашборд</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}
      >
        <Card title="Клиенты" value={stats.users} />
        <Card title="Заказы" value={stats.orders} />
        <Card title="Поставщики" value={stats.suppliers} />
        <Card title="Поисковые запросы" value={stats.searches} />
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: 20,
        background: "#fff"
      }}
    >
      <div style={{ color: "#666", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
