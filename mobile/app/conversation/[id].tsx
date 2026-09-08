import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Image,
    Linking,
    Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { readFileAsArrayBuffer } from "../../src/utils/file-reader";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Colors from "../../src/constants/Colors";
import AppHeader from "../../src/components/common/AppHeader";
import FileViewerModal from "../../src/components/common/FileViewerModal";
import { useConversationQuery } from "../../src/hooks/query/messages/use-conversation-query";
import { useSendMessageMutation } from "../../src/hooks/query/messages/use-send-message-mutation";
import { useMarkReadMutation } from "../../src/hooks/query/messages/use-mark-read-mutation";
import { supabase } from "../../src/lib/supabase";

const isImageAttachment = (fileUrl: string, fileType?: string) => {
    if (!fileUrl) return false;
    if (fileType === 'image' || fileType?.startsWith('image/')) return true;
    const cleanUrl = fileUrl.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.jpg') || 
           cleanUrl.endsWith('.jpeg') || 
           cleanUrl.endsWith('.png') || 
           cleanUrl.endsWith('.gif') || 
           cleanUrl.endsWith('.webp') || 
           cleanUrl.endsWith('.heic');
};

const isImageFileName = (name: string) => {
    const cleanName = name.toLowerCase();
    return cleanName.endsWith('.jpg') || 
           cleanName.endsWith('.jpeg') || 
           cleanName.endsWith('.png') || 
           cleanName.endsWith('.gif') || 
           cleanName.endsWith('.webp') || 
           cleanName.endsWith('.heic');
};

const getAttachmentFileName = (fileUrl: string, content?: string, customFileName?: string) => {
    if (customFileName && customFileName.trim() && customFileName.toLowerCase() !== 'file') {
        return customFileName.trim().replace(/^\d+[-_]/, '');
    }
    if (content && content.startsWith('Sent a document: ')) {
        return content.replace('Sent a document: ', '');
    }
    if (fileUrl) {
        try {
            const decoded = decodeURIComponent(fileUrl);
            const parts = decoded.split('/');
            const filenameWithQuery = parts[parts.length - 1];
            const rawFilename = filenameWithQuery.split('?')[0];
            return rawFilename.replace(/^\d+[-_]/, '');
        } catch (e) {}
    }
    return 'Attachment';
};

const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (name?: string, url?: string, type?: string) => {
    const fromName = name?.split('.').pop()?.toUpperCase();
    if (fromName && fromName.length <= 5 && fromName !== name?.toUpperCase()) return fromName;
    const fromUrl = url?.split('?')[0]?.split('.').pop()?.toUpperCase();
    if (fromUrl && fromUrl.length <= 5) return fromUrl;
    if (type?.includes('pdf')) return 'PDF';
    if (type?.includes('image')) return 'IMG';
    return 'FILE';
};

const formatTime = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMin / 60);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};

