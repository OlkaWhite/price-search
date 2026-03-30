"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE_SIZE = 50;

export default function Page() {
const [query, setQuery] = useState("");
const [brand, setBrand] = useState("ALL");

const [brands, setBrands] = useState([]);
const [rows, setRows] = useState([]);

const [loading, setLoading] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);
const [errorText, setErrorText] = useState("");

const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(false);
const [showScrollTop, setShowScrollTop] = useState(false);

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
.select("role")
.eq("id", session.user.id)
.maybeSingle();

if (!mounted) return;

setIsAdmin(profile?.role === "admin");
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
.select("role")
.eq("id", session.user.id)
.maybeSingle();

if (!mounted) return;

setIsAdmin(profile?.role === "admin");
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

const uniq = Array.from(
new Set((data || []).map((x) => x.brand).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "ru"));

setBrands(uniq);
}

loadBrands();

return () => {
cancelled = true;
};
}, []);

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

const searchBrands = useMemo(() => {
return Array.from(new Set(rows.map((x) => x.brand).filter(Boolean))).sort((a, b) =>
a.localeCompare(b, "ru")
);
}, [rows]);

const visibleBrands = useMemo(() => {
return canSearch ? searchBrands : brands;
}, [canSearch, searchBrands, brands]);

function escapeForOr(value) {
return value
.replace(/\\/g, "\\\\")
.replace(/,/g, "\\,")
.replace(/\(/g, "\\(")
.replace(/\)/g, "\\)")
.replace(/"/g, '\\"');
}

function normalizeTextForSearch(value) {
return (value || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function resetSearchState() {
setLoading(false);
setLoadingMore(false);
setErrorText("");
setRows([]);
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
const tokens = normalizeTextForSearch(q)
.split(" ")
.map((part) => part.trim())
.filter(Boolean);

if (tokens.length === 1) {
const safeToken = escapeForOr(tokens[0]);
req = req.or(`pn.ilike.*${safeToken}*,name.ilike.*${safeToken}*`);
} else {
const andParts = tokens.map((token) => {
const safeToken = escapeForOr(token);
return `or(pn.ilike.*${safeToken}*,name.ilike.*${safeToken}*)`;
});

req = req.or(`and(${andParts.join(",")})`);
}
}

if (brand !== "ALL") {
req = req.eq("brand", brand);
}

req = req.order("price_byn", { ascending: true, nullsFirst: false });

return req;
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
setPage(0);
setHasMore(false);

const foundCount = await runSearch(true);

await logSearchAction({
queryText: query,
brandValue: brand,
resultsCount: foundCount,
});
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
</colgroup>

<thead>
<tr>
{[
"Бренд",
"P/N",
"Наименование",
"Кол-во",
"Цена с НДС (BYN)",
"Дата прайса",
...(isAdmin ? ["Прайс"] : []),
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
</tr>
);
})}

{rows.length === 0 && (
<tr>
<td
colSpan={6 + (isAdmin ? 1 : 0)}
style={{ padding: "14px 8px", color: "#666" }}
>
{canSearch
? loading
? "Идёт поиск..."
: "Видимо нет такого товара, попробуй ввести наименование иначе"
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

{showScrollTop && (
<button
onClick={scrollToTop}
style={{
position: "fixed",
right: 24,
bottom: 24,
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
</div>
);
}
