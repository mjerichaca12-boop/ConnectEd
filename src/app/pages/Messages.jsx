import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";
// supabaseAdmin uses the service-role key and bypasses RLS — used for message read/write
const db = supabaseAdmin || supabase;
import {
  Bell,
  MessageSquare,
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Edit2,
  Users,
  Download,
  X,
  ArrowLeft,
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
  const messagesBottomRef = useRef(null);
  const selectedConvIdRef = useRef(null);

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
  const [showThread, setShowThread] = useState(false);
  const [pageError, setPageError] = useState("");

  // Group management states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState("leave"); // "leave" | "delete"

  const handleOpenRename = () => {
    if (!selectedConversation || !selectedConversation.isGroup) return;
    setShowGroupMenu(false);
    setRenameValue(String(selectedConversation.participantName || ""));
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    const newName = String(renameValue || "").trim();
    if (!newName) { setPageError("Group name cannot be empty."); return; }
    if (!selectedConversation) return;
    try {
      const { error } = await db.from("groupchats").update({ name: newName }).eq("id", selectedConversation.id);
      if (error) throw error;
      const updated = conversations.map((c) => c.id === selectedConversation.id ? { ...c, participantName: newName } : c);
      setConversations(updated);
      setShowRenameModal(false);
      setPageError("");
    } catch (err) { 
      console.error("[Messages] Rename error:", err);
      setPageError(err.message || "Unable to rename group."); 
    }
  };

  const handleLeaveConversation = async () => {
    if (!selectedConversation || !studentId) return;
    try {
      const { error } = await db
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", selectedConversation.id)
        .eq("profile_id", studentId);
      
      if (error) throw error;
      
      const remaining = conversations.filter((c) => c.id !== selectedConversation.id);
      setConversations(remaining);
      setShowDeleteConfirm(false);
      setShowGroupMenu(false);
      setSelectedConversationId(remaining.length ? remaining[0].id : null);
      setPageError("");
    } catch (err) {
      console.error("[Messages] Leave error:", err);
      setPageError("Unable to leave group chat.");
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    try { 
      const { error } = await db.from("groupchats").delete().eq("id", selectedConversation.id);
      if (error) throw error;
      
      const remaining = conversations.filter((c) => c.id !== selectedConversation.id);
      setConversations(remaining);
      setShowDeleteConfirm(false);
      setShowGroupMenu(false);
      setSelectedConversationId(remaining.length ? remaining[0].id : null);
      setPageError("");
    } catch (err) {
      console.error("[Messages] Delete error:", err);
      setPageError("Unable to delete conversation.");
    }
  };

  useEffect(() => {
    const init = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) {
        navigate("/login");
        return;
      }
      const user = JSON.parse(userData);
      
      // Redirect based on role if they are in the wrong place
      if (user.role === "teacher") {
        navigate("/teacher/messages", { replace: true });
        return;
      }
      if (user.role === "admin") {
        navigate("/admin/messages", { replace: true });
        return;
      }
      if (user.role !== "student") {
        navigate("/login");
        return;
      }

      setStudentName(user.name);

      try {
        const { data: profile, error } = await db
          .from("profiles")
          .select("id")
          .ilike("email", user.email)
          .order("is_verified", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[Messages] Profile lookup error:", error);
          setPageError("Error loading profile. Some features may be limited.");
        }

        const resolvedId = profile?.id ? String(profile.id) : null;
        if (resolvedId) {
          setStudentId(resolvedId);
          await loadConversationsFromDB(resolvedId);
          await loadRecipients(resolvedId);
        } else {
          console.warn("[Messages] Profile not found in database for email:", user.email);
          setPageError("Student profile not found. You can receive but might not be able to send messages.");
        }
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
      const { data, error } = await db
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

  // Real-time subscription — reload messages whenever a new message arrives
  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`student-messages-${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const row = payload.new;
        if (String(row.sender_id) === studentId || String(row.receiver_id) === studentId) {
          await loadConversationsFromDB(studentId);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const loadConversationsFromDB = async (studentIdToLoad) => {
    if (!studentIdToLoad) return;

    try {
      const { data: messageRows, error } = await db
        .from("messages")
        .select(
          "id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size"
        )
        .or(`sender_id.eq.${studentIdToLoad},receiver_id.eq.${studentIdToLoad}`)
        .is("conversation_id", null)
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
        const { data: profiles } = await db
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

      // Load group conversations
      const { data: participantRows, error: participantError } = await db
        .from("conversation_participants")
        .select("conversation_id, profile_id")
        .eq("profile_id", studentIdToLoad);

      const groupConvsList = [];
      if (!participantError && participantRows && participantRows.length > 0) {
        const conversationIds = [...new Set(participantRows.map((row) => row.conversation_id))];

        const { data: conversationData, error: convError } = await db
          .from("groupchats")
          .select("id, name, is_group, created_by")
          .in("id", conversationIds)
          .eq("is_group", true);

        if (!convError && conversationData) {
          for (const conv of conversationData) {
            // Load participants for this group
            const { data: groupParticipants, error: groupPartError } = await db
              .from("conversation_participants")
              .select("profile_id")
              .eq("conversation_id", conv.id);

            if (!groupPartError && groupParticipants) {
              const participantIds = [...new Set(groupParticipants.map((p) => p.profile_id))];
              
              // Load messages for this group conversation
              const { data: groupMessages, error: groupMsgError } = await db
                .from("messages")
                .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: true });

              const groupMsgObjs = (groupMessages || []).map((row) => {
                const senderId = String(row.sender_id || "");
                const attachmentKind = getAttachmentKindFromFileType(row.file_type);
                return {
                  id: String(row.id),
                  isOwn: senderId === studentIdToLoad,
                  content: row.content || row.message_text || "",
                  timestamp: row.timestamp || row.created_at,
                  fileUrl: String(row.file_url || "").trim(),
                  fileName: String(row.file_name || "").trim(),
                  fileType: String(row.file_type || "").trim(),
                  fileSize: Number(row.file_size || 0),
                  attachmentKind,
                };
              });

              groupConvsList.push({
                id: conv.id,
                participantId: "",
                participantIds: participantIds,
                participantName: conv.name || `${participantIds.length} members`,
                participantRole: "group",
                messages: groupMsgObjs,
                lastMessageTime: groupMsgObjs.length > 0 
                  ? groupMsgObjs[groupMsgObjs.length - 1].timestamp 
                  : conv.created_at || new Date().toISOString(),
                lastMessage: groupMsgObjs.length > 0
                  ? groupMsgObjs[groupMsgObjs.length - 1].content
                  : "No messages yet",
                unreadCount: 0,
                isGroup: true,
              });
            }
          }
        }
      }

      const allConversations = [...conversationsByParticipant.values(), ...groupConvsList].sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(allConversations);
      if (!selectedConvIdRef.current && allConversations.length > 0) {
        selectedConvIdRef.current = allConversations[0].id;
        setSelectedConversationId(allConversations[0].id);
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
    selectedConvIdRef.current = conversation.id;
    setSelectedConversationId(conversation.id);
    setShowThread(true);
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
      const destId = selectedConversation.isGroup ? selectedConversation.id : selectedConversation.participantId;
      const filePath = `${studentId}/${destId}/${Date.now()}_${cleanedName}`;
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
      const insertPayload = selectedConversation.isGroup
        ? {
            sender_id: studentId,
            conversation_id: selectedConversation.id,
            receiver_id: null,
            message_text: messageInput.trim() || (attachmentFile ? "Sent an attachment" : ""),
            content: messageInput.trim() || (attachmentFile ? "Sent an attachment" : ""),
            timestamp: now,
            file_url: uploadedFileUrl || null,
            file_name: uploadedFileName || null,
            file_type: uploadedFileType || null,
            file_size: uploadedFileSize || null,
          }
        : {
            sender_id: studentId,
            receiver_id: selectedConversation.participantId,
            message_text: messageInput.trim() || (attachmentFile ? "Sent an attachment" : ""),
            content: messageInput.trim() || (attachmentFile ? "Sent an attachment" : ""),
            timestamp: now,
            file_url: uploadedFileUrl || null,
            file_name: uploadedFileName || null,
            file_type: uploadedFileType || null,
            file_size: uploadedFileSize || null,
          };

      const { error } = await db.from("messages").insert(insertPayload);

      if (error) {
        console.error("[Messages] Failed to send message:", error);
        setPageError(`Failed to send message: ${error.message}`);
        return;
      }

      await loadConversationsFromDB(studentId);
      setMessageInput("");
      clearAttachment();
      setTimeout(() => messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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
            <div className={`${showThread ? "hidden md:flex" : "flex"} w-full md:w-96 border-r border-gray-200 bg-white flex-col`}>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Conversations</h3>
                    <p className="text-sm text-gray-500">{conversations.length} chats</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowNewMessage(true);
                      setRecipientSearch("");
                    }}
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
            <div className={`${showThread ? "flex" : "hidden md:flex"} flex-1 flex-col bg-white min-w-0`}>
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowThread(false)}
                          className="md:hidden p-1.5 hover:bg-emerald-100 rounded-lg transition-colors -ml-1 mr-1"
                          aria-label="Back to conversations"
                        >
                          <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {selectedConversation.participantName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{selectedConversation.participantName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getRoleColor(selectedConversation.participantRole)}`}>
                            {selectedConversation.isGroup ? <><Users className="w-3 h-3" /> Group</> : selectedConversation.participantRole}
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
                        <button
                          type="button"
                          onClick={() => setShowGroupMenu((c) => !c)}
                          className="p-2 hover:bg-emerald-100/50 rounded-lg transition-colors flex-shrink-0"
                          title="Group options"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedConversation.isGroup && showGroupMenu && (
                    <div className="relative z-10">
                      <div className="absolute right-6 top-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                        <button type="button" onClick={handleOpenRename} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Edit2 className="w-4 h-4 text-emerald-600" /> Rename Group
                        </button>
                        <button type="button" onClick={() => { setDeleteMode("leave"); setShowGroupMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <X className="w-4 h-4 text-yellow-500" /> Leave Chat
                        </button>
                      </div>
                    </div>
                  )}

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
                    <div ref={messagesBottomRef} />
                  </div>

                  <div className="p-4 border-t border-gray-200 bg-white">
                    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                      <label className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer group focus-within:ring-2 focus-within:ring-emerald-500">
                        <Paperclip className="w-5 h-5 text-gray-600 group-hover:text-emerald-600" />
                        <input 
                          ref={fileInputRef} 
                          type="file" 
                          className="sr-only" 
                          onChange={handleAttachmentChange} 
                          accept="*/*" 
                        />
                      </label>
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
                    <button
                      onClick={() => {
                        setShowNewMessage(true);
                        setRecipientSearch("");
                      }}
                      className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
                    >
                      New Message
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Message Modal */}
        {showNewMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <h3 className="font-bold">New Message</h3>
                <button
                  onClick={() => setShowNewMessage(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search teachers or admins..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {filteredRecipients.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => {
                      // Check if conversation already exists
                      const existing = conversations.find(c => c.participantId === person.id);
                      if (existing) {
                        selectedConvIdRef.current = existing.id;
                        setSelectedConversationId(existing.id);
                      } else {
                        const newConv = {
                          id: `conv_${person.id}`,
                          participantId: person.id,
                          participantName: person.name,
                          participantRole: person.role,
                          messages: [],
                          lastMessageTime: new Date().toISOString(),
                          lastMessage: "No messages yet",
                        };
                        setConversations([newConv, ...conversations]);
                        selectedConvIdRef.current = newConv.id;
                        setSelectedConversationId(newConv.id);
                      }
                      setShowNewMessage(false);
                      setShowThread(true);
                    }}
                    className="w-full p-4 flex items-center gap-3 hover:bg-emerald-50 transition-colors border-b border-gray-50 text-left"
                  >
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                      {person.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{person.name}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                        {person.role}
                      </p>
                    </div>
                  </button>
                ))}
                {filteredRecipients.length === 0 && (
                  <div className="p-8 text-center text-gray-500 italic">No recipients found.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <RenameModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        value={renameValue}
        onChange={setRenameValue}
        onSubmit={handleRenameSubmit}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        mode={deleteMode}
        onSubmit={deleteMode === "delete" ? handleDeleteConversation : handleLeaveConversation}
      />
    </div>
  );
}

const RenameModal = ({ isOpen, onClose, value, onChange, onSubmit }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-emerald-600 text-white">
          <h3 className="text-lg font-bold">Rename Group</h3>
        </div>
        <div className="px-6 py-4 mt-2">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Group name..."
            className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-100 font-semibold transition-colors">Cancel</button>
          <button onClick={onSubmit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm">Rename</button>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({ isOpen, onClose, mode, onSubmit }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        <div className={`px-6 py-5 border-b border-gray-100 ${mode === 'delete' ? 'bg-red-600' : 'bg-yellow-500'} text-white`}>
          <h3 className="text-lg font-bold">{mode === "delete" ? "Delete Conversation" : "Leave Conversation"}</h3>
        </div>
        <div className="px-6 py-4 mt-2">
          <p className="text-gray-700 text-sm leading-relaxed">
            {mode === "delete" 
              ? "Are you sure you want to delete this conversation for everyone? This action cannot be undone." 
              : "Are you sure you want to leave this group chat? You will no longer see new messages."}
          </p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-100 font-semibold transition-colors">Cancel</button>
          <button 
            onClick={onSubmit} 
            className={`px-4 py-2 ${mode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-500 hover:bg-yellow-600'} text-white rounded-xl text-sm font-bold transition-all shadow-sm`}
          >
            {mode === "delete" ? "Delete" : "Leave"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
