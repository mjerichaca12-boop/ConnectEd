import { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, School, Users, X, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const calendarTableCandidates = ["school_calendar_events", "calendar_events"];

const getPhilippinesHolidays = (year) => {
  const holidays = new Map([
    ["1-1", "New Year's Day"],
    ["2-25", "EDSA People Power Revolution Anniversary"],
    ["4-9", "Araw ng Kagitingan"],
    ["5-1", "Labor Day"],
    ["6-12", "Independence Day"],
    ["8-21", "Ninoy Aquino Day"],
    ["11-1", "All Saints' Day"],
    ["11-2", "All Souls' Day"],
    ["11-30", "Bonifacio Day"],
    ["12-8", "Feast of the Immaculate Conception"],
    ["12-24", "Christmas Eve"],
    ["12-25", "Christmas Day"],
    ["12-30", "Rizal Day"],
    ["12-31", "Last Day of the Year"]
  ]);

  const lastMondayAugust = (() => {
    const date = new Date(year, 7, 31);
    let day = date.getDay();
    if (day === 0) day = 7;
    date.setDate(date.getDate() - day + 1);
    return date.getDate();
  })();

  holidays.set(`8-${lastMondayAugust}`, "National Heroes Day");
  return holidays;
};

const getCurrentUserRole = () => {
  try {
    const raw = window.localStorage.getItem("currentUser");
    if (!raw) return "teacher";
    return JSON.parse(raw)?.role || "teacher";
  } catch {
    return "teacher";
  }
};

const normalizeAudience = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "School-wide";
  if (normalized.includes("school")) return "School-wide";
  if (normalized === "teacher" || normalized.includes("teachers")) return "Teachers";
  if (normalized === "student" || normalized.includes("students")) return "Students";
  return "School-wide";
};

const normalizeEvent = (row) => ({
  id: String(row?.id ?? ""),
  title: String(row?.title ?? row?.event_title ?? "").trim(),
  description: String(row?.description ?? "").trim(),
  eventDate: String(row?.event_date ?? row?.date ?? "").trim(),
  eventTime: String(row?.event_time ?? row?.time ?? "").trim(),
  targetAudience: normalizeAudience(row?.target_audience ?? row?.audience ?? "School-wide"),
  createdAt: row?.created_at || new Date().toISOString()
});

const getEventKey = (event) => `${event.eventDate || ""}::${event.title || ""}::${event.targetAudience || ""}`;

const formatDayKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const sortEvents = (items) => [...items].sort((left, right) => {
  const leftTime = new Date(`${left.eventDate}T${left.eventTime || "00:00:00"}`).getTime() || new Date(left.createdAt).getTime();
  const rightTime = new Date(`${right.eventDate}T${right.eventTime || "00:00:00"}`).getTime() || new Date(right.createdAt).getTime();
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

const getAudienceIcon = (audience) => {
  const normalized = normalizeAudience(audience).toLowerCase();
  if (normalized.includes("teacher")) return <Users className="w-3 h-3" />;
  if (normalized.includes("student")) return <Users className="w-3 h-3" />;
  return <School className="w-3 h-3" />;
};

const audienceMatchesRole = (audience, role) => {
  const normalized = normalizeAudience(audience).toLowerCase();
  if (role === "admin") return true;
  if (!normalized) return true;
  if (normalized.includes("school")) return true;
  if (role === "teacher") return normalized.includes("teacher");
  if (role === "student") return normalized.includes("student");
  return true;
};

const getMonthGrid = (year, month) => {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day);
  }

  return cells;
};

