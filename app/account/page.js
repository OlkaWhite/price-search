"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const STATUS_LABELS = {
new: "Новая",
in_progress: "В работе",
processed: "Обработана",
canceled: "Отменена"
};

export default function AccountPage() {
const [sessionUser, setSessionUser] = useState(null);
const [profile, setProfile] = useState(null);
const [orders, setOrders] = useState([]);

const [loading, setLoading] = useState(true);
const [savingProfile, setSavingProfile] = useState(false);
const [savingOrderId, setSavingOrderId] = useState(null);
const [errorText, setErrorText] = useState("");
const [message, setMessage] = useState("");

const [profileEditMode, setProfileEditMode] = useState(false);
const [editingOrderId, setEditingOrderId] = useState(null);

const [companyName, setCompanyName] = useState("");
const [contactName, setContactName] = useState("");
const [phone, setPhone] = useState("");
const [telegram, setTelegram] = useState("");

const [profileDraft, setProfileDraft] = useState({
companyName: "",
contactName: "",
phone: "",
telegram: ""
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
.select("id, email, company_name, contact_name, phone, telegram, role")
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
created_at,
order_items (
id,
brand,
pn,
name,
order_qty,
stock_qty,
display_price,
price_byn
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
order_qty: Number(item.order_qty) || 1
}))
}));

setProfile(profileData || null);
setOrders(normalizedOrders);

const nextCompany = profileData?.company_name || "";
const nextContact = profileData?.contact_name || "";
const nextPhone = profileData?.phone || "";
const nextTelegram = profileData?.telegram || "";

setCompanyName(nextCompany);
setContactName(nextContact);
setPhone(nextPhone);
setTelegram(nextTelegram);

setProfileDraft({
companyName: nextCompany,
contactName: nextContact,
phone: nextPhone,
telegram: nextTelegram
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
telegram
});
setProfileEditMode(true);
}

function cancelProfileEdit() {
setProfileDraft({
companyName,
contactName,
phone,
telegram
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
telegram: profileDraft.telegram.trim() || null
};

const { error } = await supabase.from("profiles").upsert(payload);

if (error) throw error;

setCompanyName(profileDraft.companyName);
setContactName(profileDraft.contactName);
setPhone(profileDraft.phone);
setTelegram(profileDraft.telegram);

setProfile((prev) =>
prev
? {
...prev,
company_name: profileDraft.companyName.trim() || null,
contact_name: profileDraft.contactName.trim() || null,
phone: profileDraft.phone.trim() || null,
telegram: profileDraft.telegram.trim() || null
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

function startOrderEdit(orderId) {
setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
order_items: (order.order_items || []).map((item) => ({
...item,
order_qty: Number(item.order_qty) || 1
}))
}
)
);
setEditingOrderId(orderId);
}

function cancelOrderEdit(orderId) {
window.location.reload();
}

function changeItemQty(orderId, itemId, nextValue) {
const qty = Math.max(1, Number(nextValue) || 1);

setOrders((prev) =>
prev.map((order) =>
order.id !== orderId
? order
: {
...order,
order_items: (order.order_items || []).map((item) =>
item.id !== itemId ? item : { ...item, order_qty: qty }
)
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

async function handleSaveOrder(order) {
try {
setSavingOrderId(order.id);
setErrorText("");
setMessage("");

const currentItems = order.order_items || [];

const { data: dbItems, error: readError } = await supabase
.from("order_items")
.select("id")
.eq("order_id", order.id);

if (readError) throw readError;

const dbIds = (dbItems || []).map((x) => x.id);
const currentIds = currentItems.map((x) => x.id);
const idsToDelete = dbIds.filter((id) => !currentIds.includes(id));

for (const item of currentItems) {
const { error: updateError } = await supabase
.from("order_items")
.update({
order_qty: Number(item.order_qty) || 1
})
.eq("id", item.id)
.eq("order_id", order.id);

if (updateError) throw updateError;
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

return (
<div
key={order.id}
style={{
border: "1px solid #e9e9e9",
borderRadius: 14,
padding: 16,
background: "#fff"
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
flexWrap: "wrap"
}}
>
<div style={{ fontWeight: 700, fontSize: 18 }}>
Заявка #{order.id} — {new Date(order.created_at).toLocaleString()}
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
<StatusBadge status={order.status} />

{!isEditing ? (
<button
onClick={() => startOrderEdit(order.id)}
style={secondaryButtonStyle}
>
Редактировать
</button>
) : (
<>
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

<button
onClick={() => cancelOrderEdit(order.id)}
style={secondaryButtonStyle}
>
Отмена
</button>
</>
)}
</div>
</div>

<div style={{ marginTop: 12 }}>
<div style={{ display: "grid", gap: 8 }}>
{(order.order_items || []).map((item) => (
<div
key={item.id}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12,
background: "#fafafa"
}}
>
{!isEditing ? (
<div
style={{
display: "grid",
gridTemplateColumns: "120px 160px minmax(260px, 1fr) 90px 110px",
gap: 12,
alignItems: "start"
}}
>
<div style={cellStyle}>{item.brand || "—"}</div>
<div style={cellStyle}>{item.pn || "—"}</div>
<div style={cellStyle}>{item.name || "—"}</div>
<div style={cellStyle}>Кол-во: {item.order_qty || 0}</div>
<div style={cellStyle}>{item.display_price || "—"}</div>
</div>
) : (
<div
style={{
display: "grid",
gridTemplateColumns: "120px 160px minmax(220px, 1fr) 120px 110px 140px",
gap: 12,
alignItems: "start"
}}
>
<div style={cellStyle}>{item.brand || "—"}</div>
<div style={cellStyle}>{item.pn || "—"}</div>
<div style={cellStyle}>{item.name || "—"}</div>

<div style={cellStyle}>
<input
type="number"
min="1"
value={item.order_qty}
onChange={(e) =>
changeItemQty(order.id, item.id, e.target.value)
}
style={{
width: "100%",
padding: "8px 10px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
boxSizing: "border-box"
}}
/>
</div>

<div style={cellStyle}>{item.display_price || "—"}</div>

<div>
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
</div>
)}
</div>
))}
</div>

{(order.order_items || []).length === 0 ? (
<div style={{ marginTop: 12, color: "#a22", fontSize: 14 }}>
В заявке не осталось позиций.
</div>
) : null}
</div>

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

{order.invoice_url ? (
<a
href={order.invoice_url}
target="_blank"
rel="noopener noreferrer"
style={{
display: "inline-block",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
textDecoration: "none",
fontSize: 14
}}
>
Скачать счёт
</a>
) : null}
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
width: "100%",
maxWidth: 1600,
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