export default function ConversationScreen() {
    const { id, name, isRoom } = useLocalSearchParams<{ id: string, name: string, isRoom?: string }>();
    const isRoomBool = isRoom === 'true' || (typeof id === 'string' && id.startsWith('group_'));
    const insets = useSafeAreaInsets();
    const [inputText, setInputText] = useState("");
    const [isAttachMenuVisible, setAttachMenuVisible] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [attachment, setAttachment] = useState<{ uri: string, name: string, type: string, mimeType?: string } | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const isPickingRef = useRef(false);
    const [sendingMessages, setSendingMessages] = useState<any[]>([]);

    // In-app file viewer state
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerFileName, setViewerFileName] = useState<string | null>(null);

    const queryClient = useQueryClient();
    const { data: messages = [], isLoading } = useConversationQuery(id, isRoomBool);
    const { mutate: send, isPending: isSending } = useSendMessageMutation(id, isRoomBool);
    const { mutate: markRead } = useMarkReadMutation(id, isRoomBool);

    // 1. Mark messages as read as soon as the conversation is opened
    useEffect(() => {
        if (id) {
            markRead();
        }
    }, [id, markRead]);

    // 2. Only mark as read when there are actually unread incoming messages from the other user
    useEffect(() => {
        if (!currentUserId || !messages || messages.length === 0) return;
        const hasUnread = messages.some((m: any) => m.sender_id !== currentUserId && !m.is_read);
        if (hasUnread) {
            markRead();
        }
    }, [messages, currentUserId, markRead]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id || null);
        });
    }, []);

    const title = typeof name === 'string' ? name : "Chat";
    const debugTitle = `${title} (${currentUserId?.slice(-4)} → ${id?.slice(-4)})`;

    const handleSend = async () => {
        const trimmed = inputText.trim();
        const pendingAttachment = attachment;
        if (!trimmed && !pendingAttachment) return;
        if (isUploading) return;

        // 1. Immediately clear input text and attachment for buttery-smooth responsiveness
        setInputText("");
        setAttachment(null);

        const messageContent = trimmed || (pendingAttachment?.type === 'image' ? 'Sent a photo' : `Sent a document: ${pendingAttachment?.name}`);
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // 2. Optimistic message placed immediately into list with local file preview if available
        const tempMessage = {
            id: tempId,
            sender_id: currentUserId,
            receiver_id: isRoomBool ? null : id,
            conversation_id: isRoomBool ? id : null,
            content: messageContent,
            message_text: messageContent,
            file_url: pendingAttachment?.uri || null,
            file_name: pendingAttachment?.name || null,
            file_type: pendingAttachment?.type || null,
            file_size: 0,
            created_at: new Date().toISOString(),
            status: 'sending' as const,
        };

        setSendingMessages(prev => [...prev, tempMessage]);

        // Smooth scroll to bottom on send
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });

        try {
            let fileUrl: string | undefined = undefined;
            let fileType: string | undefined = undefined;
            let fileName: string | undefined = undefined;

            if (pendingAttachment) {
                const uploadedUrl = await uploadFile(pendingAttachment.uri, pendingAttachment.name, pendingAttachment.mimeType || 'application/octet-stream');
                if (!uploadedUrl) {
                    setSendingMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
                    return;
                }
                fileUrl = uploadedUrl;
                fileType = pendingAttachment.type;
                fileName = pendingAttachment.name;
            }

            send({ 
                content: messageContent, 
                fileUrl, 
                fileType,
                fileName,
            }, {
                onSuccess: (savedMessage) => {
                    // Update React Query conversation cache immediately with saved message
                    if (savedMessage) {
                        queryClient.setQueryData(['conversation', id], (old: any[] = []) => {
                            if (!Array.isArray(old)) return [savedMessage];
                            if (old.some(m => m.id === savedMessage.id)) return old;
                            return [...old, savedMessage];
                        });
                    }
                    // Remove temp message now that the real message is in cache - zero vanishing gap!
                    setSendingMessages(prev => prev.filter(m => m.id !== tempId));
                },
                onError: (err: any) => {
                    setSendingMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
                    Alert.alert("Send Error", err?.message || "Failed to send message");
                }
            });
        } catch (err: any) {
            setSendingMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
            Alert.alert("Send Error", err?.message || "Failed to send message");
        }
    };

    const handleRetryMessage = useCallback((failedItem: any) => {
        setSendingMessages(prev => prev.map(m => m.id === failedItem.id ? { ...m, status: 'sending' } : m));
        send({
            content: failedItem.content,
            fileUrl: failedItem.file_url,
            fileType: failedItem.file_type,
            fileName: failedItem.file_name,
        }, {
            onSuccess: (savedMessage) => {
                if (savedMessage) {
                    queryClient.setQueryData(['conversation', id], (old: any[] = []) => {
                        if (!Array.isArray(old)) return [savedMessage];
                        if (old.some(m => m.id === savedMessage.id)) return old;
                        return [...old, savedMessage];
                    });
                }
                setSendingMessages(prev => prev.filter(m => m.id !== failedItem.id));
            },
            onError: (err: any) => {
                setSendingMessages(prev => prev.map(m => m.id === failedItem.id ? { ...m, status: 'error' } : m));
                Alert.alert("Retry Failed", err?.message || "Failed to send message");
            }
        });
    }, [id, send, queryClient]);

    const handleFailedMessagePress = useCallback((item: any) => {
        Alert.alert(
            "Message Failed",
            "This message could not be sent. What would you like to do?",
            [
                { text: "Retry", onPress: () => handleRetryMessage(item) },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: () => setSendingMessages(prev => prev.filter(m => m.id !== item.id)) 
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    }, [handleRetryMessage]);

    const uploadFile = async (uri: string, name: string, type: string) => {
        try {
            console.log('[uploadFile] Starting upload for:', name, 'URI:', uri, 'MIME:', type);
            setIsUploading(true);
            
            const arrayBuffer = await readFileAsArrayBuffer(uri);
            
            // Ensure authenticated user ID dynamically
            let userId = currentUserId;
            if (!userId) {
                const { data } = await supabase.auth.getUser();
                userId = data.user?.id || null;
                if (userId) setCurrentUserId(userId);
            }

            const cleanExt = (name.split('.').pop() || 'file').split('?')[0].toLowerCase();
            const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${cleanExt}`;
            const filePath = `${userId || 'general'}/${fileName}`;

            console.log('[uploadFile] Uploading to chat-attachments path:', filePath);
            const { data, error } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, arrayBuffer, {
                    contentType: type,
                    upsert: true
                });

            if (error) {
                console.error('[uploadFile] Supabase storage upload error:', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            console.log('[uploadFile] Upload success. Public URL:', publicUrl);
            return publicUrl;
        } catch (error: any) {
            console.error('[uploadFile] Catch error:', error);
            Alert.alert("Upload Error", error.message || "Failed to upload file");
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const handlePickImage = async () => {
        if (isPickingRef.current) return;
        
        try {
            isPickingRef.current = true;
            setAttachMenuVisible(false);

            // On Android, request media permissions if needed.
            // On iOS 14+, ImagePicker uses PHPickerViewController which runs out-of-process
            // and does not require or block on media library permissions.
            if (Platform.OS !== 'ios') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert("Permission Error", "Please allow gallery access to pick photos.");
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                const uri = asset.uri;
                let ext = (asset.fileName || uri).split('.').pop()?.split('?')[0].toLowerCase() || 'jpg';
                if (ext.length > 5 || !ext) ext = 'jpg';
                const defaultName = `image_${Date.now()}.${ext}`;
                const name = asset.fileName || defaultName;

                let mime = asset.mimeType;
                if (!mime) {
                    if (ext === 'png') mime = 'image/png';
                    else if (ext === 'gif') mime = 'image/gif';
                    else if (ext === 'webp') mime = 'image/webp';
                    else mime = 'image/jpeg';
                }

                setAttachment({
                    uri,
                    name,
                    type: 'image',
                    mimeType: mime
                });
            }
        } catch (err: any) {
            console.error('[ImagePicker] error:', err);
            Alert.alert("Picker Error", err.message || "Failed to pick photo");
        } finally {
            isPickingRef.current = false;
        }
    };

    const handleSaveImage = useCallback(async (url: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Error", "Please allow gallery access to save photos.");
                return;
            }

            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            if (!storageDir) {
                Linking.openURL(url);
                return;
            }

            const cleanUrl = url.split('?')[0];
            const fileExt = cleanUrl.split('.').pop() || 'jpg';
            const fileName = `image_${Date.now()}.${fileExt}`;
            const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;
            
            const { uri } = await FileSystem.downloadAsync(url, fileUri);
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert("Saved", "Photo saved to your gallery!");
        } catch (error: any) {
            console.error('Save image error:', error);
            try {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(url);
                    return;
                }
            } catch {}
            Alert.alert("Save Error", error instanceof Error ? error.message : "Failed to save photo");
        }
    }, []);

    const handleSaveFile = useCallback(async (url: string, fileName?: string) => {
        try {
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            if (!storageDir) {
                Linking.openURL(url);
                return;
            }

            const cleanFileName = fileName?.trim() || `document_${Date.now()}`;
            const fileUri = storageDir.endsWith('/') ? `${storageDir}${cleanFileName}` : `${storageDir}/${cleanFileName}`;
            
            const { uri } = await FileSystem.downloadAsync(url, fileUri);
            
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Linking.openURL(url);
            }
        } catch (error: any) {
            console.error('Save file error:', error);
            Alert.alert("Save Error", error instanceof Error ? error.message : "Failed to download file");
        }
    }, []);

    const handleViewAttachment = useCallback((url: string, fileName?: string) => {
        if (!url) return;
        setViewerUrl(url);
        setViewerFileName(fileName || "Attachment");
        setViewerVisible(true);
    }, []);

    const handlePickDocument = async () => {
        if (isPickingRef.current) return;
        
        try {
            isPickingRef.current = true;
            setAttachMenuVisible(false);

            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                const uri = asset.uri;
                let ext = (asset.name || uri).split('.').pop()?.split('?')[0].toLowerCase() || '';

                let mime = asset.mimeType;
                if (!mime || mime === 'application/octet-stream') {
                    if (ext === 'pdf') mime = 'application/pdf';
                    else if (ext === 'doc' || ext === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    else if (ext === 'xls' || ext === 'xlsx') mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    else if (ext === 'ppt' || ext === 'pptx') mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    else if (ext === 'png') mime = 'image/png';
                    else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
                    else if (ext === 'txt') mime = 'text/plain';
                    else if (ext === 'zip') mime = 'application/zip';
                    else mime = mime || 'application/octet-stream';
                }

                const isImage = (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext));

                setAttachment({
                    uri,
                    name: asset.name || `doc_${Date.now()}${ext ? `.${ext}` : ''}`,
                    type: isImage ? 'image' : 'document',
                    mimeType: mime
                });
            }
        } catch (err: any) {
            console.error('[DocumentPicker] error:', err);
            Alert.alert("Picker Error", err.message || "Failed to pick document");
        } finally {
            isPickingRef.current = false;
        }
    };


    // Filter out sendingMessages that are already represented in messages (from server or Realtime)
    const effectiveSendingMessages = useMemo(() => {
        return sendingMessages.filter(temp => {
            if (temp.status === 'error') return true;
            const alreadyInServerMessages = (messages || []).some((m: any) => {
                if (m.id === temp.id) return true;
                const sameSender = m.sender_id === temp.sender_id;
                const sameContent = (m.content === temp.content || m.message_text === temp.content);
                const closeTime = Math.abs(new Date(m.created_at || 0).getTime() - new Date(temp.created_at || 0).getTime()) < 30000;
                return sameSender && sameContent && closeTime;
            });
            return !alreadyInServerMessages;
        });
    }, [sendingMessages, messages]);

    // Reverse chronological for inverted FlatList (index 0 is newest / bottom)
    const displayMessages = useMemo(() => {
        return [...(messages || []), ...effectiveSendingMessages].reverse();
    }, [messages, effectiveSendingMessages]);

    // Index of the newest message sent by current user in the inverted list
    const newestMyMessageIndex = useMemo(() => {
        return displayMessages.findIndex(m => m.sender_id === currentUserId);
    }, [displayMessages, currentUserId]);

    const renderMessage = useCallback(({ item, index }: { item: any, index: number }) => {
        const isMe = item.sender_id === currentUserId;
        const isNewestMyMessage = isMe && index === newestMyMessageIndex;
        return (
            <MessageItem
                item={item}
                isMe={isMe}
                isNewestMyMessage={isNewestMyMessage}
                onFailedMessagePress={handleFailedMessagePress}
                onViewAttachment={handleViewAttachment}
                onSaveImage={handleSaveImage}
                onSaveFile={handleSaveFile}
            />
        );
    }, [currentUserId, newestMyMessageIndex, handleFailedMessagePress, handleViewAttachment, handleSaveImage, handleSaveFile]);

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AppHeader title={debugTitle} showBack={true} showProfile={false} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                style={{ flex: 1 }}
            >
                <FlatList
                    ref={flatListRef}
                    data={displayMessages}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    inverted={true}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    removeClippedSubviews={Platform.OS === 'android'}
                    updateCellsBatchingPeriod={50}
                />

                {/* Input Footer */}
                <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    {attachment && (
                        <View style={styles.previewContainer}>
                            <View style={styles.previewContent}>
                                {attachment.type === 'image' ? (
                                    <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
                                ) : (
                                    <View style={styles.previewFile}>
                                        <Ionicons name="document-text" size={24} color={Colors.light.primary} />
                                        <Text numberOfLines={1} style={styles.previewFileName}>{attachment.name}</Text>
                                    </View>
                                )}
                                <TouchableOpacity 
                                    style={styles.removeAttachment} 
                                    onPress={() => setAttachment(null)}
                                >
                                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <TouchableOpacity 
                            style={styles.attachButton} 
                            onPress={() => setAttachMenuVisible(true)}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color={Colors.light.primary} />
                            ) : (
                                <Ionicons name="attach" size={24} color={Colors.light.primary} />
                            )}
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor="#94A3B8"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />

                        <TouchableOpacity 
                            style={[
                                styles.sendButton, 
                                (!inputText.trim() && !attachment) && { opacity: 0.5 }
                            ]} 
                            onPress={handleSend}
                            disabled={(!inputText.trim() && !attachment) || isUploading}
                        >
                            <Ionicons name="send" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Attachment Selection Overlay Menu */}
            {isAttachMenuVisible && (
                <TouchableWithoutFeedback onPress={() => setAttachMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.attachMenu, { bottom: Math.max(insets.bottom, 12) + 60 }]}>
                                <TouchableOpacity 
                                    style={styles.attachMenuItem} 
                                    onPress={handlePickImage}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="image-outline" size={20} color={Colors.light.primary} />
                                    <Text style={styles.attachMenuText}>Photo / Image</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.attachMenuItem} 
                                    onPress={handlePickDocument}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="document-text-outline" size={20} color={Colors.light.primary} />
                                    <Text style={styles.attachMenuText}>Document / File</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            )}

            {/* In-App Fullscreen File & Photo Viewer */}
            <FileViewerModal 
                visible={viewerVisible} 
                url={viewerUrl} 
                fileName={viewerFileName} 
                onClose={() => setViewerVisible(false)} 
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    listContent: {
        padding: 16,
        paddingBottom: 16,
    },
    messageWrapper: {
        width: "100%",
        marginBottom: 8,
    },
    messageBubble: {
        maxWidth: "88%",
        padding: 12,
        borderRadius: 18,
        marginBottom: 2,
    },
    attachmentBubble: {
        width: 270,
        maxWidth: "88%",
    },
    myMessage: {
        alignSelf: "flex-end",
        backgroundColor: "#059669", // Emerald Green matching screenshot
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: "flex-start",
        backgroundColor: "#059669", // If standard green theme or teacher messages
        borderBottomLeftRadius: 4,
    },
    messageTextContainer: {
        marginTop: 4,
        flexDirection: 'column',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '500',
    },
    myMessageText: {
        color: "#FFFFFF",
    },
    theirMessageText: {
        color: "#FFFFFF",
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    myTimeText: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    theirTimeText: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginRight: 4,
        marginTop: 2,
        marginBottom: 2,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '600',
    },

    // ─── Attachment Card Styles (matching screenshot) ───
    attachmentCard: {
        borderRadius: 14,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        width: "100%",
    },
    myAttachmentCard: {
        backgroundColor: "rgba(0, 0, 0, 0.12)",
        borderColor: "rgba(255, 255, 255, 0.2)",
    },
    theirAttachmentCard: {
        backgroundColor: "rgba(0, 0, 0, 0.12)",
        borderColor: "rgba(255, 255, 255, 0.2)",
    },
    attachmentHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    attachmentIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    myAttachmentIconBox: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    theirAttachmentIconBox: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    attachmentMetaBox: {
        flex: 1,
        justifyContent: 'center',
    },
    attachmentFileName: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    myAttachmentFileName: {
        color: "#FFFFFF",
    },
    theirAttachmentFileName: {
        color: "#FFFFFF",
    },
    attachmentSubText: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    myAttachmentSubText: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    theirAttachmentSubText: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    imageThumbnailContainer: {
        marginTop: 8,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
        height: 150,
        width: "100%",
    },
    cardImagePreview: {
        width: '100%',
        height: '100%',
    },
    attachmentActionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        width: '100%',
    },
    attachmentActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        minHeight: 36,
    },
    myActionButton: {
        backgroundColor: "rgba(255, 255, 255, 0.22)",
    },
    theirActionButton: {
        backgroundColor: "rgba(255, 255, 255, 0.22)",
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    myActionButtonText: {
        color: "#FFFFFF",
    },
    theirActionButtonText: {
        color: "#FFFFFF",
    },

    // ─── Input & Preview Styles ───
    inputWrapper: {
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
    },
    previewContainer: {
        padding: 12,
        backgroundColor: "#F8FAFC",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    previewContent: {
        width: 100,
        height: 100,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    previewImage: {
        width: "100%",
        height: "100%",
        borderRadius: 11,
    },
    previewFile: {
        alignItems: "center",
        padding: 8,
    },
    previewFileName: {
        fontSize: 10,
        color: "#64748B",
        marginTop: 4,
        textAlign: "center",
    },
    removeAttachment: {
        position: "absolute",
        top: -10,
        right: -10,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
    },
    attachButton: {
        padding: 8,
        marginRight: 4,
    },
    input: {
        flex: 1,
        backgroundColor: "#F1F5F9",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        maxHeight: 100,
        fontSize: 15,
        color: "#1E293B",
    },
    sendButton: {
        marginLeft: 8,
        backgroundColor: "#059669",
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    modalOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.25)",
        zIndex: 999,
        elevation: 10,
    },
    attachMenu: {
        position: "absolute",
        left: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 6,
        width: 175,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 12,
        zIndex: 1000,
    },
    attachMenuItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 10,
    },
    attachMenuText: {
        fontSize: 14,
        fontWeight: '600',
        color: "#1E293B",
    },
});

interface MessageItemProps {
    item: any;
    isMe: boolean;
    isNewestMyMessage: boolean;
    onFailedMessagePress: (item: any) => void;
    onViewAttachment: (url: string, fileName?: string) => void;
    onSaveImage: (url: string) => void;
    onSaveFile: (url: string, fileName?: string) => void;
}

const MessageItem = React.memo(function MessageItem({
    item,
    isMe,
    isNewestMyMessage,
    onFailedMessagePress,
    onViewAttachment,
    onSaveImage,
    onSaveFile,
}: MessageItemProps) {
    let statusLabel = "";
    let statusIcon: "time-outline" | "alert-circle" | "checkmark-circle" | "checkmark-done-circle" = "checkmark-circle";
    let statusColor = "#64748B";

    if (item.status === 'sending') {
        statusLabel = "Sending...";
        statusIcon = "time-outline";
        statusColor = "#94A3B8";
    } else if (item.status === 'error') {
        statusLabel = "Failed to send (tap to retry)";
        statusIcon = "alert-circle";
        statusColor = "#EF4444";
    } else if (isNewestMyMessage) {
        if (item.is_read) {
            statusLabel = "Seen";
            statusIcon = "checkmark-done-circle";
            statusColor = Colors.light.primary;
        } else {
            statusLabel = "Delivered";
            statusIcon = "checkmark-circle";
            statusColor = "#64748B";
        }
    }

    const showStatus = isMe && (item.status === 'sending' || item.status === 'error' || isNewestMyMessage);

    const attachmentsList = Array.isArray(item.attachments) && item.attachments.length > 0
        ? item.attachments
        : (item.file_url ? [{ file_url: item.file_url, file_name: item.file_name, file_type: item.file_type, file_size: item.file_size }] : []);

    const hasAttachments = attachmentsList.length > 0;

    return (
        <View style={styles.messageWrapper}>
            <TouchableOpacity 
                activeOpacity={item.status === 'error' ? 0.8 : 1}
                onPress={item.status === 'error' ? () => onFailedMessagePress(item) : undefined}
                style={[
                    styles.messageBubble, 
                    isMe ? styles.myMessage : styles.theirMessage,
                    hasAttachments && styles.attachmentBubble,
                    item.status === 'error' && { borderColor: '#EF4444', borderWidth: 1 }
                ]}
            >
                {/* Attachment Cards */}
                {attachmentsList.map((att: any, attIdx: number) => {
                    const attUrl = att.file_url;
                    const rawFileName = att.file_name || item.file_name;
                    const fileName = getAttachmentFileName(attUrl, item.content, rawFileName);
                    const isImg = isImageAttachment(attUrl, att.file_type || item.file_type) || isImageFileName(rawFileName || '');
                    const attSize = Number(att.file_size || item.file_size || 0);
                    const sizeLabel = formatFileSize(attSize);
                    const extLabel = getFileExtension(rawFileName, attUrl, att.file_type || item.file_type);
                    const metaLine = [sizeLabel, extLabel].filter(Boolean).join(" • ");

                    return (
                        <View key={attIdx} style={[styles.attachmentCard, isMe ? styles.myAttachmentCard : styles.theirAttachmentCard]}>
                            {/* Header: Icon + Info */}
                            <View style={styles.attachmentHeaderRow}>
                                <View style={[styles.attachmentIconBox, isMe ? styles.myAttachmentIconBox : styles.theirAttachmentIconBox]}>
                                    <Ionicons 
                                        name={isImg ? "image" : "document-text"} 
                                        size={22} 
                                        color={isMe ? "#FFFFFF" : Colors.light.primary} 
                                    />
                                </View>
                                <View style={styles.attachmentMetaBox}>
                                    <Text style={[styles.attachmentFileName, isMe ? styles.myAttachmentFileName : styles.theirAttachmentFileName]} numberOfLines={1}>
                                        {fileName}
                                    </Text>
                                    {Boolean(metaLine) && (
                                        <Text style={[styles.attachmentSubText, isMe ? styles.myAttachmentSubText : styles.theirAttachmentSubText]}>
                                            {metaLine}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* Optional image preview thumbnail */}
                            {isImg && (
                                <TouchableOpacity 
                                    onPress={() => onViewAttachment(attUrl, fileName)}
                                    style={styles.imageThumbnailContainer}
                                    activeOpacity={0.9}
                                >
                                    <Image source={{ uri: attUrl }} style={styles.cardImagePreview} resizeMode="cover" />
                                </TouchableOpacity>
                            )}

                            {/* Action Buttons: View & Download */}
                            <View style={styles.attachmentActionRow}>
                                <TouchableOpacity 
                                    style={[styles.attachmentActionButton, isMe ? styles.myActionButton : styles.theirActionButton]}
                                    onPress={() => onViewAttachment(attUrl, fileName)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="open-outline" size={15} color={isMe ? "#FFFFFF" : Colors.light.primary} />
                                    <Text style={[styles.actionButtonText, isMe ? styles.myActionButtonText : styles.theirActionButtonText]} numberOfLines={1}>
                                        View
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.attachmentActionButton, isMe ? styles.myActionButton : styles.theirActionButton]}
                                    onPress={() => isImg ? onSaveImage(attUrl) : onSaveFile(attUrl, fileName)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="download-outline" size={15} color={isMe ? "#FFFFFF" : Colors.light.primary} />
                                    <Text style={[styles.actionButtonText, isMe ? styles.myActionButtonText : styles.theirActionButtonText]} numberOfLines={1}>
                                        Download
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}

                {/* Message Text & Time */}
                <View style={styles.messageTextContainer}>
                    {Boolean(item.content || item.message_text) && (
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                            {item.content || item.message_text}
                        </Text>
                    )}
                    <View style={styles.timeRow}>
                        <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                            {formatTime(item.created_at || item.timestamp)}
                        </Text>
                        {isMe && (
                            <Ionicons 
                                name={
                                    item.status === 'sending' 
                                        ? "time-outline" 
                                        : (item.status === 'error' 
                                            ? "alert-circle" 
                                            : (item.is_read ? "checkmark-done" : "checkmark"))
                                } 
                                size={13} 
                                color={
                                    item.status === 'error' 
                                        ? "#FCA5A5" 
                                        : (item.is_read ? "#93C5FD" : "rgba(255,255,255,0.7)")
                                } 
                                style={{ marginLeft: 3 }}
                            />
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            {showStatus && (
                <TouchableOpacity 
                    style={styles.statusContainer} 
                    disabled={item.status !== 'error'}
                    onPress={() => onFailedMessagePress(item)}
                    activeOpacity={0.7}
                >
                    <Ionicons name={statusIcon} size={11} color={statusColor} style={{ marginRight: 3 }} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}, (prev, next) => {
    return (
        prev.item.id === next.item.id &&
        prev.item.status === next.item.status &&
        prev.item.is_read === next.item.is_read &&
        (prev.item.content || prev.item.message_text) === (next.item.content || next.item.message_text) &&
        prev.item.file_url === next.item.file_url &&
        prev.isMe === next.isMe &&
        prev.isNewestMyMessage === next.isNewestMyMessage
    );
});
