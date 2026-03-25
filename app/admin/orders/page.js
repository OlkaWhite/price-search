"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const STATUS_OPTIONS = ["all", "new", "in_progress", "processed", "canceled"];

const STATUS_LABELS = {
all: "Все статусы",
new: "Новая",
in_progress: "В работе",
processed: "Обработана",
canceled: "Отменена"
};

export default function AdminOrdersPage() {
const [orders, setOrders] = useState([]);
const [statusFilter, setStatusFilter] = useState("all");
const [loading, setLoading] = useState(true);
const [errorText, setErrorText] = useState("");
const [selectedOrder, setSelectedOrder] = useState(null);
const [saving, setSaving] = useState(false);

async function loadOrders() {
setLoading(true);
setErrorText("");

try {
let req = supabase
.from("orders")
.select(`
id,
user_id,
customer_name,
customer_contact,
customer_comment,
status,
manager_comment,
invoice_url,
invoice_requested,
created_at,
processed_at,
order_items (
id,
order_id,
brand,
pn,
name,
order_qty,
stock_qty,
display_price,
price_byn
)
`)
.order("created_at", { ascending: false });

if (statusFilter !== "all") {
req = req.eq("status", statusFilter);
}

const { data: ordersData, error: ordersError } = await req;

if (ordersError) {
throw ordersError;
}

const userIds = Array.from(
new Set((ordersData || []).map((o) => o.user_id).filter(Boolean))
);

let profilesMap = {};

if (userIds.length > 0) {
const { data: profilesData, error: profilesError } = await supabase
.from("profiles")
.select("id, email, company_name, contact_name, phone, telegram, unp")
.in("id", userIds);

if (profilesError) {
throw profilesError;
}

profilesMap = Object.fromEntries(
(profilesData || []).map((p) => [p.id, p])
);
}

const enrichedOrders = (ordersData || []).map((order) => ({
...order,
order_items: order.order_items || [],
profile: profilesMap[order.user_id] || null
}));

setOrders(enrichedOrders);

if (selectedOrder) {
const fresh = enrichedOrders.find((o) => o.id === selectedOrder.id);
setSelectedOrder(fresh || null);
}
} catch (err) {
console.error("Admin orders load error:", err);
setErrorText(err?.message || "Не удалось загрузить заказы.");
setOrders([]);
} finally {
setLoading(false);
}
}

useEffect(() => {
loadOrders();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [statusFilter]);

const stats = useMemo(() => {
const total = orders.length;
const newCount = orders.filter((o) => o.status === "new").length;
const inProgressCount = orders.filter((o) => o.status === "in_progress").length;
const processedCount = orders.filter((o) => o.status === "processed").length;
const canceledCount = orders.filter((o) => o.status === "canceled").length;
const totalAmount = orders.reduce((sum, order) => sum + calcOrderTotal(order), 0);

return {
total,
newCount,
inProgressCount,
processedCount,
canceledCount,
totalAmount
};
}, [orders]);

async function saveOrderUpdates() {
if (!selectedOrder) return;

setSaving(true);

const payload = {
status: selectedOrder.status,
manager_comment: selectedOrder.manager_comment || "",
invoice_url: selectedOrder.invoice_url?.trim() || null,
processed_at:
selectedOrder.status === "processed" ? new Date().toISOString() : null
};

const { error } = await supabase
.from("orders")
.update(payload)
.eq("id", selectedOrder.id);

if (error) {
alert("Ошибка при сохранении: " + error.message);
} else {
await loadOrders();
alert("Заказ обновлён.");
}

setSaving(false);
}

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
<h1 style={{ margin: 0 }}>Заказы</h1>
<p style={{ marginTop: 8, color: "#666" }}>
Все заявки клиентов с деталями и обработкой
</p>
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
<select
value={statusFilter}
onChange={(e) => setStatusFilter(e.target.value)}
style={{
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14
}}
>
{STATUS_OPTIONS.map((status) => (
<option key={status} value={status}>
{STATUS_LABELS[status] || status}
</option>
))}
</select>

<button
onClick={loadOrders}
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
</div>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
gap: 16,
marginBottom: 20
}}
>
<StatCard title="Всего заказов" value={stats.total} />
<StatCard title="Новые" value={stats.newCount} />
<StatCard title="В работе" value={stats.inProgressCount} />
<StatCard title="Обработаны" value={stats.processedCount} />
<StatCard title="Отменены" value={stats.canceledCount} />
<StatCard title="Сумма заказов" value={`${stats.totalAmount.toFixed(2)} BYN`} />
</div>

{errorText && (
<div
style={{
marginBottom: 16,
padding: 12,
border: "1px solid #f1b5b5",
borderRadius: 10,
background: "#fff5f5",
color: "#9b1c1c"
}}
>
{errorText}
</div>
)}

