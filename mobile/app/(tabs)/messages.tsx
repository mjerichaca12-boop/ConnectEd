import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Image } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/Colors";
import Layout from "../../src/constants/Layout";

import AppHeader from "../../src/components/common/AppHeader";
import { useChatListQuery } from "../../src/hooks/query/messages/use-chat-list-query";
import { useSearchableProfilesQuery } from "../../src/hooks/query/profiles/use-searchable-profiles-query";
import { supabase } from "../../src/lib/supabase";
import { matchesSearchQuery } from "../../src/data/profiles/search-profiles-matcher";
import { formatGradeLevel, formatRoleLabel } from "../../src/data/profiles/get-all-searchable-profiles";
import { recordConversationRead } from "../../src/data/messages/message-storage";

const ChatItem = ({ id, name, message, time, unread, role, role_label, grade_level, year_level, isNew, chat_type, unread_count, avatar_url }: any) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const handlePress = () => {
        if (unread || (unread_count && unread_count > 0)) {
            // Immediately record in persistent local storage so seen messages never revert on reload
            recordConversationRead(id);

            // Optimistically mark this conversation as read in the chat-list
            queryClient.setQueryData<any[]>(['chat-list'], (old = []) =>
                old.map(c => (c.partner_id === id || c.id === id) ? { ...c, unread: false, unread_count: 0 } : c)
            );
            // Optimistically decrement the tab bar unread messages badge
            const countToDeduct = Number(unread_count) > 0 ? Number(unread_count) : 1;
            queryClient.setQueryData<number>(['unread-messages-count'], (old = 0) =>
                Math.max(0, old - countToDeduct)
            );
        }

        router.push({
            pathname: "/conversation/[id]",
            params: { id, name, isRoom: chat_type === 'group' ? 'true' : 'false' }
        });
    };

    const roleLabel = role_label || formatRoleLabel(role);
    const grade = grade_level || formatGradeLevel(year_level);
    const isTeacher = roleLabel === 'Teacher';
    const isAdmin = roleLabel === 'Admin';
    const isStudent = roleLabel === 'Student';

    if (isNew) {
        return (
            <TouchableOpacity style={styles.itemContainer} onPress={handlePress} activeOpacity={0.7}>
                {avatar_url ? (
                    <Image source={{ uri: avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={[
                        styles.avatar, 
                        { backgroundColor: isAdmin ? '#F3E8FF' : isTeacher ? '#E0F2FE' : '#F1F5F9' }
                    ]}>
                        <Ionicons 
                            name={isAdmin ? "shield-checkmark" : isTeacher ? "school" : "person"} 
                            size={22} 
                            color={isAdmin ? "#7C3AED" : isTeacher ? "#0284C7" : "#64748B"} 
                        />
                    </View>
                )}
                <View style={styles.content}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
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
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity style={styles.itemContainer} onPress={handlePress} activeOpacity={0.7}>
            {avatar_url ? (
                <Image source={{ uri: avatar_url }} style={styles.avatar} />
            ) : (
                <View style={[
                    styles.avatar, 
                    { backgroundColor: isAdmin ? '#7C3AED' : isTeacher ? '#0284C7' : Colors.light.primary }
                ]}>
                    <Ionicons 
                        name={isAdmin ? "shield-checkmark" : isTeacher ? "school" : "person"} 
                        size={22} 
                        color="#FFF" 
                    />
                </View>
            )}
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1, marginRight: 8 }}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        {chat_type !== 'group' && (
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
                        )}
                    </View>
                    {time && <Text style={styles.time}>{time}</Text>}
                </View>
                <Text style={[styles.message, unread && styles.unreadMessage]} numberOfLines={1}>
                    {message || (role === 'image' ? 'Sent a photo' : 'Sent a file')}
                </Text>
            </View>
            {unread && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );
};

export default function MessagesScreen() {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const { data: chats = [], isLoading: isChatsLoading, refetch: refetchChats } = useChatListQuery();
    const { data: profiles = [], isLoading: isProfilesLoading, refetch: refetchProfiles } = useSearchableProfilesQuery();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([refetchChats(), refetchProfiles(), queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] })]);
        } finally {
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            refetchChats();
            refetchProfiles();
            queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        }, [refetchChats, refetchProfiles, queryClient])
    );

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
    const seenChatPartnerIds = new Set<string>();
    const filteredChats: any[] = [];

    if (Array.isArray(chats)) {
        for (const chat of chats) {
            if (!chat) continue;
            const partnerId = String(chat.partner_id || chat.id || '');
            if (partnerId && seenChatPartnerIds.has(partnerId)) continue;
            if (partnerId) seenChatPartnerIds.add(partnerId);

            if (matchesSearchQuery(chat, searchQuery)) {
                filteredChats.push(chat);
            }
        }
    }

    // Filter Suggested Profiles (search by Name, Email, Username, Role)
    // Preserves all unique accounts without dropping users with identical names
    const seenProfileIds = new Set<string>(seenChatPartnerIds);
    const otherProfiles: any[] = [];

    if (Array.isArray(profiles)) {
        for (const profile of profiles) {
            if (!profile || !profile.id) continue;
            const profId = String(profile.id);

            if (seenProfileIds.has(profId)) continue;
            seenProfileIds.add(profId);

            if (matchesSearchQuery(profile, searchQuery)) {
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

    const showSuggested = isSearchFocused || searchQuery.trim().length > 0 || filteredChats.length === 0;
    if (showSuggested && otherProfiles.length > 0) {
        listData.push({ 
            type: 'header', 
            title: searchQuery 
                ? 'People & Accounts' 
                : (filteredChats.length === 0 ? 'Suggested Contacts (Admins & Teachers)' : 'Suggested Contacts') 
        });
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
                        placeholder="Search by name, grade level, role..."
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
                    <RefreshControl refreshing={refreshing || isChatsLoading} onRefresh={handleRefresh} colors={[Colors.light.primary]} />
                }
                renderItem={({ item }) => {
                    if (item.type === 'header') {
                        return <Text style={styles.sectionHeader}>{item.title}</Text>;
                    }
                    if (item.type === 'chat') {
                        return (
                            <ChatItem
                                id={item.partner_id || item.id}
                                name={item.partner_name || item.name}
                                message={item.content || item.message_text}
                                time={formatTime(item.created_at)}
                                unread={Boolean(item.unread || (item.unread_count && item.unread_count > 0))}
                                unread_count={item.unread_count}
                                role={item.partner_role || item.role || item.file_type}
                                chat_type={item.chat_type}
                                avatar_url={item.avatar_url}
                            />
                        );
                    }
                    return (
                        <ChatItem
                            id={item.id}
                            name={item.full_name}
                            email={item.email}
                            username={item.username}
                            role={item.role}
                            role_label={item.role_label}
                            grade_level={item.grade_level}
                            year_level={item.year_level}
                            avatar_url={item.avatar_url}
                            isNew={true}
                        />
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>
                            {searchQuery ? "No matching users, teachers, or admins found." : "No conversations yet."}
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
        fontSize: 15,
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
        fontSize: 13,
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
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    gradeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    gradeBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4338CA',
    },
    roleBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    roleBadgeAdmin: {
        backgroundColor: '#F3E8FF',
        borderColor: '#E9D5FF',
    },
    roleBadgeTeacher: {
        backgroundColor: '#E0F2FE',
        borderColor: '#BAE6FD',
    },
    roleBadgeStudent: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    roleTextAdmin: {
        color: '#7C3AED',
    },
    roleTextTeacher: {
        color: '#0369A1',
    },
    roleTextStudent: {
        color: '#475569',
    },
    time: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    message: {
        fontSize: 13,
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
