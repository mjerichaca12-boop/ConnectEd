import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/app/components/Sidebar";
import { FileUploadZone } from "@/app/components/ai/FileUploadZone";
import { AIToolbar } from "@/app/components/ai/AIToolbar";
import { AISettings } from "@/app/components/ai/AISettings";
import { AIChat } from "@/app/components/ai/AIChat";
import { streamMessage } from "@/app/lib/groqClient";
import { useNavigate } from "react-router-dom";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";

const WELCOME_MSG = {
  role: "assistant",
  content: `👋 **Hello, Student!** I'm your AI Study Assistant, powered by Groq AI.

I can help you:
- 📖 Understand complex topics
- 📝 Summarize your class materials
- ❓ Practice for quizzes
- 🌐 Translate content between Filipino and English

**To get started:**
1. Upload your study materials on the left panel (optional)
2. Type your question or request below

*How can I help you study today?* 🎓`,
  timestamp: Date.now()
};

export function StudentAIAssistant() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [studentName, setStudentName] = useState("");
  
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  
  const [settings, setSettings] = useState({
    gradeLevel: "7",
    subject: "General",
    difficulty: "Medium",
    language: "English",
    itemCount: 5,
  });

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "student") {
      navigate("/login");
      return;
    }
    setStudentName(user.name);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isStreaming) return;

    const userMessage = { role: "user", content: inputText, timestamp: Date.now() };
    const currentMessages = [...messages, userMessage];
    
    setMessages(currentMessages);
    setInputText("");
    setIsStreaming(true);

    let assistantMessage = "";
    
    // Create a temporary message placeholder for the assistant
    setMessages([...currentMessages, { role: "assistant", content: "", timestamp: Date.now() }]);

    await streamMessage({
      messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
      fileContents,
      role: "student",
      onChunk: (text) => {
        assistantMessage += text;
        setMessages([...currentMessages, { role: "assistant", content: assistantMessage + "▌", timestamp: Date.now() }]);
      },
      onDone: (fullText) => {
        setMessages([...currentMessages, { role: "assistant", content: fullText, timestamp: Date.now() }]);
        setIsStreaming(false);
      },
      onError: (err) => {
        console.error("Groq Error:", err);
        setMessages([...currentMessages, { role: "assistant", content: "⚠️ Sorry, I encountered an error while processing your request. Please try again later.", timestamp: Date.now() }]);
        setIsStreaming(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-xs font-bold uppercase tracking-widest">Student Portal</p>
              <h2 className="text-xl font-bold text-gray-900">
                AI Study Assistant
              </h2>
            </div>
            <NotificationDropdown 
              notifications={[]}
              onMarkAsRead={() => {}}
              onNotificationsChange={() => {}}
            />
          </div>
        </div>

        {/* Two-panel content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-6 overflow-hidden min-h-0">

          {/* LEFT PANEL — fixed width, scrollable internally */}
          <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto" style={{scrollbarWidth: "none"}}>
            
            {/* File Upload Zone */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <FileUploadZone 
                uploadedFiles={uploadedFiles} 
                setUploadedFiles={setUploadedFiles}
                setFileContents={setFileContents}
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <AIToolbar 
                setInputText={setInputText} 
                settings={settings} 
                inputRef={inputRef} 
                role="student"
              />
            </div>

            {/* Settings */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hidden lg:block">
              <AISettings 
                settings={settings} 
                setSettings={setSettings} 
              />
            </div>
          </div>

          {/* RIGHT PANEL — chat, fills remaining space */}
          <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm min-h-[500px]">
            <AIChat 
              messages={messages}
              setMessages={setMessages}
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              isStreaming={isStreaming}
              fileContents={fileContents}
              inputRef={inputRef}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
