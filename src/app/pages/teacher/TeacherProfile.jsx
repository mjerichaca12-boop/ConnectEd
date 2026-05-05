import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase } from "@/app/lib/supabaseClient";
import { buildSupabaseErrorMessage, isColumnMissingError, sanitizeFileName } from "@/app/lib/teacherHelpers";
import {
  User, Mail, Phone, Edit3, Save, X, Eye, EyeOff, Lock, Upload,
  Shield, BadgeCheck, Camera, ChevronRight, Star, BookOpen, Users,
  Clock, CheckCircle, AlertTriangle,
} from "lucide-react";

const STORAGE_BUCKET = "class-materials";
const PHONE_STRICT_PATTERN = /^09\d{9}$/;

const emptyProfile = { teacherId: "", fullName: "", email: "", phone: "", role: "Teacher", status: "Active", avatarUrl: "" };
const normalizePhoneInput = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 11);
const isValidPhoneNumber = (value) => PHONE_STRICT_PATTERN.test(String(value ?? "").trim());
const joinNameParts = (...parts) => parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(" ").trim();

const getFallbackCurrentUser = () => { try { const s = localStorage.getItem("currentUser"); return s ? JSON.parse(s) : null; } catch { return null; } };

const formatDisplayName = (profileRow, authUser, fallbackUser) => {
  const profileName = joinNameParts(profileRow?.first_name, profileRow?.middle_name, profileRow?.last_name);
  if (profileName) return profileName;
  for (const c of [profileRow?.full_name, profileRow?.display_name, profileRow?.name, authUser?.user_metadata?.full_name, authUser?.user_metadata?.name, fallbackUser?.name]) {
    if (String(c ?? "").trim()) return String(c).trim();
  }
  return String(authUser?.email || fallbackUser?.email || "Teacher").split("@")[0] || "Teacher";
};

const getAuthAvatarUrl = (authUser) => {
  const m = authUser?.user_metadata || {};
  return String(m.avatar_url || m.picture || m.picture_url || m.avatar || "").trim();
};

const makeTeacherProfileState = (profileRow, authUser, fallbackUser) => ({
  teacherId: String(profileRow?.id || authUser?.id || fallbackUser?.id || "").trim(),
  fullName: formatDisplayName(profileRow, authUser, fallbackUser),
  email: String(profileRow?.email || authUser?.email || fallbackUser?.email || "").trim(),
  phone: String(profileRow?.phone || profileRow?.contact_number || fallbackUser?.phone || "").trim(),
  role: String(profileRow?.role || fallbackUser?.role || "Teacher").trim() || "Teacher",
  status: String(profileRow?.status || fallbackUser?.status || "Active").trim() || "Active",
  avatarUrl: String(profileRow?.avatar_url || getAuthAvatarUrl(authUser) || fallbackUser?.avatarUrl || "").trim(),
  rawProfile: profileRow || null,
});

const getProfilePicturePath = (teacherId, fileName) =>
  `teacher-profile-pictures/${String(teacherId || "teacher")}/${Date.now()}-${sanitizeFileName(fileName)}`;

const extractStoragePathFromPublicUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const index = value.indexOf(marker);
  return index === -1 ? "" : decodeURIComponent(value.slice(index + marker.length));
};

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color }) {
  return (
    <div className={`rounded-xl p-5 border ${color} flex items-center gap-4`}>
      <div className="p-3 rounded-xl bg-white/5">
        {icon}
      </div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-white font-semibold">{value}</p>
      </div>
    </div>
  );
}

