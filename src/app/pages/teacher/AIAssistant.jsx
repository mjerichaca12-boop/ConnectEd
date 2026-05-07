import { useState, useRef, useEffect } from "react";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { FileUploadZone } from "@/app/components/ai/FileUploadZone";
import { AIToolbar } from "@/app/components/ai/AIToolbar";
import { AISettings } from "@/app/components/ai/AISettings";
import { AIChat } from "@/app/components/ai/AIChat";
import { streamMessage } from "@/app/lib/groqClient";
import { useNavigate } from "react-router-dom";

const WELCOME_MSG = {
  role: "assistant",
  content: `👋 **Hello, Teacher!** I'm your AI Teaching Assistant, powered by Groq AI.

I can help you create:
- 📝 Activities and quizzes from your class materials
- 📋 Lesson plans in DepEd **DLL format**
- 📊 Rubrics and assessment tools
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

    await streamMessage({
      messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
      fileContents,
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
      <TeacherSidebar teacherName="Teacher" onLogout={handleLogout} />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50">
        <div className="flex-1 flex gap-6 p-6 h-full overflow-hidden">
          
          {/* Left Panel - Fixed Width */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
            {/* File Upload Zone */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <FileUploadZone 
                uploadedFiles={uploadedFiles} 
                setUploadedFiles={setUploadedFiles}
                setFileContents={setFileContents}
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <AIToolbar 
                setInputText={setInputText} 
                settings={settings} 
                inputRef={inputRef} 
              />
            </div>

            {/* Settings */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <AISettings 
                settings={settings} 
                setSettings={setSettings} 
              />
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className="flex-1 h-full min-w-0">
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
      </main>
    </div>
  );
}
