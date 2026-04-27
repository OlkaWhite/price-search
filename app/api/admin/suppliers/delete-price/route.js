import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELETE_CHUNK = 1000;

export async function POST(req) {
  try {
    const body = await req.json();
    const supplierId = Number(body?.supplierId);

    if (!supplierId) {
      return Response.json(
        { error: "Не передан supplierId." },
        { status: 400 }
      );
    }

    const { data: pricelist, error: pricelistReadError } = await supabaseAdmin
      .from("pricelists")
      .select("id, supplier, name, price_type")
      .eq("id", supplierId)
      .single();

    if (pricelistReadError) {
      return Response.json(
        { error: `Не удалось прочитать поставщика: ${pricelistReadError.message}` },
        { status: 500 }
      );
    }

    let deletedRows = 0;

    while (true) {
      const { data: rows, error: rowsError } = await supabaseAdmin
        .from("offers")
        .select("id")
        .eq("pricelist_id", supplierId)
        .limit(DELETE_CHUNK);

      if (rowsError) {
        return Response.json(
          { error: `Не удалось прочитать строки прайса: ${rowsError.message}` },
          { status: 500 }
        );
      }

      if (!rows || rows.length === 0) {
        break;
      }

      const ids = rows.map((item) => item.id).filter(Boolean);

      const { error: deleteError } = await supabaseAdmin
        .from("offers")
        .delete()
        .in("id", ids);

      if (deleteError) {
        return Response.json(
          { error: `Ошибка удаления прайса: ${deleteError.message}` },
          { status: 500 }
        );
      }

      deletedRows += ids.length;
    }

    const { error: updatePricelistError } = await supabaseAdmin
      .from("pricelists")
      .update({
        last_upload_at: null
      })
      .eq("id", supplierId);

    if (updatePricelistError) {
      return Response.json(
        { error: `Прайс удалён, но не обновился pricelists: ${updatePricelistError.message}` },
        { status: 500 }
      );
    }

    const { error: logError } = await supabaseAdmin
      .from("price_upload_logs")
      .insert({
        supplier_id: supplierId,
        uploaded_by: null,
        file_name: null,
        price_type: pricelist?.price_type || null,
        rows_total: deletedRows,
        rows_inserted: 0,
        rows_skipped: 0,
        status: "warning",
        error_text: `Прайс удалён вручную из админки. Удалено строк: ${deletedRows}`
      });

    if (logError) {
      return Response.json(
        {
          ok: true,
          deletedRows,
          warning: `Прайс удалён, но лог не записался: ${logError.message}`
        },
        { status: 200 }
      );
    }

    return Response.json({
      ok: true,
      deletedRows
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка удаления прайса." },
      { status: 500 }
    );
  }
}