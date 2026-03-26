import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import {
  Bell,
  MessageSquare,
  Search,
  Send,
  Paperclip,
  MoreVertical
} from "lucide-react";
function Messages() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [conversations, setConversations] = useState([]);
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
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const handleConversationClick = (conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unreadCount > 0) {
      setConversations(
        (prev) => prev.map((c) => c.id === conversation.id ? { ...c, unreadCount: 0 } : c)
      );
    }
  };
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;
    const newMessage = {
      id: `m${Date.now()}`,
      senderId: "current",
      senderName: "You",
      senderRole: "Student",
      content: messageInput,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      isOwn: true
    };
    setConversations(
      (prev) => prev.map(
        (c) => c.id === selectedConversation.id ? {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: messageInput,
          lastMessageTime: (/* @__PURE__ */ new Date()).toISOString()
        } : c
      )
    );
    setSelectedConversation(
      (prev) => prev ? { ...prev, messages: [...prev.messages, newMessage] } : null
    );
    setMessageInput("");
  };
  const filteredConversations = conversations.filter(
    (conversation) => conversation.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const getRoleColor = (role) => {
    switch (role) {
      case "Teacher":
        return "bg-emerald-100 text-emerald-700";
      case "Admin":
        return "bg-red-100 text-red-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = /* @__PURE__ */ new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1e3 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {
    /* Top Bar */
  }
        <div className="bg-white border-b border-gray-200 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
              </div>
              <div className="flex items-center gap-4">
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="w-6 h-6 text-gray-600" />
                  {notifications > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications}
                    </span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {
    /* Messages Container */
  }
        <div className="flex-1 flex overflow-hidden">
          {
    /* Conversations List */
  }
          <div className="w-full md:w-96 border-r border-gray-200 bg-white flex flex-col">
            {
    /* Header */
  }
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Conversations</h3>
                {totalUnread > 0 && <span className="px-2 py-1 bg-emerald-600 text-white text-xs font-medium rounded-full">
                    {totalUnread} new
                  </span>}
              </div>

              {
    /* Search */
  }
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
    type="text"
    placeholder="Search conversations..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
              </div>
            </div>

            {
    /* Conversation List */
  }
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredConversations.map((conversation) => <div
    key={conversation.id}
    onClick={() => handleConversationClick(conversation)}
    className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${selectedConversation?.id === conversation.id ? "bg-emerald-50 border-l-4 border-l-emerald-600" : "hover:bg-gray-50"}`}
  >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {conversation.participantName.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {conversation.participantName}
                        </h4>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(conversation.lastMessageTime)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(conversation.participantRole)}`}>
                          {conversation.participantRole}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate flex-1">
                          {conversation.lastMessage}
                        </p>
                        {conversation.unreadCount > 0 && <span className="ml-2 w-5 h-5 bg-emerald-600 text-white text-xs font-medium rounded-full flex items-center justify-center flex-shrink-0">
                            {conversation.unreadCount}
                          </span>}
                      </div>
                    </div>
                  </div>
                </div>)}

              {filteredConversations.length === 0 && <div className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No conversations found</p>
                </div>}
            </div>
          </div>

          {
    /* Message Thread */
  }
          <div className="flex-1 flex flex-col bg-white">
            {selectedConversation ? <>
                {
    /* Thread Header */
  }
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center text-white font-semibold">
                        {selectedConversation.participantName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {selectedConversation.participantName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedConversation.participantRole)}`}>
                          {selectedConversation.participantRole}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {
    /* Messages */
  }
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-gray-50">
                  {selectedConversation.messages.map((message) => <div
    key={message.id}
    className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
  >
                      <div className={`max-w-md ${message.isOwn ? "order-2" : "order-1"}`}>
                        <div
    className={`rounded-2xl px-4 py-3 ${message.isOwn ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white" : "bg-white border border-gray-200 text-gray-900"}`}
  >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <p className={`text-xs text-gray-500 mt-1 ${message.isOwn ? "text-right" : "text-left"}`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>)}
                </div>

                {
    /* Message Input */
  }
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-end gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Paperclip className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex-1 relative">
                      <textarea
    value={messageInput}
    onChange={(e) => setMessageInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    }}
    placeholder="Type a message..."
    rows={1}
    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
  />
                    </div>
                    <button
    onClick={handleSendMessage}
    disabled={!messageInput.trim()}
    className="p-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </> : <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Select a conversation
                  </h3>
                  <p className="text-gray-600">
                    Choose a conversation from the list to start messaging
                  </p>
                </div>
              </div>}
          </div>
        </div>
      </main>
    </div>;
}
export {
  Messages
};
