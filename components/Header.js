"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthState } from "./AuthProvider";

export default function Header() {
  const pathname = usePathname();
  const { isAdmin, authReady } = useAuthState();

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
            <span>Связаться с менеджером</span>
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

          {authReady && isAdmin && (
            <Link
              href="/admin"
              style={{
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 10,
                textDecoration: "none",
                color: "#111",
                background: isActive("/admin") ? "#f3f3f3" : "#fff",
                fontSize: 14,
                whiteSpace: "nowrap"
              }}
            >
              Админка
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}