import { Frequency, ItemType, dateForWeek, formatDateOnly, parseDateOnly } from "./forecast";

export interface ImportedItemPayload {
  type: ItemType;
  category: string;
  name: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  lineLabel: string;
}

export interface ImportResult {
  valid: ImportedItemPayload[];
  errors: string[];
  warnings: string[];
}

const ALLOWED_FREQUENCIES: Frequency[] = ["onetime", "weekly", "biweekly", "monthly"];

// Alternate spellings/names people commonly use for each field, across bank exports,
// accounting tool exports, and hand-built spreadsheets. Matched case-insensitively
// against column headers (or JSON object keys).
const FIELD_SYNONYMS: Record<string, string[]> = {
  type: ["type", "kind", "direction", "income/expense", "in/out"],
  category: ["category", "bucket", "group", "class", "classification"],
  name: ["name", "description", "memo", "details", "item", "payee", "label"],
  amount: ["amount", "value", "total", "price", "sum"],
  debit: ["debit", "withdrawal", "money out", "outflow", "expense amount", "charge"],
  credit: ["credit", "deposit", "money in", "inflow", "income amount", "payment received"],
  frequency: ["frequency", "recurrence", "repeat", "cadence", "interval"],
  date: ["date", "start date", "due date", "occurs", "transaction date", "when"],
  startweek: ["startweek", "start week", "week"],
};

const FREQUENCY_SYNONYMS: Record<string, Frequency> = {
  onetime: "onetime",
  "one-time": "onetime",
  once: "onetime",
  single: "onetime",
  weekly: "weekly",
  "every week": "weekly",
  biweekly: "biweekly",
  "bi-weekly": "biweekly",
  "every 2 weeks": "biweekly",
  "every two weeks": "biweekly",
  fortnightly: "biweekly",
  monthly: "monthly",
  "every month": "monthly",
};

function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, " ");
}

