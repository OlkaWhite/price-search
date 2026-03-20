"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PAGE_SIZE = 100;

export default function Page() {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("ALL");
  const [priceSort, setPriceSort] = useState("default");

  const [brands, setBrands] = useState([]);
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  const visibleBrands = useMemo(() => {
    if (!canSearch) return brands;

    const uniq = Array.from(
      new Set((rows || []).map((x) => x.brand).filter(Boolean))
    ).sort();

    return uniq;
  }, [brands, rows, canSearch]);

  function buildQuery() {
    const q = query.trim();
    const pattern = `%${q}%`;

    let req = supabase
      .from("offers_view")
      .select("brand,pn,name,qty,price_byn,price_rub,supplier,pricelist_name");

    if (q) {
      req = req.or(`pn.ilike.${pattern},name.ilike.${pattern}`);
    }

    if (brand !== "ALL") {
      req = req.eq("brand", brand);
    }

    if (priceSort === "asc") {
      req = req.order("price_byn", { ascending: true, nullsFirst: false });
    } else if (priceSort === "desc") {
      req = req.order("price_byn", { ascending: false, nullsFirst: false });
    } else {
      req = req
        .order("brand", { ascending: true })
        .order("pn", { ascending: true })
        .order("price_byn", { ascending: true, nullsFirst: false });
    }

    return req;
  }

  async function runSearch(reset = true) {
    const nextPage = reset ? 0 : page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (reset) {
      setLoading(true);
      setErrorText("");
    } else {
      setLoadingMore(true);
      setErrorText("");
    }

    let req = buildQuery().range(from, to);

    const { data, error } = await req;

    if (error) {
      setErrorText(error.message);
      if (reset) {
        setRows([]);
        setHasMore(false);
      }
    } else {
      const incoming = data || [];

      if (reset) {
        setRows(incoming);
      } else {
        setRows((prev) => [...prev, ...incoming]);
      }

      setPage(nextPage);
      setHasMore(incoming.length === PAGE_SIZE);
    }

    if (reset) {
      setLoading(false);
    } else {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!canSearch) {
      setRows([]);
      setPage(0);
      setHasMore(false);
      return;
    }

    const t = setTimeout(() => runSearch(true), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, brand, priceSort]);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 700);
    }

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  return (
    <div
      style={{
        width: "98vw",
        maxWidth: 2240,
        margin: "0 auto",
        padding: "20px 16px"
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
          {visibleBrands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={priceSort}
          onChange={(e) => setPriceSort(e.target.value)}
          style={{
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 10,
            fontSize: 14
          }}
        >
          <option value="default">Сортировка цены</option>
          <option value="asc">Цена: по возрастанию</option>
          <option value="desc">Цена: по убыванию</option>
        </select>

        <button
          onClick={() => runSearch(true)}
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
                    ? (loading ? "Идёт поиск..." : "Ничего не найдено.")
                    : "Начни вводить запрос (минимум 2 символа) или выбери бренд."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <button
            onClick={() => runSearch(false)}
            disabled={loadingMore}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid #111",
              background: loadingMore ? "#ddd" : "#fff",
              color: "#111",
              cursor: loadingMore ? "default" : "pointer",
              fontSize: 14
            }}
          >
            {loadingMore ? "Загружаю..." : "Показать ещё"}
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
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)"
          }}
        >
          В начало списка
        </button>
      )}
    </div>
  );
}
