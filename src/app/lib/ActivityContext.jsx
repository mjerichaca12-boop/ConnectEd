import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ActivityContext = createContext();
const STORAGE_KEY = "connected_recent_activity";

const ACTION_CONFIG = {
  added: { label: "Added", status: "created" },
  added_announcement: { label: "Added Announcement", status: "created" },
  updated: { label: "Updated", status: "updated" },
  deleted: { label: "Deleted", status: "deleted" },
  deleted_announcement: { label: "Deleted Announcement", status: "deleted" },
  assigned_class: { label: "Assigned Class", status: "assigned" },
  assigned_subject: { label: "Assigned Subject", status: "assigned" },
  assigned_teacher: { label: "Assigned Subject to Teacher", status: "assigned" },
  assigned_subject_to_teacher: { label: "Assigned Subject to Teacher", status: "assigned" },
  updated_teacher_subjects: { label: "Updated Teacher Subject Assignment", status: "updated" },
  updated_teacher_subject_assignment: { label: "Updated Teacher Subject Assignment", status: "updated" },
  removed_subject_from_teacher: { label: "Removed Subject from Teacher", status: "deleted" }
};

const readStoredActivities = () => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredActivities = (activities) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  } catch {
    // Ignore localStorage failures and keep in-memory activity updates working.
  }
};

const getCurrentUserName = () => {
  if (typeof window === "undefined") return "Admin";

  try {
    const userData = window.localStorage.getItem("currentUser");
    return userData ? JSON.parse(userData).name || "Admin" : "Admin";
  } catch {
    return "Admin";
  }
};

const toActivityMessage = (actionType, entityType, entityName, details = {}) => {
  const target = entityName || `Unknown ${entityType}`;

  if (actionType === "added_announcement" || actionType === "deleted_announcement") {
    const actionLabel = ACTION_CONFIG[actionType]?.label || "Updated";
    return target ? `${actionLabel}: ${target}` : actionLabel;
  }

  if (actionType === "assigned_teacher") {
    const teacherName = details.teacher || details.teacherName || details.teacher_name || "Unknown teacher";
    return `Assigned Subject to Teacher: ${target}${teacherName ? ` -> ${teacherName}` : ""}`;
  }

  if (actionType === "assigned_subject_to_teacher") {
    const teacherName = details.teacher || details.teacherName || details.teacher_name || "Unknown teacher";
    return `Assigned Subject to Teacher: ${target}${teacherName ? ` -> ${teacherName}` : ""}`;
  }

  if (actionType === "assigned_class") {
    const assignedClass = details.assignedClass || details.assigned_class || "";
    return `Assigned Class${assignedClass ? `: ${assignedClass}` : ""} to ${target}`;
  }

  if (actionType === "assigned_subject") {
    const subjects = Array.isArray(details.subjects)
      ? details.subjects.join(", ")
      : details.subjects || details.subject || "";
    return `Assigned Subject${subjects ? `: ${subjects}` : ""} to ${target}`;
  }

  if (actionType === "updated_teacher_subjects") {
    const subjects = Array.isArray(details.subjects)
      ? details.subjects.join(", ")
      : details.subjects || "";
    return `Updated Teacher Subject Assignment${subjects ? `: ${subjects}` : ""} for ${target}`;
  }

  if (actionType === "updated_teacher_subject_assignment") {
    const subjects = Array.isArray(details.subjects)
      ? details.subjects.join(", ")
      : details.subjects || "";
    return `Updated Teacher Subject Assignment${subjects ? `: ${subjects}` : ""} for ${target}`;
  }

  if (actionType === "removed_subject_from_teacher") {
    const subjects = Array.isArray(details.subjects)
      ? details.subjects.join(", ")
      : details.subjects || "";
    return `Removed Subject from Teacher${subjects ? `: ${subjects}` : ""} for ${target}`;
  }

  const actionLabel = ACTION_CONFIG[actionType]?.label || "Updated";
  const entityLabel = entityType === "teacher" ? "teacher" : entityType === "subject" ? "subject" : "student";
  return `${actionLabel} ${entityLabel}: ${target}`;
};

const buildActivityEntry = ({ actionType, entityType, entityId, entityName, details = {}, user, timestamp }) => {
  const normalizedType = entityType === "teacher"
    ? "teacher"
    : entityType === "subject"
      ? "subject"
      : entityType === "announcement"
        ? "announcement"
        : "student";
  const normalizedActionType = ACTION_CONFIG[actionType] ? actionType : "updated";
  const status = ACTION_CONFIG[normalizedActionType].status;
  const safeTimestamp = timestamp || new Date().toISOString();

  return {
    id: `${normalizedActionType}-${normalizedType}-${entityId || "unknown"}-${safeTimestamp}`,
    key: `${normalizedActionType}-${normalizedType}-${entityId || "unknown"}-${safeTimestamp}`,
    type: normalizedType,
    entityId: entityId || "unknown",
    actionType: normalizedActionType,
    action: toActivityMessage(normalizedActionType, normalizedType, entityName, details),
    status,
    user: user || getCurrentUserName(),
    timestamp: safeTimestamp,
    details
  };
};

export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState(() => readStoredActivities());

  useEffect(() => {
    writeStoredActivities(activities.slice(0, 20));
  }, [activities]);

  const logActivity = useCallback((payload) => {
    const activity = buildActivityEntry(payload || {});

    setActivities((prev) => {
      const duplicateIndex = prev.findIndex((entry) => {
        const sameSemanticAction =
          entry.actionType === activity.actionType &&
          entry.type === activity.type &&
          entry.entityId === activity.entityId;

        if (!sameSemanticAction) return false;

        const entryTime = new Date(entry.timestamp).getTime();
        const nextTime = new Date(activity.timestamp).getTime();
        return Math.abs(nextTime - entryTime) <= 5000;
      });

      const base = duplicateIndex >= 0
        ? prev.filter((_, index) => index !== duplicateIndex)
        : prev;

      const next = [activity, ...base.filter((entry) => entry.key !== activity.key)]
        .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
        .slice(0, 20);
      return next;
    });
  }, []);

  return (
    <ActivityContext.Provider value={{ activities, logActivity }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error("useActivity must be used within ActivityProvider");
  }
  return context;
}
