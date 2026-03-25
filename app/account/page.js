"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const STATUS_LABELS = {
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
display_price: "По запросу",
price_byn: 0,
requested_price_byn: null,
request_price_mode: false,
isNew: true
};
}

export default function AccountPage() {
const [sessionUser, setSessionUser] = useState(null);
const [profile, setProfile] = useState(null);
const [orders, setOrders] = useState([]);

const [loading, setLoading] = useState(true);
const [savingProfile, setSavingProfile] = useState(false);
const [savingOrderId, setSavingOrderId] = useState(null);
const [requestingInvoiceId, setRequestingInvoiceId] = useState(null);
const [errorText, setErrorText] = useState("");
const [message, setMessage] = useState("");

const [profileEditMode, setProfileEditMode] = useState(false);
const [editingOrderId, setEditingOrderId] = useState(null);

const [companyName, setCompanyName] = useState("");
const [contactName, setContactName] = useState("");
const [phone, setPhone] = useState("");
const [telegram, setTelegram] = useState("");
const [unp, setUnp] = useState("");

const [profileDraft, setProfileDraft] = useState({
companyName: "",
contactName: "",
phone: "",
telegram: "",
unp: ""
});

useEffect(() => {
let mounted = true;

async function loadAccount() {
setLoading(true);
setErrorText("");
setMessage("");

try {
const {
data: { session }
} = await supabase.auth.getSession();

if (!mounted) return;

if (!session?.user) {
window.location.href = "/login";
return;
}

setSessionUser(session.user);

const { data: profileData, error: profileError } = await supabase
.from("profiles")
.select("id, email, company_name, contact_name, phone, telegram, unp, role")
.eq("id", session.user.id)
.maybeSingle();

if (profileError) throw profileError;

const { data: ordersData, error: ordersError } = await supabase
.from("orders")
.select(`
id,
customer_name,
customer_contact,
customer_comment,
status,
manager_comment,
invoice_url,
invoice_requested,
created_at,
order_items (
id,
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
.eq("user_id", session.user.id)
.order("created_at", { ascending: false });

if (ordersError) throw ordersError;

if (!mounted) return;

const normalizedOrders = (ordersData || []).map((order) => ({
...order,
order_items: (order.order_items || []).map((item) => ({
...item,
order_qty: Number(item.order_qty) || 1,
price_byn: Number(item.price_byn) || 0,
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === undefined
? null
: Number(item.requested_price_byn) || 0,
request_price_mode: false
}))
}));

setProfile(profileData || null);
setOrders(normalizedOrders);

const nextCompany = profileData?.company_name || "";
const nextContact = profileData?.contact_name || "";
const nextPhone = profileData?.phone || "";
const nextTelegram = profileData?.telegram || "";
const nextUnp = profileData?.unp || "";

setCompanyName(nextCompany);
setContactName(nextContact);
setPhone(nextPhone);
setTelegram(nextTelegram);
setUnp(nextUnp);

setProfileDraft({
companyName: nextCompany,
contactName: nextContact,
phone: nextPhone,
telegram: nextTelegram,
unp: nextUnp
});
} catch (err) {
console.error("Account load error:", err);
if (!mounted) return;
setErrorText(err?.message || "Не удалось загрузить личный кабинет.");
} finally {
if (mounted) setLoading(false);
}
}

loadAccount();

return () => {
mounted = false;
};
}, []);

const ordersStats = useMemo(() => {
const total = orders.length;
const totalAmount = orders.reduce((sum, order) => sum + calcOrderTotal(order), 0);
return { total, totalAmount };
}, [orders]);

function startProfileEdit() {
setProfileDraft({
companyName,
contactName,
phone,
telegram,
unp
});
setProfileEditMode(true);
}

function cancelProfileEdit() {
setProfileDraft({
companyName,
contactName,
phone,
telegram,
unp
});
setProfileEditMode(false);
}

async function handleSaveProfile(e) {
e.preventDefault();

if (!sessionUser) return;

setSavingProfile(true);
setErrorText("");
setMessage("");

try {
const payload = {
id: sessionUser.id,
email: sessionUser.email || null,
company_name: profileDraft.companyName.trim() || null,
contact_name: profileDraft.contactName.trim() || null,
phone: profileDraft.phone.trim() || null,
telegram: profileDraft.telegram.trim() || null,
unp: profileDraft.unp.trim() || null
};

const { error } = await supabase.from("profiles").upsert(payload);
if (error) throw error;

setCompanyName(profileDraft.companyName);
setContactName(profileDraft.contactName);
setPhone(profileDraft.phone);
setTelegram(profileDraft.telegram);
setUnp(profileDraft.unp);

setProfile((prev) =>
prev
? {
...prev,
company_name: profileDraft.companyName.trim() || null,
contact_name: profileDraft.contactName.trim() || null,
phone: profileDraft.phone.trim() || null,
telegram: profileDraft.telegram.trim() || null,
unp: profileDraft.unp.trim() || null
}
: prev
);

setProfileEditMode(false);
setMessage("Данные профиля сохранены.");
} catch (err) {
console.error("Profile save error:", err);
setErrorText(err?.message || "Не удалось сохранить данные.");
} finally {
setSavingProfile(false);
}
}

async function handleLogout() {
await supabase.auth.signOut();
window.location.href = "/";
}

function isOrderLocked(order) {
return !!order.invoice_url && order.status === "processed";
}

function startOrderEdit(orderId) {
setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
order_items: (order.order_items || []).map((item) => ({
...item,
order_qty: Number(item.order_qty) || 1,
request_price_mode: item.requested_price_byn !== null
}))
}
)
);
setEditingOrderId(orderId);
}

function cancelOrderEdit() {
window.location.reload();
}

function changeOrderComment(orderId, nextValue) {
setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
customer_comment: nextValue
}
)
);
}

function removeItemFromOrder(orderId, itemId) {
setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
order_items: (order.order_items || []).filter((item) => item.id !== itemId)
}
)
);
}

function toggleRequestPrice(orderId, itemId) {
setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
order_items: (order.order_items || []).map((item) =>
item.id !== itemId
? item
: {
...item,
request_price_mode: !item.request_price_mode
}
)
}
)
);
}

function updateOrderItemField(orderId, itemId, field, value) {
setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
order_items: (order.order_items || []).map((item) => {
if (item.id !== itemId) return item;

if (field === "order_qty") {
return { ...item, order_qty: Math.max(1, Number(value) || 1) };
}

if (field === "requested_price_byn") {
return {
...item,
requested_price_byn: value === "" ? null : Number(value) || 0
};
}

return { ...item, [field]: value };
})
}
)
);
}

async function handleSaveOrder(order) {
try {
setSavingOrderId(order.id);
setErrorText("");
setMessage("");

const { error: orderUpdateError } = await supabase
.from("orders")
.update({
customer_comment: order.customer_comment || null
})
.eq("id", order.id);

if (orderUpdateError) throw orderUpdateError;

const currentItems = order.order_items || [];

const { data: dbItems, error: readError } = await supabase
.from("order_items")
.select("id")
.eq("order_id", order.id);

if (readError) throw readError;

const dbIds = (dbItems || []).map((x) => x.id);
const existingItems = currentItems.filter((item) => !item.isNew);
const newItems = currentItems.filter((item) => item.isNew);

const currentExistingIds = existingItems.map((x) => x.id);
const idsToDelete = dbIds.filter((id) => !currentExistingIds.includes(id));

for (const item of existingItems) {
const { error: updateError } = await supabase
.from("order_items")
.update({
order_qty: Number(item.order_qty) || 1,
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === ""
? null
: Number(item.requested_price_byn) || 0
})
.eq("id", item.id)
.eq("order_id", order.id);

if (updateError) throw updateError;
}

if (newItems.length > 0) {
const insertPayload = newItems.map((item) => ({
order_id: order.id,
brand: item.brand || null,
pn: item.pn || null,
name: item.name || null,
order_qty: Number(item.order_qty) || 1,
stock_qty: item.stock_qty || null,
price_byn: Number(item.price_byn) || 0,
display_price:
Number(item.price_byn) > 0
? `${Number(item.price_byn).toFixed(2)} BYN`
: "По запросу",
requested_price_byn:
item.requested_price_byn === null || item.requested_price_byn === ""
? null
: Number(item.requested_price_byn) || 0
}));

const { error: insertError } = await supabase
.from("order_items")
.insert(insertPayload);

if (insertError) throw insertError;
}

if (idsToDelete.length > 0) {
const { error: deleteError } = await supabase
.from("order_items")
.delete()
.in("id", idsToDelete);

if (deleteError) throw deleteError;
}

setEditingOrderId(null);
setMessage(`Заявка #${order.id} сохранена.`);
} catch (err) {
console.error("Order save error:", err);
setErrorText(err?.message || "Не удалось сохранить заявку.");
} finally {
setSavingOrderId(null);
}
}

async function handleRequestInvoice(orderId) {
try {
setRequestingInvoiceId(orderId);
setErrorText("");
setMessage("");

const { error } = await supabase
.from("orders")
.update({ invoice_requested: true })
.eq("id", orderId);

if (error) throw error;

setOrders((prev) =>
prev.map((order) =>
order.id === orderId ? { ...order, invoice_requested: true } : order
)
);

setMessage(`Запрос на счёт по заявке #${orderId} отправлен.`);
} catch (err) {
console.error("Invoice request error:", err);
setErrorText(err?.message || "Не удалось запросить счёт.");
} finally {
setRequestingInvoiceId(null);
}
}

if (loading) {
return (
<div style={pageWrapStyle}>
<div style={pageInnerStyle}>Загружаю личный кабинет...</div>
</div>
);
}

return (
<div style={pageWrapStyle}>
<div style={pageInnerStyle}>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 16,
alignItems: "center",
flexWrap: "wrap",
marginBottom: 20
}}
>
<div>
<h1 style={{ margin: 0, fontSize: 32 }}>Личный кабинет</h1>
<p style={{ marginTop: 8, color: "#666" }}>
Профиль компании и ваши заявки
</p>
</div>

<button onClick={handleLogout} style={secondaryButtonStyle}>
Выйти
</button>
</div>

{message && (
<div
style={{
marginBottom: 16,
padding: 12,
borderRadius: 10,
border: "1px solid #cce5cc",
background: "#f3fff3",
color: "#2e6b2e"
}}
>
{message}
</div>
)}

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

<div style={topGridStyle}>
<div style={cardStyle}>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
marginBottom: 18,
flexWrap: "wrap"
}}
>
<h2 style={{ margin: 0 }}>Профиль</h2>

{!profileEditMode ? (
<button onClick={startProfileEdit} style={secondaryButtonStyle}>
Редактировать
</button>
) : null}
</div>

{!profileEditMode ? (
<div style={{ display: "grid", gap: 14 }}>
<InfoRow label="Компания" value={companyName || "—"} />
<InfoRow label="Контактное лицо" value={contactName || "—"} />
</div>
) : (
<form onSubmit={handleSaveProfile} style={{ display: "grid", gap: 14 }}>
<Field label="Email">
<input
value={profile?.email || sessionUser?.email || ""}
disabled
style={{ ...inputStyle, background: "#f8f8f8", color: "#666" }}
/>
</Field>

<Field label="Компания">
<input
value={profileDraft.companyName}
onChange={(e) =>
setProfileDraft((prev) => ({ ...prev, companyName: e.target.value }))
}
style={inputStyle}
/>
</Field>

<Field label="Контактное лицо">
<input
value={profileDraft.contactName}
onChange={(e) =>
setProfileDraft((prev) => ({ ...prev, contactName: e.target.value }))
}
style={inputStyle}
/>
</Field>

<Field label="УНП">
<input
value={profileDraft.unp}
onChange={(e) =>
setProfileDraft((prev) => ({ ...prev, unp: e.target.value }))
}
style={inputStyle}
/>
</Field>

<Field label="Телефон">
<input
value={profileDraft.phone}
onChange={(e) =>
setProfileDraft((prev) => ({ ...prev, phone: e.target.value }))
}
style={inputStyle}
/>
</Field>

<Field label="Telegram">
<input
value={profileDraft.telegram}
onChange={(e) =>
setProfileDraft((prev) => ({ ...prev, telegram: e.target.value }))
}
style={inputStyle}
/>
</Field>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
type="submit"
disabled={savingProfile}
style={{
...primaryButtonStyle,
background: savingProfile ? "#ddd" : "#111",
color: savingProfile ? "#333" : "#fff",
cursor: savingProfile ? "default" : "pointer"
}}
>
{savingProfile ? "Сохраняю..." : "Сохранить"}
</button>

<button
type="button"
onClick={cancelProfileEdit}
style={secondaryButtonStyle}
>
Отмена
</button>
</div>
</form>
)}
</div>

<div style={cardStyle}>
<h2 style={{ marginTop: 0, marginBottom: 16 }}>Сводка</h2>
<InfoRow label="Всего заявок" value={orders.length} />
<InfoRow
label="Общая сумма заявок"
value={`${orders.reduce((sum, order) => sum + calcOrderTotal(order), 0).toFixed(2)} BYN`}
/>
</div>
</div>

<div style={{ marginTop: 24 }}>
<div style={cardStyle}>
<h2 style={{ marginTop: 0, marginBottom: 18 }}>Мои заявки</h2>

{orders.length === 0 ? (
<div style={{ color: "#666" }}>Заявок пока нет.</div>
) : (
<div style={{ display: "grid", gap: 16 }}>
{orders.map((order) => {
const isEditing = editingOrderId === order.id;
const hasInvoice = !!order.invoice_url;
const locked = isOrderLocked(order);

return (
<div
key={order.id}
style={{
border: "1px solid #e6e3dc",
borderRadius: 14,
padding: 16,
background: "#f7f6f2"
}}
>
<div
style={{
display: "grid",
gridTemplateColumns: "minmax(320px, 1fr) minmax(240px, 380px) auto",
gap: 12,
alignItems: "start"
}}
>
<div style={{ fontWeight: 700, fontSize: 18 }}>
Заявка #{order.id} — {new Date(order.created_at).toLocaleString()}
</div>

{isEditing ? (
<textarea
value={order.customer_comment || ""}
onChange={(e) => changeOrderComment(order.id, e.target.value)}
placeholder="Комментарий к заявке"
rows={2}
style={{
width: "100%",
maxWidth: 380,
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
resize: "vertical",
boxSizing: "border-box"
}}
/>
) : (
<div style={{ maxWidth: 380 }}>
{order.customer_comment ? (
<InfoRow label="Комментарий к заявке" value={order.customer_comment} />
) : (
<div style={{ fontSize: 13, color: "#888", paddingTop: 4 }}>
Без комментария
</div>
)}
</div>
)}

<div
style={{
display: "flex",
gap: 10,
alignItems: "center",
flexWrap: "wrap",
justifyContent: "flex-end"
}}
>
<StatusBadge status={order.status} />

{hasInvoice ? (
<a
href={order.invoice_url}
target="_blank"
rel="noopener noreferrer"
style={{
display: "inline-block",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid #b7dfb7",
background: "#e8f8e8",
color: "#1d6b1d",
textDecoration: "none",
fontSize: 14
}}
>
Скачать счёт
</a>
) : (
<button
onClick={() => handleRequestInvoice(order.id)}
disabled={requestingInvoiceId === order.id || order.invoice_requested}
style={{
...secondaryButtonStyle,
border: order.invoice_requested ? "1px solid #d8d8d8" : "1px solid #111",
background: order.invoice_requested ? "#f3f3f3" : "#fff",
color: "#111",
cursor:
requestingInvoiceId === order.id || order.invoice_requested
? "default"
: "pointer"
}}
>
{order.invoice_requested
? "Счёт запрошен"
: requestingInvoiceId === order.id
? "Отправляю..."
: "Запросить счёт"}
</button>
)}
</div>
</div>

<div
style={{
marginTop: 12,
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
flexWrap: "wrap"
}}
>
<div style={{ fontWeight: 700 }}>Позиции</div>

{isEditing ? (
<button
disabled
style={{
...secondaryButtonStyle,
border: "1px solid #ddd",
background: "#f2f2f2",
color: "#999",
cursor: "not-allowed"
}}
>
Добавить позицию
</button>
) : null}
</div>

<div style={{ marginTop: 12, display: "grid", gap: 8 }}>
{(order.order_items || []).map((item) => {
const itemTotal = calcItemTotal(item);
const unitPrice =
Number(item.price_byn) > 0
? `${Number(item.price_byn).toFixed(2)} BYN`
: "По запросу";

return (
<div
key={item.id}
style={{
border: "1px solid #ece7dd",
borderRadius: 12,
padding: 12,
background: "#fcfbf8"
}}
>
{!isEditing ? (
<div
style={{
display: "grid",
gridTemplateColumns: "120px 160px minmax(260px, 1fr) 120px 90px 140px 160px",
gap: 12,
alignItems: "start"
}}
>
<div style={cellStyle}>{item.brand || "—"}</div>
<div style={cellStyle}>{item.pn || "—"}</div>
<div style={cellStyle}>{item.name || "—"}</div>
<div style={cellStyle}>Цена: {unitPrice}</div>
<div style={cellStyle}>Шт: {item.order_qty || 0}</div>
<div style={cellStyle}>Сумма: {itemTotal.toFixed(2)} BYN</div>
<div style={cellStyle}>
{item.requested_price_byn !== null &&
item.requested_price_byn !== undefined
? `Цена клиента: ${Number(item.requested_price_byn).toFixed(2)} BYN`
: "—"}
</div>
</div>
) : (
<div
style={{
display: "grid",
gridTemplateColumns: "120px 160px minmax(220px, 1fr) 120px 120px 170px 140px",
gap: 12,
alignItems: "start"
}}
>
<div style={cellStyle}>{item.brand || "—"}</div>
<div style={cellStyle}>{item.pn || "—"}</div>
<div style={cellStyle}>{item.name || "—"}</div>
<div style={cellStyle}>{unitPrice}</div>

<div style={cellStyle}>
<input
type="number"
min="1"
value={item.order_qty}
onChange={(e) =>
updateOrderItemField(
order.id,
item.id,
"order_qty",
e.target.value
)
}
style={cellInputStyle}
/>
</div>

<div>
<button
onClick={() => toggleRequestPrice(order.id, item.id)}
style={secondaryButtonStyle}
>
{item.requested_price_byn !== null
? "Цена запрошена"
: "Запросить цену"}
</button>

{(item.request_price_mode || item.requested_price_byn !== null) && (
<input
type="number"
min="0"
step="0.01"
value={item.requested_price_byn ?? ""}
onChange={(e) =>
updateOrderItemField(
order.id,
item.id,
"requested_price_byn",
e.target.value
)
}
placeholder="Ваша цена"
style={{
...cellInputStyle,
marginTop: 8
}}
/>
)}
</div>

<button
onClick={() => removeItemFromOrder(order.id, item.id)}
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
)}
</div>
);
})}
</div>

{(order.order_items || []).length === 0 ? (
<div style={{ marginTop: 12, color: "#a22", fontSize: 14 }}>
В заявке не осталось позиций.
</div>
) : null}

<div
style={{
marginTop: 14,
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
flexWrap: "wrap"
}}
>
<div style={{ fontWeight: 700 }}>
Общая сумма: {calcOrderTotal(order).toFixed(2)} BYN
</div>

{!isEditing ? (
locked ? (
<button
disabled
style={{
...secondaryButtonStyle,
border: "1px solid #ddd",
background: "#f2f2f2",
color: "#999",
cursor: "not-allowed"
}}
>
Редактирование недоступно
</button>
) : (
<button
onClick={() => startOrderEdit(order.id)}
style={secondaryButtonStyle}
>
Редактировать
</button>
)
) : (
<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
onClick={() => handleSaveOrder(order)}
disabled={savingOrderId === order.id}
style={{
...primaryButtonStyle,
background: savingOrderId === order.id ? "#ddd" : "#111",
color: savingOrderId === order.id ? "#333" : "#fff",
cursor: savingOrderId === order.id ? "default" : "pointer"
}}
>
{savingOrderId === order.id ? "Сохраняю..." : "Сохранить"}
</button>

<button onClick={cancelOrderEdit} style={secondaryButtonStyle}>
Отмена
</button>
</div>
)}
</div>
</div>
);
})}
</div>
)}
</div>
</div>
</div>
</div>
);
}

