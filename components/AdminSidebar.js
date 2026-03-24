"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/suppliers", label: "Поставщики" },
  { href: "/admin/uploads", label: "Загрузка прайсов" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/users", label: "Клиенты" },
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/brands", label: "Бренды" },
  { href: "/admin/settings", label: "Настройки" }
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        borderRight: "1px solid #e5e5e5",
        background: "#fff",
        padding: 16,
        boxSizing: "border-box"
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Админка
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: 10,
                textDecoration: "none",
                color: "#111",
                background: active ? "#f3f3f3" : "#fff",
                fontSize: 14
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
