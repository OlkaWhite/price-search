import Papa from "papaparse";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const supplierId = Number(formData.get("supplierId"));
    const priceType = String(formData.get("priceType") || "rub");

    if (!file) {
      return Response.json({ error: "Файл не выбран." }, { status: 400 });
    }

    if (!supplierId) {
      return Response.json({ error: "Не выбран поставщик." }, { status: 400 });
    }

    const text = await file.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors?.length) {
      return Response.json(
        { error: `Ошибка чтения CSV: ${parsed.errors[0].message}` },
        { status: 400 }
      );
    }

    const rows = (parsed.data || []).map((row) => ({
      brand: String(row.brand ?? "").trim(),
      pn: String(row.pn ?? "").trim(),
      name: String(row.name ?? "").trim(),
      qty: String(row.qty ?? "").trim(),
      price_rub: String(row.price_rub ?? "").trim(),
      price_usd: String(row.price_usd ?? "").trim()
    }));

    const { error: clearError } = await supabaseAdmin.rpc("clear_offers_import");

    if (clearError) {
      return Response.json(
        { error: `Не удалось очистить offers_import: ${clearError.message}` },
        { status: 500 }
      );
    }

    if (rows.length > 0) {
      const chunkSize = 1000;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabaseAdmin.from("offers_import").insert(chunk);

        if (error) {
          return Response.json(
            { error: `Ошибка вставки во временную таблицу: ${error.message}` },
            { status: 500 }
          );
        }
      }
    }

    const rowsTotal = rows.length;
    const rowsWithoutPn = rows.filter((r) => !r.pn).length;
    const rowsEmptyBrand = rows.filter((r) => !r.brand).length;
    const rowsEmptyName = rows.filter((r) => !r.name).length;
    const rowsReady = rowsTotal - rowsWithoutPn;

    return Response.json({
      ok: true,
      fileName: file.name,
      supplierId,
      priceType,
      stats: {
        rowsTotal,
        rowsWithoutPn,
        rowsEmptyBrand,
        rowsEmptyName,
        rowsReady
      },
      preview: rows.slice(0, 20)
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка preview." },
      { status: 500 }
    );
  }
}