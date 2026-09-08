import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, StatusBar, Alert, ActivityIndicator, Image, Modal, Pressable
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Colors from "../../../src/constants/Colors";
import Button from "../../../src/components/common/Button";
import AppHeader from "../../../src/components/common/AppHeader";
import { supabase } from "../../../src/lib/supabase";
import { useRouter, Href } from "expo-router";
import { useMyEnrollmentsQuery } from "../../../src/hooks/query/enrollments/use-my-enrollments-query";
import { readFileAsArrayBuffer } from "../../../src/utils/file-reader";
import { formatTeacherName } from "../../../src/utils/name-formatter";
import { clearLocalConversationReads } from "../../../src/data/messages/message-storage";

/**
 * Renders a standard profile navigation/action option row.
 */
const ProfileOption = ({ label, onPress, icon, rightElement }: any) => (
    <TouchableOpacity style={styles.option} onPress={onPress}>
        <View style={styles.optionLeft}>
            {icon && <Ionicons name={icon} size={20} color={Colors.light.textSecondary} style={styles.optionIcon} />}
            <Text style={styles.optionText}>{label}</Text>
        </View>
        {rightElement ?? <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />}
    </TouchableOpacity>
);

/**
 * Main Student/Teacher Profile tab screen showing avatar customization,
 * academic information, enrollment status, and security/preference settings.
 */
