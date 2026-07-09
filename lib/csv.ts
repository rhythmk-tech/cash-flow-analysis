import { Frequency, ItemType } from "./forecast";

export interface ImportedItemPayload {
  type: ItemType;
  category: string;
  name: string;
  amount: number;
  frequency: Frequency;
  startWeek: number;
  lineLabel: string;
}

export interface ImportResult {
  valid: ImportedItemPayload[];
  errors: string[];
}

const ALLOWED_TYPES: ItemType[] = ["income", "expense"];
const ALLOWED_FREQUENCIES: Frequency[] = ["onetime", "weekly", "biweekly", "monthly"];
const REQUIRED_HEADERS = ["type", "category", "name", "amount", "frequency", "startweek"];

// Parses one CSV line into fields, honoring double-quoted fields that may contain commas.
function parseCsvLine(line: string): string[] {
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
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseFinancialCsv(text: string): ImportResult {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { valid: [], errors: ["The file is empty."] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      valid: [],
      errors: [
        `Missing required column(s): ${missing.join(", ")}. Expected headers: type, category, name, amount, frequency, startWeek.`,
      ],
    };
  }
  const idx = (name: string) => header.indexOf(name);

  const valid: ImportedItemPayload[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed, matches spreadsheet row numbers including header
    const fields = parseCsvLine(lines[i]);
    if (fields.every((f) => f === "")) continue;

    const rawType = (fields[idx("type")] || "").toLowerCase();
    const category = fields[idx("category")] || "";
    const name = fields[idx("name")] || "";
    const rawAmount = fields[idx("amount")] || "";
    const rawFrequency = (fields[idx("frequency")] || "").toLowerCase();
    const rawStartWeek = fields[idx("startweek")] || "1";

    if (!ALLOWED_TYPES.includes(rawType as ItemType)) {
      errors.push(`Row ${rowNum}: type must be "income" or "expense" (got "${fields[idx("type")] || ""}").`);
      continue;
    }
    if (!name.trim()) {
      errors.push(`Row ${rowNum}: name is required.`);
      continue;
    }
    if (!category.trim()) {
      errors.push(`Row ${rowNum}: category is required.`);
      continue;
    }
    const amount = Number(rawAmount.replace(/[$,]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Row ${rowNum}: amount must be a positive number (got "${rawAmount}").`);
      continue;
    }
    const frequency = (rawFrequency || "onetime") as Frequency;
    if (!ALLOWED_FREQUENCIES.includes(frequency)) {
      errors.push(
        `Row ${rowNum}: frequency must be one of onetime, weekly, biweekly, monthly (got "${rawFrequency}").`
      );
      continue;
    }
    const startWeek = Math.max(1, Number(rawStartWeek) || 1);

    valid.push({
      type: rawType as ItemType,
      category: category.trim(),
      name: name.trim(),
      amount,
      frequency,
      startWeek,
      lineLabel: category.trim(),
    });
  }

  return { valid, errors };
}

export const CSV_TEMPLATE = `type,category,name,amount,frequency,startWeek
income,Sales Revenue,Weekly product sales,12000,weekly,1
income,AR Collections,Outstanding invoice from ClientCo,4500,onetime,2
expense,Payroll,Biweekly payroll run,8200,biweekly,1
expense,Rent,Office rent,3200,monthly,1
`;
