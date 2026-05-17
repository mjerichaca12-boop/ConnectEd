import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";
// Use service role client if available to bypass RLS issues for reliable messaging
const db = supabaseAdmin || supabase;
import {
  Search,
  Send,
  Plus,
  Edit2,
  X,
  Paperclip,
  MessageSquare,
  Users,
  Clock,
  Trash2,
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
const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "gif", "mp4", "mp3", "zip", "xlsx", "csv"];

const FILTERS = [
  { key: "all",       label: "All",        icon: MessageSquare },
  { key: "unread",    label: "Unread",     icon: Circle },
  { key: "read",      label: "Read",       icon: CheckCheck },
];

const buildStudentName = (row) => {
  const fullName = [row?.first_name, row?.middle_name, row?.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
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
    isRead: Boolean(row?.is_read),
    isSeen: Boolean(row?.is_read || fromTeacher), // teacher's own messages are always "seen"
  };
};

const getAttachmentKindFromFile = (file) => {
  const mimeType = String(file?.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
};

// Accept all file types for attachments
const isSupportedAttachment = (_file) => true;

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

const buildStableIdList = (ids) =>
  [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];

const getConversationDetailLine = (conv) => {
  if (conv.isVideoMeet) return "Video Meet Chat";
  if (conv.isGroup) return conv.classCode || `${(conv.participantIds || []).length} members`;
  const parts = [conv.classCode, conv.section].filter(Boolean);
  return parts.join(" · ") || conv.participantRole || "Student";
};

function TeacherMessages() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const messageContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationLoadInFlightRef = useRef(false);

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

  const [showNewModal, setShowNewModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientResults, setRecipientResults] = useState([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState("leave");
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);

  const saveConversations = (updated) => setConversations(updated);

  const resolveTeacherId = useCallback(async (email) => {
    try {
      // Try with role=teacher first, prioritize verified accounts, then fall back
      let { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .eq("role", "teacher")
        .order("is_verified", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) return String(data.id);
      // Fallback: match by email without role filter, still prioritize verified
      ({ data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .order("is_verified", { ascending: false })
        .limit(1)
        .maybeSingle());
      if (!error && data) return String(data.id);
      return null;
    } catch { return null; }
  }, []);

  const fetchProfilesByIds = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return [];
    try {
      const { data, error } = await db
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role")
        .in("id", ids);
      if (error || !data) return [];
      return data.map((row) => ({
        id: String(row.id),
        name: buildStudentName(row),
        email: String(row.email || ""),
        role: String(row.role || "student"),
      }));
    } catch { return []; }
  }, []);

  const fetchAllRecipients = useCallback(async (currentTeacherId) => {
    try {
      // Fetch both teachers and students (everyone except current user)
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role")
        .neq("id", currentTeacherId)
        .order("role", { ascending: true })
        .limit(80);
      if (error || !data) return [];
      return data
        .filter((row) => row.role && ["student", "teacher", "admin"].includes(row.role))
        .map((row) => ({
          id: String(row.id),
          name: buildStudentName(row),
          email: String(row.email || ""),
          role: String(row.role || "student"),
          classCode: "",
          section: "",
        }));
    } catch { return []; }
  }, []);

  const fetchRecipientsByQuery = useCallback(async (currentTeacherId, query) => {
    try {
      // Search all roles: teachers, students, admins
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role")
        .neq("id", currentTeacherId)
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(30);
      if (error || !data) return [];
      return data
        .filter((row) => row.role && ["student", "teacher", "admin"].includes(row.role))
        .map((row) => ({
          id: String(row.id),
          name: buildStudentName(row),
          email: String(row.email || ""),
          role: String(row.role || "student"),
          classCode: "",
          section: "",
        }));
    } catch { return []; }
  }, []);

  const loadConversations = useCallback(async (currentTeacherId, teacherDisplayName) => {
    if (conversationLoadInFlightRef.current) {
      conversationLoadInFlightRef.current = "pending";
      return;
    }
    conversationLoadInFlightRef.current = true;
    try {
      // Load direct messages (exclude group messages)
      const { data: messageRows, error: messageError } = await db
        .from(MESSAGE_TABLE)
        .select("id, sender_id, receiver_id, message_text, timestamp, created_at, file_url, file_name, file_type, file_size, is_read")
        .or(`sender_id.eq.${currentTeacherId},receiver_id.eq.${currentTeacherId}`)
        .is("conversation_id", null) // Only load direct messages, not group messages
        .order("created_at", { ascending: true });

      if (messageError) {
        console.error("Failed to load messages:", messageError);
        setPageError("Unable to load message history.");
      }

      const counterpartIds = buildStableIdList((messageRows || []).map((row) => {
        const senderId = String(row.sender_id || "");
        const receiverId = String(row.receiver_id || "");
        return senderId === currentTeacherId ? receiverId : senderId;
      }));

      const profileMap = new Map();
      if (counterpartIds.length > 0) {
        const profiles = await fetchProfilesByIds(counterpartIds);
        profiles.forEach((profile) => profileMap.set(profile.id, profile));
      }

      const conversationsByParticipant = new Map();

      (messageRows || []).forEach((row) => {
        const senderId = String(row.sender_id || "");
        const receiverId = String(row.receiver_id || "");
        const counterpartId = senderId === currentTeacherId ? receiverId : senderId;
        if (!counterpartId) return;

        const msgObj = toConversationMessage(row, currentTeacherId, teacherDisplayName);

        if (!conversationsByParticipant.has(counterpartId)) {
          const profile = profileMap.get(counterpartId) || {};
          conversationsByParticipant.set(counterpartId, {
            id: `conv_${counterpartId}`,
            participantId: counterpartId,
            participantName: String(profile?.name || "User"),
            participantRole: String(profile?.role || "student"),
            email: String(profile?.email || ""),
            classCode: "",
            section: "",
            messages: [],
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            isVideoMeet: false,
            isGroup: false,
          });
        }

        const conversation = conversationsByParticipant.get(counterpartId);
        conversation.messages.push(msgObj);
        conversation.lastMessageTime = String(row.timestamp || row.created_at || conversation.lastMessageTime);
      });

      // Load group conversations
      const { data: participantRows, error: participantError } = await db
        .from("conversation_participants")
        .select("conversation_id, profile_id")
        .eq("profile_id", currentTeacherId);

      if (!participantError && participantRows && participantRows.length > 0) {
        const conversationIds = buildStableIdList(participantRows.map((row) => row.conversation_id));

        const { data: conversationData, error: convError } = await db
          .from("conversations")
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
              const participantIds = buildStableIdList(groupParticipants.map((p) => p.profile_id));
              const participantProfiles = await fetchProfilesByIds(participantIds);

              // Load messages for this group conversation
              const { data: groupMessages, error: groupMsgError } = await db
                .from(MESSAGE_TABLE)
                .select("id, sender_id, receiver_id, message_text, timestamp, created_at, file_url, file_name, file_type, file_size, is_read")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: true });

              const groupMsgObjs = (groupMessages || []).map((row) => 
                toConversationMessage(row, currentTeacherId, teacherDisplayName)
              );

              conversationsByParticipant.set(conv.id, {
                id: conv.id,
                participantId: "",
                participantIds: participantIds,
                participantName: conv.name || `${participantIds.length} members`,
                participantRole: "group",
                classCode: `${participantIds.length} members`,
                messages: groupMsgObjs,
                lastMessageTime: groupMsgObjs.length > 0 
                  ? groupMsgObjs[groupMsgObjs.length - 1].time 
                  : new Date().toISOString(),
                unreadCount: 0,
                isVideoMeet: false,
                isGroup: true,
              });
            }
          }
        }
      }

      const mapped = Array.from(conversationsByParticipant.values()).sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      saveConversations(mapped);
      setSelectedConvId((prev) => {
        if (mapped.length === 0) return null;
        const stillExists = mapped.some((item) => item.id === prev);
        return stillExists ? prev : mapped[0].id;
      });
    } finally {
      const wasPending = conversationLoadInFlightRef.current === "pending";
      conversationLoadInFlightRef.current = false;
      if (wasPending) {
        await loadConversations(currentTeacherId, teacherDisplayName);
      }
    }
  }, [fetchProfilesByIds]);

  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) { navigate("/login"); return; }
      const user = JSON.parse(userData);
      if (user.role !== "teacher") { navigate("/login"); return; }
      const teacherDisplayName = String(user.name || "Teacher");
      setTeacherName(teacherDisplayName);
      setPageError("");
      const resolvedTeacherId = await resolveTeacherId(user.email);
      if (!resolvedTeacherId) {
        setPageError("Unable to resolve teacher account.");
        setLoading(false);
        return;
      }
      setTeacherId(resolvedTeacherId);
      await loadConversations(resolvedTeacherId, teacherDisplayName);
      setLoading(false);
    };
    initialize();
  }, [navigate, resolveTeacherId, loadConversations]);

  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedConvId, conversations]);

  useEffect(() => {
    if (!supabase || !teacherId) return;
    const channel = supabase
      .channel(`teacher-messages-${teacherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: MESSAGE_TABLE }, async () => {
        const userData = localStorage.getItem("currentUser");
        if (!userData) return;
        const user = JSON.parse(userData);
        await loadConversations(teacherId, user.name || "Teacher");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teacherId, loadConversations]);

  useEffect(() => {
    let isMounted = true;
    const runSearch = async () => {
      if (!showNewModal && !showGroupModal) {
        if (isMounted) setRecipientResults([]);
        return;
      }
      if (isMounted) setRecipientLoading(true);
      const term = String(recipientSearch || "").trim();
      const results = term
        ? await fetchRecipientsByQuery(teacherId, term)
        : await fetchAllRecipients(teacherId);
      if (!isMounted) return;
      setRecipientResults(results);
      setRecipientLoading(false);
    };
    runSearch();
    return () => { isMounted = false; };
  }, [showNewModal, showGroupModal, recipientSearch, teacherId, fetchRecipientsByQuery, fetchAllRecipients]);

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
        (c) => c.participantName.toLowerCase().includes(q) || c.classCode?.toLowerCase().includes(q)
      );
    }
    switch (activeFilter) {
      case "unread": filtered = filtered.filter((c) => (c.unreadCount || 0) > 0); break;
      case "read": filtered = filtered.filter((c) => (c.unreadCount || 0) === 0 && !c.isVideoMeet); break;
      case "mentions":
        filtered = filtered.filter((c) =>
          (c.messages || []).some((m) => m.from !== "teacher" && m.text?.includes(`@${teacherName}`))
        );
        break;
      case "videomeet": filtered = filtered.filter((c) => c.isVideoMeet === true); break;
      default: break;
    }
    return filtered;
  };

  const filteredConvs = applyFilter(conversations);

  const closeNewMessageModal = () => {
    setShowNewModal(false);
    setRecipientSearch("");
    setRecipientResults([]);
  };

  const handleStartConversation = async (student) => {
    const existing = conversations.find((c) => !c.isGroup && c.participantId === student.id);
    if (existing) { setSelectedConvId(existing.id); closeNewMessageModal(); return; }
    const conversationId = `direct_${teacherId}_${student.id}_${Date.now()}`;
    const newConversation = {
      id: conversationId,
      participantId: student.id,
      participantName: student.name,
      participantRole: String(student.role || "student"),
      email: student.email || "",
      classCode: student.classCode || "",
      section: student.section || "",
      messages: [],
      unreadCount: 0,
      lastMessageTime: new Date().toISOString(),
      isVideoMeet: false,
      isGroup: false,
    };
    saveConversations([newConversation, ...conversations]);
    setSelectedConvId(conversationId);
    closeNewMessageModal();
  };

  const toggleGroupMember = (recipientId) => {
    setSelectedGroupMemberIds((prev) => {
      const next = prev.includes(recipientId)
        ? prev.filter((id) => id !== recipientId)
        : [...prev, recipientId];
      return buildStableIdList(next);
    });
  };

  const handleCreateGroupChat = async () => {
    const selectedMembers = recipientResults.filter((r) => selectedGroupMemberIds.includes(r.id));
    const memberIds = buildStableIdList(selectedMembers.map((m) => m.id));
    if (memberIds.length < 2) { setPageError("Select at least 2 users."); return; }
    const uid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conversationId = `group_${uid}`;
    const previewName = selectedMembers.slice(0, 2).map((m) => m.name).join(", ");
    
    // Insert conversation into database
    try {
      const { error: convError } = await db
        .from("conversations")
        .insert({
          id: conversationId,
          name: memberIds.length > 2 ? `${previewName} +${memberIds.length - 2}` : previewName,
          is_group: true,
          created_by: teacherId,
        });
      
      if (convError) {
        console.error("Failed to create conversation:", convError);
        setPageError("Failed to create group chat.");
        return;
      }

      // Add all participants including the teacher who created it
      const allParticipantIds = buildStableIdList([teacherId, ...memberIds]);
      const participantInserts = allParticipantIds.map((profileId) => ({
        conversation_id: conversationId,
        profile_id: profileId,
        is_admin: false,
      }));

      const { error: partError } = await db
        .from("conversation_participants")
        .insert(participantInserts);

      if (partError) {
        console.error("Failed to add participants:", partError);
        setPageError("Failed to add participants to group chat.");
        return;
      }
    } catch (error) {
      console.error("Error creating group chat:", error);
      setPageError("Failed to create group chat.");
      return;
    }

    const groupConversation = {
      id: conversationId,
      participantId: "",
      participantIds: memberIds,
      participantName: memberIds.length > 2 ? `${previewName} +${memberIds.length - 2}` : previewName,
      participantRole: "group",
      classCode: `${memberIds.length} members`,
      messages: [],
      unreadCount: 0,
      lastMessageTime: new Date().toISOString(),
      isVideoMeet: false,
      isGroup: true,
    };
    saveConversations([groupConversation, ...conversations]);
    setSelectedConvId(conversationId);
    setShowGroupModal(false);
    setGroupSearch("");
    setSelectedGroupMemberIds([]);
    setPageError("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = String(messageInput || "").trim();
    const activeConversation = selectedConv;
    if ((!text && !attachmentFile) || !activeConversation || !teacherId || !supabase) return;

    const recipientIds = activeConversation.isGroup
      ? buildStableIdList(activeConversation.participantIds)
      : [String(activeConversation.participantId || "").trim()].filter(Boolean);

    if (recipientIds.length === 0) { setPageError("No recipients found."); return; }

    const now = new Date().toISOString();
    let uploadedFileUrl = "";
    let uploadedFileName = "";
    let uploadedFileType = "";
    let uploadedFileSize = 0;

    if (attachmentFile) {
      if (attachmentFile.size > MAX_ATTACHMENT_SIZE_BYTES) { setPageError("File too large. Max 50MB."); return; }
      setIsUploadingAttachment(true);
      const cleanedName = sanitizeAttachmentFileName(attachmentFile.name);
      const filePath = `${teacherId}/${activeConversation.id}/${Date.now()}_${cleanedName}`;
      const uploadResult = await supabase.storage
        .from(MESSAGE_ATTACHMENT_BUCKET)
        .upload(filePath, attachmentFile, { cacheControl: "3600", upsert: false });
      if (uploadResult.error) {
        console.warn("[TeacherMessages] Attachment upload failed (bucket may need public policy):", uploadResult.error);
        // Proceed without file attachment rather than blocking the whole message
        setIsUploadingAttachment(false);
      } else {
        const publicUrlResult = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET).getPublicUrl(filePath);
        uploadedFileUrl = String(publicUrlResult?.data?.publicUrl || "").trim();
        uploadedFileName = cleanedName;
        uploadedFileType = String(attachmentFile.type || "application/octet-stream").trim();
        uploadedFileSize = Number(attachmentFile.size || 0);
        setIsUploadingAttachment(false);
      }
    }

    const messageText = text || (attachmentFile ? "Sent an attachment" : "");
    
    let insertPayload;
    if (activeConversation.isGroup) {
      // For group messages, create a single message with conversation_id
      insertPayload = [{
        sender_id: teacherId,
        receiver_id: null, // No specific receiver for group messages
        conversation_id: activeConversation.id,
        message_text: messageText,
        content: messageText, // Add content field
        timestamp: now,
        file_url: uploadedFileUrl || null,
        file_name: uploadedFileName || null,
        file_type: uploadedFileType || null,
        file_size: uploadedFileSize || null,
      }];
    } else {
      // For direct messages, create individual messages for each recipient
      insertPayload = recipientIds.map((recipientId) => ({
        sender_id: teacherId,
        receiver_id: recipientId,
        conversation_id: null,
        message_text: messageText,
        content: messageText, // Add content field
        timestamp: now,
        file_url: uploadedFileUrl || null,
        file_name: uploadedFileName || null,
        file_type: uploadedFileType || null,
        file_size: uploadedFileSize || null,
      }));
    }

    let data, error;
    try {
      const result = await db // Use db (supabaseAdmin)
        .from(MESSAGE_TABLE)
        .insert(insertPayload)
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read");
      data = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      console.warn("[TeacherMessages] DB insert failed (RLS may be blocking – messages will be local only):", error);
      // Do NOT return – fall through to add message locally so the UI still works
    }

    const msg = {
      id: String(data?.[0]?.id || `${Date.now()}_${Math.random()}`),
      from: "teacher",
      senderName: teacherName,
      text: messageText,
      time: String(data?.[0]?.timestamp || now),
      fileUrl: String(data?.[0]?.file_url || uploadedFileUrl || "").trim(),
      fileName: String(data?.[0]?.file_name || uploadedFileName || "").trim(),
      fileType: String(data?.[0]?.file_type || uploadedFileType || "").trim(),
      fileSize: Number(data?.[0]?.file_size || uploadedFileSize || 0),
      attachmentKind: attachmentFile ? getAttachmentKindFromFile(attachmentFile) : "",
    };

    const updated = conversations.map((c) =>
      c.id === activeConversation.id
        ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
        : c
    );
    saveConversations(updated);
    setMessageInput("");
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) { setAttachmentFile(null); return; }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setPageError("File too large. Max 50MB.");
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

  const handleSelectConv = (conv) => {
    if (conv.unreadCount > 0) {
      const updated = conversations.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c);
      saveConversations(updated);
    }
    setSelectedConvId(conv.id);
  };

  const handleOpenRename = () => {
    if (!selectedConv || !selectedConv.isGroup) return;
    setShowGroupMenu(false);
    setRenameValue(String(selectedConv.participantName || ""));
    setShowRenameModal(true);
  };

  const handleOpenGroupMembers = async () => {
    if (!selectedConv || !selectedConv.isGroup) return;
    setShowGroupMenu(false);
    try {
      const memberIds = buildStableIdList(selectedConv.participantIds);
      const members = memberIds.length > 0 ? await fetchProfilesByIds(memberIds) : [];
      setGroupMembers([
        { id: teacherId, name: teacherName || "You", role: "teacher", email: "" },
        ...members.filter((m) => String(m.id || "") !== String(teacherId || "")),
      ]);
      setShowMembersModal(true);
    } catch { setPageError("Unable to load group members."); }
  };

  const handleRenameSubmit = async () => {
    const newName = String(renameValue || "").trim();
    if (!newName) { setPageError("Group name cannot be empty."); return; }
    if (!selectedConv) return;
    try {
      const { error } = await db.from("conversations").update({ name: newName }).eq("id", selectedConv.id);
      if (error) throw error;
      const updated = conversations.map((c) => c.id === selectedConv.id ? { ...c, participantName: newName } : c);
      saveConversations(updated);
      setShowRenameModal(false);
      setPageError("");
    } catch (err) { 
      console.error("[TeacherMessages] Rename error:", err);
      setPageError(err.message || "Unable to rename group."); 
    }
  };

  const handleLeaveConversation = async () => {
    if (!selectedConv) return;
    try {
      const { error } = await db.from("conversation_participants").delete().eq("conversation_id", selectedConv.id).eq("profile_id", teacherId);
      if (error) throw error;
    } catch (err) {
      console.error("[TeacherMessages] Leave error:", err);
      setPageError("Unable to leave group chat.");
      return;
    }
    const remaining = conversations.filter((c) => c.id !== selectedConv.id);
    saveConversations(remaining);
    setShowDeleteConfirm(false);
    setShowGroupMenu(false);
    setSelectedConvId(remaining.length ? remaining[0].id : null);
    setPageError("");
  };

  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    try { 
      const { error } = await db.from("conversations").delete().eq("id", selectedConv.id);
      if (error) throw error;
    } catch (err) {
      console.error("[TeacherMessages] Delete error:", err);
      setPageError("Unable to delete conversation.");
      return;
    }
    const remaining = conversations.filter((c) => c.id !== selectedConv.id);
    saveConversations(remaining);
    setShowDeleteConfirm(false);
    setShowGroupMenu(false);
    setSelectedConvId(remaining.length ? remaining[0].id : null);
    setPageError("");
  };

  const getTimeLabel = (iso) => {
    const diff = Math.floor((new Date() - new Date(iso)) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredRecipients = recipientResults.filter((r) => {
    const term = String(recipientSearch || "").trim().toLowerCase();
    if (!term) return true;
    return [r.name, r.email, r.role].some((v) => String(v || "").toLowerCase().includes(term));
  });

  const filteredGroupRecipients = recipientResults.filter((r) => {
    const term = String(groupSearch || "").trim().toLowerCase();
    if (!term) return true;
    return [r.name, r.email, r.role].some((v) => String(v || "").toLowerCase().includes(term));
  });

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

  if (loading) return <LoadingScreen message="Loading messages..." />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-hidden flex flex-col lg:pl-64">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-green-600 text-xs font-bold uppercase tracking-widest">Teacher Portal</p>
              <h2 className="text-lg font-bold text-gray-900">Messages</h2>
            </div>
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={(id) => setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))}
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
          <div className="bg-green-600 rounded-2xl p-5 text-white shadow-sm flex-shrink-0">
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
                onClick={() => { setShowNewModal(true); setRecipientSearch(""); setRecipientResults([]); }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm rounded-xl font-semibold text-sm transition-all"
              >
                <Edit2 className="w-4 h-4" />
                New Message
              </button>
            </div>
          </div>

          {pageError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2 flex-shrink-0">
              <Clock className="w-4 h-4 mt-0.5" />
              <span>{pageError}</span>
            </div>
          )}

          <div className="flex-1 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-1 border-r border-gray-200 flex flex-col">
              <div className="p-3 border-b border-gray-100 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowGroupModal(true); setGroupSearch(""); setSelectedGroupMemberIds([]); setRecipientSearch(""); setRecipientResults([]); }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                  title="Create group chat"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-hide flex-shrink-0">
                {FILTERS.map(({ key, label, icon: Icon }) => {
                  const count = filterCounts[key];
                  const isActive = activeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                        isActive ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                      {count > 0 && (
                        <span className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center ${
                          isActive ? "bg-white/25 text-white" : key === "unread" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {filteredConvs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">No conversations yet</p>
                    <p className="text-xs text-gray-500">Click "New Message" to start chatting.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredConvs.map((conv, index) => (
                      <button
                        key={`${conv.id}-${index}`}
                        onClick={() => handleSelectConv(conv)}
                        className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                          selectedConvId === conv.id ? "bg-green-50 border-l-2 border-green-500" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            conv.isVideoMeet ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-green-600"
                          }`}>
                            {conv.isVideoMeet ? <Video className="w-4 h-4" /> : conv.participantName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-gray-900" : "text-gray-700"}`}>
                                {conv.participantName}
                              </p>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{getTimeLabel(conv.lastMessageTime)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500 truncate">{getConversationDetailLine(conv)}</p>
                              {conv.unreadCount > 0 && (
                                <span className="w-5 h-5 bg-green-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            {conv.messages?.length > 0 && (
                              <p className="text-xs text-gray-600 truncate mt-0.5">
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

            <div className="lg:col-span-2 flex flex-col">
              {selectedConv ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      selectedConv.isVideoMeet ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-green-600"
                    }`}>
                      {selectedConv.isVideoMeet ? <Video className="w-4 h-4" /> : selectedConv.participantName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{selectedConv.participantName}</p>
                      <p className="text-xs text-gray-500">{getConversationDetailLine(selectedConv)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedConv.isGroup && (
                        <button
                          type="button"
                          onClick={() => setShowGroupMenu((c) => !c)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                          title="Group options"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteMode("leave"); setShowDeleteConfirm(true); }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-gray-50"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
                      </button>
                    </div>
                  </div>

                  {selectedConv.isGroup && showGroupMenu && (
                    <div className="relative z-10">
                      <div className="absolute right-6 top-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                        <button type="button" onClick={handleOpenRename} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Edit2 className="w-4 h-4 text-green-600" /> Rename Group
                        </button>
                        <button type="button" onClick={handleOpenGroupMembers} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Users className="w-4 h-4 text-green-600" /> View Members
                        </button>
                        <button type="button" onClick={() => { setDeleteMode("leave"); setShowGroupMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Trash2 className="w-4 h-4 text-yellow-500" /> Leave Chat
                        </button>
                        <button type="button" onClick={() => { setDeleteMode("delete"); setShowGroupMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4 text-red-600" /> Delete Conversation
                        </button>
                      </div>
                    </div>
                  )}

                  <div ref={messageContainerRef} className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2">
                    {(selectedConv.messages || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mb-3">
                          <Send className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No messages yet. Say hello!</p>
                      </div>
                    ) : (
                      (selectedConv.messages || []).map((msg, msgIndex) => {
                        const isTeacher = msg.from === "teacher";
                        const hasMention = !isTeacher && msg.text?.includes(`@${teacherName}`);
                        return (
                          <div key={`msg-${msg.id}-${msgIndex}`} className={`flex ${isTeacher ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                              isTeacher
                                ? "bg-green-600 text-white rounded-br-sm"
                                : hasMention
                                ? "bg-yellow-50 border border-yellow-200 text-gray-900 rounded-bl-sm"
                                : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
                            }`}>
                              {hasMention && (
                                <p className="text-[10px] text-yellow-600 font-semibold mb-1 flex items-center gap-1">
                                  <AtSign className="w-2.5 h-2.5" /> Mentioned you
                                </p>
                              )}
                              {msg.attachmentKind === "image" && msg.fileUrl && (
                                <img src={msg.fileUrl} alt={msg.fileName || "image"} className="rounded-lg max-w-full mb-2" />
                              )}
                              {msg.attachmentKind === "document" && msg.fileUrl && (
                                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs underline mb-2">
                                  <FileText className="w-4 h-4" />
                                  {msg.fileName || "Download file"}
                                  <Download className="w-3 h-3" />
                                </a>
                              )}
                              {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                              <div className={`flex items-center justify-end gap-1 mt-1`}>
                                <p className={`text-xs ${isTeacher ? "text-green-100" : "text-gray-500"}`}>
                                  {getTimeLabel(msg.time)}
                                </p>
                                {isTeacher && (
                                  <span className="flex-shrink-0" title={msg.isSeen ? "Seen" : "Sent"}>
                                    {msg.isSeen ? (
                                      <CheckCheck className="w-3 h-3 text-green-200" />
                                    ) : (
                                      <CheckCheck className="w-3 h-3 text-green-300/50" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {attachmentFile && (
                    <div className="px-6 py-2 border-t border-gray-200 flex items-center gap-2 text-sm text-gray-700">
                      <Paperclip className="w-4 h-4 text-green-600" />
                      <span className="truncate">{attachmentFile.name}</span>
                      <button onClick={clearAttachment} className="ml-auto text-gray-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSend} className="px-6 py-4 border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachmentChange} accept="*/*" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-500 hover:text-green-600 transition-colors flex-shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={`Message ${selectedConv.participantName}...`}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={(!messageInput.trim() && !attachmentFile) || isUploadingAttachment}
                      className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a conversation</h3>
                  <p className="text-gray-500 text-sm mb-5">Choose a conversation or start a new one.</p>
                  <button
                    onClick={() => { setShowNewModal(true); setRecipientSearch(""); setRecipientResults([]); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">New Message</h3>
                  <p className="text-sm text-gray-400">Select a recipient</p>
                </div>
              </div>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search teachers, students, or admins..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {recipientLoading ? (
                <div className="py-12 text-center"><p className="text-sm text-gray-500">Searching...</p></div>
              ) : filteredRecipients.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Type to search teachers, students, or admins.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRecipients.map((recipient, index) => {
                    const hasConv = conversations.find((c) => !c.isGroup && c.participantId === recipient.id);
                    const avatarColor = recipient.role === "teacher" ? "bg-blue-600" : recipient.role === "admin" ? "bg-purple-600" : "bg-green-600";
                    const roleBadgeColor = recipient.role === "teacher" ? "bg-blue-50 text-blue-700 border-blue-200" : recipient.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-green-50 text-green-700 border-green-200";
                    return (
                      <button
                        key={`${recipient.id}-${index}`}
                        onClick={() => handleStartConversation(recipient)}
                        className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className={`w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                          {recipient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{recipient.name}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize flex-shrink-0 ${roleBadgeColor}`}>{recipient.role}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{recipient.email}</p>
                          {hasConv && <p className="text-xs text-green-600 font-medium mt-0.5">Existing conversation</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-green-600 transition-colors flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GROUP CHAT MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">New Group Chat</h3>
                  <p className="text-sm text-gray-400">Select at least 2 members</p>
                </div>
              </div>
              <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {filteredGroupRecipients.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No users found.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredGroupRecipients.map((recipient, index) => {
                    const isSelected = selectedGroupMemberIds.includes(recipient.id);
                    return (
                      <button
                        key={`group-${recipient.id}-${index}`}
                        onClick={() => toggleGroupMember(recipient.id)}
                        className={`w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors text-left ${isSelected ? "bg-green-50" : ""}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${isSelected ? "bg-green-600" : "bg-gray-300 text-gray-700"}`}>
                          {isSelected ? <CheckCheck className="w-5 h-5" /> : recipient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{recipient.name}</p>
                          <p className="text-xs text-gray-500">{recipient.role} · {recipient.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={handleCreateGroupChat}
                disabled={selectedGroupMemberIds.length < 2}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 font-semibold text-sm transition-all"
              >
                Create Group ({selectedGroupMemberIds.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Rename Group</h3>
            </div>
            <div className="px-6 py-4">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Group name..."
                className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleRenameSubmit} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE/LEAVE CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{deleteMode === "delete" ? "Delete Conversation" : "Leave Conversation"}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700 text-sm">{deleteMode === "delete" ? "Delete this conversation? This cannot be undone." : "Leave this conversation?"}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={deleteMode === "delete" ? handleDeleteConversation : handleLeaveConversation} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">
                {deleteMode === "delete" ? "Delete" : "Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS MODAL */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl max-h-[60vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Group Members</h3>
              <button onClick={() => setShowMembersModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {groupMembers.map((member, index) => (
                <div key={`member-${member.id}-${index}`} className="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { TeacherMessages };