// Maps each canonical field to the column index whose header matches one of its synonyms.
function mapColumns(headerRow: string[]): Record<string, number> {
  const normalized = headerRow.map(normalizeHeaderCell);
  const map: Record<string, number> = {};
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    const idx = normalized.findIndex((h) => synonyms.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  // Accounting-style negatives, e.g. "(1,200.00)"
  const isParenNegative = /^\(.*\)$/.test(cleaned);
  const numeric = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return isParenNegative ? -Math.abs(numeric) : numeric;
}

function parseFrequency(raw: string | undefined): Frequency {
  if (!raw) return "onetime";
  const key = normalizeHeaderCell(raw);
  return FREQUENCY_SYNONYMS[key] ?? (ALLOWED_FREQUENCIES.includes(key as Frequency) ? (key as Frequency) : "onetime");
}

// Best-effort date parsing across common export formats: ISO (2026-07-13),
// US slash (07/13/2026 or 7/13/26), and month names (Jul 13, 2026).
function tryParseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = parseDateOnly(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, m, d, yRaw] = slashMatch;
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const date = new Date(y, Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Interprets already-extracted tabular data (a header row plus data rows, as produced by
// any of the format-specific extractors below) into forecast line items. This is the one
// place that decides what a row "means" financially, so every extractor funnels through it.
export function interpretRows(headerRow: string[], dataRows: string[][], forecastStart: Date): ImportResult {
  const cols = mapColumns(headerRow);
  const valid: ImportedItemPayload[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasAmount = cols.amount !== undefined;
  const hasDebitCredit = cols.debit !== undefined || cols.credit !== undefined;
  if (!hasAmount && !hasDebitCredit) {
    return {
      valid: [],
      errors: [
        `Couldn't find an amount column. Expected one of: ${FIELD_SYNONYMS.amount.join(", ")}, or separate debit/credit columns.`,
      ],
      warnings: [],
    };
  }

  let defaultedStartWeek = 0;
  let defaultedCategory = 0;

  dataRows.forEach((row, i) => {
    const rowNum = i + 2; // 1-indexed with header as row 1, matching spreadsheet row numbers
    if (row.every((cell) => !cell || !cell.trim())) return;

    const get = (field: string) => (cols[field] !== undefined ? (row[cols[field]] || "").trim() : "");

    let type: ItemType | null = null;
    let amount: number | null = null;

    if (hasDebitCredit) {
      const debitRaw = get("debit");
      const creditRaw = get("credit");
      if (creditRaw) {
        amount = parseAmount(creditRaw);
        type = "income";
      } else if (debitRaw) {
        amount = parseAmount(debitRaw);
        type = "expense";
      }
    }
    if (amount === null && hasAmount) {
      const rawAmount = get("amount");
      const rawType = get("type").toLowerCase();
      const parsedAmount = parseAmount(rawAmount);
      if (parsedAmount !== null) {
        if (rawType === "income" || rawType === "expense") {
          type = rawType;
          amount = Math.abs(parsedAmount);
        } else {
          // No explicit type column — infer from sign, the common convention in ledger
          // exports and bank statements (negative = money out, positive = money in).
          type = parsedAmount < 0 ? "expense" : "income";
          amount = Math.abs(parsedAmount);
        }
      }
    }

    if (amount === null || amount <= 0 || !type) {
      errors.push(`Row ${rowNum}: couldn't determine a valid amount.`);
      return;
    }

    let category = get("category");
    if (!category) {
      category = type === "income" ? "Other Income" : "Misc Opex";
      defaultedCategory++;
    }

    const name = get("name") || category;

    const frequency = parseFrequency(get("frequency") || undefined);

    let startDate = formatDateOnly(forecastStart);
    const rawDate = get("date");
    const rawStartWeek = get("startweek");
    if (rawDate) {
      const parsedDate = tryParseDate(rawDate);
      if (parsedDate) {
        startDate = formatDateOnly(parsedDate);
      } else {
        warnings.push(`Row ${rowNum}: couldn't read date "${rawDate}" — defaulted to Week 1.`);
        defaultedStartWeek++;
      }
    } else if (rawStartWeek) {
      const n = Number(rawStartWeek);
      const week = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
      startDate = formatDateOnly(dateForWeek(week, forecastStart));
    } else {
      defaultedStartWeek++;
    }

    valid.push({ type, category, name, amount, frequency, startDate, lineLabel: category });
  });

  if (defaultedCategory > 0) {
    warnings.push(`${defaultedCategory} row${defaultedCategory === 1 ? "" : "s"} had no category — defaulted based on type.`);
  }
  if (defaultedStartWeek > 0) {
    warnings.push(`${defaultedStartWeek} row${defaultedStartWeek === 1 ? "" : "s"} had no date — defaulted to week 1.`);
  }

  return { valid, errors, warnings };
}

// Parses one delimited-text line into fields, honoring double-quoted fields that may
// contain the delimiter itself.
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function extractRowsFromDelimitedText(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  const delimiter = (lines[0].match(/\t/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? "\t" : ",";
  const header = parseDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map((l) => parseDelimitedLine(l, delimiter));
  return { header, rows };
}

export function extractRowsFromJson(text: string): { header: string[]; rows: string[][] } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0) return null;

  if (Array.isArray(data[0])) {
    // Array of arrays: first row is the header.
    const arr = data as unknown[][];
    return {
      header: arr[0].map((c) => String(c)),
      rows: arr.slice(1).map((row) => row.map((c) => (c === null || c === undefined ? "" : String(c)))),
    };
  }

  // Array of objects: union of keys across all rows becomes the header.
  const objects = data as Record<string, unknown>[];
  const header = Array.from(new Set(objects.flatMap((o) => Object.keys(o))));
  const rows = objects.map((o) => header.map((key) => (o[key] === null || o[key] === undefined ? "" : String(o[key]))));
  return { header, rows };
}

// Splits a line of extracted PDF text into cells, using runs of 2+ spaces or a tab as the
// column boundary — the layout PDF text extraction typically preserves for tabular content.
function splitPdfLine(line: string): string[] {
  return line
    .split(/\t|\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

export function extractRowsFromPdfText(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const cellRows = lines.map(splitPdfLine).filter((cells) => cells.length >= 2);
  if (cellRows.length < 2) return null;

  const headerIdx = cellRows.findIndex((cells) => {
    const normalized = cells.map(normalizeHeaderCell);
    return Object.values(FIELD_SYNONYMS).some((synonyms) => normalized.some((c) => synonyms.includes(c)));
  });
  if (headerIdx === -1) return null;

  return { header: cellRows[headerIdx], rows: cellRows.slice(headerIdx + 1) };
}

// Excel (exceljs, needs Node's Buffer) and PDF (pdfjs-dist, needs either a DOM Worker or the
// Node-targeted "legacy" build) parsing both only work reliably server-side, so these two
// extractors are called from an API route rather than directly from the browser.

export async function extractRowsFromWorkbook(buffer: Buffer): Promise<{ header: string[]; rows: string[][] } | null> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  // exceljs's own .d.ts shadows the ambient `Buffer` with a minimal local
  // `interface Buffer extends ArrayBuffer {}`, which a real Node Buffer fails to structurally
  // satisfy. Casting through the function's own inferred parameter type sidesteps the name
  // collision without needing to know what that shadowed type actually is.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) return null;

  const allRows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    // getRow-based iteration includes leading empty cells; values[0] is unused per ExcelJS convention.
    const values = row.values as (string | number | Date | { text?: string } | null | undefined)[];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined) cells.push("");
      else if (v instanceof Date) cells.push(v.toISOString().slice(0, 10));
      else if (typeof v === "object" && "text" in v) cells.push(String(v.text ?? ""));
      else cells.push(String(v));
    }
    allRows.push(cells);
  });
  if (allRows.length < 2) return null;
  return { header: allRows[0], rows: allRows.slice(1) };
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // The legacy build auto-detects Node and runs its "fake worker" in-process — no separate
  // worker thread or workerSrc configuration needed server-side.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // getTextContent() returns a flat list of positioned text runs with no notion of "line" or
    // "row" — reconstructing that structure from each item's transform matrix (x = transform[4],
    // y = transform[5]) is essential for tabular content: without it, an entire page collapses
    // into one string and no row/column boundaries can ever be found downstream.
    type Positioned = { str: string; x: number; y: number; width: number };
    const items: Positioned[] = content.items
      .filter((item): item is (typeof content.items)[number] & { str: string; transform: number[]; width: number } => "transform" in item)
      .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width }));

    const lineGroups = new Map<number, Positioned[]>();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const key = Math.round(item.y / 2) * 2; // small tolerance band absorbs sub-pixel baseline jitter
      if (!lineGroups.has(key)) lineGroups.set(key, []);
      lineGroups.get(key)!.push(item);
    }

    // PDF y-coordinates grow upward, so sort top-to-bottom by descending y.
    const lines = Array.from(lineGroups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, lineItems]) => {
        lineItems.sort((a, b) => a.x - b.x);
        let line = "";
        let prevEnd: number | null = null;
        for (const it of lineItems) {
          if (prevEnd !== null) {
            const gap = it.x - prevEnd;
            // A wide horizontal gap reads as a column boundary; a narrow one is just a word space.
            line += gap > 15 ? "   " : gap > 1 ? " " : "";
          }
          line += it.str;
          prevEnd = it.x + it.width;
        }
        return line;
      });
    pageTexts.push(lines.join("\n"));
  }
  return pageTexts.join("\n");
}

