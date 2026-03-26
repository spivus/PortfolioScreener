"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadPortfolio } from "@/lib/api";

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [kundeName, setKundeName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setPendingFile(files[0]);
      setError(null);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        setPendingFile(files[0]);
        setError(null);
      }
    },
    []
  );

  async function handleUpload() {
    if (!pendingFile || !kundeName.trim()) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadPortfolio(pendingFile, kundeName.trim());
      router.push(`/portfolio/${result.portfolio_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  function handleCancel() {
    setPendingFile(null);
    setKundeName("");
    setError(null);
  }

  // Datei ausgewaehlt → Kundenname-Formular zeigen
  if (pendingFile) {
    return (
      <div className="mx-auto max-w-2xl px-6">
        <div className="rounded-2xl border-2 border-primary/30 bg-surface-card p-8 backdrop-blur-xl">
          <p className="mb-1 text-sm text-gray-400">Ausgewaehlte Datei</p>
          <p className="mb-4 font-medium text-white">{pendingFile.name}</p>

          <label className="mb-1 block text-sm text-gray-400">
            Kundenname
          </label>
          <input
            type="text"
            value={kundeName}
            onChange={(e) => setKundeName(e.target.value)}
            placeholder="z.B. Max Mustermann"
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading || !kundeName.trim()}
              className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              {uploading ? "Portfolio wird analysiert..." : "Hochladen"}
            </button>
            <button
              onClick={handleCancel}
              disabled={uploading}
              className="rounded-lg border border-white/10 px-4 py-2 text-gray-400 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard: Drag & Drop Zone
  return (
    <div className="mx-auto max-w-2xl px-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-white/10 bg-surface-card backdrop-blur-xl hover:border-primary/40 hover:bg-surface-hover"
        }`}
      >
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleFileSelect}
          />

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <svg
              className={`h-7 w-7 transition-colors ${
                isDragging ? "text-primary" : "text-primary-light"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <p className="mb-1 text-base font-medium text-white">
            Portfolio hochladen
          </p>
          <p className="text-sm text-gray-400">
            Excel, CSV oder PDF &mdash; Drag &amp; Drop oder klicken
          </p>

          <div className="mt-4 flex items-center justify-center gap-3">
            {["XLSX", "CSV", "PDF"].map((format) => (
              <span
                key={format}
                className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-400"
              >
                .{format.toLowerCase()}
              </span>
            ))}
          </div>
        </label>
      </div>
    </div>
  );
}
