import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Bell,
  Search,
  Plus,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Users,
  Calendar,
  Clock,
  Copy,
  Play,
  StopCircle,
  X,
  BookOpen,
  GraduationCap,
  ExternalLink,
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────
   Jitsi Meet API integration
   ─────────────────────────────────────────────────────────────────── */
const JITSI_DOMAIN = "meet.jit.si";
const MEETING_TABLE = "online_class_meetings";
const MEETING_HEADER_HEIGHT = 57;

const buildDirectMeetingUrl = (meetingLink, displayName) => {
  const base = String(meetingLink || "").trim();
  if (!base) return "";

  const joinConfig = [
    "config.prejoinPageEnabled=false",
    "config.prejoinConfig.enabled=false",
    "config.requireDisplayName=false",
    "config.enableWelcomePage=false",
    "config.enableLobby=false",
    "config.disableDeepLinking=true",
    "config.startWithAudioMuted=false",
    "config.startWithVideoMuted=false",
    "interfaceConfig.MOBILE_APP_PROMO=false",
    displayName ? `userInfo.displayName=\"${encodeURIComponent(String(displayName).trim())}\"` : "",
  ].join("&");

  return `${base}#${joinConfig}`;
};

const isLegacyRoomName = (roomName) => {
  const normalized = String(roomName || "").trim().toLowerCase();
  if (!normalized) return true;
  return normalized.startsWith("connected") || normalized.startsWith("connect");
};

/** Load the Jitsi Meet External API script once */
function useJitsiScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.JitsiMeetExternalAPI) { setReady(true); return; }
    const script = document.createElement("script");
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => console.error("[Jitsi] Failed to load the Jitsi Meet API script.");
    document.head.appendChild(script);
    return () => {
      if (!window.JitsiMeetExternalAPI) document.head.removeChild(script);
    };
  }, []);
  return ready;
}

/** Build a structured, readable, and unique room name from form values */
const slugPart = (value) => {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned;
};

const normalizeDatePart = (dateValue) => String(dateValue || "").replace(/[^0-9]/g, "");
const normalizeTimePart = (timeValue) => String(timeValue || "").replace(/[^0-9]/g, "").slice(0, 4);

const uniqueRoomSuffix = () => {
  const bytes = new Uint32Array(2);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff);
    bytes[1] = Math.floor(Math.random() * 0xffffffff);
  }

  return `${bytes[0].toString(16)}${bytes[1].toString(16)}`;
};

const buildStructuredRoomName = ({ title, className, subject, date, time, uniqueId }) => {
  const rawDate = normalizeDatePart(date);
  // Convert YYYYMMDD from native date input into MMDDYYYY for readability.
  const readableDate = rawDate.length === 8
    ? `${rawDate.slice(4, 6)}${rawDate.slice(6, 8)}${rawDate.slice(0, 4)}`
    : rawDate;

  const classChunk = slugPart(className) || "class";
  const subjectChunk = slugPart(subject) || "subject";
  const titleChunk = slugPart(title) || "meeting";
  const dateChunk = readableDate || rawDate || "date";
  const timeChunk = normalizeTimePart(time) || "time";
  const uniqueChunk = String(uniqueId || uniqueRoomSuffix());

  const chunks = [
    classChunk,
    subjectChunk,
    titleChunk,
    dateChunk,
    timeChunk,
    uniqueChunk,
  ];

  const room = chunks.join("_").replace(/_+/g, "_");
  return room.slice(0, 180);
};

/* ──────────────────────────────────────────────────────────────────────
   Component
   ─────────────────────────────────────────────────────────────────── */
