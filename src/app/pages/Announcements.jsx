import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { AnnouncementAttachmentPreview } from "@/app/components/AnnouncementAttachmentPreview";
import { supabase } from "@/app/lib/supabaseClient";
import { parseStoredFileList, sortAnnouncements } from "@/app/lib/teacherHelpers";
import {
  Bell,
  Megaphone,
  Search,
  Filter,
  BookOpen,
  User,
  Clock,
} from "lucide-react";

const announcementTableCandidates = ["announcements", "school_announcements"];
let announcementAttachmentsTableStatus = "unknown";

const normalizeAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "student" || normalized === "students") return "Students";
  if (normalized === "teacher" || normalized === "teachers") return "Teacher";
  if (normalized === "schoolwide" || normalized === "school wide") return "School-wide";
  return "School-wide";
};

const normalizePriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
};

const normalizeAudienceType = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "student" || normalized === "students") return "student";
  if (normalized === "teacher" || normalized === "teachers") return "teacher";
  return "school";
};

const audienceLabelFromType = (audienceType) => {
  if (audienceType === "student") return "Students";
  if (audienceType === "teacher") return "Teacher";
  return "School-wide";
};

const normalizeTimestamp = (row) =>
  row?.created_at ||
  row?.date_posted ||
  row?.datePosted ||
  row?.timestamp ||
  row?.updated_at ||
  new Date().toISOString();

const getAnnouncementAttachmentKind = (fileType, fileName, fileUrl) => {
  const normalizedType = String(fileType || "").trim().toLowerCase();
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const normalizedUrl = String(fileUrl || "").trim().toLowerCase();

  if (normalizedType.startsWith("image/")) return "image";
  if (normalizedType.startsWith("video/")) return "video";

  const source = normalizedName || normalizedUrl;
  const extensionMatch = source.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension)) return "image";
  if (["mp4", "webm", "ogg", "mov", "m4v"].includes(extension)) return "video";
  if (normalizedUrl) return "document";

  return "";
};

const buildAnnouncementAttachments = (row, attachmentRows = []) => {
  if (Array.isArray(attachmentRows) && attachmentRows.length > 0) {
    const attachments = attachmentRows
      .map((attachment, index) => {
        const fileName = String(attachment?.file_name || `File ${index + 1}`).trim();
        const fileUrl = String(attachment?.file_url || "").trim();
        const filePath = String(attachment?.file_path || "").trim();
        const fileType = String(attachment?.file_type || "").trim();

        return {
          fileName,
          fileUrl,
          filePath,
          fileType,
          kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl),
        };
      })
      .filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath);

    return { attachments };
  }

  const fileNames = parseStoredFileList(row?.file_name);
  const fileUrls = parseStoredFileList(row?.file_url);
  const filePaths = parseStoredFileList(row?.file_path);
  const fileTypes = parseStoredFileList(row?.file_type);
  const totalCount = Math.max(fileNames.length, fileUrls.length, filePaths.length, fileTypes.length);

  const attachments = Array.from({ length: totalCount }, (_, index) => {
    const fileName = fileNames[index] || `File ${index + 1}`;
    const fileUrl = fileUrls[index] || "";
    const filePath = filePaths[index] || "";
    const fileType = fileTypes[index] || "";

    return {
      fileName,
      fileUrl,
      filePath,
      fileType,
      kind: getAnnouncementAttachmentKind(fileType, fileName, fileUrl),
    };
  }).filter((attachment) => attachment.fileName || attachment.fileUrl || attachment.filePath);

  return { attachments };
};

const normalizeAnnouncement = (row, attachmentRows = []) => {
  const audienceType = normalizeAudienceType(
    row?.audience_type ??
      row?.target_audience ??
      row?.targetAudience ??
      row?.audience ??
      row?.target_audience_type ??
      row?.recipient_audience ??
      "school"
  );

  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? "").trim(),
    content: String(row?.content ?? "").trim(),
    targetAudience: row?.audience_type != null
      ? audienceLabelFromType(audienceType)
      : normalizeAudience(
          row?.target_audience ??
            row?.targetAudience ??
            row?.audience ??
            row?.target_audience_type ??
            row?.recipient_audience ??
            row?.audience_type ??
            "School-wide"
        ),
    audienceType,
    priority: normalizePriority(
      row?.priority ??
        row?.announcement_priority ??
        row?.importance ??
        row?.priority_level ??
        "Medium"
    ),
    createdAt: normalizeTimestamp(row),
    subject: String(row?.subject ?? row?.course ?? row?.course_name ?? row?.class_name ?? row?.topic ?? "").trim(),
    author: row?.author || row?.created_by_name || row?.created_by || "Admin Office",
    ...buildAnnouncementAttachments(row, attachmentRows),
  };
};

