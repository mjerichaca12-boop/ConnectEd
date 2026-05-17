import { useEffect, useMemo, useState, useRef } from "react";
import { AdminSidebar } from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, Plus, Trash2, X, School, Users, Clock, Loader2, AlertTriangle } from "lucide-react";
import { DashboardCalendar } from "../../components/DashboardCalendar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { adminNotifications } from "../../components/NotificationDefault";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "sonner";

export function AdminCalendar() {
  const navigate = useNavigate();
  const calendarRef = useRef(null);
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, eventId: "", eventTitle: "" });

  useEffect(() => {
    if (showEventModal || deleteConfirm.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showEventModal, deleteConfirm.isOpen]);
  const [events, setEvents] = useState([]);
  const [calendarTable, setCalendarTable] = useState("");
  const [calendarColumns, setCalendarColumns] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventDate: "",
    eventTime: "",
    targetAudience: "School-wide"
  });
  const [formErrors, setFormErrors] = useState({});

  const calendarTableCandidates = ["school_calendar_events", "calendar_events"];

  const audienceOptions = [
    { value: "School-wide", label: "School-wide" },
    { value: "Teachers", label: "Teachers" },
    { value: "Students", label: "Students" }
  ];

  const ALLOWED_AUDIENCES = ["School-wide", "Teachers", "Students"];

  const normalizeAudienceValue = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return "";
    if (normalized === "school-wide" || normalized === "schoolwide" || normalized === "school wide") return "School-wide";
    if (normalized === "teacher" || normalized === "teachers") return "Teachers";
    if (normalized === "student" || normalized === "students") return "Students";
    return "";
  };

  const emptyForm = useMemo(() => ({
    title: "",
    description: "",
    eventDate: "",
    eventTime: "",
    targetAudience: "School-wide"
  }), []);

  const normalizeEvent = (row) => ({
    id: String(row?.id ?? ""),
    title: String(row?.title ?? row?.event_title ?? "").trim(),
    description: String(row?.description ?? "").trim(),
    eventDate: String(row?.event_date ?? row?.date ?? "").trim(),
    eventTime: String(row?.event_time ?? row?.time ?? "").trim(),
    targetAudience: String(row?.target_audience ?? row?.audience ?? "School-wide").trim(),
    createdAt: row?.created_at || new Date().toISOString()
  });

  const resolveColumnName = (columns, candidates) => candidates.find((candidate) => columns.includes(candidate)) || "";

  const sortEvents = (items) => [...items].sort((left, right) => {
    const leftDateStr = left.eventDate ? `${left.eventDate}T${left.eventTime || "00:00:00"}` : left.createdAt;
    const rightDateStr = right.eventDate ? `${right.eventDate}T${right.eventTime || "00:00:00"}` : right.createdAt;

    let leftTime = new Date(leftDateStr).getTime();
    let rightTime = new Date(rightDateStr).getTime();

    if (Number.isNaN(leftTime)) leftTime = new Date(left.createdAt).getTime() || 0;
    if (Number.isNaN(rightTime)) rightTime = new Date(right.createdAt).getTime() || 0;

    return leftTime - rightTime;
  });

  const formatEventDate = (value) => {
    if (!value) return "Not set";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatEventTime = (value) => {
    if (!value) return "All day";

    const [hours, minutes = "00"] = String(value).split(":");
    const parsedHours = Number(hours);
    if (Number.isNaN(parsedHours)) return String(value);

    const date = new Date();
    date.setHours(parsedHours, Number(minutes), 0, 0);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };


  const audienceMatches = (audience) => {
    const normalized = String(audience ?? "").trim().toLowerCase();
    return normalized.includes("school") || normalized.includes("teacher") || normalized.includes("student");
  };

  const resolveCalendarTable = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    for (const tableName of calendarTableCandidates) {
      const { error } = await supabase.from(tableName).select("id", { count: "exact", head: true });
      if (!error) {
        setCalendarTable(tableName);
        return tableName;
      }
    }

    throw new Error("Could not find the school calendar table in Supabase.");
  };

  const getCalendarTableName = async () => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    if (calendarTable) {
      const { error } = await supabase.from(calendarTable).select("id", { count: "exact", head: true });
      if (!error) return calendarTable;
    }

    return resolveCalendarTable();
  };

  const loadEvents = async (tableNameOverride) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = tableNameOverride || (await getCalendarTableName());
    const { data, error } = await supabase.from(tableName).select("*");

    if (error) {
      throw new Error(error.message);
    }

    return sortEvents((data ?? []).map(normalizeEvent).filter((item) => item.id));
  };

  const resolveCalendarColumns = async (tableNameOverride) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const tableName = tableNameOverride || (await getCalendarTableName());
    const candidates = [
      "id",
      "title",
      "description",
      "event_date",
      "date",
      "event_time",
      "time",
      "target_audience",
      "audience",
      "created_by",
      "createdBy",
      "author",
      "created_at",
      "updated_at"
    ];

    const detected = [];

    for (const columnName of candidates) {
      const { error } = await supabase.from(tableName).select(columnName, { count: "exact", head: true });
      if (!error) {
        detected.push(columnName);
      }
    }

    setCalendarColumns(detected);
    return detected;
  };

  const getCalendarColumns = async (tableNameOverride) => {
    if (calendarColumns.length > 0) {
      return calendarColumns;
    }

    return resolveCalendarColumns(tableNameOverride);
  };

  const buildCreatePayload = (columns, timestamp) => {
    const dateColumn = resolveColumnName(columns, ["event_date", "date"]) || "event_date";
    const timeColumn = resolveColumnName(columns, ["event_time", "time"]) || "event_time";
    const audienceColumn = resolveColumnName(columns, ["target_audience", "audience"]) || "target_audience";
    const createdByColumn = resolveColumnName(columns, ["created_by", "createdBy", "author"]);
    const createdAtColumn = resolveColumnName(columns, ["created_at"]);
    const updatedAtColumn = resolveColumnName(columns, ["updated_at"]);

    const normalizedAudience = normalizeAudienceValue(formData.targetAudience) || "School-wide";

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      [dateColumn]: formData.eventDate,
      [timeColumn]: formData.eventTime || null,
      [audienceColumn]: normalizedAudience
    };

    if (createdByColumn) {
      payload[createdByColumn] = "admin";
    }

    if (createdAtColumn) {
      payload[createdAtColumn] = timestamp;
    }

    if (updatedAtColumn) {
      payload[updatedAtColumn] = timestamp;
    }

    return payload;
  };

  const refreshEvents = async (tableName) => {
    const rows = await loadEvents(tableName);
    setEvents(rows);
    return rows;
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = "Event title is required.";
    }

    if (!formData.eventDate.trim()) {
      errors.eventDate = "Event date is required.";
    }

    const normalizedAudience = normalizeAudienceValue(formData.targetAudience);
    if (!normalizedAudience) {
      errors.targetAudience = "Target audience must be School-wide, Teachers, or Students.";
    }

    if (normalizedAudience && !ALLOWED_AUDIENCES.includes(normalizedAudience)) {
      errors.targetAudience = "Target audience must be School-wide, Teachers, or Students.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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

        const tableName = await resolveCalendarTable();
        await resolveCalendarColumns(tableName);
        const rows = await loadEvents(tableName);

        if (isMounted) {
          setEvents(rows);
          setEventsError("");
        }
      } catch (error) {
        if (isMounted) {
          setEventsError(error instanceof Error ? error.message : "Unable to load calendar events.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setEventsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!supabase || !calendarTable) {
      return undefined;
    }

    const channel = supabase
      .channel("school-calendar-events")
      .on("postgres_changes", { event: "*", schema: "public", table: calendarTable }, async () => {
        try {
          await refreshEvents(calendarTable);
        } catch {
          // Keep the current list if realtime refresh fails.
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarTable]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleOpenEventModal = () => {
    setEventsError("");
    setFormErrors({});
    setShowEventModal(true);
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setFormData(emptyForm);
    setFormErrors({});
    setEventsError("");
  };

  const handleAddEvent = async (event) => {
    event.preventDefault();

    setEventsError("");
    setSuccessMessage("");

    if (!validateForm()) {
      return;
    }

    const normalizedAudience = normalizeAudienceValue(formData.targetAudience);
    if (!normalizedAudience) {
      setFormErrors((current) => ({
        ...current,
        targetAudience: "Target audience must be School-wide, Teachers, or Students."
      }));
      return;
    }

    if (!supabase) {
      setEventsError("Supabase client is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName = await getCalendarTableName();
      const timestamp = new Date().toISOString();
      const columns = await getCalendarColumns(tableName);
      const payload = buildCreatePayload(columns, timestamp);

      const dateColumn = resolveColumnName(columns, ["event_date", "date"]) || "event_date";
      const timeColumn = resolveColumnName(columns, ["event_time", "time"]) || "event_time";
      const audienceColumn = resolveColumnName(columns, ["target_audience", "audience"]) || "target_audience";

      const optimisticEvent = {
        id: `temp-${timestamp}`,
        title: payload.title,
        description: payload.description,
        eventDate: payload[dateColumn],
        eventTime: payload[timeColumn] || "",
        targetAudience: payload[audienceColumn],
        createdAt: timestamp
      };

      setEvents((current) => sortEvents([optimisticEvent, ...current.filter((item) => item.id !== optimisticEvent.id)]));

      const { error } = await supabase.from(tableName).insert(payload);
      if (error) {
        throw new Error(error.message);
      }

      await refreshEvents(tableName);

      // Refresh the calendar preview
      if (calendarRef.current?.refreshCalendar) {
        await calendarRef.current.refreshCalendar().catch(() => {
          // Calendar refresh failed but event was added
        });
      }

      toast.success("Event added successfully.");
      handleCloseEventModal();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unable to add event.";
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!supabase) {
      setEventsError("Supabase client is not configured.");
      return;
    }

    try {
      const tableName = await getCalendarTableName();
      const previous = events;
      setEvents((current) => current.filter((item) => item.id !== eventId));

      const { error } = await supabase.from(tableName).delete().eq("id", eventId);
      if (error) {
        setEvents(previous);
        throw new Error(error.message);
      }

      toast.success("Event deleted successfully.");
      void refreshEvents(tableName).catch(() => {
        // Keep the optimistic UI if the refresh fails.
      });

      // Refresh the calendar preview
      if (calendarRef.current?.refreshCalendar) {
        await calendarRef.current.refreshCalendar().catch(() => {
          // Calendar refresh failed but event was deleted
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unable to delete event.";
      toast.error(errMsg);
    }
  };

  const handleOpenDeleteConfirm = (evt) => {
    setEventsError("");
    setDeleteConfirm({
      isOpen: true,
      eventId: evt.id,
      eventTitle: evt.title || "Untitled event"
    });
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirm({ isOpen: false, eventId: "", eventTitle: "" });
  };

  const visibleEvents = useMemo(() => sortEvents(events), [events]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 h-full overflow-hidden flex flex-col relative z-10 lg:pl-64">
        {/* Top Bar */}
        <div className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-gray-900">Manage School Calendar</h2>
              </div>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) =>
                  setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
                }
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-full min-h-0">
            {/* Calendar Preview */}
            <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col min-h-0">
              <DashboardCalendar ref={calendarRef} viewerRole="admin" />
            </div>

            {/* Event Management */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-green-600" />
                  School Events & Holidays
                </h3>
                <button
                  onClick={handleOpenEventModal}
                  className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 text-sm shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Event
                </button>
              </div>

              <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-6">
                <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  Manage the official school calendar. Changes made here will instantly reflect on the Teacher dashboard.
                </p>

                {(eventsError || successMessage) && (
                  <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${eventsError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-green-200 bg-green-50 text-green-700"}`}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{eventsError || successMessage}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {eventsLoading ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                      Loading events...
                    </div>
                  ) : visibleEvents.length > 0 ? visibleEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex flex-col min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-gray-900 text-base">{evt.title || "Untitled event"}</span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-green-200 bg-green-50 text-green-700">
                            {evt.targetAudience || "Not set"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-green-600 font-semibold mt-2">
                          <span className="inline-flex items-center gap-1.5 bg-green-50/50 px-2.5 py-1 rounded-lg border border-green-100">
                            <Clock className="w-3.5 h-3.5" />
                            {formatEventDate(evt.eventDate)} {evt.eventTime ? `• ${formatEventTime(evt.eventTime)}` : "• All Day"}
                          </span>
                        </div>
                        {evt.description && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-2 leading-relaxed bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                            {evt.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          className="p-2.5 text-red-500 hover:text-white hover:bg-red-500 rounded-xl transition-all border border-gray-100 hover:border-red-500 shadow-sm"
                          title="Delete"
                          onClick={() => handleOpenDeleteConfirm(evt)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                      No events registered.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={() => handleDeleteEvent(deleteConfirm.eventId)}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteConfirm.eventTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden relative border border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Add School Calendar Event</h3>
              <button onClick={handleCloseEventModal} type="button" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="p-6 overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Event Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${formErrors.title ? "border-rose-500" : "border-gray-200"}`}
                    placeholder="Enter event title"
                  />
                  {formErrors.title && <p className="mt-1.5 text-xs text-rose-600 font-medium">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Optional description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      value={formData.eventDate}
                      onChange={(event) => setFormData({ ...formData, eventDate: event.target.value })}
                      className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${formErrors.eventDate ? "border-rose-500" : "border-gray-200"}`}
                    />
                    {formErrors.eventDate && <p className="mt-1.5 text-xs text-rose-600 font-medium">{formErrors.eventDate}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                    <input
                      type="time"
                      value={formData.eventTime}
                      onChange={(event) => setFormData({ ...formData, eventTime: event.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Audience <span className="text-rose-500">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {audienceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, targetAudience: option.value })}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${formData.targetAudience === option.value ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10" : "bg-white text-gray-700 border-gray-200 hover:border-blue-500 hover:text-blue-600"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {formErrors.targetAudience && <p className="mt-1.5 text-xs text-rose-600 font-medium">{formErrors.targetAudience}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <button onClick={handleCloseEventModal} type="button" className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center justify-center min-w-[100px] shadow-sm cursor-pointer" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Event"
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
