import { useUnreadMessages } from "../../contexts/UnreadMessagesContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";
// supabaseAdmin uses the service-role key and bypasses RLS — used for message read/write
const db = supabaseAdmin || supabase;
import {
  Search,
  Send,
  Plus,
  Edit2,
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
  Paperclip,
  Download,
} from "lucide-react";

const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

const sanitizeAttachmentFileName = (fileName) =>
  String(fileName)
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .replace(/_+/g, "_");
const HARDCODED_ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const HARDCODED_ADMIN_EMAIL = "admin.connected.local";
const HARDCODED_ADMIN_NAME = "Connected Admin";

const FILTERS = [
  { key: "all",       label: "All",        icon: MessageSquare },
  { key: "unread",    label: "Unread",     icon: Circle },
  { key: "read",      label: "Read",       icon: CheckCheck },
];

export function AdminMessages() {
  const { unreadConversations, markAsRead } = useUnreadMessages();
  const getUnreadCount = (conv) => unreadConversations[conv.isGroup ? `group_${conv.id}` : `dm_${conv.id}`] || 0;
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const adminIdRef = useRef("");
  const seenMessageIdsRef = useRef(new Set());
  const conversationsRef = useRef([]);
  const selectedConvIdRef = useRef(null);

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
  const [adminId, setAdminId] = useState("");
  const [pageError, setPageError] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "admin") { navigate("/login"); return; }
    setAdminName(user.name);

    // Load all teachers and students from Supabase
    const loadAllUsers = async () => {
      try {
        const { data, error } = await db
          .from("profiles")
          .select("id, first_name, middle_name, last_name, email, role")
          .order("role", { ascending: true })
          .limit(100);
        if (!error && data) {
          const users = data
            .filter((row) => row.role && ["teacher", "student", "admin"].includes(row.role))
            .map((row) => ({
              id: String(row.id),
              name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ") || "User",
              email: String(row.email || ""),
              role: String(row.role || "student"),
            }));
          setAllTeachers(users);
          console.log("[AdminMessages] Loaded users:", users.length, users);
        } else {
          console.error("[AdminMessages] Error loading users:", error);
        }
      } catch (err) {
        console.error("[AdminMessages] Failed to load users:", err);
        // Fallback to localStorage cache
        const cached = JSON.parse(localStorage.getItem("admin_teacher_list") || "[]");
        setAllTeachers(cached);
      }
    };
    loadAllUsers();

    // Resolve admin's profile id
    const ensureHardcodedAdminProfileExists = async () => {
      try {
        const { data: existingAdmin, error: selectError } = await db
          .from("profiles")
          .select("id")
          .eq("id", HARDCODED_ADMIN_ID)
          .maybeSingle();

        if (selectError) {
          console.error("[AdminMessages] Failed to check hardcoded admin profile:", selectError);
          return;
        }

        if (!existingAdmin) {
          const { error: insertError } = await db.from("profiles").insert({
            id: HARDCODED_ADMIN_ID,
            first_name: "Connected",
            last_name: "Admin",
            email: HARDCODED_ADMIN_EMAIL,
            role: "admin",
            status: "Active",
            is_verified: true,
            created_at: new Date().toISOString(),
          });
          if (insertError) {
            console.error("[AdminMessages] Failed to create hardcoded admin profile:", insertError);
          } else {
            console.log("[AdminMessages] Hardcoded admin profile created successfully");
          }
        }
      } catch (err) {
        console.error("[AdminMessages] Error ensuring hardcoded admin profile exists:", err);
      }
    };

    const resolveAdmin = async () => {
      try {
        console.log("[AdminMessages] Resolving admin for email:", user.email);
        
        // For hardcoded admin, use hardcoded UUID instead of database lookup
        if (user.email === HARDCODED_ADMIN_EMAIL) {
          adminIdRef.current = HARDCODED_ADMIN_ID;
          setAdminId(HARDCODED_ADMIN_ID);
          await ensureHardcodedAdminProfileExists();
          await loadConversationsFromDB();
          return;
        }

        const { data } = await db
          .from("profiles")
          .select("id")
          .ilike("email", user.email)
          .maybeSingle();
        if (data?.id) {
          const resolvedId = String(data.id);
          adminIdRef.current = resolvedId;
          setAdminId(resolvedId);
          await loadConversationsFromDB();
        } else {
          console.warn("[AdminMessages] No admin profile found for email:", user.email);
        }
      } catch (err) {
        console.error("[AdminMessages] Failed to resolve admin id:", err);
      }
    };
    resolveAdmin();
  }, [navigate]);

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

  const appendIncomingMessage = useCallback((row, currentAdminId) => {
    if (!row?.id || !currentAdminId) return false;

    const messageId = String(row.id);
    if (seenMessageIdsRef.current.has(messageId)) return false;

    const senderId = String(row.sender_id || "");
    const receiverId = String(row.receiver_id || "");
    const conversationId = String(row.conversation_id || "").trim();
    const targetConversationId = conversationId || `conv_${senderId === String(currentAdminId) ? receiverId : senderId}`;
    const isRelevant = conversationId
      ? conversationsRef.current.some((conversation) => String(conversation.id) === conversationId)
      : senderId === String(currentAdminId) || receiverId === String(currentAdminId);

    if (!isRelevant) return false;

    let fileUrl = String(row.file_url || "").trim();
    let fileName = String(row.file_name || "").trim();
    let fileType = String(row.file_type || "").trim();
    let fileSize = Number(row.file_size || 0);
    let text = String(row.message_text || "").trim();

    if (!fileUrl && row.content) {
      try {
        const contentObj = JSON.parse(row.content);
        if (contentObj.file_url) {
          fileUrl = String(contentObj.file_url || "").trim();
          fileName = String(contentObj.file_name || "").trim();
          fileType = String(contentObj.file_type || "").trim();
          fileSize = Number(contentObj.file_size || 0);
          text = String(contentObj.message_text || "").trim();
        }
      } catch (error) {
        text = String(row.content || "").trim();
      }
    }

    const senderProfile = allTeachers.find((person) => String(person.id) === senderId);
    const fileTypeValue = fileType;
    const isAdminSender = senderId === String(currentAdminId);
    const message = {
      id: messageId,
      from: isAdminSender ? "admin" : "other",
      senderName: isAdminSender ? adminName || "Admin" : senderProfile?.name || "User",
      text,
      time: String(row.timestamp || row.created_at || new Date().toISOString()),
      fileUrl,
      fileName,
      fileType: fileTypeValue,
      fileSize,
      attachmentKind: fileTypeValue ? (fileTypeValue.startsWith("image/") ? "image" : fileTypeValue.startsWith("video/") ? "video" : "document") : "",
      isRead: Boolean(row.is_read),
      isSeen: isAdminSender || Boolean(row.is_read),
    };

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
          unreadCount: isActiveConversation ? 0 : (conversation.unreadCount || 0) + (isAdminSender ? 0 : 1),
        };
      });

      if (!updated) return current;

      return next.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    });

    return true;
  }, [adminName, allTeachers]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!supabase || !adminId) return;
    const channel = supabase
      .channel("global-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new;
        if (!newMsg) return;
        const currentAdminId = adminIdRef.current || HARDCODED_ADMIN_ID;
        appendIncomingMessage(newMsg, currentAdminId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, appendIncomingMessage]);

  const loadConversationsFromDB = async () => {
    try {
      const effectiveAdminId = adminIdRef.current || HARDCODED_ADMIN_ID;
      const adminFilter = `sender_id.eq.${effectiveAdminId},receiver_id.eq.${effectiveAdminId}`;

      // Load direct messages (exclude group messages)
      const { data: messageRows, error } = await db
        .from("messages")
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")
          .or(adminFilter)
        .is("conversation_id", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[AdminMessages] Failed to load messages from DB:", error);
        return;
      }
      const counterpartIds = [...new Set((messageRows || []).map((row) => {
        const senderId = String(row.sender_id || "");
        const receiverId = String(row.receiver_id || "");
        return senderId === effectiveAdminId ? receiverId : senderId;
      }).filter(Boolean))];
      
      // Fetch profiles for all counterparts
      const profileMap = new Map();
      if (counterpartIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, first_name, middle_name, last_name, email, role")
          .in("id", counterpartIds);
        
        if (profiles) {
          profiles.forEach((profile) => {
            profileMap.set(String(profile.id), {
              id: String(profile.id),
              name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "User",
              email: String(profile.email || ""),
              role: String(profile.role || "student"),
            });
          });
        }
      }
      
      // Build conversations from messages
      const conversationsByParticipant = new Map();
      
      (messageRows || []).forEach((row) => {
        const senderId = String(row.sender_id || "");
        const receiverId = String(row.receiver_id || "");
        const counterpartId = senderId === effectiveAdminId ? receiverId : senderId;
        if (!counterpartId) return;
        
        const profile = profileMap.get(counterpartId) || { name: "Unknown User", role: "student" };
        
        if (!conversationsByParticipant.has(counterpartId)) {
          conversationsByParticipant.set(counterpartId, {
            id: `conv_${counterpartId}`,
            participantId: counterpartId,
            participantName: profile.name,
            participantRole: profile.role,
            messages: [],
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            isVideoMeet: false,
          });
        }
        
        const conversation = conversationsByParticipant.get(counterpartId);
        
        // Determine if this is an admin message
        const isAdmin = senderId === effectiveAdminId;
        
        let fileUrl = String(row.file_url || "").trim();
        let fileName = String(row.file_name || "").trim();
        let fileType = String(row.file_type || "").trim();
        let fileSize = Number(row.file_size || 0);
        let text = String(row.message_text || "").trim();

        // Try parsing content as JSON for file metadata if direct fields are empty
        if (!fileUrl && row.content) {
          try {
            const contentObj = JSON.parse(row.content);
            if (contentObj.file_url) {
              fileUrl = String(contentObj.file_url || "").trim();
              fileName = String(contentObj.file_name || "").trim();
              fileType = String(contentObj.file_type || "").trim();
              fileSize = Number(contentObj.file_size || 0);
              text = String(contentObj.message_text || "").trim();
            }
          } catch (e) {
            // content is not JSON, use as text
            text = String(row.content || "").trim();
          }
        }

        const attachmentKind = fileType ? (fileType.startsWith("image/") ? "image" : fileType.startsWith("video/") ? "video" : "document") : "";
        conversation.messages.push({
          id: String(row.id),
          from: isAdmin ? "admin" : "other",
          senderName: isAdmin ? adminName : profile.name,
          text: text,
          time: String(row.timestamp || row.created_at || new Date().toISOString()),
          fileUrl: fileUrl,
          fileName: fileName,
          fileType: fileType,
          fileSize: fileSize,
          attachmentKind: attachmentKind,
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
        });
        
        // Update last message time
        conversation.lastMessageTime = row.timestamp || row.created_at || conversation.lastMessageTime;
        markMessageSeen(row.id);
      });
      
      // Load group conversations
      const currentAdminId = effectiveAdminId;

      let groupConversations = [];

      const { data: participantRows, error: participantError } = await db
        .from("conversation_participants")
        .select("conversation_id, profile_id")
        .eq("profile_id", currentAdminId);

      if (!participantError && participantRows && participantRows.length > 0) {
        const conversationIds = [...new Set(participantRows.map((row) => row.conversation_id))];
        
        const { data: conversationData, error: convError } = await db
          .from("conversations")
          .select("id, name, is_group, created_by")
          .in("id", conversationIds)
          .eq("is_group", true);

        console.log("[AdminMessages] Found conversation IDs for admin:", conversationIds);
        console.log("[AdminMessages] Conversation data query result:", { conversationData, convError });

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
                .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: true });

              console.log("[AdminMessages] Group messages loaded for conversation", conv.id, ":", {
                count: groupMessages?.length || 0,
                messages: groupMessages,
                error: groupMsgError
              });

              const groupMsgObjs = (groupMessages || []).map((row) => {
                let fileUrl = String(row.file_url || "").trim();
                let fileName = String(row.file_name || "").trim();
                let fileType = String(row.file_type || "").trim();
                let fileSize = Number(row.file_size || 0);
                let text = String(row.message_text || "").trim();

                // Try parsing content as JSON for file metadata if direct fields are empty
                if (!fileUrl && row.content) {
                  try {
                    const contentObj = JSON.parse(row.content);
                    if (contentObj.file_url) {
                      fileUrl = String(contentObj.file_url || "").trim();
                      fileName = String(contentObj.file_name || "").trim();
                      fileType = String(contentObj.file_type || "").trim();
                      fileSize = Number(contentObj.file_size || 0);
                      text = String(contentObj.message_text || "").trim();
                    }
                  } catch (e) {
                    // content is not JSON, use as text
                    text = String(row.content || "").trim();
                  }
                }

                const attachmentKind = fileType ? (fileType.startsWith("image/") ? "image" : fileType.startsWith("video/") ? "video" : "document") : "";
                console.log("[AdminMessages] Processing group message with file:", {
                  hasFile: !!fileUrl,
                  fileName: fileName,
                  fileType: fileType,
                  attachmentKind: attachmentKind,
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
                  rawRow: row
                });
                return {
                  id: String(row.id || `${Date.now()}_${Math.random()}`),
                  from: String(row.sender_id || "") === currentAdminId ? "admin" : "other",
                  senderName: String(row.sender_id || "") === currentAdminId ? adminName || "Admin" : "Group Member",
                  text: text,
                  time: String(row.timestamp || row.created_at || new Date().toISOString()),
                  fileUrl: fileUrl,
                  fileName: fileName,
                  fileType: fileType,
                  fileSize: fileSize,
                  attachmentKind: attachmentKind,
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
                  isRead: Boolean(row.is_read),
                  isSeen: String(row.sender_id || "") === currentAdminId,
                };
              });

              (groupMessages || []).forEach((row) => markMessageSeen(row.id));

              groupConversations.push({
                id: conv.id,
                participantId: "",
                participantIds: participantIds,
                participantName: conv.name || `${participantIds.length} members`,
                participantRole: "group",
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
      
      // Combine direct messages and group conversations
      const allConversations = [...conversationsByParticipant.values(), ...groupConversations];
      saveConversations(allConversations);
    } catch (error) {
      console.error("[AdminMessages] Error loading conversations from DB:", error);
    }
  };

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState("leave"); // "leave" | "delete"

  const handleOpenRename = () => {
    if (!selectedConv || !selectedConv.isGroup) return;
    setShowGroupMenu(false);
    setRenameValue(String(selectedConv.participantName || ""));
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    const newName = String(renameValue || "").trim();
    if (!newName) { setPageError("Group name cannot be empty."); return; }
    if (!selectedConv) return;
    try {
      const { error } = await db.from("conversations").update({ name: newName }).eq("id", selectedConv.id);
      if (error) throw error;
      const updated = conversations.map((c) => c.id === selectedConv.id ? { ...c, participantName: newName } : c);
      setConversations(updated);
      setShowRenameModal(false);
      setPageError("");
    } catch (err) { 
      console.error("[AdminMessages] Rename error:", err);
      setPageError(err.message || "Unable to rename group."); 
    }
  };

  const handleLeaveConversation = async () => {
    if (!selectedConv || !adminId) return;
    try {
      const { error } = await db
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", selectedConv.id)
        .eq("profile_id", adminId);
      
      if (error) throw error;
      
      const remaining = conversations.filter((c) => c.id !== selectedConv.id);
      setConversations(remaining);
      setShowDeleteConfirm(false);
      setShowGroupMenu(false);
      setSelectedConvId(remaining.length ? remaining[0].id : null);
      setPageError("");
    } catch (err) {
      console.error("[AdminMessages] Leave error:", err);
      setPageError("Unable to leave group chat.");
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    try { 
      const { error } = await db.from("conversations").delete().eq("id", selectedConv.id);
      if (error) throw error;
      
      const remaining = conversations.filter((c) => c.id !== selectedConv.id);
      setConversations(remaining);
      setShowDeleteConfirm(false);
      setShowGroupMenu(false);
      setSelectedConvId(remaining.length ? remaining[0].id : null);
      setPageError("");
    } catch (err) {
      console.error("[AdminMessages] Delete error:", err);
      setPageError("Unable to delete conversation.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;
  const activeMessagesLength = selectedConv?.messages?.length || 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId, activeMessagesLength]);

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
        filtered = filtered.filter((c) => (getUnreadCount(c) || 0) > 0);
        break;
      case "read":
        filtered = filtered.filter((c) => (getUnreadCount(c) || 0) === 0 && !c.isVideoMeet);
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

  const handleStartConversation = (person) => {
    const existing = conversations.find((c) => c.participantId === person.id);
    if (existing) {
      setSelectedConvId(existing.id);
      setShowNewModal(false);
      setRecipientSearch("");
      return;
    }
    const newConv = {
      id: Date.now().toString(),
      participantId: person.id,
      participantName: person.name,
      participantRole: person.role || "teacher",
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

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);
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

  const handleSend = async (e) => {
    e.preventDefault();
    const text = String(messageInput || "").trim();
    const activeConversation = selectedConv;
    const adminSenderId = adminId || HARDCODED_ADMIN_ID;
    if ((!text && attachmentFiles.length === 0) || !activeConversation || !adminSenderId || !supabase) return;

    setIsUploading(true);

    const recipientIds = activeConversation.isGroup
      ? buildStableIdList(activeConversation.participantIds)
      : [String(activeConversation.participantId || "").trim()].filter(Boolean);

    if (recipientIds.length === 0) { setPageError("No recipients found."); setIsUploading(false); return; }

    const now = new Date().toISOString();
    let uploadedAttachments = [];

    if (attachmentFiles.length > 0) {
      for (const file of attachmentFiles) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setPageError("File too large. Max 10MB.");
          setIsUploading(false);
          return;
        }
        const cleanedName = sanitizeAttachmentFileName(file.name);
        const filePath = `${adminSenderId}/${activeConversation.participantId || "group"}/${Date.now()}_${cleanedName}`;
        const uploadResult = await db.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
          .upload(filePath, file, { cacheControl: "3600", upsert: false });
          
        if (uploadResult.error) {
          console.error("Upload error:", uploadResult.error);
          setPageError(`File upload failed: ${uploadResult.error.message}`);
          setIsUploading(false);
          return;
        }
        
        const publicUrlResult = db.storage.from(MESSAGE_ATTACHMENT_BUCKET).getPublicUrl(filePath);
        uploadedAttachments.push({
          file_url: String(publicUrlResult?.data?.publicUrl || "").trim(),
          file_name: cleanedName,
          file_type: String(file.type || "application/octet-stream").trim(),
          file_size: Number(file.size || 0),
        });
      }
    }

    const messageText = text || (uploadedAttachments.length > 0 ? `Sent ${uploadedAttachments.length} attachment(s)` : "");
    
    let insertPayload;
    if (activeConversation.isGroup) {
      insertPayload = [{
        sender_id: adminSenderId,
        receiver_id: null,
        conversation_id: activeConversation.id,
        message_text: messageText,
        content: messageText,
        timestamp: now,
        status: "sent"
      }];
    } else {
      insertPayload = recipientIds.map((recipientId) => ({
        sender_id: adminSenderId,
        receiver_id: recipientId,
        conversation_id: null,
        message_text: messageText,
        content: messageText,
        timestamp: now,
        status: "sent"
      }));
    }

    let data, error;
    try {
      const result = await db
        .from("messages")
        .insert(insertPayload)
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status");
      data = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      console.error("[AdminMessages] Supabase insert failed:", JSON.stringify(error, null, 2), error);
      setPageError(`Failed to send: ${error.message}`);
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

    if (data && data.length > 0) {
      const msg = {
        id: String(data[0].id || `${Date.now()}_${Math.random()}`),
        from: "admin",
        senderName: adminName || 'Admin',
        text: messageText,
        time: String(data[0].timestamp || now),
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
    }

    setMessageInput("");
    setAttachmentFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
    setIsUploading(false);
  };

  const handleSelectConv = (conv) => {
      markAsRead(conv.isGroup ? conv.id : null, conv.isGroup ? null : conv.id);
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
    (t) => {
      const searchLower = recipientSearch.toLowerCase();
      const matches =
        t.name.toLowerCase().includes(searchLower) ||
        t.email?.toLowerCase().includes(searchLower) ||
        t.role?.toLowerCase().includes(searchLower);
      return matches;
    }
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (getUnreadCount(c) || 0), 0);

  const filterCounts = {
    all: conversations.length,
    unread: conversations.filter((c) => (getUnreadCount(c) || 0) > 0).length,
    read: conversations.filter((c) => (getUnreadCount(c) || 0) === 0 && !c.isVideoMeet).length,
    mentions: conversations.filter((c) =>
      (c.messages || []).some((m) => m.from !== "admin" && m.text?.includes(`@${adminName}`))
    ).length,
    videomeet: conversations.filter((c) => c.isVideoMeet === true).length,
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex relative">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 h-full overflow-hidden flex flex-col relative z-10 lg:pl-64">
        {/* Top Bar */}
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
              <h2 className="text-lg font-bold text-gray-900">Messages</h2>
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

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-6 gap-4">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-gray-900 shadow-lg flex-shrink-0">
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
          <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            {/* ══ Left: Conversations List ══ */}
            <div className="lg:col-span-1 border-r border-gray-200 flex flex-col min-h-0 h-full overflow-hidden">

              {/* Search + New */}
              <div className="p-3 border-b border-gray-100 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => { setShowNewModal(true); setRecipientSearch(""); }}
                  className="p-2 bg-blue-600 text-gray-900 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                  title="New Message"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-hide flex-shrink-0">
                {FILTERS.map(({ key, label, icon: Icon }) => {
                  const count = filterCounts[key];
                  const isActive = activeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                        isActive
                          ? "bg-blue-600 text-gray-900 shadow-sm"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                      {count > 0 && (
                        <span
                          className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center ${
                            isActive
                              ? "bg-white/25 text-gray-900"
                              : key === "unread"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-100 text-gray-600"
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
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                      {activeFilter === "videomeet" ? (
                        <Video className="w-6 h-6 text-blue-400" />
                      ) : activeFilter === "mentions" ? (
                        <AtSign className="w-6 h-6 text-blue-400" />
                      ) : (
                        <MessageSquare className="w-6 h-6 text-blue-400" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
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
                        className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                          selectedConvId === conv.id
                            ? "bg-blue-500/8 border-l-2 border-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm ${
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
                                <Video className="w-1.5 h-1.5 text-gray-900" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`text-sm font-semibold truncate ${getUnreadCount(conv) > 0 ? "text-gray-900" : "text-gray-700"}`}>
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
                              {getUnreadCount(conv) > 0 && (
                                <span className="w-5 h-5 bg-blue-600 text-gray-900 text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">NEW</span>
                              )}
                            </div>
                            {conv.messages?.length > 0 && (
                              <p className="text-xs text-gray-600 truncate mt-0.5">
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
            <div className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-hidden">
              {selectedConv ? (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm ${
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
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{selectedConv.participantName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        {selectedConv.isGroup ? (
                          <><Users className="w-3 h-3 text-blue-400" /> <span className="text-blue-400">Group Conversation</span></>
                        ) : selectedConv.isVideoMeet ? (
                          <><Video className="w-3 h-3 text-purple-400" /> <span className="text-purple-400">Video Meet Chat</span></>
                        ) : (
                          <><UserCog className="w-3 h-3 text-blue-400" /> <span className="text-blue-400">{selectedConv.participantRole || "Teacher"}</span></>
                        )}
                      </p>
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
                    </div>
                  </div>

                  {selectedConv.isGroup && showGroupMenu && (
                    <div className="relative z-10">
                      <div className="absolute right-6 top-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                        <button type="button" onClick={handleOpenRename} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <Edit2 className="w-4 h-4 text-blue-600" /> Rename Group
                        </button>
                        <button type="button" onClick={() => { setDeleteMode("leave"); setShowGroupMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50">
                          <X className="w-4 h-4 text-yellow-500" /> Leave Chat
                        </button>
                        <button type="button" onClick={() => { setDeleteMode("delete"); setShowGroupMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50">
                          <X className="w-4 h-4 text-red-600" /> Delete Conversation
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-3">
                    {(selectedConv.messages || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                          <Send className="w-6 h-6 text-gray-600" />
                        </div>
                        <p className="text-sm text-gray-500">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      (selectedConv.messages || []).map((msg, msgIndex) => {
                          const isAdmin = msg.from === "admin";
                          const hasMention = !isAdmin && msg.text?.includes(`@${adminName}`);
                          return (
                            <div key={`msg-${msg.id}-${msgIndex}`} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                isAdmin
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : hasMention
                                  ? "bg-yellow-50 border border-yellow-200 text-gray-900 rounded-bl-sm"
                                  : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
                              }`}>
                                {hasMention && (
                                  <p className="text-[10px] text-yellow-600 font-semibold mb-1 flex items-center gap-1">
                                    <AtSign className="w-2.5 h-2.5" /> Mentioned you
                                  </p>
                                )}
                                {((msg.attachments && msg.attachments.length > 0) || msg.fileUrl || msg.fileName) && (
                                    <div className="mb-2 space-y-2">
                                      {!msg.attachments?.length && (msg.fileUrl || msg.fileName) && (
                                        <div className={`flex items-center gap-2 p-2 rounded-lg ${
                                          isAdmin ? "bg-blue-700/50 text-blue-100" : "bg-gray-100 text-gray-700"
                                        }`}>
                                          {msg.attachmentKind === "image" ? (
                                            <img src={msg.fileUrl} alt="attachment" className="max-w-[200px] rounded-md" />
                                          ) : msg.attachmentKind === "video" ? (
                                            <Video className="w-5 h-5" />
                                          ) : (
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                                              <Download className="w-4 h-4 flex-shrink-0" />
                                              <span className="truncate max-w-[200px]">{msg.fileName || "Download file"}</span>
                                            </a>
                                          )}
                                        </div>
                                      )}
                                      
                                      {msg.attachments?.map((att, idx) => (
                                        <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${
                                          isAdmin ? "bg-blue-700/50 text-blue-100" : "bg-gray-100 text-gray-700"
                                        }`}>
                                          {att.kind === "image" ? (
                                            <img src={att.url} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-md object-contain" />
                                          ) : att.kind === "video" ? (
                                            <Video className="w-5 h-5" />
                                          ) : (
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                                              <Download className="w-4 h-4 flex-shrink-0" />
                                              <span className="truncate max-w-[200px]">{att.name || "Download file"}</span>
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                                <div className={`flex items-center justify-end gap-1 mt-1`}>
                                  <p className={`text-xs ${isAdmin ? "text-blue-100" : "text-gray-500"}`}>
                                    {getTimeLabel(msg.time)}
                                  </p>
                                  {isAdmin && (
                                    <span className="flex-shrink-0" title={msg.isSeen ? "Seen" : "Sent"}>
                                      {msg.isSeen ? (
                                        <CheckCheck className="w-3 h-3 text-blue-200" />
                                      ) : (
                                        <CheckCheck className="w-3 h-3 text-blue-300/50" />
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

                  {/* Input */}
                  <form
                    onSubmit={handleSend}
                    className="px-6 py-4 border-t border-gray-200 flex-shrink-0"
                  >
                    {pageError && (
                      <p className="text-xs text-red-500 mb-2">{pageError}</p>
                    )}
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
                    <div className="flex items-center gap-3">
                      <label className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer flex-shrink-0 group">
                        <Paperclip className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="sr-only"
                          onChange={handleAttachmentChange}
                          accept="*/*"
                          disabled={isUploading}
                        />
                      </label>
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder={`Message ${selectedConv.participantName}...`}
                        disabled={isUploading}
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={(!messageInput.trim() && attachmentFiles.length === 0) || isUploading}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {isUploading
                          ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Send className="w-5 h-5" />
                        }
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Admin Messaging</h3>
                  <p className="text-gray-500 text-sm mb-5">Select a conversation or start one with any teacher or student.</p>
                  <button
                    onClick={() => { setShowNewModal(true); setRecipientSearch(""); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-gray-900 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm"
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
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="border-b border-gray-200 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <UserCog className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">New Message</h3>
                  <p className="text-sm text-gray-500">Message teachers, students, or admins</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  autoFocus
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search teachers, students, or admins by name or email..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {allTeachers.length === 0 ? (
                <div className="py-12 text-center">
                  <UserCog className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No users found.</p>
                  <p className="text-xs text-gray-600 mt-1">Users must be registered first.</p>
                </div>
              ) : filteredRecipients.length === 0 && recipientSearch ? (
                <div className="py-12 text-center">
                  <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No matches found.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {(recipientSearch ? filteredRecipients : allTeachers).map((person) => {
                    const hasConv = conversations.find((c) => c.participantId === person.id);
                    const avatarColor = person.role === "teacher" ? "bg-gradient-to-br from-blue-500 to-indigo-600" : person.role === "admin" ? "bg-gradient-to-br from-purple-500 to-indigo-600" : "bg-gradient-to-br from-green-500 to-emerald-600";
                    const badgeColor = person.role === "teacher" ? "bg-blue-50 text-blue-700 border-blue-200" : person.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-green-50 text-green-700 border-green-200";
                    return (
                      <button
                        key={person.id}
                        onClick={() => handleStartConversation(person)}
                        className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className={`w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0`}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize flex-shrink-0 ${badgeColor}`}>{person.role}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{person.email || person.role}</p>
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
      {/* ══ RENAME MODAL ══ */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-blue-600 text-white">
              <h3 className="text-lg font-bold">Rename Group</h3>
            </div>
            <div className="px-6 py-4 mt-2">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Group name..."
                className="w-full px-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-100 font-semibold transition-colors">Cancel</button>
              <button onClick={handleRenameSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-900 rounded-xl text-sm font-bold transition-all shadow-sm">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE/LEAVE CONFIRM ══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className={`px-6 py-5 border-b border-gray-100 ${deleteMode === 'delete' ? 'bg-red-600' : 'bg-yellow-500'} text-gray-900`}>
              <h3 className="text-lg font-bold">{deleteMode === "delete" ? "Delete Conversation" : "Leave Conversation"}</h3>
            </div>
            <div className="px-6 py-4 mt-2">
              <p className="text-gray-700 text-sm leading-relaxed">
                {deleteMode === "delete" 
                  ? "Are you sure you want to delete this conversation for everyone? This action cannot be undone." 
                  : "Are you sure you want to leave this group chat? You will no longer see new messages."}
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-100 font-semibold transition-colors">Cancel</button>
              <button 
                onClick={deleteMode === "delete" ? handleDeleteConversation : handleLeaveConversation} 
                className={`px-4 py-2 ${deleteMode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-500 hover:bg-yellow-600'} text-gray-900 rounded-xl text-sm font-bold transition-all shadow-sm`}
              >
                {deleteMode === "delete" ? "Delete" : "Leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMessages;
