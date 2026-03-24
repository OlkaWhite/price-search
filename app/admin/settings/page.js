"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");

  const [rubToBynRate, setRubToBynRate] = useState("");
  const [usdToRubRate, setUsdToRubRate] = useState("");
  const [telegramWebhookUrl, setTelegramWebhookUrl] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setLoading(true);
      setErrorText("");
      setMessage("");

      const { data, error } = await supabase
        .from("admin_settings")
        .select("id, rub_to_byn_rate, usd_to_rub_rate, telegram_webhook_url")
        .eq("id", 1)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setErrorText(error.message);
      } else if (data) {
        setRubToBynRate(
          data.rub_to_byn_rate !== null && data.rub_to_byn_rate !== undefined
            ? String(data.rub_to_byn_rate)
            : ""
        );
        setUsdToRubRate(
          data.usd_to_rub_rate !== null && data.usd_to_rub_rate !== undefined
            ? String(data.usd_to_rub_rate)
            : ""
        );
        setTelegramWebhookUrl(data.telegram_webhook_url || "");
      }

      setLoading(false);
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErrorText("");
    setMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const payload = {
      id: 1,
      rub_to_byn_rate: rubToBynRate.trim() === "" ? null : Number(rubToBynRate),
      usd_to_rub_rate: usdToRubRate.trim() === "" ? null : Number(usdToRubRate),
      telegram_webhook_url: telegramWebhookUrl.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null
    };

    const { error } = await supabase
      .from("admin_settings")
      .upsert(payload);

    if (error) {
      setErrorText(error.message);
    } else {
      setMessage("Настройки сохранены.");
    }

    setSaving(false);
  }

  if (loading) {
    return <div>Загружаю настройки...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Настройки</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          Глобальные курсы валют и системные параметры
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

      <form
        onSubmit={handleSave}
        style={{
          display: "grid",
          gap: 20,
          maxWidth: 760
        }}
      >
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            background: "#fff",
            padding: 20
          }}
        >
          <h2 style={{ marginTop: 0 }}>Курсы валют</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16
            }}
          >
            <div>
              <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                RUB → BYN
              </div>
              <input
                value={rubToBynRate}
                onChange={(e) => setRubToBynRate(e.target.value)}
placeholder="Например: 0.0363"
                style={inputStyle}
              />
              <div style={hintStyle}>
                Глобальный курс перевода российских рублей в белорусские.
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                USD → RUB
              </div>
              <input
                value={usdToRubRate}
                onChange={(e) => setUsdToRubRate(e.target.value)}
                placeholder="Например: 92.5"
                style={inputStyle}
              />
              <div style={hintStyle}>
                Глобальный курс перевода долларов в российские рубли.
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            background: "#fff",
            padding: 20
          }}
        >
          <h2 style={{ marginTop: 0 }}>Интеграции</h2>

          <div>
            <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              n8n Webhook URL
            </div>
            <input
              value={telegramWebhookUrl}
              onChange={(e) => setTelegramWebhookUrl(e.target.value)}
              placeholder="https://n8n.aiwhite.ru/webhook/..."
              style={inputStyle}
            />
            <div style={hintStyle}>
              Сюда можно сохранить webhook для отправки заявок в n8n / Telegram.
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #111",
              background: saving ? "#ddd" : "#111",
              color: saving ? "#333" : "#fff",
              cursor: saving ? "default" : "pointer",
              fontSize: 14
            }}
          >
            {saving ? "Сохраняю..." : "Сохранить настройки"}
          </button>
        </div>
      </form>
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

const hintStyle = {
  marginTop: 8,
  fontSize: 12,
  color: "#666"
};
