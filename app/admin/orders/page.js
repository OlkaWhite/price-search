"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const STATUS_OPTIONS = ["all", "new", "in_progress", "processed", "canceled"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadOrders() {
    setLoading(true);
    setErrorText("");

    let req = supabase
      .from("orders")
      .select(`
        id,
        user_id,
        customer_name,
        customer_contact,
        customer_comment,
        status,
        manager_comment,
        created_at,
        processed_at,
        order_items (
          id,
          brand,
          pn,
          name,
          order_qty,
          stock_qty,
          display_price,
          price_byn
        ),
        profiles:user_id (
          email,
          company_name,
          contact_name,
          phone,
          telegram
        )
      `)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      req = req.eq("status", statusFilter);
    }

    const { data, error } = await req;

    if (error) {
      setErrorText(error.message);
      setOrders([]);
    } else {
      setOrders(data || []);
      if (selectedOrder) {
        const fresh = (data || []).find((o) => o.id === selectedOrder.id);
        setSelectedOrder(fresh || null);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const newCount = orders.filter((o) => o.status === "new").length;
    const inProgressCount = orders.filter((o) => o.status === "in_progress").length;
    const processedCount = orders.filter((o) => o.status === "processed").length;
    const canceledCount = orders.filter((o) => o.status === "canceled").length;

    const totalAmount = orders.reduce((sum, order) => {
      return sum + calcOrderTotal(order);
    }, 0);

    return {
      total,
      newCount,
      inProgressCount,
      processedCount,
      canceledCount,
      totalAmount
    };
  }, [orders]);

  async function saveOrderUpdates() {
    if (!selectedOrder) return;

    setSaving(true);

    const payload = {
      status: selectedOrder.status,
      manager_comment: selectedOrder.manager_comment || "",
      processed_at:
        selectedOrder.status === "processed" ? new Date().toISOString() : null
    };

    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", selectedOrder.id);

    if (error) {
      alert("Ошибка при сохранении: " + error.message);
    } else {
      await loadOrders();
      alert("Заказ обновлён.");
    }

    setSaving(false);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 20
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Заказы</h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Все заявки клиентов с деталями и обработкой
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: 10,
              fontSize: 14
            }}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "Все статусы" : status}
              </option>
                                ))}
          </select>

          <button
            onClick={loadOrders}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14
            }}
          >
            Обновить
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 20
        }}
      >
        <StatCard title="Всего заказов" value={stats.total} />
        <StatCard title="Новые" value={stats.newCount} />
        <StatCard title="В работе" value={stats.inProgressCount} />
        <StatCard title="Обработаны" value={stats.processedCount} />
        <StatCard title="Отменены" value={stats.canceledCount} />
        <StatCard title="Сумма заказов" value={`${stats.totalAmount.toFixed(2)} BYN`} />
      </div>

      {errorText && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #f1b5b5",
            borderRadius: 10,
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
          gridTemplateColumns: selectedOrder ? "1.1fr 0.9fr" : "1fr",
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
            <div style={{ padding: 20 }}>Загружаю заказы...</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 20, color: "#666" }}>Заказов пока нет.</div>
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
                    {["ID", "Дата", "Клиент", "Статус", "Позиций", "Сумма", ""].map((h) => (
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
                  {orders.map((order) => {
                    const isActive = selectedOrder?.id === order.id;
                    const itemsCount = (order.order_items || []).reduce(
                      (sum, item) => sum + (Number(item.order_qty) || 0),
                      0
                    );

                    return (
                      <tr
                        key={order.id}
                        style={{
                          background: isActive ? "#f7f7f7" : "#fff"
                        }}
                      >
                        <td style={tdStyle}>{order.id}</td>
                        <td style={tdStyle}>
                          {new Date(order.created_at).toLocaleString()}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>
                            {order.customer_name || "—"}
                          </div>
                          <div style={{ color: "#666", fontSize: 13 }}>
                            {order.customer_contact || "—"}
                          </div>
                        </td>
                        <td style={tdStyle}>
                            <StatusBadge status={order.status} />
                        </td>
                        <td style={tdStyle}>{itemsCount}</td>
                        <td style={tdStyle}>{calcOrderTotal(order).toFixed(2)} BYN</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => setSelectedOrder(order)}
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

        {selectedOrder && (
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
              <h2 style={{ margin: 0 }}>Заказ #{selectedOrder.id}</h2>

              <button
                onClick={() => setSelectedOrder(null)}
                style={smallGhostButtonStyle}
              >
                Закрыть
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <InfoRow label="Дата" value={new Date(selectedOrder.created_at).toLocaleString()} />
              <InfoRow label="Клиент" value={selectedOrder.customer_name || "—"} />
              <InfoRow label="Контакт" value={selectedOrder.customer_contact || "—"} />
              <InfoRow
                label="Комментарий клиента"
                value={selectedOrder.customer_comment || "—"}
              />
              <InfoRow
                label="Email"
                value={selectedOrder.profiles?.email || "—"}
              />
              <InfoRow
                label="Компания"
                value={selectedOrder.profiles?.company_name || "—"}
              />
              <InfoRow
                label="Контактное лицо"
                value={selectedOrder.profiles?.contact_name || "—"}
              />
              <InfoRow
                label="Телефон"
                value={selectedOrder.profiles?.phone || "—"}
              />
              <InfoRow
                label="Telegram"
                value={selectedOrder.profiles?.telegram || "—"}
              />
              <InfoRow
                label="Сумма заказа"
                value={`${calcOrderTotal(selectedOrder).toFixed(2)} BYN`}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Статус</div>
              <select
                value={selectedOrder.status}
                onChange={(e) =>
                  setSelectedOrder((prev) => ({ ...prev, status: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  fontSize: 14
                }}
              >
                {STATUS_OPTIONS.filter((s) => s !== "all").map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Комментарий менеджера</div>
              <textarea
                value={selectedOrder.manager_comment || ""}
                onChange={(e) =>
                  setSelectedOrder((prev) => ({
                    ...prev,
                    manager_comment: e.target.value
                  }))
}
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
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                onClick={saveOrderUpdates}
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
                {saving ? "Сохраняю..." : "Сохранить изменения"}
              </button>
            </div>

            <div style={{ marginTop: 22 }}>
              <h3 style={{ marginTop: 0 }}>Позиции заказа</h3>

              <div style={{ display: "grid", gap: 10 }}>
                {(selectedOrder.order_items || []).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 12
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {item.brand  "—"} {item.pn  ""}
                    </div>

                    <div style={{ marginTop: 4, color: "#444", fontSize: 14 }}>
                      {item.name || "—"}
                    </div>

                    <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
                      Кол-во: {item.order_qty || 0}
                    </div>

                    <div style={{ marginTop: 4, color: "#666", fontSize: 13 }}>
                      Остаток: {item.stock_qty || "—"}
                    </div>

                    <div style={{ marginTop: 4, color: "#666", fontSize: 13 }}>
                      Цена: {item.display_price || "—"}
                    </div>

                    <div style={{ marginTop: 4, color: "#111", fontSize: 13, fontWeight: 600 }}>
                      Сумма позиции: {calcItemTotal(item).toFixed(2)} BYN
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function calcItemTotal(item) {
  const price =
    typeof item.price_byn === "number"
      ? item.price_byn
      : Number(item.price_byn) || 0;

  const qty =
    typeof item.order_qty === "number"
      ? item.order_qty
      : Number(item.order_qty) || 0;

  return price * qty;
}

function calcOrderTotal(order) {
  return (order.order_items || []).reduce((sum, item) => {
    return sum + calcItemTotal(item);
  }, 0);
}

function StatusBadge({ status }) {
  const map = {
    new: { label: "new", bg: "#eef6ff", color: "#1d4ed8" },
    in_progress: { label: "in_progress", bg: "#fff7ed", color: "#c2410c" },
    processed: { label: "processed", bg: "#ecfdf5", color: "#15803d" },
    canceled: { label: "canceled", bg: "#fef2f2", color: "#b91c1c" }
  };

  const item = map[status] || { label: status, bg: "#f3f4f6", color: "#374151" };

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

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: 18,
        background: "#fff"
        }}
    >
      <div style={{ color: "#666", marginBottom: 8, fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

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
