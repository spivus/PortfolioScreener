"use client";

import { useState, useCallback } from "react";

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);

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
    // Upload-Logik kommt spaeter
    const files = Array.from(e.dataTransfer.files);
    console.log("Dateien empfangen:", files);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      console.log("Dateien ausgewaehlt:", files);
    },
    []
  );

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

          {/* Upload Icon */}
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
