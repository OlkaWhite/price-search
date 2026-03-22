"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (mounted && session) {
        router.replace("/account");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorText("");

    if (!email.trim() || !password.trim()) {
      setErrorText("Заполни email и пароль.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          setErrorText(error.message);
        } else {
          router.push("/account");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });

        if (error) {
          setErrorText(error.message);
        } else {
          const user = data?.user;

          if (user) {
            await supabase.from("profiles").upsert({
              id: user.id,
              email: user.email || email.trim()
            });
          }

          setMessage(
            "Аккаунт создан. Если Supabase просит подтверждение email, подтверди почту. Затем войди."
          );
        }
      }
    } catch (e2) {
      setErrorText("Что-то пошло не так.");
      console.error(e2);
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#fafafa"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>
          {mode === "login" ? "Вход" : "Регистрация"}
        </h1>

        <p style={{ color: "#666", marginTop: 8, marginBottom: 20 }}>
          {mode === "login"
            ? "Войди в личный кабинет клиента."
            : "Создай аккаунт для личного кабинета."}
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16
          }}
        >
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: mode === "login" ? "#111" : "#fff",
              color: mode === "login" ? "#fff" : "#111",
              cursor: "pointer"
            }}
          >
            Вход
          </button>

          <button
            onClick={() => setMode("signup")}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: mode === "signup" ? "#111" : "#fff",
              color: mode === "signup" ? "#fff" : "#111",
              cursor: "pointer"
            }}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: 10,
              fontSize: 14
            }}
          />

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: 10,
              fontSize: 14
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: loading ? "#ddd" : "#111",
              color: loading ? "#333" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontSize: 14
            }}
          >
            {loading
              ? "Подожди..."
              : mode === "login"
              ? "Войти"
              : "Создать аккаунт"}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #cce5cc",
              background: "#f3fff3",
              color: "#2e6b2e",
              fontSize: 14
            }}
          >
            {message}
          </div>
        )}

        {errorText && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #f1b5b5",
              background: "#fff5f5",
              color: "#9b1c1c",
              fontSize: 14
            }}
          >
            {errorText}
          </div>
        )}
      </div>
    </div>
  );
}
