import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELETE_CHUNK = 300;
const INSERT_CHUNK = 50;
const READ_CHUNK = 200;

export async function POST(req) {
  try {
    const body = await req.json();
    const supplierId = Number(body?.supplierId);
    const fileName = String(body?.fileName || "");
    const priceType = String(body?.priceType || "rub");

    if (!supplierId) {
      return Response.json({ error: "Не выбран поставщик." }, { status: 400 });
    }

    const { count: rowsTotal, error: totalError } = await supabaseAdmin
      .from("offers_import")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      return Response.json(
        { error: `Не удалось посчитать строки offers_import: ${totalError.message}` },
        { status: 500 }
      );
    }

    const { data: skippedRowsData, error: skippedError } = await supabaseAdmin
      .from("offers_import")
      .select("pn");

    if (skippedError) {
      return Response.json(
        { error: `Не удалось посчитать пропущенные строки: ${skippedError.message}` },
        { status: 500 }
      );
    }

    const rowsSkipped = (skippedRowsData || []).filter(
      (row) => !row.pn || String(row.pn).trim() === ""
    ).length;

    while (true) {
      const { data: oldRows, error: oldRowsError } = await supabaseAdmin
        .from("offers")
        .select("id")
        .eq("pricelist_id", supplierId)
        .limit(DELETE_CHUNK);

      if (oldRowsError) {
        return Response.json(
          { error: `Ошибка чтения старых строк offers: ${oldRowsError.message}` },
          { status: 500 }
        );
      }

      if (!oldRows || oldRows.length === 0) {
        break;
      }

      const ids = oldRows.map((row) => row.id).filter(Boolean);

      const { error: deleteError } = await supabaseAdmin
        .from("offers")
        .delete()
        .in("id", ids);

      if (deleteError) {
        return Response.json(
          { error: `Ошибка удаления старого прайса: ${deleteError.message}` },
          { status: 500 }
        );
      }
    }

    let offset = 0;
    let rowsInserted = 0;

    while (true) {
      const { data: importRows, error: importError } = await supabaseAdmin
        .from("offers_import")
        .select("brand, pn, name, qty, price_rub, price_usd")
        .order("pn", { ascending: true })
        .range(offset, offset + READ_CHUNK - 1);

      if (importError) {
        return Response.json(
          { error: `Ошибка чтения offers_import: ${importError.message}` },
          { status: 500 }
        );
      }

      if (!importRows || importRows.length === 0) {
        break;
      }

      const normalizedRows = importRows
        .filter((row) => row.pn && String(row.pn).trim() !== "")
        .map((row) => ({
          pricelist_id: supplierId,
          brand: String(row.brand ?? "").trim() || String(row.pn ?? "").trim(),
          pn: String(row.pn ?? "").trim(),
          name: String(row.name ?? "").trim() || String(row.pn ?? "").trim(),
          qty: String(row.qty ?? "").trim() || null,
          price_rub: normalizeNumeric(row.price_rub),
          price_usd: normalizeNumeric(row.price_usd),
          created_at: new Date().toISOString(),
          uploaded_at: new Date().toISOString()
        }));

     for (let i = 0; i < normalizedRows.length; i += INSERT_CHUNK) {
  const chunk = normalizedRows.slice(i, i + INSERT_CHUNK);

  const { error: insertError } = await supabaseAdmin
    .from("offers")
    .insert(chunk);

  if (insertError) {
    console.error("Insert chunk error:", insertError, {
      supplierId,
      chunkSize: chunk.length,
      samplePn: chunk[0]?.pn || null
    });

    return Response.json(
      {
        error: `Ошибка вставки в offers: ${insertError.message}`,
        details: insertError
      },
      { status: 500 }
    );
  }

  rowsInserted += chunk.length;

  await new Promise((resolve) => setTimeout(resolve, 80));
}

      offset += READ_CHUNK;
    }

    const { error: pricelistError } = await supabaseAdmin
      .from("pricelists")
      .update({
        last_upload_at: new Date().toISOString(),
        price_type: priceType
      })
      .eq("id", supplierId);

    if (pricelistError) {
      return Response.json(
        { error: `Прайс загружен, но не обновился pricelists: ${pricelistError.message}` },
        { status: 500 }
      );
    }

    const { error: logError } = await supabaseAdmin
      .from("price_upload_logs")
      .insert({
        supplier_id: supplierId,
        uploaded_by: null,
        file_name: fileName || null,
        price_type: priceType || null,
        rows_total: rowsTotal ?? 0,
        rows_inserted: rowsInserted,
        rows_skipped: rowsSkipped ?? 0,
        status: "ok",
        error_text:
          rowsSkipped > 0
            ? `${rowsSkipped} строк пропущено из-за пустого P/N`
            : null
      });

    if (logError) {
      return Response.json(
        { error: `Прайс загружен, но лог не сохранился: ${logError.message}` },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      stats: {
        rowsTotal: rowsTotal ?? 0,
        rowsInserted,
        rowsSkipped: rowsSkipped ?? 0
      }
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка commit." },
      { status: 500 }
    );
  }
}

function normalizeNumeric(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const normalized = s.replace(",", ".");
  return normalized === "" ? null : normalized;
}