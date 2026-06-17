import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Switch, StatusBar, Alert, ActivityIndicator, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../../src/constants/Colors";
import Button from "../../../src/components/common/Button";
import AppHeader from "../../../src/components/common/AppHeader";
import { supabase } from "../../../src/lib/supabase";
import { useRouter, Href } from "expo-router";
import { useMyEnrollmentsQuery } from "../../../src/hooks/query/enrollments/use-my-enrollments-query";

/**
 * Renders a standard profile navigation/action option row.
 * 
 * @param {object} props The component props.
 * @param {string} props.label The label text to show.
 * @param {() => void} props.onPress Callback function on press.
 * @param {string} [props.icon] Optional Ionicons icon name.
 * @param {React.ReactNode} [props.rightElement] Optional custom right side element.
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
 * Main Student/Teacher Profile tab screen showing academic information, 
 * enrollment status, and security/preference settings.
 */
export default function ProfileScreen() {
    const router = useRouter();

    // User & profile state
    const [displayName, setDisplayName] = useState("User");
    const [userEmail, setUserEmail] = useState("");
    const [role, setRole] = useState<"student" | "teacher">("student");
    const [userId, setUserId] = useState<string | null>(null);

    // Academic Info state
    const [isEditingAcademic, setIsEditingAcademic] = useState(false);
    const [isSavingAcademic, setIsSavingAcademic] = useState(false);
    const [displayNameEdit, setDisplayNameEdit] = useState(""); // editable name in academic section
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
        if (email === "erijiao18@gmail.com") userRole = "teacher";
        if (email === "euriqt214@gmail.com") userRole = "student";
        setRole(userRole);

        // Fetch profile row
        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, year_level, section")
            .eq("id", user.id)
            .single();

        if (profile) {
            const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
            if (fullName) {
                setDisplayName(fullName);
                setDisplayNameEdit(fullName);
            } else {
                const fallback = email.split("@")[0];
                const formatted = fallback.charAt(0).toUpperCase() + fallback.slice(1);
                setDisplayName(formatted);
                setDisplayNameEdit(formatted);
            }
            if (profile.year_level) setYearLevel(profile.year_level);
            if (profile.section) setSection(profile.section);
        } else {
            // Fallback from email
            const fallback = email.split("@")[0];
            const formatted = fallback.charAt(0).toUpperCase() + fallback.slice(1);
            setDisplayName(formatted);
            setDisplayNameEdit(formatted);
        }

        // Load notification preferences from user_metadata
        const meta = user.user_metadata || {};
        setPushEnabled(meta.push_notifications ?? false);
        setEmailEnabled(meta.email_alerts ?? false);
    };

    const handleSaveAcademic = async () => {
        if (!userId) return;
        setIsSavingAcademic(true);
        try {
            // Parse edited name into first/last
            const parts = displayNameEdit.trim().split(" ");
            const firstName = parts[0] ?? "";
            const lastName = parts.slice(1).join(" ") ?? "";

            const { error } = await supabase
                .from("profiles")
                .upsert({
                    id: userId,
                    first_name: firstName,
                    last_name: lastName,
                    year_level: yearLevel,
                    section: section,
                });

            if (error) throw error;

            // Update displayed name
            setDisplayName(displayNameEdit.trim() || displayName);
            setIsEditingAcademic(false);
            Alert.alert("Saved", "Your academic info has been updated.");
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to save.");
        } finally {
            setIsSavingAcademic(false);
        }
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
                        <Text style={styles.sectionTitle}>Current Status</Text>
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
            </View>
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
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarInitial}>
                            {displayName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.studentId}>{userEmail || "Not signed in"}</Text>
                    {role === "teacher" && (
                        <Text style={styles.program}>Senior Faculty</Text>
                    )}
                </View>

                {/* Academic Info */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {role === "teacher" ? "Professional Info" : "Academic Info"}
                        </Text>
                        <TouchableOpacity
                            onPress={isEditingAcademic ? handleSaveAcademic : () => setIsEditingAcademic(true)}
                            style={styles.editButton}
                            disabled={isSavingAcademic}
                        >
                            {isSavingAcademic ? (
                                <ActivityIndicator size="small" color={Colors.light.primary} />
                            ) : (
                                <Text style={styles.editButtonText}>
                                    {isEditingAcademic ? "Save" : "Edit"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Name field — always shown */}
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Name:</Text>
                        {isEditingAcademic ? (
                            <TextInput
                                style={styles.input}
                                value={displayNameEdit}
                                onChangeText={setDisplayNameEdit}
                                placeholder="Full name"
                                placeholderTextColor="#94A3B8"
                            />
                        ) : (
                            <Text style={styles.value}>{displayName}</Text>
                        )}
                    </View>

                    {role === "student" && (
                        <>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Year Level:</Text>
                                {isEditingAcademic ? (
                                    <Text style={[styles.value, { color: "#64748B" }]}>
                                        {resolvedYearLevel} (Managed by Administrator)
                                    </Text>
                                ) : (
                                    <Text style={styles.value}>{resolvedYearLevel}</Text>
                                )}
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
        marginBottom: 28,
        marginTop: 8,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.light.primary,
        marginBottom: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarInitial: {
        fontSize: 40,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    name: {
        fontSize: 24,
        fontWeight: "bold",
        color: Colors.light.text,
    },
    studentId: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        marginTop: 4,
    },
    program: {
        fontSize: 15,
        color: Colors.light.primary,
        fontWeight: "600",
        marginTop: 4,
    },
    section: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
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
        fontSize: 17,
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
        paddingVertical: 6,
        backgroundColor: "#EEF2FF",
        borderRadius: 16,
        minWidth: 56,
        alignItems: "center",
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.light.primary,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        paddingBottom: 10,
        minHeight: 38,
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
    input: {
        flex: 2,
        fontSize: 14,
        color: Colors.light.text,
        fontWeight: "500",
        textAlign: "right",
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.primary,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
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
        fontSize: 16,
        color: Colors.light.text,
    },
    logoutButton: {
        marginTop: 4,
        marginBottom: 16,
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
        fontSize: 16,
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
});
