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
  /* Курс USD → RUB */
  const [usdRubRate, setUsdRubRate] = useState(null);
  const [usdRubDate, setUsdRubDate] = useState("");
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState("");

  /* Курс RUB → BYN */
  const [rubBynInput, setRubBynInput] = useState("0,0365");

  /* Ввод цен */
  const [usdPriceInput, setUsdPriceInput] = useState("");
  const [rubPriceInput, setRubPriceInput] = useState("");
  const [zeroPriceInput, setZeroPriceInput] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");

  /* Скопировано */
  const [copied, setCopied] = useState(false);

  /* =========================================================
     ЗАГРУЖАЕМ СОХРАНЕННЫЙ RUB → BYN
  ========================================================= */

  useEffect(() => {
    const savedRate = localStorage.getItem(
      "calculator_rub_byn_rate"
    );

    if (savedRate) {
      setRubBynInput(savedRate);
    }
  }, []);

  /* =========================================================
     КУРС USD → RUB
  ========================================================= */

  async function loadUsdRubRate() {
    try {
      setRateLoading(true);
      setRateError("");

      const response = await fetch(
        "/api/admin/cbr-rate",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Не удалось получить курс ЦБ РФ"
        );
      }

      const data = await response.json();

      if (!data?.rate) {
        throw new Error(
          "Курс USD не получен"
        );
      }

      setUsdRubRate(Number(data.rate));
      setUsdRubDate(data.date || "");
    } catch (error) {
      console.error(error);

      setRateError(
        "Не удалось получить курс"
      );
    } finally {
      setRateLoading(false);
    }
  }

  useEffect(() => {
    loadUsdRubRate();
  }, []);

  /* =========================================================
     ПАРСИНГ ЗНАЧЕНИЙ
  ========================================================= */

  const rubBynRate = parseNumber(rubBynInput);
  const usdPrice = parseNumber(usdPriceInput);
  const rubPrice = parseNumber(rubPriceInput);
  const zeroPrice = parseNumber(zeroPriceInput);
  const invoicePrice = parseNumber(invoiceInput);

  /* =========================================================
     USD
  ========================================================= */

  const usdCalculation = useMemo(() => {
    if (
      !usdRubRate ||
      !rubBynRate ||
      !usdPrice
    ) {
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

    const rubWithoutVat =
      usdPrice * usdRubRate;

    const baseWithVat =
      usdPrice *
      usdRubRate *
      rubBynRate *
      VAT;

    const baseWithoutVat =
      baseWithVat / VAT;

    /*
      Строка 0% — как в Excel
    */
    const zeroWithVat =
      usdPrice *
      usdRubRate *
      rubBynRate *
      VAT;

    const zeroWithoutVat =
      zeroWithVat / 1.22;

    /*
      +3%
    */
    const threeWithVat =
      baseWithoutVat *
      1.03 *
      VAT;

    const threeWithoutVat =
      threeWithVat / VAT;

    /*
      +6%
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
  }, [
    usdPrice,
    usdRubRate,
    rubBynRate,
  ]);

  /* =========================================================
     RUB
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

    const baseWithVat =
      rubPrice *
      rubBynRate *
      VAT;

    const baseWithoutVat =
      baseWithVat / VAT;

    /*
      10% — формула из Excel
    */
    const tenWithVat =
      (baseWithoutVat / 1.089) *
      VAT;

    const tenWithoutVat =
      tenWithVat / 1.22;

    /*
      13% — формула из Excel
    */
    const thirteenWithVat =
      (baseWithoutVat / 1.06) *
      VAT;

    const thirteenWithoutVat =
      thirteenWithVat / 1.22;

    /*
      23% — формула из Excel
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
  }, [
    rubPrice,
    rubBynRate,
  ]);

  /* =========================================================
     ЦЕНА В 0
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

    const baseWithoutVat =
      zeroPrice *
      rubBynRate;

    const baseWithVat =
      baseWithoutVat *
      VAT;

    const tenWithoutVat =
      baseWithoutVat *
      1.1;

    const tenWithVat =
      tenWithoutVat *
      VAT;

    const thirteenWithoutVat =
      baseWithoutVat *
      1.13;

    const thirteenWithVat =
      thirteenWithoutVat *
      VAT;

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
  }, [
    zeroPrice,
    rubBynRate,
  ]);

  /* =========================================================
     СЧЕТ / BITRIX
  ========================================================= */

  const invoiceWithoutVat =
    invoicePrice > 0
      ? invoicePrice / VAT
      : 0;

  /* =========================================================
     СОХРАНИТЬ КУРС
  ========================================================= */

  function saveRubBynRate() {
    localStorage.setItem(
      "calculator_rub_byn_rate",
      rubBynInput
    );

    alert(
      "Курс RUB → BYN сохранён"
    );
  }

  /* =========================================================
     КОПИРОВАТЬ ДЛЯ BITRIX
  ========================================================= */

  async function copyInvoicePrice() {
    if (!invoiceWithoutVat) return;

    const value = invoiceWithoutVat
      .toFixed(2)
      .replace(".", ",");

    try {
      await navigator.clipboard.writeText(
        value
      );

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
      {/* HEADER */}

      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>
            Калькулятор
          </h1>

          <div style={styles.subtitle}>
            Расчёт закупочной и конечной
            стоимости
          </div>
        </div>
      </div>

      {/* =====================================================
          КУРСЫ
      ===================================================== */}

      <section
        style={{
          ...styles.card,
          marginBottom: 12,
        }}
      >
        <div style={styles.sectionTitle}>
          Курсы валют
        </div>

        <div style={styles.ratesGrid}>
          {/* USD → RUB */}

          <div style={styles.rateBox}>
            <div style={styles.inputLabel}>
              USD → RUB
            </div>

            <div style={styles.rateRow}>
              <div style={styles.rateValue}>
                {rateLoading
                  ? "..."
                  : usdRubRate
                    ? formatRate(
                        usdRubRate,
                        4
                      )
                    : "—"}
              </div>

              <button
                type="button"
                onClick={
                  loadUsdRubRate
                }
                style={
                  styles.smallRefreshButton
                }
              >
                Обновить
              </button>
            </div>

            <div style={styles.rateMeta}>
              {rateError ? (
                <span
                  style={{
                    color: "#b42318",
                  }}
                >
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
          </div>

          {/* RUB → BYN */}

          <div style={styles.rateBox}>
            <label
              style={styles.inputLabel}
            >
              RUB → BYN
            </label>

            <div style={styles.rateEditRow}>
              <input
                type="text"
                inputMode="decimal"
                value={rubBynInput}
                onChange={(e) =>
                  setRubBynInput(
                    e.target.value
                  )
                }
                style={styles.rateInput}
                placeholder="0,0365"
              />

              <button
                type="button"
                onClick={
                  saveRubBynRate
                }
                style={
                  styles.primaryButton
                }
              >
                Сохранить
              </button>
            </div>

            <div style={styles.rateMeta}>
              Устанавливается вручную
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          СЕТКА 2 × 2
      ===================================================== */}

      <div
        className="calculator-grid"
        style={styles.calculatorsGrid}
      >
        {/* =================================================
            USD
        ================================================= */}

        <CalculatorCard
          title="Цена в USD"
          inputLabel="Цена поставщика"
          inputValue={usdPriceInput}
          onInputChange={
            setUsdPriceInput
          }
          suffix="USD"
          extra={
            usdPrice > 0 &&
            usdRubRate ? (
              <>
                <div
                  style={
                    styles.inputLabel
                  }
                >
                  Цена в RUB
                </div>

                <div
                  style={
                    styles.conversionInfo
                  }
                >
                  {formatMoney(
                    usdCalculation.rubWithoutVat
                  )}{" "}
                  RUB
                </div>
              </>
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

        {/* =================================================
            RUB
        ================================================= */}

        <CalculatorCard
          title="Цена в RUB"
          inputLabel="Цена поставщика"
          inputValue={rubPriceInput}
          onInputChange={
            setRubPriceInput
          }
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
              label: "Без НДС + 10%",
              withVat:
                rubCalculation.tenWithVat,
              withoutVat:
                rubCalculation.tenWithoutVat,
            },
            {
              label: "Без НДС +13%",
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

        {/* =================================================
            ЦЕНА В 0
        ================================================= */}

        <CalculatorCard
          title="Цена в 0"
          inputLabel="Исходная цена"
          inputValue={
            zeroPriceInput
          }
          onInputChange={
            setZeroPriceInput
          }
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

        {/* =================================================
            СЧЕТ
        ================================================= */}

        <section style={styles.card}>
          <div
            style={styles.sectionTitle}
          >
            Счёт
          </div>

          <div
            style={
              styles.invoiceCompact
            }
          >
            <div>
              <label
                style={
                  styles.inputLabel
                }
              >
                Цена с НДС, BYN
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={invoiceInput}
                onChange={(e) =>
                  setInvoiceInput(
                    e.target.value
                  )
                }
                style={
                  styles.largeInput
                }
                placeholder="0,00"
              />
            </div>

            <div>
              <div
                style={
                  styles.inputLabel
                }
              >
                Цена без НДС для
                Bitrix
              </div>

              <div
                style={
                  styles.bitrixBox
                }
              >
                <div
                  style={
                    styles.bitrixValue
                  }
                >
                  {formatMoney(
                    invoiceWithoutVat
                  )}
                </div>

                <div
                  style={
                    styles.bitrixCurrency
                  }
                >
                  BYN
                </div>

                <button
                  type="button"
                  onClick={
                    copyInvoicePrice
                  }
                  disabled={
                    !invoiceWithoutVat
                  }
                  style={{
                    ...styles.copyButton,
                    opacity:
                      invoiceWithoutVat
                        ? 1
                        : 0.45,
                  }}
                >
                  {copied
                    ? "Скопировано ✓"
                    : "Скопировать"}
                </button>
              </div>
            </div>

            <div
              style={
                styles.invoiceHint
              }
            >
              Вводишь итоговую цену
              счёта с НДС — справа
              получаешь цену без НДС
              для Bitrix.
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================
          АДАПТИВ
      ===================================================== */}

      <style jsx>{`
        @media (max-width: 1100px) {
          .calculator-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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
        <div style={{ minWidth: 0 }}>
          <label
            style={styles.inputLabel}
          >
            {inputLabel}
          </label>

          <div
            style={
              styles.inputWithSuffix
            }
          >
            <input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) =>
                onInputChange(
                  e.target.value
                )
              }
              style={
                styles.largeInput
              }
              placeholder="0,00"
            />

            {suffix ? (
              <div
                style={
                  styles.inputSuffix
                }
              >
                {suffix}
              </div>
            ) : null}
          </div>
        </div>

        {extra ? (
          <div
            style={styles.extraBlock}
          >
            {extra}
          </div>
        ) : null}
      </div>

      <div style={styles.resultTable}>
        <div
          style={
            styles.tableHeaderRow
          }
        >
          <div
            style={
              styles.tableHeaderLabel
            }
          />

          <div
            style={
              styles.withVatHeader
            }
          >
            С НДС
          </div>

          <div
            style={
              styles.withoutVatHeader
            }
          >
            Без НДС
          </div>
        </div>

        {rows.map((row, index) => {
  const isBase = row.label === "Базовая";

  return (
    <div
      key={`${title}-${row.label}-${index}`}
      style={{
        ...styles.tableRow,
        ...(isBase ? styles.baseRow : {}),
      }}
    >
      <div
        style={{
          ...styles.rowLabel,
          ...(isBase ? styles.baseRowLabel : {}),
        }}
      >
        {row.label}
      </div>

      <div
        style={{
          ...styles.withVatCell,
          ...(isBase ? styles.baseRowValue : {}),
        }}
      >
        {formatMoney(row.withVat)}
      </div>

      <div
        style={{
          ...styles.withoutVatCell,
          ...(isBase ? styles.baseRowValue : {}),
        }}
      >
        {formatMoney(row.withoutVat)}
      </div>
    </div>
  );
})}
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
    maxWidth: 1180,
    paddingBottom: 40,
  },

  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 14,
  },

  title: {
    fontSize: 27,
    lineHeight: 1.2,
    margin: 0,
    fontWeight: 800,
    color: "#111",
  },

  subtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },

  /* =========================
     ОБЩАЯ КАРТОЧКА
  ========================= */

  card: {
    background: "#fff",
    border:
      "1px solid #e2e2e2",
    borderRadius: 12,
    padding: 14,
    boxSizing: "border-box",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 750,
    marginBottom: 12,
    color: "#111",
  },

  /* =========================
     КУРСЫ
  ========================= */

  ratesGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  rateBox: {
    padding: 12,
    border:
      "1px solid #e4e4e4",
    borderRadius: 9,
    background: "#fafafa",
  },

  inputLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#666",
    marginBottom: 5,
  },

  rateRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  rateValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111",
    lineHeight: 1.15,
    flex: 1,
  },

  rateEditRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  rateInput: {
    width: "100%",
    height: 38,
    padding: "0 11px",
    border:
      "1px solid #d5d5d5",
    borderRadius: 7,
    fontSize: 16,
    fontWeight: 700,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },

  rateMeta: {
    minHeight: 15,
    marginTop: 5,
    fontSize: 10,
    color: "#888",
  },

  primaryButton: {
    height: 38,
    border: "none",
    borderRadius: 7,
    background: "#111",
    color: "#fff",
    padding: "0 13px",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  smallRefreshButton: {
    border:
      "1px solid #d5d5d5",
    borderRadius: 7,
    background: "#fff",
    color: "#222",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 600,
  },

  /* =========================
     СЕТКА КАЛЬКУЛЯТОРА
  ========================= */

  calculatorsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignItems: "stretch",
  },

  /* =========================
     INPUT
  ========================= */

  inputArea: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) minmax(0, 1fr)",
    alignItems: "end",
    gap: 9,
    marginBottom: 12,
  },

  inputWithSuffix: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },

  largeInput: {
    width: "100%",
    height: 38,
    border:
      "1px solid #d6d6d6",
    borderRadius: 7,
    padding: "0 11px",
    boxSizing: "border-box",
    fontSize: 16,
    fontWeight: 700,
    outline: "none",
    background: "#fff",
    minWidth: 0,
  },

  inputSuffix: {
    minWidth: 34,
    fontSize: 11,
    fontWeight: 700,
    color: "#666",
  },

  extraBlock: {
    minWidth: 0,
  },

  conversionInfo: {
    minHeight: 38,
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
    borderRadius: 7,
    background: "#f5f5f5",
    border:
      "1px solid #e3e3e3",
    fontSize: 15,
    fontWeight: 700,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  },

  /* =========================
     ТАБЛИЦА
  ========================= */

  resultTable: {
    overflow: "hidden",
    border:
      "1px solid #dedede",
    borderRadius: 9,
  },

  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns:
      "90px 1fr 1fr",
  },

  tableHeaderLabel: {
    background: "#f7f7f7",
    padding: 7,
  },

  withVatHeader: {
    padding: 7,
    textAlign: "center",
    background: "#dff3d3",
    fontSize: 11,
    fontWeight: 700,
    borderLeft:
      "1px solid #dedede",
  },

  withoutVatHeader: {
    padding: 7,
    textAlign: "center",
    background: "#d5f0fa",
    fontSize: 11,
    fontWeight: 700,
    borderLeft:
      "1px solid #dedede",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns:
      "90px 1fr 1fr",
    borderTop:
      "1px solid #dedede",
  },

  rowLabel: {
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    background: "#fafafa",
  },

  withVatCell: {
    padding: "8px 10px",
    textAlign: "right",
    fontSize: 14,
    fontWeight: 750,
    background: "#f3faef",
    borderLeft:
      "1px solid #dedede",
  },

  withoutVatCell: {
    padding: "8px 10px",
    textAlign: "right",
    fontSize: 14,
    fontWeight: 750,
    background: "#eef9fd",
    borderLeft:
      "1px solid #dedede",
  },

  /* =========================
     СЧЁТ / BITRIX
  ========================= */

  invoiceCompact: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  bitrixBox: {
    minHeight: 42,
    border:
      "1px solid #cfe7c5",
    borderRadius: 8,
    background: "#f2faee",
    padding: "5px 7px 5px 11px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  bitrixValue: {
    fontSize: 19,
    fontWeight: 800,
    flex: 1,
  },

  bitrixCurrency: {
    fontSize: 10,
    fontWeight: 700,
    color: "#777",
  },

  copyButton: {
    border:
      "1px solid #c9c9c9",
    background: "#fff",
    borderRadius: 6,
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: 10,
    whiteSpace: "nowrap",
  },

  invoiceHint: {
    fontSize: 10,
    lineHeight: 1.4,
    color: "#888",
  },
   baseRow: {
  background: "#fff7d6",
},

baseRowLabel: {
  background: "#fff2b8",
  color: "#7a5b00",
  fontWeight: 800,
},

baseRowValue: {
  background: "#fff8dc",
  color: "#5f4700",
  fontWeight: 800,
},
};
