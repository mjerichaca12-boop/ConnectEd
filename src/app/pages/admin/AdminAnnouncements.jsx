import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "../../components/AdminSidebar";
import { CustomSelect } from "../../components/admin/CustomSelect";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase } from "../../lib/supabaseClient";
import { useActivity } from "../../lib/ActivityContext";
import {
  AlertTriangle,
  Edit,
  Loader2,
  Megaphone,
  Plus,
  School,
  Search,
  Trash2,
  Users,
  X
} from "lucide-react";

const emptyForm = {
  title: "",
  content: "",
  targetAudience: "",
  priority: ""
};

const emptyTouchedFields = {
  title: false,
  content: false,
  targetAudience: false,
  priority: false
};

const announcementTableCandidates = ["school_announcements", "announcements"];

const ALLOWED_AUDIENCES = ["School-wide", "Students", "Teacher"];
const ALLOWED_PRIORITIES = ["Low", "Medium", "High"];

const audienceOptions = [
  { value: "School-wide", label: "School-wide" },
  { value: "Students", label: "Students" },
  { value: "Teacher", label: "Teacher" }
];

const priorityOptions = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" }
];

const normalizeAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "student" || normalized === "students") return "Students";
  if (normalized === "teacher" || normalized === "teachers") return "Teacher";
  if (normalized === "schoolwide" || normalized === "school wide") return "School-wide";
  if (ALLOWED_AUDIENCES.includes(value)) return value;
  return "School-wide";
};

const normalizePriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "low") return "Low";
  if (normalized === "medium") return "Medium";
  if (normalized === "high") return "High";
  if (ALLOWED_PRIORITIES.includes(value)) return value;
  return "Medium";
};

const toDatabaseAudience = (value) => {
  const normalized = normalizeAudience(value);

  return normalized;
};

const toDatabasePriority = (value) => {
  const normalized = normalizePriority(value);
  return normalized;
};

const isAllowedAudience = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  return ALLOWED_AUDIENCES.includes(value) || normalized === "student" || normalized === "students" || normalized === "teacher" || normalized === "teachers" || normalized === "schoolwide" || normalized === "school wide";
};

const isAllowedPriority = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ALLOWED_PRIORITIES.includes(value) || normalized === "low" || normalized === "medium" || normalized === "high";
};

const formatAudienceLabel = (audience) => {
  return normalizeAudience(audience || "School-wide");
};

const formatPriorityLabel = (priority) => {
  return normalizePriority(priority || "Medium");
};

const normalizeTimestamp = (row) => row?.created_at || row?.date_posted || row?.datePosted || row?.timestamp || row?.updated_at || new Date().toISOString();

const normalizeAnnouncement = (row) => ({
  id: String(row?.id ?? ""),
  title: String(row?.title ?? "").trim(),
  content: String(row?.content ?? "").trim(),
  targetAudience: normalizeAudience(
    row?.target_audience ??
    row?.targetAudience ??
    row?.audience ??
    row?.target_audience_type ??
    row?.recipient_audience ??
    row?.audience_type ??
    "School-wide"
  ),
  priority: normalizePriority(
    row?.priority ??
    row?.announcement_priority ??
    row?.importance ??
    row?.priority_level ??
    "Medium"
  ),
  createdAt: normalizeTimestamp(row),
  author: row?.author || row?.created_by_name || row?.created_by || "Admin Office"
});

