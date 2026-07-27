import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase } from "@/app/lib/supabaseClient";
import { buildSupabaseErrorMessage, isColumnMissingError, sanitizeFileName } from "@/app/lib/teacherHelpers";
import {
  User, Mail, Phone, Edit3, Save, X, Eye, EyeOff, Lock, Upload,
  Shield, BadgeCheck, Camera, CheckCircle, AlertTriangle, Key, Activity, Clock, Compass
} from "lucide-react";
import { useTeacherTour } from "@/app/context/TeacherTourContext";

// Constants and helpers
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
  authUser: authUser || null,
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

function calculatePasswordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length > 7) score += 1;
  if (password.match(/[A-Z]/)) score += 1;
  if (password.match(/[0-9]/)) score += 1;
  if (password.match(/[^A-Za-z0-9]/)) score += 1;
  return score;
}

const PasswordStrengthMeter = ({ strength }) => {
  const colors = ["bg-gray-200", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return (
    <div className="mt-3">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div key={level} className={`flex-1 rounded-full ${strength >= level ? colors[strength] : "bg-gray-200"}`} />
        ))}
      </div>
      {strength > 0 && <p className="text-xs text-gray-700 mt-1.5 font-bold">{labels[strength]} Password</p>}
    </div>
  );
};

/* ─── Info Row ───────────────────────────────────────────────────── */
function InfoRow({ icon, label, value, children }) {
  return (
    <div className="group flex flex-col">
      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        {label}
      </label>
      <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors flex-1 flex items-center shadow-sm">
        {children || <span className="text-gray-900 font-bold text-base">{value || "Not available"}</span>}
      </div>
    </div>
  );
}

