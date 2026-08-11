"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   КУРС ПО УМОЛЧАНИЮ

   Такой же, как сейчас стоит в калькуляторе.
   Если курс был сохранён в калькуляторе,
   сюда автоматически подставится сохранённый.
========================================================= */

const DEFAULT_RUB_BYN_RATE = "0,0365";

/* =========================================================
   ПРАЙС DISTKONTROL

   Цена priceRub — колонка:
   "Цены для ООО Спасибо до 31.12.2026 г."

   recommendedRub — рекомендованная цена из Excel
   discount — скидка из Excel
========================================================= */

const PRODUCT_GROUPS = [
  {
    id: "usb-2",
    title: "DistKontrolUSB 2.0",
    description:
      "Устройства серии DistKontrolUSB",
    products: [
      {
        id: "distkontrolusb-16",
        name: "DistKontrolUSB-16",
        recommendedRub: 112100,
        discount: 30,
        priceRub: 78470,
        isOption: false,
      },
      {
        id: "distkontrolusb-32",
        name: "DistKontrolUSB-32",
        recommendedRub: 134000,
        discount: null,
        priceRub: 93800,
        isOption: false,
      },
      {
        id: "distkontrolusb-48",
        name: "DistKontrolUSB-48",
        recommendedRub: 166500,
        discount: null,
        priceRub: 116550,
        isOption: false,
      },
      {
        id: "distkontrolusb-64",
        name: "DistKontrolUSB-64",
        recommendedRub: 198500,
        discount: null,
        priceRub: 138950,
        isOption: false,
      },
    ],
  },

  {
    id: "usb-3",
    title: "DistKontrolUSB 3.0",
    description:
      "Устройства серии DistKontrolUSB 3.0",
    products: [
      {
        id: "distkontrolusb-4-3",
        name: "DistKontrolUSB-4 3.0",
        recommendedRub: 39600,
        discount: 10,
        priceRub: 35640,
        isOption: false,
      },
      {
        id: "distkontrolusb-8-3",
        name: "DistKontrolUSB-8 3.0",
        recommendedRub: 69500,
        discount: null,
        priceRub: 62550,
        isOption: false,
      },
      {
        id: "distkontrolusb-16-3",
        name: "DistKontrolUSB-16 3.0",
        recommendedRub: 192600,
        discount: 30,
        priceRub: 134820,
        isOption: false,
      },
      {
        id: "distkontrolusb-24-3",
        name: "DistKontrolUSB-24 3.0",
        recommendedRub: 195400,
        discount: null,
        priceRub: 136780,
        isOption: false,
      },
      {
        id: "distkontrolusb-32-3",
        name: "DistKontrolUSB-32 3.0",
        recommendedRub: 198700,
        discount: null,
        priceRub: 139090,
        isOption: false,
      },
    ],
  },

  {
    id: "pdu",
    title: "DistkontrolPDU",
    description:
      "Устройства распределения питания",
    products: [
      {
        id: "distkontrolpdu-8-1u",
        name: "DistkontrolPDU-8 (1U)",
        recommendedRub: 66500,
        discount: 30,
        priceRub: 46550,
        isOption: false,
      },
      {
        id: "distkontrolpdu-8-0u",
        name: "DistkontrolPDU-8(0U)",
        recommendedRub: 82600,
        discount: null,
        priceRub: 57820,
        isOption: false,
      },
      {
        id: "distkontrolpdu-16-0u",
        name: "DistkontrolPDU-16(0U)",
        recommendedRub: 123800,
        discount: null,
        priceRub: 86660,
        isOption: false,
      },
      {
        id: "distkontrolpdu-24-0u-1",
        name: "DistkontrolPDU-24 (0U, 1Ф)",
        recommendedRub: 191100,
        discount: null,
        priceRub: 133770,
        isOption: false,
      },
      {
        id: "distkontrolpdu-24-0u-3",
        name: "DistkontrolPDU-24 (0U, 3Ф)",
        recommendedRub: 198000,
        discount: null,
        priceRub: 138600,
        isOption: false,
      },
    ],
  },

  {
    id: "hub",
    title: "DistKontrolHUB",
    description:
      "Концентраторы DistKontrolHUB",
    products: [
      {
        id: "distkontrolhub-16",
        name: "DistKontrolHUB-16",
        recommendedRub: 112100,
        discount: 30,
        priceRub: 78470,
        isOption: false,
      },
      {
        id: "distkontrolhub-32",
        name: "DistKontrolHUB-32",
        recommendedRub: 134000,
        discount: null,
        priceRub: 93800,
        isOption: false,
      },
      {
        id: "distkontrolhub-48",
        name: "DistKontrolHUB-48",
        recommendedRub: 166500,
        discount: null,
        priceRub: 116550,
        isOption: false,
      },
      {
        id: "distkontrolhub-64",
        name: "DistKontrolHUB-64",
        recommendedRub: 198500,
        discount: null,
        priceRub: 138950,
        isOption: false,
      },
    ],
  },

  {
    id: "copy-2",
    title: "DistKontrolUSB Copy 2.0",
    description:
      "Устройства DistKontrolUSB Copy 2.0",
    products: [
      {
        id: "distkontrolusb-16-copy-2",
        name: "DistKontrolUSB-16 Copy 2.0",
        recommendedRub: 112100,
        discount: 30,
        priceRub: 78470,
        isOption: false,
      },
      {
        id: "distkontrolusb-32-copy-2",
        name: "DistKontrolUSB-32 Copy 2.0",
        recommendedRub: 134000,
        discount: null,
        priceRub: 93800,
        isOption: false,
      },
      {
        id: "distkontrolusb-48-copy-2",
        name: "DistKontrolUSB-48 Copy 2.0",
        recommendedRub: 166500,
        discount: null,
        priceRub: 116550,
        isOption: false,
      },
      {
        id: "distkontrolusb-64-copy-2",
        name: "DistKontrolUSB-64 Copy 2.0",
        recommendedRub: 198500,
        discount: null,
        priceRub: 138950,
        isOption: false,
      },
    ],
  },

  {
    id: "copy-3",
    title: "DistKontrolUSB Copy 3.0",
    description:
      "Устройства DistKontrolUSB Copy 3.0",
    products: [
      {
        id: "distkontrolusb-8-copy-3",
        name: "DistKontrolUSB-8 Copy 3.0",
        recommendedRub: 69500,
        discount: 10,
        priceRub: 62550,
        isOption: false,
      },
      {
        id: "distkontrolusb-16-copy-3",
        name: "DistKontrolUSB-16 Copy 3.0",
        recommendedRub: 192600,
        discount: 30,
        priceRub: 134820,
        isOption: false,
      },
      {
        id: "distkontrolusb-24-copy-3",
        name: "DistKontrolUSB-24 Copy 3.0",
        recommendedRub: 195400,
        discount: null,
        priceRub: 136780,
        isOption: false,
      },
      {
        id: "distkontrolusb-32-copy-3",
        name: "DistKontrolUSB-32 Copy 3.0",
        recommendedRub: 198700,
        discount: null,
        priceRub: 139090,
        isOption: false,
      },
    ],
  },

  {
    id: "options",
    title: "Дополнительные опции",
    description:
      "Дополнительное оборудование и модули",
    products: [
      {
        id: "option-ethernet-1g",
        name: "Доп. Ethernet порт 1 Gb",
        recommendedRub: 22600,
        discount: 10,
        priceRub: 20340,
        isOption: true,
      },
      {
        id: "option-ethernet-10g",
        name: "Доп. Ethernet порт 10 Gb",
        recommendedRub: 47600,
        discount: null,
        priceRub: 42840,
        isOption: true,
      },
      {
        id: "option-power",
        name: "Доп. блок питания",
        recommendedRub: 17100,
        discount: null,
        priceRub: 15390,
        isOption: true,
      },
      {
        id: "option-protection",
        name: "Защитный модуль",
        recommendedRub: 6700,
        discount: null,
        priceRub: 6030,
        isOption: true,
      },
      {
        id: "option-protection-lock",
        name: "Защитный модуль с замком",
        recommendedRub: 8100,
        discount: null,
        priceRub: 7290,
        isOption: true,
      },
    ],
  },
];

