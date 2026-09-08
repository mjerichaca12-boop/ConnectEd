import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../src/constants/Colors";
import AppHeader from "../src/components/common/AppHeader";
import { useSearchableProfilesQuery } from "../src/hooks/query/profiles/use-searchable-profiles-query";
import { supabase } from "../src/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { matchesSearchQuery } from "../src/data/profiles/search-profiles-matcher";
import { formatGradeLevel, formatRoleLabel } from "../src/data/profiles/get-all-searchable-profiles";

export default function NewGroupScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [groupName, setGroupName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const { data: profiles = [], isLoading } = useSearchableProfilesQuery();

    const toggleUser = (userId: string) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    // Filter profiles by unique ID and smart search query
    const seenIds = new Set<string>();
    const filteredProfiles = (Array.isArray(profiles) ? profiles : []).filter(p => {
        if (!p || !p.id || seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return matchesSearchQuery(p, searchQuery);
    });

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert("Error", "Please enter a group name.");
            return;
        }
        if (selectedUsers.length < 2) {
            Alert.alert("Error", "A group must have at least 3 members (select at least 2 people).");
            return;
        }

        setIsCreating(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) throw new Error("Not authenticated");

            const conversationId = "group_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);

            // 1. Create Room
            const { error: roomError } = await supabase
                .from('groupchats')
                .insert({
                    id: conversationId,
                    name: groupName.trim(),
                    created_by: userData.user.id,
                    is_group: true
                });

            if (roomError) throw roomError;

            // 2. Add Members
            const members = [
                { conversation_id: conversationId, profile_id: userData.user.id },
                ...selectedUsers.map(userId => ({ conversation_id: conversationId, profile_id: userId }))
            ];

            const { error: membersError } = await supabase
                .from('conversation_participants')
                .insert(members);

            if (membersError) throw membersError;

            // 3. Send initial message
            const { error: msgError } = await supabase
                .from('messages')
                .insert({
                    sender_id: userData.user.id,
                    conversation_id: conversationId,
                    content: `Group "${groupName}" created`,
                    message_text: `Group "${groupName}" created`
                });

            if (msgError) throw msgError;

            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
            router.replace({
                pathname: "/conversation/[id]",
                params: { id: conversationId, name: groupName, isRoom: 'true' }
            });
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <View style={styles.container}>
            <AppHeader title="New Group Chat" showBack={true} />
            
            <View style={styles.inputSection}>
                <TextInput
                    style={styles.nameInput}
                    placeholder="Enter Group Name"
                    placeholderTextColor="#94A3B8"
                    value={groupName}
                    onChangeText={setGroupName}
                />
            </View>

            {/* Member Search Bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, grade level, role..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.listSection}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Select Members</Text>
                    <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>{selectedUsers.length} selected</Text>
                    </View>
                </View>
                {isLoading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={Colors.light.primary} />
                ) : (
                    <FlatList
                        data={filteredProfiles}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyText}>
                                    {searchQuery ? "No members match your search." : "No members found."}
                                </Text>
                            </View>
                        )}
                        renderItem={({ item }) => {
                            const isSelected = selectedUsers.includes(item.id);
                            const roleLabel = item.role_label || formatRoleLabel(item.role);
                            const grade = item.grade_level || formatGradeLevel(item.year_level);
                            const isAdmin = roleLabel === 'Admin';
                            const isTeacher = roleLabel === 'Teacher';
                            const isStudent = roleLabel === 'Student';

                            const avatarBg = isSelected 
                                ? Colors.light.primary 
                                : isAdmin 
                                    ? '#F3E8FF' 
                                    : isTeacher 
                                        ? '#E0F2FE' 
                                        : '#F1F5F9';
                            const avatarIconColor = isSelected 
                                ? '#FFF' 
                                : isAdmin 
                                    ? '#7C3AED' 
                                    : isTeacher 
                                        ? '#0284C7' 
                                        : '#64748B';
                            const avatarIconName = isSelected
                                ? 'checkmark'
                                : isAdmin
                                    ? 'shield-checkmark'
                                    : isTeacher
                                        ? 'school'
                                        : 'person';

                            return (
                                <TouchableOpacity 
                                    style={[styles.userItem, isSelected && styles.selectedUserItem]} 
                                    onPress={() => toggleUser(item.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                                        <Ionicons 
                                            name={avatarIconName as any} 
                                            size={20} 
                                            color={avatarIconColor} 
                                        />
                                    </View>
                                    <View style={styles.userInfo}>
                                        <Text style={styles.userName} numberOfLines={1}>{item.full_name}</Text>
                                        <View style={styles.metaRow}>
                                            {isStudent && grade ? (
                                                <View style={styles.gradeBadge}>
                                                    <Ionicons name="school-outline" size={12} color="#4338CA" style={{ marginRight: 3 }} />
                                                    <Text style={styles.gradeBadgeText}>{grade}</Text>
                                                </View>
                                            ) : null}
                                            <View style={[
                                                styles.roleBadge,
                                                isAdmin ? styles.roleBadgeAdmin : isTeacher ? styles.roleBadgeTeacher : styles.roleBadgeStudent
                                            ]}>
                                                <Text style={[
                                                    styles.roleBadgeText,
                                                    isAdmin ? styles.roleTextAdmin : isTeacher ? styles.roleTextTeacher : styles.roleTextStudent
                                                ]}>
                                                    {roleLabel}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Ionicons 
                                        name={isSelected ? "checkbox" : "square-outline"} 
                                        size={22} 
                                        color={isSelected ? Colors.light.primary : "#94A3B8"} 
                                    />
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>

            <TouchableOpacity 
                style={[styles.createButton, (isCreating || !groupName.trim() || selectedUsers.length < 2) && styles.disabledButton]}
                onPress={handleCreateGroup}
                disabled={isCreating || !groupName.trim() || selectedUsers.length < 2}
            >
                {isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createButtonText}>Create Group ({selectedUsers.length})</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    inputSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    nameInput: {
        fontSize: 16,
        padding: 12,
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        color: "#1E293B",
    },
    searchSection: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: "#1E293B",
    },
    listSection: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginVertical: 12,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    selectedBadge: {
        backgroundColor: "#E0F2FE",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    selectedBadgeText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#0369A1",
    },
    userItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#F1F5F9",
        marginBottom: 8,
    },
    selectedUserItem: {
        backgroundColor: "#F0FDF4",
        borderColor: "#BBF7D0",
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
        justifyContent: "center",
        marginRight: 8,
    },
    userName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#0F172A",
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
    },
    gradeBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EEF2FF",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#E0E7FF",
    },
    gradeBadgeText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#4338CA",
    },
    roleBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    roleBadgeAdmin: {
        backgroundColor: "#F3E8FF",
        borderColor: "#E9D5FF",
    },
    roleBadgeTeacher: {
        backgroundColor: "#E0F2FE",
        borderColor: "#BAE6FD",
    },
    roleBadgeStudent: {
        backgroundColor: "#F1F5F9",
        borderColor: "#E2E8F0",
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: "600",
    },
    roleTextAdmin: {
        color: "#7C3AED",
    },
    roleTextTeacher: {
        color: "#0369A1",
    },
    roleTextStudent: {
        color: "#475569",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#94A3B8",
        marginTop: 8,
        textAlign: "center",
    },
    createButton: {
        margin: 16,
        backgroundColor: Colors.light.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    createButtonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    disabledButton: {
        opacity: 0.5,
    }
});
