"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";

const LARGE_FILE_LIMIT_MB = 8;
const BIG_UPLOAD_CHUNK = 500;

export default function AdminUploadsPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [message, setMessage] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [priceType, setPriceType] = useState("rub");
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [bigUploadLoading, setBigUploadLoading] = useState(false);

  const [previewStats, setPreviewStats] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewReady, setPreviewReady] = useState(false);

  async function loadPageData() {
    setLoading(true);
    setErrorText("");
    setMessage("");

    try {
      const [suppliersRes, logsRes] = await Promise.all([
        supabase
          .from("pricelists")
          .select("id, supplier, name, price_type")
          .order("id", { ascending: true }),

        supabase
          .from("price_upload_logs")
          .select(`
            id,
            supplier_id,
            uploaded_by,
            file_name,
            price_type,
            rows_total,
            rows_inserted,
            rows_skipped,
            status,
            error_text,
            created_at
          `)
          .order("created_at", { ascending: false })
          .limit(200)
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (logsRes.error) throw logsRes.error;

      const nextSuppliers = suppliersRes.data || [];
      const nextLogs = logsRes.data || [];

      setSuppliers(nextSuppliers);
      setLogs(nextLogs);

      if (!supplierId && nextSuppliers.length > 0) {
        setSupplierId(String(nextSuppliers[0].id));
        setPriceType(nextSuppliers[0].price_type || "rub");
      }
    } catch (err) {
      console.error("Uploads page load error:", err);
      setErrorText(err?.message || "Не удалось загрузить данные страницы.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const suppliersMap = useMemo(() => {
    return Object.fromEntries(suppliers.map((item) => [String(item.id), item]));
  }, [suppliers]);

  const isLargeFile = file ? file.size > LARGE_FILE_LIMIT_MB * 1024 * 1024 : false;

  function resetPreviewState() {
    setPreviewStats(null);
    setPreviewRows([]);
    setPreviewReady(false);
  }

  function resetAllMessages() {
    setMessage("");
    setErrorText("");
  }

  function clearSelectedFile() {
    setFile(null);
    setFileName("");
    const input = document.getElementById("csv-upload-input");
    if (input) input.value = "";
  }

  function handleSupplierChange(value) {
    setSupplierId(value);
    const supplier = suppliersMap[value];
    if (supplier?.price_type) {
      setPriceType(supplier.price_type);
    }

    resetPreviewState();
    resetAllMessages();
  }

  async function handlePreview() {
    if (!supplierId) {
      setErrorText("Выбери поставщика.");
      return;
    }

    if (!file) {
      setErrorText("Выбери CSV/XLS/XLSX-файл.");
      return;
    }

    if (isLargeFile) {
      setErrorText(
        "Файл слишком большой для обычной проверки. Используй кнопку «Загрузить большой файл без preview»."
      );
      return;
    }

    setPreviewLoading(true);
    resetAllMessages();
    resetPreviewState();

    try {
      const ruleData = await fetchImportRule(supplierId);
      const sourceRows = await parseSourceFile(file, ruleData.rule);
      const normalizedRows = normalizeRowsByRule(
        sourceRows,
        ruleData.rule,
        ruleData.aliases
      );

      const rowsTotal = normalizedRows.length;
      const rowsWithoutPn = normalizedRows.filter((r) => !r.pn).length;
      const rowsEmptyBrand = normalizedRows.filter((r) => !r.brand).length;
      const rowsEmptyName = normalizedRows.filter((r) => !r.name).length;
      const rowsReady = rowsTotal - rowsWithoutPn;

      setPreviewStats({
        rowsTotal,
        rowsWithoutPn,
        rowsEmptyBrand,
        rowsEmptyName,
        rowsReady
      });

      setPreviewRows(normalizedRows.slice(0, 20));
      setPreviewReady(true);
      setMessage("Файл нормализован по правилу поставщика. Можно загружать прайс.");

      await postJson("/api/admin/uploads/append", { action: "reset" });

      for (let i = 0; i < normalizedRows.length; i += BIG_UPLOAD_CHUNK) {
        const chunk = normalizedRows.slice(i, i + BIG_UPLOAD_CHUNK);
        await postJson("/api/admin/uploads/append", {
          action: "append",
          rows: chunk
        });
      }
    } catch (err) {
      console.error("Preview error:", err);
      setErrorText(err?.message || "Ошибка проверки файла.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!supplierId) {
      setErrorText("Выбери поставщика.");
      return;
    }

    if (!previewReady) {
      setErrorText("Сначала проверь файл.");
      return;
    }

    setCommitLoading(true);
    resetAllMessages();

    try {
      const res = await fetch("/api/admin/uploads/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          supplierId,
          fileName,
          priceType
        })
      });

      const rawText = await res.text();

      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(rawText || "Сервер вернул невалидный ответ.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось загрузить прайс.");
      }

      setMessage(
        `Прайс успешно загружен. Вставлено: ${data.stats.rowsInserted}, пропущено: ${data.stats.rowsSkipped}.`
      );

      clearSelectedFile();
      resetPreviewState();

      await loadPageData();
    } catch (err) {
      console.error("Commit error:", err);
      setErrorText(err?.message || "Ошибка загрузки прайса.");
    } finally {
      setCommitLoading(false);
    }
  }

  async function handleBigUploadWithoutPreview() {
    if (!supplierId) {
      setErrorText("Выбери поставщика.");
      return;
    }

    if (!file) {
      setErrorText("Выбери файл.");
      return;
    }

    setBigUploadLoading(true);
    resetAllMessages();
    resetPreviewState();

    try {
      setMessage("Получаю правило поставщика...");

      const ruleData = await fetchImportRule(supplierId);

      setMessage("Читаю исходный файл...");

      const sourceRows = await parseSourceFile(file, ruleData.rule);

      if (!sourceRows.length) {
        throw new Error("Файл пустой или не удалось прочитать строки.");
      }

      const normalizedRows = normalizeRowsByRule(
        sourceRows,
        ruleData.rule,
        ruleData.aliases
      );

      const rowsTotal = normalizedRows.length;
      const rowsWithoutPn = normalizedRows.filter((r) => !r.pn).length;
      const rowsEmptyBrand = normalizedRows.filter((r) => !r.brand).length;
      const rowsEmptyName = normalizedRows.filter((r) => !r.name).length;
      const rowsReady = rowsTotal - rowsWithoutPn;

      setPreviewStats({
        rowsTotal,
        rowsWithoutPn,
        rowsEmptyBrand,
        rowsEmptyName,
        rowsReady
      });
      setPreviewRows(normalizedRows.slice(0, 20));

      setMessage("Очищаю временную таблицу...");

      await postJson("/api/admin/uploads/append", {
        action: "reset"
      });

      let uploaded = 0;

      for (let i = 0; i < normalizedRows.length; i += BIG_UPLOAD_CHUNK) {
        const chunk = normalizedRows.slice(i, i + BIG_UPLOAD_CHUNK);

        setMessage(
          `Загружаю нормализованные строки во временную таблицу: ${Math.min(
            i + chunk.length,
            normalizedRows.length
          )} / ${normalizedRows.length}`
        );

        await postJson("/api/admin/uploads/append", {
          action: "append",
          rows: chunk
        });

        uploaded += chunk.length;
      }

      setMessage(`Файл загружен во временную таблицу (${uploaded} строк). Подготавливаю перенос...`);

      const prepare = await postJson("/api/admin/uploads/commit-step", {
        action: "prepare",
        supplierId,
        fileName,
        priceType
      });

      const totalOldRows = prepare.oldRowsCount || 0;
      let deletedRows = 0;

      if (totalOldRows > 0) {
        while (true) {
          setMessage(`Удаляю старый прайс поставщика: ${deletedRows} / ${totalOldRows}`);

          const step = await postJson("/api/admin/uploads/commit-step", {
            action: "deleteChunk",
            supplierId
          });

          deletedRows += step.deleted || 0;

          if (step.done) break;
        }
      }

      let insertOffset = 0;
      let insertedRows = 0;

      while (true) {
        setMessage(`Переношу строки в offers: ${insertedRows} / ${prepare.rowsTotal}`);

        const step = await postJson("/api/admin/uploads/commit-step", {
          action: "insertChunk",
          supplierId,
          offset: insertOffset
        });

        insertedRows += step.inserted || 0;

        if (step.done) break;

        insertOffset = step.nextOffset || insertOffset + 100;
      }

      setMessage("Финализирую загрузку...");

      await postJson("/api/admin/uploads/commit-step", {
        action: "finalize",
        supplierId,
        fileName,
        priceType,
        rowsTotal: prepare.rowsTotal || 0,
        rowsInserted: insertedRows,
        rowsSkipped: prepare.rowsSkipped || 0
      });

      setMessage(
        `Большой прайс успешно загружен. Вставлено: ${insertedRows}, пропущено: ${prepare.rowsSkipped || 0}.`
      );

      setPreviewReady(false);
      clearSelectedFile();

      await loadPageData();
    } catch (err) {
      console.error("Big upload error:", err);
      setErrorText(err?.message || "Ошибка загрузки большого прайса.");
    } finally {
      setBigUploadLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Загрузка прайсов</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          Загрузка CSV/XLS/XLSX во временную таблицу, проверка и перенос в offers
        </p>
      </div>

      {message && <div style={successBoxStyle}>{message}</div>}
      {errorText && <div style={errorBoxStyle}>{errorText}</div>}

      {loading ? (
        <div>Загружаю страницу...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.95fr 1.05fr",
            gap: 20
          }}
        >
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Новая загрузка</h2>

            <div style={{ display: "grid", gap: 14 }}>
              <Field label="Поставщик">
                <select
                  value={supplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  style={inputStyle}
                >
                  {suppliers.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} — {item.supplier || "—"} / {item.name || "—"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Тип прайса">
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="rub">rub</option>
                  <option value="usd">usd</option>
                </select>
              </Field>

              <Field label="Файл прайса">
                <input
                  id="csv-upload-input"
                  type="file"
                  accept=".csv,.xls,.xlsx,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const nextFile = e.target.files?.[0] || null;
                    setFile(nextFile);
                    setFileName(nextFile?.name || "");
                    resetPreviewState();
                    resetAllMessages();
                  }}
                  style={inputStyle}
                />
              </Field>

              {fileName && (
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
                  Выбран файл: <b>{fileName}</b>
                  {file?.size ? (
                    <>
                      <br />
                      Размер: <b>{formatFileSize(file.size)}</b>
                    </>
                  ) : null}
                  {isLargeFile ? (
                    <>
                      <br />
                      <span style={{ color: "#c2410c", fontWeight: 600 }}>
                        Большой файл — используй режим без preview.
                      </span>
                    </>
                  ) : null}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading || commitLoading || bigUploadLoading}
                  style={{
                    ...buttonPrimaryStyle,
                    opacity: previewLoading || commitLoading || bigUploadLoading ? 0.7 : 1
                  }}
                >
                  {previewLoading ? "Проверяю..." : "Проверить файл"}
                </button>

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!previewReady || previewLoading || commitLoading || bigUploadLoading}
                  style={{
                    ...buttonDarkStyle,
                    opacity:
                      !previewReady || previewLoading || commitLoading || bigUploadLoading
                        ? 0.6
                        : 1
                  }}
                >
                  {commitLoading ? "Загружаю..." : "Загрузить прайс"}
                </button>

                <button
                  type="button"
                  onClick={handleBigUploadWithoutPreview}
                  disabled={!file || previewLoading || commitLoading || bigUploadLoading}
                  style={{
                    ...buttonWarnStyle,
                    opacity: !file || previewLoading || commitLoading || bigUploadLoading ? 0.6 : 1
                  }}
                >
                  {bigUploadLoading
                    ? "Гружу большой файл..."
                    : "Загрузить большой файл без preview"}
                </button>
              </div>
            </div>

            <div style={infoBoxStyle}>
              Обычный режим:
              <br />
              1. Выбираешь поставщика
              <br />
              2. Прикрепляешь файл
              <br />
              3. Нажимаешь <b>Проверить файл</b>
              <br />
              4. Смотришь превью и статистику
              <br />
              5. Нажимаешь <b>Загрузить прайс</b>
              <br />
              <br />
              Для больших файлов:
              <br />
              используй кнопку <b>«Загрузить большой файл без preview»</b>
            </div>

            {previewStats && (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>Статистика</h3>

                <div style={statsGridStyle}>
                  <StatCard label="Всего строк" value={previewStats.rowsTotal} />
                  <StatCard label="Без P/N" value={previewStats.rowsWithoutPn} />
                  <StatCard label="Пустой brand" value={previewStats.rowsEmptyBrand} />
                  <StatCard label="Пустой name" value={previewStats.rowsEmptyName} />
                  <StatCard label="Готово к загрузке" value={previewStats.rowsReady} />
                </div>
              </div>
            )}

            {previewRows.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>Превью файла</h3>

                <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13
                    }}
                  >
                    <thead>
                      <tr>
                        {["brand", "pn", "name", "qty", "price_rub", "price_usd"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              borderBottom: "1px solid #eee",
                              background: "#fafafa",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={tdStyle}>{row.brand || "—"}</td>
                          <td style={tdStyle}>{row.pn || "—"}</td>
                          <td style={tdStyle}>{row.name || "—"}</td>
                          <td style={tdStyle}>{row.qty || "—"}</td>
                          <td style={tdStyle}>{row.price_rub || "—"}</td>
                          <td style={tdStyle}>{row.price_usd || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 0" }}>
              <h2 style={{ marginTop: 0 }}>История загрузок</h2>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: 20, color: "#666" }}>Логов пока нет.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Дата",
                        "Поставщик",
                        "Файл",
                        "Тип",
                        "Всего",
                        "Вставлено",
                        "Пропущено",
                        "Статус",
                        "Комментарий"
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "12px 10px",
                            borderBottom: "1px solid #eee",
                            background: "#fafafa",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const supplier = suppliers.find((item) => item.id === log.supplier_id);

                      return (
                        <tr key={log.id}>
                          <td style={tdStyle}>
                            {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                          </td>
                          <td style={tdStyle}>
                            {supplier
                              ? `#${supplier.id} — ${supplier.supplier || "—"} / ${supplier.name || "—"}`
                              : log.supplier_id || "—"}
                          </td>
                          <td style={tdStyle}>{log.file_name || "—"}</td>
                          <td style={tdStyle}>{log.price_type || "—"}</td>
                          <td style={tdStyle}>{log.rows_total ?? 0}</td>
                          <td style={tdStyle}>{log.rows_inserted ?? 0}</td>
                          <td style={tdStyle}>{log.rows_skipped ?? 0}</td>
                          <td style={tdStyle}>
                            <StatusBadge status={log.status} />
                          </td>
                          <td style={tdStyle}>{log.error_text || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();

  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(rawText || "Сервер вернул невалидный ответ.");
  }

  if (!res.ok) {
    throw new Error(data?.error || "Ошибка запроса.");
  }

  return data;
}

async function fetchImportRule(supplierId) {
  const res = await fetch(`/api/admin/uploads/rule?supplierId=${supplierId}`, {
    method: "GET"
  });

  const rawText = await res.text();

  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(rawText || "Сервер вернул невалидный ответ по правилу.");
  }

  if (!res.ok) {
    throw new Error(data?.error || "Не удалось получить правило поставщика.");
  }

  return data;
}

async function parseSourceFile(file, rule) {
  const ext = getFileExtension(file.name);

  if (ext === "csv") {
    return await parseCsvFile(file);
  }

  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheetName =
      rule.sheet_name && workbook.SheetNames.includes(rule.sheet_name)
        ? rule.sheet_name
        : workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error("В Excel-файле не найден лист для чтения.");
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: ""
    });

    return matrixToObjects(matrix, rule);
  }

  throw new Error("Поддерживаются только csv, xls, xlsx, xlsm.");
}