/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================================================= */

function parseNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return "0,00";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRub(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

/* =========================================================
   ГЛАВНАЯ СТРАНИЦА
========================================================= */

export default function DistKontrolPage() {
  const [rubBynInput, setRubBynInput] =
    useState(DEFAULT_RUB_BYN_RATE);

  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState([]);

  const [copied, setCopied] =
    useState(false);

  /* =========================================================
     ЗАГРУЖАЕМ КУРС ИЗ КАЛЬКУЛЯТОРА
  ========================================================= */

  function loadRateFromCalculator() {
    if (typeof window === "undefined") {
      return;
    }

    const savedRate =
      localStorage.getItem(
        "calculator_rub_byn_rate"
      );

    if (savedRate) {
      setRubBynInput(savedRate);
    } else {
      setRubBynInput(
        DEFAULT_RUB_BYN_RATE
      );
    }
  }

  useEffect(() => {
    loadRateFromCalculator();

    /*
      Если вернулись на вкладку DistKontrol
      после изменения курса в калькуляторе,
      курс перечитается.
    */

    function handleFocus() {
      loadRateFromCalculator();
    }

    function handleStorage(event) {
      if (
        event.key ===
        "calculator_rub_byn_rate"
      ) {
        loadRateFromCalculator();
      }
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  const rubBynRate =
    parseNumber(rubBynInput);

  /* =========================================================
     ФИЛЬТРАЦИЯ ПРАЙСА
  ========================================================= */

  const filteredGroups =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return PRODUCT_GROUPS;
      }

      return PRODUCT_GROUPS
        .map((group) => {
          const products =
            group.products.filter(
              (product) =>
                product.name
                  .toLowerCase()
                  .includes(query)
            );

          return {
            ...group,
            products,
          };
        })
        .filter(
          (group) =>
            group.products.length > 0
        );
    }, [search]);

  /* =========================================================
     ВЫБРАННЫЕ ПОЗИЦИИ
  ========================================================= */

  function addProduct(product) {
    setSelected((current) => {
      const existing =
        current.find(
          (item) =>
            item.id === product.id
        );

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                qty: item.qty + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          qty: 1,
        },
      ];
    });
  }

  function increaseQty(id) {
    setSelected((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: item.qty + 1,
            }
          : item
      )
    );
  }

  function decreaseQty(id) {
    setSelected((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                qty: item.qty - 1,
              }
            : item
        )
        .filter(
          (item) => item.qty > 0
        )
    );
  }

  function changeQty(id, value) {
    const parsed =
      parseInt(value, 10);

    if (
      !Number.isFinite(parsed) ||
      parsed < 1
    ) {
      return;
    }

    setSelected((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: parsed,
            }
          : item
      )
    );
  }

  function removeProduct(id) {
    setSelected((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }

  function clearConfiguration() {
    setSelected([]);
  }

  /* =========================================================
     ИТОГИ
  ========================================================= */

  const totals = useMemo(() => {
    let rub = 0;
    let byn = 0;
    let qty = 0;

    selected.forEach((item) => {
      const lineRub =
        item.priceRub * item.qty;

      rub += lineRub;

      byn +=
        lineRub * rubBynRate;

      qty += item.qty;
    });

    return {
      rub,
      byn,
      qty,
    };
  }, [
    selected,
    rubBynRate,
  ]);

  /* =========================================================
     КОПИРОВАНИЕ СПЕЦИФИКАЦИИ
  ========================================================= */

  async function copyConfiguration() {
    if (!selected.length) {
      return;
    }

    const lines = selected.map(
      (item, index) => {
        const lineRub =
          item.priceRub * item.qty;

        const lineByn =
          lineRub * rubBynRate;

        return (
          `${index + 1}. ${item.name}\n` +
          `   ${item.qty} шт. × ${formatRub(
            item.priceRub
          )} RUB = ${formatRub(
            lineRub
          )} RUB / ${formatMoney(
            lineByn
          )} BYN`
        );
      }
    );

    const text = [
      "DistKontrol — выбранная конфигурация",
      "",
      ...lines,
      "",
      `Итого позиций: ${totals.qty} шт.`,
      `Итого RUB: ${formatRub(
        totals.rub
      )} RUB`,
      `Итого BYN: ${formatMoney(
        totals.byn
      )} BYN`,
      `Курс RUB → BYN: ${formatRate(
        rubBynRate
      )}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      console.error(
        "Ошибка копирования:",
        error
      );
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
            DistKontrol
          </h1>

          <div style={styles.subtitle}>
            Прайс и конфигуратор оборудования
          </div>
        </div>
      </div>

      {/* =====================================================
          ПАНЕЛЬ КУРСА + ПОИСК
      ===================================================== */}

      <section style={styles.topCard}>
        <div style={styles.topGrid}>
          {/* КУРС */}

          <div style={styles.rateBlock}>
            <div>
              <div style={styles.smallLabel}>
                Курс RUB → BYN
              </div>

              <div style={styles.rateValue}>
                {formatRate(
                  rubBynRate
                )}
              </div>

              <div style={styles.rateHint}>
                Берётся из калькулятора
              </div>
            </div>

            <div style={styles.rateActions}>
              <button
                type="button"
                onClick={
                  loadRateFromCalculator
                }
                style={
                  styles.secondaryButton
                }
              >
                Обновить курс
              </button>

              <Link
                href="/admin/calculator"
                style={
                  styles.calculatorLink
                }
              >
                Открыть калькулятор
              </Link>
            </div>
          </div>

          {/* ПОИСК */}

          <div>
            <label
              style={
                styles.searchLabel
              }
            >
              Поиск по модели
            </label>

            <div
              style={
                styles.searchWrapper
              }
            >
              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Например: HUB-16, USB-32, Ethernet..."
                style={
                  styles.searchInput
                }
              />

              {search ? (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  style={
                    styles.clearSearchButton
                  }
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div style={styles.formulaNote}>
          Цена BYN = цена для ООО
          «Спасибо» в RUB × курс RUB → BYN
        </div>
      </section>

      {/* =====================================================
          ОСНОВНАЯ СЕТКА
      ===================================================== */}

      <div
        className="distkontrol-layout"
        style={styles.mainGrid}
      >
        {/* ===================================================
            ПРАЙС
        =================================================== */}

        <div>
          {filteredGroups.length ? (
            filteredGroups.map(
              (group) => (
                <PriceGroup
                  key={group.id}
                  group={group}
                  rubBynRate={
                    rubBynRate
                  }
                  selected={
                    selected
                  }
                  onAdd={
                    addProduct
                  }
                />
              )
            )
          ) : (
            <section
              style={
                styles.emptySearch
              }
            >
              <div
                style={
                  styles.emptySearchTitle
                }
              >
                Ничего не найдено
              </div>

              <div
                style={
                  styles.emptySearchText
                }
              >
                Попробуй изменить
                поисковый запрос.
              </div>
            </section>
          )}
        </div>

        {/* ===================================================
            КОНФИГУРАЦИЯ
        =================================================== */}

        <div
          className="configuration-column"
          style={
            styles.configurationColumn
          }
        >
          <section
            style={
              styles.configurationCard
            }
          >
            <div
              style={
                styles.configurationHeader
              }
            >
              <div>
                <div
                  style={
                    styles.configurationTitle
                  }
                >
                  Выбранная конфигурация
                </div>

                <div
                  style={
                    styles.configurationSubtitle
                  }
                >
                  {selected.length
                    ? `${selected.length} поз. · ${totals.qty} шт.`
                    : "Позиции ещё не выбраны"}
                </div>
              </div>

              {selected.length ? (
                <button
                  type="button"
                  onClick={
                    clearConfiguration
                  }
                  style={
                    styles.clearButton
                  }
                >
                  Очистить
                </button>
              ) : null}
            </div>

            {!selected.length ? (
              <div
                style={
                  styles.emptyCart
                }
              >
                <div
                  style={
                    styles.emptyCartIcon
                  }
                >
                  +
                </div>

                <div
                  style={
                    styles.emptyCartTitle
                  }
                >
                  Добавь оборудование
                </div>

                <div
                  style={
                    styles.emptyCartText
                  }
                >
                  Выбирай устройство,
                  концентратор и
                  дополнительные опции из
                  прайса слева.
                </div>
              </div>
            ) : (
              <>
                <div
                  style={
                    styles.selectedList
                  }
                >
                  {selected.map(
                    (item) => {
                      const lineRub =
                        item.priceRub *
                        item.qty;

                      const lineByn =
                        lineRub *
                        rubBynRate;

                      return (
                        <div
                          key={
                            item.id
                          }
                          style={
                            styles.selectedItem
                          }
                        >
                          <div
                            style={
                              styles.selectedItemTop
                            }
                          >
                            <div
                              style={{
                                minWidth:
                                  0,
                              }}
                            >
                              <div
                                style={
                                  styles.selectedItemName
                                }
                              >
                                {
                                  item.name
                                }
                              </div>

                              <div
                                style={
                                  styles.selectedItemType
                                }
                              >
                                {item.isOption
                                  ? "Дополнительная опция"
                                  : "Оборудование"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeProduct(
                                  item.id
                                )
                              }
                              title="Удалить"
                              style={
                                styles.removeButton
                              }
                            >
                              ×
                            </button>
                          </div>

                          <div
                            style={
                              styles.selectedPrice
                            }
                          >
                            <span>
                              {formatRub(
                                item.priceRub
                              )}{" "}
                              RUB
                            </span>

                            <span
                              style={
                                styles.selectedPriceByn
                              }
                            >
                              {formatMoney(
                                item.priceRub *
                                  rubBynRate
                              )}{" "}
                              BYN / шт.
                            </span>
                          </div>

                          <div
                            style={
                              styles.qtyAndTotal
                            }
                          >
                            <div
                              style={
                                styles.qtyControl
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  decreaseQty(
                                    item.id
                                  )
                                }
                                style={
                                  styles.qtyButton
                                }
                              >
                                −
                              </button>

                              <input
                                type="number"
                                min="1"
                                value={
                                  item.qty
                                }
                                onChange={(
                                  e
                                ) =>
                                  changeQty(
                                    item.id,
                                    e
                                      .target
                                      .value
                                  )
                                }
                                style={
                                  styles.qtyInput
                                }
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  increaseQty(
                                    item.id
                                  )
                                }
                                style={
                                  styles.qtyButton
                                }
                              >
                                +
                              </button>
                            </div>

                            <div
                              style={
                                styles.lineTotal
                              }
                            >
                              <div
                                style={
                                  styles.lineTotalRub
                                }
                              >
                                {formatRub(
                                  lineRub
                                )}{" "}
                                RUB
                              </div>

                              <div
                                style={
                                  styles.lineTotalByn
                                }
                              >
                                {formatMoney(
                                  lineByn
                                )}{" "}
                                BYN
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {/* ИТОГО */}

                <div
                  style={
                    styles.totalBlock
                  }
                >
                  <div
                    style={
                      styles.totalSmallRow
                    }
                  >
                    <span>
                      Всего товаров
                    </span>

                    <strong>
                      {totals.qty} шт.
                    </strong>
                  </div>

                  <div
                    style={
                      styles.totalSmallRow
                    }
                  >
                    <span>
                      Итого RUB
                    </span>

                    <strong>
                      {formatRub(
                        totals.rub
                      )}{" "}
                      ₽
                    </strong>
                  </div>

                  <div
                    style={
                      styles.totalMain
                    }
                  >
                    <div
                      style={
                        styles.totalMainLabel
                      }
                    >
                      Итого BYN
                    </div>

                    <div
                      style={
                        styles.totalMainValue
                      }
                    >
                      {formatMoney(
                        totals.byn
                      )}
                    </div>

                    <div
                      style={
                        styles.totalCurrency
                      }
                    >
                      BYN
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      copyConfiguration
                    }
                    style={
                      styles.copyConfigurationButton
                    }
                  >
                    {copied
                      ? "Скопировано ✓"
                      : "Скопировать спецификацию"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* =====================================================
          АДАПТИВ
      ===================================================== */}

      <style jsx>{`
        @media (max-width: 1250px) {
          .distkontrol-layout {
            grid-template-columns: 1fr !important;
          }

          .configuration-column {
            position: static !important;
          }
        }

        @media (max-width: 900px) {
          .price-header,
          .price-row {
            grid-template-columns:
              minmax(180px, 1fr)
              110px
              100px !important;
          }

          .hide-mobile {
            display: none !important;
          }
        }

        @media (max-width: 650px) {
          .price-header {
            display: none !important;
          }

          .price-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .mobile-price-cell {
            text-align: left !important;
            border-left: none !important;
            padding-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   ГРУППА ПРАЙСА
========================================================= */

function PriceGroup({
  group,
  rubBynRate,
  selected,
  onAdd,
}) {
  return (
    <section style={styles.groupCard}>
      <div style={styles.groupHeader}>
        <div>
          <div style={styles.groupTitle}>
            {group.title}
          </div>

          <div
            style={styles.groupDescription}
          >
            {group.description}
          </div>
        </div>

        <div style={styles.groupCount}>
          {group.products.length} поз.
        </div>
      </div>

      {/* HEADER */}

      <div
        className="price-header"
        style={styles.priceHeader}
      >
        <div>Наименование</div>

        <div
          className="hide-mobile"
          style={{ textAlign: "right" }}
        >
          Рекоменд.
        </div>

        <div
          className="hide-mobile"
          style={{ textAlign: "center" }}
        >
          Скидка
        </div>

        <div style={{ textAlign: "right" }}>
          Цена RUB
        </div>

        <div style={{ textAlign: "right" }}>
          Цена BYN
        </div>

        <div />
      </div>

      {/* ROWS */}

      <div>
        {group.products.map(
          (product) => {
            const priceByn =
              product.priceRub *
              rubBynRate;

            const selectedItem =
              selected.find(
                (item) =>
                  item.id ===
                  product.id
              );

            return (
              <div
                key={product.id}
                className="price-row"
                style={{
                  ...styles.priceRow,
                  ...(product.isOption
                    ? styles.optionRow
                    : {}),
                }}
              >
                {/* NAME */}

                <div>
                  <div
                    style={
                      styles.productName
                    }
                  >
                    {product.name}
                  </div>

                  {product.isOption ? (
                    <div
                      style={
                        styles.optionBadge
                      }
                    >
                      Доп. опция
                    </div>
                  ) : null}
                </div>

                {/* RECOMMENDED */}

                <div
                  className="hide-mobile"
                  style={
                    styles.recommendedCell
                  }
                >
                  {formatRub(
                    product.recommendedRub
                  )}
                </div>

                {/* DISCOUNT */}

                <div
                  className="hide-mobile"
                  style={
                    styles.discountCell
                  }
                >
                  {product.discount !==
                  null
                    ? `${product.discount}%`
                    : "—"}
                </div>

                {/* RUB */}

                <div
                  className="mobile-price-cell"
                  style={
                    styles.rubPriceCell
                  }
                >
                  <span
                    style={
                      styles.mobileLabel
                    }
                  >
                    RUB
                  </span>

                  {formatRub(
                    product.priceRub
                  )}
                </div>

                {/* BYN */}

                <div
                  className="mobile-price-cell"
                  style={
                    styles.bynPriceCell
                  }
                >
                  <span
                    style={
                      styles.mobileLabel
                    }
                  >
                    BYN
                  </span>

                  {formatMoney(
                    priceByn
                  )}
                </div>

                {/* ADD */}

                <div
                  style={
                    styles.addCell
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      onAdd(product)
                    }
                    style={{
                      ...styles.addButton,
                      ...(selectedItem
                        ? styles.addButtonSelected
                        : {}),
                    }}
                  >
                    {selectedItem
                      ? `Добавлено: ${selectedItem.qty}`
                      : "+ Добавить"}
                  </button>
                </div>
              </div>
            );
          }
        )}
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
    maxWidth: 1500,
    paddingBottom: 50,
  },

  /* HEADER */

  pageHeader: {
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

  /* TOP */

  topCard: {
    background: "#fff",
    border: "1px solid #e2e2e2",
    borderRadius: 12,
    padding: 14,
    boxSizing: "border-box",
    marginBottom: 14,
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(300px, 0.75fr) minmax(300px, 1.25fr)",
    gap: 14,
    alignItems: "end",
  },

  rateBlock: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 9,
    border: "1px solid #e4e4e4",
    background: "#fafafa",
  },

  smallLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#777",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 4,
  },

  rateValue: {
    fontSize: 23,
    lineHeight: 1.1,
    fontWeight: 800,
    color: "#111",
  },

  rateHint: {
    fontSize: 10,
    color: "#888",
    marginTop: 4,
  },

  rateActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  secondaryButton: {
    height: 34,
    borderRadius: 7,
    border: "1px solid #d5d5d5",
    background: "#fff",
    color: "#222",
    padding: "0 10px",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },

  calculatorLink: {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 7,
    background: "#111",
    color: "#fff",
    padding: "0 10px",
    textDecoration: "none",
    boxSizing: "border-box",
    fontSize: 10,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },

  searchLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 650,
    color: "#666",
    marginBottom: 5,
  },

  searchWrapper: {
    position: "relative",
  },

  searchInput: {
    width: "100%",
    height: 43,
    border: "1px solid #d6d6d6",
    borderRadius: 8,
    padding: "0 42px 0 12px",
    boxSizing: "border-box",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },

  clearSearchButton: {
    position: "absolute",
    top: "50%",
    right: 8,
    transform: "translateY(-50%)",
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 6,
    background: "#f0f0f0",
    color: "#555",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
  },

  formulaNote: {
    marginTop: 10,
    paddingTop: 9,
    borderTop: "1px solid #ececec",
    fontSize: 10,
    color: "#888",
  },

  /* MAIN */

  mainGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) 350px",
    alignItems: "start",
    gap: 14,
  },

  /* GROUP */

  groupCard: {
    background: "#fff",
    border: "1px solid #e2e2e2",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },

  groupHeader: {
    minHeight: 58,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "#fafafa",
    borderBottom: "1px solid #e7e7e7",
  },

  groupTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111",
  },

  groupDescription: {
    marginTop: 2,
    fontSize: 10,
    color: "#888",
  },

  groupCount: {
    padding: "5px 8px",
    borderRadius: 20,
    background: "#ededed",
    color: "#555",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  /* PRICE TABLE */

  priceHeader: {
    display: "grid",
    gridTemplateColumns:
      "minmax(210px, 1.65fr) 110px 70px 110px 110px 105px",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    padding: "0 12px",
    boxSizing: "border-box",
    background: "#f5f5f5",
    borderBottom: "1px solid #e3e3e3",
    fontSize: 9,
    fontWeight: 750,
    color: "#777",
    textTransform: "uppercase",
  },

  priceRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(210px, 1.65fr) 110px 70px 110px 110px 105px",
    alignItems: "center",
    gap: 8,
    minHeight: 59,
    padding: "8px 12px",
    boxSizing: "border-box",
    borderBottom: "1px solid #ededed",
  },

  optionRow: {
    background: "#fbfcff",
  },

  productName: {
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 700,
    color: "#161616",
    wordBreak: "break-word",
  },

  optionBadge: {
    display: "inline-block",
    marginTop: 4,
    borderRadius: 4,
    padding: "2px 5px",
    background: "#eef3ff",
    color: "#415f9f",
    fontSize: 8,
    fontWeight: 700,
  },

  recommendedCell: {
    textAlign: "right",
    fontSize: 11,
    color: "#8a8a8a",
    textDecoration: "line-through",
  },

  discountCell: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    color: "#777",
  },

  rubPriceCell: {
    textAlign: "right",
    fontSize: 12,
    fontWeight: 800,
    color: "#333",
  },

  bynPriceCell: {
    textAlign: "right",
    fontSize: 13,
    fontWeight: 800,
    color: "#111",
  },

  mobileLabel: {
    display: "none",
  },

  addCell: {
    display: "flex",
    justifyContent: "flex-end",
  },

  addButton: {
    minWidth: 92,
    height: 32,
    border: "1px solid #d1d1d1",
    borderRadius: 7,
    background: "#fff",
    color: "#222",
    padding: "0 9px",
    cursor: "pointer",
    fontSize: 9,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  addButtonSelected: {
    border: "1px solid #cbdac3",
    background: "#f2f8ef",
    color: "#46643d",
  },

  /* CONFIG */

  configurationColumn: {
    position: "sticky",
    top: 18,
  },

  configurationCard: {
    background: "#fff",
    border: "1px solid #dddddd",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow:
      "0 6px 22px rgba(0,0,0,0.04)",
  },

  configurationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderBottom: "1px solid #e7e7e7",
  },

  configurationTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111",
  },

  configurationSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#888",
  },

  clearButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    color: "#999",
    fontSize: 9,
    cursor: "pointer",
    textDecoration: "underline",
  },

  /* EMPTY CART */

  emptyCart: {
    padding: "45px 25px",
    textAlign: "center",
  },

  emptyCartIcon: {
    width: 42,
    height: 42,
    margin: "0 auto 10px",
    borderRadius: "50%",
    background: "#f1f1f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    color: "#888",
  },

  emptyCartTitle: {
    fontSize: 13,
    fontWeight: 750,
    color: "#333",
  },

  emptyCartText: {
    maxWidth: 230,
    margin: "5px auto 0",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#999",
  },

  /* SELECTED */

  selectedList: {
    maxHeight: "calc(100vh - 390px)",
    minHeight: 90,
    overflowY: "auto",
  },

  selectedItem: {
    padding: "11px 12px",
    borderBottom: "1px solid #eeeeee",
  },

  selectedItemTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 7,
  },

  selectedItemName: {
    fontSize: 11,
    fontWeight: 750,
    lineHeight: 1.35,
    color: "#222",
    wordBreak: "break-word",
  },

  selectedItemType: {
    marginTop: 2,
    fontSize: 8,
    color: "#999",
  },

  removeButton: {
    flex: "0 0 auto",
    width: 23,
    height: 23,
    border: "none",
    borderRadius: 5,
    background: "#f3f3f3",
    color: "#777",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
  },

  selectedPrice: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
    fontSize: 9,
    color: "#777",
  },

  selectedPriceByn: {
    fontWeight: 700,
    color: "#555",
    textAlign: "right",
  },

  qtyAndTotal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },

  qtyControl: {
    display: "flex",
    alignItems: "center",
    height: 30,
    border: "1px solid #d8d8d8",
    borderRadius: 7,
    overflow: "hidden",
  },

  qtyButton: {
    width: 28,
    height: 28,
    border: "none",
    background: "#f7f7f7",
    color: "#333",
    cursor: "pointer",
    fontSize: 15,
  },

  qtyInput: {
    width: 37,
    height: 28,
    border: "none",
    borderLeft: "1px solid #e0e0e0",
    borderRight: "1px solid #e0e0e0",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    outline: "none",
    boxSizing: "border-box",
  },

  lineTotal: {
    textAlign: "right",
  },

  lineTotalRub: {
    fontSize: 9,
    color: "#888",
  },

  lineTotalByn: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: 800,
    color: "#222",
  },

  /* TOTAL */

  totalBlock: {
    padding: 13,
    background: "#fafafa",
  },

  totalSmallRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
    fontSize: 9,
    color: "#777",
  },

  totalMain: {
    display: "grid",
    gridTemplateColumns:
      "1fr auto auto",
    gap: 5,
    alignItems: "baseline",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid #dedede",
  },

  totalMainLabel: {
    fontSize: 11,
    fontWeight: 750,
    color: "#333",
  },

  totalMainValue: {
    fontSize: 23,
    lineHeight: 1.1,
    fontWeight: 850,
    color: "#111",
  },

  totalCurrency: {
    fontSize: 9,
    fontWeight: 750,
    color: "#777",
  },

  copyConfigurationButton: {
    width: "100%",
    height: 38,
    marginTop: 12,
    border: "none",
    borderRadius: 8,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 700,
  },

  /* SEARCH EMPTY */

  emptySearch: {
    padding: 45,
    textAlign: "center",
    border: "1px solid #e2e2e2",
    borderRadius: 12,
    background: "#fff",
  },

  emptySearchTitle: {
    fontSize: 15,
    fontWeight: 750,
    color: "#333",
  },

  emptySearchText: {
    marginTop: 4,
    fontSize: 11,
    color: "#999",
  },
};
