import { useState, useRef, useEffect } from "react";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { FileUploadZone } from "@/app/components/ai/FileUploadZone";
import { AIToolbar } from "@/app/components/ai/AIToolbar";
import { AISettings } from "@/app/components/ai/AISettings";
import { AIChat } from "@/app/components/ai/AIChat";
import { streamMessage } from "@/app/lib/groqClient";
import { useNavigate } from "react-router-dom";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";

const WELCOME_MSG = {
  role: "assistant",
  content: `👋 **Hello, Teacher!** I'm your AI Teaching Assistant, powered by Groq AI.

I can help you create:
- 📝 Activities and quizzes from your class materials
- 📋 Lesson plans in DepEd **DLL format**
- 📊 Rubrics and seatwork tools
- 📖 Summaries of uploaded materials
- ✉️ Parent communication letters
- 🌐 Filipino/English translations

**To get started:**
1. Upload your class materials on the left panel
2. Select your grade level and subject in Settings
3. Click a **Quick Action** or type your request below

*What would you like to create today?* 🎓`,
  timestamp: Date.now()
};

export function AIAssistant() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  
  const [settings, setSettings] = useState({
    gradeLevel: "7",
    subject: "English",
    difficulty: "Medium",
    language: "English",
    itemCount: 10,
  });

  const handleLogout = () => {
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

    // Filter out the welcome message and any empty messages from the history
    // only send actual user/assistant conversation to the LLM
    const apiMessages = currentMessages
      .filter(m => {
        // Don't send the welcome message or messages with no content
        const isWelcome = m.content && m.content.includes("Hello, Teacher!");
        const hasContent = m.content && m.content.trim() !== "";
        return !isWelcome && hasContent;
      })
      .map(m => ({ role: m.role, content: m.content }));

    await streamMessage({
      messages: apiMessages,
      fileContents,
      role: "teacher",
      onChunk: (text) => {
        assistantMessage += text;
        setMessages([...currentMessages, { role: "assistant", content: assistantMessage + "▌", timestamp: Date.now() }]);
      },
      onDone: (fullText) => {
        if (fullText) {
          setMessages([...currentMessages, { role: "assistant", content: fullText, timestamp: Date.now() }]);
        } else {
          // If something went wrong and we got no text, just keep the history as is
          setMessages(currentMessages);
        }
        setIsStreaming(false);
      },
      onError: (err) => {
        console.error("Groq Error:", err);
        const errorContent = err?.status === 429 
          ? "⚠️ I'm receiving too many requests right now. Please wait a moment before trying again."
          : "⚠️ Sorry, I encountered an error while processing your request. Please try again later.";
          
        setMessages([...currentMessages, { role: "assistant", content: errorContent, timestamp: Date.now() }]);
        setIsStreaming(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName="Teacher" onLogout={handleLogout} />

      {/* Main content — offset by sidebar width */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-64">
        
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-green-600 text-xs font-bold uppercase tracking-widest">Teacher Portal</p>
              <h2 className="text-xl font-bold text-gray-900">
                AI Assistant
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
        <div className="flex-1 flex gap-4 p-6 overflow-hidden min-h-0">

          {/* LEFT PANEL — fixed width, scrollable internally */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto" style={{scrollbarWidth: "none"}}>
            
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
              />
            </div>

            {/* Settings */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <AISettings 
                settings={settings} 
                setSettings={setSettings} 
              />
            </div>
          </div>

          {/* RIGHT PANEL — chat, fills remaining space */}
          <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
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
