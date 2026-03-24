"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchLogs, setSearchLogs] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  async function loadUsersData() {
    setLoading(true);
    setErrorText("");

    try {
      const [profilesRes, ordersRes, logsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, company_name, contact_name, phone, telegram, role, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select(`
            id,
            user_id,
            customer_name,
            customer_contact,
            customer_comment,
            status,
            created_at,
            order_items (
              id,
              order_qty,
              price_byn
            )
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("search_logs")
          .select("id, user_id, user_email, query_text, results_count, created_at")
          .order("created_at", { ascending: false })
          .limit(5000)
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (logsRes.error) throw logsRes.error;

      setProfiles(profilesRes.data || []);
      setOrders(ordersRes.data || []);
      setSearchLogs(logsRes.data || []);

      if (selectedUser) {
        const fresh = (profilesRes.data || []).find((p) => p.id === selectedUser.id);
        setSelectedUser(fresh || null);
      }
    } catch (err) {
      console.error("Admin users load error:", err);
      setErrorText(err?.message || "Не удалось загрузить пользователей.");
      setProfiles([]);
      setOrders([]);
      setSearchLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsersData();
  }, []);

  const usersWithStats = useMemo(() => {
    return profiles.map((profile) => {
      const userOrders = orders.filter((o) => o.user_id === profile.id);
      const userSearches = searchLogs.filter((l) => l.user_id === profile.id);

      const ordersCount = userOrders.length;
      const searchesCount = userSearches.length;

      const totalAmount = userOrders.reduce((sum, order) => {
        return (
          sum +
          (order.order_items || []).reduce((innerSum, item) => {
            const price =
              typeof item.price_byn === "number"
                ? item.price_byn
                : Number(item.price_byn) || 0;
            const qty =
              typeof item.order_qty === "number"
                ? item.order_qty
                : Number(item.order_qty) || 0;
            return innerSum + price * qty;
          }, 0)
        );
      }, 0);

      const lastOrderAt = userOrders[0]?.created_at || null;
      const lastSearchAt