export default function ProfileScreen() {
    const router = useRouter();

    // User & profile state
    const [displayName, setDisplayName] = useState("User");
    const [userEmail, setUserEmail] = useState("");
    const [role, setRole] = useState<"student" | "teacher">("student");
    const [userId, setUserId] = useState<string | null>(null);

    // Avatar state
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isSavingAvatar, setIsSavingAvatar] = useState(false);
    const [showImageActionSheet, setShowImageActionSheet] = useState(false);
    const [showCropPreviewModal, setShowCropPreviewModal] = useState(false);

    // Academic Info state
    const [yearLevel, setYearLevel] = useState("3rd Year");
    const [section, setSection] = useState("A");
    
    // Enrollment query for dynamic status
    const { data: enrollments, isLoading: isLoadingEnrollments } = useMyEnrollmentsQuery();

    // Resolve dynamic year level and section from active enrollments (accepted or active)
    const activeEnrollment = enrollments?.find(
        e => e.status === 'accepted' || e.status === 'active' || e.status === 'Active'
    );
    const resolvedYearLevel = role === 'student' && activeEnrollment?.subjects?.grade_level 
        ? activeEnrollment.subjects.grade_level 
        : yearLevel;
    const resolvedSection = role === 'student' && activeEnrollment?.section 
        ? activeEnrollment.section 
        : section;

    // Notifications state (persistent via profile)
    const [pushEnabled, setPushEnabled] = useState(false);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [isSavingNotif, setIsSavingNotif] = useState(false);

    // Active sub-screen: null | 'notifications' | 'account'
    const [activeSection, setActiveSection] = useState<null | "notifications" | "account">(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const user = session.user;
        setUserId(user.id);

        const email = user.email ?? "";
        setUserEmail(email);

        // Role override
        let userRole: "student" | "teacher" = (user.user_metadata?.role as any) || "student";
        setRole(userRole);

        // Check user_metadata avatar
        const meta = user.user_metadata || {};
        if (meta.avatar_url) {
            setAvatarUrl(meta.avatar_url);
        }

        // Fetch profile row including avatar_url and suffix
        let profileRes = await supabase
            .from("profiles")
            .select("first_name, last_name, year_level, section, role, avatar_url, suffix")
            .eq("id", user.id)
            .single();

        if (profileRes.error && (profileRes.error.code === '42703' || profileRes.error.message?.includes('suffix'))) {
            profileRes = await supabase
                .from("profiles")
                .select("first_name, last_name, year_level, section, role, avatar_url")
                .eq("id", user.id)
                .single();
        }

        const profile = profileRes.data;

        if (profile) {
            if (profile.role) {
                setRole(profile.role as "student" | "teacher");
            }
            if (profile.avatar_url) {
                setAvatarUrl(profile.avatar_url);
            }
            const fullName = formatTeacherName(profile);
            if (fullName) {
                setDisplayName(fullName);
            } else {
                const fallback = email.split("@")[0];
                const formatted = fallback.charAt(0).toUpperCase() + fallback.slice(1);
                setDisplayName(formatted);
            }
            if (profile.year_level) setYearLevel(profile.year_level);
            if (profile.section) setSection(profile.section);
        } else {
            // Fallback from email
            const fallback = email.split("@")[0];
            const formatted = fallback.charAt(0).toUpperCase() + fallback.slice(1);
            setDisplayName(formatted);
        }

        // Load notification preferences from user_metadata
        setPushEnabled(meta.push_notifications ?? false);
        setEmailEnabled(meta.email_alerts ?? false);
    };

    /**
     * Launches the camera or photo library with native square cropping enabled.
     */
    const handlePickImage = async (useCamera: boolean) => {
        setShowImageActionSheet(false);
        try {
            const permission = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert(
                    "Permission Required",
                    `Please grant ${useCamera ? 'camera' : 'photo library'} permissions to upload your profile picture.`
                );
                return;
            }

            // Launch with native cropping enabled and square 1:1 aspect ratio
            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.85,
                  })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.85,
                  });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const pickedUri = result.assets[0].uri;
                setSelectedImageUri(pickedUri);
                setShowCropPreviewModal(true);
            }
        } catch (err: any) {
            console.error("Image pick error:", err);
            Alert.alert("Error", "Failed to select or crop picture.");
        }
    };

    /**
     * Uploads the cropped picture to storage and updates profile avatar_url.
     */
    const handleSaveCroppedAvatar = async () => {
        if (!userId || !selectedImageUri) return;
        setIsSavingAvatar(true);
        try {
            const bytes = await readFileAsArrayBuffer(selectedImageUri);
            const ext = selectedImageUri.split('.').pop()?.split('?')[0] || 'jpg';
            const storagePath = `profile-pictures/${userId}/${Date.now()}_avatar.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('class-materials')
                .upload(storagePath, bytes, {
                    contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('class-materials')
                .getPublicUrl(storagePath);

            if (!publicUrl) throw new Error("Failed to get public URL for profile picture.");

            // 1. Update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (profileError) throw profileError;

            // 2. Sync with auth user_metadata
            await supabase.auth.updateUser({
                data: { avatar_url: publicUrl }
            });

            setAvatarUrl(publicUrl);
            setShowCropPreviewModal(false);
            setSelectedImageUri(null);
            Alert.alert("Success", "Profile picture updated successfully!");
        } catch (err: any) {
            console.error("Save avatar error:", err);
            Alert.alert("Error", err.message || "Failed to save profile picture.");
        } finally {
            setIsSavingAvatar(false);
        }
    };

    /**
     * Removes the current profile picture and resets to default initials.
     */
    const handleRemoveAvatar = () => {
        setShowImageActionSheet(false);
        Alert.alert(
            "Remove Photo",
            "Are you sure you want to remove your profile picture?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        if (!userId) return;
                        try {
                            await supabase
                                .from('profiles')
                                .update({ avatar_url: null })
                                .eq('id', userId);

                            await supabase.auth.updateUser({
                                data: { avatar_url: null }
                            });

                            setAvatarUrl(null);
                            Alert.alert("Removed", "Profile picture has been removed.");
                        } catch (err: any) {
                            Alert.alert("Error", err.message || "Failed to remove profile picture.");
                        }
                    }
                }
            ]
        );
    };

    const handleSaveNotifications = async (push: boolean, email: boolean) => {
        setIsSavingNotif(true);
        try {
            await supabase.auth.updateUser({
                data: {
                    push_notifications: push,
                    email_alerts: email,
                },
            });
        } catch (err) {
            console.warn("Failed to save notification preferences:", err);
        } finally {
            setIsSavingNotif(false);
        }
    };

    const handleTogglePush = (value: boolean) => {
        setPushEnabled(value);
        handleSaveNotifications(value, emailEnabled);
    };

    const handleToggleEmail = (value: boolean) => {
        setEmailEnabled(value);
        handleSaveNotifications(pushEnabled, value);
    };

    const handleLogout = async () => {
        try {
            await clearLocalConversationReads(userId || undefined);
        } catch {}
        await supabase.auth.signOut();
        router.replace("/login" as Href);
    };

    // --- Inline Notifications sub-screen ---
    if (activeSection === "notifications") {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
                <AppHeader
                    title="Notifications"
                    showBack={true}
                    onBack={() => setActiveSection(null)}
                />
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notification Preferences</Text>
                        <Text style={styles.sectionSubtitle}>
                            Choose how you'd like to be notified about updates from ConnectEd.
                        </Text>

                        <View style={styles.notifRow}>
                            <View style={styles.notifLeft}>
                                <Ionicons name="notifications-outline" size={22} color={Colors.light.primary} />
                                <View style={styles.notifTextGroup}>
                                    <Text style={styles.notifLabel}>Push Notifications</Text>
                                    <Text style={styles.notifDesc}>
                                        Receive alerts for announcements, grades, and updates directly on your device.
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={pushEnabled}
                                onValueChange={handleTogglePush}
                                trackColor={{ false: "#E2E8F0", true: Colors.light.primary + "80" }}
                                thumbColor={pushEnabled ? Colors.light.primary : "#94A3B8"}
                                disabled={isSavingNotif}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.notifRow}>
                            <View style={styles.notifLeft}>
                                <Ionicons name="mail-outline" size={22} color={Colors.light.primary} />
                                <View style={styles.notifTextGroup}>
                                    <Text style={styles.notifLabel}>Email Alerts</Text>
                                    <Text style={styles.notifDesc}>
                                        Get important school announcements sent to your email address.
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={emailEnabled}
                                onValueChange={handleToggleEmail}
                                trackColor={{ false: "#E2E8F0", true: Colors.light.primary + "80" }}
                                thumbColor={emailEnabled ? Colors.light.primary : "#94A3B8"}
                                disabled={isSavingNotif}
                            />
                        </View>

                        {isSavingNotif && (
                            <View style={styles.savingRow}>
                                <ActivityIndicator size="small" color={Colors.light.primary} />
                                <Text style={styles.savingText}>Saving preferences...</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Active Channels</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusBadge, pushEnabled ? styles.statusActive : styles.statusOff]}>
                                <Ionicons
                                    name={pushEnabled ? "notifications" : "notifications-off-outline"}
                                    size={14}
                                    color={pushEnabled ? Colors.light.primary : "#94A3B8"}
                                />
                                <Text style={[styles.statusText, pushEnabled ? styles.statusTextActive : styles.statusTextOff]}>
                                    Push {pushEnabled ? "ON" : "OFF"}
                                </Text>
                            </View>
                            <View style={[styles.statusBadge, emailEnabled ? styles.statusActive : styles.statusOff]}>
                                <Ionicons
                                    name={emailEnabled ? "mail" : "mail-outline"}
                                    size={14}
                                    color={emailEnabled ? Colors.light.primary : "#94A3B8"}
                                />
                                <Text style={[styles.statusText, emailEnabled ? styles.statusTextActive : styles.statusTextOff]}>
                                    Email {emailEnabled ? "ON" : "OFF"}
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // --- Inline Account Settings sub-screen ---
    if (activeSection === "account") {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
                <AppHeader
                    title="Account Settings"
                    showBack={true}
                    onBack={() => setActiveSection(null)}
                />
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Profile Photo</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
                            <View style={[styles.avatarLarge, { width: 64, height: 64, borderRadius: 32, marginBottom: 0, marginRight: 16 }]}>
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                                ) : (
                                    <Text style={[styles.avatarInitial, { fontSize: 24 }]}>
                                        {displayName.charAt(0).toUpperCase()}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity 
                                style={styles.editButton} 
                                onPress={() => setShowImageActionSheet(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.editButtonText}>Change Photo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Security</Text>
                        <ProfileOption
                            icon="lock-closed-outline"
                            label="Change Password"
                            onPress={() => router.push("/(tabs)/profile/change-password" as any)}
                        />
                    </View>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account</Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Email</Text>
                            <Text style={styles.value}>{userEmail || "—"}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Role</Text>
                            <Text style={[styles.value, { color: Colors.light.primary }]}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                {/* Shared modals for photo editing */}
                {renderModals()}
            </View>
        );
    }

    function renderModals() {
        return (
            <>
                {/* Photo Options Action Sheet Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={showImageActionSheet}
                    onRequestClose={() => setShowImageActionSheet(false)}
                >
                    <Pressable style={styles.sheetOverlay} onPress={() => setShowImageActionSheet(false)}>
                        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle}>Profile Picture</Text>
                                <Text style={styles.sheetSubtitle}>Choose how you would like to set your profile picture</Text>
                            </View>

                            <TouchableOpacity 
                                style={styles.sheetOption} 
                                onPress={() => handlePickImage(true)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.sheetOptionIcon, { backgroundColor: '#E0F2FE' }]}>
                                    <Ionicons name="camera" size={22} color="#0284C7" />
                                </View>
                                <View style={styles.sheetOptionTextGroup}>
                                    <Text style={styles.sheetOptionLabel}>Take Photo</Text>
                                    <Text style={styles.sheetOptionDesc}>Use camera and crop to square</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.sheetOption} 
                                onPress={() => handlePickImage(false)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.sheetOptionIcon, { backgroundColor: '#DCFCE7' }]}>
                                    <Ionicons name="images" size={22} color="#16A34A" />
                                </View>
                                <View style={styles.sheetOptionTextGroup}>
                                    <Text style={styles.sheetOptionLabel}>Choose from Library</Text>
                                    <Text style={styles.sheetOptionDesc}>Pick from gallery and crop</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </TouchableOpacity>

                            {avatarUrl && (
                                <TouchableOpacity 
                                    style={styles.sheetOption} 
                                    onPress={handleRemoveAvatar}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.sheetOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                                        <Ionicons name="trash-outline" size={22} color="#DC2626" />
                                    </View>
                                    <View style={styles.sheetOptionTextGroup}>
                                        <Text style={[styles.sheetOptionLabel, { color: '#DC2626' }]}>Remove Photo</Text>
                                        <Text style={styles.sheetOptionDesc}>Revert to default initials</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity 
                                style={styles.sheetCancelBtn} 
                                onPress={() => setShowImageActionSheet(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.sheetCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Crop Preview & Confirmation Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={showCropPreviewModal}
                    onRequestClose={() => !isSavingAvatar && setShowCropPreviewModal(false)}
                >
                    <Pressable style={styles.sheetOverlay} onPress={() => !isSavingAvatar && setShowCropPreviewModal(false)}>
                        <Pressable style={styles.cropPreviewCard} onPress={(e) => e.stopPropagation()}>
                            <Text style={styles.previewModalTitle}>Preview Profile Picture</Text>
                            <Text style={styles.previewModalSubtitle}>
                                Here is your cropped photo. Press save to apply changes.
                            </Text>

                            <View style={styles.previewImageWrapper}>
                                {selectedImageUri ? (
                                    <Image source={{ uri: selectedImageUri }} style={styles.previewCroppedImage} />
                                ) : null}
                            </View>

                            <TouchableOpacity 
                                style={[styles.saveAvatarButton, isSavingAvatar && styles.saveAvatarButtonDisabled]}
                                onPress={handleSaveCroppedAvatar}
                                disabled={isSavingAvatar}
                                activeOpacity={0.8}
                            >
                                {isSavingAvatar ? (
                                    <View style={styles.loadingRow}>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.saveAvatarButtonText}>Saving picture...</Text>
                                    </View>
                                ) : (
                                    <View style={styles.loadingRow}>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.saveAvatarButtonText}>Save Profile Picture</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.recropButton}
                                onPress={() => {
                                    setShowCropPreviewModal(false);
                                    setShowImageActionSheet(true);
                                }}
                                disabled={isSavingAvatar}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="crop-outline" size={16} color={Colors.light.primary} style={{ marginRight: 6 }} />
                                <Text style={styles.recropButtonText}>Choose Another / Re-crop</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.cancelPreviewButton}
                                onPress={() => {
                                    setSelectedImageUri(null);
                                    setShowCropPreviewModal(false);
                                }}
                                disabled={isSavingAvatar}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelPreviewButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>
            </>
        );
    }

    // --- Main Profile Screen ---
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="Profile" showProfile={false} hasNotifications={true} />
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>

                {/* Avatar & name */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.avatarContainer} 
                        onPress={() => setShowImageActionSheet(true)}
                        activeOpacity={0.8}
                        accessibilityLabel="Change profile picture"
                    >
                        <View style={styles.avatarLarge}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarInitial}>
                                    {displayName.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <View style={styles.cameraBadge}>
                            <Ionicons name="camera" size={17} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setShowImageActionSheet(true)}
                        style={styles.editPhotoPrompt}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="create-outline" size={14} color={Colors.light.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.editPhotoPromptText}>Edit Profile Picture</Text>
                    </TouchableOpacity>

                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.studentId}>{userEmail || "Not signed in"}</Text>
                    {role === "teacher" && (
                        <Text style={styles.program}>Senior Faculty</Text>
                    )}
                </View>

                {/* Student / Teacher Academic Info */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {role === "teacher" ? "Faculty Info" : "Student Info"}
                        </Text>
                    </View>

                    {/* Name field — always shown */}
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Name:</Text>
                        <Text style={styles.value}>{displayName}</Text>
                    </View>

                    {role === "student" && (
                        <>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Year Level:</Text>
                                <Text style={styles.value}>{resolvedYearLevel || "—"}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Section:</Text>
                                <Text style={styles.value}>{resolvedSection || "—"}</Text>
                            </View>
                        </>
                    )}

                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Status:</Text>
                        {role === "teacher" ? (
                            <Text style={[styles.value, { color: Colors.light.success }]}>Active</Text>
                        ) : (
                            (() => {
                                if (isLoadingEnrollments) return <ActivityIndicator size="small" color={Colors.light.primary} />;
                                
                                const activeEnrollments = enrollments?.filter(e => e.status === 'accepted') || [];
                                const pendingEnrollments = enrollments?.filter(e => e.status === 'pending') || [];
                                
                                if (activeEnrollments.length > 0) {
                                    return <Text style={[styles.value, { color: Colors.light.success }]}>Enrolled</Text>;
                                } else if (pendingEnrollments.length > 0) {
                                    return <Text style={[styles.value, { color: Colors.light.warning }]}>Pending Enrollment</Text>;
                                } else {
                                    return <Text style={[styles.value, { color: Colors.light.textSecondary }]}>Not Enrolled</Text>;
                                }
                            })()
                        )}
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Settings</Text>
                    <ProfileOption
                        icon="person-outline"
                        label="Account Settings"
                        onPress={() => setActiveSection("account")}
                    />
                    <ProfileOption
                        icon="notifications-outline"
                        label="Notifications"
                        onPress={() => setActiveSection("notifications")}
                        rightElement={
                            <View style={styles.notifStatusRow}>
                                {pushEnabled && (
                                    <View style={styles.notifDot} />
                                )}
                                <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
                            </View>
                        }
                    />
                    <ProfileOption
                        icon="help-circle-outline"
                        label="Help & Support"
                        onPress={() => Alert.alert("Help & Support", "For assistance, please contact your school administrator.")}
                    />
                    <ProfileOption
                        icon="shield-checkmark-outline"
                        label="Privacy Policy"
                        onPress={() => Alert.alert("Privacy Policy", "Your data is protected by the school's data privacy act compliance policy.")}
                    />
                </View>

                <Button
                    title="Logout"
                    variant="outline"
                    onPress={handleLogout}
                    style={styles.logoutButton}
                />
            </ScrollView>

            {/* Shared Modals for action sheet & crop preview */}
            {renderModals()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    scrollContainer: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        alignItems: "center",
        marginBottom: 24,
        marginTop: 6,
    },
    avatarContainer: {
        position: 'relative',
        width: 104,
        height: 104,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.light.primary,
        justifyContent: "center",
        alignItems: "center",
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    avatarInitial: {
        fontSize: 40,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: Colors.light.primary,
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    editPhotoPrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 8,
        paddingVertical: 5,
        paddingHorizontal: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    editPhotoPromptText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    name: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.light.text,
        textAlign: 'center',
    },
    studentId: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    program: {
        fontSize: 14,
        color: Colors.light.primary,
        fontWeight: "600",
        marginTop: 4,
        textAlign: 'center',
    },
    section: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.light.text,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        marginBottom: 20,
        lineHeight: 20,
    },
    editButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#F0FDF4",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DCFCE7',
        alignItems: "center",
    },
    editButtonText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.light.primary,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        paddingBottom: 10,
        minHeight: 36,
    },
    label: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        flex: 1,
    },
    value: {
        fontSize: 14,
        color: Colors.light.text,
        fontWeight: "500",
        flex: 2,
        textAlign: "right",
    },
    option: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    optionLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    optionIcon: {
        marginRight: 12,
    },
    optionText: {
        fontSize: 15,
        color: Colors.light.text,
    },
    logoutButton: {
        marginTop: 8,
        marginBottom: 20,
    },
    // Notifications
    notifStatusRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    notifDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.primary,
        marginRight: 8,
    },
    notifRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingVertical: 16,
    },
    notifLeft: {
        flexDirection: "row",
        alignItems: "flex-start",
        flex: 1,
        marginRight: 16,
    },
    notifTextGroup: {
        marginLeft: 12,
        flex: 1,
    },
    notifLabel: {
        fontSize: 15,
        color: Colors.light.text,
        fontWeight: "600",
        marginBottom: 4,
    },
    notifDesc: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        lineHeight: 18,
    },
    divider: {
        height: 1,
        backgroundColor: "#F1F5F9",
    },
    savingRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    savingText: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        marginLeft: 8,
    },
    statusRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    statusActive: {
        backgroundColor: Colors.light.primary + "15",
    },
    statusOff: {
        backgroundColor: "#F1F5F9",
    },
    statusText: {
        fontSize: 13,
        fontWeight: "600",
    },
    statusTextActive: {
        color: Colors.light.primary,
    },
    statusTextOff: {
        color: "#94A3B8",
    },

    // Bottom Sheet / Action Sheet Styles
    sheetOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    sheetCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    sheetHeader: {
        marginBottom: 16,
        alignItems: 'center',
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.light.text,
        marginBottom: 4,
    },
    sheetSubtitle: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        textAlign: 'center',
    },
    sheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    sheetOptionIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    sheetOptionTextGroup: {
        flex: 1,
    },
    sheetOptionLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.light.text,
    },
    sheetOptionDesc: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        marginTop: 2,
    },
    sheetCancelBtn: {
        marginTop: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: "#F1F5F9",
        alignItems: 'center',
    },
    sheetCancelBtnText: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.light.textSecondary,
    },

    // Crop Preview Modal Styles
    cropPreviewCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 10,
    },
    previewModalTitle: {
        fontSize: 19,
        fontWeight: "700",
        color: Colors.light.text,
        marginBottom: 6,
        textAlign: 'center',
    },
    previewModalSubtitle: {
        fontSize: 13,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 18,
    },
    previewImageWrapper: {
        width: 150,
        height: 150,
        borderRadius: 75,
        overflow: 'hidden',
        borderWidth: 3.5,
        borderColor: Colors.light.primary,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewCroppedImage: {
        width: 150,
        height: 150,
        borderRadius: 75,
    },
    saveAvatarButton: {
        width: '100%',
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    saveAvatarButtonDisabled: {
        opacity: 0.7,
    },
    saveAvatarButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recropButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        marginBottom: 4,
    },
    recropButtonText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.light.primary,
    },
    cancelPreviewButton: {
        paddingVertical: 8,
    },
    cancelPreviewButtonText: {
        fontSize: 14,
        color: Colors.light.textSecondary,
    },
});
