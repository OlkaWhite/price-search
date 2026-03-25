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

function createEmptyItem(orderId) {
return {
id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
order_id: orderId,
brand: "",
pn: "",
name: "",
order_qty: 1,
stock_qty: null,
display_price: "",
price_byn: 0,
requested_price_byn: null,
isNew: true
};
}

function formatPriceDisplay(price) {
const value = Number(price) || 0;
return `${value.toFixed(2)} BYN`;
}

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
price_byn,
requested_price_byn
)
`)
.order("created_at", { ascending: false });

if (statusFilter !== "all") {
req = req.eq("status", statusFilter);
}

const { data: ordersData, error: ordersError } = await req;
if (ordersError) throw ordersError;

const userIds = Array.from(
new Set((ordersData || []).map((o) => o.user_id).filter(Boolean))
);

let profilesMap = {};

if (userIds.length > 0) {
const { data: profilesData, error: profilesError } = await supabase
.from("profiles")
.select("id, email, company_name, contact_name, phone, telegram, unp")
.in("id", userIds);

if (profilesError) throw profilesError;

profilesMap = Object.fromEntries(
(profilesData || []).map((p) => [p.id, p])
);
}

const enrichedOrders = (ordersData || []).map((order) => ({
...order,
order_items: (order.order_items || []).map((item) => ({
...item,
order_qty: Number(item.order_qty) || 1,
price_byn: Number(item.price_byn) || 0,
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === undefined
? null
: Number(item.requested_price_byn) || 0,
display_price: item.display_price || formatPriceDisplay(item.price_byn)
})),
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

function openOrder(order) {
setSelectedOrder({
...order,
order_items: (order.order_items || []).map((item) => ({
...item,
order_qty: Number(item.order_qty) || 1,
price_byn: Number(item.price_byn) || 0,
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === undefined
? null
: Number(item.requested_price_byn) || 0,
display_price: item.display_price || formatPriceDisplay(item.price_byn)
}))
});
}

function updateSelectedOrderField(field, value) {
setSelectedOrder((prev) => ({ ...prev, [field]: value }));
}

function updateOrderItem(itemId, field, value) {
setSelectedOrder((prev) => ({
...prev,
order_items: (prev.order_items || []).map((item) => {
if (item.id !== itemId) return item;

if (field === "order_qty") {
return { ...item, order_qty: Math.max(1, Number(value) || 1) };
}

if (field === "price_byn") {
const nextPrice = Number(value) || 0;
return {
...item,
price_byn: nextPrice,
display_price: formatPriceDisplay(nextPrice)
};
}

if (field === "requested_price_byn") {
return {
...item,
requested_price_byn: value === "" ? null : Number(value) || 0
};
}

return { ...item, [field]: value };
})
}));
}

function removeOrderItem(itemId) {
setSelectedOrder((prev) => ({
...prev,
order_items: (prev.order_items || []).filter((item) => item.id !== itemId)
}));
}

function addOrderItem() {
setSelectedOrder((prev) => ({
...prev,
order_items: [...(prev.order_items || []), createEmptyItem(prev.id)]
}));
}

async function saveOrderUpdates() {
if (!selectedOrder) return;

setSaving(true);

try {
const payload = {
status: selectedOrder.status,
manager_comment: selectedOrder.manager_comment || "",
invoice_url: selectedOrder.invoice_url?.trim() || null,
processed_at:
selectedOrder.status === "processed" ? new Date().toISOString() : null
};

const { error: orderError } = await supabase
.from("orders")
.update(payload)
.eq("id", selectedOrder.id);

if (orderError) throw orderError;

const existingItems = (selectedOrder.order_items || []).filter((item) => !item.isNew);
const newItems = (selectedOrder.order_items || []).filter((item) => item.isNew);

const { data: dbItems, error: dbReadError } = await supabase
.from("order_items")
.select("id")
.eq("order_id", selectedOrder.id);

if (dbReadError) throw dbReadError;

const dbIds = (dbItems || []).map((x) => x.id);
const currentExistingIds = existingItems.map((x) => x.id);
const idsToDelete = dbIds.filter((id) => !currentExistingIds.includes(id));

for (const item of existingItems) {
const normalizedPrice = Number(item.price_byn) || 0;
const normalizedQty = Math.max(1, Number(item.order_qty) || 1);

const { error } = await supabase
.from("order_items")
.update({
brand: item.brand || null,
pn: item.pn || null,
name: item.name || null,
order_qty: normalizedQty,
price_byn: normalizedPrice,
display_price: formatPriceDisplay(normalizedPrice),
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === ""
? null
: Number(item.requested_price_byn) || 0
})
.eq("id", item.id)
.eq("order_id", selectedOrder.id);

if (error) throw error;
}

if (newItems.length > 0) {
const insertPayload = newItems.map((item) => {
const normalizedPrice = Number(item.price_byn) || 0;
const normalizedQty = Math.max(1, Number(item.order_qty) || 1);

return {
order_id: selectedOrder.id,
brand: item.brand || null,
pn: item.pn || null,
name: item.name || null,
order_qty: normalizedQty,
stock_qty: item.stock_qty || null,
price_byn: normalizedPrice,
display_price: formatPriceDisplay(normalizedPrice),
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === ""
? null
: Number(item.requested_price_byn) || 0
};
});

const { error } = await supabase.from("order_items").insert(insertPayload);
if (error) throw error;
}

if (idsToDelete.length > 0) {
const { error } = await supabase
.from("order_items")
.delete()
.in("id", idsToDelete);

if (error) throw error;
}

await loadOrders();
setSelectedOrder(null);
alert("Заказ обновлён.");
} catch (error) {
console.error("saveOrderUpdates error:", error);
alert("Ошибка при сохранении: " + (error?.message || "неизвестная ошибка"));
} finally {
setSaving(false);
}
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

<button onClick={loadOrders} style={mainButtonStyle}>
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
<th key={h} style={thStyle}>
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
const requestIsGreen = !!order.invoice_requested && invoiceSet;

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
trueTone={requestIsGreen ? "success" : "danger"}
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
<button onClick={() => openOrder(order)} style={smallButtonStyle}>
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
gridTemplateColumns: "minmax(320px, 390px) minmax(0, 1fr)",
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
<div style={{ display: "grid", gap: 10 }}>
<CompactInfo
label="Дата"
value={new Date(selectedOrder.created_at).toLocaleString()}
/>
<CompactInfo
label="Контактное лицо"
value={
selectedOrder.profile?.contact_name ||
selectedOrder.customer_name ||
"—"
}
/>
<CompactInfo
label="Компания"
value={selectedOrder.profile?.company_name || "—"}
/>
<CompactInfo label="УНП" value={selectedOrder.profile?.unp || "—"} />
<CompactInfo
label="Телефон"
value={
selectedOrder.profile?.phone ||
selectedOrder.customer_contact ||
"—"
}
/>
<CompactInfo
label="Telegram"
value={selectedOrder.profile?.telegram || "—"}
/>
<CompactInfo
label="E-mail"
value={selectedOrder.profile?.email || "—"}
/>
<CompactInfo
label="Сумма заказа"
value={`${calcOrderTotal(selectedOrder).toFixed(2)} BYN`}
/>

<div>
<div style={compactLabelStyle}>Статус</div>
<div style={{ marginTop: 4 }}>
<StatusBadge status={selectedOrder.status} />
</div>
</div>

<div>
<div style={compactLabelStyle}>Счёт запрошен</div>
<div style={{ marginTop: 4 }}>
<BoolBadge
value={selectedOrder.invoice_requested}
trueLabel="Да"
falseLabel="Нет"
trueTone={
selectedOrder.invoice_requested && selectedOrder.invoice_url
? "success"
: "danger"
}
falseTone="neutral"
/>
</div>
</div>

<div>
<div style={compactLabelStyle}>Счёт выставлен</div>
<div style={{ marginTop: 4 }}>
<BoolBadge
value={!!selectedOrder.invoice_url}
trueLabel="Да"
falseLabel="Нет"
trueTone="success"
falseTone="danger"
/>
</div>
</div>
</div>

<div style={{ marginTop: 18 }}>
<div style={sectionTitleStyle}>Статус заказа</div>
<select
value={selectedOrder.status}
onChange={(e) => updateSelectedOrderField("status", e.target.value)}
style={fullControlStyle}
>
{STATUS_OPTIONS.filter((s) => s !== "all").map((status) => (
<option key={status} value={status}>
{STATUS_LABELS[status] || status}
</option>
))}
</select>
</div>

<div style={{ marginTop: 18 }}>
<div style={sectionTitleStyle}>Комментарий менеджера</div>
<textarea
value={selectedOrder.manager_comment || ""}
onChange={(e) =>
updateSelectedOrderField("manager_comment", e.target.value)
}
rows={4}
style={{
...fullControlStyle,
resize: "vertical"
}}
/>
</div>

<div style={{ marginTop: 18 }}>
<div style={sectionTitleStyle}>Ссылка на счёт</div>
<input
value={selectedOrder.invoice_url || ""}
onChange={(e) =>
updateSelectedOrderField("invoice_url", e.target.value)
}
placeholder="https://..."
style={fullControlStyle}
/>
</div>

<div style={{ marginTop: 18 }}>
<button
onClick={saveOrderUpdates}
disabled={saving}
style={{
...mainButtonStyle,
background: saving ? "#ddd" : "#111",
color: saving ? "#333" : "#fff",
cursor: saving ? "default" : "pointer"
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
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
marginBottom: 14,
flexWrap: "wrap"
}}
>
<h3 style={{ margin: 0 }}>Позиции заказа</h3>

<button onClick={addOrderItem} style={smallButtonStyle}>
Добавить позицию
</button>
</div>

<div
style={{
display: "grid",
gridTemplateColumns:
"120px 170px minmax(240px, 1fr) 90px 120px 130px 140px 130px",
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
<div>Цена клиента</div>
<div></div>
</div>

{(selectedOrder.order_items || []).length === 0 ? (
<div style={{ color: "#666" }}>Позиции в заказе не найдены.</div>
) : (
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
gridTemplateColumns:
"120px 170px minmax(240px, 1fr) 90px 120px 130px 140px 130px",
gap: 12,
alignItems: "start"
}}
>
<input
value={item.brand || ""}
onChange={(e) =>
updateOrderItem(item.id, "brand", e.target.value)
}
style={cellInputStyle}
placeholder="Бренд"
/>

<input
value={item.pn || ""}
onChange={(e) =>
updateOrderItem(item.id, "pn", e.target.value)
}
style={cellInputStyle}
placeholder="P/N"
/>

<input
value={item.name || ""}
onChange={(e) =>
updateOrderItem(item.id, "name", e.target.value)
}
style={cellInputStyle}
placeholder="Наименование"
/>

<input
type="number"
min="1"
value={item.order_qty}
onChange={(e) =>
updateOrderItem(item.id, "order_qty", e.target.value)
}
style={cellInputStyle}
/>

<input
type="number"
min="0"
step="0.01"
value={item.price_byn}
onChange={(e) =>
updateOrderItem(item.id, "price_byn", e.target.value)
}
style={cellInputStyle}
/>

<div style={itemCellStyle}>
{calcItemTotal(item).toFixed(2)} BYN
</div>

<div style={itemCellStyle}>
{item.requested_price_byn !== null &&
item.requested_price_byn !== undefined
? `${Number(item.requested_price_byn).toFixed(2)} BYN`
: "—"}
</div>

<button
onClick={() => removeOrderItem(item.id)}
style={{
padding: "8px 10px",
borderRadius: 10,
border: "1px solid #e3b7b7",
background: "#fff",
color: "#a22",
cursor: "pointer",
fontSize: 13,
width: "100%"
}}
>
Удалить
</button>
</div>
</div>
))}
</div>
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
const price = Number(item.price_byn) || 0;
const qty = Number(item.order_qty) || 0;
return price * qty;
}

function calcOrderTotal(order) {
return (order.order_items || []).reduce((sum, item) => sum + calcItemTotal(item), 0);
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

function CompactInfo({ label, value }) {
return (
<div
style={{
display: "grid",
gridTemplateColumns: "130px minmax(0, 1fr)",
gap: 10,
alignItems: "start"
}}
>
<div style={compactLabelStyle}>{label}</div>
<div style={compactValueStyle}>{value}</div>
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

const thStyle = {
textAlign: "left",
padding: "12px 10px",
borderBottom: "1px solid #eee",
background: "#fafafa",
whiteSpace: "nowrap"
};

const tdStyle = {
padding: "12px 10px",
borderBottom: "1px solid #eee",
verticalAlign: "top"
};

const mainButtonStyle = {
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
fontSize: 14
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

const compactLabelStyle = {
fontSize: 12,
color: "#666",
fontWeight: 600
};

const compactValueStyle = {
fontSize: 14,
overflowWrap: "anywhere",
wordBreak: "break-word"
};

const sectionTitleStyle = {
fontWeight: 700,
marginBottom: 8
};

const fullControlStyle = {
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
boxSizing: "border-box"
};

const cellInputStyle = {
width: "100%",
padding: "8px 10px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
boxSizing: "border-box"
};

const itemCellStyle = {
fontSize: 14,
lineHeight: 1.4,
overflowWrap: "anywhere",
wordBreak: "break-word",
paddingTop: 8
};
