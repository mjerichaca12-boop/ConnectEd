import { useState, useRef, useEffect } from "react";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { AdminAIToolbar } from "@/app/components/ai/AdminAIToolbar";
import { AdminAIChat } from "@/app/components/ai/AdminAIChat";
import { streamAdminMessage } from "@/app/lib/adminGroqClient";
import { supabase } from "@/app/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Users, UserCog, BookOpen, Mail, RefreshCw, Sparkles } from "lucide-react";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { adminNotifications } from "@/app/components/NotificationDefault";

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
  const [notificationList, setNotificationList] = useState(adminNotifications);

  const adminName = "System Administrator";

  const fetchPlatformData = async () => {
    try {
      // Mock data in case queries fail (or table missing)
      let students = { count: 0 }, teachers = { count: 0 }, subjects = { count: 0 }, requests = { count: 0 }, activity = { data: [] }, announcements = { data: [] };
      
      try {
        const [s, t, sub, req, act, ann] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact" }).eq("role", "student"),
          supabase.from("profiles").select("id", { count: "exact" }).eq("role", "teacher"),
          supabase.from("subjects").select("id", { count: "exact" }),
          supabase.from("access_requests").select("id", { count: "exact" }).eq("status", "pending"),
          supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(10),
          supabase.from("announcements").select("title, created_at").order("created_at", { ascending: false }).limit(5),
        ]);
        students = s; teachers = t; subjects = sub; requests = req; activity = act; announcements = ann;
      } catch (e) {
        console.log("Using default fallback data, table might be missing.", e);
      }

      setPlatformData({
        totalStudents: students?.count || 0,
        totalTeachers: teachers?.count || 0,
        totalSubjects: subjects?.count || 0,
        pendingRequests: requests?.count || 0,
        recentActivity: activity?.data || [],
        announcements: announcements?.data || [],
      });
    } catch (error) {
      console.error("Failed to fetch platform data:", error);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const welcomeMessage = {
    role: "assistant",
    content: `👋 **Hello, Administrator!** I'm your AI Admin Assistant, powered by Groq AI.

I have access to your **live platform data**:
- 👥 **${platformData.totalStudents}** Students enrolled
- 👨‍🏫 **${platformData.totalTeachers}** Teachers registered  
- 📚 **${platformData.totalSubjects}** Subjects available
- 📬 **${platformData.pendingRequests}** Pending access requests

I can help you:
- 📊 Generate system reports and data summaries
- 📢 Draft school-wide announcements
- ✉️ Create access request response templates
- 📋 Produce enrollment and academic reports
- 📅 Write school calendar event descriptions
- 📝 Generate teacher evaluation templates
- 💡 Provide data insights and recommendations

**Quick tip:** Click any **Quick Action** on the left, or type your request below.

*What would you like to work on today?* 🏫`,
    timestamp: Date.now()
  };

  // Initialize welcome message only once, but update it when data loads
  useEffect(() => {
    if (messages.length === 0 || messages.length === 1) {
      setMessages([welcomeMessage]);
    }
  }, [platformData.totalStudents]);

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

    await streamAdminMessage({
      messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
      platformData,
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
      
      {/* Sidebar */}
      <AdminSidebar 
        adminName={adminName} 
        onLogout={handleLogout} 
      />

      {/* Main content — pushes right of fixed sidebar */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden lg:pl-72 bg-gray-50">
        
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
                setInputText={setInputText} 
                platformData={platformData} 
                inputRef={inputRef} 
              />
            </div>

            {/* Context Settings */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Context Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Response Language</label>
                  <select className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option>English</option>
                    <option>Filipino</option>
                    <option>Bilingual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Document Type</label>
                  <select className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option>General</option>
                    <option>Official Letter</option>
                    <option>Report</option>
                    <option>Announcement</option>
                    <option>Evaluation Form</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Tone</label>
                  <select className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option>Formal</option>
                    <option>Semi-formal</option>
                    <option>Friendly</option>
                  </select>
                </div>
              </div>
            </div>
            
          </div>

          {/* Right Panel - Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <AdminAIChat 
              messages={messages}
              setMessages={setMessages}
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              isStreaming={isStreaming}
              platformData={platformData}
              inputRef={inputRef}
              welcomeMessage={welcomeMessage}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
