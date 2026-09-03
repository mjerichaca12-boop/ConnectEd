import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../src/constants/Colors";
import AppHeader from "../src/components/common/AppHeader";
import { useSearchableProfilesQuery } from "../src/hooks/query/profiles/use-searchable-profiles-query";
import { supabase } from "../src/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

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

    // Deduplicate and filter by search query
    const seenIds = new Set<string>();
    const seenBaseKeys = new Set<string>();
    const query = searchQuery.trim().toLowerCase();

    const filteredProfiles = (Array.isArray(profiles) ? profiles : []).filter(p => {
        if (!p || !p.id || seenIds.has(p.id)) return false;
        seenIds.add(p.id);

        const fullName = String(p.full_name || '').toLowerCase().trim();
        const baseName = String(p.base_name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().trim();
        const email = String(p.email || '').toLowerCase().trim();
        const username = String(p.username || '').toLowerCase().trim();
        const role = String(p.role || '').toLowerCase().trim();
        const baseRoleKey = `${baseName || fullName}_${role}`;

        if (baseName && seenBaseKeys.has(baseRoleKey)) return false;
        if (baseName) seenBaseKeys.add(baseRoleKey);

        if (query.length > 0) {
            return fullName.includes(query) || 
                   baseName.includes(query) || 
                   email.includes(query) || 
                   username.includes(query) || 
                   role.includes(query);
        }
        return true;
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
                        placeholder="Search members..."
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
                            return (
                                <TouchableOpacity 
                                    style={[styles.userItem, isSelected && styles.selectedUserItem]} 
                                    onPress={() => toggleUser(item.id)}
                                >
                                    <View style={[styles.avatar, { backgroundColor: isSelected ? Colors.light.primary : "#E2E8F0" }]}>
                                        <Ionicons 
                                            name={isSelected ? "checkmark" : "person"} 
                                            size={20} 
                                            color={isSelected ? "#FFF" : "#64748B"} 
                                        />
                                    </View>
                                    <View style={styles.userInfo}>
                                        <Text style={styles.userName}>{item.full_name}</Text>
                                        <Text style={styles.userRole}>
                                            {item.role} {item.email ? `• ${item.email}` : (item.username ? `• @${item.username}` : '')}
                                        </Text>
                                    </View>
                                    <Ionicons 
                                        name={isSelected ? "checkbox" : "square-outline"} 
                                        size={24} 
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
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    selectedUserItem: {
        backgroundColor: "#F0FDF4",
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1E293B",
    },
    userRole: {
        fontSize: 12,
        color: "#64748B",
        textTransform: "capitalize",
        marginTop: 2,
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
