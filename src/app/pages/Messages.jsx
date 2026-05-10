import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Bell,
  MessageSquare,
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Download,
} from "lucide-react";

const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

const getAttachmentKindFromFileType = (fileType) => {
  const type = String(fileType || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type) return "document";
  return "";
};

const sanitizeAttachmentFileName = (fileName) =>
  String(fileName || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

export function Messages() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [allRecipients, setAllRecipients] = useState([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    const init = async () => {
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

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", user.email)
          .maybeSingle();

        if (error || !profile?.id) {
          console.error("[Messages] Could not resolve student profile:", error);
          navigate("/login");
          return;
        }

        setStudentId(String(profile.id));
        await loadConversationsFromDB(String(profile.id));
        await loadRecipients(String(profile.id));
      } catch (err) {
        console.error("[Messages] Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const loadRecipients = async (studentIdToExclude) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role")
        .in("role", ["teacher", "admin"])
        .order("role", { ascending: true })
        .limit(100);

      if (error) {
        console.error("[Messages] Failed to load recipients:", error);
        return;
      }

      setAllRecipients(
        (data || [])
          .map((row) => ({
            id: String(row.id),
            name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ") || "User",
            email: String(row.email || ""),
            role: String(row.role || "teacher"),
          }))
          .filter((row) => row.id !== studentIdToExclude)
      );
    } catch (err) {
      console.error("[Messages] Recipient load error:", err);
    }
  };

  const loadConversationsFromDB = async (studentIdToLoad) => {
    if (!studentIdToLoad) return;

    try {
      const { data: messageRows, error } = await supabase
        .from("messages")
        .select(
          "id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size"
        )
        .or(`sender_id.eq.${studentIdToLoad},receiver_id.eq.${studentIdToLoad}`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[Messages] Failed to load messages:", error);
        return;
      }

      const counterpartIds = [
        ...new Set(
          (messageRows || [])
            .map((row) => {
              const senderId = String(row.sender_id || "");
              const receiverId = String(row.receiver_id || "");
              return senderId === studentIdToLoad ? receiverId : senderId;
            })
            .filter(Boolean)
        ),
      ];

      const profileMap = new Map();
      if (counterpartIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, middle_name, last_name, role")
          .in("id", counterpartIds);

        (profiles || []).forEach((profile) => {
          profileMap.set(String(profile.id), {
            id: String(profile.id),
            name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "User",
            role: String(profile.role || "teacher"),
          });
        });
      }

      const conversationsByParticipant = new Map();
      (messageRows || []).forEach((row) => {
        const senderId = String(row.sender_id || "");
        const receiverId = String(row.receiver_id || "");
        const counterpartId = senderId === studentIdToLoad ? receiverId : senderId;
        if (!counterpartId) return;

        const profile = profileMap.get(counterpartId) || { name: "Unknown User", role: "teacher" };
        const existing = conversationsByParticipant.get(counterpartId);
        const conversation = existing || {
          id: `conv_${counterpartId}`,
          participantId: counterpartId,
          participantName: profile.name,
          participantRole: profile.role,
          messages: [],
          lastMessageTime: new Date().toISOString(),
          lastMessage: "",
          unreadCount: 0,
        };

        const attachmentKind = getAttachmentKindFromFileType(row.file_type);
        conversation.messages.push({
          id: String(row.id),
          isOwn: senderId === studentIdToLoad,
          content: row.content || row.message_text || "",
          timestamp: row.timestamp || row.created_at,
          fileUrl: String(row.file_url || "").trim(),
          fileName: String(row.file_name || "").trim(),
          fileType: String(row.file_type || "").trim(),
          fileSize: Number(row.file_size || 0),
          attachmentKind,
        });

        conversation.lastMessage = row.content || row.message_text || "";
        conversation.lastMessageTime = row.timestamp || row.created_at;
        conversationsByParticipant.set(counterpartId, conversation);
      });

      const loadedConversations = Array.from(conversationsByParticipant.values()).sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(loadedConversations);
      if (!selectedConversationId && loadedConversations.length > 0) {
        setSelectedConversationId(loadedConversations[0].id);
      }
    } catch (err) {
      console.error("[Messages] Error loading conversations:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;

  const filteredConversations = conversations.filter((conversation) =>
    conversation.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedMessages = selectedConversation
    ? selectedConversation.messages.filter((msg) =>
        msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
      )
    : [];

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

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
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleConversationClick = (conversation) => {
    setSelectedConversationId(conversation.id);
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setAttachmentFile(null);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setPageError("File too large. Max 50MB.");
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAttachmentFile(file);
    setPageError("");
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !attachmentFile) || !selectedConversation || !studentId) return;

    const now = new Date().toISOString();
    let uploadedFileUrl = "";
    let uploadedFileType = "";
    let uploadedFileName = "";
    let uploadedFileSize = 0;

    if (attachmentFile) {
      const cleanedName = sanitizeAttachmentFileName(attachmentFile.name);
      const filePath = `${studentId}/${selectedConversation.participantId}/${Date.now()}_${cleanedName}`;
      const uploadResult = await supabase.storage
        .from(MESSAGE_ATTACHMENT_BUCKET)
        .upload(filePath, attachmentFile, { cacheControl: "3600", upsert: false });

      if (uploadResult.error) {
        console.error("[Messages] Attachment upload failed:", uploadResult.error);
      } else {
        const publicUrlResult = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET).getPublicUrl(filePath);
        uploadedFileUrl = String(publicUrlResult?.data?.publicUrl || "").trim();
        uploadedFileType = String(attachmentFile.type || "application/octet-stream").trim();
        uploadedFileName = cleanedName;
        uploadedFileSize = Number(attachmentFile.size || 0);
      }
    }

    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: studentId,
        receiver_id: selectedConversation.participantId,
        message_text: messageInput.trim() || (attachmentFile ? "Sent an attachment" : ""),
        content: messageInput.trim() || (attachmentFile ? "Sent an attachment" : ""),
        timestamp: now,
        file_url: uploadedFileUrl || null,
        file_name: uploadedFileName || null,
        file_type: uploadedFileType || null,
        file_size: uploadedFileSize || null,
      });

      if (error) {
        console.error("[Messages] Failed to send message:", error);
      }

      await loadConversationsFromDB(studentId);
      setMessageInput("");
      clearAttachment();
    } catch (err) {
      console.error("[Messages] Send error:", err);
    }
  };

  const filteredRecipients = allRecipients.filter((person) => {
    const lower = recipientSearch.toLowerCase();
    return (
      person.name.toLowerCase().includes(lower) ||
      person.email.toLowerCase().includes(lower) ||
      person.role.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
              <p className="text-sm text-gray-500 mt-1">Chat with teachers and admins.</p>
            </div>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-6 h-6 text-gray-600" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold leading-none text-white bg-emerald-600 rounded-full">
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading messages...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Conversations List */}
            <div className="w-full md:w-96 border-r border-gray-200 bg-white flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Conversations</h3>
                    <p className="text-sm text-gray-500">{conversations.length} chats</p>
                  </div>
                  <button
                    onClick={() => setShowNewMessage(true)}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    New
                  </button>
                </div>
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
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleConversationClick(conversation)}
                    className={`w-full text-left p-4 border-b border-gray-200 transition-colors ${
                      selectedConversationId === conversation.id
                        ? "bg-emerald-50 border-l-4 border-emerald-600"
                        : "hover:bg-gray-50"
                    }`}
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
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(conversation.participantRole)}`}>
                            {conversation.participantRole}
                          </span>
                          <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {filteredConversations.length === 0 && (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">No conversations found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 flex flex-col bg-white">
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {selectedConversation.participantName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{selectedConversation.participantName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedConversation.participantRole)}`}>
                            {selectedConversation.participantRole}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-1 md:max-w-xs ml-auto">
                        <div className="relative w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                          <input
                            type="text"
                            placeholder="Search in chat..."
                            value={messageSearchQuery}
                            onChange={(e) => setMessageSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-emerald-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-emerald-400 text-emerald-900"
                          />
                        </div>
                        <button className="p-2 hover:bg-emerald-100/50 rounded-lg transition-colors flex-shrink-0">
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4 bg-gray-50">
                    {displayedMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-md ${message.isOwn ? "order-2" : "order-1"}`}>
                          <div className={`rounded-2xl px-4 py-3 ${message.isOwn ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white" : "bg-white border border-gray-200 text-gray-900"}`}>
                            {message.attachmentKind === "image" && message.fileUrl && (
                              <img src={message.fileUrl} alt={message.fileName || "attachment"} className="rounded-xl mb-3 max-w-full" />
                            )}
                            {message.attachmentKind === "video" && message.fileUrl && (
                              <video controls src={message.fileUrl} className="rounded-xl mb-3 max-w-full" />
                            )}
                            {message.attachmentKind === "document" && message.fileUrl && (
                              <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline mb-3">
                                <Download className="w-4 h-4" />
                                {message.fileName || "Download attachment"}
                              </a>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className={`text-xs text-gray-500 mt-1 ${message.isOwn ? "text-right" : "text-left"}`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {displayedMessages.length === 0 && (
                      <div className="text-center py-8 text-gray-500">No messages found.</div>
                    )}
                  </div>

                  <div className="p-4 border-t border-gray-200 bg-white">
                    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachmentChange} accept="*/*" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                        <Paperclip className="w-5 h-5 text-gray-600" />
                      </button>
                      <div className="flex-1 flex flex-col gap-2">
                        {attachmentFile && (
                          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
                            <div className="truncate">{attachmentFile.name}</div>
                            <button type="button" onClick={clearAttachment} className="text-emerald-700 hover:text-emerald-900">
                              Remove
                            </button>
                          </div>
                        )}
                        <textarea
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder="Type a message..."
                          rows={1}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={(!messageInput.trim() && !attachmentFile)}
                        className="p-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-gray-600">Choose a conversation from the list to start messaging.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Messages;