function VideoConferencing() {
  const navigate = useNavigate();
  const jitsiReady = useJitsiScript();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const meetingWindowRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [copySuccess, setCopySuccess] = useState("");
  const [classes, setClasses] = useState([]);

  const [formData, setFormData] = useState({
    title: "", class: "", subject: "", date: "", time: "", duration: "60",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [meetingLaunchError, setMeetingLaunchError] = useState("");

  const saveMeetings = (updated) => setMeetings(updated);

  const normalizeMeetingStatus = (row) => {
    const status = String(row?.status || "").trim().toLowerCase();
    if (status === "ongoing") return "Ongoing";
    if (status === "ended") return "Ended";
    if (status === "scheduled") return "Scheduled";
    return row?.is_meeting_active ? "Ongoing" : "Scheduled";
  };

  const mapMeetingRow = (row) => {
    const storedRoomName = String(row?.room_name || row?.roomName || "").trim();
    const computedRoomName = isLegacyRoomName(storedRoomName)
      ? buildStructuredRoomName({
          title: row?.title,
          className: row?.class_name,
          subject: row?.subject,
          date: row?.scheduled_date,
          time: row?.scheduled_time,
          uniqueId: row?.id,
        })
      : storedRoomName;
    const roomName = String(computedRoomName || storedRoomName || "").trim();
    const meetingLink = String(row?.meeting_link || row?.meetingLink || (roomName ? `https://${JITSI_DOMAIN}/${roomName}` : "")).trim();
    const durationValue = Number(row?.duration_minutes ?? 60) || 60;
    const meetingTime = String(row?.scheduled_time || "").slice(0, 5);

    return {
      id: String(row?.id || `meeting_${Date.now()}`),
      title: String(row?.title || "Untitled Meeting"),
      class: String(row?.class_name || ""),
      classId: "",
      subject: String(row?.subject || ""),
      date: String(row?.scheduled_date || ""),
      time: meetingTime,
      duration: `${durationValue} min`,
      status: normalizeMeetingStatus(row),
      participants: Number(row?.participants_count || 0),
      roomName,
      meetingLink,
      createdAt: row?.created_at || new Date().toISOString(),
    };
  };

  const fetchMeetings = useCallback(async () => {
    if (!supabase) {
      setMeetings([]);
      return;
    }

    const tableName = MEETING_TABLE;
    const query = supabase.from(tableName).select("*").order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch meetings:", error);
      setMeetings([]);
      return;
    }

    setMeetings((data ?? []).map(mapMeetingRow));
  }, []);

  const generateUniqueRoomName = useCallback(async ({ title, className, subject, date, time }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = buildStructuredRoomName({ title, className, subject, date, time });
      const { count, error } = await supabase
        .from(MEETING_TABLE)
        .select("id", { head: true, count: "exact" })
        .eq("room_name", candidate);

      if (error) {
        // If lookup fails, still return the generated candidate and let DB unique constraint enforce safety.
        return candidate;
      }

      if ((count ?? 0) === 0) {
        return candidate;
      }
    }

    return [
      slugPart(className),
      slugPart(subject),
      slugPart(title),
      normalizeDatePart(date),
      normalizeTimePart(time),
      `${Date.now()}${uniqueRoomSuffix()}`,
    ].filter(Boolean).join("_");
  }, []);

  /* ── fetch teacher classes from Supabase ────────────────────────── */
  const fetchClasses = useCallback(async (email) => {
    if (!supabase || !email) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .eq("role", "teacher")
      .limit(1)
      .maybeSingle();
    if (!profileData?.id) return;
    setTeacherId(profileData.id);
    const { data } = await supabase
      .from("subjects")
      .select("id, code, name, section")
      .eq("teacher_id", profileData.id)
      .order("code", { ascending: true });
    setClasses(data ?? []);
  }, []);

  /* ── init ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) { navigate("/login"); return; }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") { navigate("/login"); return; }
    setTeacherName(user.name);
    setTeacherEmail(user.email || "");
    fetchClasses(user.email);
    fetchMeetings();
    setTimeout(() => setLoading(false), 400);
  }, [navigate, fetchClasses, fetchMeetings]);

  /* ── destroy Jitsi when leaving the meeting ─────────────────────── */
  useEffect(() => {
    if (!isInMeeting && jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
  }, [isInMeeting]);

  /* ── launch Jitsi Meet ───────────────────────────────────────────── */
  const launchJitsi = useCallback(async (meeting) => {
    if (!meeting?.meetingLink) return;
    setMeetingLaunchError("");

    let effectiveRoomName = String(meeting.roomName || "").trim();
    let effectiveMeetingLink = String(meeting.meetingLink || "").trim();

    if (isLegacyRoomName(effectiveRoomName)) {
      const regeneratedRoomName = buildStructuredRoomName({
        title: meeting.title,
        className: meeting.class,
        subject: meeting.subject,
        date: meeting.date,
        time: meeting.time,
        uniqueId: `${meeting.id}_${Date.now()}`,
      });
      effectiveRoomName = regeneratedRoomName;
      effectiveMeetingLink = `https://${JITSI_DOMAIN}/${regeneratedRoomName}`;
    }

    setIsInMeeting(true);
    setActiveMeeting({ ...meeting, status: "Ongoing", roomName: effectiveRoomName, meetingLink: effectiveMeetingLink });

    try {
      const tableName = MEETING_TABLE;
      const payload = {
        status: "Ongoing",
        is_meeting_active: true,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        room_name: effectiveRoomName,
        meeting_link: effectiveMeetingLink,
      };
      await supabase.from(tableName).update(payload).eq("id", Number(meeting.id));

      const updated = meetings.map((m) => (
        String(m.id) === String(meeting.id)
          ? { ...m, status: "Ongoing", roomName: effectiveRoomName, meetingLink: effectiveMeetingLink }
          : m
      ));
      saveMeetings(updated);
    } catch (error) {
      console.error("Failed to mark meeting as ongoing:", error);
      setMeetingLaunchError("Meeting opened, but we could not update status in the database.");
    }
  }, [meetings, teacherName]);

  /* ── end meeting ─────────────────────────────────────────────────── */
  const endMeeting = async () => {
    if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
    if (meetingWindowRef.current && !meetingWindowRef.current.closed) {
      meetingWindowRef.current.close();
    }
    meetingWindowRef.current = null;
    if (activeMeeting) {
      try {
        const tableName = MEETING_TABLE;
        const payload = {
          status: "Ended",
          is_meeting_active: false,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from(tableName).update(payload).eq("id", Number(activeMeeting.id));
      } catch (error) {
        console.error("Failed to end meeting:", error);
      }

      const updated = meetings.map((m) =>
        m.id === activeMeeting.id ? { ...m, status: "Ended" } : m
      );
      saveMeetings(updated);
    }
    setIsInMeeting(false);
    setActiveMeeting(null);
    navigate("/teacher/video-conference", { replace: true });
  };

  /* ── initialize embedded Jitsi room in existing meeting mockup ─── */
  useEffect(() => {
    if (!isInMeeting || !activeMeeting || !jitsiReady || !jitsiContainerRef.current) return;
    if (!window.JitsiMeetExternalAPI || jitsiApiRef.current) return;

    const meetingLink = String(activeMeeting.meetingLink || "").trim();
    const roomFromLink = meetingLink.split("/").filter(Boolean).pop() || "";
    const roomName = String(activeMeeting.roomName || roomFromLink || "").trim();
    if (!roomName) return;

    const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName,
      parentNode: jitsiContainerRef.current,
      width: "100%",
      height: "100%",
      userInfo: {
        displayName: teacherName || "Teacher",
        email: teacherEmail || "",
      },
      configOverwrite: {
        disableDeepLinking: true,
        prejoinPageEnabled: false,
        prejoinConfig: {
          enabled: false,
        },
        startWithAudioMuted: false,
        startWithVideoMuted: false,
      },
    });

    jitsiApiRef.current = api;
  }, [isInMeeting, activeMeeting, jitsiReady, teacherName, teacherEmail]);

  /* ── form validation + create ────────────────────────────────────── */
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = "Title is required";
    if (!formData.class) errors.class = "Class is required";
    if (!formData.subject.trim()) errors.subject = "Subject is required";
    if (!formData.date) errors.date = "Date is required";
    if (!formData.time) errors.time = "Time is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateMeeting = async () => {
    if (!validateForm()) return;
    setSaveError("");
    setIsSaving(true);
    try {
      const selectedClass = classOptions.find((c) => String(c.value) === String(formData.class));
      if (!selectedClass) {
        setSaveError("Please select a valid class from your assigned classes.");
        return;
      }
      const className = selectedClass?.label || formData.class || "";
      const roomName = await generateUniqueRoomName({
        title: formData.title,
        className,
        subject: formData.subject,
        date: formData.date,
        time: formData.time,
      });
      const meetingLink = `https://${JITSI_DOMAIN}/${roomName}`;
      const now = new Date().toISOString();

      let creatorId = String(teacherId || "").trim();
      if (!creatorId && teacherEmail) {
        const { data: teacherProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", teacherEmail)
          .eq("role", "teacher")
          .maybeSingle();
        creatorId = String(teacherProfile?.id || "").trim();
      }

      if (!creatorId) {
        setSaveError("Unable to resolve teacher account. Please sign in again.");
        return;
      }

      const tableName = MEETING_TABLE;
      const payload = {
        teacher_id: creatorId,
        teacher_name: teacherName || "",
        teacher_email: teacherEmail || "",
        title: formData.title.trim(),
        class_name: className,
        subject: formData.subject.trim(),
        scheduled_date: formData.date,
        scheduled_time: formData.time,
        duration_minutes: Number(formData.duration || 60) || 60,
        room_name: roomName,
        meeting_link: meetingLink,
        status: "Scheduled",
        is_meeting_active: false,
        participants_count: 0,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase.from(tableName).insert(payload).select("*").single();
      if (error) {
        console.error("Failed to save meeting:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          payload,
        });
        setSaveError(error.message || "Failed to save meeting.");
        return;
      }

      const mappedMeeting = mapMeetingRow(data || payload);
      saveMeetings([mappedMeeting, ...meetings]);

      handleCloseModal();
      await launchJitsi(mappedMeeting);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({ title: "", class: "", subject: "", date: "", time: "", duration: "60" });
    setFormErrors({});
    setSaveError("");
  };

  const handleDeleteMeeting = async (id) => {
    if (!window.confirm("Delete this meeting?")) return;
    try {
      const tableName = MEETING_TABLE;
      await supabase.from(tableName).delete().eq("id", Number(id));
    } catch (error) {
      console.error("Failed to delete meeting:", error);
    }
    saveMeetings(meetings.filter((m) => String(m.id) !== String(id)));
  };

  const handleCopyLink = (link, id) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(id);
      setTimeout(() => setCopySuccess(""), 2000);
    });
  };

  const getStatusColor = (status) => {
    if (status === "Ongoing") return "bg-red-500/20 text-red-300 border-red-500/30";
    if (status === "Scheduled") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.section})` }));

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = [meeting.title, meeting.class, meeting.subject].some((s) =>
      String(s || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesFilter = filterStatus === "all" || String(meeting.status || "").toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/login"); };

  if (loading) return <LoadingScreen message="Loading video conferencing..." />;

  /* ══════════════════ MEETING ROOM VIEW ══════════════════ */
  if (isInMeeting) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <div className="bg-gray-1000 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-900 font-semibold text-sm">{activeMeeting?.title || "Meeting"}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-red-500/15 text-red-300 border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={buildDirectMeetingUrl(activeMeeting?.meetingLink, teacherName || "Teacher") || activeMeeting?.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
            <button
              onClick={endMeeting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-900 rounded-lg transition-colors text-sm font-medium"
            >
              <StopCircle className="w-4 h-4" />
              End Meeting
            </button>
          </div>
        </div>

        <div
          className="p-4"
          style={{ height: `calc(100vh - ${MEETING_HEADER_HEIGHT}px)` }}
        >
          <div className="relative h-full w-full rounded-xl overflow-hidden border border-gray-200 bg-black">
            {jitsiReady ? (
              <div ref={jitsiContainerRef} className="h-full w-full" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <div className="text-center max-w-xl px-6">
                  <div className="w-12 h-12 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-900 text-base font-medium mb-2">Loading meeting...</p>
                  <p className="text-gray-600 text-sm">Please wait while we load Jitsi.</p>
                </div>
              </div>
            )}
            {meetingLaunchError && (
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-amber-300 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">
                {meetingLaunchError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════ MEETINGS DASHBOARD ══════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Video Conferencing</h2>
            <button className="relative p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <Bell className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {meetingLaunchError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-200 text-sm">
              {meetingLaunchError}
            </div>
          )}

          {/* Hero */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-gray-900 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">Virtual Classroom</h1>
                <p className="text-indigo-100 text-sm">Schedule and host online classes powered by Jitsi Meet — no account or download needed</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-900/70">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Jitsi Meet API Connected
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/15 hover:bg-white/25 text-gray-900 rounded-xl border border-white/20 backdrop-blur-sm transition-all font-medium"
              >
                <Plus className="w-5 h-5" />
                Schedule Meeting
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Meetings", value: meetings.length, icon: <Video className="w-5 h-5" />, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
              { label: "Live Now", value: meetings.filter((m) => m.status === "Ongoing").length, icon: <Play className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-50 border-red-200" },
              { label: "Scheduled", value: meetings.filter((m) => m.status === "Scheduled").length, icon: <Calendar className="w-5 h-5" />, color: "text-blue-400", bg: "bg-blue-50 border-blue-200" },
              { label: "Completed", value: meetings.filter((m) => m.status === "Ended").length, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className={`rounded-xl p-5 border ${bg}`}>
                <div className={`${color} mb-2`}>{icon}</div>
                <p className="text-gray-600 text-xs mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Search & filter */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search meetings by title, class, or subject…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
              {[
                { key: "all", label: "All" },
                { key: "Scheduled", label: "Scheduled" },
                { key: "Ongoing", label: "Live" },
                { key: "Ended", label: "Ended" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterStatus === key ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Meetings list */}
          <div className="space-y-4">
            {filteredMeetings.length === 0 ? (
              <div className="bg-gray-500 rounded-xl border border-gray-100 p-16 text-center">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">No meetings yet</h3>
                <p className="text-gray-600 text-sm mb-4">Schedule your first online class session.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-gray-900 rounded-xl text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Schedule Meeting
                </button>
              </div>
            ) : (
              filteredMeetings.map((meeting) => (
                <div key={meeting.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-500/30 transition-all shadow-sm">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900">{meeting.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(meeting.status)}`}>
                            {meeting.status === "Ongoing" && <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />}
                            {meeting.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm text-gray-600">
                          {meeting.class && (
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-indigo-400" />
                              <span className="truncate">{meeting.class}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span>{meeting.date ? new Date(meeting.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <span>{meeting.time} · {meeting.duration}</span>
                          </div>
                        </div>

                        {/* Meeting link */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <a
                              href={meeting.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-300 hover:text-indigo-200 truncate transition-colors"
                            >
                              {meeting.meetingLink}
                            </a>
                          </div>
                          <button
                            onClick={() => handleCopyLink(meeting.meetingLink, meeting.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${copySuccess === meeting.id ? "bg-green-500/20 text-green-300 border-green-300" : "border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}
                            title="Copy link"
                          >
                            {copySuccess === meeting.id ? <><CheckCircle2 className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {(meeting.status === "Scheduled" || meeting.status === "Ongoing") && (
                          <button
                            onClick={() => launchJitsi(meeting)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${meeting.status === "Ongoing" ? "bg-red-600 hover:bg-red-700 text-gray-900" : "bg-indigo-600 hover:bg-indigo-700 text-gray-900"}`}
                          >
                            <Video className="w-4 h-4" />
                            {meeting.status === "Ongoing" ? "Rejoin" : "Start"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete meeting"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* ── Create Meeting Modal ──────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Schedule Online Class</h3>
                <p className="text-xs text-gray-600 mt-0.5">Powered by Jitsi Meet — no software download needed</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Meeting Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Mathematics – Algebra Class"
                  className={`w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.title ? "border-red-500" : "border-white/20"}`}
                />
                {formErrors.title && <p className="mt-1 text-xs text-red-400">{formErrors.title}</p>}
              </div>

              {/* Class & Subject */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Class</label>
                  <select
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.class ? "border-red-500" : "border-white/20"}`}
                  >
                    <option value="">Select class</option>
                    {classOptions.map((c) => (
                      <option key={c.value} value={c.value}>{c.label || c.value}</option>
                    ))}
                  </select>
                  {formErrors.class && <p className="mt-1 text-xs text-red-400">{formErrors.class}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Mathematics"
                    className={`w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.subject ? "border-red-500" : "border-white/20"}`}
                  />
                  {formErrors.subject && <p className="mt-1 text-xs text-red-400">{formErrors.subject}</p>}
                </div>
              </div>

              {/* Date, Time, Duration */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.date ? "border-red-500" : "border-white/20"}`}
                  />
                  {formErrors.date && <p className="mt-1 text-xs text-red-400">{formErrors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Time <span className="text-red-400">*</span></label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.time ? "border-red-500" : "border-white/20"}`}
                  />
                  {formErrors.time && <p className="mt-1 text-xs text-red-400">{formErrors.time}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">Duration</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    {["30", "45", "60", "90", "120"].map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-300 leading-relaxed">
                  A unique <strong>Jitsi Meet</strong> room link will be generated. Students can join from any browser — no app or account required. You can share the link or start the meeting directly from this page.
                </p>
              </div>

              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed">{saveError}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-white/20 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-gray-900 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSaving ? "Scheduling…" : "Schedule Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { VideoConferencing };