function calcItemTotal(item) {
const price = Number(item.price_byn) || 0;
const qty = Number(item.order_qty) || 0;
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
label: STATUS_LABELS[status] || status,
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
fontWeight: 600,
whiteSpace: "nowrap"
}}
>
{item.label}
</span>
);
}

function Field({ label, children }) {
return (
<div>
<div style={{ marginBottom: 8, fontSize: 13, color: "#666" }}>{label}</div>
{children}
</div>
);
}

function InfoRow({ label, value }) {
return (
<div>
<div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{label}</div>
<div
style={{
fontSize: 14,
overflowWrap: "anywhere",
wordBreak: "break-word"
}}
>
{value}
</div>
</div>
);
}

const pageWrapStyle = {
width: "100%",
padding: "24px 16px 60px",
boxSizing: "border-box"
};

const pageInnerStyle = {
width: "98vw",
maxWidth: 2240,
margin: "0 auto"
};

const topGridStyle = {
display: "grid",
gridTemplateColumns: "minmax(420px, 1fr) minmax(280px, 420px)",
gap: 24,
alignItems: "start"
};

const cardStyle = {
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20,
minWidth: 0
};

const inputStyle = {
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

const primaryButtonStyle = {
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
fontSize: 14,
cursor: "pointer"
};

const secondaryButtonStyle = {
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#fff",
color: "#111",
cursor: "pointer",
fontSize: 14
};

const cellStyle = {
fontSize: 14,
lineHeight: 1.4,
overflowWrap: "anywhere",
wordBreak: "break-word"
};