const matchesStudentAudience = (announcement) => {
  const normalizedType = String(announcement?.audienceType || "").trim().toLowerCase();
  if (normalizedType) {
    return normalizedType === "school" || normalizedType === "student";
  }

  const normalizedAudience = String(announcement?.targetAudience ?? "").trim().toLowerCase();
  return normalizedAudience.includes("school") || normalizedAudience.includes("student");
};

function Announcements() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementTables, setAnnouncementTables] = useState([]);

  const resolveAvailableAnnouncementTables = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const availableTables = [];
    for (const tableName of announcementTableCandidates) {
      const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });
      if (!error) {
        availableTables.push(tableName);
      }
    }

    if (availableTables.length === 0) {
      throw new Error("Could not find the announcements table in Supabase.");
    }

    setAnnouncementTables(availableTables);
    return availableTables;
  };

  const resolveAnnouncementTable = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    if (announcementTables.length > 0) {
      for (const tableName of announcementTables) {
        const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });

        if (!error) {
          return tableName;
        }
      }
    }

    const tables = await resolveAvailableAnnouncementTables();
    return tables[0];
  };

  const getAnnouncementTableName = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    if (announcementTable) {
      const { error } = await supabase.from(announcementTable).select("id", { count: "exact", head: true });

      if (!error) {
        return announcementTable;
      }
    }

    return resolveAnnouncementTable();
  };

  const fetchAttachmentRowsByAnnouncementId = async (tableName, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Map();
    }

    const attachmentTableName = "announcement_attachments";
    const attachmentForeignKey = tableName === "school_announcements" ? "school_announcement_id" : "announcement_id";

    if (announcementAttachmentsTableStatus === "missing") {
      return new Map();
    }

    if (announcementAttachmentsTableStatus === "unknown") {
      const { error: checkError } = await supabase
        .from(attachmentTableName)
        .select("id", { head: true, count: "exact" })
        .limit(1);

      if (checkError) {
        announcementAttachmentsTableStatus = "missing";
        return new Map();
      }

      announcementAttachmentsTableStatus = "available";
    }

    const ids = rows.map((row) => String(row?.id || "").trim()).filter(Boolean);
    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from(attachmentTableName)
      .select(`${attachmentForeignKey}, file_url, file_name, file_path, file_type, created_at`)
      .in(attachmentForeignKey, ids)
      .order("created_at", { ascending: true });

    if (error) {
      announcementAttachmentsTableStatus = "missing";
      return new Map();
    }

    announcementAttachmentsTableStatus = "available";

    const grouped = new Map();
    for (const attachment of data ?? []) {
      const announcementId = String(attachment?.[attachmentForeignKey] ?? "");
      const list = grouped.get(announcementId) || [];
      list.push(attachment);
      grouped.set(announcementId, list);
    }

    return grouped;
  };

  const loadAnnouncements = async () => {
    const tableNames = announcementTables.length > 0 ? announcementTables : await resolveAvailableAnnouncementTables();
    const tableResults = await Promise.all(
      tableNames.map(async (tableName) => {
        const { data, error } = await supabase
          .from(tableName)
          .select("id, title, content, audience_type, created_at, priority")
          .order("created_at", { ascending: false });

        if (error) {
          const fallback = await supabase
            .from(tableName)
            .select("id, title, content, audience_type, created_at, priority")
            .order("updated_at", { ascending: false });

          if (fallback.error) {
            return [];
          }

          const fallbackRows = fallback.data ?? [];
          const fallbackAttachmentRowsByAnnouncementId = await fetchAttachmentRowsByAnnouncementId(tableName, fallbackRows);
          return fallbackRows
            .map((row) => normalizeAnnouncement(row, fallbackAttachmentRowsByAnnouncementId.get(String(row?.id ?? "")) || []))
            .filter((item) => item.id && matchesStudentAudience(item));
        }

        const rows = data ?? [];
        const attachmentRowsByAnnouncementId = await fetchAttachmentRowsByAnnouncementId(tableName, rows);

        return rows
          .map((row) => normalizeAnnouncement(row, attachmentRowsByAnnouncementId.get(String(row?.id ?? "")) || []))
          .filter((item) => item.id && matchesStudentAudience(item));
      })
    );

    const mergedById = new Map();
    for (const items of tableResults) {
      for (const item of items) {
        const existing = mergedById.get(item.id);
        if (!existing || new Date(item.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          mergedById.set(item.id, item);
        }
      }
    }

    return sortAnnouncements(Array.from(mergedById.values()));
  };

  useEffect(() => {
    const initialize = async () => {
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
        const rows = await loadAnnouncements();
        const readIds = new Set(JSON.parse(localStorage.getItem("student_announcement_reads") || "[]"));
        const withReadState = rows.map((item) => ({
          ...item,
          isRead: readIds.has(item.id),
        }));

        setAnnouncements(withReadState);
      } catch (error) {
        console.error("Failed to load announcements:", error);
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!announcementTables.length || !supabase) return undefined;

    const channels = announcementTables.map((tableName) => (
      supabase
        .channel(`student-announcements-${tableName}`)
        .on("postgres_changes", { event: "*", schema: "public", table: tableName }, async () => {
          try {
            const rows = await loadAnnouncements();
            const readIds = new Set(JSON.parse(localStorage.getItem("student_announcement_reads") || "[]"));
            setAnnouncements(rows.map((item) => ({ ...item, isRead: readIds.has(item.id) })));
          } catch {
            // Keep current state if realtime refresh fails.
          }
        })
        .subscribe()
    ));

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [announcementTables]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleAnnouncementClick = (announcement) => {
    setSelectedAnnouncement(announcement);
    if (!announcement.isRead) {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcement.id ? { ...a, isRead: true } : a))
      );
      const readIds = new Set(JSON.parse(localStorage.getItem("student_announcement_reads") || "[]"));
      readIds.add(announcement.id);
      localStorage.setItem("student_announcement_reads", JSON.stringify(Array.from(readIds)));
    }
  };

  // All unique classes for filter
  const allClasses = [...new Set(announcements.map((a) => a.targetAudience).filter(Boolean))];

  const visibleAnnouncements = announcements.filter((announcement) => matchesStudentAudience(announcement));

  const filteredAnnouncements = sortAnnouncements(visibleAnnouncements).filter((a) => {
    const matchSearch =
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter =
      selectedFilter === "all" ||
      (selectedFilter === "unread" && !a.isRead) ||
      selectedFilter === a.targetAudience;
    return matchSearch && matchFilter;
  });

  const unreadCount = filteredAnnouncements.filter((a) => !a.isRead).length;

  const getPriorityColor = (priority) => {
    if (priority === "High") return "bg-red-100 text-red-700";
    if (priority === "Medium") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  const getTimeAgo = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - List */}
            <div className="lg:col-span-1 space-y-4">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Megaphone className="w-7 h-7" />
                  <div>
                    <h1 className="text-xl font-bold">Announcements</h1>
                    <p className="text-emerald-100 text-sm">
                      {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Filter</span>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedFilter("all")}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === "all" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    All Announcements
                  </button>
                  <button
                    onClick={() => setSelectedFilter("unread")}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === "unread" ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    Unread Only {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{unreadCount}</span>}
                  </button>
                  {allClasses.map((code) => (
                    <button
                      key={code}
                      onClick={() => setSelectedFilter(code)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFilter === code ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Announcements List */}
              <div className="space-y-2">
                {filteredAnnouncements.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No announcements found</p>
                  </div>
                ) : (
                  filteredAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      onClick={() => handleAnnouncementClick(ann)}
                      className={`bg-white rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md ${
                        selectedAnnouncement?.id === ann.id
                          ? "border-emerald-500 shadow-md"
                          : ann.isRead
                          ? "border-gray-200"
                          : "border-emerald-200 bg-emerald-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <h3 className={`font-semibold text-sm flex-1 pr-2 line-clamp-2 ${ann.isRead ? "text-gray-700" : "text-gray-900"}`}>
                          {ann.title}
                        </h3>
                        {!ann.isRead && <span className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ann.content}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(ann.createdAt)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {ann.targetAudience && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">{ann.targetAudience}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full font-medium ${getPriorityColor(ann.priority)}`}>
                            {ann.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column - Detail */}
            <div className="lg:col-span-2">
              {selectedAnnouncement ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-[72px]">
                  {/* Detail Header */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <h1 className="text-2xl font-bold text-gray-900 flex-1 pr-4">
                        {selectedAnnouncement.title}
                      </h1>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${getPriorityColor(selectedAnnouncement.priority)}`}>
                        {selectedAnnouncement.priority} Priority
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{selectedAnnouncement.author}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <BookOpen className="w-4 h-4" />
                        <span>{selectedAnnouncement.targetAudience}</span>
                      </div>
                      {selectedAnnouncement.subject ? (
                        <div className="flex items-center gap-2 text-gray-600">
                          <BookOpen className="w-4 h-4" />
                          <span>{selectedAnnouncement.subject}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(selectedAnnouncement.createdAt).toLocaleDateString("en-US", {
                          month: "long", day: "numeric", year: "numeric"
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedAnnouncement.content}
                    </p>

                    {Array.isArray(selectedAnnouncement.attachments) && selectedAnnouncement.attachments.length > 0 && (
                      <div className="mt-6 grid gap-3">
                        {selectedAnnouncement.attachments.map((attachment, index) => (
                          <AnnouncementAttachmentPreview
                            key={`${selectedAnnouncement.id}-attachment-${index}`}
                            attachment={attachment}
                            index={index}
                            announcementId={selectedAnnouncement.id}
                            variant="light"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                    <Megaphone className="w-8 h-8 text-emerald-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an announcement</h3>
                  <p className="text-gray-500 text-sm">Click on an announcement from the list to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export { Announcements };
