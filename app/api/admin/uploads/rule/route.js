import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = Number(searchParams.get("supplierId"));

    if (!supplierId) {
      return Response.json(
        { error: "Не передан supplierId." },
        { status: 400 }
      );
    }

    const { data: rule, error: ruleError } = await supabaseAdmin
      .from("pricelist_import_rules")
      .select("*")
      .eq("pricelist_id", supplierId)
      .eq("is_active", true)
      .maybeSingle();

    if (ruleError) {
      return Response.json(
        { error: `Ошибка чтения правила: ${ruleError.message}` },
        { status: 500 }
      );
    }

    if (!rule) {
      return Response.json(
        { error: "Для этого поставщика не найдено активное правило импорта." },
        { status: 404 }
      );
    }

    const { data: aliases, error: aliasesError } = await supabaseAdmin
      .from("pricelist_import_rule_aliases")
      .select("field_name, source_header")
      .eq("rule_id", rule.id);

    if (aliasesError) {
      return Response.json(
        { error: `Ошибка чтения алиасов: ${aliasesError.message}` },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      rule,
      aliases: aliases || []
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Ошибка rule route." },
      { status: 500 }
    );
  }
}