"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PAGE_SIZE = 100;
const CART_STORAGE_KEY = "b2bpart_cart_v1";
const FORM_STORAGE_KEY = "b2bpart_order_form_v1";

export default function Page() {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("ALL");
  const [priceSort, setPriceSort] = useState("default");

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
          customerComment
        })
      );
    } catch (e) {
      console.error("Failed to save order form", e);
    }
  }, [customerName, customerContact, customerComment]);

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

  function buildRowsQuery() {
    const q = query.trim();
    const pattern = `%${q}%`;

    let req = supabase
      .from("offers_view")
      .select("id,brand,pn,name,qty,price_byn,price_rub,price_usd,supplier,pricelist_name");

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

  async function loadSearchBrands() {
    if (!canSearch) {
      setSearchBrands([]);
      return;
    }

    setLoadingBrands(true);

    const q = query.trim();
    const pattern = `%${q}%`;

    let req = supabase
      .from("offers_view")
      .select("brand");

    if (q) {
      req = req.or(`pn.ilike.${pattern},name.ilike.${pattern}`);
    }

    const { data, error } = await req;

    if (!error) {
      const uniq = Array.from(
        new Set((data || []).map((x) => x.brand).filter(Boolean))
      ).sort();

      setSearchBrands(uniq);
    }

    setLoadingBrands(false);
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

    const req = buildRowsQuery().range(from, to);
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
    const t = setTimeout(() => {
      loadSearchBrands();
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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

  function getRowKey(r) {
    return `${r.brand || ""}__${r.pn || ""}__${r.name || ""}`;
  }

  function getDisplayPrice(r) {
    if (typeof r.price_byn === "number") return `${r.price_byn.toFixed(2)} BYN`;
    if (r.price_rub && String(r.price_rub).trim() !== "") return String(r.price_rub);
    if (r.price_usd && String(r.price_usd).trim() !== "") return String(r.price_usd);
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
          item.key === key
            ? { ...item, orderQty: item.orderQty + 1 }
            : item
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
          orderQty: 1
        }
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
          const nextQty = direction === "inc" ? item.orderQty + 1 : item.orderQty - 1;
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
    alert("Заполни имя и контакт.");
    return;
  }

  const {
    data: { session }
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
        status: "new"
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
      price_byn:
        typeof item.price_byn === "number" ? item.price_byn : null
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsPayload);

    if (itemsError) {
      alert("Заявка создана, но товары не сохранились: " + itemsError.message);
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

    const payload = {
      customer_name: customerName.trim(),
      customer_contact: customerContact.trim(),
      customer_comment: customerComment.trim(),
      items: cart.map((item) => ({
        brand: item.brand,
        pn: item.pn,
        name: item.name,
        order_qty: item.orderQty,
        stock_qty: item.stockQty,
        price_byn: item.price_byn,
        display_price: item.displayPrice
      }))
    };

    alert(
      "Заявка собрана.\n\n" +
        JSON.stringify(payload, null, 2) +
        "\n\nСледующим шагом подключим отправку в n8n / Telegram."
    );
  }

  return (
    <div
      style={{
        width: "98vw",
        maxWidth: 2240,
        margin: "0 auto",
        padding: "20px 16px 120px"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 10,
          marginBottom: -4
        }}
      >
        <a
          href="https://t.me/OlkaWhite"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 10,
            fontSize: 14,
            color: "#111",
            textDecoration: "none",
            background: "#fff",
            whiteSpace: "nowrap"
          }}
        >
          <span style={{ fontSize: 15 }}>✈️</span>
          <span>Связаться с разработчиком</span>
        </a>
      </div>

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
          placeholder="Поиск: парт-номер или текст..."
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

        {loadingBrands && (
          <div style={{ color: "#666", fontSize: 13 }}>
            Обновляю список брендов...
          </div>
        )}
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
            <col style={{ width: "130px" }} />
          </colgroup>

          <thead>
            <tr>
              {["Бренд", "P/N", "Наименование", "Кол-во", "Цена (BYN)", "Заказать"].map((h) => (
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
            {rows.map((r, idx) => {
              const added = isInCart(r);

              return (
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
                          : (r.price_usd && String(r.price_usd).trim() !== ""
                              ? r.price_usd
                              : ""))}
                  </td>

                  <td
                    style={{
                      padding: "8px",
                      borderBottom: "1px solid #eee",
                      verticalAlign: "top"
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
                        width: "100%"
                      }}
                    >
                      {added ? "Добавлено" : "В заказ"}
                    </button>
                  </td>
                </tr>
              );
            })}

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

      {cart.length > 0 && (
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
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)"
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
            bottom: cart.length > 0 ? (orderOpen ? 500 : 84) : 24,
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

      {orderOpen && (
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
            padding: 16
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12
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
                fontSize: 13
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
                  padding: 10
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {item.brand} {item.pn}
                </div>

                <div style={{ fontSize: 13, color: "#444", marginBottom: 8, lineHeight: 1.35 }}>
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
                    gap: 10
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
                        cursor: "pointer"
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
                        cursor: "pointer"
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
                      fontSize: 13
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ваше имя"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10,
                fontSize: 14
              }}
            />

            <input
              value={customerContact}
              onChange={(e) => setCustomerContact(e.target.value)}
              placeholder="Телефон или Telegram"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10,
                fontSize: 14
              }}
            />

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
                resize: "vertical"
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
                fontSize: 14
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
