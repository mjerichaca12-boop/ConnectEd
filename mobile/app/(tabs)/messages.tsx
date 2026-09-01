import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import Layout from "../../src/constants/Layout";

import AppHeader from "../../src/components/common/AppHeader";
import { useChatListQuery } from "../../src/hooks/query/messages/use-chat-list-query";
import { useSearchableProfilesQuery } from "../../src/hooks/query/profiles/use-searchable-profiles-query";
import { supabase } from "../../src/lib/supabase";

const ChatItem = ({ id, name, message, time, unread, role, isNew, chat_type }: any) => {
    const router = useRouter();

    const handlePress = () => {
        router.push({
            pathname: "/conversation/[id]",
            params: { id, name, isRoom: chat_type === 'group' ? 'true' : 'false' }
        });
    };

    return (
        <TouchableOpacity style={styles.itemContainer} onPress={handlePress}>
            <View style={[styles.avatar, isNew && { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="person" size={24} color={isNew ? "#94A3B8" : "#FFF"} />
            </View>
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.name}>{name}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: role === 'teacher' ? '#E0F2FE' : '#F1F5F9' }]}>
                            <Text style={[styles.roleText, { color: role === 'teacher' ? '#0369A1' : '#64748B' }]}>
                                {role}
                            </Text>
                        </View>
                    </View>
                    {time && <Text style={styles.time}>{time}</Text>}
                </View>
                <Text style={[styles.message, unread && styles.unreadMessage]} numberOfLines={1}>
                    {isNew ? "Start a new conversation" : (
                        message || (role === 'image' ? 'Sent a photo' : 'Sent a file')
                    )}
                </Text>
            </View>
            {unread && <View style={styles.unreadDot} />}
            {isNew && <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />}
        </TouchableOpacity>
    );
};

export default function MessagesScreen() {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const { data: chats = [], isLoading: isChatsLoading, refetch: refetchChats } = useChatListQuery();
    const { data: profiles = [], isLoading: isProfilesLoading } = useSearchableProfilesQuery();
    const router = useRouter();

    const formatTime = (dateString?: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            try {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (_) {
                return "";
            }
        }
        try {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch (_) {
            return "";
        }
    };

    const isLoading = isChatsLoading && isProfilesLoading;

    // Real-time for chat list
    useEffect(() => {
        const channel = supabase
            .channel('chat-list-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => {
                    refetchChats();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [refetchChats]);

    // Deduplicate & Filter Chats
    const seenChatIds = new Set<string>();
    const seenChatNames = new Set<string>();
    const filteredChats: any[] = [];

    if (Array.isArray(chats)) {
        for (const chat of chats) {
            if (!chat) continue;
            const partnerId = String(chat.partner_id || chat.id || '');
            const partnerName = String(chat.partner_name || '').toLowerCase().trim();
            
            if (partnerId && seenChatIds.has(partnerId)) continue;
            if (partnerName && seenChatNames.has(partnerName)) continue;
            
            if (partnerId) seenChatIds.add(partnerId);
            if (partnerName) seenChatNames.add(partnerName);

            if (!searchQuery.trim() || partnerName.includes(searchQuery.toLowerCase().trim())) {
                filteredChats.push(chat);
            }
        }
    }

    // Deduplicate & Filter Suggested Profiles
    const seenSuggestedIds = new Set<string>(seenChatIds);
    const seenSuggestedNames = new Set<string>(seenChatNames);
    const otherProfiles: any[] = [];

    if (Array.isArray(profiles)) {
        for (const profile of profiles) {
            if (!profile || !profile.id) continue;
            const profId = String(profile.id);
            const profName = String(profile.full_name || '').toLowerCase().trim();
            const profRole = String(profile.role || '').toLowerCase().trim();
            const nameRoleKey = `${profName}_${profRole}`;

            if (seenSuggestedIds.has(profId)) continue;
            if (profName && seenSuggestedNames.has(nameRoleKey)) continue;

            seenSuggestedIds.add(profId);
            if (profName) seenSuggestedNames.add(nameRoleKey);

            if (!searchQuery.trim() || profName.includes(searchQuery.toLowerCase().trim()) || profRole.includes(searchQuery.toLowerCase().trim())) {
                otherProfiles.push(profile);
            }
        }
    }

    // Combine for FlatList
    const listData: any[] = [];
    if (filteredChats.length > 0) {
        listData.push({ type: 'header', title: searchQuery ? 'Recent Conversations' : 'Conversations' });
        filteredChats.forEach(chat => listData.push({ type: 'chat', ...chat }));
    }

    const showSuggested = isSearchFocused || searchQuery.trim().length > 0;
    if (showSuggested && otherProfiles.length > 0) {
        listData.push({ type: 'header', title: searchQuery ? 'Other Users' : 'Suggested' });
        otherProfiles.forEach(profile => listData.push({ type: 'profile', ...profile }));
    }

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AppHeader title="Messages" hasNotifications={true} />
            
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search people..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94A3B8"
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={listData}
                keyExtractor={(item, index) => item.type + (item.id || item.partner_id || index)}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isChatsLoading} onRefresh={refetchChats} colors={[Colors.light.primary]} />
                }
                renderItem={({ item }) => {
                    if (item.type === 'header') {
                        return <Text style={styles.sectionHeader}>{item.title}</Text>;
                    }
                    if (item.type === 'chat') {
                        return (
                            <ChatItem
                                id={item.partner_id}
                                name={item.partner_name}
                                message={item.content || item.message_text}
                                time={formatTime(item.created_at)}
                                unread={item.unread_count > 0}
                                role={item.partner_role || item.file_type}
                                chat_type={item.chat_type}
                            />
                        );
                    }
                    return (
                        <ChatItem
                            id={item.id}
                            name={item.full_name}
                            role={item.role}
                            isNew={true}
                        />
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>
                            {searchQuery ? "No matching users found." : "No conversations yet."}
                        </Text>
                    </View>
                )}
            />

            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => router.push("/new-group")}
            >
                <Ionicons name="people" size={26} color="#FFF" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: Colors.light.background,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: Colors.light.text,
    },
    listContent: {
        padding: Layout.spacing.m,
        paddingTop: 8,
    },
    header: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: Layout.spacing.m,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 16,
        marginBottom: 8,
    },
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.light.primary,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.light.text,
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    roleText: {
        fontSize: 10,
        fontWeight: "bold",
        textTransform: "capitalize",
    },
    time: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    message: {
        fontSize: 14,
        color: Colors.light.textSecondary,
    },
    unreadMessage: {
        color: Colors.light.text,
        fontWeight: "600",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.light.primary,
        marginLeft: 8,
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        marginTop: 12,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
    }
});
