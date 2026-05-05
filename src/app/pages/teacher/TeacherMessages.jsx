import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Search,
  Send,
  Plus,
  X,
  Paperclip,
  MessageSquare,
  Users,
  Clock,
  ChevronRight,
  FileText,
  Download,
  Video,
  AtSign,
  CheckCheck,
  Circle,
} from "lucide-react";

const MESSAGE_TABLE = "messages";
const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "txt"];

const FILTERS = [
  { key: "all",       label: "All",        icon: MessageSquare },
  { key: "unread",    label: "Unread",     icon: Circle },
  { key: "read",      label: "Read",       icon: CheckCheck },
  { key: "mentions",  label: "Mentions",   icon: AtSign },
  { key: "videomeet", label: "Video Meet", icon: Video },
];

const buildStudentName = (row) => {
  const fullName = [row?.first_name, row?.middle_name, row?.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;
  if (String(row?.name || "").trim()) return String(row.name).trim();
  if (String(row?.full_name || "").trim()) return String(row.full_name).trim();
  return "Student";
};

const toConversationMessage = (row, currentTeacherId, teacherDisplayName) => {
  const fromTeacher = String(row?.sender_id || "") === String(currentTeacherId || "");
  const fileType = String(row?.file_type || "").trim();
  const attachmentKind = fileType.startsWith("image/")
    ? "image"
    : fileType.startsWith("video/")
      ? "video"
      : fileType
        ? "document"
        : "";

  return {
    id: String(row?.id || `${Date.now()}_${Math.random()}`),
    from: fromTeacher ? "teacher" : "student",
    senderName: fromTeacher ? teacherDisplayName : "Student",
    text: String(row?.message_text || "").trim(),
    time: String(row?.timestamp || row?.created_at || new Date().toISOString()),
    fileUrl: String(row?.file_url || "").trim(),
    fileName: String(row?.file_name || "").trim(),
    fileType,
    fileSize: Number(row?.file_size || 0),
    attachmentKind,
  };
};

const getAttachmentKindFromFile = (file) => {
  const mimeType = String(file?.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
};

const isSupportedAttachment = (file) => {
  const mimeType = String(file?.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return true;
  if (mimeType.startsWith("video/")) return true;

  const fileName = String(file?.name || "").toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  return ACCEPTED_ATTACHMENT_EXTENSIONS.includes(String(extension || ""));
};

const sanitizeAttachmentFileName = (fileName) =>
  String(fileName || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

const getMessagePreview = (message) => {
  const text = String(message?.text || "").trim();
  if (text) return text;
  if (message?.attachmentKind === "image") return "Sent an image";
  if (message?.attachmentKind === "video") return "Sent a video";
  if (message?.fileName) return `Sent ${message.fileName}`;
  if (message?.fileUrl) return "Sent an attachment";
  return "";
};

function TeacherMessages() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const messageContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  // New message modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [allStudents, setAllStudents] = useState([]);

  const saveConversations = (updated) => {
    setConversations(updated);
  };

  const resolveTeacherId = useCallback(async (email) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (error || !data) return null;
      return String(data.id);
    } catch {
      return null;
    }
  }, []);

  const fetchStudents = useCallback(async (currentTeacherId) => {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, profiles(id, first_name, middle_name, last_name, name, full_name, email)")
        .eq("teacher_id", currentTeacherId);
      if (error || !data) return [];
      return data.map((row) => ({
        id: String(row.profiles?.id || row.student_id),
        name: buildStudentName(row.profiles),
        email: String(row.profiles?.email || ""),
      }));
    } catch {
      return [];
    }
  }, []);

  const fetchConversationMessages = useCallback(async (currentTeacherId, studentIds) => {
    try {
      const { data, error } = await supabase
        .from(MESSAGE_TABLE)
        .select("id, sender_id, receiver_id, message_text, timestamp, created_at, file_url, file_name, file_type, file_size")
        .or(
          studentIds
            .map((sid) => `and(sender_id.eq.${currentTeacherId},receiver_id.eq.${sid}),and(sender_id.eq.${sid},receiver_id.eq.${currentTeacherId})`)
            .join(",")
        )
        .order("timestamp", { ascending: true });
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }, []);

  const loadConversations = useCallback(async (currentTeacherId, students) => {
    const conversationsByStudent = new Map();

    students.forEach((student) => {
      conversationsByStudent.set(student.id, {
        id: student.id,
        participantId: student.id,
        participantName: student.name,
        participantRole: "Student",
        messages: [],
        unreadCount: 0,
        lastMessageTime: new Date(0).toISOString(),
        isVideoMeet: false,
      });
    });

    const studentIds = students.map((s) => s.id);

    if (studentIds.length > 0) {
      try {
        const rows = await fetchConversationMessages(currentTeacherId, studentIds);
        rows.forEach((row) => {
          const senderId = String(row.sender_id || "");
          const receiverId = String(row.receiver_id || "");
          const studentId = senderId === currentTeacherId ? receiverId : senderId;
          const conversation = conversationsByStudent.get(studentId);
          if (!conversation) return;
          conversation.messages.push(toConversationMessage(row, currentTeacherId, teacherName));
          conversation.lastMessageTime = String(row.timestamp || row.created_at || conversation.lastMessageTime);
        });
      } catch (error) {
        console.error("Failed to load messages:", error);
        setPageError("Unable to load message history. Please run the latest database migration for messages.");
      }
    }

    const mapped = Array.from(conversationsByStudent.values()).sort(
      (left, right) => new Date(right.lastMessageTime).getTime() - new Date(left.lastMessageTime).getTime()
    );

    saveConversations(mapped);

    if (mapped.length === 0) {
      setSelectedConvId(null);
      return;
    }

    const stillExists = mapped.some((item) => item.id === selectedConvId);
    if (!stillExists) {
      setSelectedConvId(mapped[0].id);
    }
  }, [fetchConversationMessages, selectedConvId, teacherName]);

  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) {
        navigate("/login");
        return;
      }

      const user = JSON.parse(userData);
      if (user.role !== "teacher") {
        navigate("/login");
        return;
      }

      setTeacherName(String(user.name || "Teacher"));
      setPageError("");

      const resolvedTeacherId = await resolveTeacherId(user.email);
      if (!resolvedTeacherId) {
        setPageError("Unable to resolve teacher account. Please sign in again.");
        setLoading(false);
        return;
      }

      setTeacherId(resolvedTeacherId);
      const students = await fetchStudents(resolvedTeacherId);
      setAllStudents(students);
      await loadConversations(resolvedTeacherId, students);
      setLoading(false);
    };

    initialize();
  }, [navigate, resolveTeacherId, fetchStudents, loadConversations]);

  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedConvId, conversations]);

  useEffect(() => {
    if (!supabase || !teacherId) return;

    const channel = supabase
      .channel(`teacher-messages-${teacherId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: MESSAGE_TABLE }, async () => {
        const students = await fetchStudents(teacherId);
        await loadConversations(teacherId, students);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, fetchStudents, loadConversations]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;

  const applyFilter = (convList) => {
    let filtered = convList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.participantName.toLowerCase().includes(q) ||
          c.classCode?.toLowerCase().includes(q)
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
            m.from !== "teacher" && m.text && m.text.includes(`@${teacherName}`)
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

  const handleStartConversation = (student) => {
    const existing = conversations.find((c) => c.participantId === student.id);
    if (existing) {
      setSelectedConvId(existing.id);
      setShowNewModal(false);
      setStudentSearch("");
      return;
    }

    const newConv = {
      id: String(student.id),
      participantId: student.id,
      participantName: student.name,
      participantRole: "Student",
      classCode: student.classCode,
      className: student.className,
      section: student.section,
      messages: [],
      unreadCount: 0,
      lastMessageTime: new Date().toISOString(),
      isVideoMeet: false,
    };

    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setSelectedConvId(newConv.id);
    setShowNewModal(false);
    setStudentSearch("");
  };

  const handleSend = async (e) => {
    e.preventDefault();

    const text = String(messageInput || "").trim();
    if ((!text && !attachmentFile) || !selectedConv || !teacherId || !supabase) return;

    const now = new Date().toISOString();
    let uploadedFileUrl = "";
    let uploadedFileName = "";
    let uploadedFileType = "";
    let uploadedFileSize = 0;

    if (attachmentFile) {
      if (!isSupportedAttachment(attachmentFile)) {
        setPageError("Unsupported file type. Please upload image, video, or supported document files.");
        return;
      }

      if (attachmentFile.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setPageError("File is too large. Maximum allowed size is 20MB.");
        return;
      }

      setIsUploadingAttachment(true);

      const cleanedName = sanitizeAttachmentFileName(attachmentFile.name);
      const filePath = `${teacherId}/${selectedConv.participantId}/${Date.now()}_${cleanedName}`;

      const uploadResult = await supabase.storage
        .from(MESSAGE_ATTACHMENT_BUCKET)
        .upload(filePath, attachmentFile, { cacheControl: "3600", upsert: false });

      if (uploadResult.error) {
        console.error("Failed to upload attachment:", uploadResult.error);
        setPageError("Unable to upload attachment. Please verify message attachment storage is configured.");
        setIsUploadingAttachment(false);
        return;
      }

      const publicUrlResult = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET).getPublicUrl(filePath);
      uploadedFileUrl = String(publicUrlResult?.data?.publicUrl || "").trim();
      uploadedFileName = cleanedName;
      uploadedFileType = String(attachmentFile.type || "application/octet-stream").trim();
      uploadedFileSize = Number(attachmentFile.size || 0);
      setIsUploadingAttachment(false);
    }

    const { data, error } = await supabase
      .from(MESSAGE_TABLE)
      .insert({
        sender_id: teacherId,
        receiver_id: selectedConv.participantId,
        message_text: text || null,
        timestamp: now,
        file_url: uploadedFileUrl || null,
        file_name: uploadedFileName || null,
        file_type: uploadedFileType || null,
        file_size: uploadedFileSize || null,
      })
      .select("id, sender_id, receiver_id, message_text, timestamp, created_at, file_url, file_name, file_type, file_size")
      .single();

    if (error) {
      console.error("Failed to send message:", error);
      setPageError("Unable to send message. Please ensure the latest messages and attachment migrations are applied.");
      setIsUploadingAttachment(false);
      return;
    }

    const msg = {
      ...(data ? toConversationMessage(data, teacherId, teacherName) : {}),
      id: String(data?.id || Date.now()),
      from: "teacher",
      senderName: teacherName,
      text,
      time: String(data?.timestamp || now),
      fileUrl: String(data?.file_url || uploadedFileUrl || "").trim(),
      fileName: String(data?.file_name || uploadedFileName || "").trim(),
      fileType: String(data?.file_type || uploadedFileType || "").trim(),
      fileSize: Number(data?.file_size || uploadedFileSize || 0),
      attachmentKind: data?.file_type
        ? (String(data.file_type).startsWith("image/") ? "image" : String(data.file_type).startsWith("video/") ? "video" : "document")
        : (attachmentFile ? getAttachmentKindFromFile(attachmentFile) : ""),
    };

    const updated = conversations.map((c) =>
      c.id === selectedConv.id
        ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
        : c
    );

    saveConversations(updated);
    setMessageInput("");
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsUploadingAttachment(false);
    setPageError("");
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setAttachmentFile(null);
      return;
    }

    if (!isSupportedAttachment(file)) {
      setPageError("Unsupported file type. Please upload image, video, or supported document files.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setPageError("File is too large. Maximum allowed size is 20MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAttachmentFile(file);
    setPageError("");
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  const filteredStudents = allStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.classCode?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.className?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const filterCounts = {
    all: conversations.length,
    unread: conversations.filter((c) => (c.unreadCount || 0) > 0).length,
    read: conversations.filter((c) => (c.unreadCount || 0) === 0 && !c.isVideoMeet).length,
    mentions: conversations.filter((c) =>
      (c.messages || []).some((m) => m.from !== "teacher" && m.text?.includes(`@${teacherName}`))
    ).length,
    videomeet: conversations.filter((c) => c.isVideoMeet === true).length,
  };

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
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Teacher Portal</p>
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
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg flex-shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-7 h-7 opacity-80" />
                <div>
                  <h1 className="text-xl font-bold">Messages</h1>
                  <p className="text-emerald-100 text-sm">
                    {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                    {totalUnread > 0 && ` · ${totalUnread} unread`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowNewModal(true); setStudentSearch(""); }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm rounded-xl font-semibold text-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                New Message
              </button>
            </div>
          </div>

          {pageError && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl px-4 py-3 text-sm flex items-start gap-2 flex-shrink-0">
              <Clock className="w-4 h-4 mt-0.5" />
              <span>{pageError}</span>
            </div>
          )}

          {/* Main chat layout */}
          <div className="flex-1 overflow-hidden bg-gray-900/60 rounded-xl border border-white/10 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            {/* Left: Conversations List */}
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
                    className="w-full pl-9 pr-3 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => { setShowNewModal(true); setStudentSearch(""); }}
                  className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex-shrink-0"
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
                          ? "bg-emerald-600 text-white shadow-sm"
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
                              ? "bg-emerald-500/20 text-emerald-400"
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
                        <AtSign className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <MessageSquare className="w-6 h-6 text-emerald-400" />
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
                            ? "bg-emerald-500/8 border-l-2 border-emerald-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                conv.isVideoMeet
                                  ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
                              }`}
                            >
                              {conv.isVideoMeet ? (
                                <Video className="w-4 h-4" />
                              ) : (
                                conv.participantName.charAt(0).toUpperCase()
                              )}
                            </div>
                            {conv.isVideoMeet && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
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
                              <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                {conv.isVideoMeet && (
                                  <span className="text-blue-400 font-medium">Video Meet</span>
                                )}
                                {!conv.isVideoMeet && conv.classCode}
                                {!conv.isVideoMeet && conv.section && ` · ${conv.section}`}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            {conv.messages?.length > 0 && (
                              <p className="text-xs text-gray-300 truncate mt-0.5">
                                {getMessagePreview(conv.messages[conv.messages.length - 1])}
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

            {/* Right: Chat Window */}
            <div className="lg:col-span-2 flex flex-col">
              {selectedConv ? (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        selectedConv.isVideoMeet
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                          : "bg-gradient-to-br from-emerald-500 to-teal-600"
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
                          <><Video className="w-3 h-3 text-blue-400" /> <span className="text-blue-400">Video Meet Chat</span></>
                        ) : (
                          <>Student · {selectedConv.classCode} {selectedConv.section && `— ${selectedConv.section}`}</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div
                    ref={messageContainerRef}
                    className="h-[300px] sm:h-[360px] lg:h-[400px] w-full overflow-y-auto overflow-x-hidden scrollbar-hide p-6 space-y-3"
                  >
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
                        const hasMention = !isTeacher && msg.text?.includes(`@${teacherName}`);
                        return (
                          <div key={msg.id} className={`flex ${isTeacher ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                isTeacher
                                  ? "bg-emerald-600 text-white rounded-br-sm"
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
                              {msg.attachmentKind === "image" && msg.fileUrl && (
                                <img src={msg.fileUrl} alt={msg.fileName || "image"} className="rounded-lg max-w-full mb-2" />
                              )}
                              {msg.attachmentKind === "document" && msg.fileUrl && (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs underline mb-2"
                                >
                                  <FileText className="w-4 h-4" />
                                  {msg.fileName || "Download file"}
                                  <Download className="w-3 h-3" />
                                </a>
                              )}
                              {msg.text && <p className="leading-relaxed">{msg.text}</p>}
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

                  {/* Attachment Preview */}
                  {attachmentFile && (
                    <div className="px-6 py-2 border-t border-white/5 flex items-center gap-2 text-sm text-gray-300">
                      <Paperclip className="w-4 h-4 text-emerald-400" />
                      <span className="truncate">{attachmentFile.name}</span>
                      <button onClick={clearAttachment} className="ml-auto text-gray-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Input */}
                  <form
                    onSubmit={handleSend}
                    className="px-6 py-4 border-t border-white/10 flex items-center gap-2 flex-shrink-0"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleAttachmentChange}
                      accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-gray-400 hover:text-emerald-400 transition-colors flex-shrink-0"
                      title="Attach file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={`Message ${selectedConv.participantName}...`}
                      className="flex-1 px-4 py-2.5 bg-black/20 border border-white/20 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={(!messageInput.trim() && !attachmentFile) || isUploadingAttachment}
                      className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">Select a conversation</h3>
                  <p className="text-gray-500 text-sm mb-5">Choose a conversation or start a new one.</p>
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

      {/* NEW MESSAGE MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">New Message</h3>
                  <p className="text-sm text-gray-400">Select a student to message</p>
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
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students by name, ID, or class..."
                  className="w-full pl-9 pr-4 py-2.5 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {allStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No students enrolled in your classes yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Add students to a class first.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
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
                        className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-white/5 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{student.name}</p>
                          <p className="text-xs text-gray-500">
                            {student.studentId} · {student.classCode}{student.section && ` — ${student.section}`}
                          </p>
                          {hasConv && (
                            <p className="text-xs text-emerald-400 font-medium mt-0.5">Existing conversation</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
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