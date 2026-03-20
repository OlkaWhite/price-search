"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Page() {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("ALL");
  const [brands, setBrands] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErrorText("");

      const { data, error } = await supabase
        .from("brands_view")
        .select("brand");

      if (cancelled) return;

      if (error) {
        setErrorText(error.message);
        return;
      }

      const uniq = (data || []).map((x) => x.brand).filter(Boolean);
        setBrands(uniq);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSearch = useMemo(
    () => query.trim().length >= 2 || brand !== "ALL",
    [query, brand]
  );

  async function runSearch() {
    setLoading(true);
    setErrorText("");

    const q = query.trim();
    const pattern = `%${q}%`;

    let req = supabase
      .from("offers_view")
      .select("brand,pn,name,qty,price_byn,price_rub,supplier,pricelist_name")
      .order("brand", { ascending: true })
      .order("pn", { ascending: true })
      .order("price_byn", { ascending: true });

    if (q) {
      req = req.or(`pn.ilike.${pattern},name.ilike.${pattern}`);
    }

    if (brand !== "ALL") {
      req = req.eq("brand", brand);
    }

    const { data, error } = await req.limit(200);

    if (error) {
      setErrorText(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!canSearch) {
      setRows([]);
      return;
    }

    const t = setTimeout(() => runSearch(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, brand]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 2500,
        margin: "0 auto",
        padding: "20px 24px"
      }}
    >
      <h1 style={{ margin: 0, fontSize: 28 }}>Поиск по прайсам</h1>

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
          flexWrap: "wrap"
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: парт-номер или текст…"
          style={{
            width: 420,
            maxWidth: "100%",
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 10,
            fontSize: 14
          }}
        />

        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          style={{
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 10,
            fontSize: 14
          }}
        >
          <option value="ALL">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <button
          onClick={runSearch}
          disabled={!canSearch || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#ddd" : "#111",
            color: loading ? "#333" : "#fff",
            cursor: loading ? "default" : "pointer",
            fontSize: 14
          }}
        >
          {loading ? "Ищу..." : "Поиск"}
        </button>

        <div style={{ color: "#666", fontSize: 13 }}>
          {rows.length > 0 ? `Найдено: ${rows.length} (показаны первые 200)` : " "}
        </div>
      </div>

      {errorText && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid #f00",
            borderRadius: 10,
            color: "#900"
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
            tableLayout: "fixed"
          }}
        >
          <colgroup>
            <col style={{ width: "90px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: "80px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "180px" }} />
          </colgroup>

          <thead>
            <tr>
              {["Бренд", "P/N", "Наименование", "Кол-во", "Цена (BYN)", "Поставщик/прайс"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "2px solid #ddd",
                    whiteSpace: h === "Наименование" ? "normal" : "nowrap",
                    verticalAlign: "top"
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.brand}-${r.pn}-${r.price_byn}-${idx}`}>
                <td
                  style={{
                    padding: "8px",
                    borderBottom: "1px solid #eee",
                    whiteSpace: "nowrap",
                    verticalAlign: "top"
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
                    verticalAlign: "top"
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
                    verticalAlign: "top"
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
                    verticalAlign: "top"
                  }}
                >
                  {r.qty ?? ""}
                </td>

                <td
                  style={{
                    padding: "8px",
                    borderBottom: "1px solid #eee",
                    whiteSpace: "nowrap",
                    verticalAlign: "top"
                  }}
                >
                  {typeof r.price_byn === "number"
                    ? r.price_byn.toFixed(2)
                    : (r.price_rub && String(r.price_rub).trim() !== ""
                        ? r.price_rub
                        : "")}
                </td>

                <td
                  style={{
                    padding: "8px",
                    borderBottom: "1px solid #eee",
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    verticalAlign: "top"
                  }}
                >
                  {r.supplier} / {r.pricelist_name}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "14px 8px", color: "#666" }}>
                  {canSearch
                    ? "Ничего не найдено."
                    : "Начни вводить запрос (минимум 2 символа) или выбери бренд."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
