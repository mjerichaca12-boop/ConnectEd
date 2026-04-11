import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { LoadingScreen } from "@/app/components/LoadingScreen";
import { supabase } from "@/app/lib/supabaseClient";
import { buildSupabaseErrorMessage, sanitizeFileName } from "@/app/lib/teacherHelpers";
import { Bell, User, Mail, Phone, Edit, Save, X, Eye, EyeOff, Lock, Upload } from "lucide-react";

const STORAGE_BUCKET = "class-materials";
const PHONE_ALLOWED_PATTERN = /^[0-9+\-()\s]*$/;

const emptyProfile = {
  teacherId: "",
  fullName: "",
  email: "",
  phone: "",
  role: "Teacher",
  status: "Active",
  avatarUrl: ""
};

const normalizePhoneInput = (value) => String(value ?? "").replace(/[^0-9+\-()\s]/g, "");
const countPhoneDigits = (value) => (String(value ?? "").match(/\d/g) || []).length;
const isValidPhoneNumber = (value) => {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized) && PHONE_ALLOWED_PATTERN.test(normalized) && countPhoneDigits(normalized) >= 10;
};
const joinNameParts = (...parts) => parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" ").trim();

const getFallbackCurrentUser = () => {
  try {
    const stored = localStorage.getItem("currentUser");
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const formatDisplayName = (profileRow, authUser, fallbackUser) => {
  const profileName = joinNameParts(profileRow?.first_name, profileRow?.middle_name, profileRow?.last_name);
  if (profileName) return profileName;

  const fallbackNames = [
    profileRow?.full_name,
    profileRow?.display_name,
    profileRow?.name,
    authUser?.user_metadata?.full_name,
    authUser?.user_metadata?.name,
    authUser?.user_metadata?.given_name && authUser?.user_metadata?.family_name
      ? joinNameParts(authUser.user_metadata.given_name, authUser.user_metadata.family_name)
      : "",
    fallbackUser?.name
  ];

  for (const candidate of fallbackNames) {
    const normalized = String(candidate ?? "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return String(authUser?.email || fallbackUser?.email || "Teacher").split("@")[0] || "Teacher";
};

const getAuthAvatarUrl = (authUser) => {
  const metadata = authUser?.user_metadata || {};
  return String(metadata.avatar_url || metadata.picture || metadata.picture_url || metadata.avatar || "").trim();
};

const makeTeacherProfileState = (profileRow, authUser, fallbackUser) => ({
  teacherId: String(profileRow?.id || authUser?.id || fallbackUser?.id || "").trim(),
  fullName: formatDisplayName(profileRow, authUser, fallbackUser),
  email: String(profileRow?.email || authUser?.email || fallbackUser?.email || "").trim(),
  phone: String(profileRow?.phone || profileRow?.contact_number || fallbackUser?.phone || fallbackUser?.contactNumber || "").trim(),
  role: String(profileRow?.role || fallbackUser?.role || "Teacher").trim() || "Teacher",
  status: String(profileRow?.status || fallbackUser?.status || "Active").trim() || "Active",
  avatarUrl: String(profileRow?.avatar_url || getAuthAvatarUrl(authUser) || fallbackUser?.avatarUrl || "").trim(),
  rawProfile: profileRow || null
});

const getProfilePicturePath = (teacherId, fileName) =>
  `teacher-profile-pictures/${String(teacherId || "teacher")}/${Date.now()}-${sanitizeFileName(fileName)}`;

const extractStoragePathFromPublicUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";

  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const index = value.indexOf(marker);
  if (index === -1) return "";

  return decodeURIComponent(value.slice(index + marker.length));
};

const collectChangedFields = ({ phoneChanged, passwordChanged, pictureChanged }) => {
  const changes = [];
  if (phoneChanged) changes.push("phone number");
  if (passwordChanged) changes.push("password");
  if (pictureChanged) changes.push("profile picture");
  return changes;
};

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

  const syncStoredCurrentUser = (nextProfile) => {
    try {
      const currentUser = getFallbackCurrentUser();
      if (!currentUser) return;

      const nextUser = {
        ...currentUser,
        id: nextProfile.teacherId || currentUser.id,
        name: nextProfile.fullName || currentUser.name,
        email: nextProfile.email || currentUser.email,
        role: nextProfile.role || currentUser.role,
        status: nextProfile.status || currentUser.status,
        phone: nextProfile.phone || currentUser.phone || currentUser.contactNumber,
        avatarUrl: nextProfile.avatarUrl || currentUser.avatarUrl
      };

      localStorage.setItem("currentUser", JSON.stringify(nextUser));
    } catch {
      // Keep the page functional if localStorage sync fails.
    }
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

    if (!authUser && (!fallbackUser || fallbackUser.role !== "teacher")) {
      navigate("/login");
      return;
    }

    let profileRow = null;
    const candidateIds = [authUser?.id, fallbackUser?.id].map((value) => String(value || "").trim()).filter(Boolean);
    const candidateEmails = [authUser?.email, fallbackUser?.email].map((value) => String(value || "").trim()).filter(Boolean);

    for (const candidateId of candidateIds) {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", candidateId).eq("role", "teacher").maybeSingle();
      if (error) {
        console.error("Failed to load teacher profile by id:", error);
      }
      if (data) {
        profileRow = data;
        break;
      }
    }

    if (!profileRow) {
      for (const candidateEmail of candidateEmails) {
        const { data, error } = await supabase.from("profiles").select("*").eq("email", candidateEmail).eq("role", "teacher").maybeSingle();
        if (error) {
          console.error("Failed to load teacher profile by email:", error);
        }
        if (data) {
          profileRow = data;
          break;
        }
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

    const initializeProfile = async () => {
      const authResult = await supabase?.auth.getUser?.() || { data: { user: null } };
      const authUser = authResult.data?.user || null;
      const fallbackUser = getFallbackCurrentUser();

      if (!authUser && (!fallbackUser || fallbackUser.role !== "teacher")) {
        navigate("/login");
        return;
      }

      if (!isMounted) return;
      await loadTeacherProfile(authUser);
    };

    initializeProfile().catch((error) => {
      console.error("Failed to initialize teacher profile:", error);
      if (isMounted) {
        setErrorMessage("Unable to load profile data.");
        setLoading(false);
      }
    });

    const authSubscription = supabase?.auth.onAuthStateChange?.((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        navigate("/login");
        return;
      }
      loadTeacherProfile(session.user).catch((error) => {
        console.error("Failed to refresh teacher profile:", error);
      });
    });

    return () => {
      isMounted = false;
      authSubscription?.data?.subscription?.unsubscribe?.();
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePicturePreview);
      }
    };
  }, [profilePicturePreview]);

  useEffect(() => {
    if (!successMessage && !errorMessage) return;
    const timer = window.setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage, errorMessage]);

  const handleLogout = () => {
    if (supabase) {
      void supabase.auth.signOut();
    }
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

  const handlePhoneChange = (event) => {
    setEditedPhone(normalizePhoneInput(event.target.value));
  };

  const handleProfilePictureClick = () => {
    profileFileInputRef.current?.click();
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setProfilePictureFile(null);
      setProfilePicturePreview(profile.avatarUrl || "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (profilePicturePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(profilePicturePreview);
    }

    setProfilePictureFile(file);
    setProfilePicturePreview(URL.createObjectURL(file));
  };

  const notifyAdminProfileChange = async (changedFields, nextProfile) => {
    if (!supabase || changedFields.length === 0) return;

    const payload = {
      title: "Teacher Profile Updated",
      content: `Teacher ${nextProfile.fullName} updated their profile information: ${changedFields.join(", ")}.`,
      target_audience: "Teacher",
      priority: "Low",
      author: nextProfile.fullName,
      created_by: nextProfile.teacherId || null,
      created_by_name: nextProfile.fullName
    };

    const { error } = await supabase.from("announcements").insert(payload);
    if (error) {
      console.error("Failed to create admin profile notification:", error);
    }
  };

  const handleSave = async () => {
    if (!supabase) {
      setErrorMessage("Unable to connect to the server.");
      return;
    }

    const trimmedPhone = editedPhone.trim();
    const hasPhoneChange = trimmedPhone !== profile.phone;
    const hasPasswordChange = Boolean(newPassword.trim());
    const hasPictureChange = Boolean(profilePictureFile);

    if (!hasPhoneChange && !hasPasswordChange && !hasPictureChange) {
      setIsEditing(false);
      return;
    }

    if (!isValidPhoneNumber(trimmedPhone)) {
      setErrorMessage("Enter a valid phone number.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const changes = collectChangedFields({
      phoneChanged: hasPhoneChange,
      passwordChanged: hasPasswordChange,
      pictureChanged: hasPictureChange
    });

    const authResult = await supabase.auth.getUser();
    const authUser = authResult.data?.user || null;

    let uploadedAvatarPath = "";
    let nextAvatarUrl = profile.avatarUrl;
    let previousAvatarPath = extractStoragePathFromPublicUrl(profile.avatarUrl);

    try {
      if (hasPictureChange && profilePictureFile) {
        const filePath = getProfilePicturePath(profile.teacherId || authUser?.id || "teacher", profilePictureFile.name);
        const uploadResult = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, profilePictureFile, {
          upsert: true,
          contentType: profilePictureFile.type
        });

        if (uploadResult.error) {
          throw uploadResult.error;
        }

        uploadedAvatarPath = uploadResult.data?.path || filePath;
        const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploadedAvatarPath);
        nextAvatarUrl = publicUrlData?.publicUrl || "";
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          phone: trimmedPhone,
          avatar_url: nextAvatarUrl || null
        })
        .eq("id", profile.teacherId || authUser?.id)
        .eq("role", "teacher");

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      if (hasPasswordChange) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword.trim() });
        if (passwordError) {
          throw passwordError;
        }
      }

      const nextProfile = {
        ...profile,
        phone: trimmedPhone,
        avatarUrl: nextAvatarUrl || profile.avatarUrl
      };

      setProfile(nextProfile);
      setTeacherName(nextProfile.fullName);
      setEditedPhone(nextProfile.phone);
      setNewPassword("");
      setProfilePictureFile(null);
      setProfilePicturePreview(nextProfile.avatarUrl || "");
      setIsEditing(false);
      syncStoredCurrentUser(nextProfile);

      if (profileFileInputRef.current) {
        profileFileInputRef.current.value = "";
      }

      if (hasPictureChange && previousAvatarPath) {
        const { error: deleteError } = await supabase.storage.from(STORAGE_BUCKET).remove([previousAvatarPath]);
        if (deleteError) {
          console.error("Failed to delete previous profile image:", deleteError);
        }
      }

      await notifyAdminProfileChange(changes, nextProfile);

      setSuccessMessage("Profile updated successfully.");
    } catch (error) {
      console.error("Failed to update teacher profile:", error);

      if (uploadedAvatarPath && hasPictureChange) {
        const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([uploadedAvatarPath]);
        if (cleanupError) {
          console.error("Failed to roll back uploaded avatar:", cleanupError);
        }
      }

      setErrorMessage(buildSupabaseErrorMessage("Unable to update profile", error));
    } finally {
      setIsSaving(false);
    }
  };

  const avatarSource = profilePicturePreview || profile.avatarUrl;

  if (loading) {
    return <LoadingScreen message="Loading profile..." />;
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
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-300 text-sm">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
              {errorMessage}
            </div>
          )}

          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30 overflow-hidden shrink-0">
                {avatarSource ? (
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${avatarSource})` }}
                    aria-label="Profile picture"
                  />
                ) : (
                  <span className="text-4xl font-bold">{profile.fullName.charAt(0) || "T"}</span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile.fullName}</h1>
                <p className="text-emerald-50 mb-1">{profile.teacherId || "Teacher Profile"}</p>
                <p className="text-emerald-100">{profile.role}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/60 rounded-xl border border-white/10 shadow-sm">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Personal Information</h3>
              {!isEditing ? <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                  <Edit className="w-4 h-4" />
                  Edit
                </button> : <div className="flex gap-2">
                  <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:bg-white/5 rounded-lg">
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed">
                    <Save className="w-4 h-4" />
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>}
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Teacher ID</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.teacherId || "Not available"}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.fullName || "Not available"}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.email || "Not available"}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.role || "Teacher"}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white">{profile.status || "Active"}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                {isEditing ? <div className="flex items-center gap-3 px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={editedPhone}
                      onChange={handlePhoneChange}
                      className="flex-1 outline-none bg-transparent"
                    />
                  </div> : <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-white">{profile.phone || "Not available"}</span>
                  </div>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Profile Picture</label>
                {isEditing ? <div className="space-y-3 px-4 py-3 bg-black/20 rounded-lg border border-white/20">
                    <div className="flex items-center gap-3 text-white">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <button type="button" onClick={handleProfilePictureClick} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                        Choose image
                      </button>
                      <span className="text-sm text-gray-400 truncate">
                        {profilePictureFile?.name || "No new image selected"}
                      </span>
                    </div>
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                  </div> : <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="text-white">{profile.avatarUrl ? "Profile photo uploaded" : "No profile photo uploaded"}</span>
                  </div>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                {isEditing ? <div className="flex items-center gap-3 px-4 py-3 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter a new password"
                      className="flex-1 outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div> : <div className="flex items-center gap-3 px-4 py-3 bg-black/20 rounded-lg border border-white/10">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <span className="text-white">Password managed securely through sign-in</span>
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
