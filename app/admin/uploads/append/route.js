import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req) {
  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "reset") {
      const { error } = await supabaseAdmin.rpc("clear_offers_import");

      if (error) {
        return Response.json(
          { error: `Не удалось очистить offers_import: ${error.message}` },
          { status: 500 }
        );
      }

      return Response.json({ ok: true });
    }

    if (action === "append") {
      const rows = Array.isArray(body?.rows) ? body.rows : [];

      if (!rows.length) {
        return Response.json(
          { error: "Не переданы строки для загрузки." },
          { status: 400 }
        );
      }

      const normalizedRows = rows.map((row) => ({
        brand: String(row.brand ?? "").trim(),
        pn: String(row.pn ?? "").trim(),
        name: String(row.name ?? "").trim(),
        qty: String(row.qty ?? "").trim(),
        price_rub: String(row.price_rub ?? "").trim(),
        price_usd: String(row.price_usd ?? "").trim()
      }));

      const { error } = await supabaseAdmin
        .from("offers_import")
        .insert(normalizedRows);

      if (error) {
        return Response.json(
          { error: `Не удалось вставить chunk в offers_import: ${error.message}` },
          { status: 500 }
        );
      }

      return Response.json({
        ok: true,
        inserted: normalizedRows.length
      });
    }

    return Response.json(
      { error: "Неизвестное действие." },
      { status: 400 }
    );
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка append route." },
      { status: 500 }
    );
  }
}