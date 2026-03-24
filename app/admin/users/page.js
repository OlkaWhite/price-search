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

const nextProfiles = profilesRes.data || [];
const nextOrders = ordersRes.data || [];
const nextLogs = logsRes.data || [];

setProfiles(nextProfiles);
setOrders(nextOrders);
setSearchLogs(nextLogs);

if (selectedUser) {
const fresh = nextProfiles.find((p) => p.id === selectedUser.id);
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
// eslint-disable-next-line react-hooks/exhaustive-deps
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
const lastSearchAt = userSearches[0]?.created_at || null;

return {
...profile,
ordersCount,
searchesCount,
totalAmount,
lastOrderAt,
lastSearchAt
};
});
}, [profiles, orders, searchLogs]);

const selectedUserOrders = useMemo(() => {
if (!selectedUser) return [];
return orders.filter((o) => o.user_id === selectedUser.id);
}, [orders, selectedUser]);

const selectedUserSearches = useMemo(() => {
if (!selectedUser) return [];
return searchLogs.filter((l) => l.user_id === selectedUser.id);
}, [searchLogs, selectedUser]);

const selectedUserTopQueries = useMemo(() => {
if (!selectedUser) return [];

const subset = searchLogs.filter((l) => l.user_id === selectedUser.id);
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

return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 20);
}, [searchLogs, selectedUser]);

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
<h1 style={{ margin: 0 }}>Клиенты</h1>
<p style={{ marginTop: 8, color: "#666" }}>
Профили пользователей, заказы и поисковая активность
</p>
</div>

<button
onClick={loadUsersData}
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

<div
style={{
display: "grid",
gridTemplateColumns: selectedUser ? "1.15fr 0.85fr" : "1fr",
gap: 20
}}
>
<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
overflow: "hidden"
}}
>
{loading ? (
<div style={{ padding: 20 }}>Загружаю клиентов...</div>
) : usersWithStats.length === 0 ? (
<div style={{ padding: 20, color: "#666" }}>Клиентов пока нет.</div>
) : (
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
{[
"Email",
"Компания / контакт",
"Роль",
"Заказы",
"Поиски",
"Сумма заказов",
""
].map((h) => (
<th
key={h}
style={{
textAlign: "left",
padding: "12px 10px",
borderBottom: "1px solid #eee",
background: "#fafafa",
whiteSpace: "nowrap"
}}
>
{h}
</th>
))}
</tr>
</thead>
<tbody>
{usersWithStats.map((user) => {
const active = selectedUser?.id === user.id;

return (
<tr
key={user.id}
style={{
background: active ? "#f7f7f7" : "#fff"
}}
>
<td style={tdStyle}>{user.email || "—"}</td>
<td style={tdStyle}>
<div style={{ fontWeight: 600 }}>
{user.company_name || "—"}
</div>
<div style={{ color: "#666", fontSize: 13 }}>
{user.contact_name || "—"}
</div>
</td>
<td style={tdStyle}>{user.role || "client"}</td>
<td style={tdStyle}>{user.ordersCount}</td>
<td style={tdStyle}>{user.searchesCount}</td>
<td style={tdStyle}>{user.totalAmount.toFixed(2)} BYN</td>
<td style={tdStyle}>
<button
onClick={() => setSelectedUser(user)}
style={smallButtonStyle}
>
Открыть
</button>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>

{selectedUser && (
<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20,
alignSelf: "start"
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
marginBottom: 16
}}
>
<h2 style={{ margin: 0 }}>Карточка клиента</h2>

<button
onClick={() => setSelectedUser(null)}
style={smallGhostButtonStyle}
>
Закрыть
</button>
</div>

<div style={{ display: "grid", gap: 12 }}>
<InfoRow label="Email" value={selectedUser.email || "—"} />
<InfoRow label="Компания" value={selectedUser.company_name || "—"} />
<InfoRow label="Контактное лицо" value={selectedUser.contact_name || "—"} />
<InfoRow label="Телефон" value={selectedUser.phone || "—"} />
<InfoRow label="Telegram" value={selectedUser.telegram || "—"} />
<InfoRow label="Роль" value={selectedUser.role || "client"} />
<InfoRow
label="Дата регистрации"
value={
selectedUser.created_at
? new Date(selectedUser.created_at).toLocaleString()
: "—"
}
/>
<InfoRow
label="Последний заказ"
value={
selectedUser.lastOrderAt
? new Date(selectedUser.lastOrderAt).toLocaleString()
: "—"
}
/>
<InfoRow
label="Последний поиск"
value={
selectedUser.lastSearchAt
? new Date(selectedUser.lastSearchAt).toLocaleString()
: "—"
}
/>
</div>

<div style={{ marginTop: 22 }}>
<h3 style={{ marginTop: 0 }}>Заказы клиента</h3>
{selectedUserOrders.length === 0 ? (
<div style={{ color: "#666" }}>Заказов пока нет.</div>
) : (
<div style={{ display: "grid", gap: 10 }}>
{selectedUserOrders.slice(0, 10).map((order) => {
const total = (order.order_items || []).reduce((sum, item) => {
const price =
typeof item.price_byn === "number"
? item.price_byn
: Number(item.price_byn) || 0;
const qty =
typeof item.order_qty === "number"
? item.order_qty
: Number(item.order_qty) || 0;
return sum + price * qty;
}, 0);

return (
<div
key={order.id}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12
}}
>
<div style={{ fontWeight: 700 }}>
Заказ #{order.id}
</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
{new Date(order.created_at).toLocaleString()}
</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
Статус: {order.status}
</div>
<div style={{ color: "#111", fontSize: 13, marginTop: 4 }}>
Сумма: {total.toFixed(2)} BYN
</div>
</div>
);
})}
</div>
)}
</div>

<div style={{ marginTop: 22 }}>
<h3 style={{ marginTop: 0 }}>Что ищет чаще всего</h3>
{selectedUserTopQueries.length === 0 ? (
<div style={{ color: "#666" }}>Поисков пока нет.</div>
) : (
<div style={{ display: "grid", gap: 10 }}>
{selectedUserTopQueries.map((item) => (
<div
key={item.query}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12
}}
>
<div style={{ fontWeight: 700 }}>{item.query}</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
Поисков: {item.count}
</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
Без результатов: {item.noResults}
</div>
</div>
))}
</div>
)}
</div>

<div style={{ marginTop: 22 }}>
<h3 style={{ marginTop: 0 }}>Последние поиски</h3>
{selectedUserSearches.length === 0 ? (
<div style={{ color: "#666" }}>Поисков пока нет.</div>
) : (
<div style={{ display: "grid", gap: 10 }}>
{selectedUserSearches.slice(0, 10).map((item) => (
<div
key={item.id}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12
}}
>
<div style={{ fontWeight: 700 }}>
{item.query_text || "—"}
</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
{new Date(item.created_at).toLocaleString()}
</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
Результатов: {item.results_count}
</div>
</div>
))}
</div>
)}
</div>
</div>
)}
</div>
</div>
);
}

function InfoRow({ label, value }) {
return (
<div>
<div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{label}</div>
<div style={{ fontSize: 14 }}>{value}</div>
</div>
);
}

const tdStyle = {
padding: "12px 10px",
borderBottom: "1px solid #eee",
verticalAlign: "top"
};

const smallButtonStyle = {
padding: "8px 10px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
fontSize: 13
};

const smallGhostButtonStyle = {
padding: "8px 10px",
borderRadius: 10,
border: "1px solid #ccc",
background: "#fff",
color: "#111",
cursor: "pointer",
fontSize: 13
};
