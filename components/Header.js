"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header
      style={{
        width: "100%",
        borderBottom: "1px solid #e5e5e5",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 1100
      }}
    >
      <div
        style={{
          width: "98vw",
          maxWidth: 2240,
          margin: "0 auto",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap"
        }}
      >
        <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  }}
>
  <Link
    href="/"
    style={{
      textDecoration: "none",
      color: "#111",
      fontSize: 22,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }}
  >
    b2bpart.ru
  </Link>

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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginLeft: "auto",
            flexWrap: "wrap",
            justifyContent: "flex-end"
          }}
        >
          <Link
            href="/"
            style={{
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: 10,
              textDecoration: "none",
              color: "#111",
              background: isActive("/") ? "#f3f3f3" : "#fff",
              fontSize: 14,
              whiteSpace: "nowrap"
            }}
          >
            Поиск по прайсам
          </Link>

          <Link
            href="/account"
            style={{
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: 10,
              textDecoration: "none",
              color: "#111",
              background: isActive("/account") ? "#f3f3f3" : "#fff",
              fontSize: 14,
              whiteSpace: "nowrap"
            }}
          >
            Личный кабинет
          </Link>

          {!loading && !user && (
            <Link
              href="/login"
              style={{
                padding: "10px 12px",
                border: "1px solid #111",
                borderRadius: 10,
                textDecoration: "none",
                color: "#fff",
                background: "#111",
                fontSize: 14,
                whiteSpace: "nowrap"
              }}
            >
              Войти
            </Link>
          )}

          {!loading && user && (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: "#666",
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                title={user.email || ""}
              >
                {user.email || "Клиент"}
              </div>

              <button
                onClick={handleLogout}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #111",
                  borderRadius: 10,
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                  fontSize: 14,
                  whiteSpace: "nowrap"
                }}
              >
                Выйти
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
