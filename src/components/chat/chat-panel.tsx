"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { MessageBubble, type ChatMessageItem } from "./message-bubble";
import { ChatInput } from "./chat-input";
import type { RetrievedChunkSource } from "@/modules/chat";

interface ChatSessionSummary {
  id: string;
  contractId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface RawDbMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  retrievedChunks?: RetrievedChunkSource[];
  createdAt?: string;
}

function makeClientId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

interface ChatPanelProps {
  contractId: string;
  contractTitle?: string;
}

export function ChatPanel({ contractId, contractTitle }: ChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Streaming state for the in-progress message
  const [currentStreamingText, setCurrentStreamingText] = useState("");
  const [currentSources, setCurrentSources] = useState<RetrievedChunkSource[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingText]);

  // 1. Fetch Sessions for Contract
  const loadSessions = useCallback(async () => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/chat/sessions`);
      if (!res.ok) {
        throw new Error("Failed to load chat sessions");
      }
      const data = await res.json();
      const loadedSessions: ChatSessionSummary[] = data.sessions || [];
      setSessions(loadedSessions);

      if (loadedSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(loadedSessions[0].id);
      } else if (loadedSessions.length === 0) {
        // Automatically create initial session
        const createRes = await fetch(`/api/contracts/${contractId}/chat/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Contract Analysis" }),
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          setSessions([createData.session]);
          setActiveSessionId(createData.session.id);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error connecting to chat service");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [contractId, activeSessionId]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch(`/api/contracts/${contractId}/chat/sessions`);
        if (!res.ok) throw new Error("Failed to load chat sessions");
        const data = await res.json();
        if (ignore) return;
        const loadedSessions: ChatSessionSummary[] = data.sessions || [];
        setSessions(loadedSessions);

        if (loadedSessions.length > 0) {
          setActiveSessionId((prev) => prev || loadedSessions[0].id);
        } else {
          const createRes = await fetch(`/api/contracts/${contractId}/chat/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Contract Analysis" }),
          });
          if (createRes.ok) {
            const createData = await createRes.json();
            if (!ignore) {
              setSessions([createData.session]);
              setActiveSessionId(createData.session.id);
            }
          }
        }
      } catch (err) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : "Error connecting to chat service");
        }
      } finally {
        if (!ignore) {
          setIsLoadingSessions(false);
        }
      }
    }

    init();
    return () => {
      ignore = true;
    };
  }, [contractId]);

  // 2. Fetch Messages for active session
  useEffect(() => {
    if (!activeSessionId) return;

    let ignore = false;

    fetch(`/api/contracts/${contractId}/chat/sessions/${activeSessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch session messages");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          const formatted: ChatMessageItem[] = (data.messages || []).map((m: RawDbMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.retrievedChunks || [],
            createdAt: m.createdAt,
          }));
          setMessages(formatted);
          setIsLoadingMessages(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load messages");
          setIsLoadingMessages(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [contractId, activeSessionId]);

  // 3. Create a new session manually
  const handleNewSession = async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [data.session, ...prev]);
        setActiveSessionId(data.session.id);
        setMessages([]);
      }
    } catch {
      setErrorMsg("Failed to create new chat session");
    }
  };

  // 4. Delete current session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      const res = await fetch(`/api/contracts/${contractId}/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);
        if (activeSessionId === sessionId) {
          setActiveSessionId(remaining[0]?.id || null);
          setMessages([]);
        }
      }
    } catch {
      setErrorMsg("Failed to delete chat session");
    }
  };

  // 5. Send message and handle SSE streaming
  const handleSendMessage = async (text: string) => {
    if (!activeSessionId || isStreaming) return;

    setErrorMsg(null);

    // Optimistically append user message
    const tempUserMsgId = makeClientId("temp-user");
    const userMsg: ChatMessageItem = {
      id: tempUserMsgId,
      role: "user",
      content: text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setCurrentStreamingText("");
    setCurrentSources([]);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/chat/sessions/${activeSessionId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to establish streaming connection");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedReply = "";
      let latestSources: RetrievedChunkSource[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;

          let eventType = "message";
          let dataStr = "";

          const lines = rawEvent.split("\n");
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventType === "context") {
              if (data.sources && Array.isArray(data.sources)) {
                latestSources = data.sources;
                setCurrentSources(latestSources);
              }
            } else if (eventType === "token") {
              if (data.text) {
                accumulatedReply += data.text;
                setCurrentStreamingText(accumulatedReply);
              }
            } else if (eventType === "done") {
              // Finalize message in state
              const assistantMsg: ChatMessageItem = {
                id: data.messageId || makeClientId("msg"),
                role: "assistant",
                content: accumulatedReply,
                sources: latestSources,
                createdAt: new Date(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setCurrentStreamingText("");
              setCurrentSources([]);
            } else if (eventType === "error") {
              setErrorMsg(data.error || "Streaming error occurred");
            }
          } catch {
            // Non-JSON SSE payload
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to receive AI response");
    } finally {
      setIsStreaming(false);
      setCurrentStreamingText("");
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-[720px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Sessions Sidebar */}
      <div className="w-64 border-r border-slate-100 bg-slate-50/70 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
              Conversations
            </h3>
            <button
              onClick={handleNewSession}
              title="Start New Chat"
              className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[560px] pr-1">
            {isLoadingSessions ? (
              <div className="p-3 text-center text-xs text-slate-400">Loading chats...</div>
            ) : sessions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">No chats yet</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition ${
                    activeSessionId === s.id
                      ? "bg-indigo-600 text-white font-medium shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate max-w-[170px]" title={s.title}>
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition ${
                      activeSessionId === s.id
                        ? "text-indigo-200 hover:text-white"
                        : "text-slate-400 hover:text-red-600"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer info */}
        <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-400">
          <p className="truncate font-medium text-slate-600">{contractTitle || "Active Contract"}</p>
          <p>Tenant-scoped RAG</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/20">
        {/* Chat Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {activeSession?.title || "Contract Assistant"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Answers grounded solely in the verified text of this agreement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSessions}
              title="Refresh messages"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoadingMessages ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              Loading message history...
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Ask Anything About This Agreement</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                Inquire about indemnification, payment terms, auto-renewal deadlines, or confidential disclosures.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {[
                  "What is the governing law and notice period for termination?",
                  "What penalties apply if provider fails to deliver physical hardware or space equipment?",
                  "What are the payment terms and late fees?",
                  "What is the aggregate limitation of liability cap?",
                ].map((sampleQ, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(sampleQ)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs"
                  >
                    &ldquo;{sampleQ}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}

              {/* In-flight streaming response */}
              {isStreaming && (
                <MessageBubble
                  message={{
                    id: "streaming-in-flight",
                    role: "assistant",
                    content: currentStreamingText || "Consulting contract clauses...",
                    sources: currentSources,
                  }}
                  isStreaming={true}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 bg-white border-t border-slate-100">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isStreaming}
            disabled={!activeSessionId}
          />
        </div>
      </div>
    </div>
  );
}
