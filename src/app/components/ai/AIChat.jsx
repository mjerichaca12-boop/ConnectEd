import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, RefreshCw, Sparkles, Loader2 } from "lucide-react";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors px-1.5 py-0.5 rounded hover:bg-green-50"
    >
      {copied ? (
        <><Check className="w-3 h-3 text-green-600" /> Copied</>
      ) : (
        <><Copy className="w-3 h-3" /> Copy</>
      )}
    </button>
  );
}

export function AIChat({
  messages,
  setMessages,
  onClearChat,
  inputText,
  setInputText,
  handleSend,
  onSend,
  isStreaming,
  inputRef,
  fileContents,
  onRegenerate,
  onChoiceClick,
  selectedClass,
  selectedLesson,
  selectedMaterial,
  onChangeContext,
}) {
  const bottomRef = useRef(null);
  const sendHandler = handleSend || onSend;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClear = () => {
    if (typeof onClearChat === "function") {
      onClearChat();
    } else if (typeof setMessages === "function") {
      setMessages([
        {
          role: "assistant",
          content: "🗑️ Chat cleared. How can I help you?",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const lastAssistantIdx = messages.map((m, i) => m.role === "assistant" ? i : -1).filter(i => i >= 0).pop();

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
            🤖
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm leading-none">ConnectEd AI Teaching Assistant</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Context-aware lesson planning & pedagogy helper</p>
          </div>
          {fileContents && fileContents.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              <span>📎</span>
              {fileContents.length} material{fileContents.length > 1 ? "s" : ""} loaded
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full border border-green-100 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-green-600" />
              Generating response...
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-gray-50"
        >
          Clear chat
        </button>
      </div>

      {/* Context Banner */}
      {(selectedClass || selectedLesson || selectedMaterial) && (
        <div className="flex-shrink-0 px-6 py-2.5 bg-green-50/80 border-b border-green-100 flex items-center justify-between text-xs text-green-900">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-green-800">🎯 Active Context:</span>
            {selectedClass && (
              <span className="bg-white border border-green-200 px-2.5 py-0.5 rounded-md font-semibold text-green-700 shadow-2xs">
                Grade {selectedClass.gradeLevel} – {selectedClass.section} ({selectedClass.name})
              </span>
            )}
            {selectedLesson && (
              <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md font-semibold">
                📖 {selectedLesson.title}
              </span>
            )}
            {selectedMaterial && (
              <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-md font-semibold">
                📄 {selectedMaterial.title}
              </span>
            )}
          </div>
          {onChangeContext && (
            <button
              onClick={onChangeContext}
              className="text-[11px] font-bold text-green-700 hover:text-green-900 bg-white px-2.5 py-1 border border-green-200 rounded-lg hover:shadow-xs transition-all"
            >
              Change Context
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0 bg-slate-50/50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-2xs ${
                msg.role === "user"
                  ? "bg-green-600 text-white rounded-tr-xs font-normal"
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-xs"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed space-y-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Choice option buttons */}
                  {msg.choices && msg.choices.length > 0 && (
                    <div className="mt-3.5 flex flex-col gap-2 max-w-md">
                      {msg.choices.map((choice, ci) => (
                        <button
                          key={ci}
                          onClick={() => !isStreaming && onChoiceClick?.(choice, index)}
                          disabled={isStreaming}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-xs transition-all flex items-center justify-between ${
                            msg.selectedChoiceIndex === ci
                              ? "bg-green-600 border-green-600 text-white"
                              : msg.selectedChoiceIndex !== undefined
                              ? "bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed"
                              : "bg-white border-green-200 hover:bg-green-50 text-green-700 hover:border-green-300 active:scale-[0.98]"
                          }`}
                        >
                          <span>{choice.label}</span>
                          {msg.selectedChoiceIndex === ci && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Source files indicator */}
                  {msg.usedFiles && msg.usedFiles.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 text-[11px] text-gray-400 flex flex-wrap gap-1.5 items-center">
                      <span>📎 Based on:</span>
                      {msg.usedFiles.map((f, fi) => (
                        <span key={fi} className="bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-medium">{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions row for last assistant message */}
                  {index === lastAssistantIdx && !isStreaming && msg.content && (
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-3">
                      <CopyButton text={msg.content} />
                      {onRegenerate && !msg.choices && (
                        <button
                          onClick={onRegenerate}
                          title="Regenerate response"
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors px-1.5 py-0.5 rounded hover:bg-green-50"
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming / Generation Loading Card */}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-gray-500 flex items-center gap-2 shadow-2xs">
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
              <span>AI is thinking & analyzing context...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
        {!selectedClass && (
          <div className="mb-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              💡 Tip: General educational questions work anytime. Select a class context for student data or quiz generation.
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isStreaming) sendHandler?.();
              }
            }}
            placeholder={isStreaming ? "AI is generating a response..." : "Ask a general question, or request a quiz, lesson plan, or rubric..."}
            rows={2}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 text-gray-900 disabled:opacity-60"
          />
          <button
            onClick={() => sendHandler?.()}
            disabled={isStreaming || !inputText.trim()}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Thinking</span>
              </>
            ) : (
              <span>Send</span>
            )}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 pl-1">Shift+Enter for new line</p>
      </div>
    </>
  );
}
