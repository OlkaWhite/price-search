import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * API Банка России:
 * https://www.cbr.ru/scripts/XML_daily.asp
 *
 * ЦБ возвращает официальный курс валют на последнюю
 * зарегистрированную дату, если date_req не передавать.
 *
 * Для USD:
 * ID = R01235
 */

export async function GET() {
  try {
    const response = await fetch(
      "https://www.cbr.ru/scripts/XML_daily.asp",
      {
        method: "GET",

        /*
         * Не используем старый кэш Next.js.
         * Запрос идёт к ЦБ заново при обращении к нашему API.
         */
        cache: "no-store",

        headers: {
          Accept:
            "application/xml,text/xml;q=0.9,*/*;q=0.8",
          "User-Agent":
            "b2bpart.ru currency calculator",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `ЦБ РФ вернул HTTP ${response.status}`
      );
    }

    /*
     * XML ЦБ РФ традиционно отдаётся в Windows-1251.
     * Поэтому читаем не через response.text(),
     * а сначала как ArrayBuffer и декодируем явно.
     */
    const buffer = await response.arrayBuffer();

    const decoder = new TextDecoder("windows-1251");

    const xml = decoder.decode(buffer);

    /*
     * Получаем дату курса из:
     *
     * <ValCurs Date="10.08.2026" ...>
     */
    const dateMatch = xml.match(
      /<ValCurs[^>]*Date="([^"]+)"/i
    );

    const date = dateMatch
      ? dateMatch[1]
      : null;

    /*
     * Ищем блок доллара США:
     *
     * <Valute ID="R01235">
     * ...
     * <Nominal>1</Nominal>
     * <CharCode>USD</CharCode>
     * ...
     * <Value>...</Value>
     * </Valute>
     */
    const usdBlockMatch = xml.match(
      /<Valute\s+ID="R01235">([\s\S]*?)<\/Valute>/i
    );

    if (!usdBlockMatch) {
      throw new Error(
        "USD не найден в ответе ЦБ РФ"
      );
    }

    const usdBlock = usdBlockMatch[1];

    /*
     * Nominal нужен на случай, если ЦБ указывает
     * стоимость сразу за несколько единиц валюты.
     */
    const nominalMatch = usdBlock.match(
      /<Nominal>([^<]+)<\/Nominal>/i
    );

    const valueMatch = usdBlock.match(
      /<Value>([^<]+)<\/Value>/i
    );

    if (!nominalMatch || !valueMatch) {
      throw new Error(
        "Не удалось прочитать курс USD из XML ЦБ РФ"
      );
    }

    const nominal = Number(
      nominalMatch[1]
        .trim()
        .replace(",", ".")
    );

    const value = Number(
      valueMatch[1]
        .trim()
        .replace(",", ".")
    );

    if (
      !Number.isFinite(nominal) ||
      !Number.isFinite(value) ||
      nominal <= 0 ||
      value <= 0
    ) {
      throw new Error(
        "ЦБ РФ вернул некорректный курс USD"
      );
    }

    /*
     * Цена именно 1 USD в RUB.
     */
    const rate = value / nominal;

    return NextResponse.json(
      {
        success: true,

        currency: "USD",
        baseCurrency: "RUB",

        /*
         * Именно это поле читает calculator/page.js:
         *
         * data.rate
         */
        rate,

        /*
         * И это:
         *
         * data.date
         */
        date,

        nominal,

        source: "Банк России",
      },
      {
        status: 200,

        headers: {
          /*
           * Не позволяем браузеру держать устаревший
           * ответ нашего API.
           */
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Ошибка получения курса ЦБ РФ:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        rate: null,
        date: null,
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка получения курса",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
