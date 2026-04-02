import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { Bell, User, Mail, Phone, Edit, Save, X } from "lucide-react";
function TeacherProfile() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    teacherId: "TCH-2026-001",
    fullName: "Ms. Sarah Rodriguez",
    email: "sarah.rodriguez@teacher.connected.edu",
    contactNumber: "+63 912 345 6789",
    department: "Mathematics Department",
    specialization: "Advanced Mathematics"
  });
  const [editedProfile, setEditedProfile] = useState(profile);
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
  const handleSave = () => {
    setProfile(editedProfile);
    setIsEditing(false);
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Profile</h2>
              </div>
              <button className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-400" />
                
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30">
                <span className="text-4xl font-bold">{profile.fullName.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile.fullName}</h1>
                <p className="text-emerald-50 mb-1">{profile.teacherId}</p>
                <p className="text-emerald-100">{profile.department}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Personal Information</h3>
              {!isEditing ? <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                  <Edit className="w-4 h-4" />
                  Edit
                </button> : <div className="flex gap-2">
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:bg-white/5 rounded-lg">
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </div>}
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Teacher ID</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.teacherId}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.fullName}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contact Number</label>
                {isEditing ? <div className="flex items-center gap-3 px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <input
    type="tel"
    value={editedProfile.contactNumber}
    onChange={(e) => setEditedProfile({ ...editedProfile, contactNumber: e.target.value })}
    className="flex-1 outline-none"
  />
                  </div> : <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-white">{profile.contactNumber}</span>
                  </div>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
}
export {
  TeacherProfile
};