function TeacherProfile() {
  const navigate = useNavigate();
  const { restartTour } = useTeacherTour();
  const profileFileInputRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [editedPhone, setEditedPhone] = useState("");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState("");
  const [activeSection, setActiveSection] = useState("profile");

  const syncStoredCurrentUser = (nextProfile) => {
    try {
      const currentUser = getFallbackCurrentUser();
      if (!currentUser) return;
      localStorage.setItem("currentUser", JSON.stringify({
        ...currentUser,
        id: nextProfile.teacherId || currentUser.id,
        name: nextProfile.fullName || currentUser.name,
        first_name: nextProfile.rawProfile?.first_name || currentUser.first_name || "",
        last_name: nextProfile.rawProfile?.last_name || currentUser.last_name || "",
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
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", email)
          .eq("role", "teacher")
          .order("is_verified", { ascending: false })
          .limit(1)
          .maybeSingle();
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
      const fallbackUser = getFallbackCurrentUser();
      if (!session?.user && !fallbackUser) { navigate("/login"); return; }
      if (session?.user) loadTeacherProfile(session.user).catch(console.error);
    });
    return () => { isMounted = false; sub?.data?.subscription?.unsubscribe?.(); };
  }, [navigate]);

  useEffect(() => {
    return () => { if (profilePicturePreview?.startsWith("blob:")) URL.revokeObjectURL(profilePicturePreview); };
  }, [profilePicturePreview]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(() => { setErrorMessage(""); }, 4000);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  const handleLogout = () => {
    if (supabase) void supabase.auth.signOut();
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedPhone(profile.phone);
    setNewPassword("");
    setConfirmPassword("");
    setProfilePictureFile(null);
    setProfilePicturePreview(profile.avatarUrl || "");
    setErrorMessage("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedPhone(profile.phone);
    setNewPassword("");
    setConfirmPassword("");
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
    if (hasPasswordChange && newPassword !== confirmPassword) { setErrorMessage("Passwords do not match."); return; }
    if (hasPasswordChange && newPassword.length < 8) { setErrorMessage("Password must be at least 8 characters long."); return; }

    setIsSaving(true); setErrorMessage("");
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
      if (hasPictureChange) updatePayload.avatar_url = nextAvatarUrl || null;
      if (profile.role !== "teacher") throw new Error("Only teacher profiles can be updated.");

      let { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", profile.teacherId || authUser?.id);

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
          .eq("id", profile.teacherId || authUser?.id);

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
      setConfirmPassword("");
      setProfilePictureFile(null);
      setProfilePicturePreview(nextProfile.avatarUrl || "");
      setIsEditing(false);
      syncStoredCurrentUser(nextProfile);
      if (profileFileInputRef.current) profileFileInputRef.current.value = "";
      if (hasPictureChange && previousAvatarPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([previousAvatarPath]).catch(console.error);
      }
      toast.success(
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
  
  const formatDate = (isoStr) => isoStr ? new Date(isoStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";
  const formatTime = (isoStr) => isoStr ? new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  const lastLogin = profile.authUser?.last_sign_in_at;
  const lastPasswordChange = profile.authUser?.updated_at;

  if (loading) return <LoadingScreen message="Loading profile..." />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide lg:pl-64">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Teacher Profile</h2>
            {!isEditing ? (
              <button onClick={handleEdit} className="flex items-center gap-2 px-5 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl transition-all text-sm font-bold shadow-sm">
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={handleCancel} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all text-sm font-bold">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 max-w-6xl mx-auto space-y-8">
          {/* Alert messages */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-red-800 text-sm font-bold">{errorMessage}</p>
            </div>
          )}

          {/* Profile Hero Card */}
          <div data-tour="teacher-profile-card" className="relative rounded-3xl overflow-hidden shadow-sm border border-gray-200">
            <div className="h-44 bg-gradient-to-r from-green-700 via-teal-700 to-cyan-800 relative">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            </div>
            <div className="bg-white px-8 pb-8 pt-0 flex flex-col md:flex-row items-center md:items-end gap-6 relative">
              <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-gray-100 flex items-center justify-center shrink-0 shadow-lg -mt-16 z-10">
                {avatarSource ? (
                  <img src={avatarSource} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-gray-400">{initials}</span>
                )}
              </div>
              <div className="flex-1 text-center md:text-left pt-6 md:pt-5 pb-2">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{profile.fullName || "Teacher"}</h1>
                <p className="text-gray-700 font-bold mt-1 text-base">{profile.email}</p>
                <div className="flex items-center justify-center md:justify-start gap-3 mt-4 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-100 border border-green-200 text-green-800 rounded-full text-xs font-extrabold uppercase tracking-wide">
                    <BadgeCheck className="w-4 h-4" />
                    {profile.role}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${profile.status === "Active" ? "bg-blue-100 border-blue-200 text-blue-800" : "bg-gray-100 border-gray-200 text-gray-800"}`}>
                    <div className={`w-2 h-2 rounded-full ${profile.status === "Active" ? "bg-blue-600 animate-pulse" : "bg-gray-500"}`} />
                    {profile.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div data-tour="teacher-profile-security-tab" className="flex gap-2 bg-gray-100 rounded-2xl p-2 w-max border border-gray-200">
            {[
              { key: "profile", label: "Personal Info", icon: <User className="w-4 h-4" /> },
              { key: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-extrabold transition-all ${activeSection === key ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"}`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Personal Info Section */}
          {activeSection === "profile" && (
            <div data-tour="teacher-profile-personal-info" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/80">
                <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-3">
                  <User className="w-6 h-6 text-green-600" />
                  Personal Information
                </h3>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  {/* Left: Info Grid */}
                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <InfoRow icon={<User className="w-5 h-5 text-gray-500" />} label="Full Name" value={profile.fullName} />
                    <InfoRow icon={<Mail className="w-5 h-5 text-gray-500" />} label="Email Address" value={profile.email} />
                    <InfoRow icon={<BadgeCheck className="w-5 h-5 text-gray-500" />} label="Role" value={profile.role} />
                    <InfoRow icon={<Phone className="w-5 h-5 text-gray-500" />} label="Phone Number">
                      {isEditing ? (
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={editedPhone}
                          onChange={(e) => setEditedPhone(normalizePhoneInput(e.target.value))}
                          maxLength={11}
                          placeholder="09XXXXXXXXX"
                          className="flex-1 outline-none bg-transparent text-gray-900 font-bold text-base placeholder-gray-400 w-full"
                        />
                      ) : (
                        <span className="text-gray-900 font-bold text-base">{profile.phone || "Not set"}</span>
                      )}
                    </InfoRow>
                  </div>
                  
                  {/* Right: Profile Picture Upload */}
                  {isEditing && (
                    <div className="flex flex-col">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-gray-500" />
                        Profile Picture
                      </label>
                      <div 
                        onClick={() => profileFileInputRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-green-50 hover:border-green-400 transition-colors cursor-pointer flex flex-col items-center justify-center p-8 group text-center"
                      >
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-5 shadow-sm border-4 border-white flex items-center justify-center group-hover:border-green-100 transition-colors">
                          {avatarSource ? (
                            <img src={avatarSource} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-8 h-8 text-gray-400 group-hover:text-green-600" />
                          )}
                        </div>
                        <p className="text-gray-900 font-extrabold mb-1.5 group-hover:text-green-700 text-lg">Change Photo</p>
                        <p className="text-sm text-gray-600 font-medium">PNG, JPG, WEBP (Max 5MB)</p>
                      </div>
                      <input ref={profileFileInputRef} type="file" accept="image/*" onChange={handleProfilePictureChange} className="hidden" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* Security Information Card */}
              <div className="xl:col-span-1 space-y-6">
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/80">
                    <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2.5">
                      <Activity className="w-5 h-5 text-green-600" />
                      Account Security
                    </h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Onboarding Tour Card */}
                    <div className="p-4 rounded-2xl bg-green-50 border border-green-200/80 space-y-3">
                      <div className="flex items-center gap-2.5 text-green-900 font-bold text-sm">
                        <Compass className="w-5 h-5 text-green-600 shrink-0" />
                        <span>Teacher Guided Onboarding</span>
                      </div>
                      <p className="text-xs text-green-800 leading-relaxed font-medium">
                        Need a refresher on managing classes, recording grades, or using the AI assistant? Restart the interactive onboarding tour.
                      </p>
                      <button
                        type="button"
                        onClick={() => restartTour(navigate)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <Compass className="w-4 h-4" />
                        <span>Restart Guided Tour</span>
                      </button>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Status</p>
                        <p className="text-base font-extrabold text-gray-900">{profile.status === 'Active' ? '🟢 Active Account' : '⚪ Inactive'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 shrink-0">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Last Password Change</p>
                        <p className="text-base font-extrabold text-gray-900">{lastPasswordChange ? formatDate(lastPasswordChange) : "Unknown"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-orange-700 shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Last Login</p>
                        <p className="text-base font-extrabold text-gray-900">{lastLogin ? `${formatDate(lastLogin)} at ${formatTime(lastLogin)}` : "Unknown"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
                  <h4 className="text-sm font-extrabold text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Security Tips
                  </h4>
                  <ul className="space-y-4">
                    {[
                      "Use at least 8 characters with a mix of letters, numbers & symbols",
                      "Never share your password with anyone",
                      "Log out when using shared devices",
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-bold text-blue-900 leading-snug">
                        <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="xl:col-span-2">
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden h-full">
                  <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/80">
                    <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-3">
                      <Lock className="w-6 h-6 text-green-600" />
                      Change Password
                    </h3>
                  </div>
                  <div className="p-8">
                    {isEditing ? (
                      <div className="max-w-xl space-y-8">
                        <div>
                          <label className="block text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3">New Password</label>
                          <div className="flex items-center gap-4 px-5 py-4 bg-gray-50 rounded-2xl border border-gray-300 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200 transition-all shadow-sm">
                            <Lock className="w-5 h-5 text-gray-500 shrink-0" />
                            <input
                              type={showPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter a strong password"
                              className="flex-1 outline-none bg-transparent text-gray-900 font-bold placeholder-gray-400 w-full text-base"
                            />
                            <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-500 hover:text-gray-900 transition-colors shrink-0 bg-gray-200 hover:bg-gray-300 p-1.5 rounded-lg">
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                          {newPassword && <PasswordStrengthMeter strength={calculatePasswordStrength(newPassword)} />}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-3">Confirm New Password</label>
                          <div className="flex items-center gap-4 px-5 py-4 bg-gray-50 rounded-2xl border border-gray-300 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200 transition-all shadow-sm">
                            <Lock className="w-5 h-5 text-gray-500 shrink-0" />
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm your password"
                              className="flex-1 outline-none bg-transparent text-gray-900 font-bold placeholder-gray-400 w-full text-base"
                            />
                            <button type="button" onClick={() => setShowConfirmPassword((p) => !p)} className="text-gray-500 hover:text-gray-900 transition-colors shrink-0 bg-gray-200 hover:bg-gray-300 p-1.5 rounded-lg">
                              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 border border-gray-200 shadow-sm">
                          <Shield className="w-10 h-10 text-gray-400" />
                        </div>
                        <h4 className="text-2xl font-extrabold text-gray-900 mb-3">Password Protected</h4>
                        <p className="text-gray-600 max-w-md font-semibold text-base leading-relaxed">Your account is secured. To update your password or make changes, click the <span className="font-bold text-gray-900">"Edit Profile"</span> button at the top right of this page.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { TeacherProfile };
