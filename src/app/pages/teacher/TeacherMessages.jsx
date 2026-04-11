import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import {
  Search,
  Send,
  Plus,
  X,
  MessageSquare,
  Users,
  Clock,
  ChevronRight,
} from "lucide-react";

function TeacherMessages() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Conversations: [{ id, participantName, participantRole, classCode, messages: [{id, from, text, time}], unreadCount }]
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");

  // New message modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [allStudents, setAllStudents] = useState([]); // [{id, name, studentId, classCode, className}]

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }
    setTeacherName(user.name);

    // Load conversations from localStorage
    const savedConvs = JSON.parse(localStorage.getItem("teacher_conversations") || "[]");
    setConversations(savedConvs);

    // Gather all students from all classes
    const classes = JSON.parse(localStorage.getItem("teacher_classes") || "[]");
    const students = [];
    classes.forEach((cls) => {
      (cls.students || []).forEach((stu) => {
        if (!students.find((s) => s.id === stu.id)) {
          students.push({ ...stu, classCode: cls.code, className: cls.name, section: cls.section });
        }
      });
    });
    setAllStudents(students);

    setTimeout(() => setLoading(false), 400);
  }, [navigate]);

  // Scroll to bottom when conversation changes or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId, conversations]);

  const saveConversations = (updated) => {
    setConversations(updated);
    localStorage.setItem("teacher_conversations", JSON.stringify(updated));
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;

  const filteredConvs = conversations.filter((c) =>
    c.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.classCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Start or open conversation with a student
  const handleStartConversation = (student) => {
    const existing = conversations.find((c) => c.participantId === student.id);
    if (existing) {
      setSelectedConvId(existing.id);
      setShowNewModal(false);
      setStudentSearch("");
      return;
    }
    const newConv = {
      id: Date.now().toString(),
      participantId: student.id,
      participantName: student.name,
      participantRole: "Student",
      classCode: student.classCode,
      className: student.className,
      section: student.section,
      messages: [],
      unreadCount: 0,
      lastMessageTime: new Date().toISOString(),
    };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setSelectedConvId(newConv.id);
    setShowNewModal(false);
    setStudentSearch("");
  };

  // Send a message
  const handleSend = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConv) return;
    const msg = {
      id: Date.now().toString(),
      from: "teacher",
      senderName: teacherName,
      text: messageInput.trim(),
      time: new Date().toISOString(),
    };
    const updated = conversations.map((c) =>
      c.id === selectedConv.id
        ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
        : c
    );
    saveConversations(updated);
    setMessageInput("");
  };

  // Select conversation + mark read
  const handleSelectConv = (conv) => {
    if (conv.unreadCount > 0) {
      const updated = conversations.map((c) =>
        c.id === conv.id ? { ...c, unreadCount: 0 } : c
      );
      saveConversations(updated);
    }
    setSelectedConvId(conv.id);
  };

  const getTimeLabel = (iso) => {
    const diff = Math.floor((new Date() - new Date(iso)) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredStudents = allStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.classCode?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  if (loading) {
    return <LoadingScreen message="Loading messages..." />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Bar */}
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Messages</h2>
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={(id) =>
                setNotificationList((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                )
              }
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg flex-shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-8 h-8 opacity-80" />
                <div>
                  <h1 className="text-2xl font-bold">Messages</h1>
                  <p className="text-emerald-100 text-sm">
                    {conversations.length} conversations
                    {totalUnread > 0 && ` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${totalUnread} unread`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowNewModal(true); setStudentSearch(""); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm rounded-xl font-semibold text-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                New Message
              </button>
            </div>
          </div>

          {/* Main chat layout */}
          <div className="flex-1 overflow-hidden bg-gray-900/60 rounded-xl border border-white/10 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Left: Conversations List ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            <div className="lg:col-span-1 border-r border-white/10 flex flex-col">
              {/* Search + New */}
              <div className="p-4 border-b border-white/5 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-9 pr-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => { setShowNewModal(true); setStudentSearch(""); }}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
                  title="New Message"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {filteredConvs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-400 mb-1">No conversations yet</p>
                    <p className="text-xs text-gray-400">Click "New Message" to message a student.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredConvs.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConv(conv)}
                        className={`w-full text-left px-4 py-3.5 hover:bg-black/20 transition-colors ${selectedConvId === conv.id ? "bg-emerald-50 border-l-2 border-emerald-600" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {conv.participantName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-white" : "text-gray-300"}`}>
                                {conv.participantName}
                              </p>
                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                                {getTimeLabel(conv.lastMessageTime)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500 truncate">
                                {conv.classCode} {conv.section && `ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${conv.section}`}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            {conv.messages?.length > 0 && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">
                                {conv.messages[conv.messages.length - 1].text}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Right: Chat Window ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            <div className="lg:col-span-2 flex flex-col">
              {selectedConv ? (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {selectedConv.participantName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{selectedConv.participantName}</p>
                      <p className="text-xs text-gray-500">
                        Student ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {selectedConv.classCode} {selectedConv.section && `ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${selectedConv.section}`}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-3">
                    {(selectedConv.messages || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
                          <Send className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No messages yet. Say hello!</p>
                      </div>
                    ) : (
                      (selectedConv.messages || []).map((msg) => {
                        const isTeacher = msg.from === "teacher";
                        return (
                          <div key={msg.id} className={`flex ${isTeacher ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                isTeacher
                                  ? "bg-emerald-600 text-white rounded-br-sm"
                                  : "bg-white/5 text-white rounded-bl-sm"
                              }`}
                            >
                              <p className="leading-relaxed">{msg.text}</p>
                              <p className={`text-xs mt-1 ${isTeacher ? "text-emerald-100" : "text-gray-400"} text-right`}>
                                {getTimeLabel(msg.time)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <form
                    onSubmit={handleSend}
                    className="px-6 py-4 border-t border-white/10 flex items-center gap-3 flex-shrink-0"
                  >
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={`Message ${selectedConv.participantName}...`}
                      className="flex-1 px-4 py-2.5 border border-white/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={!messageInput.trim()}
                      className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">Select a conversation</h3>
                  <p className="text-gray-500 text-sm mb-5">Choose a conversation or start a new one to message a student.</p>
                  <button
                    onClick={() => { setShowNewModal(true); setStudentSearch(""); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Message
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ NEW MESSAGE MODAL ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">New Message</h3>
                  <p className="text-sm text-gray-500">Select a student to message</p>
                </div>
              </div>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search students */}
            <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students by name, ID, or class..."
                  className="w-full pl-9 pr-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {allStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No students enrolled in your classes yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Add students to a class first.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No students match your search.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredStudents.map((student) => {
                    const hasConv = conversations.find((c) => c.participantId === student.id);
                    return (
                      <button
                        key={student.id}
                        onClick={() => handleStartConversation(student)}
                        className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-emerald-50 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{student.name}</p>
                          <p className="text-xs text-gray-500">
                            {student.studentId} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {student.classCode} {student.section && `ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${student.section}`}
                          </p>
                          {hasConv && (
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">Existing conversation</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { TeacherMessages };
