"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE_SIZE = 100;
const CART_STORAGE_KEY = "b2bpart_cart_v1";
const FORM_STORAGE_KEY = "b2bpart_order_form_v1";

export default function Page() {
const [query, setQuery] = useState("");
const [brand, setBrand] = useState("ALL");

const [brands, setBrands] = useState([]);
const [searchBrands, setSearchBrands] = useState([]);
const [rows, setRows] = useState([]);

const [loading, setLoading] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);
const [loadingBrands, setLoadingBrands] = useState(false);
const [errorText, setErrorText] = useState("");

const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(false);
const [showScrollTop, setShowScrollTop] = useState(false);

const [cart, setCart] = useState([]);
const [orderOpen, setOrderOpen] = useState(false);
const [customerName, setCustomerName] = useState("");
const [customerContact, setCustomerContact] = useState("");
const [customerComment, setCustomerComment] = useState("");

const [sessionUser, setSessionUser] = useState(null);
const [isAdmin, setIsAdmin] = useState(false);

const lastLoggedSearchRef = useRef("");

useEffect(() => {
let mounted = true;

async function loadUserProfile() {
const {
data: { session },
} = await supabase.auth.getSession();

if (!mounted) return;

if (!session?.user) {
setSessionUser(null);
setIsAdmin(false);
return;
}

setSessionUser(session.user);

const { data: profile } = await supabase
.from("profiles")
.select("contact_name, phone, telegram, email, role")
.eq("id", session.user.id)
.maybeSingle();

if (!mounted) return;

setIsAdmin(profile?.role === "admin");

if (profile) {
if (profile.contact_name) setCustomerName(profile.contact_name);

if (profile.phone) {
setCustomerContact(profile.phone);
} else if (profile.telegram) {
setCustomerContact(profile.telegram);
} else if (profile.email) {
setCustomerContact(profile.email);
} else if (session.user.email) {
setCustomerContact(session.user.email);
}
} else if (session.user.email) {
setCustomerContact(session.user.email);
}
}

loadUserProfile();

const {
data: { subscription },
} = supabase.auth.onAuthStateChange(async (_event, session) => {
if (!mounted) return;

if (!session?.user) {
setSessionUser(null);
setIsAdmin(false);
return;
}

setSessionUser(session.user);

const { data: profile } = await supabase
.from("profiles")
.select("contact_name, phone, telegram, email, role")
.eq("id", session.user.id)
.maybeSingle();

if (!mounted) return;

setIsAdmin(profile?.role === "admin");

if (profile) {
if (profile.contact_name) setCustomerName(profile.contact_name);

if (profile.phone) {
setCustomerContact(profile.phone);
} else if (profile.telegram) {
setCustomerContact(profile.telegram);
} else if (profile.email) {
setCustomerContact(profile.email);
} else if (session.user.email) {
setCustomerContact(session.user.email);
}
} else if (session.user.email) {
setCustomerContact(session.user.email);
}
});

return () => {
mounted = false;
subscription.unsubscribe();
};
}, []);

useEffect(() => {
let cancelled = false;

async function loadBrands() {
setErrorText("");

const { data, error } = await supabase.from("brands_view").select("brand");

if (cancelled) return;

if (error) {
setErrorText(error.message);
return;
}

const uniq = (data || []).map((x) => x.brand).filter(Boolean);
setBrands(uniq);
}

loadBrands();

return () => {
cancelled = true;
};
}, []);

useEffect(() => {
try {
const savedCart = localStorage.getItem(CART_STORAGE_KEY);
const savedForm = localStorage.getItem(FORM_STORAGE_KEY);

if (savedCart) {
setCart(JSON.parse(savedCart));
}

if (savedForm) {
const parsed = JSON.parse(savedForm);
setCustomerName(parsed.customerName || "");
setCustomerContact(parsed.customerContact || "");
setCustomerComment(parsed.customerComment || "");
}
} catch (e) {
console.error("Failed to restore local state", e);
}
}, []);

useEffect(() => {
try {
localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
} catch (e) {
console.error("Failed to save cart", e);
}
}, [cart]);

useEffect(() => {
try {
localStorage.setItem(
FORM_STORAGE_KEY,
JSON.stringify({
customerName,
customerContact,
customerComment,
})
);
} catch (e) {
console.error("Failed to save order form", e);
}
}, [customerName, customerContact, customerComment]);

