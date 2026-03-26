import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { Bell, User, Mail, Phone, Edit, Save, X } from "lucide-react";
function TeacherProfile() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("");
  const [notifications, setNotifications] = useState(5);
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
              {!isEditing ? <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                  <Edit className="w-4 h-4" />
                  Edit
                </button> : <div className="flex gap-2">
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher ID</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{profile.teacherId}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{profile.fullName}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{profile.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                {isEditing ? <div className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <input
    type="tel"
    value={editedProfile.contactNumber}
    onChange={(e) => setEditedProfile({ ...editedProfile, contactNumber: e.target.value })}
    className="flex-1 outline-none"
  />
                  </div> : <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">{profile.contactNumber}</span>
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
