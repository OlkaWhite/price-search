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
const [errorText, setErrorText] = useState("");
const [message, setMessage] = useState("");

const [companyName, setCompanyName] = useState("");
const [contactName, setContactName] = useState("");
const [phone, setPhone] = useState("");
const [telegram, setTelegram] = useState("");

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

setProfile(profileData || null);
setOrders(ordersData || []);

setCompanyName(profileData?.company_name || "");
setContactName(profileData?.contact_name || "");
setPhone(profileData?.phone || "");
setTelegram(profileData?.telegram || "");
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
company_name: companyName.trim() || null,
contact_name: contactName.trim() || null,
phone: phone.trim() || null,
telegram: telegram.trim() || null
};

const { error } = await supabase.from("profiles").upsert(payload);

if (error) throw error;

setMessage("Данные сохранены.");
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

if (loading) {
return (
<div style={{ width: "98vw", maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
Загружаю личный кабинет...
</div>
);
}

return (
<div style={{ width: "98vw", maxWidth: 1400, margin: "0 auto", padding: "24px 16px 60px" }}>
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
<h1 style={{ margin: 0 }}>Личный кабинет</h1>
<p style={{ marginTop: 8, color: "#666" }}>
Профиль компании и ваши заявки
</p>
</div>

<button
onClick={handleLogout}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#fff",
color: "#111",
cursor: "pointer",
fontSize: 14
}}
>
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

<div
style={{
display: "grid",
gridTemplateColumns: "0.9fr 1.1fr",
gap: 20
}}
>
<div style={{ display: "grid", gap: 20 }}>
<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20
}}
>
<h2 style={{ marginTop: 0 }}>Профиль</h2>

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
value={companyName}
onChange={(e) => setCompanyName(e.target.value)}
style={inputStyle}
/>
</Field>

<Field label="Контактное лицо">
<input
value={contactName}
onChange={(e) => setContactName(e.target.value)}
style={inputStyle}
/>
</Field>

<Field label="Телефон">
<input
value={phone}
onChange={(e) => setPhone(e.target.value)}
style={inputStyle}
/>
</Field>

<Field label="Telegram">
<input
value={telegram}
onChange={(e) => setTelegram(e.target.value)}
style={inputStyle}
/>
</Field>

<button
type="submit"
disabled={savingProfile}
style={{
padding: "12px 14px",
borderRadius: 10,
border: "1px solid #111",
background: savingProfile ? "#ddd" : "#111",
color: savingProfile ? "#333" : "#fff",
cursor: savingProfile ? "default" : "pointer",
fontSize: 14
}}
>
{savingProfile ? "Сохраняю..." : "Сохранить"}
</button>
</form>
</div>

<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20
}}
>
<h2 style={{ marginTop: 0 }}>Сводка</h2>
<InfoRow label="Всего заявок" value={ordersStats.total} />
<InfoRow label="Общая сумма заявок" value={`${ordersStats.totalAmount.toFixed(2)} BYN`} />
</div>
</div>

<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20
}}
>
<h2 style={{ marginTop: 0 }}>Мои заявки</h2>

{orders.length === 0 ? (
<div style={{ color: "#666" }}>Заявок пока нет.</div>
) : (
<div style={{ display: "grid", gap: 14 }}>
{orders.map((order) => (
<div
key={order.id}
style={{
border: "1px solid #eee",
borderRadius: 14,
padding: 14
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "flex-start",
flexWrap: "wrap"
}}
>
<div>
<div style={{ fontWeight: 700, fontSize: 16 }}>
Заявка #{order.id}
</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
{new Date(order.created_at).toLocaleString()}
</div>
</div>

<StatusBadge status={order.status} />
</div>

<div style={{ marginTop: 12, display: "grid", gap: 6 }}>
<InfoRow label="Контакт" value={order.customer_contact || "—"} />
<InfoRow
label="Комментарий к заявке"
value={order.customer_comment || "—"}
/>
<InfoRow
label="Комментарий менеджера"
value={order.manager_comment || "—"}
/>
<InfoRow
label="Сумма заказа"
value={`${calcOrderTotal(order).toFixed(2)} BYN`}
/>
</div>

{order.invoice_url ? (
<a
href={order.invoice_url}
target="_blank"
rel="noopener noreferrer"
style={{
display: "inline-block",
marginTop: 12,
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

<div style={{ marginTop: 14 }}>
<div style={{ fontWeight: 700, marginBottom: 8 }}>Позиции</div>

<div style={{ display: "grid", gap: 10 }}>
{(order.order_items || []).map((item) => (
<div
key={item.id}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12
}}
>
<div style={{ fontWeight: 700 }}>
{item.brand || "—"} {item.pn || ""}
</div>

<div style={{ marginTop: 4, color: "#444", fontSize: 14 }}>
{item.name || "—"}
</div>

<div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
Кол-во: {item.order_qty || 0}
</div>

<div style={{ marginTop: 4, color: "#666", fontSize: 13 }}>
Цена: {item.display_price || "—"}
</div>
</div>
))}
</div>
</div>
</div>
))}
</div>
)}
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
fontWeight: 600
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
<div style={{ fontSize: 14 }}>{value}</div>
</div>
);
}

const inputStyle = {
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
boxSizing: "border-box"
};
