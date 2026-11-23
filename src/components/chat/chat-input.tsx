"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, CornerDownLeft, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  isLoading,
  disabled,
  placeholder = "Ask any question about this contract (e.g. 'What is the termination notice period?')...",
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [content]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || isLoading || disabled) return;
    onSendMessage(trimmed);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition">
      <textarea
        ref={textareaRef}
        rows={1}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading || disabled}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50 max-h-40"
      />

      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <CornerDownLeft className="h-3 w-3" />
          <span>Press Enter to send, Shift + Enter for newline</span>
        </span>

        <button
          type="button"
          onClick={handleSend}
          disabled={!content.trim() || isLoading || disabled}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Thinking...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <Send className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