useEffect(() => {
function handleScroll() {
setShowScrollTop(window.scrollY > 700);
}

window.addEventListener("scroll", handleScroll);
handleScroll();

return () => window.removeEventListener("scroll", handleScroll);
}, []);

const canSearch = useMemo(
() => query.trim().length >= 2 || brand !== "ALL",
[query, brand]
);

const visibleBrands = useMemo(() => {
return canSearch ? searchBrands : brands;
}, [canSearch, searchBrands, brands]);

const cartCount = useMemo(
() => cart.reduce((sum, item) => sum + item.orderQty, 0),
[cart]
);

function escapeForOr(value) {
return value
.replace(/\\/g, "\\\\")
.replace(/,/g, "\\,")
.replace(/\(/g, "\\(")
.replace(/\)/g, "\\)")
.replace(/"/g, '\\"');
}

function resetSearchState() {
setLoading(false);
setLoadingMore(false);
setLoadingBrands(false);
setErrorText("");
setRows([]);
setSearchBrands([]);
setPage(0);
setHasMore(false);
}

function formatUpdateDate(value) {
if (!value) return "—";

const d = new Date(value);
if (Number.isNaN(d.getTime())) return "—";

const day = String(d.getDate()).padStart(2, "0");
const month = String(d.getMonth() + 1).padStart(2, "0");

return `${day}.${month}`;
}

async function logSearchAction({ queryText, brandValue, resultsCount }) {
const normalizedQuery = (queryText || "").trim().toLowerCase();
const normalizedBrand =
brandValue === "ALL" ? "" : (brandValue || "").trim().toLowerCase();
const signature = `${normalizedQuery}__${normalizedBrand}__${resultsCount}`;

if (!normalizedQuery && !normalizedBrand) return;
if (lastLoggedSearchRef.current === signature) return;

lastLoggedSearchRef.current = signature;

try {
const {
data: { session },
} = await supabase.auth.getSession();

await supabase.from("search_logs").insert({
user_id: session?.user?.id || null,
email: session?.user?.email || null,
query: (queryText || "").trim() || `[brand:${brandValue}]`,
normalized_query: normalizedQuery || `[brand:${normalizedBrand}]`,
results_count: Number(resultsCount) || 0,
});
} catch (e) {
console.error("Failed to write search log", e);
}
}

function buildRowsQuery() {
const q = query.trim();

let req = supabase
.from("offers_view")
.select(
"id,brand,pn,name,qty,price_byn,price_rub,price_usd,supplier,pricelist_name,last_upload_at"
);

if (q) {
const safeQ = escapeForOr(q);
req = req.or(`pn.ilike.*${safeQ}*,name.ilike.*${safeQ}*`);
}

if (brand !== "ALL") {
req = req.eq("brand", brand);
}

req = req.order("price_byn", { ascending: true, nullsFirst: false });

return req;
}

async function loadSearchBrands() {
if (!canSearch) {
setSearchBrands([]);
setLoadingBrands(false);
return;
}

setLoadingBrands(true);

try {
const q = query.trim() || null;

const { data, error } = await supabase.rpc("search_distinct_brands", {
search_text: q,
});

if (error) {
console.error("Brands load error:", error);
setSearchBrands([]);
} else {
const uniq = (data || []).map((x) => x.brand).filter(Boolean);
setSearchBrands(uniq);
}
} catch (e) {
console.error("Brands load failed:", e);
setSearchBrands([]);
} finally {
setLoadingBrands(false);
}
}

async function runSearch(reset = true) {
const nextPage = reset ? 0 : page + 1;
const from = nextPage * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

if (reset) {
setLoading(true);
} else {
setLoadingMore(true);
}

setErrorText("");

try {
const req = buildRowsQuery().range(from, to);
const { data, error } = await req;

if (error) {
throw error;
}

const incoming = data || [];

if (reset) {
setRows(incoming);
} else {
setRows((prev) => [...prev, ...incoming]);
}

setPage(nextPage);
setHasMore(incoming.length === PAGE_SIZE);

return incoming.length;
} catch (err) {
console.error("runSearch error:", err);
setErrorText(err?.message || "Ошибка поиска.");

if (reset) {
setRows([]);
setHasMore(false);
setPage(0);
}

return 0;
} finally {
if (reset) {
setLoading(false);
} else {
setLoadingMore(false);
}
}
}

async function handleSearchClick() {
if (!canSearch || loading || loadingMore) return;

setErrorText("");
setRows([]);
setSearchBrands([]);
setPage(0);
setHasMore(false);

const foundCount = await runSearch(true);

await logSearchAction({
queryText: query,
brandValue: brand,
resultsCount: foundCount,
});

if (foundCount > 0) {
loadSearchBrands();
} else {
setSearchBrands([]);
setLoadingBrands(false);
}
}

useEffect(() => {
if (!canSearch) return;
if (rows.length === 0) return;
if (loading || loadingMore) return;

const t = setTimeout(() => {
handleSearchClick();
}, 0);

return () => clearTimeout(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [brand]);

function scrollToTop() {
window.scrollTo({
top: 0,
behavior: "smooth",
});
}

function getRowKey(r) {
return `${r.brand || ""}__${r.pn || ""}__${r.name || ""}`;
}

function getDisplayPrice(r) {
if (typeof r.price_byn === "number") {
return `${r.price_byn.toLocaleString("ru-RU", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
})} `;
}

if (r.price_rub && String(r.price_rub).trim() !== "") {
return String(r.price_rub);
}

if (r.price_usd && String(r.price_usd).trim() !== "") {
return String(r.price_usd);
}

return "";
}

function isInCart(r) {
const key = getRowKey(r);
return cart.some((item) => item.key === key);
}

function addToCart(r) {
const key = getRowKey(r);

setCart((prev) => {
const existing = prev.find((item) => item.key === key);

if (existing) {
return prev.map((item) =>
item.key === key ? { ...item, orderQty: item.orderQty + 1 } : item
);
}

return [
...prev,
{
key,
brand: r.brand,
pn: r.pn,
name: r.name,
stockQty: r.qty ?? "",
price_byn: r.price_byn ?? null,
displayPrice: getDisplayPrice(r),
supplier: r.supplier || "",
pricelist_name: r.pricelist_name || "",
orderQty: 1,
},
];
});

setOrderOpen(true);
}

function removeFromCart(key) {
setCart((prev) => prev.filter((item) => item.key !== key));
}

function changeCartQty(key, direction) {
setCart((prev) =>
prev
.map((item) => {
if (item.key !== key) return item;
const nextQty =
direction === "inc" ? item.orderQty + 1 : item.orderQty - 1;
return { ...item, orderQty: nextQty };
})
.filter((item) => item.orderQty > 0)
);
}

function clearCart() {
setCart([]);
}

async function handleSubmitOrder() {
if (cart.length === 0) {
alert("Добавь хотя бы один товар в заявку.");
return;
}

if (!customerName.trim() || !customerContact.trim()) {
alert("Заполни имя и контакт в личном кабинете!");
return;
}

const {
data: { session },
} = await supabase.auth.getSession();

if (!session?.user) {
alert("Чтобы сохранить заявку в личный кабинет, сначала войди в аккаунт.");
window.location.href = "/login";
return;
}

try {
const { data: orderData, error: orderError } = await supabase
.from("orders")
.insert({
user_id: session.user.id,
customer_name: customerName.trim(),
customer_contact: customerContact.trim(),
customer_comment: customerComment.trim(),
status: "new",
})
.select("id")
.single();

if (orderError) {
alert("Ошибка при создании заявки: " + orderError.message);
return;
}

const orderId = orderData.id;

const itemsPayload = cart.map((item) => ({
order_id: orderId,
brand: item.brand,
pn: item.pn,
name: item.name,
order_qty: item.orderQty,
stock_qty: item.stockQty,
display_price: item.displayPrice,
price_byn: typeof item.price_byn === "number" ? item.price_byn : null,
}));

const { error: itemsError } = await supabase
.from("order_items")
.insert(itemsPayload);

if (itemsError) {
alert(
"Заявка создана, но товары не сохранились: " + itemsError.message
);
return;
}

alert(`Заявка #${orderId} сохранена в личный кабинет.`);

setCart([]);
setCustomerComment("");
setOrderOpen(false);
} catch (e) {
console.error(e);
alert("Что-то пошло не так при сохранении заявки.");
}
}

return (
<div
style={{
width: "98vw",
maxWidth: 2240,
margin: "0 auto",
padding: "20px 16px 120px",
}}
>
<p style={{ marginTop: 8, color: "#666", fontSize: 15 }}>
Вводи минимум 2 символа. Ищет по <b>P/N</b> и по <b>наименованию</b>.
Фильтр по бренду слева.
</p>

<div
style={{
display: "flex",
gap: 12,
alignItems: "center",
marginTop: 16,
marginBottom: 18,
flexWrap: "wrap",
}}
>
<input
value={query}
onChange={(e) => {
setQuery(e.target.value);
resetSearchState();
setBrand("ALL");
}}
onKeyDown={(e) => {
if (e.key === "Enter") {
e.preventDefault();
handleSearchClick();
}
}}
placeholder="Поиск: парт-номер или текст..."
style={{
width: 420,
maxWidth: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
}}
/>

<select
value={brand}
onChange={(e) => {
setBrand(e.target.value);
}}
style={{
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
}}
>
<option value="ALL">Все бренды</option>
{visibleBrands.map((b) => (
<option key={b} value={b}>
{b}
</option>
))}
</select>

<button
onClick={handleSearchClick}
disabled={!canSearch || loading}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: loading ? "#ddd" : "#111",
color: loading ? "#333" : "#fff",
cursor: loading ? "default" : "pointer",
fontSize: 14,
}}
>
{loading ? "Ищу..." : "Поиск"}
</button>

<div style={{ color: "#666", fontSize: 13 }}>
{rows.length > 0 ? `Загружено: ${rows.length}` : " "}
</div>

{loadingBrands && (
<div style={{ color: "#666", fontSize: 13 }}>Обновляю бренды...</div>
)}
</div>

{errorText && (
<div
style={{
marginTop: 14,
padding: 12,
border: "1px solid #f00",
borderRadius: 10,
color: "#900",
}}
>
Ошибка: {errorText}
</div>
)}

<div style={{ marginTop: 16 }}>
<table
style={{
width: "100%",
borderCollapse: "collapse",
fontSize: 13,
tableLayout: "fixed",
}}
>
<colgroup>
<col style={{ width: "90px" }} />
<col style={{ width: "150px" }} />
<col style={{ width: "auto" }} />
<col style={{ width: "80px" }} />
<col style={{ width: "120px" }} />
<col style={{ width: "90px" }} />
{isAdmin ? <col style={{ width: "180px" }} /> : null}
{sessionUser ? <col style={{ width: "130px" }} /> : null}
</colgroup>

<thead>
<tr>
{[
"Бренд",
"P/N",
"Наименование",
"Кол-во",
"Цена (BYN)",
"Обновлён",
...(isAdmin ? ["Прайс"] : []),
...(sessionUser ? ["Действие"] : []),
].map((h) => (
<th
key={h}
style={{
textAlign: "left",
padding: "10px 8px",
borderBottom: "2px solid #ddd",
whiteSpace: h === "Наименование" ? "normal" : "nowrap",
verticalAlign: "top",
}}
>
{h}
</th>
))}
</tr>
</thead>

<tbody>
{rows.map((r, idx) => {
const added = isInCart(r);

return (
<tr key={`${r.brand}-${r.pn}-${r.price_byn}-${idx}`}>
<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "nowrap",
verticalAlign: "top",
}}
>
{r.brand}
</td>

<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "normal",
overflowWrap: "anywhere",
wordBreak: "break-word",
verticalAlign: "top",
}}
>
{r.pn}
</td>

<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "normal",
overflowWrap: "anywhere",
wordBreak: "break-word",
lineHeight: 1.35,
verticalAlign: "top",
}}
>
{r.name}
</td>

