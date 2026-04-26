"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminUploadsPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [priceType, setPriceType] = useState("rub");
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  const [previewStats, setPreviewStats] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewReady, setPreviewReady] = useState(false);

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
  }, []);

  const suppliersMap = useMemo(() => {
    return Object.fromEntries(suppliers.map((item) => [String(item.id), item]));
  }, [suppliers]);

  function handleSupplierChange(value) {
    setSupplierId(value);
    const supplier = suppliersMap[value];
    if (supplier?.price_type) {
      setPriceType(supplier.price_type);
    }

    setPreviewStats(null);
    setPreviewRows([]);
    setPreviewReady(false);
    setMessage("");
    setErrorText("");
  }

  async function handlePreview() {
    if (!supplierId) {
      setErrorText("Выбери поставщика.");
      return;
    }

    if (!file) {
      setErrorText("Выбери CSV-файл.");
      return;
    }

    setPreviewLoading(true);
    setErrorText("");
    setMessage("");
    setPreviewReady(false);
    setPreviewStats(null);
    setPreviewRows([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", supplierId);
      formData.append("priceType", priceType);

      const res = await fetch("/api/admin/uploads/preview", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось проверить файл.");
      }

      setPreviewStats(data.stats || null);
      setPreviewRows(data.preview || []);
      setPreviewReady(true);
      setMessage("Файл проверен. Можно загружать прайс.");
    } catch (err) {
      console.error("Preview error:", err);
      setErrorText(err?.message || "Ошибка проверки файла.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!supplierId) {
      setErrorText("Выбери поставщика.");
      return;
    }

    if (!previewReady) {
      setErrorText("Сначала проверь файл.");
      return;
    }

    setCommitLoading(true);
    setErrorText("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/uploads/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          supplierId,
          fileName,
          priceType
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось загрузить прайс.");
      }

      setMessage(
        `Прайс успешно загружен. Вставлено: ${data.stats.rowsInserted}, пропущено: ${data.stats.rowsSkipped}.`
      );

      setFile(null);
      setFileName("");
      setPreviewStats(null);
      setPreviewRows([]);
      setPreviewReady(false);

      const input = document.getElementById("csv-upload-input");
      if (input) {
        input.value = "";
      }

      await loadPageData();
    } catch (err) {
      console.error("Commit error:", err);
      setErrorText(err?.message || "Ошибка загрузки прайса.");
    } finally {
      setCommitLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Загрузка прайсов</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          Загрузка CSV во временную таблицу, проверка и перенос в offers
        </p>
      </div>

      {message && (
        <div style={successBoxStyle}>
          {message}
        </div>
      )}

      {errorText && (
        <div style={errorBoxStyle}>
          {errorText}
        </div>
      )}

      {loading ? (
        <div>Загружаю страницу...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.95fr 1.05fr",
            gap: 20
          }}
        >
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Новая загрузка</h2>

            <div style={{ display: "grid", gap: 14 }}>
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

              <Field label="CSV-файл">
                <input
                  id="csv-upload-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const nextFile = e.target.files?.[0] || null;
                    setFile(nextFile);
                    setFileName(nextFile?.name || "");
                    setPreviewStats(null);
                    setPreviewRows([]);
                    setPreviewReady(false);
                    setMessage("");
                    setErrorText("");
                  }}
                  style={inputStyle}
                />
              </Field>

              {fileName && (
                <div style={{ fontSize: 13, color: "#555" }}>
                  Выбран файл: <b>{fileName}</b>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading || commitLoading}
                  style={{
                    ...buttonPrimaryStyle,
                    opacity: previewLoading || commitLoading ? 0.7 : 1
                  }}
                >
                  {previewLoading ? "Проверяю..." : "Проверить файл"}
                </button>

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!previewReady || previewLoading || commitLoading}
                  style={{
                    ...buttonDarkStyle,
                    opacity: !previewReady || previewLoading || commitLoading ? 0.6 : 1
                  }}
                >
                  {commitLoading ? "Загружаю..." : "Загрузить прайс"}
                </button>
              </div>
            </div>

            <div style={infoBoxStyle}>
              Процесс работы:
              <br />
              1. Выбираешь поставщика
              <br />
              2. Прикрепляешь CSV
              <br />
              3. Нажимаешь <b>Проверить файл</b>
              <br />
              4. Смотришь превью и статистику
              <br />
              5. Нажимаешь <b>Загрузить прайс</b>
            </div>

            {previewStats && (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>Статистика проверки</h3>

                <div style={statsGridStyle}>
                  <StatCard label="Всего строк" value={previewStats.rowsTotal} />
                  <StatCard label="Без P/N" value={previewStats.rowsWithoutPn} />
                  <StatCard label="Пустой brand" value={previewStats.rowsEmptyBrand} />
                  <StatCard label="Пустой name" value={previewStats.rowsEmptyName} />
                  <StatCard label="Готово к загрузке" value={previewStats.rowsReady} />
                </div>
              </div>
            )}

            {previewRows.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>Превью файла</h3>

                <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13
                    }}
                  >
                    <thead>
                      <tr>
                        {["brand", "pn", "name", "qty", "price_rub", "price_usd"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
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
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={tdStyle}>{row.brand || "—"}</td>
                          <td style={tdStyle}>{row.pn || "—"}</td>
                          <td style={tdStyle}>{row.name || "—"}</td>
                          <td style={tdStyle}>{row.qty || "—"}</td>
                          <td style={tdStyle}>{row.price_rub || "—"}</td>
                          <td style={tdStyle}>{row.price_usd || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
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
                      const supplier = suppliers.find((item) => item.id === log.supplier_id);

                      return (
                        <tr key={log.id}>
                          <td style={tdStyle}>
                            {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                          </td>
                          <td style={tdStyle}>
                            {supplier
                              ? `#${supplier.id} — ${supplier.supplier || "—"} / ${supplier.name || "—"}`
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

function StatCard({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        background: "#fafafa"
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value ?? 0}</div>
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

  const item = map[status] || {
    label: status || "—",
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

const cardStyle = {
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  background: "#fff",
  padding: 20,
  alignSelf: "start"
};

const infoBoxStyle = {
  marginTop: 18,
  padding: 12,
  borderRadius: 12,
  background: "#fafafa",
  border: "1px solid #eee",
  fontSize: 13,
  color: "#555",
  lineHeight: 1.5
};

const successBoxStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #cce5cc",
  background: "#f3fff3",
  color: "#2e6b2e"
};

const errorBoxStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #f1b5b5",
  background: "#fff5f5",
  color: "#9b1c1c"
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10
};

const buttonPrimaryStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14
};

const buttonDarkStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14
};