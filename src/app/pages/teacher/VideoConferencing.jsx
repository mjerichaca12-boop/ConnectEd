import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { CustomSelect } from "@/app/components/admin/CustomSelect";
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
  Settings,
  Grid3x3,
  MessageSquare,
  Hand,
  MoreVertical,
  X,
  BookOpen,
  GraduationCap
} from "lucide-react";
function VideoConferencing() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [meetings, setMeetings] = useState([]);
  const [participants] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    class: "",
    subject: "",
    date: "",
    time: "",
    duration: "60"
  });
  const [formErrors, setFormErrors] = useState({});
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "teacher") {
      navigate("/login");
      return;
    }
    setTeacherName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };
  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) || meeting.class.toLowerCase().includes(searchQuery.toLowerCase()) || meeting.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || meeting.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = "Title is required";
    if (!formData.class) errors.class = "Class is required";
    if (!formData.subject) errors.subject = "Subject is required";
    if (!formData.date) errors.date = "Date is required";
    if (!formData.time) errors.time = "Time is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleCreateMeeting = () => {
    if (!validateForm()) return;
    const newMeeting = {
      id: String(meetings.length + 1),
      title: formData.title,
      class: formData.class,
      subject: formData.subject,
      date: formData.date,
      time: formData.time,
      duration: `${formData.duration} min`,
      status: "Scheduled",
      participants: 0,
      meetingLink: `https://meet.connected.edu/meeting-${Date.now()}`
    };
    setMeetings([...meetings, newMeeting]);
    handleCloseModal();
  };
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({ title: "", class: "", subject: "", date: "", time: "", duration: "60" });
    setFormErrors({});
  };
  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
  };
  const getStatusColor = (status) => {
    switch (status) {
      case "Ongoing":
        return "bg-red-100 text-red-700 border-red-200";
      case "Scheduled":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Ended":
        return "bg-white/5 text-gray-300 border-white/10";
      default:
        return "bg-white/5 text-gray-300 border-white/10";
    }
  };
  if (loading) {
    return <LoadingScreen message="Loading video conferencing..." />;
  }
  if (isInMeeting) {
    return <div className="min-h-screen bg-gray-900 flex flex-col">
        {
      /* Meeting Header */
    }
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-semibold">Mathematics - Algebra Basics</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm">
              <div className="w-2 h-2 bg-gray-900/60 rounded-full animate-pulse" />
              <span>Ongoing</span>
              <span className="opacity-75">ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</span>
              <span>45:32</span>
            </div>
          </div>
          <button
      onClick={() => setIsInMeeting(false)}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
    >
            <StopCircle className="w-4 h-4" />
            End Meeting
          </button>
        </div>

        {
      /* Main Meeting Area */
    }
        <div className="flex-1 flex overflow-hidden">
          {
      /* Video Grid */
    }
          <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
            <div className={`grid gap-4 h-full ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr" : "grid-cols-1"}`}>
              {
      /* Main Video (Teacher) */
    }
              <div className={`bg-gray-800 rounded-xl overflow-hidden relative ${viewMode === "speaker" ? "row-span-2" : ""}`}>
                <div className="aspect-video bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                  {isCameraOn ? <div className="text-white text-center">
                      <div className="w-24 h-24 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center text-4xl font-bold">
                        {teacherName.charAt(0)}
                      </div>
                      <p className="font-medium">Camera Active</p>
                    </div> : <div className="text-white text-center">
                      <VideoOff className="w-16 h-16 mx-auto mb-3 opacity-50" />
                      <p className="opacity-75">Camera Off</p>
                    </div>}
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 backdrop-blur-sm rounded-lg">
                    <span className="text-white text-sm font-medium">{teacherName} (You)</span>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full">Host</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isMicOn && <div className="p-1.5 bg-red-600 rounded-full">
                        <MicOff className="w-3 h-3 text-white" />
                      </div>}
                  </div>
                </div>
              </div>

              {
      /* Participant Videos */
    }
              {participants.slice(0, viewMode === "speaker" ? 3 : 8).map((participant) => <div key={participant.id} className="bg-gray-800 rounded-xl overflow-hidden relative">
                  <div className="aspect-video bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    {participant.isVideoOn ? <div className="text-white text-center">
                        <div className="w-16 h-16 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                          {participant.name.charAt(0)}
                        </div>
                        <p className="text-sm font-medium">{participant.name}</p>
                      </div> : <div className="text-white text-center">
                        <VideoOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm opacity-75">{participant.name}</p>
                      </div>}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="text-white text-xs font-medium px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded">
                      {participant.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {participant.isHandRaised && <div className="p-1 bg-yellow-500 rounded-full">
                          <Hand className="w-3 h-3 text-white" />
                        </div>}
                      {participant.isMuted && <div className="p-1 bg-red-600 rounded-full">
                          <MicOff className="w-3 h-3 text-white" />
                        </div>}
                    </div>
                  </div>
                </div>)}
            </div>
          </div>

          {
      /* Participants Sidebar */
    }
          {showParticipants && <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-white font-semibold">Participants ({participants.length + 1})</h3>
                <button
      onClick={() => setShowParticipants(false)}
      className="p-1 hover:bg-gray-700 rounded transition-colors"
    >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2">
                {
      /* Host */
    }
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                    {teacherName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{teacherName} (You)</p>
                    <p className="text-emerald-400 text-xs">Host</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isMicOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
                  </div>
                </div>

                {
      /* Participants */
    }
                {participants.map((participant) => <div key={participant.id} className="flex items-center gap-3 p-3 hover:bg-gray-700/30 rounded-lg transition-colors">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {participant.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{participant.name}</p>
                      <p className="text-gray-400 text-xs">{participant.role}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {participant.isHandRaised && <Hand className="w-4 h-4 text-yellow-400" />}
                      {participant.isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    </div>
                  </div>)}
              </div>
            </div>}
        </div>

        {
      /* Meeting Controls */
    }
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <button
      onClick={() => setViewMode(viewMode === "grid" ? "speaker" : "grid")}
      className="p-3 hover:bg-gray-700 rounded-lg transition-colors"
      title={viewMode === "grid" ? "Speaker View" : "Grid View"}
    >
                <Grid3x3 className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
      onClick={() => setIsMicOn(!isMicOn)}
      className={`p-4 rounded-lg transition-all ${isMicOn ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
      title={isMicOn ? "Mute" : "Unmute"}
    >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
      onClick={() => setIsCameraOn(!isCameraOn)}
      className={`p-4 rounded-lg transition-all ${isCameraOn ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
      title={isCameraOn ? "Stop Video" : "Start Video"}
    >
                {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
      onClick={() => setIsScreenSharing(!isScreenSharing)}
      className={`p-4 rounded-lg transition-all ${isScreenSharing ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
      title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
    >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>

              <button
      onClick={() => setShowChat(!showChat)}
      className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
      title="Chat"
    >
                <MessageSquare className="w-5 h-5 text-white" />
              </button>

              <button
      onClick={() => setShowParticipants(!showParticipants)}
      className={`p-4 rounded-lg transition-colors ${showParticipants ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
      title="Participants"
    >
                <Users className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-3 hover:bg-gray-700 rounded-lg transition-colors" title="Settings">
                <Settings className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {
    /* Top Header */
  }
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Video Conferencing</h2>
              </div>
              <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-400" />
                
              </button>
            </div>
          </div>
        </div>

        {
    /* Content */
  }
        <div className="p-6 space-y-6">
          {
    /* Header Section */
  }
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Video Conferencing</h1>
                <p className="text-emerald-50">Manage your virtual classes and meetings</p>
              </div>
              <button
    onClick={() => setShowCreateModal(true)}
    className="flex items-center gap-2 px-6 py-3 bg-gray-900/60 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
  >
                <Plus className="w-5 h-5" />
                Schedule Meeting
              </button>
            </div>
          </div>

          {
    /* Stats Cards */
  }
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Video className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-gray-400 text-sm">Total Meetings</p>
              </div>
              <p className="text-3xl font-bold text-white">{meetings.length}</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Play className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-gray-400 text-sm">Live Now</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{meetings.filter((m) => m.status === "Ongoing").length}</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-gray-400 text-sm">Scheduled</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">{meetings.filter((m) => m.status === "Scheduled").length}</p>
            </div>
            <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-gray-400 text-sm">Total Participants</p>
              </div>
              <p className="text-3xl font-bold text-purple-600">
                {meetings.reduce((sum, m) => sum + m.participants, 0)}
              </p>
            </div>
          </div>

          {
    /* Search and Filters */
  }
          <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
    type="text"
    placeholder="Search meetings by title, class, or subject..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-10 pr-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
              </div>
              <CustomSelect
    value={filterStatus}
    onChange={setFilterStatus}
    options={[
      { value: "all", label: "All Status" },
      { value: "live", label: "Live" },
      { value: "scheduled", label: "Scheduled" },
      { value: "ended", label: "Ended" }
    ]}
    icon={<Video className="w-5 h-5" />}
    className="min-w-[200px]"
  />
            </div>
          </div>

          {
    /* Meetings List */
  }
          <div className="space-y-4">
            {filteredMeetings.map((meeting) => <div key={meeting.id} className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-white">{meeting.title}</h3>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(meeting.status)}`}>
                          {meeting.status === "Ongoing" && <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />}
                          {meeting.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <BookOpen className="w-4 h-4" />
                          <span>{meeting.class}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(meeting.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{meeting.time} ({meeting.duration})</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Users className="w-4 h-4" />
                          <span>{meeting.participants} participants</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
    type="text"
    value={meeting.meetingLink}
    readOnly
    className="flex-1 px-3 py-2 bg-black/20 bg-black/20 text-white placeholder-gray-500 border border-white/10 rounded-lg text-sm text-gray-400"
  />
                        <button
    onClick={() => handleCopyLink(meeting.meetingLink)}
    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
    title="Copy Link"
  >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {meeting.status === "Ongoing" && <button
    onClick={() => setIsInMeeting(true)}
    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
  >
                          <Video className="w-4 h-4" />
                          Join
                        </button>}
                      {meeting.status === "Scheduled" && <button
    onClick={() => setIsInMeeting(true)}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
  >
                          <Play className="w-4 h-4" />
                          Start
                        </button>}
                      <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </div>
      </main>

      {
    /* Create Meeting Modal */
  }
      {showCreateModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide relative">
            <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-gray-900/60 z-10 rounded-t-2xl">
              <h3 className="text-xl font-semibold text-white">Schedule New Meeting</h3>
              <button
    onClick={handleCloseModal}
    type="button"
    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
  >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Meeting Title <span className="text-red-500">*</span>
                  </label>
                  <input
    type="text"
    value={formData.title}
    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
    className={`w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${formErrors.title ? "border-red-500" : "border-white/20"}`}
    placeholder="e.g., Mathematics - Algebra Basics"
  />
                  {formErrors.title && <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Class <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
    value={formData.class}
    onChange={(value) => setFormData({ ...formData, class: value })}
    options={[
      { value: "Grade 7", label: "Grade 7" },
      { value: "Grade 8", label: "Grade 8" },
      { value: "Grade 9", label: "Grade 9" },
      { value: "Grade 10", label: "Grade 10" },
      { value: "Grade 11", label: "Grade 11" },
      { value: "Grade 12", label: "Grade 12" }
    ]}
    icon={<GraduationCap className="w-5 h-5" />}
    placeholder="Select class"
    className="w-full"
  />
                    {formErrors.class && <p className="mt-1 text-sm text-red-600">{formErrors.class}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
    value={formData.subject}
    onChange={(value) => setFormData({ ...formData, subject: value })}
    options={[
      { value: "Mathematics", label: "Mathematics" },
      { value: "Science", label: "Science" },
      { value: "English", label: "English" },
      { value: "Filipino", label: "Filipino" },
      { value: "History", label: "History" }
    ]}
    icon={<BookOpen className="w-5 h-5" />}
    placeholder="Select subject"
    className="w-full"
  />
                    {formErrors.subject && <p className="mt-1 text-sm text-red-600">{formErrors.subject}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
    type="date"
    value={formData.date}
    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
    className={`w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${formErrors.date ? "border-red-500" : "border-white/20"}`}
  />
                    {formErrors.date && <p className="mt-1 text-sm text-red-600">{formErrors.date}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <input
    type="time"
    value={formData.time}
    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
    className={`w-full px-4 py-3 bg-black/20 text-white placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${formErrors.time ? "border-red-500" : "border-white/20"}`}
  />
                    {formErrors.time && <p className="mt-1 text-sm text-red-600">{formErrors.time}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Duration (minutes)
                    </label>
                    <CustomSelect
    value={formData.duration}
    onChange={(value) => setFormData({ ...formData, duration: value })}
    options={[
      { value: "30", label: "30 minutes" },
      { value: "45", label: "45 minutes" },
      { value: "60", label: "60 minutes" },
      { value: "90", label: "90 minutes" },
      { value: "120", label: "120 minutes" }
    ]}
    icon={<Clock className="w-5 h-5" />}
    className="w-full"
  />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
    onClick={handleCloseModal}
    className="px-4 py-2 text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
  >
                  Cancel
                </button>
                <button
    onClick={handleCreateMeeting}
    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
  >
                  Schedule Meeting
                </button>
              </div>
            </div>
          </div>
        </div>}
    </div>;
}
export {
  VideoConferencing
};
