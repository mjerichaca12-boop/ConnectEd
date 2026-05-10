import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { supabase, supabaseAdmin } from "@/app/lib/supabaseClient";
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
const HARDCODED_ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const HARDCODED_ADMIN_EMAIL = "admin.connected.local";
const HARDCODED_ADMIN_NAME = "Connected Admin";

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
  const [adminId, setAdminId] = useState("");
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "admin") { navigate("/login"); return; }
    setAdminName(user.name);

    const savedConvs = JSON.parse(localStorage.getItem("admin_conversations") || "[]");
    setConversations(savedConvs);

    // Load all teachers and students from Supabase
    const loadAllUsers = async () => {
      try {
        const { data, error } = await supabase
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
        const { data: existingAdmin, error: selectError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", HARDCODED_ADMIN_ID)
          .maybeSingle();

        if (selectError) {
          console.error("[AdminMessages] Failed to check hardcoded admin profile:", selectError);
          return;
        }

        if (!existingAdmin) {
          const { error: insertError } = await supabase.from("profiles").insert({
            id: HARDCODED_ADMIN_ID,
            first_name: "Connected",
            last_name: "Admin",
            email: HARDCODED_ADMIN_EMAIL,
            role: "admin",
            created_at: new Date().toISOString(),
          });
          if (insertError) {
            console.error("[AdminMessages] Failed to create hardcoded admin profile:", insertError);
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
          console.log("[AdminMessages] Using hardcoded admin ID:", HARDCODED_ADMIN_ID);
          setAdminId(HARDCODED_ADMIN_ID);
          await ensureHardcodedAdminProfileExists();
          await loadConversationsFromDB();
          return;
        }
        
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", user.email)
          .maybeSingle();
        if (data?.id) {
          console.log("[AdminMessages] Found admin ID from database:", data.id);
          setAdminId(String(data.id));
          // Load conversations after adminId is resolved
          await loadConversationsFromDB();
        } else {
          console.log("[AdminMessages] No admin profile found for email:", user.email);
        }
      } catch (err) {
        console.error("[AdminMessages] Failed to resolve admin id:", err);
      }
    };
    resolveAdmin();
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId, conversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!supabase || !adminId) return;
    const channel = supabase
      .channel(`admin-messages-${adminId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async () => {
        console.log("[AdminMessages] New message received, reloading...");
        await loadConversationsFromDB();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId]);

  const saveConversations = (updated) => {
    setConversations(updated);
    localStorage.setItem("admin_conversations", JSON.stringify(updated));
  };

  const loadConversationsFromDB = async () => {
    try {
      // Handle case where adminId is null - use hardcoded admin UUID
      const adminFilter = adminId
        ? `sender_id.eq.${adminId},receiver_id.eq.${adminId}`
        : `sender_id.eq.${HARDCODED_ADMIN_ID},receiver_id.eq.${HARDCODED_ADMIN_ID}`;
      
      // Load direct messages (exclude group messages)
      const { data: messageRows, error } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size")
        .or(adminFilter)
        .is("conversation_id", null) // Only load direct messages, not group messages
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error("[AdminMessages] Failed to load messages from DB:", error);
        return;
      }
      
      const counterpartIds = [...new Set((messageRows || []).map((row) => {
        const senderId = row.sender_id;
        const receiverId = row.receiver_id;
        
        // Determine if this is an admin message and get the counterpart
        let counterpartId = null;
        if (adminId) {
          // If we have adminId, use normal logic
          counterpartId = senderId === adminId ? receiverId : senderId;
        } else {
          // If adminId is null, use hardcoded admin UUID
          if (senderId === HARDCODED_ADMIN_ID) {
            counterpartId = receiverId; // Admin sent to this user
          } else if (receiverId === HARDCODED_ADMIN_ID) {
            counterpartId = senderId; // This user sent to admin
          }
        }
        
        return counterpartId;
      }).filter(Boolean))];
      
      // Fetch profiles for all counterparts
      const profileMap = new Map();
      if (counterpartIds.length > 0) {
        const { data: profiles } = await supabase
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
        const counterpartId = senderId === adminId || senderId === HARDCODED_ADMIN_ID
          ? receiverId
          : senderId;
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
        let isAdmin = false;
        if (adminId) {
          // Normal logic with adminId
          isAdmin = senderId === adminId;
        } else {
          // Handle null admin ID - use hardcoded admin UUID
          isAdmin = senderId === HARDCODED_ADMIN_ID;
        }
        
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
        });
        
        // Update last message time
        conversation.lastMessageTime = row.timestamp || row.created_at || conversation.lastMessageTime;
      });
      
      // Load group conversations
      const currentAdminId = adminId || HARDCODED_ADMIN_ID;
      
      // Try multiple approaches to ensure we find admin's group conversations
      let groupConversations = [];
      
      // Approach 1: Direct participant lookup using service role client
      console.log("[AdminMessages] Looking for admin participants with ID:", currentAdminId);
      const { data: participantRows, error: participantError } = await supabaseAdmin
        .from("conversation_participants")
        .select("conversation_id, profile_id")
        .eq("profile_id", currentAdminId);
      
      console.log("[AdminMessages] Participant query result:", { participantRows, participantError });

      // Test: Check what's actually in conversation_participants table
      const { data: allParticipants, error: allError } = await supabase
        .from("conversation_participants")
        .select("*")
        .limit(5);
      
      console.log("[AdminMessages] Sample of all conversation_participants:", allParticipants);

      // Test: Simple query to verify database connection
      const { data: testProfiles, error: testError } = await supabase
        .from("profiles")
        .select("id, email")
        .limit(3);
      
      console.log("[AdminMessages] Database connection test - profiles:", { testProfiles, testError });

      // Check if admin ID from data matches what we're looking for
      const adminIdInData = "11111111-1111-1111-1111-111111111111";
      const adminIdInCode = currentAdminId;
      console.log("[AdminMessages] Admin ID comparison:", { 
        inData: adminIdInData, 
        inCode: adminIdInCode, 
        matches: adminIdInData === adminIdInCode 
      });

      if (!participantError && participantRows && participantRows.length > 0) {
        const conversationIds = [...new Set(participantRows.map((row) => row.conversation_id))];
        
        const { data: conversationData, error: convError } = await supabaseAdmin
          .from("conversations")
          .select("id, name, is_group, created_by")
          .in("id", conversationIds)
          .eq("is_group", true);

        console.log("[AdminMessages] Found conversation IDs for admin:", conversationIds);
        console.log("[AdminMessages] Conversation data query result:", { conversationData, convError });

        if (!convError && conversationData) {
          for (const conv of conversationData) {
            // Load participants for this group
            const { data: groupParticipants, error: groupPartError } = await supabase
              .from("conversation_participants")
              .select("profile_id")
              .eq("conversation_id", conv.id);
            
            if (!groupPartError && groupParticipants) {
              const participantIds = [...new Set(groupParticipants.map((p) => p.profile_id))];
              
              // Load messages for this group conversation
              const { data: groupMessages, error: groupMsgError } = await supabase
                .from("messages")
                .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read")
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
                  isRead: Boolean(row.is_read),
                  isSeen: String(row.sender_id || "") === currentAdminId,
                };
              });

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

  const handleSend = async (e) => {
    e.preventDefault();
    
    // Validation checks
    if (!messageInput.trim()) {
      console.warn("[AdminMessages] Cannot send empty message");
      return;
    }
    if (!selectedConv) {
      console.warn("[AdminMessages] No conversation selected");
      return;
    }
    // Admin ID can be null for the hardcoded login, so we use a fixed sender_id instead
    
    const now = new Date().toISOString();
    const msg = {
      id: Date.now().toString(),
      from: "admin",
      senderName: adminName,
      text: messageInput.trim(),
      time: now,
    };

    console.log("[AdminMessages] Sending message:", {
      adminId,
      participantId: selectedConv.participantId,
      message: messageInput.trim()
    });

    // Save to Supabase messages table
    try {
      // Use hardcoded admin UUID for the hardcoded admin system
      const adminSenderId = adminId || HARDCODED_ADMIN_ID;
      
      let insertPayload;
      if (selectedConv.isGroup) {
        // For group messages, create a single message with conversation_id
        insertPayload = {
          sender_id: adminSenderId,
          receiver_id: null, // No specific receiver for group messages
          conversation_id: selectedConv.id,
          message_text: messageInput.trim(),
          content: messageInput.trim(),
          timestamp: now,
        };
      } else {
        // For direct messages, create message with receiver_id
        insertPayload = {
          sender_id: adminSenderId,
          receiver_id: selectedConv.participantId,
          conversation_id: null,
          message_text: messageInput.trim(),
          content: messageInput.trim(),
          timestamp: now,
        };
      }
      
      const { data, error } = await supabase.from("messages").insert(insertPayload).select();
      
      if (error) {
        console.error("[AdminMessages] Supabase insert failed:", error);
        // Fallback to localStorage only if database fails
        const updated = conversations.map((c) =>
          c.id === selectedConv.id
            ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
            : c
        );
        saveConversations(updated);
        console.log("[AdminMessages] Message saved to localStorage fallback");
      } else {
        console.log("[AdminMessages] Message saved to database:", data);
        // Reload conversations from database to get latest
        await loadConversationsFromDB();
      }
    } catch (err) {
      console.error("[AdminMessages] Supabase send error:", err);
      // Fallback to localStorage
      const updated = conversations.map((c) =>
        c.id === selectedConv.id
          ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
          : c
      );
      saveConversations(updated);
      console.log("[AdminMessages] Message saved to localStorage after error");
    }
    
    // Clear input field
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
    (t) => {
      const searchLower = recipientSearch.toLowerCase();
      const matches =
        t.name.toLowerCase().includes(searchLower) ||
        t.email?.toLowerCase().includes(searchLower) ||
        t.role?.toLowerCase().includes(searchLower);
      return matches;
    }
  );

  // Debug logging
  console.log("[AdminMessages] Search state:", {
    recipientSearch,
    allTeachersCount: allTeachers.length,
    filteredCount: filteredRecipients.length,
    showNewModal
  });

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
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 overflow-hidden flex flex-col relative z-10 lg:pl-64">
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

        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
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
          <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 lg:grid-cols-3">
            {/* ══ Left: Conversations List ══ */}
            <div className="lg:col-span-1 border-r border-gray-200 flex flex-col">

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
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-200"
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
                              <p className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-gray-900" : "text-gray-700"}`}>
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
                                <span className="w-5 h-5 bg-blue-600 text-gray-900 text-xs rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                  {conv.unreadCount}
                                </span>
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
            <div className="lg:col-span-2 flex flex-col">
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
                    <div>
                      <p className="font-semibold text-gray-900">{selectedConv.participantName}</p>
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
                        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                          <Send className="w-6 h-6 text-gray-600" />
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
                                  ? "bg-blue-600 text-gray-900 rounded-br-sm"
                                  : hasMention
                                  ? "bg-yellow-500/15 border border-yellow-500/30 text-gray-900 rounded-bl-sm"
                                  : "bg-gray-50 text-gray-900 rounded-bl-sm"
                              }`}
                            >
                              {hasMention && (
                                <p className="text-[10px] text-yellow-400 font-semibold mb-1 flex items-center gap-1">
                                  <AtSign className="w-2.5 h-2.5" /> Mentioned you
                                </p>
                              )}
                              <p className="leading-relaxed">{msg.text}</p>
                              {msg.fileUrl && (
                                <div className="mt-2">
                                  {msg.attachmentKind === "image" ? (
                                    <img
                                      src={msg.fileUrl}
                                      alt={msg.fileName}
                                      className="max-w-full rounded-lg border border-gray-200"
                                      style={{ maxHeight: "200px" }}
                                    />
                                  ) : (
                                    <a
                                      href={msg.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                                        isAdmin
                                          ? "bg-blue-500/30 text-blue-100 hover:bg-blue-500/40"
                                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                      }`}
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                      <span className="truncate max-w-[200px]">{msg.fileName}</span>
                                      <span className="text-xs opacity-70">({(msg.fileSize / 1024).toFixed(1)} KB)</span>
                                    </a>
                                  )}
                                </div>
                              )}
                              <p className={`text-xs mt-1 ${isAdmin ? "text-blue-100" : "text-gray-600"} text-right`}>
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
                    className="px-6 py-4 border-t border-gray-200 flex items-center gap-3 flex-shrink-0"
                  >
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={`Message ${selectedConv.participantName}...`}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-white/20 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={!messageInput.trim()}
                      className="p-2.5 bg-blue-600 text-gray-900 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
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
    </div>
  );
}

export default AdminMessages;