/* ─── Info Row ───────────────────────────────────────────────────── */
function InfoRow({ icon, label, value, children }) {
  return (
    <div className="group">
      <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2.5">{label}</label>
      <div className="flex items-center gap-4 px-5 py-4 bg-white/5 rounded-2xl border border-white/8 hover:border-white/20 transition-colors">
        <span className="text-gray-400 shrink-0">{icon}</span>
        {children || <span className="text-gray-100 text-base">{value || "Not available"}</span>}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
function TeacherProfile() {
  const navigate = useNavigate();
  const profileFileInputRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [editedPhone, setEditedPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState("");
  const [activeSection, setActiveSection] = useState("profile"); // "profile" | "security"

  const syncStoredCurrentUser = (nextProfile) => {
    try {
      const currentUser = getFallbackCurrentUser();
      if (!currentUser) return;
      localStorage.setItem("currentUser", JSON.stringify({
        ...currentUser,
        id: nextProfile.teacherId || currentUser.id,
        name: nextProfile.fullName || currentUser.name,
        email: nextProfile.email || currentUser.email,
        role: nextProfile.role || currentUser.role,
        status: nextProfile.status || currentUser.status,
        phone: nextProfile.phone || currentUser.phone,
        avatarUrl: nextProfile.avatarUrl || currentUser.avatarUrl,
      }));
    } catch { /* silent */ }
  };

  const loadTeacherProfile = async (authUserOverride) => {
    if (!supabase) {
      const fallbackUser = getFallbackCurrentUser();
      const nextProfile = makeTeacherProfileState(null, authUserOverride || null, fallbackUser);
      setProfile(nextProfile);
      setTeacherName(nextProfile.fullName);
      setEditedPhone(nextProfile.phone);
      setProfilePicturePreview(nextProfile.avatarUrl || "");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    const fallbackUser = getFallbackCurrentUser();
    const authUser = authUserOverride || (await supabase.auth.getUser()).data?.user || null;
    if (!authUser && (!fallbackUser || fallbackUser.role !== "teacher")) { navigate("/login"); return; }

    let profileRow = null;
    const candidateIds = [authUser?.id, fallbackUser?.id].map((v) => String(v || "").trim()).filter(Boolean);
    const candidateEmails = [authUser?.email, fallbackUser?.email].map((v) => String(v || "").trim()).filter(Boolean);

    for (const id of candidateIds) {
      const { data } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "teacher").maybeSingle();
      if (data) { profileRow = data; break; }
    }
    if (!profileRow) {
      for (const email of candidateEmails) {
        const { data } = await supabase.from("profiles").select("*").eq("email", email).eq("role", "teacher").maybeSingle();
        if (data) { profileRow = data; break; }
      }
    }

    const nextProfile = makeTeacherProfileState(profileRow, authUser, fallbackUser);
    setProfile(nextProfile);
    setTeacherName(nextProfile.fullName);
    setEditedPhone(nextProfile.phone);
    setProfilePicturePreview(nextProfile.avatarUrl || "");
    syncStoredCurrentUser(nextProfile);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const authResult = await supabase?.auth.getUser?.() || { data: { user: null } };
      const authUser = authResult.data?.user || null;
      const fallbackUser = getFallbackCurrentUser();
      if (!authUser && (!fallbackUser || fallbackUser.role !== "teacher")) { navigate("/login"); return; }
      if (!isMounted) return;
      await loadTeacherProfile(authUser);
    };
    init().catch((err) => { console.error(err); if (isMounted) { setErrorMessage("Unable to load profile data."); setLoading(false); } });
    const sub = supabase?.auth.onAuthStateChange?.((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) { navigate("/login"); return; }
      loadTeacherProfile(session.user).catch(console.error);
    });
    return () => { isMounted = false; sub?.data?.subscription?.unsubscribe?.(); };
  }, [navigate]);

  useEffect(() => {
    return () => { if (profilePicturePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePicturePreview); };
  }, [profilePicturePreview]);

  useEffect(() => {
    if (!successMessage && !errorMessage) return;
    const timer = window.setTimeout(() => { setSuccessMessage(""); setErrorMessage(""); }, 4000);
    return () => window.clearTimeout(timer);
  }, [successMessage, errorMessage]);

  const handleLogout = () => {
    if (supabase) void supabase.auth.signOut();
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedPhone(profile.phone);
    setNewPassword("");
    setProfilePictureFile(null);
    setProfilePicturePreview(profile.avatarUrl || "");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedPhone(profile.phone);
    setNewPassword("");
    setProfilePictureFile(null);
    setProfilePicturePreview(profile.avatarUrl || "");
    setErrorMessage("");
  };

  const handleSave = async () => {
    if (!supabase) { setErrorMessage("Unable to connect to the server."); return; }
    const trimmedPhone = editedPhone.trim();
    const hasPhoneChange = trimmedPhone !== profile.phone;
    const hasPasswordChange = Boolean(newPassword.trim());
    const hasPictureChange = Boolean(profilePictureFile);
    if (!hasPhoneChange && !hasPasswordChange && !hasPictureChange) { setIsEditing(false); return; }
    if (hasPhoneChange && !isValidPhoneNumber(trimmedPhone)) { setErrorMessage("Phone number must be 11 digits and start with 09."); return; }

    setIsSaving(true); setErrorMessage(""); setSuccessMessage("");
    const authResult = await supabase.auth.getUser();
    const authUser = authResult.data?.user || null;
    let nextAvatarUrl = profile.avatarUrl;
    let uploadedAvatarPath = "";
    const previousAvatarPath = extractStoragePathFromPublicUrl(profile.avatarUrl);
    let avatarColumnUnavailable = false;

    try {
      if (hasPictureChange && profilePictureFile) {
        const filePath = getProfilePicturePath(profile.teacherId || authUser?.id || "teacher", profilePictureFile.name);
        const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, profilePictureFile, { upsert: true, contentType: profilePictureFile.type });
        if (uploadResult.error) throw uploadResult.error;
        uploadedAvatarPath = uploadResult.data?.path || filePath;
        const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploadedAvatarPath);
        nextAvatarUrl = publicUrlData?.publicUrl || "";
      }

      const updatePayload = { phone: trimmedPhone };
      if (hasPictureChange) {
        updatePayload.avatar_url = nextAvatarUrl || null;
      }

      let { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", profile.teacherId || authUser?.id)
        .eq("role", "teacher");

      if (profileUpdateError && hasPictureChange && isColumnMissingError(profileUpdateError)) {
        avatarColumnUnavailable = true;
        if (uploadedAvatarPath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([uploadedAvatarPath]).catch(console.error);
          uploadedAvatarPath = "";
        }
        nextAvatarUrl = profile.avatarUrl;

        const { error: retryError } = await supabase
          .from("profiles")
          .update({ phone: trimmedPhone })
          .eq("id", profile.teacherId || authUser?.id)
          .eq("role", "teacher");

        profileUpdateError = retryError;
      }

      if (profileUpdateError) throw profileUpdateError;

      if (hasPasswordChange) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword.trim() });
        if (passwordError) throw passwordError;
      }

      const nextProfile = { ...profile, phone: trimmedPhone, avatarUrl: nextAvatarUrl || profile.avatarUrl };
      setProfile(nextProfile);
      setTeacherName(nextProfile.fullName);
      setEditedPhone(nextProfile.phone);
      setNewPassword("");
      setProfilePictureFile(null);
      setProfilePicturePreview(nextProfile.avatarUrl || "");
      setIsEditing(false);
      syncStoredCurrentUser(nextProfile);
      if (profileFileInputRef.current) profileFileInputRef.current.value = "";
      if (hasPictureChange && previousAvatarPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([previousAvatarPath]).catch(console.error);
      }
      setSuccessMessage(
        avatarColumnUnavailable
          ? "Profile updated. Profile picture could not be saved because avatar_url is not available in your profiles table."
          : "Profile updated successfully."
      );
    } catch (error) {
      console.error("Failed to update teacher profile:", error);
      if (uploadedAvatarPath && hasPictureChange) await supabase.storage.from(STORAGE_BUCKET).remove([uploadedAvatarPath]).catch(console.error);
      setErrorMessage(buildSupabaseErrorMessage("Unable to update profile", error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) { setProfilePictureFile(null); setProfilePicturePreview(profile.avatarUrl || ""); return; }
    if (!file.type.startsWith("image/")) { setErrorMessage("Please select a valid image file."); return; }
    if (profilePicturePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePicturePreview);
    setProfilePictureFile(file);
    setProfilePicturePreview(URL.createObjectURL(file));
  };

  const avatarSource = profilePicturePreview || profile.avatarUrl;
  const initials = profile.fullName?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "T";

  if (loading) return <LoadingScreen message="Loading profile..." />;

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Top bar */}
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Teacher Profile</h2>
            {!isEditing ? (
              <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-all text-sm font-medium">
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-all text-sm font-medium">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 space-y-7">
          {/* Alert messages */}
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-emerald-300 text-sm font-medium">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Profile Hero Card */}
          <div className="relative rounded-2xl overflow-hidden">
            {/* Background gradient */}
            <div className="h-56 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 relative">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "25px 25px" }} />
            </div>

            {/* Profile content */}
            <div className="bg-gray-900/80 border border-white/10 px-10 pb-10">
              <div className="flex items-end gap-8 -mt-18 flex-wrap">
                {/* Avatar */}
                <div className="relative group">
                  <div className="w-36 h-36 rounded-3xl border-4 border-gray-900 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-2xl">
                    {avatarSource ? (
                      <img src={avatarSource} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl font-bold text-white">{initials}</span>
                    )}
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => profileFileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Camera className="w-8 h-8 text-white" />
                    </button>
                  )}
                  <input ref={profileFileInputRef} type="file" accept="image/*" onChange={handleProfilePictureChange} className="hidden" />
                </div>

                <div className="flex-1 min-w-0 pt-20">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-4xl font-extrabold text-white tracking-tight">{profile.fullName || "Teacher"}</h1>
                      <p className="text-gray-400 text-base mt-1">{profile.email}</p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full text-sm font-semibold">
                          <BadgeCheck className="w-4 h-4" />
                          {profile.role}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border ${profile.status === "Active" ? "bg-blue-500/10 border-blue-500/20 text-blue-300" : "bg-gray-500/10 border-gray-500/20 text-gray-400"}`}>
                          <div className={`w-2 h-2 rounded-full ${profile.status === "Active" ? "bg-blue-400 animate-pulse" : "bg-gray-400"}`} />
                          {profile.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 bg-gray-900/60 border border-white/10 rounded-2xl p-1.5">
            {[
              { key: "profile", label: "Personal Info", icon: <User className="w-5 h-5" /> },
              { key: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-base font-semibold transition-all ${activeSection === key ? "bg-white/10 text-white shadow-md" : "text-gray-400 hover:text-white"}`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Personal Info Section */}
          {activeSection === "profile" && (
            <div className="bg-gray-900/60 rounded-2xl border border-white/10 p-8 space-y-7">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <User className="w-5 h-5 text-emerald-400" />
                Personal Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={<User className="w-5 h-5" />} label="Teacher ID" value={profile.teacherId || "Not available"} />
                <InfoRow icon={<User className="w-5 h-5" />} label="Full Name" value={profile.fullName || "Not available"} />
                <InfoRow icon={<Mail className="w-5 h-5" />} label="Email Address" value={profile.email || "Not available"} />
                <InfoRow icon={<BadgeCheck className="w-5 h-5" />} label="Role" value={profile.role || "Teacher"} />
              </div>

              {/* Phone */}
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone Number">
                {isEditing ? (
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={editedPhone}
                    onChange={(e) => setEditedPhone(normalizePhoneInput(e.target.value))}
                    maxLength={11}
                    placeholder="09XXXXXXXXX"
                    className="flex-1 outline-none bg-transparent text-white text-sm placeholder-gray-500"
                  />
                ) : (
                  <span className="text-gray-100 text-sm">{profile.phone || "Not set"}</span>
                )}
              </InfoRow>

              {/* Profile picture */}
              {isEditing && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Profile Picture</label>
                  <div
                    onClick={() => profileFileInputRef.current?.click()}
                    className="flex items-center gap-4 px-4 py-4 bg-white/5 rounded-xl border border-dashed border-white/20 hover:border-emerald-500/50 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
                      {avatarSource ? (
                        <img src={avatarSource} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium group-hover:text-emerald-300 transition-colors">
                        {profilePictureFile ? profilePictureFile.name : "Click to upload profile picture"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                    <Upload className="w-4 h-4 text-gray-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <div className="bg-gray-900/60 rounded-2xl border border-white/10 p-8 space-y-7">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-400" />
                Security Settings
              </h3>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Password</label>
                {isEditing ? (
                  <div className="flex items-center gap-4 px-5 py-4 bg-white/5 rounded-2xl border border-white/10">
                    <Lock className="w-5 h-5 text-gray-400 shrink-0" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter a new password"
                      className="flex-1 outline-none bg-transparent text-white text-base placeholder-gray-500"
                    />
                    <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-400 hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-4 bg-white/5 rounded-2xl border border-white/10">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400 text-base">Password is managed securely through Supabase Auth</span>
                  </div>
                )}
              </div>

              {/* Tips */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 space-y-3">
                <p className="text-sm font-semibold text-blue-300 uppercase tracking-wider">Security Tips</p>
                {[
                  "Use at least 8 characters with a mix of letters, numbers & symbols",
                  "Never share your password with anyone",
                  "Log out when using shared devices",
                ].map((tip) => (
                  <div key={tip} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-blue-200">{tip}</p>
                  </div>
                ))}
              </div>

              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-2xl text-base font-semibold transition-all"
                >
                  <Lock className="w-5 h-5" />
                  Change Password
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { TeacherProfile };
