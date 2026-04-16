import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import {
  Search,
  Send,
  Plus,
  X,
  MessageSquare,
  Users,
  ChevronRight,
  Video,
  AtSign,
  CheckCheck,
  Circle,
  Shield,
  UserCog,
} from "lucide-react";

const FILTERS = [
  { key: "all",       label: "All",        icon: MessageSquare },
  { key: "unread",    label: "Unread",     icon: Circle },
  { key: "read",      label: "Read",       icon: CheckCheck },
  { key: "mentions",  label: "Mentions",   icon: AtSign },
  { key: "videomeet", label: "Video Meet", icon: Video },
];

export function AdminMessages() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState([]);

  // Conversations: [{ id, participantName, participantRole, messages, unreadCount, isVideoMeet }]
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // New message modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [allTeachers, setAllTeachers] = useState([]);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "admin") { navigate("/login"); return; }
    setAdminName(user.name);

    const savedConvs = JSON.parse(localStorage.getItem("admin_conversations") || "[]");
    setConversations(savedConvs);

    // Load teachers for new message modal (from localStorage or supabase stub)
    const cachedTeachers = JSON.parse(localStorage.getItem("admin_teacher_list") || "[]");
    setAllTeachers(cachedTeachers);
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId, conversations]);

  const saveConversations = (updated) => {
    setConversations(updated);
    localStorage.setItem("admin_conversations", JSON.stringify(updated));
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;

  // ── Filtering logic ──
  const applyFilter = (convList) => {
    let filtered = convList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.participantName.toLowerCase().includes(q) ||
          c.participantRole?.toLowerCase().includes(q)
      );
    }

    switch (activeFilter) {
      case "unread":
        filtered = filtered.filter((c) => (c.unreadCount || 0) > 0);
        break;
      case "read":
        filtered = filtered.filter((c) => (c.unreadCount || 0) === 0 && !c.isVideoMeet);
        break;
      case "mentions":
        filtered = filtered.filter((c) =>
          (c.messages || []).some((m) =>
            m.from !== "admin" && m.text && m.text.includes(`@${adminName}`)
          )
        );
        break;
      case "videomeet":
        filtered = filtered.filter((c) => c.isVideoMeet === true);
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredConvs = applyFilter(conversations);

  const handleStartConversation = (teacher) => {
    const existing = conversations.find((c) => c.participantId === teacher.id);
    if (existing) {
      setSelectedConvId(existing.id);
      setShowNewModal(false);
      setRecipientSearch("");
      return;
    }
    const newConv = {
      id: Date.now().toString(),
      participantId: teacher.id,
      participantName: teacher.name,
      participantRole: "Teacher",
      messages: [],
      unreadCount: 0,
      lastMessageTime: new Date().toISOString(),
      isVideoMeet: false,
    };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setSelectedConvId(newConv.id);
    setShowNewModal(false);
    setRecipientSearch("");
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConv) return;
    const msg = {
      id: Date.now().toString(),
      from: "admin",
      senderName: adminName,
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

  const filteredRecipients = allTeachers.filter(
    (t) =>
      t.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      t.email?.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const filterCounts = {
    all: conversations.length,
    unread: conversations.filter((c) => (c.unreadCount || 0) > 0).length,
    read: conversations.filter((c) => (c.unreadCount || 0) === 0 && !c.isVideoMeet).length,
    mentions: conversations.filter((c) =>
      (c.messages || []).some((m) => m.from !== "admin" && m.text?.includes(`@${adminName}`))
    ).length,
    videomeet: conversations.filter((c) => c.isVideoMeet === true).length,
  };

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-hidden flex flex-col relative z-10">
        {/* Top Bar */}
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
              <h2 className="text-lg font-bold text-white">Messages</h2>
            </div>
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

        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg flex-shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Messages</h1>
                  <p className="text-blue-100 text-sm">
                    {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                    {totalUnread > 0 && ` · ${totalUnread} unread`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowNewModal(true); setRecipientSearch(""); }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm rounded-xl font-semibold text-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                New Message
              </button>
            </div>
          </div>

          {/* Main chat layout */}
          <div className="flex-1 overflow-hidden bg-gray-900/60 rounded-xl border border-white/10 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            {/* ══ Left: Conversations List ══ */}
            <div className="lg:col-span-1 border-r border-white/10 flex flex-col">

              {/* Search + New */}
              <div className="p-3 border-b border-white/5 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-9 pr-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => { setShowNewModal(true); setRecipientSearch(""); }}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                  title="New Message"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="px-3 pt-2 pb-1.5 border-b border-white/5 flex gap-1.5 overflow-x-auto scrollbar-hide flex-shrink-0">
                {FILTERS.map(({ key, label, icon: Icon }) => {
                  const count = filterCounts[key];
                  const isActive = activeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                      {count > 0 && (
                        <span
                          className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center ${
                            isActive
                              ? "bg-white/25 text-white"
                              : key === "unread"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-white/10 text-gray-400"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {filteredConvs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
                      {activeFilter === "videomeet" ? (
                        <Video className="w-6 h-6 text-blue-400" />
                      ) : activeFilter === "mentions" ? (
                        <AtSign className="w-6 h-6 text-blue-400" />
                      ) : (
                        <MessageSquare className="w-6 h-6 text-blue-400" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-400 mb-1">
                      {activeFilter === "all"
                        ? "No conversations yet"
                        : activeFilter === "unread"
                        ? "No unread messages"
                        : activeFilter === "read"
                        ? "No read conversations"
                        : activeFilter === "mentions"
                        ? "No mentions found"
                        : "No Video Meet chats"}
                    </p>
                    {activeFilter === "all" && (
                      <p className="text-xs text-gray-500">Click "New Message" to start chatting.</p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredConvs.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConv(conv)}
                        className={`w-full text-left px-4 py-3.5 hover:bg-black/20 transition-colors ${
                          selectedConvId === conv.id
                            ? "bg-blue-500/8 border-l-2 border-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                conv.isVideoMeet
                                  ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                                  : "bg-gradient-to-br from-blue-500 to-indigo-600"
                              }`}
                            >
                              {conv.isVideoMeet ? (
                                <Video className="w-4 h-4" />
                              ) : (
                                conv.participantName.charAt(0).toUpperCase()
                              )}
                            </div>
                            {conv.isVideoMeet && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                                <Video className="w-1.5 h-1.5 text-white" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-white" : "text-gray-300"}`}>
                                {conv.participantName}
                              </p>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                {getTimeLabel(conv.lastMessageTime)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500 truncate">
                                {conv.isVideoMeet
                                  ? <span className="text-purple-400 font-medium">Video Meet</span>
                                  : conv.participantRole || "Teacher"}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
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

            {/* ══ Right: Chat Window ══ */}
            <div className="lg:col-span-2 flex flex-col">
              {selectedConv ? (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        selectedConv.isVideoMeet
                          ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                          : "bg-gradient-to-br from-blue-500 to-indigo-600"
                      }`}
                    >
                      {selectedConv.isVideoMeet ? (
                        <Video className="w-4 h-4" />
                      ) : (
                        selectedConv.participantName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{selectedConv.participantName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        {selectedConv.isVideoMeet ? (
                          <><Video className="w-3 h-3 text-purple-400" /> <span className="text-purple-400">Video Meet Chat</span></>
                        ) : (
                          <><UserCog className="w-3 h-3 text-blue-400" /> <span className="text-blue-400">{selectedConv.participantRole || "Teacher"}</span></>
                        )}
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
                        <p className="text-sm text-gray-500">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      (selectedConv.messages || []).map((msg) => {
                        const isAdmin = msg.from === "admin";
                        const hasMention = !isAdmin && msg.text?.includes(`@${adminName}`);
                        return (
                          <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                isAdmin
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : hasMention
                                  ? "bg-yellow-500/15 border border-yellow-500/30 text-white rounded-bl-sm"
                                  : "bg-white/5 text-white rounded-bl-sm"
                              }`}
                            >
                              {hasMention && (
                                <p className="text-[10px] text-yellow-400 font-semibold mb-1 flex items-center gap-1">
                                  <AtSign className="w-2.5 h-2.5" /> Mentioned you
                                </p>
                              )}
                              <p className="leading-relaxed">{msg.text}</p>
                              <p className={`text-xs mt-1 ${isAdmin ? "text-blue-100" : "text-gray-400"} text-right`}>
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
                      className="flex-1 px-4 py-2.5 bg-black/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={!messageInput.trim()}
                      className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">Admin Messaging</h3>
                  <p className="text-gray-500 text-sm mb-5">Select a conversation or start one with a teacher.</p>
                  <button
                    onClick={() => { setShowNewModal(true); setRecipientSearch(""); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm"
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

      {/* ══ NEW MESSAGE MODAL ══ */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <UserCog className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">New Message</h3>
                  <p className="text-sm text-gray-500">Message a teacher</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search teachers by name or email..."
                  className="w-full pl-9 pr-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {allTeachers.length === 0 ? (
                <div className="py-12 text-center">
                  <UserCog className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No teachers found in the system.</p>
                  <p className="text-xs text-gray-400 mt-1">Teachers must be registered first.</p>
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No teachers match your search.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredRecipients.map((teacher) => {
                    const hasConv = conversations.find((c) => c.participantId === teacher.id);
                    return (
                      <button
                        key={teacher.id}
                        onClick={() => handleStartConversation(teacher)}
                        className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-white/5 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {teacher.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{teacher.name}</p>
                          <p className="text-xs text-gray-500">{teacher.email || "Teacher"}</p>
                          {hasConv && (
                            <p className="text-xs text-blue-400 font-medium mt-0.5">Existing conversation</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
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

export default AdminMessages;
