"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AccountPage() {
  const router = useRouter();

  const [sessionUser, setSessionUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [email, setEmail] = useState("");

  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrorText("");

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      if (!mounted) return;

      setSessionUser(session.user);
      setEmail(session.user.email || "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        setErrorText(profileError.message);
      } else if (profile) {
        setCompanyName(profile.company_name || "");
        setContactName(profile.contact_name || "");
        setPhone(profile.phone || "");
        setTelegram(profile.telegram || "");
        setEmail(profile.email || session.user.email || "");
      } else {
        await supabase.from("profiles").insert({
          id: session.user.id,
          email: session.user.email || ""
        });
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          customer_name,
          customer_contact,
          customer_comment,
          status,
          created_at,
          order_items (
            id,
            brand,
            pn,
            name,
            order_qty,
            stock_qty,
            display_price,
            price_byn
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersError) {
        setErrorText(ordersError.message);
      } else {
        setOrders(ordersData || []);
      }

      if (mounted) {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!sessionUser) return;

    setSaving(true);
    setErrorText("");
    setMessage("");

    const { error } = await supabase.from("profiles").upsert({
      id: sessionUser.id,
      company_name: companyName,
      contact_name: contactName,
      phone,
      telegram,
      email
    });

    if (error) {
      setErrorText(error.message);
    } else {
      setMessage("Профиль сохранён.");
    }

    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div style={{ padding: 24, fontSize: 16 }}>
        Загружаю кабинет...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Личный кабинет</h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Управление профилем и просмотр заявок
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#fff",
            color: "#111",
            cursor: "pointer"
          }}
        >
          Выйти
        </button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: 14,
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
            marginBottom: 14,
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
          gridTemplateColumns: "1fr",
          gap: 20
        }}
      >
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            padding: 20,
            background: "#fff"
          }}
        >
          <h2 style={{ marginTop: 0 }}>Профиль</h2>

          <form
            onSubmit={handleSaveProfile}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12
            }}
          >
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Компания"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10
              }}
            />

            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Контактное лицо"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10
              }}
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10
              }}
            />

            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="Telegram"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10
              }}
            />

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10
              }}
            />

            <div style={{ display: "flex", alignItems: "center" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: saving ? "#ddd" : "#111",
                  color: saving ? "#333" : "#fff",
                  cursor: saving ? "default" : "pointer"
                }}
              >
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>

        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            padding: 20,
            background: "#fff"
          }}
        >
          <h2 style={{ marginTop: 0 }}>Мои заявки</h2>

          {orders.length === 0 ? (
            <div style={{ color: "#666" }}>Заявок пока нет.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 14
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 8
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>Заявка #{order.id}</div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "#f3f3f3",
                        fontSize: 13
                      }}
                    >
                      {order.status}
                    </div>
                  </div>

                  {order.customer_comment && (
                    <div style={{ marginBottom: 8, color: "#444", fontSize: 14 }}>
                      Комментарий: {order.customer_comment}
                    </div>
                  )}

                  <div style={{ display: "grid", gap: 8 }}>
                    {(order.order_items || []).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          borderTop: "1px solid #f0f0f0",
                          paddingTop: 8
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {item.brand} {item.pn}
                        </div>
                        <div style={{ fontSize: 13, color: "#444" }}>{item.name}</div>
                        <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                          Кол-во: {item.order_qty} | Цена: {item.display_price || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
