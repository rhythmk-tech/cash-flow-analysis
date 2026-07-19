"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { CSV_TEMPLATE, ImportedItemPayload } from "@/lib/import-parser";
import { formatDateOnly, LineItem } from "@/lib/forecast";

export default function ImportPanel({
  onImported,
  autoOpen,
  forecastStart,
}: {
  onImported: (items: LineItem[]) => void;
  autoOpen?: boolean;
  forecastStart: Date;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState<ImportedItemPayload[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cashflow-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadExcelTemplate() {
    const a = document.createElement("a");
    a.href = `/api/items/template?forecastStart=${encodeURIComponent(formatDateOnly(forecastStart))}`;
    a.download = "cash-flow-starter-template.xlsx";
    a.click();
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setSubmitError("");
    setImportedCount(0);
    setPending(null);
    setParseErrors([]);
    setParseWarnings([]);
    setReading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("forecastStart", formatDateOnly(forecastStart));
      const res = await fetch("/api/items/parse-file", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setParseErrors([data?.error || "Couldn't read that file."]);
        return;
      }
      setPending(data.valid.length > 0 ? data.valid : null);
      setParseErrors(data.errors || []);
      setParseWarnings(data.warnings || []);
    } catch {
      setParseErrors(["Couldn't read that file. Please try again."]);
    } finally {
      setReading(false);
    }
  }

  async function handleConfirmImport() {
    if (!pending || pending.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pending }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.error || "Import failed. Please try again.");
        return;
      }
      onImported(data as LineItem[]);
      setImportedCount((data as LineItem[]).length);
      setPending(null);
      setParseWarnings([]);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setPending(null);
    setParseErrors([]);
    setParseWarnings([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <details className="card import-panel" open={autoOpen}>
      <summary className="import-summary">Bulk import from a file</summary>
      <p className="sub" style={{ margin: "8px 0 4px" }}>
        Don&apos;t have anything to upload yet? Download a starter template, fill in your real
        income and expenses, then upload it back here.
      </p>
      <div style={{ display: "flex", gap: 14, margin: "6px 0 12px" }}>
        <button type="button" className="link-btn" onClick={downloadExcelTemplate}>
          <Download size={14} />
          Download Excel template
        </button>
        <button type="button" className="link-btn" onClick={downloadCsvTemplate}>
          <Download size={14} />
          Download CSV template
        </button>
      </div>
      <p className="sub" style={{ margin: "0 0 12px" }}>
        Already have your numbers somewhere else? Upload a CSV, TSV, Excel (.xlsx/.xls), JSON, or
        PDF file directly. Column names are flexible — <code>Description</code>,{" "}
        <code>Memo</code>, or <code>Payee</code> all work for a line item&apos;s name, for example —
        and a single <code>Amount</code> column with negative values for expenses works just as
        well as separate <code>Debit</code>/<code>Credit</code> columns.
      </p>
      <div className="form-col">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {reading && <p className="sub">Reading {fileName}…</p>}
        {parseErrors.length > 0 && (
          <div className="tip warning" style={{ display: "block" }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>
              {parseErrors.length} issue{parseErrors.length === 1 ? "" : "s"} reading that file:
            </p>
            {parseErrors.slice(0, 8).map((err, i) => (
              <p key={i} style={{ fontSize: 12.5 }}>{err}</p>
            ))}
            {parseErrors.length > 8 && <p style={{ fontSize: 12.5 }}>…and {parseErrors.length - 8} more.</p>}
          </div>
        )}
        {pending && pending.length > 0 && (
          <div className="tip insight" style={{ display: "block" }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              Ready to import {pending.length} item{pending.length === 1 ? "" : "s"} from {fileName}.
            </p>
            {parseWarnings.slice(0, 6).map((warning, i) => (
              <p
                key={i}
                style={{ fontSize: 12.5, color: "var(--gold)", display: "flex", alignItems: "center", gap: 5 }}
              >
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                {warning}
              </p>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="add-btn" type="button" disabled={submitting} onClick={handleConfirmImport}>
                {submitting ? "Importing…" : `Import ${pending.length} item${pending.length === 1 ? "" : "s"}`}
              </button>
              <button className="cancel-btn" type="button" onClick={handleCancel} disabled={submitting}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {submitError && <p style={{ color: "var(--expense)", fontSize: 12.5 }}>{submitError}</p>}
        {importedCount > 0 && (
          <p className="sub" style={{ color: "var(--income)" }}>
            Imported {importedCount} item{importedCount === 1 ? "" : "s"} successfully.
          </p>
        )}
      </div>
    </details>
  );
}
