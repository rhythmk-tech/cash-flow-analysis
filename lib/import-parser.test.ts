import { describe, expect, it } from "vitest";
import {
  detectFileKind,
  extractRowsFromDelimitedText,
  extractRowsFromJson,
  extractRowsFromPdfText,
  interpretRows,
} from "./import-parser";

const FS = new Date(2026, 6, 13); // Mon, Jul 13 2026

describe("detectFileKind", () => {
  it("recognizes each supported extension", () => {
    expect(detectFileKind("data.csv")).toBe("csv");
    expect(detectFileKind("data.TSV")).toBe("csv");
    expect(detectFileKind("notes.txt")).toBe("csv");
    expect(detectFileKind("ledger.xlsx")).toBe("excel");
    expect(detectFileKind("ledger.xls")).toBe("excel");
    expect(detectFileKind("items.json")).toBe("json");
    expect(detectFileKind("statement.pdf")).toBe("pdf");
  });

  it("falls back to unsupported for unknown extensions", () => {
    expect(detectFileKind("photo.png")).toBe("unsupported");
    expect(detectFileKind("noextension")).toBe("unsupported");
  });
});

describe("extractRowsFromDelimitedText", () => {
  it("parses standard comma-delimited CSV", () => {
    const result = extractRowsFromDelimitedText("type,amount\nincome,100\nexpense,50");
    expect(result?.header).toEqual(["type", "amount"]);
    expect(result?.rows).toEqual([
      ["income", "100"],
      ["expense", "50"],
    ]);
  });

  it("auto-detects tab-delimited text", () => {
    const result = extractRowsFromDelimitedText("type\tamount\nincome\t100");
    expect(result?.header).toEqual(["type", "amount"]);
    expect(result?.rows).toEqual([["income", "100"]]);
  });

  it("honors quoted fields containing the delimiter", () => {
    const result = extractRowsFromDelimitedText('name,note\n"Smith, John","says ""hi"""');
    expect(result?.rows[0]).toEqual(["Smith, John", 'says "hi"']);
  });

  it("returns null for empty input", () => {
    expect(extractRowsFromDelimitedText("")).toBeNull();
    expect(extractRowsFromDelimitedText("   \n  ")).toBeNull();
  });
});

describe("extractRowsFromJson", () => {
  it("parses an array of objects, using the union of keys as the header", () => {
    const result = extractRowsFromJson(
      JSON.stringify([
        { type: "income", amount: 100 },
        { type: "expense", amount: 50, category: "Rent" },
      ])
    );
    expect(result?.header).toEqual(["type", "amount", "category"]);
    expect(result?.rows).toEqual([
      ["income", "100", ""],
      ["expense", "50", "Rent"],
    ]);
  });

  it("parses an array of arrays, treating the first row as the header", () => {
    const result = extractRowsFromJson(JSON.stringify([["type", "amount"], ["income", "100"]]));
    expect(result?.header).toEqual(["type", "amount"]);
    expect(result?.rows).toEqual([["income", "100"]]);
  });

  it("returns null for invalid JSON", () => {
    expect(extractRowsFromJson("{not valid json")).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(extractRowsFromJson("[]")).toBeNull();
  });

  it("returns null for JSON that isn't an array", () => {
    expect(extractRowsFromJson('{"type":"income"}')).toBeNull();
  });
});

describe("extractRowsFromPdfText", () => {
  it("finds a table by locating a header row with recognizable column names", () => {
    const text = "Bank Statement\nSome preamble text\nDate       Description       Amount\n07/13/2026  Coffee shop        -4.50\n07/14/2026  Paycheck          2000.00";
    const result = extractRowsFromPdfText(text);
    expect(result).not.toBeNull();
    expect(result?.header).toEqual(["Date", "Description", "Amount"]);
    expect(result?.rows.length).toBe(2);
  });

  it("returns null when no recognizable header row exists", () => {
    expect(extractRowsFromPdfText("just some\nrandom prose\nwith no tables")).toBeNull();
  });
});

describe("interpretRows", () => {
  it("maps synonym column headers (Description/Value) to the canonical fields", () => {
    const result = interpretRows(
      ["Description", "Category", "Value", "Frequency"],
      [["Office rent", "Rent", "-3200", "monthly"]],
      FS
    );
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([
      { type: "expense", category: "Rent", name: "Office rent", amount: 3200, frequency: "monthly", startWeek: 1, lineLabel: "Rent" },
    ]);
  });

  it("infers expense/income from the sign of a single amount column when no type column exists", () => {
    const result = interpretRows(
      ["name", "category", "amount"],
      [
        ["Client payment", "Sales", "1500"],
        ["Office rent", "Rent", "-2000"],
      ],
      FS
    );
    expect(result.valid.map((v) => v.type)).toEqual(["income", "expense"]);
    expect(result.valid.map((v) => v.amount)).toEqual([1500, 2000]);
  });

  it("reads separate debit/credit columns as expense/income respectively", () => {
    const result = interpretRows(
      ["name", "category", "debit", "credit"],
      [
        ["Rent", "Rent", "2000", ""],
        ["Sale", "Sales", "", "500"],
      ],
      FS
    );
    expect(result.valid).toEqual([
      { type: "expense", category: "Rent", name: "Rent", amount: 2000, frequency: "onetime", startWeek: 1, lineLabel: "Rent" },
      { type: "income", category: "Sales", name: "Sale", amount: 500, frequency: "onetime", startWeek: 1, lineLabel: "Sales" },
    ]);
  });

  it("handles accounting-style parenthesized negatives", () => {
    const result = interpretRows(["name", "category", "amount"], [["Rent", "Rent", "($2,000.00)"]], FS);
    expect(result.valid[0]).toMatchObject({ type: "expense", amount: 2000 });
  });

  it("converts a date column into the correct forecast week", () => {
    const result = interpretRows(["name", "category", "amount", "date"], [["Rent", "Rent", "-1000", "2026-07-27"]], FS);
    // FS is Jul 13 (week 1); Jul 27 is 14 days later -> week 3
    expect(result.valid[0].startWeek).toBe(3);
  });

  it("normalizes frequency synonyms", () => {
    const result = interpretRows(
      ["name", "category", "amount", "frequency"],
      [["Rent", "Rent", "-1000", "Every 2 weeks"]],
      FS
    );
    expect(result.valid[0].frequency).toBe("biweekly");
  });

  it("defaults frequency to onetime when missing or unrecognized", () => {
    const result = interpretRows(["name", "category", "amount"], [["Rent", "Rent", "-1000"]], FS);
    expect(result.valid[0].frequency).toBe("onetime");
  });

  it("defaults a missing category based on type, with a warning", () => {
    const result = interpretRows(["name", "amount"], [["Mystery income", "500"]], FS);
    expect(result.valid[0].category).toBe("Other Income");
    expect(result.warnings.some((w) => w.includes("category"))).toBe(true);
  });

  it("errors when no amount or debit/credit column can be found at all", () => {
    const result = interpretRows(["name", "category"], [["Rent", "Rent"]], FS);
    expect(result.valid).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a row with an unparseable amount but keeps processing other rows", () => {
    const result = interpretRows(
      ["name", "category", "amount"],
      [
        ["Bad row", "Rent", "not a number"],
        ["Good row", "Rent", "-1000"],
      ],
      FS
    );
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].name).toBe("Good row");
    expect(result.errors).toHaveLength(1);
  });

  it("skips fully blank rows without error", () => {
    const result = interpretRows(["name", "category", "amount"], [["", "", ""], ["Rent", "Rent", "-1000"]], FS);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});
