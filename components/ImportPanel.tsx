"use client";

import { useRef, useState } from "react";
import { CSV_TEMPLATE, ImportedItemPayload, parseFinancialCsv } from "@/lib/csv";
import { LineItem } from "@/lib/forecast";

export default function ImportPanel({
  onImported,
  autoOpen,
}: {
  onImported: (items: LineItem[]) => void;
  autoOpen?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState<ImportedItemPayload[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cashflow-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setSubmitError("");
    setImportedCount(0);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { valid, errors } = parseFinancialCsv(text);
      setPending(valid.length > 0 ? valid : null);
      setParseErrors(errors);
    };
    reader.readAsText(file);
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
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setPending(null);
    setParseErrors([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <details className="card import-panel" open={autoOpen}>
      <summary className="import-summary">Bulk import from CSV</summary>
      <p className="sub" style={{ margin: "8px 0 12px" }}>
        Upload a CSV of your income and expenses to populate the forecast in one go.
        Columns: <code>type, category, name, amount, frequency, startWeek</code>.
      </p>
      <div className="form-col">
        <button type="button" className="link-btn" onClick={downloadTemplate}>
          ⬇ Download CSV template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {fileName && !pending && parseErrors.length === 0 && (
          <p className="sub">Reading {fileName}…</p>
        )}
        {parseErrors.length > 0 && (
          <div className="tip warning" style={{ display: "block" }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>
              {parseErrors.length} row{parseErrors.length === 1 ? "" : "s"} couldn&apos;t be read:
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
            <div style={{ display: "flex", gap: 8 }}>
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
