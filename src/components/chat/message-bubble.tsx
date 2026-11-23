"use client";

import { useState } from "react";
import { Copy, Check, Bot, User, ChevronDown, ChevronUp, BookOpen, AlertTriangle } from "lucide-react";
import type { RetrievedChunkSource } from "@/modules/chat";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: RetrievedChunkSource[];
  createdAt?: string | Date;
}

interface MessageBubbleProps {
  message: ChatMessageItem;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const isAssistant = message.role === "assistant";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 my-4 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm mt-1">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`relative max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all ${
          isAssistant
            ? "border border-slate-200/80 bg-white text-slate-800"
            : "bg-indigo-600 text-white"
        }`}
      >
        {/* Header / Role Info */}
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span
            className={`text-[11px] font-semibold tracking-wide uppercase ${
              isAssistant ? "text-indigo-600" : "text-indigo-100"
            }`}
          >
            {isAssistant ? "IntelliBooks Assistant" : "You"}
          </span>

          <div className="flex items-center gap-1.5">
            {message.createdAt && (
              <span
                className={`text-[10px] ${
                  isAssistant ? "text-slate-400" : "text-indigo-200"
                }`}
              >
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <button
              onClick={handleCopy}
              title="Copy message"
              className={`p-1 rounded hover:bg-black/5 transition ${
                isAssistant ? "text-slate-400 hover:text-slate-600" : "text-indigo-200 hover:text-white"
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Message Content */}
        <div className="whitespace-pre-wrap font-sans text-sm">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />
          )}
        </div>

        {/* Retrieved Sources Accordion for Assistant */}
        {isAssistant && message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>{message.sources.length} Cited Contract {message.sources.length === 1 ? "Section" : "Sections"}</span>
              {showSources ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {message.sources.map((src, i) => (
                  <div
                    key={src.chunkId || i}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-700"
                  >
                    <div className="flex items-center justify-between font-medium text-slate-900 mb-1">
                      <span>{src.sectionTitle ? `Section: ${src.sectionTitle}` : "General Excerpt"}</span>
                      {src.pageNumber && (
                        <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          Page {src.pageNumber}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-3 text-slate-600 text-[11px] font-mono leading-normal">
                      &ldquo;{src.content}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legal Disclaimer Pill for Assistant */}
        {isAssistant && (
          <div className="mt-2.5 flex items-center gap-1 text-[10px] text-slate-400">
            <AlertTriangle className="h-3 w-3 text-amber-500/70" />
            <span>Automated contract analysis. Does not constitute formal legal advice.</span>
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-slate-200 text-slate-700 shadow-sm mt-1">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