function matrixToObjects(matrix, rule) {
  const headerRowIndex = Math.max(0, Number(rule.header_row || 1) - 1);
  const dataStartIndex = Math.max(0, Number(rule.data_start_row || 2) - 1);

  const headers = (matrix[headerRowIndex] || []).map((cell) =>
    String(cell ?? "").trim()
  );

  if (!headers.length) {
    throw new Error("Не удалось прочитать строку заголовков из Excel.");
  }

  const rows = [];

  for (let i = dataStartIndex; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const obj = {};

    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? "";
    });

    rows.push(obj);
  }

  return rows;
}

function buildAliasMap(aliases) {
  const map = {
    pn: [],
    name: [],
    qty: [],
    brand: [],
    price: []
  };

  for (const item of aliases || []) {
    const field = String(item.field_name || "").trim();
    const sourceHeader = String(item.source_header || "").trim();

    if (!field || !sourceHeader) continue;
    if (!map[field]) map[field] = [];
    map[field].push(sourceHeader);
  }

  return map;
}

function findColumnName(sourceRows, explicitName, aliasList = []) {
  const firstRow = sourceRows?.[0] || {};
  const availableHeaders = Object.keys(firstRow);

  if (explicitName && availableHeaders.includes(explicitName)) {
    return explicitName;
  }

  for (const alias of aliasList) {
    if (availableHeaders.includes(alias)) {
      return alias;
    }
  }

  return null;
}

