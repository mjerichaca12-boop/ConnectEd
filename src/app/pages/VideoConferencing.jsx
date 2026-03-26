import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import {
  Bell,
  Search,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Calendar,
  Clock,
  Copy,
  Settings,
  MessageSquare,
  Hand,
  BookOpen,
  X,
  Info
} from "lucide-react";
function VideoConferencing() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [notifications, setNotifications] = useState(3);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [viewMode, setViewMode] = useState("speaker");
  const [meetings] = useState([
    { id: "1", title: "Mathematics - Algebra Basics", teacher: "Prof. Juan Santos", subject: "Mathematics", date: "2026-02-15", time: "09:00 AM", duration: "60 min", status: "Ongoing", meetingLink: "https://meet.connected.edu/math-algebra-001" },
    { id: "2", title: "Science - Ecosystem Study", teacher: "Prof. Maria Garcia", subject: "Science", date: "2026-02-15", time: "02:00 PM", duration: "45 min", status: "Upcoming", meetingLink: "https://meet.connected.edu/science-eco-002" },
    { id: "3", title: "English - Poetry Analysis", teacher: "Prof. Pedro Cruz", subject: "English", date: "2026-02-16", time: "10:30 AM", duration: "60 min", status: "Upcoming", meetingLink: "https://meet.connected.edu/eng-poetry-003" },
    { id: "4", title: "History - World War II", teacher: "Prof. Ana Reyes", subject: "History", date: "2026-02-14", time: "11:00 AM", duration: "60 min", status: "Ended", meetingLink: "https://meet.connected.edu/hist-ww2-004" }
  ]);
  const [participants] = useState([
    { id: "1", name: "Prof. Juan Santos", role: "Teacher", isMuted: false, isVideoOn: true, isHandRaised: false },
    { id: "2", name: "Maria Cruz", role: "Student", isMuted: true, isVideoOn: true, isHandRaised: false },
    { id: "3", name: "Pedro Reyes", role: "Student", isMuted: false, isVideoOn: false, isHandRaised: false },
    { id: "4", name: "Ana Garcia", role: "Student", isMuted: true, isVideoOn: true, isHandRaised: false }
  ]);
  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/school-selection");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "student") {
      navigate("/school-selection");
      return;
    }
    setStudentName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/school-selection");
  };
  const filteredMeetings = meetings.filter(
    (meeting) => meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) || meeting.teacher.toLowerCase().includes(searchQuery.toLowerCase()) || meeting.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
  };
  const getStatusColor = (status) => {
    switch (status) {
      case "Ongoing":
        return "bg-red-100 text-red-700 border-red-200";
      case "Upcoming":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Ended":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading video conferencing...</p>
        </div>
      </div>;
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
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>Ongoing</span>
              <span className="opacity-75">•</span>
              <span>45:32</span>
            </div>
          </div>
          <button
      onClick={() => setIsInMeeting(false)}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
    >
            <X className="w-4 h-4" />
            Leave Meeting
          </button>
        </div>

        {
      /* Main Meeting Area */
    }
        <div className="flex-1 flex overflow-hidden">
          {
      /* Video Area */
    }
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-4 h-full">
              {
      /* Teacher Video - Main */
    }
              <div className="bg-gray-800 rounded-xl overflow-hidden relative h-[60%]">
                <div className="h-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="w-32 h-32 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center text-5xl font-bold">
                      P
                    </div>
                    <p className="text-xl font-medium">Prof. Juan Santos</p>
                    <p className="text-sm opacity-75 mt-1">Teacher</p>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 backdrop-blur-sm rounded-lg">
                    <span className="text-white text-sm font-medium">Prof. Juan Santos</span>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full">Teacher</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="p-1.5 bg-emerald-600 rounded-full">
                      <Mic className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {
      /* Student Videos Grid */
    }
              <div className="grid grid-cols-4 gap-3 h-[35%]">
                {
      /* Self Video */
    }
                <div className="bg-gray-800 rounded-xl overflow-hidden relative">
                  <div className="h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    {isCameraOn ? <div className="text-white text-center">
                        <div className="w-12 h-12 mx-auto mb-1 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                          {studentName.charAt(0)}
                        </div>
                        <p className="text-xs font-medium">You</p>
                      </div> : <div className="text-white text-center">
                        <VideoOff className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <p className="text-xs opacity-75">You</p>
                      </div>}
                  </div>
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="flex items-center justify-between text-white">
                      <span className="text-xs px-1.5 py-0.5 bg-gray-900/80 backdrop-blur-sm rounded truncate">You</span>
                      <div className="flex items-center gap-0.5">
                        {isHandRaised && <div className="p-0.5 bg-yellow-500 rounded-full">
                            <Hand className="w-2.5 h-2.5 text-white" />
                          </div>}
                        {!isMicOn && <div className="p-0.5 bg-red-600 rounded-full">
                            <MicOff className="w-2.5 h-2.5 text-white" />
                          </div>}
                      </div>
                    </div>
                  </div>
                </div>

                {
      /* Other Participants */
    }
                {participants.slice(1, 4).map((participant) => <div key={participant.id} className="bg-gray-800 rounded-xl overflow-hidden relative">
                    <div className="h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      {participant.isVideoOn ? <div className="text-white text-center">
                          <div className="w-12 h-12 mx-auto mb-1 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                            {participant.name.charAt(0)}
                          </div>
                          <p className="text-xs font-medium truncate px-1">{participant.name.split(" ")[0]}</p>
                        </div> : <div className="text-white text-center">
                          <VideoOff className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          <p className="text-xs opacity-75 truncate px-1">{participant.name.split(" ")[0]}</p>
                        </div>}
                    </div>
                    <div className="absolute bottom-1 right-1">
                      <div className="flex items-center gap-0.5">
                        {participant.isHandRaised && <div className="p-0.5 bg-yellow-500 rounded-full">
                            <Hand className="w-2.5 h-2.5 text-white" />
                          </div>}
                        {participant.isMuted && <div className="p-0.5 bg-red-600 rounded-full">
                            <MicOff className="w-2.5 h-2.5 text-white" />
                          </div>}
                      </div>
                    </div>
                  </div>)}
              </div>
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
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {
      /* Teacher */
    }
                {participants.filter((p) => p.role === "Teacher").map((participant) => <div key={participant.id} className="flex items-center gap-3 p-3 bg-emerald-600/20 rounded-lg border border-emerald-600/30">
                    <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                      {participant.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{participant.name}</p>
                      <p className="text-emerald-400 text-xs">Teacher</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {participant.isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    </div>
                  </div>)}

                {
      /* Self */
    }
                <div className="flex items-center gap-3 p-3 bg-blue-600/20 rounded-lg border border-blue-600/30">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {studentName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{studentName} (You)</p>
                    <p className="text-blue-400 text-xs">Student</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isHandRaised && <Hand className="w-4 h-4 text-yellow-400" />}
                    {isMicOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
                  </div>
                </div>

                {
      /* Other Students */
    }
                {participants.filter((p) => p.role === "Student").map((participant) => <div key={participant.id} className="flex items-center gap-3 p-3 hover:bg-gray-700/30 rounded-lg transition-colors">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
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
              <button className="p-3 hover:bg-gray-700 rounded-lg transition-colors" title="Meeting Info">
                <Info className="w-5 h-5 text-white" />
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
      onClick={() => setIsHandRaised(!isHandRaised)}
      className={`p-4 rounded-lg transition-all ${isHandRaised ? "bg-yellow-500 hover:bg-yellow-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
      title={isHandRaised ? "Lower Hand" : "Raise Hand"}
    >
                <Hand className="w-5 h-5" />
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
  return <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {
    /* Top Header */
  }
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Video Conferencing</h2>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {notifications > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>}
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
                <p className="text-emerald-50">Join your virtual classes and meetings</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold">{meetings.filter((m) => m.status === "Ongoing").length}</p>
                  <p className="text-sm text-emerald-50">Ongoing Now</p>
                </div>
              </div>
            </div>
          </div>

          {
    /* Stats Cards */
  }
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Video className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-gray-600 text-sm">Ongoing Classes</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{meetings.filter((m) => m.status === "Ongoing").length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-gray-600 text-sm">Upcoming</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">{meetings.filter((m) => m.status === "Upcoming").length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-gray-600 text-sm">Completed</p>
              </div>
              <p className="text-3xl font-bold text-gray-600">{meetings.filter((m) => m.status === "Ended").length}</p>
            </div>
          </div>

          {
    /* Search */
  }
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
    type="text"
    placeholder="Search meetings by title, teacher, or subject..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
            </div>
          </div>

          {
    /* Live Meetings First */
  }
          {filteredMeetings.filter((m) => m.status === "Ongoing").length > 0 && <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-semibold text-gray-900">Ongoing Now</h2>
              </div>
              <div className="space-y-4">
                {filteredMeetings.filter((m) => m.status === "Ongoing").map((meeting) => <div key={meeting.id} className="bg-white rounded-xl border-2 border-red-200 shadow-md hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-200">
                              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                              {meeting.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <BookOpen className="w-4 h-4" />
                              <span>{meeting.subject}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>{meeting.teacher}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{meeting.time} ({meeting.duration})</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
    type="text"
    value={meeting.meetingLink}
    readOnly
    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
  />
                            <button
    onClick={() => handleCopyLink(meeting.meetingLink)}
    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
    title="Copy Link"
  >
                              <Copy className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>

                        <button
    onClick={() => setIsInMeeting(true)}
    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-md hover:shadow-lg"
  >
                          <Video className="w-5 h-5" />
                          Join Now
                        </button>
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>}

          {
    /* Upcoming Meetings */
  }
          {filteredMeetings.filter((m) => m.status === "Upcoming").length > 0 && <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Meetings</h2>
              <div className="space-y-4">
                {filteredMeetings.filter((m) => m.status === "Upcoming").map((meeting) => <div key={meeting.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(meeting.status)}`}>
                              {meeting.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <BookOpen className="w-4 h-4" />
                              <span>{meeting.subject}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>{meeting.teacher}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(meeting.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{meeting.time}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
    type="text"
    value={meeting.meetingLink}
    readOnly
    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
  />
                            <button
    onClick={() => handleCopyLink(meeting.meetingLink)}
    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
    title="Copy Link"
  >
                              <Copy className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>}

          {
    /* Ended Meetings */
  }
          {filteredMeetings.filter((m) => m.status === "Ended").length > 0 && <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Meetings</h2>
              <div className="space-y-4">
                {filteredMeetings.filter((m) => m.status === "Ended").map((meeting) => <div key={meeting.id} className="bg-white rounded-xl border border-gray-200 shadow-sm opacity-75">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(meeting.status)}`}>
                              {meeting.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <BookOpen className="w-4 h-4" />
                              <span>{meeting.subject}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>{meeting.teacher}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(meeting.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>}
        </div>
      </main>
    </div>;
}
export {
  VideoConferencing
};
