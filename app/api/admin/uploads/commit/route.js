import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(req) {
  try {
    const body = await req.json();
    const supplierId = Number(body?.supplierId);
    const fileName = String(body?.fileName || "");
    const priceType = String(body?.priceType || "rub");

    if (!supplierId) {
      return Response.json({ error: "Не выбран поставщик." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("commit_offers_import", {
      p_pricelist_id: supplierId
    });

    if (error) {
      return Response.json(
        { error: `Ошибка финальной загрузки: ${error.message}` },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    const rowsTotal = result?.rows_total ?? 0;
    const rowsInserted = result?.rows_inserted ?? 0;
    const rowsSkipped = result?.rows_skipped ?? 0;

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
        { error: `Прайс загружен, но лог не сохранился: ${logError.message}` },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      stats: {
        rowsTotal,
        rowsInserted,
        rowsSkipped
      }
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка commit." },
      { status: 500 }
    );
  }
}