const sortAnnouncements = (items) =>
  [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const resolveColumnName = (columns, candidates) => candidates.find((columnName) => columns.includes(columnName)) || "";

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const getAudienceStyles = (audience) => {
  const normalizedAudience = String(audience ?? "").toLowerCase();

  if (normalizedAudience.includes("school")) {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  }

  if (normalizedAudience.includes("teacher")) {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }

  return "bg-blue-500/10 text-blue-300 border-blue-500/20";
};

const getPriorityStyles = (priority) => {
  const normalizedPriority = String(priority ?? "").toLowerCase();

  if (normalizedPriority === "high") {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }

  if (normalizedPriority === "low") {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  }

  return "bg-amber-500/10 text-amber-300 border-amber-500/20";
};

const getAnnouncementValidationErrors = (data) => {
  const errors = {};
  const title = String(data?.title || "").trim();
  const content = String(data?.content || "").trim();
  const targetAudience = String(data?.targetAudience || "").trim();
  const priority = String(data?.priority || "").trim();

  if (!title) {
    errors.title = "Title is required";
  } else if (title.length < 5) {
    errors.title = "Title must be at least 5 characters";
  } else if (title.length > 100) {
    errors.title = "Title must be at most 100 characters";
  }

  if (!content) {
    errors.content = "Content is required";
  } else if (content.length < 10) {
    errors.content = "Content must be at least 10 characters";
  }

  if (!targetAudience) {
    errors.targetAudience = "Target audience is required";
  } else if (!isAllowedAudience(targetAudience)) {
    errors.targetAudience = "Target audience must be school wide, student, or teacher";
  }

  if (!priority) {
    errors.priority = "Priority is required";
  } else if (!isAllowedPriority(priority)) {
    errors.priority = "Priority must be low, medium, or high";
  }

  return errors;
};

function AdminAnnouncements() {
  const navigate = useNavigate();
  const { logActivity } = useActivity();

  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, announcementId: "", announcementTitle: "" });
  const [announcements, setAnnouncements] = useState([]);
  const [announcementTable, setAnnouncementTable] = useState("");
  const [announcementColumns, setAnnouncementColumns] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState(emptyTouchedFields);
  const [editFormTouched, setEditFormTouched] = useState(emptyTouchedFields);
  const [hasTriedCreateSubmit, setHasTriedCreateSubmit] = useState(false);
  const [hasTriedEditSubmit, setHasTriedEditSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getVisibleErrors = (allErrors, touchedMap, submitAttempted) => {
    if (submitAttempted) {
      return allErrors;
    }

    return Object.fromEntries(
      Object.entries(allErrors).filter(([field]) => touchedMap[field])
    );
  };

  const applyCreateValidationState = (nextForm, nextTouched, nextSubmitAttempted) => {
    const allErrors = getAnnouncementValidationErrors(nextForm);
    setFormErrors(getVisibleErrors(allErrors, nextTouched, nextSubmitAttempted));
    return allErrors;
  };

  const applyEditValidationState = (nextForm, nextTouched, nextSubmitAttempted) => {
    const allErrors = getAnnouncementValidationErrors(nextForm);
    setEditFormErrors(getVisibleErrors(allErrors, nextTouched, nextSubmitAttempted));
    return allErrors;
  };

  const validateForm = (data, setErrors) => {
    const errors = getAnnouncementValidationErrors(data);
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateFieldChange = (field, value) => {
    const nextForm = {
      ...formData,
      [field]: value
    };
    setFormData(nextForm);
    applyCreateValidationState(nextForm, formTouched, hasTriedCreateSubmit);
  };

  const handleEditFieldChange = (field, value) => {
    const nextForm = {
      ...editFormData,
      [field]: value
    };
    setEditFormData(nextForm);
    applyEditValidationState(nextForm, editFormTouched, hasTriedEditSubmit);
  };

  const handleCreateFieldBlur = (field) => {
    const nextTouched = {
      ...formTouched,
      [field]: true
    };
    setFormTouched(nextTouched);
    applyCreateValidationState(formData, nextTouched, hasTriedCreateSubmit);
  };

  const handleEditFieldBlur = (field) => {
    const nextTouched = {
      ...editFormTouched,
      [field]: true
    };
    setEditFormTouched(nextTouched);
    applyEditValidationState(editFormData, nextTouched, hasTriedEditSubmit);
  };

  const handleOpenCreateModal = () => {
    setErrorMessage("");
    setFormData(emptyForm);
    setFormErrors({});
    setFormTouched(emptyTouchedFields);
    setHasTriedCreateSubmit(false);
    setShowCreateModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const resolveAnnouncementTable = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    for (const tableName of announcementTableCandidates) {
      const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });

      if (!error) {
        setAnnouncementTable(tableName);
        return tableName;
      }
    }

    throw new Error("Could not find the announcements table in Supabase.");
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

  const loadAnnouncements = async (tableNameOverride) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = tableNameOverride || (await getAnnouncementTableName());
    const { data, error } = await supabase.from(tableName).select("*");

    if (error) {
      throw new Error(error.message);
    }

    return sortAnnouncements((data ?? []).map(normalizeAnnouncement).filter((item) => item.id));
  };

  const resolveAnnouncementColumns = async (tableNameOverride) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = tableNameOverride || (await getAnnouncementTableName());
    const candidates = [
      "id",
      "title",
      "content",
      "target_audience",
      "audience",
      "targetAudience",
      "target_audience_type",
      "recipient_audience",
      "audience_type",
      "priority",
      "announcement_priority",
      "importance",
      "priority_level",
      "created_at",
      "date_posted",
      "datePosted",
      "timestamp",
      "updated_at",
      "author",
      "created_by_name",
      "created_by",
      "createdBy",
      "school_id",
      "schoolId"
    ];

    const detected = [];

    for (const columnName of candidates) {
      const { error } = await supabase.from(tableName).select(columnName, { count: "exact", head: true });
      if (!error) {
        detected.push(columnName);
      }
    }

    setAnnouncementColumns(detected);
    return detected;
  };

  const getAnnouncementColumns = async (tableNameOverride) => {
    if (announcementColumns.length > 0) {
      return announcementColumns;
    }

    return resolveAnnouncementColumns(tableNameOverride);
  };

  const buildCreatePayloads = (data, timestamp, columns) => {
    const user = getCurrentUser();
    const targetAudience = toDatabaseAudience(data.targetAudience);
    const priority = toDatabasePriority(data.priority);

    const audienceCandidates = ["target_audience", "audience", "targetAudience", "target_audience_type", "recipient_audience", "audience_type"];
    const priorityCandidates = ["priority", "announcement_priority", "importance", "priority_level"];
    const audienceColumn = resolveColumnName(columns, audienceCandidates);
    const priorityColumn = resolveColumnName(columns, priorityCandidates);
    const timestampColumn = resolveColumnName(columns, ["created_at", "date_posted", "datePosted", "timestamp"]);

    const metadata = {};

    if (timestampColumn) metadata[timestampColumn] = timestamp;

    if (columns.includes("author") && user?.name) metadata.author = user.name;
    if (columns.includes("created_by_name") && user?.name) metadata.created_by_name = user.name;
    if (columns.includes("created_by") && isUuid(user?.id)) metadata.created_by = user.id;
    if (columns.includes("createdBy") && isUuid(user?.id)) metadata.createdBy = user.id;
    if (columns.includes("school_id") && isUuid(user?.school_id || user?.schoolId)) metadata.school_id = user.school_id || user.schoolId;
    if (columns.includes("schoolId") && isUuid(user?.school_id || user?.schoolId)) metadata.schoolId = user.school_id || user.schoolId;

    const basePayload = {
      title: data.title.trim(),
      content: data.content.trim(),
      ...metadata
    };

    const payloads = [];

    const pushPayload = (payload) => {
      const key = JSON.stringify(payload);
      if (!payloads.some((existing) => JSON.stringify(existing) === key)) {
        payloads.push(payload);
      }
    };

    if (audienceColumn && priorityColumn) {
      pushPayload({
        ...basePayload,
        [audienceColumn]: targetAudience,
        [priorityColumn]: priority
      });
    }

    if (audienceColumn) {
      pushPayload({
        ...basePayload,
        [audienceColumn]: targetAudience
      });
    }

    if (priorityColumn) {
      pushPayload({
        ...basePayload,
        [priorityColumn]: priority
      });
    }

    const fallbackPairs = [
      ["target_audience", "priority"],
      ["target_audience", "announcement_priority"],
      ["audience", "priority"],
      ["audience", "importance"],
      ["targetAudience", "priority"],
      ["audience_type", "priority_level"]
    ];

    for (const [audienceKey, priorityKey] of fallbackPairs) {
      pushPayload({
        ...basePayload,
        [audienceKey]: targetAudience,
        [priorityKey]: priority
      });
    }

    pushPayload(basePayload);

    return payloads;
  };

  const buildUpdatePayloads = (data, timestamp, columns) => {
    const targetAudience = toDatabaseAudience(data.targetAudience);
    const priority = toDatabasePriority(data.priority);
    const audienceCandidates = ["target_audience", "audience", "targetAudience", "target_audience_type", "recipient_audience", "audience_type"];
    const priorityCandidates = ["priority", "announcement_priority", "importance", "priority_level"];
    const audienceColumn = resolveColumnName(columns, audienceCandidates);
    const priorityColumn = resolveColumnName(columns, priorityCandidates);
    const timestampColumn = resolveColumnName(columns, ["updated_at"]);

    const metadata = {};
    if (timestampColumn) metadata[timestampColumn] = timestamp;

    const basePayload = {
      title: data.title.trim(),
      content: data.content.trim(),
      ...metadata
    };

    const payloads = [];

    const pushPayload = (payload) => {
      const key = JSON.stringify(payload);
      if (!payloads.some((existing) => JSON.stringify(existing) === key)) {
        payloads.push(payload);
      }
    };

    if (audienceColumn && priorityColumn) {
      pushPayload({
        ...basePayload,
        [audienceColumn]: targetAudience,
        [priorityColumn]: priority
      });
    }

    if (audienceColumn) {
      pushPayload({
        ...basePayload,
        [audienceColumn]: targetAudience
      });
    }

    if (priorityColumn) {
      pushPayload({
        ...basePayload,
        [priorityColumn]: priority
      });
    }

    const fallbackPairs = [
      ["target_audience", "priority"],
      ["target_audience", "announcement_priority"],
      ["audience", "priority"],
      ["audience", "importance"],
      ["targetAudience", "priority"],
      ["audience_type", "priority_level"]
    ];

    for (const [audienceKey, priorityKey] of fallbackPairs) {
      pushPayload({
        ...basePayload,
        [audienceKey]: targetAudience,
        [priorityKey]: priority
      });
    }

    pushPayload(basePayload);

    return payloads;
  };

  const writeAnnouncement = async (tableName, mode, payloads, id) => {
    let lastError = null;

    for (const payload of payloads) {
      const query = mode === "insert"
        ? supabase.from(tableName).insert(payload)
        : supabase.from(tableName).update(payload).eq("id", id);

      const { error } = await query;

      if (!error) {
        return payload;
      }

      lastError = error;
    }

    if (lastError?.message) {
      const details = [lastError.message, lastError.details, lastError.hint].filter(Boolean).join(" | ");
      throw new Error(details || "Unable to save announcement.");
    }

    throw new Error("Unable to save announcement.");
  };

  const refreshAnnouncements = async (tableName) => {
    const rows = await loadAnnouncements(tableName);
    setAnnouncements((current) => {
      const currentById = new Map(current.map((announcement) => [announcement.id, announcement]));
      const currentByContent = new Map(current.map((announcement) => [
        `${announcement.title}::${announcement.content}`,
        announcement
      ]));

      return sortAnnouncements(rows.map((announcement) => {
        const previous = currentById.get(announcement.id) || currentByContent.get(`${announcement.title}::${announcement.content}`);

        if (!previous) {
          return announcement;
        }

        return {
          ...previous,
          ...announcement,
          targetAudience: announcement.targetAudience || previous.targetAudience,
          priority: announcement.priority || previous.priority,
          createdAt: announcement.createdAt || previous.createdAt,
          author: announcement.author || previous.author
        };
      }));
    });
    return rows;
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const userData = localStorage.getItem("currentUser");

        if (!userData) {
          navigate("/login");
          return;
        }

        const user = JSON.parse(userData);

        if (user.role !== "admin") {
          navigate("/login");
          return;
        }

        setAdminName(user.name);
        setNotificationList(adminNotifications);

        const tableName = await resolveAnnouncementTable();
        await resolveAnnouncementColumns(tableName);
        const rows = await loadAnnouncements(tableName);

        if (isMounted) {
          setAnnouncements(rows);
          setErrorMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load announcements.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!supabase || !announcementTable) {
      return undefined;
    }

    const channel = supabase
      .channel("admin-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: announcementTable }, async () => {
        try {
          await refreshAnnouncements(announcementTable);
        } catch {
          // Keep the current state if the refresh fails.
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [announcementTable]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const filteredAnnouncements = announcements.filter((announcement) => {
    const query = searchQuery.toLowerCase();
    return [announcement.title, announcement.content, announcement.targetAudience, announcement.priority]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setFormData(emptyForm);
    setFormErrors({});
    setFormTouched(emptyTouchedFields);
    setHasTriedCreateSubmit(false);
    setErrorMessage("");
  };

  const handleOpenEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setEditFormData({
      title: announcement.title,
      content: announcement.content,
      targetAudience: normalizeAudience(announcement.targetAudience),
      priority: normalizePriority(announcement.priority)
    });
    setEditFormErrors({});
    setEditFormTouched(emptyTouchedFields);
    setHasTriedEditSubmit(false);
    setErrorMessage("");
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingAnnouncement(null);
    setEditFormErrors({});
    setEditFormTouched(emptyTouchedFields);
    setHasTriedEditSubmit(false);
    setErrorMessage("");
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    setHasTriedCreateSubmit(true);
    const submissionErrors = applyCreateValidationState(formData, formTouched, true);
    if (Object.keys(submissionErrors).length > 0) {
      return;
    }

    if (!validateForm(formData, setFormErrors)) {
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName = await getAnnouncementTableName();
      const columns = await getAnnouncementColumns(tableName);
      const timestamp = new Date().toISOString();
      await writeAnnouncement(tableName, "insert", buildCreatePayloads(formData, timestamp, columns));
      const nextAnnouncement = {
        id: "",
        title: formData.title.trim(),
        content: formData.content.trim(),
        targetAudience: formData.targetAudience,
        priority: formData.priority,
        createdAt: timestamp
      };

      setAnnouncements((current) => sortAnnouncements([
        nextAnnouncement,
        ...current.filter((announcement) => announcement.id !== nextAnnouncement.id)
      ]));

      await refreshAnnouncements(tableName);

      logActivity({
        actionType: "added_announcement",
        entityType: "announcement",
        entityId: nextAnnouncement.id,
        entityName: nextAnnouncement.title,
        timestamp: nextAnnouncement.createdAt
      });

      setShowCreateModal(false);
      setFormData(emptyForm);
      setFormErrors({});
      setFormTouched(emptyTouchedFields);
      setHasTriedCreateSubmit(false);
      setSuccessMessage("Announcement added successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editingAnnouncement) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    setHasTriedEditSubmit(true);
    const submissionErrors = applyEditValidationState(editFormData, editFormTouched, true);
    if (Object.keys(submissionErrors).length > 0) {
      return;
    }

    if (!validateForm(editFormData, setEditFormErrors)) {
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName = await getAnnouncementTableName();
      const columns = await getAnnouncementColumns(tableName);
      await writeAnnouncement(
        tableName,
        "update",
        buildUpdatePayloads(editFormData, new Date().toISOString(), columns),
        editingAnnouncement.id
      );

      setAnnouncements((current) => sortAnnouncements(current.map((announcement) => (
        announcement.id === editingAnnouncement.id
          ? {
              ...announcement,
              title: editFormData.title.trim(),
              content: editFormData.content.trim(),
              targetAudience: editFormData.targetAudience,
              priority: editFormData.priority
            }
          : announcement
      ))));

      await refreshAnnouncements(tableName);

      setShowEditModal(false);
      setEditingAnnouncement(null);
      setEditFormErrors({});
      setEditFormTouched(emptyTouchedFields);
      setHasTriedEditSubmit(false);
      setSuccessMessage("Announcement updated successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deleteConfirm.announcementId) {
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase client is not configured.");
      return;
    }

    const deletingAnnouncement = announcements.find((announcement) => announcement.id === deleteConfirm.announcementId);

    if (!deletingAnnouncement) {
      setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" });
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const previousAnnouncements = announcements;
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== deleteConfirm.announcementId));
    setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" });

    try {
      const tableName = await getAnnouncementTableName();
      const { error } = await supabase.from(tableName).delete().eq("id", deletingAnnouncement.id);

      if (error) {
        throw new Error(error.message);
      }

      logActivity({
        actionType: "deleted_announcement",
        entityType: "announcement",
        entityId: deletingAnnouncement.id,
        entityName: deletingAnnouncement.title,
        timestamp: new Date().toISOString()
      });

      setSuccessMessage("Announcement deleted successfully.");
      void refreshAnnouncements(tableName).catch(() => {
        // Keep the optimistic UI if the refresh fails.
      });
    } catch (error) {
      setAnnouncements(previousAnnouncements);
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ConfirmDeleteDialog = () => {
    if (!deleteConfirm.isOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-950 rounded-2xl shadow-2xl max-w-md w-full border border-white/10 overflow-hidden">
          <div className="flex items-start justify-between p-6 border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border bg-red-500/10 border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-4 font-semibold text-white">Delete Announcement</h3>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" })}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 bg-slate-900/50">
            <p className="text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete {deleteConfirm.announcementTitle}? This action cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 bg-black/40 rounded-b-2xl border-t border-white/5">
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, announcementId: "", announcementTitle: "" })}
              className="px-6 py-2.5 text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAnnouncement}
              className="px-6 py-2.5 text-white rounded-xl transition-all duration-200 font-medium shadow-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-gray-500">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-white">Announcements</h2>
              </div>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) => setNotificationList((prev) => prev.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)))}
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative rounded-2xl p-8 text-white shadow-lg overflow-hidden bg-gray-900 border border-white/10">
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-blue-600" />
              <div className="flex-1 bg-red-600" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/8 via-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative pl-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-emerald-400">Announcements</h1>
                <p className="text-gray-400">{announcements.length} published announcements</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleOpenCreateModal();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors font-semibold shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-5 h-5" />
                Create Announcement
              </button>
            </div>
          </div>

          {(errorMessage || successMessage) && (
            <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${errorMessage ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"}`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage || successMessage}</span>
            </div>
          )}

          <div className="bg-gray-900/60 rounded-xl p-4 border border-white/8 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-black/20 text-white placeholder-gray-500 pl-10 pr-4 py-3 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredAnnouncements.length === 0 ? (
              <div className="bg-gray-900/80 rounded-xl border border-white/10 p-16 text-center">
                <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No announcements found.</p>
              </div>
            ) : (
              filteredAnnouncements.map((announcement) => (
                <div key={announcement.id} className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm hover:border-emerald-500/30 transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-start gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-white">{announcement.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide border ${getPriorityStyles(announcement.priority)}`}>
                            {formatPriorityLabel(announcement.priority)}
                          </span>
                        </div>
                        <p className="text-gray-400 mb-4 line-clamp-2 whitespace-pre-line">{announcement.content}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide border ${getAudienceStyles(announcement.targetAudience)}`}>
                            {String(announcement.targetAudience || "").toLowerCase().includes("school") ? <School className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {formatAudienceLabel(announcement.targetAudience)}
                          </span>
                          <span>Posted: {formatDate(announcement.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(announcement)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-emerald-400" />
                        </button>
                        <button
                          type="button"
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          onClick={() => setDeleteConfirm({ isOpen: true, announcementId: announcement.id, announcementTitle: announcement.title })}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <ConfirmDeleteDialog />

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Create Announcement</h3>
              <button onClick={handleCloseCreateModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleCreateAnnouncement} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => handleCreateFieldChange("title", event.target.value)}
                    onBlur={() => handleCreateFieldBlur("title")}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${formErrors.title ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement title"
                  />
                  {formErrors.title && <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
                    value={formData.content}
                    onChange={(event) => handleCreateFieldChange("content", event.target.value)}
                    onBlur={() => handleCreateFieldBlur("content")}
                    rows={5}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${formErrors.content ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement content"
                  />
                  {formErrors.content && <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={formData.targetAudience}
                    onChange={(value) => handleCreateFieldChange("targetAudience", value)}
                    onBlur={() => handleCreateFieldBlur("targetAudience")}
                    options={audienceOptions}
                    placeholder="Select audience"
                    icon={<Users className="w-5 h-5" />}
                    className={`w-full ${formErrors.targetAudience ? "border-red-500" : ""}`}
                  />
                  {formErrors.targetAudience && <p className="mt-1 text-sm text-red-600">{formErrors.targetAudience}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <CustomSelect
                    value={formData.priority}
                    onChange={(value) => handleCreateFieldChange("priority", value)}
                    onBlur={() => handleCreateFieldBlur("priority")}
                    options={priorityOptions}
                    placeholder="Select priority"
                    icon={<Megaphone className="w-5 h-5" />}
                    className={`w-full ${formErrors.priority ? "border-red-500" : ""}`}
                  />
                  {formErrors.priority && <p className="mt-1 text-sm text-red-600">{formErrors.priority}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCloseCreateModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Announcement"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-gray-900">Edit Announcement</h3>
              <button onClick={handleCloseEditModal} type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(event) => handleEditFieldChange("title", event.target.value)}
                    onBlur={() => handleEditFieldBlur("title")}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${editFormErrors.title ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement title"
                  />
                  {editFormErrors.title && <p className="mt-1 text-sm text-red-600">{editFormErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                  <textarea
                    value={editFormData.content}
                    onChange={(event) => handleEditFieldChange("content", event.target.value)}
                    onBlur={() => handleEditFieldBlur("content")}
                    rows={5}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${editFormErrors.content ? "border-red-500" : "border-gray-300"}`}
                    placeholder="Enter announcement content"
                  />
                  {editFormErrors.content && <p className="mt-1 text-sm text-red-600">{editFormErrors.content}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={editFormData.targetAudience}
                    onChange={(value) => handleEditFieldChange("targetAudience", value)}
                    onBlur={() => handleEditFieldBlur("targetAudience")}
                    options={audienceOptions}
                    placeholder="Select audience"
                    icon={<Users className="w-5 h-5" />}
                    className={`w-full ${editFormErrors.targetAudience ? "border-red-500" : ""}`}
                  />
                  {editFormErrors.targetAudience && <p className="mt-1 text-sm text-red-600">{editFormErrors.targetAudience}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <CustomSelect
                    value={editFormData.priority}
                    onChange={(value) => handleEditFieldChange("priority", value)}
                    onBlur={() => handleEditFieldBlur("priority")}
                    options={priorityOptions}
                    placeholder="Select priority"
                    icon={<Megaphone className="w-5 h-5" />}
                    className={`w-full ${editFormErrors.priority ? "border-red-500" : ""}`}
                  />
                  {editFormErrors.priority && <p className="mt-1 text-sm text-red-600">{editFormErrors.priority}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCloseEditModal} type="button" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminAnnouncements };
