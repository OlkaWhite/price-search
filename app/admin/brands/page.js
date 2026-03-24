"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminBrandsPage() {
const [rows, setRows] = useState([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [errorText, setErrorText] = useState("");
const [message, setMessage] = useState("");

const [selectedRow, setSelectedRow] = useState(null);

const [newAlias, setNewAlias] = useState("");
const [newCanonical, setNewCanonical] = useState("");

async function loadRows() {
setLoading(true);
setErrorText("");
setMessage("");

try {
const { data, error } = await supabase
.from("brand_aliases")
.select("alias, canonical_brand")
.order("canonical_brand", { ascending: true })
.order("alias", { ascending: true });

if (error) throw error;

setRows(data || []);

if (selectedRow) {
const fresh = (data || []).find(
(x) => x.alias === selectedRow.alias
);
setSelectedRow(fresh || null);
}
} catch (err) {
console.error("Brands load error:", err);
setErrorText(err?.message || "Не удалось загрузить brand aliases.");
setRows([]);
} finally {
setLoading(false);
}
}

useEffect(() => {
loadRows();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const canonicalStats = useMemo(() => {
const map = new Map();

rows.forEach((row) => {
const key = row.canonical_brand || "—";
map.set(key, (map.get(key) || 0) + 1);
});

return Array.from(map.entries())
.map(([canonical, count]) => ({ canonical, count }))
.sort((a, b) => b.count - a.count)
.slice(0, 20);
}, [rows]);

async function handleCreate(e) {
e.preventDefault();

const alias = newAlias.trim().toLowerCase();
const canonical = newCanonical.trim();

if (!alias || !canonical) {
setErrorText("Заполни alias и canonical brand.");
return;
}

setSaving(true);
setErrorText("");
setMessage("");

try {
const { error } = await supabase
.from("brand_aliases")
.insert({
alias,
canonical_brand: canonical
});

if (error) throw error;

setMessage("Новый alias добавлен.");
setNewAlias("");
setNewCanonical("");
await loadRows();
} catch (err) {
console.error("Create alias error:", err);
setErrorText(err?.message || "Не удалось добавить alias.");
} finally {
setSaving(false);
}
}

async function handleSaveSelected() {
if (!selectedRow) return;

const alias = (selectedRow.alias || "").trim().toLowerCase();
const canonical = (selectedRow.canonical_brand || "").trim();

if (!alias || !canonical) {
setErrorText("Alias и canonical brand не должны быть пустыми.");
return;
}

setSaving(true);
setErrorText("");
setMessage("");

try {
const originalAlias = selectedRow.__originalAlias || selectedRow.alias;

const { error } = await supabase
.from("brand_aliases")
.update({
alias,
canonical_brand: canonical
})
.eq("alias", originalAlias);

if (error) throw error;

setMessage("Alias обновлён.");
setSelectedRow(null);
await loadRows();
} catch (err) {
console.error("Update alias error:", err);
setErrorText(err?.message || "Не удалось обновить alias.");
} finally {
setSaving(false);
}
}

async function handleDelete(alias) {
const ok = window.confirm(`Удалить alias "${alias}"?`);
if (!ok) return;

setSaving(true);
setErrorText("");
setMessage("");

try {
const { error } = await supabase
.from("brand_aliases")
.delete()
.eq("alias", alias);

if (error) throw error;

setMessage("Alias удалён.");
if (selectedRow?.alias === alias) {
setSelectedRow(null);
}
await loadRows();
} catch (err) {
console.error("Delete alias error:", err);
setErrorText(err?.message || "Не удалось удалить alias.");
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
<h1 style={{ margin: 0 }}>Бренды</h1>
<p style={{ marginTop: 8, color: "#666" }}>
Управление brand aliases и canonical брендами
</p>
</div>

<button
onClick={loadRows}
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
gridTemplateColumns: "1.1fr 0.9fr",
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
<h2 style={{ marginTop: 0 }}>Добавить alias</h2>

<form onSubmit={handleCreate} style={{ display: "grid", gap: 14 }}>
<Field label="Alias">
<input
value={newAlias}
onChange={(e) => setNewAlias(e.target.value)}
placeholder="Например: cactus"
style={inputStyle}
/>
</Field>

<Field label="Canonical brand">
<input
value={newCanonical}
onChange={(e) => setNewCanonical(e.target.value)}
placeholder="Например: CACTUS"
style={inputStyle}
/>
</Field>

<button
type="submit"
disabled={saving}
style={primaryButtonStyle}
>
{saving ? "Сохраняю..." : "Добавить"}
</button>
</form>
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
<h2 style={{ marginTop: 0 }}>Список aliases</h2>
</div>

{loading ? (
<div style={{ padding: 20 }}>Загружаю aliases...</div>
) : rows.length === 0 ? (
<div style={{ padding: 20, color: "#666" }}>Записей пока нет.</div>
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
{["Alias", "Canonical brand", ""].map((h) => (
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
{rows.map((row) => {
const active = selectedRow?.alias === row.alias;

return (
<tr
key={row.alias}
style={{
background: active ? "#f7f7f7" : "#fff"
}}
>
<td style={tdStyle}>{row.alias}</td>
<td style={tdStyle}>{row.canonical_brand}</td>
<td style={tdStyle}>
<div style={{ display: "flex", gap: 8 }}>
<button
onClick={() =>
setSelectedRow({
...row,
__originalAlias: row.alias
})
}
style={smallButtonStyle}
>
Открыть
</button>

<button
onClick={() => handleDelete(row.alias)}
style={dangerGhostButtonStyle}
>
Удалить
</button>
</div>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
</div>

<div style={{ display: "grid", gap: 20 }}>
<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20
}}
>
<h2 style={{ marginTop: 0 }}>Редактирование</h2>

{!selectedRow ? (
<div style={{ color: "#666" }}>Выбери alias из списка.</div>
) : (
<div style={{ display: "grid", gap: 14 }}>
<Field label="Alias">
<input
value={selectedRow.alias || ""}
onChange={(e) =>
setSelectedRow((prev) => ({
...prev,
alias: e.target.value
}))
}
style={inputStyle}
/>
</Field>

<Field label="Canonical brand">
<input
value={selectedRow.canonical_brand || ""}
onChange={(e) =>
setSelectedRow((prev) => ({
...prev,
canonical_brand: e.target.value
}))
}
style={inputStyle}
/>
</Field>

<div style={{ display: "flex", gap: 10 }}>
<button
onClick={handleSaveSelected}
disabled={saving}
style={primaryButtonStyle}
>
{saving ? "Сохраняю..." : "Сохранить"}
</button>

<button
onClick={() => setSelectedRow(null)}
style={secondaryButtonStyle}
>
Сбросить
</button>
</div>
</div>
)}
</div>

<div
style={{
border: "1px solid #e5e5e5",
borderRadius: 16,
background: "#fff",
padding: 20
}}
>
<h2 style={{ marginTop: 0 }}>Топ canonical брендов</h2>

{canonicalStats.length === 0 ? (
<div style={{ color: "#666" }}>Нет данных.</div>
) : (
<div style={{ display: "grid", gap: 10 }}>
{canonicalStats.map((item) => (
<div
key={item.canonical}
style={{
border: "1px solid #eee",
borderRadius: 12,
padding: 12
}}
>
<div style={{ fontWeight: 700 }}>{item.canonical}</div>
<div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
Alias-ов: {item.count}
</div>
</div>
))}
</div>
)}
</div>
</div>
</div>
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

const primaryButtonStyle = {
padding: "12px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
fontSize: 14
};

const secondaryButtonStyle = {
padding: "12px 14px",
borderRadius: 10,
border: "1px solid #ccc",
background: "#fff",
color: "#111",
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

const dangerGhostButtonStyle = {
padding: "8px 10px",
borderRadius: 10,
border: "1px solid #e5b4b4",
background: "#fff",
color: "#a22",
cursor: "pointer",
fontSize: 13
};