<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "nowrap",
textAlign: "center",
verticalAlign: "top",
}}
>
{r.qty ?? ""}
</td>

<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "nowrap",
verticalAlign: "top",
}}
>
{getDisplayPrice(r)}
</td>

<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "nowrap",
verticalAlign: "top",
}}
>
{formatUpdateDate(r.last_upload_at)}
</td>

{isAdmin ? (
<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
whiteSpace: "normal",
verticalAlign: "top",
}}
>
{r.pricelist_name || "—"}
</td>
) : null}

{sessionUser ? (
<td
style={{
padding: "8px",
borderBottom: "1px solid #eee",
verticalAlign: "top",
}}
>
<button
onClick={() => addToCart(r)}
style={{
padding: "8px 10px",
borderRadius: 10,
border: added ? "1px solid #ccc" : "1px solid #111",
background: added ? "#f3f3f3" : "#111",
color: added ? "#111" : "#fff",
cursor: "pointer",
fontSize: 13,
width: "100%",
}}
>
{added ? "Добавлено" : "В заказ"}
</button>
</td>
) : null}
</tr>
);
})}

{rows.length === 0 && (
<tr>
<td
colSpan={6 + (isAdmin ? 1 : 0) + (sessionUser ? 1 : 0)}
style={{ padding: "14px 8px", color: "#666" }}
>
{canSearch
? loading
? "Идёт поиск..."
: "Ничего не найдено."
: "Начни вводить запрос (минимум 2 символа) или выбери бренд."}
</td>
</tr>
)}
</tbody>
</table>
</div>

