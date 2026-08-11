import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, RefreshCw } from "lucide-react";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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
      {copied
        ? <><Check className="w-3 h-3" /> Copied</>
        : <><Copy className="w-3 h-3" /> Copy</>}
    </button>
  );
}

export function AIChat({
  messages,
  setMessages,
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
    setMessages([
      {
        role: "assistant",
        content: "🗑️ Chat cleared. How can I help you?",
        timestamp: Date.now(),
      },
    ]);
  };

  // Find the last assistant message index
  const lastAssistantIdx = messages.map((m, i) => m.role === "assistant" ? i : -1).filter(i => i >= 0).pop();

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-gray-700 text-sm">AI Teaching Assistant</span>
          {fileContents && fileContents.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full">
              <span>📎</span>
              {fileContents.length} material{fileContents.length > 1 ? "s" : ""} loaded
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce"></span>
              Generating...
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear chat
        </button>
      </div>

      {/* Context Banner */}
      {(selectedClass || selectedLesson || selectedMaterial) && (
        <div className="flex-shrink-0 px-6 py-2.5 bg-green-50 border-b border-green-100 flex items-center justify-between text-xs text-green-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span>🎯 **Active Context:**</span>
            {selectedClass && (
              <span className="bg-green-100 px-2 py-0.5 rounded font-semibold text-green-700">
                Grade {selectedClass.gradeLevel} – {selectedClass.section} ({selectedClass.name})
              </span>
            )}
            {selectedLesson && (
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                📖 {selectedLesson.title}
              </span>
            )}
            {selectedMaterial && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                📄 {selectedMaterial.title}
              </span>
            )}
          </div>
          {onChangeContext && (
            <button
              onClick={onChangeContext}
              className="text-[10px] uppercase font-bold tracking-wider text-green-600 hover:text-green-850 transition-colors bg-white px-2 py-1 border border-green-200 rounded-lg hover:shadow-sm"
            >
              Change Context
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 select-scrollbar">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-green-600 text-white rounded-tr-sm"
                  : "bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Choice option buttons */}
                  {msg.choices && msg.choices.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 max-w-md">
                      {msg.choices.map((choice, ci) => (
                        <button
                          key={ci}
                          onClick={() => !isStreaming && onChoiceClick?.(choice, index)}
                          disabled={isStreaming}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-sm transition-all flex items-center justify-between ${
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
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400 flex flex-wrap gap-1">
                      <span>📎 Based on:</span>
                      {msg.usedFiles.map((f, fi) => (
                        <span key={fi} className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions row for last assistant message */}
                  {index === lastAssistantIdx && !isStreaming && msg.content && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
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
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
        {/* Context Status Info */}
        {!selectedClass ? (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 flex items-center gap-2">
            <span>🎯</span>
            <span>No class selected. Ask to generate something or use settings to set context.</span>
          </div>
        ) : !selectedMaterial && fileContents.length === 0 ? (
          <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-center gap-2">
            <span>📄</span>
            <span>Class selected: **{selectedClass.name}**. No specific learning materials loaded yet.</span>
          </div>
        ) : null}

        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendHandler?.();
              }
            }}
            placeholder="Type your request or click a Quick Action..."
            rows={2}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 text-gray-900"
          />
          <button
            onClick={() => sendHandler?.()}
            disabled={isStreaming || !inputText.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1 pl-1">Shift+Enter for new line</p>
      </div>
    </>
  );
}
