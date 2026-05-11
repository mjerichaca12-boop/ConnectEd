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

            // 1. Create Room
            const { data: room, error: roomError } = await supabase
                .from('chat_rooms')
                .insert({
                    name: groupName.trim(),
                    created_by: userData.user.id
                })
                .select()
                .single();

            if (roomError) throw roomError;

            // 2. Add Members
            const members = [
                { room_id: room.id, user_id: userData.user.id },
                ...selectedUsers.map(userId => ({ room_id: room.id, user_id: userId }))
            ];

            const { error: membersError } = await supabase
                .from('room_members')
                .insert(members);

            if (membersError) throw membersError;

            // 3. Send initial message
            const { error: msgError } = await supabase
                .from('messages')
                .insert({
                    sender_id: userData.user.id,
                    room_id: room.id,
                    content: `Group "${groupName}" created`,
                    message_text: `Group "${groupName}" created`
                });

            if (msgError) throw msgError;

            queryClient.invalidateQueries({ queryKey: ['chat-list'] });
            router.replace({
                pathname: "/conversation/[id]",
                params: { id: room.id, name: groupName, isRoom: 'true' }
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
                    value={groupName}
                    onChangeText={setGroupName}
                />
            </View>

            <View style={styles.listSection}>
                <Text style={styles.sectionTitle}>Select Members ({selectedUsers.length})</Text>
                {isLoading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={Colors.light.primary} />
                ) : (
                    <FlatList
                        data={profiles}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.userItem} 
                                onPress={() => toggleUser(item.id)}
                            >
                                <View style={[styles.avatar, { backgroundColor: selectedUsers.includes(item.id) ? Colors.light.primary : "#E2E8F0" }]}>
                                    <Ionicons 
                                        name={selectedUsers.includes(item.id) ? "checkmark" : "person"} 
                                        size={20} 
                                        color="#FFF" 
                                    />
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{item.full_name}</Text>
                                    <Text style={styles.userRole}>{item.role}</Text>
                                </View>
                                <Ionicons 
                                    name={selectedUsers.includes(item.id) ? "checkbox" : "square-outline"} 
                                    size={24} 
                                    color={selectedUsers.includes(item.id) ? Colors.light.primary : "#94A3B8"} 
                                />
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>

            <TouchableOpacity 
                style={[styles.createButton, (isCreating || !groupName.trim() || selectedUsers.length < 2) && styles.disabledButton]}
                onPress={handleCreateGroup}
                disabled={isCreating || !groupName.trim() || selectedUsers.length < 2}
            >
                {isCreating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createButtonText}>Create Group</Text>}
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
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    nameInput: {
        fontSize: 18,
        padding: 12,
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
    },
    listSection: {
        flex: 1,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#64748B",
        marginBottom: 16,
        textTransform: "uppercase",
    },
    userItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
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
        fontSize: 16,
        fontWeight: "600",
    },
    userRole: {
        fontSize: 12,
        color: "#64748B",
        textTransform: "capitalize",
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
        opacity: 0.6,
    }
});
