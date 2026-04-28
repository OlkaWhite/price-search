"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE_SIZE = 50;

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
        setIsAdmin(false);
        return;
      }

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
        setIsAdmin(false);
        return;
      }

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
        console.error("brands_view load error:", error);
        setErrorText("");
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

  const visibleBrands = useMemo(() => {
    return canSearch ? searchBrands : brands;
  }, [canSearch, searchBrands, brands]);

  function escapeForOr(value) {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/"/g, '\\"');
  }

  function normalizeTextForSearch(value) {
    return (value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeSearch(value) {
    const normalized = normalizeTextForSearch(value);

    if (!normalized) return [];

    const rawTokens = normalized
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);

    const seen = new Set();
    const tokens = [];

    for (const token of rawTokens) {
      const isUseful = token.length >= 2 || /\d/.test(token);

      if (!isUseful) continue;
      if (seen.has(token)) continue;

      seen.add(token);
      tokens.push(token);
    }

    return tokens;
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
    const year = d.getFullYear();

    return `${day}.${month}.${year}`;
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

  function applyTextSearch(req) {
    const tokens = tokenizeSearch(query);

    if (tokens.length === 0) return req;

    if (tokens.length === 1) {
      const safeToken = escapeForOr(tokens[0]);
      return req.or(`pn.ilike.*${safeToken}*,name.ilike.*${safeToken}*`);
    }

    const andParts = tokens.map((token) => {
      const safeToken = escapeForOr(token);
      return `or(pn.ilike.*${safeToken}*,name.ilike.*${safeToken}*)`;
    });

    return req.or(`and(${andParts.join(",")})`);
  }

  function buildRowsQuery() {
    let req = supabase
      .from("offers_view")
      .select(
        "id,brand,pn,name,qty,price_byn,price_rub,price_usd,supplier,pricelist_name,last_upload_at"
      );

    req = applyTextSearch(req);

    if (brand !== "ALL") {
      req = req.eq("brand", brand);
    }

    req = req.order("price_byn", { ascending: true, nullsFirst: false });

    return req;
  }

  function buildBrandsQuery() {
    let req = supabase.from("offers_view").select("brand");
    req = applyTextSearch(req);
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
      const { data, error } = await buildBrandsQuery();

      if (error) {
        throw error;
      }

      const uniq = Array.from(
        new Set((data || []).map((x) => x.brand).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "ru"));

      setSearchBrands(uniq);
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

      setErrorText("Ничего не найдено. Попробуйте ввести без символов - / \\");

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

    const [foundCount] = await Promise.all([runSearch(true), loadSearchBrands()]);

    logSearchAction({
      queryText: query,
      brandValue: brand,
      resultsCount: foundCount,
    }).catch((e) => console.error("logSearchAction error:", e));
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
      return r.price_byn.toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    if (r.price_rub && String(r.price_rub).trim() !== "") {
      return String(r.price_rub);
    }

    if (r.price_usd && String(r.price_usd).trim() !== "") {
      return String(r.price_usd);
    }

    return "—";
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
      <div style={searchHeroStyle}>
        <h2 style={searchHeroTitleStyle}>Поиск по прайсам поставщиков</h2>

        <div style={searchHeroTextStyle}>
          Введи минимум 2 символа. Поиск идёт по <b>P/N</b> и по <b>наименованию</b>.
          Можно искать по бренду через фильтр справа.
        </div>

        <div style={searchMetaRowStyle}>
          <span style={searchHintChipStyle}>Поиск по артикулу</span>
          <span style={searchHintChipStyle}>Поиск по наименованию</span>
          <span style={searchHintChipStyle}>Фильтр по бренду</span>
        </div>

        <div style={searchControlsRowStyle}>
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
            style={searchInputStyle}
          />

          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
            }}
            style={searchSelectStyle}
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
              ...searchButtonStyle,
              opacity: !canSearch || loading ? 0.65 : 1,
              cursor: !canSearch || loading ? "default" : "pointer",
            }}
          >
            {loading ? "Ищу..." : "Поиск"}
          </button>
        </div>

        <div style={searchMetaRowStyle}>
          <span style={searchMetaBadgeStyle}>
            {rows.length > 0 ? `Загружено: ${rows.length}` : "Результатов пока нет"}
          </span>

          {brand !== "ALL" && (
            <span style={searchMetaBadgeStyle}>Бренд: {brand}</span>
          )}

          {loadingBrands && (
            <span style={searchMetaBadgeStyle}>Обновляю бренды...</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={searchTableWrapStyle}>
          <table style={searchTableStyle}>
            <colgroup>
              <col style={{ width: "90px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              {isAdmin ? <col style={{ width: "180px" }} /> : null}
            </colgroup>

            <thead>
              <tr>
                {[
                  "Бренд",
                  "P/N",
                  "Наименование",
                  "Кол-во",
                  "BYN с НДС",
                  "Дата прайса",
                  ...(isAdmin ? ["Прайс"] : []),
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...searchThStyle,
                      whiteSpace: h === "Наименование" ? "normal" : "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={`${r.brand}-${r.pn}-${r.price_byn}-${idx}`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F8FAFF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                  }}
                  style={{ transition: "background 0.15s ease" }}
                >
                  <td style={pnCellStyle}>{r.brand || "—"}</td>

                  <td style={pnCellStyle}>{r.pn || "—"}</td>

                  <td style={nameCellStyle}>{r.name || "—"}</td>

                  <td style={qtyCellStyle}>{r.qty ?? "—"}</td>

                  <td style={priceCellStyle}>{getDisplayPrice(r)}</td>

                  <td style={dateCellStyle}>{formatUpdateDate(r.last_upload_at)}</td>

                  {isAdmin ? (
                    <td style={searchTdStyle}>{r.pricelist_name || "—"}</td>
                  ) : null}
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + (isAdmin ? 1 : 0)}
                    style={{
                      ...searchTdStyle,
                      padding: "16px 12px",
                      color: "#666",
                    }}
                  >
                    {canSearch
                      ? loading
                        ? "Идёт поиск..."
                        : errorText
                        ? errorText
                        : "Ничего не найдено. Попробуйте ввести без символов - / \\"
                      : "Начни вводить запрос (минимум 2 символа) или выбери бренд."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              borderRadius: 12,
              border: "1px solid #111827",
              background: loadingMore ? "#ddd" : "#111827",
              color: loadingMore ? "#333" : "#fff",
              cursor: loadingMore ? "default" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 6px 16px rgba(17, 24, 39, 0.14)",
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
            border: "1px solid #111827",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          В начало списка
        </button>
      )}
    </div>
  );
}

const searchHeroStyle = {
  marginTop: 8,
  marginBottom: 20,
  padding: "18px 18px 16px",
  border: "1px solid #E5E7EB",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
};

const searchHeroTitleStyle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
};

const searchHeroTextStyle = {
  marginTop: 8,
  color: "#6B7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const searchControlsRowStyle = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  marginTop: 18,
  flexWrap: "wrap",
  justifyContent: "flex-start",
};

const searchInputStyle = {
  width: 400,
  maxWidth: "100%",
  padding: "12px 14px",
  border: "1px solid #D1D5DB",
  borderRadius: 12,
  fontSize: 14,
  background: "#fff",
  color: "#111827",
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
};

const searchSelectStyle = {
  minWidth: 220,
  padding: "12px 14px",
  border: "1px solid #D1D5DB",
  borderRadius: 12,
  fontSize: 14,
  background: "#fff",
  color: "#111827",
};

const searchButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  boxShadow: "0 6px 16px rgba(17, 24, 39, 0.14)",
};

const searchMetaRowStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 14,
};

const searchMetaBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  background: "#F3F4F6",
  color: "#374151",
  fontSize: 13,
  fontWeight: 500,
};

const searchHintChipStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#EEF2FF",
  color: "#3559A8",
  fontSize: 12,
  fontWeight: 600,
};

const searchTableWrapStyle = {
  overflowX: "auto",
  border: "1px solid #E5E7EB",
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
};

const searchTableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 13,
  tableLayout: "fixed",
};

const searchThStyle = {
  padding: "14px 12px",
  textAlign: "left",
  background: "#F5F7FA",
  borderBottom: "1px solid #E2E8F0",
  color: "#555",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  verticalAlign: "top",
};

const searchTdStyle = {
  padding: "12px 12px",
  borderBottom: "1px solid #EEF2F7",
  verticalAlign: "top",
  color: "#222",
  lineHeight: 1.4,
};

const pnCellStyle = {
  ...searchTdStyle,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
  color: "#374151",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const nameCellStyle = {
  ...searchTdStyle,
  fontWeight: 500,
  color: "#1F2937",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const qtyCellStyle = {
  ...searchTdStyle,
  whiteSpace: "nowrap",
  textAlign: "center",
  color: "#374151",
};

const priceCellStyle = {
  ...searchTdStyle,
  fontWeight: 600,
  color: "#111827",
  whiteSpace: "nowrap",
};

const dateCellStyle = {
  ...searchTdStyle,
  color: "#6B7280",
  whiteSpace: "nowrap",
};