function DashboardCalendarComponent({ viewerRole }, ref) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [calendarTable, setCalendarTable] = useState("");
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const loadEventsRef = useRef(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const role = viewerRole || getCurrentUserRole();
  const holidays = useMemo(() => getPhilippinesHolidays(year), [year]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date().toISOString().slice(0, 10);

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
      if (!error) {
        return calendarTable;
      }
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

  const upsertEvent = (incoming) => {
    if (!incoming?.id) return;
    setEvents((current) => {
      const withoutIncoming = current.filter((item) => item.id !== incoming.id);
      return sortEvents([...withoutIncoming, incoming]);
    });
  };

  const removeEvent = (eventId) => {
    if (!eventId) return;
    setEvents((current) => current.filter((item) => item.id !== eventId));
    setSelectedEvent((current) => (current?.id === eventId ? null : current));
  };

  useImperativeHandle(ref, () => ({
    refreshCalendar: async () => {
      try {
        const tableName = calendarTable || (await getCalendarTableName());
        const rows = await loadEvents(tableName);
        setEvents(rows);
        setErrorMessage("");
      } catch (error) {
        console.error("Failed to refresh calendar:", error);
        setErrorMessage(error instanceof Error ? error.message : "Failed to refresh calendar");
      }
    }
  }), [calendarTable]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const tableName = await resolveCalendarTable();
        const rows = await loadEvents(tableName);
        if (isMounted) {
          setEvents(rows);
          setErrorMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load school calendar events.");
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
  }, []);

  useEffect(() => {
    if (!supabase || !calendarTable) {
      return undefined;
    }

    const channel = supabase
      .channel(`school-calendar-events-${calendarTable}-${role}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: calendarTable }, (payload) => {
        const incoming = normalizeEvent(payload?.new ?? {});
        if (incoming?.id) {
          upsertEvent(incoming);
          return;
        }

        void loadEvents(calendarTable).then(setEvents).catch(() => {
          // Keep current events if refresh fails.
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: calendarTable }, (payload) => {
        const incoming = normalizeEvent(payload?.new ?? {});
        if (incoming?.id) {
          upsertEvent(incoming);
          return;
        }

        void loadEvents(calendarTable).then(setEvents).catch(() => {
          // Keep current events if refresh fails.
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: calendarTable }, (payload) => {
        const deletedId = String(payload?.old?.id ?? "");
        if (deletedId) {
          removeEvent(deletedId);
          return;
        }

        void loadEvents(calendarTable).then(setEvents).catch(() => {
          // Keep current events if refresh fails.
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarTable, role]);

  const visibleEvents = useMemo(
    () => sortEvents(events.filter((event) => audienceMatchesRole(event.targetAudience, role))),
    [events, role]
  );

  const calendarCells = useMemo(() => getMonthGrid(year, month), [year, month]);
  const currentMonthEvents = useMemo(() => visibleEvents.filter((event) => {
    if (!event.eventDate) return false;
    const parsed = new Date(`${event.eventDate}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month;
  }), [visibleEvents, year, month]);

  const currentMonthSelectedDate = useMemo(() => {
    const parsed = new Date(selectedDay);
    if (Number.isNaN(parsed.getTime())) {
      return `${year}-${String(month + 1).padStart(2, "0")}-01`;
    }
    return selectedDay;
  }, [selectedDay, year, month]);

  const selectedHoliday = useMemo(() => {
    const parsed = new Date(currentMonthSelectedDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return holidays.get(`${parsed.getMonth() + 1}-${parsed.getDate()}`) || null;
  }, [currentMonthSelectedDate, holidays]);

  const selectedEvents = useMemo(() => currentMonthEvents.filter((event) => event.eventDate === currentMonthSelectedDate), [currentMonthEvents, currentMonthSelectedDate]);

  const eventMap = useMemo(() => {
    const map = new Map();
    for (const event of currentMonthEvents) {
      const key = event.eventDate;
      map.set(key, [...(map.get(key) || []), event]);
    }
    return map;
  }, [currentMonthEvents]);

  const prevMonth = () => {
    const nextDate = new Date(year, month - 1, 1);
    setCurrentDate(nextDate);
    setSelectedDay(nextDate.toISOString().slice(0, 10));
  };

  const nextMonth = () => {
    const nextDate = new Date(year, month + 1, 1);
    setCurrentDate(nextDate);
    setSelectedDay(nextDate.toISOString().slice(0, 10));
  };

  const upcomingEvents = useMemo(() => visibleEvents.slice(0, 4), [visibleEvents]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col min-h-0">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-50 rounded-lg border border-green-200">
            <CalendarIcon className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">School Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md transition-colors cursor-pointer border border-transparent hover:border-gray-200">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md transition-colors cursor-pointer border border-transparent hover:border-gray-200">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto min-h-0 space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs px-4 py-3 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <div className="text-center mb-3">
            <span className="text-sm font-bold text-gray-900">
              {monthNames[month]} {year}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map((day) => (
              <div key={day} className="text-[10px] font-bold text-gray-600 uppercase text-center">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="h-14" />;
              }

              const key = formatDayKey(year, month, day);
              const dayEvents = eventMap.get(key) || [];
              const isToday = key === today;
              const holidayLabel = holidays.get(`${month + 1}-${day}`) || null;
              const isHoliday = !!holidayLabel;
              const isSelected = key === currentMonthSelectedDate;

              const firstEventTitle = dayEvents[0]?.title || "";

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDay(key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDay(key);
                    }
                  }}
                  title={[holidayLabel, ...dayEvents.map((e) => e.title)].filter(Boolean).join(" • ") || undefined}
                  className={`h-14 p-1.5 flex flex-col items-center justify-between rounded-xl transition-all cursor-pointer border text-center
                    ${isSelected ? "ring-2 ring-green-600 ring-offset-2 border-green-300" : "border-transparent"}
                    ${isToday ? "bg-green-600 text-white font-bold shadow-md shadow-green-500/20 border-green-600" : ""}
                    ${!isToday && isHoliday ? "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/50" : ""}
                    ${!isToday && !isHoliday && dayEvents.length > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50" : ""}
                    ${!isToday && !isHoliday && dayEvents.length === 0 ? "text-gray-700 hover:bg-gray-100" : ""}`}
                >
                  <span className="text-xs font-semibold">{day}</span>
                  <div className="flex items-center gap-1">
                    {isHoliday && !isToday && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                    {dayEvents.length > 0 && !isToday && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </div>
                  {firstEventTitle && (
                    <p className={`mt-0.5 text-[9px] leading-none truncate max-w-full font-medium
                      ${isToday ? "text-white" : isHoliday ? "text-rose-600" : "text-indigo-600"}`}
                    >
                      {firstEventTitle}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700">Holiday</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">Event</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700">Today</span>
          </div>

          <div className="text-xs text-gray-700 font-bold uppercase tracking-wider">
            {currentMonthSelectedDate ? formatEventDate(currentMonthSelectedDate) : "Select a date"}
          </div>

          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {selectedHoliday && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-100">
                <div className="mt-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Holiday</p>
                  <p className="text-sm text-gray-800 font-medium mt-0.5">{selectedHoliday}</p>
                </div>
              </div>
            )}

            {selectedEvents.length > 0 ? selectedEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEvent(event)}
                className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm hover:shadow"
              >
                <div className="mt-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-indigo-100 bg-indigo-50 text-indigo-700 font-medium">
                      {getAudienceIcon(event.targetAudience)}
                      {event.targetAudience || "Not set"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    {formatEventTime(event.eventTime)}
                  </p>
                  {event.description && <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">{event.description}</p>}
                </div>
              </button>
            )) : !selectedHoliday && (
              <div className="text-xs text-gray-500 py-2">No events scheduled for this date.</div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-3 tracking-widest">Upcoming School Events</p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-xs text-gray-500">Loading events...</div>
            ) : upcomingEvents.length > 0 ? upcomingEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setSelectedDay(event.eventDate || selectedDay);
                  setSelectedEvent(event);
                }}
                className="w-full text-left flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50/20 transition-all shadow-sm"
              >
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 animate-pulse" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-gray-900 truncate">{event.title || "Untitled event"}</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] border border-gray-200 bg-white text-gray-600 font-medium">
                      {getAudienceIcon(event.targetAudience)}
                      {event.targetAudience || "Not set"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-green-600" />
                    {formatEventDate(event.eventDate)} {event.eventTime ? `• ${formatEventTime(event.eventTime)}` : "• All day"}
                  </p>
                  {event.description && <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{event.description}</p>}
                </div>
              </button>
            )) : <p className="text-xs text-gray-500">No upcoming events</p>}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h4 className="text-gray-900 font-bold">Event Details</h4>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Title</p>
                <p className="text-gray-900 text-sm font-semibold mt-1">{selectedEvent.title || "Untitled event"}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Description</p>
                <p className="text-gray-700 text-sm mt-1 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">{selectedEvent.description || "No description provided."}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</p>
                  <p className="text-gray-700 text-xs font-semibold mt-1">{formatEventDate(selectedEvent.eventDate)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Time</p>
                  <p className="text-gray-700 text-xs font-semibold mt-1">{selectedEvent.eventTime ? formatEventTime(selectedEvent.eventTime) : "All day"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Audience</p>
                  <p className="text-gray-700 text-xs font-semibold mt-1">{selectedEvent.targetAudience || "School-wide"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DashboardCalendar = forwardRef(DashboardCalendarComponent);
export { DashboardCalendar };
