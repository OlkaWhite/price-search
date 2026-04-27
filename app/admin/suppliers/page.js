"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");

  async function loadSuppliers() {
    setLoading(true);
    setErrorText("");
    setMessage("");

    const { data, error } = await supabase
      .from("pricelists")
      .select(`
        id,
        supplier,
        name,
        price_type,
        is_active,
        use_global_rates,
        fx_rate,
        usd_to_rub_rate,
        markup_pct,
        rub_discount_pct,
        usd_discount_pct,
        last_upload_at
      `)
      .order("id", { ascending: true });

    if (error) {
      setErrorText(error.message);
      setSuppliers([]);
    } else {
      setSuppliers(data || []);
      if (selectedSupplier) {
        const fresh = (data || []).find((x) => x.id === selectedSupplier.id);
        setSelectedSupplier(fresh || null);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!selectedSupplier) return;

    setSaving(true);
    setErrorText("");
    setMessage("");

    const payload = {
      supplier: selectedSupplier.supplier || null,
      name: selectedSupplier.name || null,
      price_type: selectedSupplier.price_type || "rub",
      is_active: !!selectedSupplier.is_active,
      use_global_rates: !!selectedSupplier.use_global_rates,
      fx_rate:
        selectedSupplier.fx_rate === "" || selectedSupplier.fx_rate === null
          ? null
          : Number(selectedSupplier.fx_rate),
      usd_to_rub_rate:
        selectedSupplier.usd_to_rub_rate === "" ||
        selectedSupplier.usd_to_rub_rate === null
          ? null
          : Number(selectedSupplier.usd_to_rub_rate),
      markup_pct:
        selectedSupplier.markup_pct === "" || selectedSupplier.markup_pct === null
          ? null
          : Number(selectedSupplier.markup_pct),
      rub_discount_pct:
        selectedSupplier.rub_discount_pct === "" ||
        selectedSupplier.rub_discount_pct === null
          ? null
          : Number(selectedSupplier.rub_discount_pct),
      usd_discount_pct:
        selectedSupplier.usd_discount_pct === "" ||
        selectedSupplier.usd_discount_pct === null
          ? null
          : Number(selectedSupplier.usd_discount_pct)
    };

    const { data, error } = await supabase
      .from("pricelists")
      .update(payload)
      .eq("id", selectedSupplier.id)
      .select(`
        id,
        supplier,
        name,
        price_type,
        is_active,
        use_global_rates,
        fx_rate,
        usd_to_rub_rate,
        markup_pct,
        rub_discount_pct,
        usd_discount_pct,
        last_upload_at
      `)
      .single();

    if (error) {
      console.error("Save supplier error:", error);
      setErrorText(error.message);
    } else {
      setMessage(`Поставщик #${selectedSupplier.id} сохранён.`);
      setSelectedSupplier(data);

      setSuppliers((prev) =>
        prev.map((item) => (item.id === data.id ? data : item))
      );
    }

    setSaving(false);
  }

  function updateField(field, value) {
    setSelectedSupplier((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function formatDateTime(value) {
    if (!value) return "—";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString();
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Поставщики</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          Управление поставщиками, типами прайсов и параметрами расчёта
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedSupplier ? "1.2fr 0.8fr" : "1fr",
          gap: 20
        }}
      >
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            background: "#fff",
            overflow: "hidden"
          }}
        >
          {loading ? (
            <div style={{ padding: 20 }}>Загружаю поставщиков...</div>
          ) : suppliers.length === 0 ? (
            <div style={{ padding: 20, color: "#666" }}>Поставщиков пока нет.</div>
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
                      "Поставщик",
                      "Прайс",
                      "Тип",
                      "Активен",
                      "Глоб. курсы",
                      "Последняя загрузка",
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
                  {suppliers.map((item) => {
                    const active = selectedSupplier?.id === item.id;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: active ? "#f7f7f7" : "#fff"
                        }}
                      >
                        <td style={tdStyle}>{item.id}</td>
                        <td style={tdStyle}>{item.supplier || "—"}</td>
                        <td style={tdStyle}>{item.name || "—"}</td>
                        <td style={tdStyle}>{item.price_type || "rub"}</td>
                        <td style={tdStyle}>{item.is_active ? "Да" : "Нет"}</td>
                        <td style={tdStyle}>{item.use_global_rates ? "Да" : "Нет"}</td>
                        <td style={tdStyle}>{formatDateTime(item.last_upload_at)}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => setSelectedSupplier(item)}
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

        {selectedSupplier && (
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              background: "#fff",
              padding: 20,
              alignSelf: "start"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 16
              }}
            >
              <h2 style={{ margin: 0 }}>Поставщик #{selectedSupplier.id}</h2>

              <button
                onClick={() => setSelectedSupplier(null)}
                style={smallGhostButtonStyle}
              >
                Закрыть
              </button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <Field label="Поставщик">
                <input
                  value={selectedSupplier.supplier || ""}
                  onChange={(e) => updateField("supplier", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Название прайса">
                <input
                  value={selectedSupplier.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Тип прайса">
                <select
                  value={selectedSupplier.price_type || "rub"}
                  onChange={(e) => updateField("price_type", e.target.value)}
                  style={inputStyle}
                >
                  <option value="rub">rub</option>
                  <option value="usd">usd</option>
                </select>
              </Field>

              <Field label="Активен">
                <input
                  type="checkbox"
                  checked={!!selectedSupplier.is_active}
                  onChange={(e) => updateField("is_active", e.target.checked)}
                />
              </Field>

              <Field label="Использовать глобальные курсы">
                <input
                  type="checkbox"
                  checked={!!selectedSupplier.use_global_rates}
                  onChange={(e) => updateField("use_global_rates", e.target.checked)}
                />
              </Field>

              <Field label="RUB → BYN (локальный fx_rate)">
                <input
                  value={selectedSupplier.fx_rate ?? ""}
                  onChange={(e) => updateField("fx_rate", e.target.value)}
                  placeholder="Например: 0.0363"
                  style={inputStyle}
                />
              </Field>

              <Field label="USD → RUB (локальный)">
                <input
                  value={selectedSupplier.usd_to_rub_rate ?? ""}
                  onChange={(e) => updateField("usd_to_rub_rate", e.target.value)}
                  placeholder="Например: 92.5"
                  style={inputStyle}
                />
              </Field>

              <Field label="Наценка (markup_pct)">
                <input
                  value={selectedSupplier.markup_pct ?? ""}
                  onChange={(e) => updateField("markup_pct", e.target.value)}
                  placeholder="Например: 0.22"
                  style={inputStyle}
                />
              </Field>

              <Field label="Скидка RUB (rub_discount_pct)">
                <input
                  value={selectedSupplier.rub_discount_pct ?? ""}
                  onChange={(e) => updateField("rub_discount_pct", e.target.value)}
                  placeholder="Например: 0.05"
                  style={inputStyle}
                />
              </Field>

              <Field label="Скидка USD (usd_discount_pct)">
                <input
                  value={selectedSupplier.usd_discount_pct ?? ""}
                  onChange={(e) => updateField("usd_discount_pct", e.target.value)}
                  placeholder="Например: 0.05"
                  style={inputStyle}
                />
              </Field>

              <Field label="Последняя загрузка">
                <div style={{ fontSize: 14, color: "#444" }}>
                  {formatDateTime(selectedSupplier.last_upload_at)}
                </div>
              </Field>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={handleSave}
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
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </div>
        )}
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