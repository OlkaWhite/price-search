"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const STATUS_OPTIONS = ["new", "ok", "warning", "error"];

export default function AdminUploadsPage() {
const [suppliers, setSuppliers] = useState([]);
const [logs, setLogs] = useState([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [errorText, setErrorText] = useState("");
const [message, setMessage] = useState("");

const [supplierId, setSupplierId] = useState("");
const [fileName, setFileName] = useState("");
const [priceType, setPriceType] = useState("rub");
const [rowsTotal, setRowsTotal] = useState("");
const [rowsInserted, setRowsInserted] = useState("");
const [rowsSkipped, setRowsSkipped] = useState("");
const [status, setStatus] = useState("ok");
const [errorLogText, setErrorLogText] = useState("");

async function loadPageData() {
setLoading(true);
setErrorText("");
setMessage("");

try {
const [suppliersRes, logsRes] = await Promise.all([
supabase
.from("pricelists")
.select("id, supplier, name, price_type")
.order("id", { ascending: true }),

supabase
.from("price_upload_logs")
.select(`
id,
supplier_id,
uploaded_by,
file_name,
price_type,
rows_total,
rows_inserted,
rows_skipped,
status,
error_text,
created_at
`)
.order("created_at", { ascending: false })
.limit(200)
]);

if (suppliersRes.error) throw suppliersRes.error;
if (logsRes.error) throw logsRes.error;

const nextSuppliers = suppliersRes.data || [];
const nextLogs = logsRes.data || [];

setSuppliers(nextSuppliers);
setLogs(nextLogs);

if (!supplierId && nextSuppliers.length > 0) {
setSupplierId(String(nextSuppliers[0].id));
setPriceType(nextSuppliers[0].price_type || "rub");
}
} catch (err) {
console.error("Uploads page load error:", err);
setErrorText(err?.message || "Не удалось загрузить данные страницы.");
} finally {
setLoading(false);
}
}

useEffect(() => {
loadPageData();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const suppliersMap = useMemo(() => {
return Object.fromEntries(
suppliers.map((item) => [String(item.id), item])
);
}, [suppliers]);

function handleSupplierChange(value) {
setSupplierId(value);
const supplier = suppliersMap[value];
if (supplier?.price_type) {
setPriceType(supplier.price_type);
}
}

async function handleSaveLog(e) {
e.preventDefault();

if (!supplierId) {
setErrorText("Выбери поставщика.");
return;
}

setSaving(true);
setErrorText("");
setMessage("");

try {
const {
data: { user }
} = await supabase.auth.getUser();

const payload = {
supplier_id: Number(supplierId),
uploaded_by: user?.id || null,
file_name: fileName.trim() || null,
price_type: priceType || null,
rows_total: rowsTotal === "" ? 0 : Number(rowsTotal),
rows_inserted: rowsInserted === "" ? 0 : Number(rowsInserted),
rows_skipped: rowsSkipped === "" ? 0 : Number(rowsSkipped),
status,
error_text: errorLogText.trim() || null
};

const { error } = await supabase
.from("price_upload_logs")
.insert(payload);

if (error) {
throw error;
}

const { error: updatePricelistError } = await supabase
.from("pricelists")
.update({
last_upload_at: new Date().toISOString(),
price_type: priceType
})
.eq("id", Number(supplierId));

if (updatePricelistError) {
throw updatePricelistError;
}

setMessage("Лог загрузки сохранён.");

setFileName("");
setRowsTotal("");
setRowsInserted("");
setRowsSkipped("");
setStatus("ok");
setErrorLogText("");

await loadPageData();
} catch (err) {
console.error("Save upload log error:", err);
setErrorText(err?.message || "Не удалось сохранить лог загрузки.");
} finally {
setSaving(false);
}
}

return (
<div>
<div style={{ marginBottom: 20 }}>
<h1 style={{ margin: 0 }}>Загрузка прайсов</h1>
<p style={{ marginTop: 8, color: "#666" }}>
Фиксация загрузок прайсов и история импортов
</p>
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

{loading ? (
<div>Загружаю страницу...</div>
) : (
<div
style={{
display: "grid",
gridTemplateColumns: "0.9fr 1.1fr",
gap: 20
}}
>
<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20,
alignSelf: "start"
}}
>
<h2 style={{ marginTop: 0 }}>Новая загрузка</h2>

<form onSubmit={handleSaveLog} style={{ display: "grid", gap: 14 }}>
<Field label="Поставщик">
<select
value={supplierId}
onChange={(e) => handleSupplierChange(e.target.value)}
style={inputStyle}
>
{suppliers.map((item) => (
<option key={item.id} value={item.id}>
#{item.id} — {item.supplier || "—"} / {item.name || "—"}
</option>
))}
</select>
</Field>

<Field label="Имя файла">
<input
value={fileName}
onChange={(e) => setFileName(e.target.value)}
placeholder="Например: px_portal2.csv"
style={inputStyle}
/>
</Field>

<Field label="Тип прайса">
<select
value={priceType}
onChange={(e) => setPriceType(e.target.value)}
style={inputStyle}
>
<option value="rub">rub</option>
<option value="usd">usd</option>
</select>
</Field>

<Field label="Всего строк">
<input
value={rowsTotal}
onChange={(e) => setRowsTotal(e.target.value)}
placeholder="Например: 12500"
style={inputStyle}
/>
</Field>

<Field label="Вставлено строк">
<input
value={rowsInserted}
onChange={(e) => setRowsInserted(e.target.value)}
placeholder="Например: 12340"
style={inputStyle}
/>
</Field>

<Field label="Пропущено строк">
<input
value={rowsSkipped}
onChange={(e) => setRowsSkipped(e.target.value)}
placeholder="Например: 160"
style={inputStyle}
/>
</Field>

<Field label="Статус">
<select
value={status}
onChange={(e) => setStatus(e.target.value)}
style={inputStyle}
>
{STATUS_OPTIONS.map((item) => (
<option key={item} value={item}>
{item}
</option>
))}
</select>
</Field>

<Field label="Текст ошибки / комментарий">
<textarea
value={errorLogText}
onChange={(e) => setErrorLogText(e.target.value)}
rows={5}
placeholder="Например: 160 строк без P/N были пропущены"
style={{
...inputStyle,
resize: "vertical"
}}
/>
</Field>

<button
type="submit"
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
{saving ? "Сохраняю..." : "Сохранить лог загрузки"}
</button>
</form>

<div
style={{
marginTop: 18,
padding: 12,
borderRadius: 12,
background: "#fafafa",
border: "1px solid #eee",
fontSize: 13,
color: "#555",
lineHeight: 1.5
}}
>
Рабочий процесс сейчас такой:
<br />
1. Очистить <b>offers_import</b>
<br />
2. Загрузить CSV во временную таблицу
<br />
3. Выполнить SQL на перенос в <b>offers</b>
<br />
4. Зафиксировать результат здесь в журнале загрузок
</div>
</div>

<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
overflow: "hidden"
}}
>
<div style={{ padding: "18px 20px 0" }}>
<h2 style={{ marginTop: 0 }}>История загрузок</h2>
</div>

{logs.length === 0 ? (
<div style={{ padding: 20, color: "#666" }}>Логов пока нет.</div>
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
"Дата",
"Поставщик",
"Файл",
"Тип",
"Всего",
"Вставлено",
"Пропущено",
"Статус",
"Комментарий"
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
{logs.map((log) => {
const supplier = suppliers.find(
(item) => item.id === log.supplier_id
);

return (
<tr key={log.id}>
<td style={tdStyle}>
{log.created_at
? new Date(log.created_at).toLocaleString()
: "—"}
</td>
<td style={tdStyle}>
{supplier
? `#${supplier.id} — ${supplier.supplier || "—"}`
: log.supplier_id || "—"}
</td>
<td style={tdStyle}>{log.file_name || "—"}</td>
<td style={tdStyle}>{log.price_type || "—"}</td>
<td style={tdStyle}>{log.rows_total ?? 0}</td>
<td style={tdStyle}>{log.rows_inserted ?? 0}</td>
<td style={tdStyle}>{log.rows_skipped ?? 0}</td>
<td style={tdStyle}>
<StatusBadge status={log.status} />
</td>
<td style={tdStyle}>{log.error_text || "—"}</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
</div>
)}
</div>
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

function StatusBadge({ status }) {
const map = {
new: { label: "new", bg: "#eef6ff", color: "#1d4ed8" },
ok: { label: "ok", bg: "#ecfdf5", color: "#15803d" },
warning: { label: "warning", bg: "#fff7ed", color: "#c2410c" },
error: { label: "error", bg: "#fef2f2", color: "#b91c1c" }
};

const item = map[status] || { label: status || "—", bg: "#f3f4f6", color: "#374151" };

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

const inputStyle = {
width: "100%",
padding: "10px 12px",
border: "1px solid #ccc",
borderRadius: 10,
fontSize: 14,
boxSizing: "border-box"
};

const tdStyle = {
padding: "12px 10px",
borderBottom: "1px solid #eee",
verticalAlign: "top"
};
