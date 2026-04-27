import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELETE_CHUNK = 300;
const INSERT_CHUNK = 50;
const READ_CHUNK = 200;

export async function POST(req) {
  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const supplierId = Number(body?.supplierId);
    const priceType = String(body?.priceType || "rub");
    const fileName = String(body?.fileName || "");

    if (!supplierId) {
      return Response.json({ error: "Не выбран поставщик." }, { status: 400 });
    }

    if (action === "prepare") {
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

      const { count: oldRowsCount, error: oldCountError } = await supabaseAdmin
        .from("offers")
        .select("*", { count: "exact", head: true })
        .eq("pricelist_id", supplierId);

      if (oldCountError) {
        return Response.json(
          { error: `Не удалось посчитать старые строки offers: ${oldCountError.message}` },
          { status: 500 }
        );
      }

      return Response.json({
        ok: true,
        rowsTotal: rowsTotal ?? 0,
        rowsSkipped,
        oldRowsCount: oldRowsCount ?? 0,
        deleteChunk: DELETE_CHUNK,
        readChunk: READ_CHUNK,
        insertChunk: INSERT_CHUNK
      });
    }

    if (action === "deleteChunk") {
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
        return Response.json({
          ok: true,
          done: true,
          deleted: 0
        });
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

      return Response.json({
        ok: true,
        done: false,
        deleted: ids.length
      });
    }

    if (action === "insertChunk") {
      const offset = Number(body?.offset || 0);

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
        return Response.json({
          ok: true,
          done: true,
          inserted: 0,
          nextOffset: offset
        });
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

      let inserted = 0;

      for (let i = 0; i < normalizedRows.length; i += INSERT_CHUNK) {
        const chunk = normalizedRows.slice(i, i + INSERT_CHUNK);

        const { error: insertError } = await supabaseAdmin
          .from("offers")
          .insert(chunk);

        if (insertError) {
          return Response.json(
            { error: `Ошибка вставки в offers: ${insertError.message}` },
            { status: 500 }
          );
        }

        inserted += chunk.length;
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      return Response.json({
        ok: true,
        done: false,
        inserted,
        nextOffset: offset + READ_CHUNK,
        sourceRows: importRows.length
      });
    }

    if (action === "finalize") {
      const rowsTotal = Number(body?.rowsTotal || 0);
      const rowsInserted = Number(body?.rowsInserted || 0);
      const rowsSkipped = Number(body?.rowsSkipped || 0);

      const { error: pricelistError } = await supabaseAdmin
        .from("pricelists")
        .update({
          last_upload_at: new Date().toISOString(),
          price_type: priceType
        })
        .eq("id", supplierId);

      if (pricelistError) {
        return Response.json(
          { error: `Не удалось обновить pricelists: ${pricelistError.message}` },
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
          rows_total: rowsTotal,
          rows_inserted: rowsInserted,
          rows_skipped: rowsSkipped,
          status: "ok",
          error_text:
            rowsSkipped > 0
              ? `${rowsSkipped} строк пропущено из-за пустого P/N`
              : null
        });

      if (logError) {
        return Response.json(
          { error: `Не удалось записать лог загрузки: ${logError.message}` },
          { status: 500 }
        );
      }

      return Response.json({ ok: true });
    }

    return Response.json(
      { error: "Неизвестное действие." },
      { status: 400 }
    );
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка commit-step route." },
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