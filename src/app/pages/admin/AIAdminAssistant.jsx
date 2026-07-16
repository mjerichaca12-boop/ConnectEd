import { useState, useRef, useEffect } from "react";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { AdminAIToolbar } from "@/app/components/ai/AdminAIToolbar";
import { AdminAIChat } from "@/app/components/ai/AdminAIChat";
import { streamAdminMessage, buildAdminQuickPrompt } from "@/app/lib/adminGroqClient";
import { supabase } from "@/app/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Users, UserCog, BookOpen, Mail, RefreshCw, Sparkles } from "lucide-react";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { adminNotifications } from "@/app/components/NotificationDefault";
import { CustomSelect } from "@/app/components/admin/CustomSelect";

export function AIAdminAssistant() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  
  const [platformData, setPlatformData] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    pendingRequests: 0,
    recentActivity: [],
    announcements: [],
  });
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentModule, setCurrentModule] = useState("Dashboard");
  const [notificationList, setNotificationList] = useState(adminNotifications);

  const adminName = "System Administrator";

  const fetchPlatformData = async () => {
    if (!supabase) {
      console.error("Supabase not configured");
      return;
    }
    try {
      const [students, teachers, subjects, requests] = 
        await Promise.all([
          supabase.from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "student"),
          supabase.from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "teacher"),
          supabase.from("subjects")
            .select("id", { count: "exact", head: true }),
          supabase.from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "pending"),
        ]);
      setPlatformData({
        totalStudents: students.count || 0,
        totalTeachers: teachers.count || 0,
        totalSubjects: subjects.count || 0,
        pendingRequests: requests.count || 0,
      });
    } catch (error) {
      console.error("Failed to fetch platform data:", error);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const WELCOME_MESSAGE = (data) => ({
    role: "assistant",
    content: `👋 *Hello, Administrator!* I'm your AI Admin Assistant, 
powered by Groq AI.

I have access to your *live platform data*:
- 👥 *${data.totalStudents}* Students enrolled
- 👨‍🏫 *${data.totalTeachers}* Teachers registered
- 📚 *${data.totalSubjects}* Subjects available
- 📬 *${data.pendingRequests}* Pending requests

*Click any Quick Action* on the left, or type your request below.

What would you like to work on today? 🏫`,
    time: new Date().toISOString(),
  });

  // Initialize with welcome message after data loads:
  useEffect(() => {
    if (platformData && (platformData.totalStudents > 0 || platformData.totalTeachers > 0 || platformData.totalSubjects > 0)) {
      setMessages([WELCOME_MESSAGE(platformData)]);
    } else if (messages.length === 0) {
      setMessages([WELCOME_MESSAGE(platformData)]);
    }
  }, [platformData]);

  const handleLogout = () => {
    navigate("/login");
  };

  const handleQuickAction = (actionKey) => {
    const prompt = buildAdminQuickPrompt(actionKey, platformData);
    if (prompt) {
      setInputText(prompt);
      // Auto-submit after setting
      setTimeout(() => {
        handleSendWithText(prompt);
      }, 100);
    }
  };

  const handleSendWithText = async (text) => {
    if (!text.trim() || isStreaming) return;
    
    const userMessage = { 
      role: "user", 
      content: text.trim(),
      time: new Date().toISOString()
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText("");
    setIsStreaming(true);

    // Add empty AI message placeholder
    const aiPlaceholder = { 
      role: "assistant", 
      content: "", 
      isStreaming: true,
      time: new Date().toISOString()
    };
    setMessages([...updatedMessages, aiPlaceholder]);

    let fullResponse = "";

    try {
      await streamAdminMessage({
        messages: updatedMessages.map(m => ({ 
          role: m.role, 
          content: m.content 
        })),
        platformData,
        currentModule,
        onChunk: (chunk) => {
          fullResponse += chunk;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullResponse,
              isStreaming: true,
              time: new Date().toISOString()
            };
            return updated;
          });
        },
        onDone: (fullText) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullText,
              isStreaming: false,
              time: new Date().toISOString()
            };
            return updated;
          });
          setIsStreaming(false);
        },
        onError: (error) => {
          console.error("Groq error:", error);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "⚠️ Sorry, I encountered an error. " +
                       "Please check your Groq API key and try again.",
              isStreaming: false,
              time: new Date().toISOString()
            };
            return updated;
          });
          setIsStreaming(false);
        },
      });
    } catch (error) {
      console.error("Stream error:", error);
      setIsStreaming(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;
    
    const userMessage = { 
      role: "user", 
      content: inputText.trim(),
      time: new Date().toISOString()
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText("");
    setIsStreaming(true);

    // Add empty AI message placeholder
    const aiPlaceholder = { 
      role: "assistant", 
      content: "", 
      isStreaming: true,
      time: new Date().toISOString()
    };
    setMessages([...updatedMessages, aiPlaceholder]);

    let fullResponse = "";

    try {
      await streamAdminMessage({
        messages: updatedMessages.map(m => ({ 
          role: m.role, 
          content: m.content 
        })),
        platformData,
        currentModule,
        onChunk: (chunk) => {
          fullResponse += chunk;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullResponse,
              isStreaming: true,
              time: new Date().toISOString()
            };
            return updated;
          });
        },
        onDone: (fullText) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullText,
              isStreaming: false,
              time: new Date().toISOString()
            };
            return updated;
          });
          setIsStreaming(false);
        },
        onError: (error) => {
          console.error("Groq error:", error);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "⚠️ Sorry, I encountered an error. " +
                       "Please check your Groq API key and try again.",
              isStreaming: false,
              time: new Date().toISOString()
            };
            return updated;
          });
          setIsStreaming(false);
        },
      });
    } catch (error) {
      console.error("Stream error:", error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      {/* Sidebar */}
      <AdminSidebar 
        adminName={adminName} 
        onLogout={handleLogout} 
      />

      {/* Main content — pushes right of fixed sidebar */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden lg:pl-64 bg-gray-50">
        
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex lg:hidden items-center justify-center">
                <Sparkles className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-widest font-medium">
                  Admin Portal
                </p>
                <h2 className="text-gray-900 text-lg font-bold">
                  AI Assistant
                </h2>
              </div>
            </div>
            <NotificationDropdown 
              notifications={notificationList}
              onMarkAsRead={(id) => setNotificationList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))}
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex-1 flex gap-4 p-6 overflow-hidden min-h-0">

          {/* Left panel */}
          <div className="hidden lg:flex flex-col w-80 flex-shrink-0 gap-4 overflow-y-auto scrollbar-hide pr-1">
            
            {/* Live Platform Snapshot */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <p className="text-green-600 text-xs font-bold uppercase tracking-widest">
                Live Platform Data
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-600 text-sm">Total Students</span>
                  </div>
                  <span className="text-gray-900 font-bold text-sm">{platformData.totalStudents}</span>
                </div>
                
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-green-500" />
                    <span className="text-gray-600 text-sm">Total Teachers</span>
                  </div>
                  <span className="text-gray-900 font-bold text-sm">{platformData.totalTeachers}</span>
                </div>
                
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    <span className="text-gray-600 text-sm">Total Subjects</span>
                  </div>
                  <span className="text-gray-900 font-bold text-sm">{platformData.totalSubjects}</span>
                </div>
                
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 relative overflow-hidden">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-500" />
                    <span className="text-gray-600 text-sm">Pending Requests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-bold text-sm">{platformData.pendingRequests}</span>
                    {platformData.pendingRequests > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
                  </div>
                </div>
              </div>

              <button onClick={fetchPlatformData}
                className="w-full text-xs text-gray-500 hover:text-green-600 flex items-center justify-center gap-1 pt-2 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Refresh data
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <AdminAIToolbar 
                onAction={handleQuickAction}
                isStreaming={isStreaming}
              />
            </div>

            {/* Context Settings */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Context Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Current Module</label>
                  <CustomSelect
                    value={currentModule}
                    onChange={(val) => setCurrentModule(val)}
                    options={[
                      { value: "Dashboard", label: "Dashboard" },
                      { value: "Student Management", label: "Student Management" },
                      { value: "Teacher Management", label: "Teacher Management" },
                      { value: "Subjects & Sections", label: "Subjects & Sections" },
                      { value: "Reports", label: "Reports" },
                    ]}
                    placeholder="Select module context"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Response Language</label>
                  <CustomSelect
                    value="English"
                    onChange={() => {}}
                    options={[
                      { value: "English", label: "English" },
                      { value: "Filipino", label: "Filipino" },
                      { value: "Bilingual", label: "Bilingual" },
                    ]}
                    placeholder="Select language"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Document Type</label>
                  <CustomSelect
                    value="General"
                    onChange={() => {}}
                    options={[
                      { value: "General", label: "General" },
                      { value: "Official Letter", label: "Official Letter" },
                      { value: "Report", label: "Report" },
                      { value: "Announcement", label: "Announcement" },
                      { value: "Evaluation Form", label: "Evaluation Form" },
                    ]}
                    placeholder="Select document type"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Tone</label>
                  <CustomSelect
                    value="Formal"
                    onChange={() => {}}
                    options={[
                      { value: "Formal", label: "Formal" },
                      { value: "Semi-formal", label: "Semi-formal" },
                      { value: "Friendly", label: "Friendly" },
                    ]}
                    placeholder="Select tone"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            
          </div>

          {/* Right Panel - Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <AdminAIChat 
              messages={messages}
              isStreaming={isStreaming}
              inputText={inputText}
              onInputChange={setInputText}
              onSend={handleSend}
              onSuggestionClick={handleSendWithText}
              onClear={() => setMessages([])}
              onExport={() => {
                const chatText = messages.map(m => 
                  `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
                ).join('\n\n');
                const blob = new Blob([chatText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'admin-ai-chat.txt';
                a.click();
              }}
              adminName={adminName}
              platformData={platformData}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