<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
overflow: "hidden"
}}
>
{loading ? (
<div style={{ padding: 20 }}>Загружаю заказы...</div>
) : orders.length === 0 ? (
<div style={{ padding: 20, color: "#666" }}>Заказов пока нет.</div>
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
"ID",
"Дата",
"Клиент",
"Статус",
"Счёт запрошен",
"Счёт выставлен",
"Позиций",
"Сумма",
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
{orders.map((order) => {
const itemsCount = (order.order_items || []).reduce(
(sum, item) => sum + (Number(item.order_qty) || 0),
0
);

const invoiceSet = !!order.invoice_url;

return (
<tr key={order.id}>
<td style={tdStyle}>{order.id}</td>
<td style={tdStyle}>
{new Date(order.created_at).toLocaleString()}
</td>
<td style={tdStyle}>
<div style={{ fontWeight: 600 }}>
{order.customer_name || "—"}
</div>
<div style={{ color: "#666", fontSize: 13 }}>
{order.profile?.company_name || "—"}
</div>
<div style={{ color: "#666", fontSize: 13 }}>
{order.customer_contact || "—"}
</div>
</td>
<td style={tdStyle}>
<StatusBadge status={order.status} />
</td>
<td style={tdStyle}>
<BoolBadge
value={order.invoice_requested}
trueLabel="Да"
falseLabel="Нет"
trueTone="danger"
falseTone="neutral"
/>
</td>
<td style={tdStyle}>
<BoolBadge
value={invoiceSet}
trueLabel="Да"
falseLabel="Нет"
trueTone="success"
falseTone="danger"
/>
</td>
<td style={tdStyle}>{itemsCount}</td>
<td style={tdStyle}>{calcOrderTotal(order).toFixed(2)} BYN</td>
<td style={tdStyle}>
<button
onClick={() => setSelectedOrder(order)}
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

{selectedOrder && (
<div
onClick={() => setSelectedOrder(null)}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.38)",
zIndex: 2000,
display: "flex",
justifyContent: "center",
alignItems: "flex-start",
padding: "24px 16px",
overflowY: "auto"
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "96vw",
maxWidth: 1900,
background: "#fff",
borderRadius: 18,
border: "1px solid #e5e5e5",
boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
padding: 24,
boxSizing: "border-box"
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
marginBottom: 20,
flexWrap: "wrap"
}}
>
<h2 style={{ margin: 0 }}>Заказ #{selectedOrder.id}</h2>

<button
onClick={() => setSelectedOrder(null)}
style={smallGhostButtonStyle}
>
Закрыть
</button>
</div>

<div
style={{
display: "grid",
gridTemplateColumns: "minmax(340px, 460px) minmax(700px, 1fr)",
gap: 24,
alignItems: "start"
}}
>
<div
style={{
border: "1px solid #eee",
borderRadius: 14,
padding: 16,
background: "#fafafa"
}}
>
<div style={{ display: "grid", gap: 12 }}>
<InfoRow label="Дата" value={new Date(selectedOrder.created_at).toLocaleString()} />
<InfoRow label="Клиент" value={selectedOrder.customer_name || "—"} />
<InfoRow label="Контакт" value={selectedOrder.customer_contact || "—"} />
<InfoRow label="Комментарий клиента" value={selectedOrder.customer_comment || "—"} />
<InfoRow label="Email" value={selectedOrder.profile?.email || "—"} />
<InfoRow label="Компания" value={selectedOrder.profile?.company_name || "—"} />
<InfoRow label="Контактное лицо" value={selectedOrder.profile?.contact_name || "—"} />
<InfoRow label="Телефон" value={selectedOrder.profile?.phone || "—"} />
<InfoRow label="Telegram" value={selectedOrder.profile?.telegram || "—"} />
<InfoRow label="УНП" value={selectedOrder.profile?.unp || "—"} />
<InfoRow
label="Запрос счёта"
value={selectedOrder.invoice_requested ? "Да" : "Нет"}
/>
<InfoRow
label="Счёт выставлен"
value={selectedOrder.invoice_url ? "Да" : "Нет"}
/>
<InfoRow
label="Сумма заказа"
value={`${calcOrderTotal(selectedOrder).toFixed(2)} BYN`}
/>
</div>

<div style={{ marginTop: 18 }}>
<div style={{ fontWeight: 700, marginBottom: 8 }}>Статус</div>
<select
value={selectedOrder.status}
onChange={(e) =>
setSelectedOrder((prev) => ({ ...prev, status: e.target.value }))
}
style={{
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14
}}
>
{STATUS_OPTIONS.filter((s) => s !== "all").map((status) => (
<option key={status} value={status}>
{STATUS_LABELS[status] || status}
</option>
))}
</select>
</div>

<div style={{ marginTop: 18 }}>
<div style={{ fontWeight: 700, marginBottom: 8 }}>Комментарий менеджера</div>
<textarea
value={selectedOrder.manager_comment || ""}
onChange={(e) =>
setSelectedOrder((prev) => ({
...prev,
manager_comment: e.target.value
}))
}
rows={4}
style={{
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
resize: "vertical",
boxSizing: "border-box"
}}
/>
</div>

<div style={{ marginTop: 18 }}>
<div style={{ fontWeight: 700, marginBottom: 8 }}>Ссылка на счёт</div>
<input
value={selectedOrder.invoice_url || ""}
onChange={(e) =>
setSelectedOrder((prev) => ({
...prev,
invoice_url: e.target.value
}))
}
placeholder="https://..."
style={{
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
boxSizing: "border-box"
}}
/>
</div>

<div style={{ marginTop: 18 }}>
<button
onClick={saveOrderUpdates}
disabled={saving}
style={{
padding: "12px 14px",
borderRadius: 10,
border: "1px solid #111",
background: saving ? "#ddd" : "#111",
color: saving ? "#333" : "#fff",
cursor: saving ? "default" : "pointer",
fontSize: 14
}}
>
{saving ? "Сохраняю..." : "Сохранить изменения"}
</button>
</div>
</div>

<div
style={{
border: "1px solid #eee",
borderRadius: 14,
padding: 16,
background: "#fff",
minWidth: 0,
overflowX: "auto"
}}
>
<h3 style={{ marginTop: 0, marginBottom: 14 }}>Позиции заказа</h3>

{(selectedOrder.order_items || []).length === 0 ? (
<div style={{ color: "#666" }}>Позиции в заказе не найдены.</div>
) : (
<>
<div
style={{
display: "grid",
gridTemplateColumns: "110px 160px minmax(260px, 1fr) 90px 110px 130px",
gap: 12,
alignItems: "center",
padding: "0 12px 10px",
borderBottom: "1px solid #eee",
marginBottom: 10,
color: "#666",
fontSize: 12,
fontWeight: 700,
textTransform: "uppercase",
letterSpacing: "0.02em"
}}
>
<div>Бренд</div>
<div>P/N</div>
<div>Наименование</div>
<div>Шт</div>
<div>Цена</div>
<div>Сумма</div>
</div>

<div style={{ display: "grid", gap: 10 }}>
{(selectedOrder.order_items || []).map((item) => (
<div
key={item.id}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12,
background: "#fafafa"
}}
>
<div
style={{
display: "grid",
gridTemplateColumns: "110px 160px minmax(260px, 1fr) 90px 110px 130px",
gap: 12,
alignItems: "start"
}}
>
<div style={itemCellStyle}>{item.brand || "—"}</div>
<div style={itemCellStyle}>{item.pn || "—"}</div>
<div style={itemCellStyle}>{item.name || "—"}</div>
<div style={itemCellStyle}>Шт: {item.order_qty || 0}</div>
<div style={itemCellStyle}>
{typeof item.price_byn === "number"
? `${item.price_byn.toFixed(2)} BYN`
: item.display_price || "—"}
</div>
<div style={itemCellStyle}>
{calcItemTotal(item).toFixed(2)} BYN
</div>
</div>
</div>
))}
</div>
</>
)}
</div>
</div>
</div>
</div>
)}
</div>
);
}

