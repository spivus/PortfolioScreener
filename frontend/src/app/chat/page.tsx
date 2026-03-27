"use client";

import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await authFetch("/chat/general", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          history: messages,
          symbol: symbol.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Fehler beim Generieren der Antwort." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Verbindungsfehler. Bitte erneut versuchen." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <RequireAuth>
      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-6 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between opacity-0 animate-fade-in">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              KI-Finanzassistent
            </h1>
            <p className="mt-0.5 text-sm text-text-muted">
              Fragen zu Aktien, ETFs, Maerkten und Finanzthemen
            </p>
          </div>
        </div>

        {/* Symbol Input */}
        <div className="mb-4 opacity-0 animate-slide-up stagger-1">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Symbol (optional)
            </label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="z.B. AAPL, SAP.DE, MSFT"
              className="w-60 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {symbol && (
              <span className="stat-pill-green text-[11px]">
                Marktdaten werden geladen
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-2xl border border-surface-border bg-surface-card/50 px-6 py-6"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-secondary">
                Stelle eine Frage zu Aktien oder Maerkten
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "Was macht Apple gerade?",
                  "Wie steht SAP.DE?",
                  "Was ist ein ETF?",
                  "Erklaere die 200-Tage-Linie",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-full border border-surface-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-primary/30 hover:text-text-secondary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-white"
                      : "border border-surface-border bg-surface-raised text-text-secondary"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl border border-surface-border bg-surface-raised px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="mt-4 flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage eingeben..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary h-11 w-11 shrink-0 !rounded-xl !p-0"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
      </div>
    </RequireAuth>
  );
}
