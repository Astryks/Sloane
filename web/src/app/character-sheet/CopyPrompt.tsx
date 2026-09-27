"use client";

import { useState } from "react";

export function CopyPrompt({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-cream p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rounded-full bg-purple px-3 py-1 text-[11px] font-bold text-white"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{text}</p>
    </div>
  );
}
