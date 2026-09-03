import { useUnreadMessages } from "../../contexts/UnreadMessagesContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { MessageAttachmentPreview } from "@/app/components/MessageAttachmentPreview";
import { supabase } from "@/app/lib/supabaseClient";
import { adminApi } from "@/app/lib/adminApi";
import { useTourPreview } from "@/app/hooks/useTourPreview";
// Use service role client if available to bypass RLS issues for reliable messaging
const db = supabase;
import {
  Search,
  ArrowLeft,
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
  Video,
  AtSign,
  CheckCheck,
  Circle,
} from "lucide-react";

const MESSAGE_TABLE = "messages";
const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "gif", "mp4", "mp3", "zip", "xlsx", "csv"];

const FILTERS = [
  { key: "all",       label: "All",        icon: MessageSquare },
  { key: "unread",    label: "Unread",     icon: Circle },
  { key: "read",      label: "Read",       icon: CheckCheck },
];

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const buildProfileName = (row) => {
  const fullName = [row?.first_name, row?.middle_name, row?.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  const fallbackName = String(row?.name || row?.full_name || row?.display_name || "").trim();
  if (fallbackName) return fallbackName;
  const roleStr = String(row?.role || "").trim().toLowerCase();
  if (roleStr === "teacher") return "Teacher";
  if (roleStr === "admin") return "Admin";
  return "Student";
};

const toConversationMessage = (row, currentTeacherId, teacherDisplayName) => {
  const cleanSender = String(row?.sender_id || "").toLowerCase();
  const cleanCurrent = String(currentTeacherId || "").toLowerCase();
  const fromTeacher = cleanSender === cleanCurrent;
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
    senderName: fromTeacher ? teacherDisplayName : "Recipient",
    text: String(row?.message_text || "").trim(),
    time: String(row?.timestamp || row?.created_at || new Date().toISOString()),
    fileUrl: String(row?.file_url || "").trim(),
    status: String(row?.status || "sent").trim(),
    attachments: Array.isArray(row?.message_attachments) 
      ? row.message_attachments.map(a => ({
          id: a.id,
          url: a.file_url,
          name: a.file_name,
          type: a.file_type,
          size: a.file_size,
          kind: a.file_type?.startsWith('image/') ? 'image' : a.file_type?.startsWith('video/') ? 'video' : 'document'
        }))
      : [],
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
  if (message?.attachments?.length > 0) return `Sent ${message.attachments.length} attachment(s)`;
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

const MOCK_DEMO_CONVERSATIONS = [
  {
    id: "demo-conv-1",
    participantId: "demo-stu-1",
    participantName: "Juan Dela Cruz",
    participantRole: "Student • Grade 10 - Ruby",
    classCode: "AP10",
    section: "Grade 10 - Ruby",
    lastMessage: "Good day Teacher, I have submitted my Written Work 1 file on the portal.",
    lastMessageTime: new Date(Date.now() - 5 * 60000).toISOString(),
    isRead: true,
    isGroup: false,
    messages: [
      {
        id: "msg-1",
        from: "student",
        senderName: "Juan Dela Cruz",
        text: "Good day Teacher! I wanted to check if you received my submission for Written Work 1.",
        time: new Date(Date.now() - 30 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
      {
        id: "msg-2",
        from: "teacher",
        senderName: "You",
        text: "Hello Juan! Yes, I received your file. Excellent work on the essay structure!",
        time: new Date(Date.now() - 15 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
      {
        id: "msg-3",
        from: "student",
        senderName: "Juan Dela Cruz",
        text: "Thank you so much Teacher! Will prepare for our upcoming Quiz 1 on Friday.",
        time: new Date(Date.now() - 5 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
    ],
  },
  {
    id: "demo-conv-2",
    participantId: "demo-group-1",
    participantName: "Grade 10 - Ruby Class Group",
    participantRole: "Class Group • 42 members",
    classCode: "AP10",
    section: "Grade 10 - Ruby",
    isGroup: true,
    participantIds: ["demo-stu-1", "demo-stu-2", "demo-stu-3"],
    lastMessage: "Teacher: Reminder for all students to bring graphing paper tomorrow.",
    lastMessageTime: new Date(Date.now() - 60 * 60000).toISOString(),
    isRead: false,
    messages: [
      {
        id: "msg-g1",
        from: "student",
        senderName: "Maria Santos",
        text: "Good afternoon everyone! Reminder regarding our Araling Panlipunan group project.",
        time: new Date(Date.now() - 120 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
      {
        id: "msg-g2",
        from: "teacher",
        senderName: "You",
        text: "Reminder for all Grade 10 Ruby students to bring graphing paper tomorrow for our lesson.",
        time: new Date(Date.now() - 60 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
    ],
  },
  {
    id: "demo-conv-3",
    participantId: "demo-stu-2",
    participantName: "Maria Santos",
    participantRole: "Student • Grade 10 - Ruby",
    classCode: "AP10",
    section: "Grade 10 - Ruby",
    lastMessage: "Thank you Teacher, see you in class tomorrow!",
    lastMessageTime: new Date(Date.now() - 180 * 60000).toISOString(),
    isRead: true,
    isGroup: false,
    messages: [
      {
        id: "msg-m1",
        from: "student",
        senderName: "Maria Santos",
        text: "Good morning Teacher, may I ask for the coverage of our 1st Quarter Examination?",
        time: new Date(Date.now() - 200 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
      {
        id: "msg-m2",
        from: "teacher",
        senderName: "You",
        text: "Hi Maria! It covers Chapters 1 through 4. Review your seatworks and lecture notes.",
        time: new Date(Date.now() - 190 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
      {
        id: "msg-m3",
        from: "student",
        senderName: "Maria Santos",
        text: "Thank you Teacher, see you in class tomorrow!",
        time: new Date(Date.now() - 180 * 60000).toISOString(),
        status: "sent",
        isRead: true,
      },
    ],
  },
];

function TeacherMessages() {
  const { isDemoMode } = useTourPreview();
  const { unreadConversations, markAsRead } = useUnreadMessages();
  const getUnreadCount = (conv) => unreadConversations[conv.isGroup ? `group_${conv.id}` : `dm_${conv.id}`] || 0;
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const messageContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationLoadInFlightRef = useRef(false);
  const seenMessageIdsRef = useRef(new Set());
  const conversationsRef = useRef([]);
  const selectedConvIdRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [conversations, setConversations] = useState([]);
  const activeConversationsList = isDemoMode && conversations.length === 0 ? MOCK_DEMO_CONVERSATIONS : conversations;
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [showThread, setShowThread] = useState(false);

  useEffect(() => {
    if (isDemoMode && (!selectedConvId || !activeConversationsList.some(c => c.id === selectedConvId))) {
      if (activeConversationsList[0]?.id) {
        setSelectedConvId(activeConversationsList[0].id);
      }
    }
  }, [isDemoMode, activeConversationsList, selectedConvId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
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

  const saveConversations = (updated) => {
    const sorted = [...updated].sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
    setConversations(sorted);
  };

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
  }, [selectedConvId]);

  const markMessageSeen = useCallback((messageId) => {
    const id = String(messageId || "").trim();
    if (id) {
      seenMessageIdsRef.current.add(id);
    }
  }, []);

  const appendIncomingMessage = useCallback((row, currentTeacherId, teacherDisplayName) => {
    if (!row?.id || !currentTeacherId) return false;

    const messageId = String(row.id);
    if (seenMessageIdsRef.current.has(messageId)) return false;

    const senderId = String(row.sender_id || "");
    const receiverId = String(row.receiver_id || "");
    const conversationId = String(row.conversation_id || "").trim();
    const isRelevant = senderId === String(currentTeacherId) ||
                       receiverId === String(currentTeacherId) ||
                       (conversationId && conversationsRef.current.some((conversation) => String(conversation.id) === conversationId));

    if (!isRelevant) return false;

    const targetConversationId = conversationId || `conv_${senderId === String(currentTeacherId) ? receiverId : senderId}`;
    const message = toConversationMessage(row, currentTeacherId, teacherDisplayName);

    seenMessageIdsRef.current.add(messageId);

    setConversations((current) => {
      let updated = false;

      const next = current.map((conversation) => {
        if (String(conversation.id) !== String(targetConversationId)) return conversation;

        const alreadyExists = (conversation.messages || []).some((item) => String(item.id) === messageId);
        if (alreadyExists) return conversation;

        updated = true;
        const isActiveConversation = String(selectedConvIdRef.current || "") === String(conversation.id);
        return {
          ...conversation,
          messages: [...(conversation.messages || []), message],
          lastMessageTime: message.time,
          unreadCount: isActiveConversation ? 0 : (conversation.unreadCount || 0) + 1,
        };
      });

      if (!updated) {
        if (conversationId) return current;

        const participantId = senderId === String(currentTeacherId) ? receiverId : senderId;
        if (!participantId) return current;

        const fallbackConversation = {
          id: targetConversationId,
          participantId,
          participantName: senderId === String(currentTeacherId) ? "User" : "Admin",
          participantRole: senderId === String(currentTeacherId) ? "student" : "admin",
          email: "",
          classCode: "",
          section: "",
          messages: [message],
          lastMessageTime: message.time,
          unreadCount: 1,
          isVideoMeet: false,
          isGroup: false,
        };

        return [fallbackConversation, ...current].sort(
          (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
      }

      return next.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    });

    return true;
  }, []);
  const resolveTeacherId = useCallback(async (userOrEmail) => {
    try {
      if (!userOrEmail) return null;
      if (typeof userOrEmail === "object") {
        const rawId = userOrEmail.id || userOrEmail.teacherId || userOrEmail.profile_id;
        if (rawId && isUuid(rawId)) return String(rawId);
      } else if (isUuid(userOrEmail)) {
        return String(userOrEmail);
      }

      const cleanEmail = String((typeof userOrEmail === "object" ? userOrEmail.email : userOrEmail) || "").trim();
      if (!cleanEmail) return typeof userOrEmail === "object" && userOrEmail.id ? String(userOrEmail.id) : null;

      let { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", cleanEmail)
        .limit(1)
        .maybeSingle();
      if (!error && data?.id) return String(data.id);

      return typeof userOrEmail === "object" && userOrEmail.id ? String(userOrEmail.id) : null;
    } catch {
      return typeof userOrEmail === "object" && userOrEmail?.id ? String(userOrEmail.id) : null;
    }
  }, []);

  const HARDCODED_ADMIN_ID = "11111111-1111-1111-1111-111111111111";
  const HARDCODED_ADMIN_EMAIL = "admin.connected.local";

  const fetchProfilesByIds = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return [];
    try {
      const { data, error } = await db
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role")
        .in("id", ids);
      const res = (data || []).map((row) => ({
        id: String(row.id),
        name: buildProfileName(row),
        email: String(row.email || ""),
        role: String(row.role || "student").trim().toLowerCase(),
      }));

      // If hardcoded admin ID was requested but not returned from DB, append default Admin profile
      if (ids.map(id => String(id).toLowerCase()).includes(HARDCODED_ADMIN_ID.toLowerCase())) {
        if (!res.some(r => r.id.toLowerCase() === HARDCODED_ADMIN_ID.toLowerCase())) {
          res.push({
            id: HARDCODED_ADMIN_ID,
            name: "System Administrator",
            email: HARDCODED_ADMIN_EMAIL,
            role: "admin"
          });
        }
      }

      return res;
    } catch { return []; }
  }, []);

  const fetchAllRecipients = useCallback(async (currentTeacherId) => {
    try {
      const cleanCurrentId = String(currentTeacherId || "").trim().toLowerCase();

      let staffQuery = supabase
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role, status")
        .in("role", ["teacher", "Teacher", "TEACHER", "admin", "Admin", "ADMIN"]);

      if (currentTeacherId && isUuid(currentTeacherId)) {
        staffQuery = staffQuery.neq("id", currentTeacherId);
      }

      const { data: staffData } = await staffQuery.order("first_name", { ascending: true }).limit(100);

      let studentQuery = supabase
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role, status")
        .in("role", ["student", "Student", "STUDENT"]);

      if (currentTeacherId && isUuid(currentTeacherId)) {
        studentQuery = studentQuery.neq("id", currentTeacherId);
      }

      const { data: studentData } = await studentQuery.order("first_name", { ascending: true }).limit(200);

      const combined = [...(staffData || []), ...(studentData || [])];

      const res = combined
        .filter((row) => {
          if (!row || !row.id) return false;
          if (cleanCurrentId && String(row.id).toLowerCase() === cleanCurrentId) return false;
          const statusStr = String(row.status || "").trim().toLowerCase();
          if (statusStr === "disabled" || statusStr === "inactive") return false;
          const roleStr = String(row.role || "").trim().toLowerCase();
          return ["student", "teacher", "admin"].includes(roleStr);
        })
        .map((row) => ({
          id: String(row.id),
          name: buildProfileName(row),
          email: String(row.email || ""),
          role: String(row.role || "student").trim().toLowerCase(),
          classCode: "",
          section: "",
        }));

      // Ensure Admin appears in recipient selection if not already present
      if (!res.some(r => r.id.toLowerCase() === HARDCODED_ADMIN_ID.toLowerCase() || r.role === "admin")) {
        res.unshift({
          id: HARDCODED_ADMIN_ID,
          name: "System Administrator",
          email: HARDCODED_ADMIN_EMAIL,
          role: "admin",
          classCode: "",
          section: ""
        });
      }

      return res;
    } catch (err) {
      console.error("[TeacherMessages] fetchAllRecipients error:", err);
      return [];
    }
  }, []);

  const fetchRecipientsByQuery = useCallback(async (currentTeacherId, query) => {
    try {
      const q = String(query || "").trim();
      if (!q) return fetchAllRecipients(currentTeacherId);

      const cleanCurrentId = String(currentTeacherId || "").trim().toLowerCase();

      let req = supabase
        .from("profiles")
        .select("id, first_name, middle_name, last_name, email, role, status")
        .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%`);

      if (currentTeacherId && isUuid(currentTeacherId)) {
        req = req.neq("id", currentTeacherId);
      }

      const { data, error } = await req.limit(100);
      if (error || !data) return [];

      return data
        .filter((row) => {
          if (!row || !row.id) return false;
          if (cleanCurrentId && String(row.id).toLowerCase() === cleanCurrentId) return false;
          const statusStr = String(row.status || "").trim().toLowerCase();
          if (statusStr === "disabled" || statusStr === "inactive") return false;
          const roleStr = String(row.role || "").trim().toLowerCase();
          return ["student", "teacher", "admin"].includes(roleStr);
        })
        .map((row) => ({
          id: String(row.id),
          name: buildProfileName(row),
          email: String(row.email || ""),
          role: String(row.role || "student").trim().toLowerCase(),
          classCode: "",
          section: "",
        }));
    } catch (err) {
      console.error("[TeacherMessages] fetchRecipientsByQuery error:", err);
      return [];
    }
  }, [fetchAllRecipients]);

  const loadConversations = useCallback(async (currentTeacherId, teacherDisplayName) => {
    if (conversationLoadInFlightRef.current) {
      conversationLoadInFlightRef.current = "pending";
      return;
    }
    conversationLoadInFlightRef.current = true;
    try {
      const cleanTeacherId = String(currentTeacherId || "").trim().toLowerCase();

      let messageRows = [];
      let { data: rawRows, error: messageError } = await db
        .from(MESSAGE_TABLE)
        .select("id, sender_id, receiver_id, conversation_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")
        .or(`sender_id.eq.${currentTeacherId},receiver_id.eq.${currentTeacherId}`)
        .order("created_at", { ascending: true });

      if (messageError) {
        console.warn("[TeacherMessages] Direct query with attachments failed, retrying without join:", messageError);
        const { data: fallbackRows, error: fallbackError } = await db
          .from(MESSAGE_TABLE)
          .select("id, sender_id, receiver_id, conversation_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status")
          .or(`sender_id.eq.${currentTeacherId},receiver_id.eq.${currentTeacherId}`)
          .order("created_at", { ascending: true });

        if (!fallbackError && fallbackRows) {
          messageRows = fallbackRows;
        } else {
          console.error("Failed to load messages:", fallbackError || messageError);
        }
      } else if (rawRows) {
        messageRows = rawRows;
      }

      const counterpartIds = buildStableIdList((messageRows || []).map((row) => {
        const senderId = String(row.sender_id || "").toLowerCase();
        const receiverId = String(row.receiver_id || "").toLowerCase();
        return senderId === cleanTeacherId ? receiverId : senderId;
      }));

      const profileMap = new Map();
      if (counterpartIds.length > 0) {
        const profiles = await fetchProfilesByIds(counterpartIds);
        profiles.forEach((profile) => profileMap.set(String(profile.id).toLowerCase(), profile));
      }

      const conversationsByParticipant = new Map();

      (messageRows || []).forEach((row) => {
        const senderId = String(row.sender_id || "").toLowerCase();
        const receiverId = String(row.receiver_id || "").toLowerCase();
        const counterpartId = senderId === cleanTeacherId ? receiverId : senderId;
        if (!counterpartId) return;

        const msgObj = toConversationMessage(row, currentTeacherId, teacherDisplayName);
        markMessageSeen(row.id);

        if (!conversationsByParticipant.has(counterpartId)) {
          const profile = profileMap.get(counterpartId) || {};
          const isAdminCounterpart = counterpartId === HARDCODED_ADMIN_ID.toLowerCase() || String(profile?.role || "").toLowerCase() === "admin" || String(profile?.email || "").toLowerCase().includes("admin");

          conversationsByParticipant.set(counterpartId, {
            id: `conv_${counterpartId}`,
            participantId: counterpartId,
            participantName: String(profile?.name || (isAdminCounterpart ? "System Administrator" : "User")),
            participantRole: String(profile?.role || (isAdminCounterpart ? "admin" : "student")).toLowerCase(),
            email: String(profile?.email || (isAdminCounterpart ? HARDCODED_ADMIN_EMAIL : "")),
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
          .from("groupchats")
          .select("id, name, is_group, created_by")
          .in("id", conversationIds)
          .eq("is_group", true);

        if (!convError && conversationData) {
          for (const conv of conversationData) {
            const { data: groupParticipants, error: groupPartError } = await db
              .from("conversation_participants")
              .select("profile_id")
              .eq("conversation_id", conv.id);

            if (!groupPartError && groupParticipants) {
              const participantIds = buildStableIdList(groupParticipants.map((p) => p.profile_id));

              let groupMsgRows = [];
              const { data: groupMessages, error: groupMsgError } = await db
                .from(MESSAGE_TABLE)
                .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: true });

              if (groupMsgError) {
                const { data: groupFallback } = await db
                  .from(MESSAGE_TABLE)
                  .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status")
                  .eq("conversation_id", conv.id)
                  .order("created_at", { ascending: true });
                groupMsgRows = groupFallback || [];
              } else {
                groupMsgRows = groupMessages || [];
              }

              const groupMsgObjs = groupMsgRows.map((row) => 
                toConversationMessage(row, currentTeacherId, teacherDisplayName)
              );

              groupMsgRows.forEach((row) => markMessageSeen(row.id));

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

      // Merge cached local draft conversations if any
      const allLoaded = Array.from(conversationsByParticipant.values());
      try {
        const cached = JSON.parse(localStorage.getItem(`teacher_conversations_${currentTeacherId}`) || "[]");
        cached.forEach((c) => {
          if (!allLoaded.some((existing) => existing.id === c.id || (!c.isGroup && existing.participantId === c.participantId))) {
            allLoaded.push(c);
          }
        });
      } catch (e) {}

      const mapped = allLoaded.sort(
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
      try {
        const userData = localStorage.getItem("currentUser");
        if (!userData) { navigate("/login"); return; }
        const user = JSON.parse(userData);
        if (user.role !== "teacher") { navigate("/login"); return; }
        const teacherDisplayName = String(user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Teacher");
        setTeacherName(teacherDisplayName);
        setPageError("");
        const resolvedTeacherId = await resolveTeacherId(user);
        if (!resolvedTeacherId) {
          setPageError("Unable to resolve teacher account.");
          setLoading(false);
          return;
        }
        setTeacherId(resolvedTeacherId);
        await loadConversations(resolvedTeacherId, teacherDisplayName);
      } catch (err) {
        console.warn("[TeacherMessages] Initialize error:", err);
        setPageError("Failed to load messaging context.");
      } finally {
        setLoading(false);
      }
    };
    initialize().catch(err => console.warn("[TeacherMessages] Uncaught initialize:", err));
  }, [navigate, resolveTeacherId, loadConversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!supabase || !teacherId) return;
    const channel = supabase
      .channel(`global-chat-${teacherId}-${Math.random().toString(36).substring(7)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: MESSAGE_TABLE }, async (payload) => {
        try {
          if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new;
            setConversations(current => current.map(conv => {
              const hasMsg = (conv.messages || []).some(m => String(m.id) === String(updatedMsg.id));
              if (!hasMsg) return conv;
              return {
                ...conv,
                messages: conv.messages.map(m => String(m.id) === String(updatedMsg.id) ? { ...m, status: updatedMsg.status, isRead: updatedMsg.is_read } : m)
              };
            }));
            return;
          }
          // Handle INSERT
          const newMsg = payload.new;
          if (!newMsg) return;
          
          // Fetch attachments for this new message to show immediately in real-time
          const { data: attData } = await supabase
            .from("message_attachments")
            .select("id, file_url, file_name, file_type, file_size")
            .eq("message_id", newMsg.id);
            
          if (attData && attData.length > 0) {
            newMsg.message_attachments = attData;
          }

          appendIncomingMessage(newMsg, teacherId, teacherName || "Teacher");
        } catch (rtErr) {
          console.warn("[TeacherMessages] Realtime handler warning:", rtErr);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teacherId, teacherName, appendIncomingMessage]);

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

  const selectedConv = activeConversationsList.find((c) => c.id === selectedConvId) || activeConversationsList[0] || null;
  const activeMessagesLength = selectedConv?.messages?.length || 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId, activeMessagesLength]);

  const applyFilter = (convList) => {
    let filtered = convList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) => c.participantName.toLowerCase().includes(q) || c.classCode?.toLowerCase().includes(q)
      );
    }
    switch (activeFilter) {
      case "unread": filtered = filtered.filter((c) => (getUnreadCount(c) || 0) > 0); break;
      case "read": filtered = filtered.filter((c) => (getUnreadCount(c) || 0) === 0 && !c.isVideoMeet); break;
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

  const filteredConvs = applyFilter(activeConversationsList);

  const closeNewMessageModal = () => {
    setShowNewModal(false);
    setRecipientSearch("");
    setRecipientResults([]);
  };

  const handleStartConversation = async (student) => {
    const existing = conversations.find((c) => !c.isGroup && c.participantId === student.id);
    if (existing) { setSelectedConvId(existing.id); setShowThread(true); closeNewMessageModal(); return; }
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
    setShowThread(true);
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
    setShowThread(true);
    setShowGroupModal(false);
    setGroupSearch("");
    setSelectedGroupMemberIds([]);
    setPageError("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = String(messageInput || "").trim();
    const activeConversation = selectedConv;
    const currentTeacherId = typeof teacherId !== 'undefined' ? teacherId : (typeof adminId !== 'undefined' ? adminId : null);
    if ((!text && attachmentFiles.length === 0) || !activeConversation || !currentTeacherId || !supabase) return;

    let recipientIds = activeConversation.isGroup
      ? buildStableIdList(activeConversation.participantIds)
      : [String(activeConversation.participantId || "").trim()].filter(Boolean);

    // If target is Admin, ensure message includes all admin profile IDs
    if (!activeConversation.isGroup && (
      recipientIds.includes(HARDCODED_ADMIN_ID) || 
      activeConversation.participantRole === "admin" ||
      String(activeConversation.participantName || "").toLowerCase().includes("admin")
    )) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .ilike("role", "admin");
      
      const adminIdSet = new Set([HARDCODED_ADMIN_ID, ...recipientIds]);
      (adminProfiles || []).forEach(p => { if (p?.id) adminIdSet.add(String(p.id)); });
      recipientIds = Array.from(adminIdSet);
    }

    if (recipientIds.length === 0) { setPageError("No recipients found."); return; }

    const now = new Date().toISOString();
    let uploadedAttachments = [];

    if (attachmentFiles.length > 0) {
      if (typeof setIsUploadingAttachment !== 'undefined') setIsUploadingAttachment(true);
      if (typeof setIsUploading !== 'undefined') setIsUploading(true);
      for (const file of attachmentFiles) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setPageError("File too large. Max 10MB.");
          if (typeof setIsUploadingAttachment !== 'undefined') setIsUploadingAttachment(false);
          if (typeof setIsUploading !== 'undefined') setIsUploading(false);
          return;
        }
        const cleanedName = sanitizeAttachmentFileName(file.name);
        const filePath = `${currentTeacherId}/${activeConversation.id}/${Date.now()}_${cleanedName}`;
        const uploadResult = await supabase.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
          .upload(filePath, file, { cacheControl: "3600", upsert: false });
          
        if (uploadResult.error) {
          console.error("Upload error:", uploadResult.error);
          setPageError(`File upload failed: ${uploadResult.error.message}`);
          setIsUploading(false);
          return;
        }
        
        const publicUrlResult = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET).getPublicUrl(filePath);
        uploadedAttachments.push({
          file_url: String(publicUrlResult?.data?.publicUrl || "").trim(),
          file_name: cleanedName,
          file_type: String(file.type || "application/octet-stream").trim(),
          file_size: Number(file.size || 0),
        });
      }
      if (typeof setIsUploadingAttachment !== 'undefined') setIsUploadingAttachment(false);
      if (typeof setIsUploading !== 'undefined') setIsUploading(false);
    }

    const firstAttachment = uploadedAttachments[0] || null;
    
    let insertPayload;
    if (activeConversation.isGroup) {
      insertPayload = [{
        sender_id: currentTeacherId,
        receiver_id: null,
        conversation_id: activeConversation.id,
        message_text: messageText,
        content: messageText,
        file_url: firstAttachment ? firstAttachment.file_url : null,
        file_name: firstAttachment ? firstAttachment.file_name : null,
        file_type: firstAttachment ? firstAttachment.file_type : null,
        file_size: firstAttachment ? firstAttachment.file_size : null,
        timestamp: now,
        status: "sent"
      }];
    } else {
      insertPayload = recipientIds.map((recipientId) => ({
        sender_id: currentTeacherId,
        receiver_id: recipientId,
        conversation_id: null,
        message_text: messageText,
        content: messageText,
        file_url: firstAttachment ? firstAttachment.file_url : null,
        file_name: firstAttachment ? firstAttachment.file_name : null,
        file_type: firstAttachment ? firstAttachment.file_type : null,
        file_size: firstAttachment ? firstAttachment.file_size : null,
        timestamp: now,
        status: "sent"
      }));
    }

    let data, error;
    try {
      const result = await db
        .from(MESSAGE_TABLE)
        .insert(insertPayload)
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status");
      data = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      console.warn("DB insert failed:", error);
    } else if (data && uploadedAttachments.length > 0) {
      const attachmentPayloads = [];
      for (const msgRow of data) {
        for (const att of uploadedAttachments) {
          attachmentPayloads.push({
            message_id: msgRow.id,
            ...att
          });
        }
      }
      if (attachmentPayloads.length > 0) {
        await db.from("message_attachments").insert(attachmentPayloads);
      }
    }

    if (!error) {
      for (const rId of recipientIds) {
        if (rId) {
          try {
            const { error: notifError } = await supabase.from("notifications").insert({
              user_id: rId,
              title: `New Message from ${teacherName || "Teacher"}`,
              type: "message",
              message: messageText.substring(0, 100) || "Sent an attachment",
              body: messageText.substring(0, 100) || "Sent an attachment",
              is_read: false,
              created_at: now
            });
            if (notifError) console.warn("[TeacherMessages] Notification insert error:", notifError);
          } catch (err) {
            console.warn("[TeacherMessages] Notification insert error:", err);
          }
        }
      }
    }

    const msg = {
      id: String(data?.[0]?.id || `${Date.now()}_${Math.random()}`),
      from: window.location.pathname.includes("admin") ? "admin" : "teacher",
      senderName: window.location.pathname.includes("admin") ? (typeof adminName !== 'undefined' ? adminName : 'Admin') : (typeof teacherName !== 'undefined' ? teacherName : 'Teacher'),
      text: messageText,
      time: String(data?.[0]?.timestamp || now),
      status: "sent",
      attachments: uploadedAttachments.map(a => ({
        id: Math.random().toString(),
        url: a.file_url,
        name: a.file_name,
        type: a.file_type,
        size: a.file_size,
        kind: a.file_type.startsWith('image/') ? 'image' : a.file_type.startsWith('video/') ? 'video' : 'document'
      }))
    };

    markMessageSeen(msg.id);

    const updated = conversations.map((c) =>
      c.id === activeConversation.id
        ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
        : c
    );
    saveConversations(updated);
    setMessageInput("");
    setAttachmentFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
  };

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (attachmentFiles.length + files.length > 10) {
      setPageError("Maximum 10 attachments allowed per message.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const validFiles = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setPageError("One or more files exceed the 10MB limit.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      validFiles.push(file);
    }
    setAttachmentFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
  };

  const removeAttachment = (index) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectConv = async (conv) => {
    markAsRead(conv.isGroup ? conv.id : null, conv.isGroup ? null : conv.participantId);
    
    // Local sync
    const updatedConvs = conversations.map(c => {
      if (c.id === conv.id) {
        return {
          ...c,
          messages: c.messages?.map(m => ({ ...m, isSeen: true, isRead: true })) || []
        };
      }
      return c;
    });
    setConversations(updatedConvs);
    
    // DB sync
    try {
      if (conv.isGroup) {
        await db.from("messages").update({ is_read: true, status: 'read' })
          .eq("conversation_id", conv.id)
          .neq("sender_id", teacherId)
          .eq("is_read", false);
      } else {
        await db.from("messages").update({ is_read: true, status: 'read' })
          .eq("sender_id", conv.participantId)
          .eq("receiver_id", teacherId)
          .eq("is_read", false);
      }
    } catch (err) {
      console.error("[TeacherMessages] DB mark read error:", err);
    }
    
    setSelectedConvId(conv.id);
    setShowThread(true);
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
      const { error } = await db.from("groupchats").update({ name: newName }).eq("id", selectedConv.id);
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
      const { error } = await db.from("groupchats").delete().eq("id", selectedConv.id);
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

  const totalUnread = activeConversationsList.reduce((sum, c) => sum + (getUnreadCount(c) || 0), 0);

  const filterCounts = {
    all: activeConversationsList.length,
    unread: activeConversationsList.filter((c) => (getUnreadCount(c) || 0) > 0).length,
    read: activeConversationsList.filter((c) => (getUnreadCount(c) || 0) === 0 && !c.isVideoMeet).length,
    mentions: activeConversationsList.filter((c) =>
      (c.messages || []).some((m) => m.from !== "teacher" && m.text?.includes(`@${teacherName}`))
    ).length,
    videomeet: activeConversationsList.filter((c) => c.isVideoMeet === true).length,
  };



  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex relative">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 h-full overflow-hidden flex flex-col lg:pl-64">
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

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-6 gap-4">
          <div data-tour="teacher-messages-header" className="bg-green-600 rounded-2xl p-5 text-white shadow-sm flex-shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-7 h-7 opacity-80" />
                <div>
                  <h1 className="text-xl font-bold">Messages</h1>
                  <p className="text-emerald-100 text-sm">
                    {activeConversationsList.length} conversation{activeConversationsList.length !== 1 ? "s" : ""}
                    {totalUnread > 0 && ` · ${totalUnread} unread`}
                  </p>
                </div>
              </div>
              <button
                data-tour="teacher-messages-new-btn"
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

          <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            <div data-tour="teacher-messages-list" className={`lg:col-span-1 border-r border-gray-200 flex flex-col min-h-0 h-full overflow-hidden ${showThread ? "hidden lg:flex" : "flex"}`}>
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
                              <p className={`text-sm truncate ${getUnreadCount(conv) > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                                {conv.participantName}
                              </p>
                              <span className={`text-xs ml-2 flex-shrink-0 ${getUnreadCount(conv) > 0 ? "font-bold text-blue-600" : "text-gray-500"}`}>{getTimeLabel(conv.lastMessageTime)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-500 truncate">{getConversationDetailLine(conv)}</p>
                            </div>
                            {conv.messages?.length > 0 && (
                              <p className={`text-xs truncate mt-0.5 ${getUnreadCount(conv) > 0 ? "font-bold text-gray-900" : "text-gray-600"}`}>
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

            <div data-tour="teacher-messages-thread" className={`lg:col-span-2 flex flex-col min-h-0 h-full overflow-hidden ${showThread ? "flex" : "hidden lg:flex"}`}>
              {selectedConv ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowThread(false)}
                      className="lg:hidden p-1.5 hover:bg-green-100 rounded-lg transition-colors -ml-1 mr-1"
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
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
                              {Boolean((msg.attachments && msg.attachments.length > 0) || msg.fileUrl || msg.fileName || (msg.text && /^Sent (\d+ attachment\(s\)|an attachment|an image|a video)$/i.test(msg.text.trim()))) && (
                                <MessageAttachmentPreview msg={msg} isSelf={isTeacher} />
                              )}
                              {msg.text && !/^Sent (\d+ attachment\(s\)|an attachment|an image|a video)$/i.test(msg.text.trim()) && (
                                <p className="leading-relaxed">{msg.text}</p>
                              )}
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

                  {attachmentFiles.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2">
              {attachmentFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">
                  <Paperclip className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-gray-700 max-w-[150px] truncate">{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(idx)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

                  <form onSubmit={handleSend} className="px-6 py-4 border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachmentChange} accept="*/*" />
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
                      disabled={(!messageInput.trim() && attachmentFiles.length === 0) || isUploadingAttachment}
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