{rows.length > 0 && hasMore && (
<div
style={{
display: "flex",
justifyContent: "center",
marginTop: 20,
}}
>
<button
onClick={() => runSearch(false)}
disabled={loadingMore}
style={{
padding: "12px 18px",
borderRadius: 10,
border: "1px solid #111",
background: loadingMore ? "#ddd" : "#111",
color: loadingMore ? "#333" : "#fff",
cursor: loadingMore ? "default" : "pointer",
fontSize: 14,
}}
>
{loadingMore ? "Загружаю..." : "Загрузить еще"}
</button>
</div>
)}

{sessionUser && cart.length > 0 && (
<button
onClick={() => setOrderOpen((v) => !v)}
style={{
position: "fixed",
right: 24,
bottom: showScrollTop ? 84 : 24,
zIndex: 1000,
padding: "12px 16px",
borderRadius: 999,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
fontSize: 14,
boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
}}
>
{orderOpen ? `Скрыть заявку (${cartCount})` : `Заявка (${cartCount})`}
</button>
)}

{showScrollTop && (
<button
onClick={scrollToTop}
style={{
position: "fixed",
right: 24,
bottom: sessionUser && cart.length > 0 ? (orderOpen ? 500 : 84) : 24,
zIndex: 1000,
padding: "12px 16px",
borderRadius: 999,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
fontSize: 14,
boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
}}
>
В начало списка
</button>
)}

