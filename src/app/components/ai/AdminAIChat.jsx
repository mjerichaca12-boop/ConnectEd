import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, CheckCircle, Trash2, Download, Sparkles, Send, Database } from "lucide-react";

const TypingIndicator = () => (
  <div className="flex gap-1 items-center px-4 py-3">
    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
    <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
  </div>
);

export function AdminAIChat({ 
  messages, setMessages, inputText, setInputText, handleSend, 
  isStreaming, platformData, inputRef, welcomeMessage 
}) {
  const scrollRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isStreaming) {
        handleSend(e);
      }
    }
  };

  const exportChat = () => {
    let content = "ConnectEd AI Admin Assistant — Export\n";
    content += `Date: ${new Date().toLocaleDateString()} | Administrator: System Admin\n`;
    content += `Platform Snapshot: Students:${platformData.totalStudents} Teachers:${platformData.totalTeachers} Subjects:${platformData.totalSubjects}\n`;
    content += "================================================\n\n";
    
    messages.forEach(m => {
      content += `[${m.role === 'user' ? 'ADMIN' : 'AI ASSISTANT'}]:\n${m.content}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ConnectEd-Admin-AI-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    if (window.confirm("Clear this conversation? This cannot be undone.")) {
      setMessages([welcomeMessage]);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-gray-900 font-semibold">AI Admin Assistant</p>
            <p className="text-gray-500 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Powered by Groq · llama-3.3-70b · Admin Mode
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportChat} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Export Chat">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={clearChat} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Clear Chat">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {messages.map((msg, i) => {
          const isAI = msg.role === "assistant";
          return (
            <div key={i} className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
              <div className={`relative max-w-[85%] px-5 py-4 ${
                isAI ? "bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm" : "bg-green-600 text-white rounded-2xl rounded-tr-sm"
              }`}>
                {isAI && (
                  <button 
                    onClick={() => copyToClipboard(msg.content, i)}
                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-900 bg-white/50 hover:bg-white rounded-md transition-all shadow-sm"
                    title="Copy response"
                  >
                    {copiedId === i ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                
                <div className={`prose prose-sm max-w-none ${isAI ? "prose-p:text-gray-800 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-a:text-green-600 prose-table:w-full prose-table:border-collapse prose-table:my-3 prose-th:bg-green-50 prose-th:text-green-700 prose-th:border prose-th:border-gray-200 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2 prose-tr:even:bg-gray-50/50" : "text-white prose-p:text-white prose-headings:text-white prose-strong:text-white"}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                
                <p className={`text-[10px] mt-2 ${isAI ? "text-gray-400" : "text-green-200"} flex items-center justify-end`}>
                  {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          );
        })}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm inline-block">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
        <div className="mb-2 text-xs text-green-600 font-medium flex items-center gap-1">
          <Database className="w-3 h-3" />
          Live platform data connected — {platformData.totalStudents || 0} students · {platformData.totalTeachers || 0} teachers
        </div>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about platform data, draft an announcement, generate a report, or request any admin document..."
            rows={2}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-inner"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isStreaming}
            className="p-3 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all flex-shrink-0 shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-500 text-[10px] mt-2 text-center">
          AI responses are suggestions only. Always verify data before using in official documents.
        </p>
      </form>
    </div>
  );
}