function normalizeRowsByRule(sourceRows, rule, aliases) {
  if (!Array.isArray(sourceRows) || sourceRows.length === 0) {
    return [];
  }

  const aliasMap = buildAliasMap(aliases);

  const pnColumn = findColumnName(sourceRows, rule.pn_column, aliasMap.pn);
  const nameColumn = findColumnName(sourceRows, rule.name_column, aliasMap.name);
  const qtyColumn = findColumnName(sourceRows, rule.qty_column, aliasMap.qty);
  const brandColumn = findColumnName(sourceRows, rule.brand_column, aliasMap.brand);
  const priceColumn = findColumnName(sourceRows, rule.price_column, aliasMap.price);

  if (!pnColumn) {
    throw new Error("Не найдена колонка артикула (pn).");
  }

  if (!nameColumn) {
    throw new Error("Не найдена колонка наименования (name).");
  }

  if (!priceColumn) {
    throw new Error("Не найдена колонка цены (price).");
  }

  const skipQtyValues = Array.isArray(rule.skip_qty_values)
    ? rule.skip_qty_values.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  return sourceRows
    .map((row) => {
      const pn = cleanValue(row[pnColumn], rule.trim_values);
      const name = cleanValue(row[nameColumn], rule.trim_values);
      const qty = qtyColumn ? cleanValue(row[qtyColumn], rule.trim_values) : "";

      let brand = "";
      if (rule.brand_mode === "fixed") {
        brand = cleanValue(rule.brand_fixed, true);
      } else if (rule.brand_mode === "column") {
        brand = brandColumn ? cleanValue(row[brandColumn], rule.trim_values) : "";
      }

      let priceValue = cleanValue(row[priceColumn], rule.trim_values);
      if (rule.replace_comma_in_price) {
        priceValue = priceValue.replace(",", ".");
      }

      return {
        brand,
        pn,
        name,
        qty: rule.qty_mode === "fixed" ? cleanValue(rule.qty_fixed, true) : qty,
        price_rub: rule.price_currency === "rub" ? priceValue : "",
        price_usd: rule.price_currency === "usd" ? priceValue : ""
      };
    })
    .filter((row) => {
      if (rule.skip_empty_pn && !row.pn) {
        return false;
      }

      if (rule.skip_empty_qty && !String(row.qty || "").trim()) {
        return false;
      }

      const qtyLower = String(row.qty || "").trim().toLowerCase();
      if (skipQtyValues.includes(qtyLower)) {
        return false;
      }

      return true;
    });
}