{sessionUser && orderOpen && (
<div
style={{
position: "fixed",
right: 24,
bottom: 24,
width: 420,
maxWidth: "calc(100vw - 32px)",
maxHeight: "80vh",
overflow: "auto",
zIndex: 999,
background: "#fff",
border: "1px solid #ddd",
borderRadius: 16,
boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
padding: 16,
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 12,
marginBottom: 12,
}}
>
<h3 style={{ margin: 0, fontSize: 18 }}>Заявка</h3>

<button
onClick={clearCart}
style={{
border: "none",
background: "transparent",
color: "#777",
cursor: "pointer",
fontSize: 13,
}}
>
Очистить
</button>
</div>

<div style={{ display: "grid", gap: 10 }}>
{cart.map((item) => (
<div
key={item.key}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 10,
}}
>
<div style={{ fontWeight: 700, marginBottom: 4 }}>
{item.brand} {item.pn}
</div>

<div
style={{
fontSize: 13,
color: "#444",
marginBottom: 8,
lineHeight: 1.35,
}}
>
{item.name}
</div>

<div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
Цена: {item.displayPrice || "—"}
</div>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
}}
>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<button
onClick={() => changeCartQty(item.key, "dec")}
style={{
width: 28,
height: 28,
borderRadius: 8,
border: "1px solid #ccc",
background: "#fff",
cursor: "pointer",
}}
>
−
</button>

<div style={{ minWidth: 22, textAlign: "center", fontSize: 14 }}>
{item.orderQty}
</div>

<button
onClick={() => changeCartQty(item.key, "inc")}
style={{
width: 28,
height: 28,
borderRadius: 8,
border: "1px solid #ccc",
background: "#fff",
cursor: "pointer",
}}
>
+
</button>
</div>

<button
onClick={() => removeFromCart(item.key)}
style={{
border: "none",
background: "transparent",
color: "#a00",
cursor: "pointer",
fontSize: 13,
}}
>
Удалить
</button>
</div>
</div>
))}
</div>

<div style={{ marginTop: 16, display: "grid", gap: 10 }}>
<div
style={{
padding: "10px 12px",
border: "1px solid #e5e5e5",
borderRadius: 10,
background: "#fafafa",
fontSize: 14,
color: "#444",
}}
>
Заявка будет отправлена от аккаунта{" "}
<b>{customerName || sessionUser.email || "клиента"}</b>
{customerContact ? <> · {customerContact}</> : null}
</div>

<textarea
value={customerComment}
onChange={(e) => setCustomerComment(e.target.value)}
placeholder="Комментарий к заказу"
rows={4}
style={{
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
resize: "vertical",
}}
/>

<button
onClick={handleSubmitOrder}
style={{
padding: "12px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
fontSize: 14,
}}
>
Отправить заявку
</button>
</div>
</div>
)}
</div>
);
}
