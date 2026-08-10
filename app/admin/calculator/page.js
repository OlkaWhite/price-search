"use client";

import { useEffect, useMemo, useState } from "react";

const VAT = 1.2;

/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================================================= */

function parseNumber(value) {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "0,00";

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(value, digits = 4) {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}


/* =========================================================
   ГЛАВНАЯ СТРАНИЦА
========================================================= */

export default function CalculatorPage() {
  /*
   * Курсы
   */
  const [usdRubRate, setUsdRubRate] = useState(null);
  const [usdRubDate, setUsdRubDate] = useState("");
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState("");

  /*
   * RUB → BYN — вводим сами
   */
  const [rubBynInput, setRubBynInput] = useState("0,0365");

  /*
   * Исходные цены
   */
  const [usdPriceInput, setUsdPriceInput] = useState("");
  const [rubPriceInput, setRubPriceInput] = useState("");
  const [zeroPriceInput, setZeroPriceInput] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");

  /*
   * Сообщение "Скопировано"
   */
  const [copied, setCopied] = useState(false);


  /* =========================================================
     ЗАГРУЗКА СОХРАНЕННОГО КУРСА RUB → BYN
  ========================================================= */

  useEffect(() => {
    const savedRate = localStorage.getItem("calculator_rub_byn_rate");

    if (savedRate) {
      setRubBynInput(savedRate);
    }
  }, []);


  /* =========================================================
     ПОЛУЧЕНИЕ КУРСА USD → RUB ИЗ НАШЕГО API
  ========================================================= */

  async function loadUsdRubRate() {
    try {
      setRateLoading(true);
      setRateError("");

      const response = await fetch("/api/admin/cbr-rate", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Не удалось получить курс ЦБ РФ");
      }

      const data = await response.json();

      if (!data?.rate) {
        throw new Error("Курс USD не получен");
      }

      setUsdRubRate(Number(data.rate));
      setUsdRubDate(data.date || "");
    } catch (error) {
      console.error(error);

      setRateError(
        "Не удалось получить курс USD → RUB"
      );
    } finally {
      setRateLoading(false);
    }
  }

  useEffect(() => {
    loadUsdRubRate();
  }, []);


  /* =========================================================
     ЧИСЛОВЫЕ ЗНАЧЕНИЯ ИЗ INPUT
  ========================================================= */

  const rubBynRate = parseNumber(rubBynInput);
  const usdPrice = parseNumber(usdPriceInput);
  const rubPrice = parseNumber(rubPriceInput);
  const zeroPrice = parseNumber(zeroPriceInput);
  const invoicePrice = parseNumber(invoiceInput);


  /* =========================================================
     БЛОК — ЦЕНА В USD

     Формулы C6/D6, C8/D8, C10/D10 взяты из Excel.
  ========================================================= */

  const usdCalculation = useMemo(() => {
    if (!usdRubRate || !rubBynRate || !usdPrice) {
      return {
        rubWithoutVat: 0,
        baseWithVat: 0,
        baseWithoutVat: 0,
        zeroWithVat: 0,
        zeroWithoutVat: 0,
        threeWithVat: 0,
        threeWithoutVat: 0,
        sixWithVat: 0,
        sixWithoutVat: 0,
      };
    }

    /*
     * Промежуточная стоимость в RUB
     * USD × USD/RUB
     */
    const rubWithoutVat =
      usdPrice * usdRubRate;

    /*
     * Excel:
     * C6 = B6*C2*D2*1.2
     * D6 = C6/1.2
     */
    const baseWithVat =
      usdPrice *
      usdRubRate *
      rubBynRate *
      VAT;

    const baseWithoutVat =
      baseWithVat / VAT;

    /*
     * Excel:
     * C8 = B6*C2*D2*1.2
     * D8 = C8/1.22
     */
    const zeroWithVat =
      usdPrice *
      usdRubRate *
      rubBynRate *
      VAT;

    const zeroWithoutVat =
      zeroWithVat / 1.22;

    /*
     * Excel:
     * C10 = D6*1.03*1.2
     * D10 = C10/1.2
     */
    const threeWithVat =
      baseWithoutVat *
      1.03 *
      VAT;

    const threeWithoutVat =
      threeWithVat / VAT;

    /*
     * +6% — этой строки в Excel нет.
     * Добавлена по твоему запросу для сайта.
     */
    const sixWithVat =
      baseWithoutVat *
      1.06 *
      VAT;

    const sixWithoutVat =
      sixWithVat / VAT;

    return {
      rubWithoutVat,

      baseWithVat,
      baseWithoutVat,

      zeroWithVat,
      zeroWithoutVat,

      threeWithVat,
      threeWithoutVat,

      sixWithVat,
      sixWithoutVat,
    };
  }, [usdPrice, usdRubRate, rubBynRate]);


  /* =========================================================
     БЛОК — ЦЕНА В RUB

     Формулы полностью повторяют Excel.
  ========================================================= */

  const rubCalculation = useMemo(() => {
    if (!rubBynRate || !rubPrice) {
      return {
        baseWithVat: 0,
        baseWithoutVat: 0,

        tenWithVat: 0,
        tenWithoutVat: 0,

        thirteenWithVat: 0,
        thirteenWithoutVat: 0,

        twentyThreeWithVat: 0,
        twentyThreeWithoutVat: 0,
      };
    }

    /*
     * Excel:
     * C13 = B13*D2*1.2
     * D13 = C13/1.2
     */
    const baseWithVat =
      rubPrice *
      rubBynRate *
      VAT;

    const baseWithoutVat =
      baseWithVat / VAT;

    /*
     * Excel:
     * C15 = D13/1.089*1.2
     * D15 = C15/1.22
     */
    const tenWithVat =
      (baseWithoutVat / 1.089) *
      VAT;

    const tenWithoutVat =
      tenWithVat / 1.22;

    /*
     * Excel:
     * C17 = D13/1.06*1.2
     * D17 = C17/1.22
     */
    const thirteenWithVat =
      (baseWithoutVat / 1.06) *
      VAT;

    const thirteenWithoutVat =
      thirteenWithVat / 1.22;

    /*
     * Excel:
     * C19 = D13*1.03*1.2
     * D19 = C19/1.2
     */
    const twentyThreeWithVat =
      baseWithoutVat *
      1.03 *
      VAT;

    const twentyThreeWithoutVat =
      twentyThreeWithVat / VAT;

    return {
      baseWithVat,
      baseWithoutVat,

      tenWithVat,
      tenWithoutVat,

      thirteenWithVat,
      thirteenWithoutVat,

      twentyThreeWithVat,
      twentyThreeWithoutVat,
    };
  }, [rubPrice, rubBynRate]);


  /* =========================================================
     БЛОК — ЦЕНА В 0

     Формулы полностью повторяют Excel.
  ========================================================= */

  const zeroCalculation = useMemo(() => {
    if (!rubBynRate || !zeroPrice) {
      return {
        baseWithVat: 0,
        baseWithoutVat: 0,

        tenWithVat: 0,
        tenWithoutVat: 0,

        thirteenWithVat: 0,
        thirteenWithoutVat: 0,

        fifteenWithVat: 0,
        fifteenWithoutVat: 0,
      };
    }

    /*
     * Excel:
     * D22 = B22*D2
     * C22 = D22*1.2
     */
    const baseWithoutVat =
      zeroPrice *
      rubBynRate;

    const baseWithVat =
      baseWithoutVat *
      VAT;

    /*
     * Excel:
     * D24 = D22*1.1
     * C24 = D24*1.2
     */
    const tenWithoutVat =
      baseWithoutVat *
      1.1;

    const tenWithVat =
      tenWithoutVat *
      VAT;

    /*
     * Excel:
     * D25 = D22*1.13
     * C25 = D25*1.2
     */
    const thirteenWithoutVat =
      baseWithoutVat *
      1.13;

    const thirteenWithVat =
      thirteenWithoutVat *
      VAT;

    /*
     * Excel:
     * D26 = D22*1.15
     * C26 = D26*1.2
     */
    const fifteenWithoutVat =
      baseWithoutVat *
      1.15;

    const fifteenWithVat =
      fifteenWithoutVat *
      VAT;

    return {
      baseWithVat,
      baseWithoutVat,

      tenWithVat,
      tenWithoutVat,

      thirteenWithVat,
      thirteenWithoutVat,

      fifteenWithVat,
      fifteenWithoutVat,
    };
  }, [zeroPrice, rubBynRate]);


  /* =========================================================
     СЧЕТ / BITRIX

     Excel:
     * D28 = C28/1.2
  ========================================================= */

  const invoiceWithoutVat =
    invoicePrice > 0
      ? invoicePrice / VAT
      : 0;


  /* =========================================================
     СОХРАНИТЬ RUB → BYN
  ========================================================= */

  function saveRubBynRate() {
    localStorage.setItem(
      "calculator_rub_byn_rate",
      rubBynInput
    );

    alert("Курс RUB → BYN сохранён");
  }


  /* =========================================================
     КОПИРОВАНИЕ ЦЕНЫ ДЛЯ BITRIX
  ========================================================= */

  async function copyInvoicePrice() {
    if (!invoiceWithoutVat) return;

    const value = invoiceWithoutVat
      .toFixed(2)
      .replace(".", ",");

    try {
      await navigator.clipboard.writeText(value);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error(error);
    }
  }


  /* =========================================================
     UI
  ========================================================= */

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>
            Калькулятор
          </h1>

          <div style={styles.subtitle}>
            Расчёт закупочной и конечной стоимости
          </div>
        </div>
      </div>


      {/* =====================================================
          КУРСЫ
      ===================================================== */}

      <section style={styles.card}>
        <div style={styles.sectionTitle}>
          Курсы валют
        </div>

        <div style={styles.ratesGrid}>

          <div style={styles.rateBox}>
            <div style={styles.inputLabel}>
              USD → RUB
            </div>

            <div style={styles.rateValue}>
              {rateLoading
                ? "Загрузка..."
                : usdRubRate
                ? formatRate(usdRubRate, 4)
                : "—"}
            </div>

            <div style={styles.rateMeta}>
              {rateError ? (
                <span style={{ color: "#b42318" }}>
                  {rateError}
                </span>
              ) : (
                <>
                  ЦБ России
                  {usdRubDate
                    ? ` · ${usdRubDate}`
                    : ""}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={loadUsdRubRate}
              style={styles.secondaryButton}
            >
              Обновить курс
            </button>
          </div>


          <div style={styles.rateBox}>
            <label style={styles.inputLabel}>
              RUB → BYN
            </label>

            <input
              type="text"
              inputMode="decimal"
              value={rubBynInput}
              onChange={(e) =>
                setRubBynInput(e.target.value)
              }
              style={styles.rateInput}
              placeholder="0,0365"
            />

            <div style={styles.rateMeta}>
              Курс устанавливается вручную
            </div>

            <button
              type="button"
              onClick={saveRubBynRate}
              style={styles.primaryButton}
            >
              Сохранить курс
            </button>
          </div>

        </div>
      </section>


      {/* =====================================================
          USD
      ===================================================== */}

      <CalculatorCard
        title="Цена в USD"
        inputLabel="Цена поставщика"
        inputValue={usdPriceInput}
        onInputChange={setUsdPriceInput}
        suffix="USD"
        extra={
          usdPrice > 0 && usdRubRate ? (
            <div style={styles.conversionInfo}>
              {formatMoney(
                usdCalculation.rubWithoutVat
              )}{" "}
              RUB
            </div>
          ) : null
        }
        rows={[
          {
            label: "Базовая",
            withVat:
              usdCalculation.baseWithVat,
            withoutVat:
              usdCalculation.baseWithoutVat,
          },
          {
            label: "0%",
            withVat:
              usdCalculation.zeroWithVat,
            withoutVat:
              usdCalculation.zeroWithoutVat,
          },
          {
            label: "3%",
            withVat:
              usdCalculation.threeWithVat,
            withoutVat:
              usdCalculation.threeWithoutVat,
          },
          {
            label: "6%",
            withVat:
              usdCalculation.sixWithVat,
            withoutVat:
              usdCalculation.sixWithoutVat,
          },
        ]}
      />


      {/* =====================================================
          RUB
      ===================================================== */}

      <CalculatorCard
        title="Цена в RUB"
        inputLabel="Цена поставщика"
        inputValue={rubPriceInput}
        onInputChange={setRubPriceInput}
        suffix="RUB"
        rows={[
          {
            label: "Базовая",
            withVat:
              rubCalculation.baseWithVat,
            withoutVat:
              rubCalculation.baseWithoutVat,
          },
          {
            label: "10%",
            withVat:
              rubCalculation.tenWithVat,
            withoutVat:
              rubCalculation.tenWithoutVat,
          },
          {
            label: "13%",
            withVat:
              rubCalculation.thirteenWithVat,
            withoutVat:
              rubCalculation.thirteenWithoutVat,
          },
          {
            label: "23%",
            withVat:
              rubCalculation.twentyThreeWithVat,
            withoutVat:
              rubCalculation.twentyThreeWithoutVat,
          },
        ]}
      />


      {/* =====================================================
          ЦЕНА В 0
      ===================================================== */}

      <CalculatorCard
        title="Цена в 0"
        inputLabel="Исходная цена"
        inputValue={zeroPriceInput}
        onInputChange={setZeroPriceInput}
        suffix=""
        rows={[
          {
            label: "Базовая",
            withVat:
              zeroCalculation.baseWithVat,
            withoutVat:
              zeroCalculation.baseWithoutVat,
          },
          {
            label: "10%",
            withVat:
              zeroCalculation.tenWithVat,
            withoutVat:
              zeroCalculation.tenWithoutVat,
          },
          {
            label: "13%",
            withVat:
              zeroCalculation.thirteenWithVat,
            withoutVat:
              zeroCalculation.thirteenWithoutVat,
          },
          {
            label: "15%",
            withVat:
              zeroCalculation.fifteenWithVat,
            withoutVat:
              zeroCalculation.fifteenWithoutVat,
          },
        ]}
      />


      {/* =====================================================
          СЧЕТ
      ===================================================== */}

      <section style={styles.card}>
        <div style={styles.sectionTitle}>
          Счёт
        </div>

        <div style={styles.invoiceGrid}>

          <div>
            <label style={styles.inputLabel}>
              Цена с НДС, BYN
            </label>

            <input
              type="text"
              inputMode="decimal"
              value={invoiceInput}
              onChange={(e) =>
                setInvoiceInput(e.target.value)
              }
              style={styles.largeInput}
              placeholder="0,00"
            />
          </div>


          <div>
            <div style={styles.inputLabel}>
              Цена без НДС для Bitrix
            </div>

            <div style={styles.bitrixBox}>
              <div style={styles.bitrixValue}>
                {formatMoney(
                  invoiceWithoutVat
                )}
              </div>

              <div style={styles.bitrixCurrency}>
                BYN
              </div>

              <button
                type="button"
                onClick={copyInvoicePrice}
                disabled={!invoiceWithoutVat}
                style={{
                  ...styles.copyButton,
                  opacity:
                    invoiceWithoutVat
                      ? 1
                      : 0.5,
                }}
              >
                {copied
                  ? "Скопировано ✓"
                  : "Скопировать"}
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}


/* =========================================================
   КАРТОЧКА РАСЧЁТА
========================================================= */

function CalculatorCard({
  title,
  inputLabel,
  inputValue,
  onInputChange,
  suffix,
  rows,
  extra,
}) {
  return (
    <section style={styles.card}>
      <div style={styles.sectionTitle}>
        {title}
      </div>

      <div style={styles.inputArea}>
        <div style={{ flex: 1 }}>
          <label style={styles.inputLabel}>
            {inputLabel}
          </label>

          <div style={styles.inputWithSuffix}>
            <input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) =>
                onInputChange(e.target.value)
              }
              style={styles.largeInput}
              placeholder="0,00"
            />

            {suffix ? (
              <div style={styles.inputSuffix}>
                {suffix}
              </div>
            ) : null}
          </div>
        </div>

        {extra ? (
          <div style={styles.extraBlock}>
            <div style={styles.inputLabel}>
              Цена в российских рублях
            </div>

            {extra}
          </div>
        ) : null}
      </div>


      <div style={styles.resultTable}>

        <div style={styles.tableHeaderRow}>
          <div style={styles.tableHeaderLabel} />

          <div style={styles.withVatHeader}>
            Цена с НДС
          </div>

          <div style={styles.withoutVatHeader}>
            Цена без НДС
          </div>
        </div>


        {rows.map((row, index) => (
          <div
            key={`${title}-${row.label}-${index}`}
            style={styles.tableRow}
          >
            <div style={styles.rowLabel}>
              {row.label}
            </div>

            <div style={styles.withVatCell}>
              {formatMoney(row.withVat)}
            </div>

            <div style={styles.withoutVatCell}>
              {formatMoney(row.withoutVat)}
            </div>
          </div>
        ))}

      </div>
    </section>
  );
}


/* =========================================================
   СТИЛИ
========================================================= */

const styles = {
  page: {
    width: "100%",
    maxWidth: 1000,
    paddingBottom: 60,
  },

  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    lineHeight: 1.2,
    margin: 0,
    fontWeight: 800,
    color: "#111",
  },

  subtitle: {
    fontSize: 14,
    color: "#777",
    marginTop: 6,
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e2e2",
    borderRadius: 16,
    padding: 22,
    marginBottom: 18,
    boxSizing: "border-box",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 750,
    marginBottom: 20,
    color: "#111",
  },

  ratesGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },

  rateBox: {
    padding: 18,
    border: "1px solid #e4e4e4",
    borderRadius: 12,
    background: "#fafafa",
  },

  inputLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#666",
    marginBottom: 8,
  },

  rateValue: {
    fontSize: 30,
    fontWeight: 800,
    color: "#111",
    lineHeight: 1.2,
  },

  rateInput: {
    width: "100%",
    height: 48,
    padding: "0 14px",
    border: "1px solid #d5d5d5",
    borderRadius: 10,
    fontSize: 20,
    fontWeight: 700,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },

  rateMeta: {
    minHeight: 20,
    marginTop: 8,
    marginBottom: 14,
    fontSize: 12,
    color: "#888",
  },

  primaryButton: {
    border: "none",
    borderRadius: 9,
    background: "#111",
    color: "#fff",
    padding: "9px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },

  secondaryButton: {
    border: "1px solid #d5d5d5",
    borderRadius: 9,
    background: "#fff",
    color: "#222",
    padding: "9px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },

  inputArea: {
    display: "flex",
    alignItems: "flex-end",
    gap: 20,
    marginBottom: 22,
    flexWrap: "wrap",
  },

  inputWithSuffix: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  largeInput: {
    width: "100%",
    minWidth: 180,
    height: 52,
    border: "1px solid #d6d6d6",
    borderRadius: 10,
    padding: "0 15px",
    boxSizing: "border-box",
    fontSize: 22,
    fontWeight: 700,
    outline: "none",
    background: "#fff",
  },

  inputSuffix: {
    minWidth: 50,
    fontSize: 14,
    fontWeight: 700,
    color: "#666",
  },

  extraBlock: {
    minWidth: 220,
  },

  conversionInfo: {
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    padding: "0 15px",
    borderRadius: 10,
    background: "#f5f5f5",
    border: "1px solid #e3e3e3",
    fontSize: 20,
    fontWeight: 700,
    boxSizing: "border-box",
  },

  resultTable: {
    overflow: "hidden",
    border: "1px solid #dedede",
    borderRadius: 12,
  },

  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 1fr",
  },

  tableHeaderLabel: {
    background: "#f7f7f7",
    padding: 13,
  },

  withVatHeader: {
    padding: 13,
    textAlign: "center",
    background: "#dff3d3",
    fontSize: 13,
    fontWeight: 700,
    borderLeft: "1px solid #dedede",
  },

  withoutVatHeader: {
    padding: 13,
    textAlign: "center",
    background: "#d5f0fa",
    fontSize: 13,
    fontWeight: 700,
    borderLeft: "1px solid #dedede",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 1fr",
    borderTop: "1px solid #dedede",
  },

  rowLabel: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    background: "#fafafa",
  },

  withVatCell: {
    padding: "14px 16px",
    textAlign: "right",
    fontSize: 17,
    fontWeight: 750,
    background: "#f3faef",
    borderLeft: "1px solid #dedede",
  },

  withoutVatCell: {
    padding: "14px 16px",
    textAlign: "right",
    fontSize: 17,
    fontWeight: 750,
    background: "#eef9fd",
    borderLeft: "1px solid #dedede",
  },

  invoiceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
    alignItems: "end",
  },

  bitrixBox: {
    minHeight: 52,
    border: "1px solid #cfe7c5",
    borderRadius: 10,
    background: "#f2faee",
    padding: "8px 10px 8px 15px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  bitrixValue: {
    fontSize: 24,
    fontWeight: 800,
    flex: 1,
  },

  bitrixCurrency: {
    fontSize: 13,
    fontWeight: 700,
    color: "#777",
  },

  copyButton: {
    border: "1px solid #c9c9c9",
    background: "#fff",
    borderRadius: 8,
    padding: "8px 11px",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
};