function calcItemTotal(item) {
const price =
typeof item.price_byn === "number"
? item.price_byn
: Number(item.price_byn) || 0;

const qty =
typeof item.order_qty === "number"
? item.order_qty
: Number(item.order_qty) || 0;

return price * qty;
}

function calcOrderTotal(order) {
return (order.order_items || []).reduce((sum, item) => {
return sum + calcItemTotal(item);
}, 0);
}

function StatusBadge({ status }) {
const map = {
new: { label: "Новая", bg: "#eef6ff", color: "#1d4ed8" },
in_progress: { label: "В работе", bg: "#fff7ed", color: "#c2410c" },
processed: { label: "Обработана", bg: "#ecfdf5", color: "#15803d" },
canceled: { label: "Отменена", bg: "#fef2f2", color: "#b91c1c" }
};

const item = map[status] || {
label: status,
bg: "#f3f4f6",
color: "#374151"
};

return (
<span
style={{
display: "inline-block",
padding: "6px 10px",
borderRadius: 999,
background: item.bg,
color: item.color,
fontSize: 12,
fontWeight: 600
}}
>
{item.label}
</span>
);
}

function BoolBadge({ value, trueLabel, falseLabel, trueTone, falseTone }) {
const toneMap = {
success: { bg: "#e8f8e8", color: "#1d6b1d", border: "#b7dfb7" },
danger: { bg: "#fff1f1", color: "#b42318", border: "#efc1c1" },
neutral: { bg: "#f4f4f5", color: "#444", border: "#ddd" }
};

const tone = value ? toneMap[trueTone] : toneMap[falseTone];
const label = value ? trueLabel : falseLabel;

return (
<span
style={{
display: "inline-block",
padding: "6px 10px",
borderRadius: 999,
background: tone.bg,
color: tone.color,
border: `1px solid ${tone.border}`,
fontSize: 12,
fontWeight: 600,
whiteSpace: "nowrap"
}}
>
{label}
</span>
);
}

function InfoRow({ label, value }) {
return (
<div>
<div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{label}</div>
<div style={{ fontSize: 14, overflowWrap: "anywhere", wordBreak: "break-word" }}>
{value}
</div>
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
<div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
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

const itemCellStyle = {
fontSize: 14,
lineHeight: 1.4,
overflowWrap: "anywhere",
wordBreak: "break-word"
};
