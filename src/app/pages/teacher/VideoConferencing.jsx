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

/** Build a clean room name from a title */
const toRoomName = (title) =>
  "ConnectEd_" + String(title || "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60) + "_" + Date.now();

/* ──────────────────────────────────────────────────────────────────────
   Component
   ─────────────────────────────────────────────────────────────────── */
function VideoConferencing() {
  const navigate = useNavigate();
  const jitsiReady = useJitsiScript();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [loading, setLoading] = useState(true);
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

  /* ── load meetings from localStorage ────────────────────────────── */
  const STORAGE_KEY = "teacher_meetings";

  const loadMeetings = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setMeetings(saved ? JSON.parse(saved) : []);
    } catch { setMeetings([]); }
  }, []);

  const saveMeetings = (updated) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setMeetings(updated);
  };

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
    loadMeetings();
    setTimeout(() => setLoading(false), 400);
  }, [navigate, fetchClasses, loadMeetings]);

  /* ── destroy Jitsi when leaving the meeting ─────────────────────── */
  useEffect(() => {
    if (!isInMeeting && jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
  }, [isInMeeting]);

  /* ── launch Jitsi Meet ───────────────────────────────────────────── */
  const launchJitsi = useCallback((meeting) => {
    if (!jitsiReady || !jitsiContainerRef.current) return;
    if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }

    const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName: meeting.roomName,
      parentNode: jitsiContainerRef.current,
      width: "100%",
      height: "100%",
      userInfo: { displayName: teacherName, email: teacherEmail },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        prejoinPageEnabled: false,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          "microphone", "camera", "closedcaptions", "desktop",
          "fullscreen", "fodeviceselection", "hangup", "chat",
          "recording", "raisehand", "videoquality", "filmstrip",
          "invite", "shortcuts", "tileview", "select-background",
          "mute-everyone",
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
      },
    });

    api.addEventListener("readyToClose", () => {
      setIsInMeeting(false);
      setActiveMeeting(null);
    });

    jitsiApiRef.current = api;
    setActiveMeeting(meeting);
    setIsInMeeting(true);

    // Update meeting status to Ongoing
    const updated = meetings.map((m) =>
      m.id === meeting.id ? { ...m, status: "Ongoing" } : m
    );
    saveMeetings(updated);
  }, [jitsiReady, teacherName, teacherEmail, meetings]);

  /* ── end meeting ─────────────────────────────────────────────────── */
  const endMeeting = () => {
    if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
    if (activeMeeting) {
      const updated = meetings.map((m) =>
        m.id === activeMeeting.id ? { ...m, status: "Ended" } : m
      );
      saveMeetings(updated);
    }
    setIsInMeeting(false);
    setActiveMeeting(null);
  };

  /* ── form validation + create ────────────────────────────────────── */
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = "Title is required";
    if (!formData.date) errors.date = "Date is required";
    if (!formData.time) errors.time = "Time is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateMeeting = () => {
    if (!validateForm()) return;
    setIsSaving(true);
    const roomName = toRoomName(formData.title);
    const meetingLink = `https://${JITSI_DOMAIN}/${roomName}`;
    const newMeeting = {
      id: `meeting_${Date.now()}`,
      title: formData.title,
      class: formData.class,
      subject: formData.subject,
      date: formData.date,
      time: formData.time,
      duration: `${formData.duration} min`,
      status: "Scheduled",
      participants: 0,
      roomName,
      meetingLink,
      createdAt: new Date().toISOString(),
    };
    saveMeetings([newMeeting, ...meetings]);
    handleCloseModal();
    setIsSaving(false);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({ title: "", class: "", subject: "", date: "", time: "", duration: "60" });
    setFormErrors({});
  };

  const handleDeleteMeeting = (id) => {
    if (!window.confirm("Delete this meeting?")) return;
    saveMeetings(meetings.filter((m) => m.id !== id));
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
    return "bg-white/5 text-gray-400 border-white/10";
  };

  const classOptions = classes.length > 0
    ? classes.map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (${c.section})` }))
    : [{ value: "Grade 7", label: "Grade 7" }, { value: "Grade 8", label: "Grade 8" }, { value: "Grade 9", label: "Grade 9" }, { value: "Grade 10", label: "Grade 10" }];

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = [meeting.title, meeting.class, meeting.subject].some((s) =>
      String(s || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesFilter = filterStatus === "all" || meeting.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/login"); };

  if (loading) return <LoadingScreen message="Loading video conferencing..." />;

  /* ══════════════════ MEETING ROOM VIEW ══════════════════ */
  if (isInMeeting) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Meeting header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-semibold text-sm">{activeMeeting?.title}</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-red-600/20 text-red-300 border border-red-500/30 rounded-full text-xs">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              Live
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={activeMeeting?.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
            <button
              onClick={endMeeting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <StopCircle className="w-4 h-4" />
              End Meeting
            </button>
          </div>
        </div>

        {/* Jitsi embed */}
        <div className="flex-1 relative bg-gray-950">
          <div ref={jitsiContainerRef} className="w-full h-full" style={{ minHeight: "calc(100vh - 57px)" }} />
          {!jitsiReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400 text-sm">Loading meeting room…</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════ MEETINGS DASHBOARD ══════════════════ */
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top bar */}
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Video Conferencing</h2>
            <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
              <Bell className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Hero */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">Virtual Classroom</h1>
                <p className="text-indigo-100 text-sm">Schedule and host online classes powered by Jitsi Meet — no account or download needed</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Jitsi Meet API Connected
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 backdrop-blur-sm transition-all font-medium"
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
              { label: "Live Now", value: meetings.filter((m) => m.status === "Ongoing").length, icon: <Play className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "Scheduled", value: meetings.filter((m) => m.status === "Scheduled").length, icon: <Calendar className="w-5 h-5" />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "Completed", value: meetings.filter((m) => m.status === "Ended").length, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className={`rounded-xl p-5 border ${bg}`}>
                <div className={`${color} mb-2`}>{icon}</div>
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Info banner about Jitsi */}
          {!jitsiReady && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-blue-300 text-sm">Loading Jitsi Meet API… meetings will be available shortly.</p>
            </div>
          )}

          {/* Search & filter */}
          <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search meetings by title, class, or subject…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
              {[
                { key: "all", label: "All" },
                { key: "Scheduled", label: "Scheduled" },
                { key: "Ongoing", label: "Live" },
                { key: "Ended", label: "Ended" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterStatus === key ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Meetings list */}
          <div className="space-y-4">
            {filteredMeetings.length === 0 ? (
              <div className="bg-gray-900/40 rounded-xl border border-white/5 p-16 text-center">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-white font-semibold mb-1">No meetings yet</h3>
                <p className="text-gray-400 text-sm mb-4">Schedule your first online class session.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Schedule Meeting
                </button>
              </div>
            ) : (
              filteredMeetings.map((meeting) => (
                <div key={meeting.id} className="bg-gray-900/60 rounded-xl border border-white/10 hover:border-indigo-500/30 transition-all shadow-sm">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="text-base font-semibold text-white">{meeting.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(meeting.status)}`}>
                            {meeting.status === "Ongoing" && <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />}
                            {meeting.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm text-gray-400">
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
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-lg">
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
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${copySuccess === meeting.id ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"}`}
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
                            disabled={!jitsiReady}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${meeting.status === "Ongoing" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}
                          >
                            <Video className="w-4 h-4" />
                            {meeting.status === "Ongoing" ? "Rejoin" : "Start"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
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
          <div className="bg-gray-900 rounded-2xl max-w-xl w-full shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-gray-900 z-10 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-white">Schedule Online Class</h3>
                <p className="text-xs text-gray-400 mt-0.5">Powered by Jitsi Meet — no software download needed</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Meeting Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Mathematics – Algebra Class"
                  className={`w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.title ? "border-red-500" : "border-white/20"}`}
                />
                {formErrors.title && <p className="mt-1 text-xs text-red-400">{formErrors.title}</p>}
              </div>

              {/* Class & Subject */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Class</label>
                  <select
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Select class</option>
                    {classOptions.map((c) => (
                      <option key={c.value} value={c.label || c.value}>{c.label || c.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Mathematics"
                    className="w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              {/* Date, Time, Duration */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full px-4 py-3 bg-black/20 text-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.date ? "border-red-500" : "border-white/20"}`}
                  />
                  {formErrors.date && <p className="mt-1 text-xs text-red-400">{formErrors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Time <span className="text-red-400">*</span></label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className={`w-full px-4 py-3 bg-black/20 text-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${formErrors.time ? "border-red-500" : "border-white/20"}`}
                  />
                  {formErrors.time && <p className="mt-1 text-xs text-red-400">{formErrors.time}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Duration</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 text-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button onClick={handleCloseModal} className="flex-1 px-4 py-2.5 border border-white/20 text-gray-300 rounded-lg hover:bg-white/5 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
