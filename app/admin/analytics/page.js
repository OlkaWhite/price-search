"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminAnalyticsPage() {
  const [logs, setLogs] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [selectedUserKey, setSelectedUserKey] = useState("all");

  async function loadAnalytics() {
    setLoading(true);
    setErrorText("");

    try {
      const { data: logsData, error: logsError } = await supabase
        .from("search_logs")
        .select(`
          id,
          user_id,
          user_email,
          anon_session_id,
          query_text,
          brand_filter,
          price_sort,
          results_count,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (logsError) {
        throw logsError;
      }

      const userIds = Array.from(
        new Set((logsData || []).map((x) => x.user_id).filter(Boolean))
      );

      let nextProfilesMap = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, company_name, contact_name, phone, telegram")
          .in("id", userIds);

        if (profilesError) {
          throw profilesError;
        }

        nextProfilesMap = Object.fromEntries(
          (profilesData || []).map((p) => [p.id, p])
        );
      }

      setProfilesMap(nextProfilesMap);
      setLogs(logsData || []);
    } catch (err) {
      console.error("Analytics load error:", err);
      setErrorText(err?.message || "Не удалось загрузить аналитику.");
      setLogs([]);
      setProfilesMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const enrichedLogs = useMemo(() => {
    return logs.map((log) => {
      const profile = log.user_id ? profilesMap[log.user_id] || null : null;

      const userKey = log.user_id
        ? user:${log.user_id}
        : anon:${log.anon_session_id || log.id};

      const userLabel = profile?.company_name
        ? ${profile.company_name}${profile.contact_name ?  — ${profile.contact_name}` : ""}`
        : profile?.email  log.user_email  log.anon_session_id || "Аноним";

      return {
        ...log,
        profile,
        userKey,
        userLabel
      };
    });
  }, [logs, profilesMap]);

  const stats = useMemo(() => {
    const totalSearches = enrichedLogs.length;
    const noResults = enrichedLogs.filter((x) => Number(x.results_count) === 0).length;
    const uniqueUsers = new Set(enrichedLogs.map((x) => x.userKey)).size;
    const authorizedUsers = new Set(
      enrichedLogs.filter((x) => x.user_id).map((x) => x.user_id)
    ).size;

    return {
      totalSearches,
      noResults,
      uniqueUsers,
      authorizedUsers
    };
  }, [enrichedLogs]);

  const topQueries = useMemo(() => {
    const map = new Map();

    enrichedLogs.forEach((item) => {
      const q = (item.query_text || "").trim();
      if (!q) return;

      const current = map.get(q) || { query: q, count: 0, noResults: 0 };
      current.count += 1;
      if (Number(item.results_count) === 0) current.noResults += 1;
      map.set(q, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [enrichedLogs]);

  const noResultQueries = useMemo(() => {
    const map = new Map();

    enrichedLogs.forEach((item) => {
      const q = (item.query_text || "").trim();
      if (!q || Number(item.results_count) !== 0) return;

      const current = map.get(q) || { query: q, count: 0 };
      current.count += 1;
      map.set(q, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [enrichedLogs]);

  const topUsers = useMemo(() => {
    const map = new Map();

    enrichedLogs.forEach((item) => {
      const key = item.userKey;
const current = map.get(key) || {
        key,
        label: item.userLabel,
        total: 0,
        noResults: 0
      };

      current.total += 1;
      if (Number(item.results_count) === 0) current.noResults += 1;

      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [enrichedLogs]);

  const userOptions = useMemo(() => {
    return topUsers.map((u) => ({
      value: u.key,
      label: ${u.label} (${u.total})
    }));
  }, [topUsers]);

  const selectedUserQueryStats = useMemo(() => {
    if (selectedUserKey === "all") return [];

    const subset = enrichedLogs.filter((x) => x.userKey === selectedUserKey);
    const map = new Map();

    subset.forEach((item) => {
      const q = (item.query_text || "").trim();
      if (!q) return;

      const current = map.get(q) || {
        query: q,
        count: 0,
        noResults: 0
      };

      current.count += 1;
      if (Number(item.results_count) === 0) current.noResults += 1;

      map.set(q, current);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [enrichedLogs, selectedUserKey]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 20
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Аналитика</h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Что ищут пользователи, как часто и кто активнее всего
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14
          }}
        >
          Обновить
        </button>
      </div>

      {errorText && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #f1b5b5",
            background: "#fff5f5",
            color: "#9b1c1c"
          }}
        >
          {errorText}
        </div>
      )}

      {loading ? (
        <div>Загружаю аналитику...</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 20
            }}
          >
            <StatCard title="Всего поисков" value={stats.totalSearches} />
            <StatCard title="Без результатов" value={stats.noResults} />
            <StatCard title="Уникальных посетителей" value={stats.uniqueUsers} />
            <StatCard title="Авторизованных клиентов" value={stats.authorizedUsers} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20
            }}
          >
            <Panel title="Топ запросов">
              <SimpleTable
                columns={["Запрос", "Поисков", "0 результатов"]}
                rows={topQueries.map((item) => [
                  item.query,
                  item.count,
                  item.noResults
                ])}
                emptyText="Нет данных"
              />
            </Panel>

            <Panel title="Запросы без результатов">
              <SimpleTable
                columns={["Запрос", "Сколько раз"]}
                rows={noResultQueries.map((item) => [item.query, item.count])}
                emptyText="Нет данных"
              />
            </Panel>

            <Panel title="Самые активные пользователи">
              <SimpleTable
                columns={["Пользователь", "Поисков", "0 результатов"]}
                rows={topUsers.map((item) => [
                  item.label,
                  item.total,
                  item.noResults
])}
                emptyText="Нет данных"
              />
            </Panel>

            <Panel title="Что чаще ищет конкретный пользователь">
              <div style={{ marginBottom: 14 }}>
                <select
                  value={selectedUserKey}
                  onChange={(e) => setSelectedUserKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 10,
                    fontSize: 14
                  }}
                >
                  <option value="all">Выбери пользователя</option>
                  {userOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <SimpleTable
                columns={["Запрос", "Поисков", "0 результатов"]}
                rows={selectedUserQueryStats.map((item) => [
                  item.query,
                  item.count,
                  item.noResults
                ])}
                emptyText="Нет данных по выбранному пользователю"
              />
            </Panel>
          </div>

          <div style={{ marginTop: 20 }}>
            <Panel title="Последние поиски">
              <SimpleTable
                columns={[
                  "Дата",
                  "Пользователь",
                  "Запрос",
                  "Бренд",
                  "Сортировка",
                  "Результатов"
                ]}
                rows={enrichedLogs.slice(0, 50).map((item) => [
                  new Date(item.created_at).toLocaleString(),
                  item.userLabel,
                  item.query_text || "—",
                  item.brand_filter || "—",
                  item.price_sort || "—",
                  item.results_count
                ])}
                emptyText="Логов пока нет"
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        background: "#fff",
        padding: 18
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 18 }}>{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: 18,
        background: "#fff"
      }}
    >
      <div style={{ color: "#666", marginBottom: 8, fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText }) {
  if (!rows.length) {
    return <div style={{ color: "#666" }}>{emptyText}</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: "left",
                  padding: "10px 8px",
                  borderBottom: "1px solid #eee",
                  background: "#fafafa",
                  whiteSpace: "nowrap"
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid #eee",
                    verticalAlign: "top"
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
</tbody>
      </table>
    </div>
  );
}