export type SupportedFileKind = "csv" | "excel" | "json" | "pdf" | "unsupported";

export function detectFileKind(filename: string): SupportedFileKind {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (["csv", "tsv", "txt"].includes(ext)) return "csv";
  if (["xlsx", "xls"].includes(ext)) return "excel";
  if (ext === "json") return "json";
  if (ext === "pdf") return "pdf";
  return "unsupported";
}

// The single server-side entry point: takes raw uploaded bytes plus the original filename
// (used only to pick a parser by extension) and the account's forecastStart (used to convert
// any date column into the right forecast week).
export async function parseFinancialFile(filename: string, buffer: Buffer, forecastStart: Date): Promise<ImportResult> {
  const kind = detectFileKind(filename);

  if (kind === "unsupported") {
    return {
      valid: [],
      errors: [`Unsupported file type "${filename}". Supported: CSV, TSV, TXT, Excel (.xlsx/.xls), JSON, and text-based PDF.`],
      warnings: [],
    };
  }

  let extracted: { header: string[]; rows: string[][] } | null = null;

  try {
    if (kind === "csv") {
      extracted = extractRowsFromDelimitedText(buffer.toString("utf-8"));
    } else if (kind === "json") {
      extracted = extractRowsFromJson(buffer.toString("utf-8"));
      if (!extracted) {
        return { valid: [], errors: ["Couldn't read that JSON file — expected an array of objects or an array of arrays."], warnings: [] };
      }
    } else if (kind === "excel") {
      extracted = await extractRowsFromWorkbook(buffer);
    } else if (kind === "pdf") {
      const text = await extractTextFromPdf(buffer);
      if (!text.trim()) {
        return {
          valid: [],
          errors: ["No readable text found in that PDF. Scanned/image-only PDFs aren't supported — try exporting as CSV or Excel instead."],
          warnings: [],
        };
      }
      extracted = extractRowsFromPdfText(text);
      if (!extracted) {
        return {
          valid: [],
          errors: [
            "Couldn't find a table with recognizable columns in that PDF. PDF import is best-effort — CSV or Excel will be more reliable.",
          ],
          warnings: [],
        };
      }
    }
  } catch (err) {
    return { valid: [], errors: [`Couldn't read that file: ${err instanceof Error ? err.message : "unknown error"}.`], warnings: [] };
  }

  if (!extracted || extracted.rows.length === 0) {
    return { valid: [], errors: ["The file is empty."], warnings: [] };
  }

  const result = interpretRows(extracted.header, extracted.rows, forecastStart);
  if (kind === "pdf") {
    result.warnings = [
      "PDF import is best-effort — double-check the amounts below before importing.",
      ...result.warnings,
    ];
  }
  return result;
}

export const CSV_TEMPLATE = `type,category,name,amount,frequency,date
income,Sales Revenue,Weekly product sales,12000,weekly,2026-07-13
income,AR Collections,Outstanding invoice from ClientCo,4500,onetime,2026-07-20
expense,Payroll,Biweekly payroll run,8200,biweekly,2026-07-13
expense,Rent,Office rent,3200,monthly,2026-07-13
`;