function cleanValue(value, trim = true) {
  const s = String(value ?? "");
  return trim ? s.trim() : s;
}

function getFileExtension(fileName = "") {
  const parts = String(fileName).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        if (results.errors?.length) {
          reject(new Error(results.errors[0].message || "Ошибка чтения CSV."));
          return;
        }
        resolve(results.data || []);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, color: "#666" }}>{label}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        background: "#fafafa"
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value ?? 0}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    new: { label: "new", bg: "#eef6ff", color: "#1d4ed8" },
    ok: { label: "ok", bg: "#ecfdf5", color: "#15803d" },
    warning: { label: "warning", bg: "#fff7ed", color: "#c2410c" },
    error: { label: "error", bg: "#fef2f2", color: "#b91c1c" }
  };

  const item = map[status] || {
    label: status || "—",
    bg: "#f3f4f6",
    color: "#374151"
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        background: item.bg,
        color: item.color,
        fontSize: 12,
        fontWeight: 600
      }}
    >
      {item.label}
    </span>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 10,
  fontSize: 14,
  boxSizing: "border-box"
};

const tdStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top"
};

const cardStyle = {
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  background: "#fff",
  padding: 20,
  alignSelf: "start"
};

const infoBoxStyle = {
  marginTop: 18,
  padding: 12,
  borderRadius: 12,
  background: "#fafafa",
  border: "1px solid #eee",
  fontSize: 13,
  color: "#555",
  lineHeight: 1.5
};

const successBoxStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #cce5cc",
  background: "#f3fff3",
  color: "#2e6b2e"
};

const errorBoxStyle = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #f1b5b5",
  background: "#fff5f5",
  color: "#9b1c1c"
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10
};

const buttonPrimaryStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14
};

const buttonDarkStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14
};

const buttonWarnStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #c2410c",
  background: "#fff7ed",
  color: "#9a3412",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600
};