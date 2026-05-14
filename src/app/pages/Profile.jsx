import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/components/Sidebar";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Bell,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  CheckCircle,
  Shield,
  BadgeCheck
} from "lucide-react";

function Profile() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [profileErrors, setProfileErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  const [profile, setProfile] = useState({
    id: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    year_level: "",
    section: "",
    created_at: "",
    address: "",
    date_of_birth: "",
    guardian_name: "",
    guardian_contact: "",
    lrn: ""
  });

  const [editedProfile, setEditedProfile] = useState(profile);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const fetchProfile = async () => {
    try {
      const userData = localStorage.getItem("currentUser");
      if (!userData) {
        navigate("/login");
        return;
      }
      const user = JSON.parse(userData);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const profileData = {
        id: data.id || "",
        first_name: data.first_name || "",
        middle_name: data.middle_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone: data.phone || "",
        year_level: data.year_level || "",
        section: data.section || "",
        created_at: data.created_at || "",
        address: data.address || "",
        date_of_birth: data.date_of_birth || "",
        guardian_name: data.guardian_name || "",
        guardian_contact: data.guardian_contact || "",
        lrn: data.lrn || ""
      };

      setProfile(profileData);
      setEditedProfile(profileData);
      setStudentName(`${profileData.first_name} ${profileData.last_name}`);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setErrorMessage("Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedProfile(profile);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile(profile);
    setProfileErrors([]);
  };

  const handleSave = async () => {
    const errors = [];
    if (!editedProfile.first_name.trim()) errors.push({ message: "First name is required" });
    if (!editedProfile.last_name.trim()) errors.push({ message: "Last name is required" });
    if (!editedProfile.email.trim()) errors.push({ message: "Email is required" });

    if (errors.length > 0) {
      setProfileErrors(errors);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    
    try {
      // Update email in Auth if changed
      if (editedProfile.email !== profile.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: editedProfile.email });
        if (authError) throw authError;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: editedProfile.first_name,
          middle_name: editedProfile.middle_name,
          last_name: editedProfile.last_name,
          email: editedProfile.email,
          phone: editedProfile.phone,
          address: editedProfile.address,
          date_of_birth: editedProfile.date_of_birth,
          guardian_name: editedProfile.guardian_name,
          guardian_contact: editedProfile.guardian_contact
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile(editedProfile);
      setStudentName(`${editedProfile.first_name} ${editedProfile.last_name}`);
      
      // Update local storage
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUser", JSON.stringify({
        ...currentUser,
        name: `${editedProfile.first_name} ${editedProfile.last_name}`,
        email: editedProfile.email
      }));

      setIsEditing(false);
      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setErrorMessage(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    const errors = [];
    if (!passwordData.newPassword) errors.push("New password is required");
    else if (passwordData.newPassword.length < 6) errors.push("Password must be at least 6 characters");
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.push("Passwords do not match");
    }

    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;

      setIsChangingPassword(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccessMessage("Password updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setPasswordErrors([err.message]);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar studentName={studentName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Profile</h2>
            {!isEditing ? (
              <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="text-emerald-700 font-medium">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 font-medium">{errorMessage}</p>
            </div>
          )}

          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30 text-4xl font-bold uppercase">
                {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile.first_name} {profile.last_name}</h1>
                <p className="text-emerald-50 mb-1">{profile.lrn || "NO LRN"}</p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium uppercase tracking-wider">{profile.year_level}</span>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium uppercase tracking-wider">{profile.section}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
                </div>
                <div className="p-6 space-y-6">
                  {profileErrors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-1">
                      {profileErrors.map((e, i) => <p key={i} className="text-sm text-red-600 font-medium">• {e.message}</p>)}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">First Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProfile.first_name}
                          onChange={(e) => setEditedProfile({ ...editedProfile, first_name: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.first_name}</p>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Middle Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProfile.middle_name}
                          onChange={(e) => setEditedProfile({ ...editedProfile, middle_name: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.middle_name || "—"}</p>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Last Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProfile.last_name}
                          onChange={(e) => setEditedProfile({ ...editedProfile, last_name: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.last_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editedProfile.email}
                          onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Contact Number</label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editedProfile.phone}
                          onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                          placeholder="09123456789"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.phone || "Not provided"}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Date of Birth</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editedProfile.date_of_birth}
                          onChange={(e) => setEditedProfile({ ...editedProfile, date_of_birth: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">
                          {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not set"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Home Address</label>
                      {isEditing ? (
                        <textarea
                          value={editedProfile.address}
                          onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                          rows={1}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.address || "No address provided"}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Guardian Information</h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Guardian Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProfile.guardian_name}
                          onChange={(e) => setEditedProfile({ ...editedProfile, guardian_name: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.guardian_name || "—"}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Guardian Contact</label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editedProfile.guardian_contact}
                          onChange={(e) => setEditedProfile({ ...editedProfile, guardian_contact: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      ) : (
                        <p className="text-gray-900 font-medium px-4 py-3 bg-gray-50 rounded-xl border border-transparent">{profile.guardian_contact || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-emerald-600" />
                    Academic Status
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Grade / Year</label>
                    <p className="font-bold text-gray-900">{profile.year_level || "Not Assigned"}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Section</label>
                    <p className="font-bold text-gray-900">{profile.section || "Not Assigned"}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Enrollment Date</label>
                    <p className="font-bold text-gray-900">
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    Security
                  </h3>
                </div>
                <div className="p-6">
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isChangingPassword && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Update Password</h3>
                <button onClick={() => setIsChangingPassword(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {passwordErrors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    {passwordErrors.map((e, i) => <p key={i} className="text-sm text-red-600 font-medium">{e}</p>)}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handlePasswordChange}
                  disabled={isSaving}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 mt-2"
                >
                  {isSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export { Profile };
