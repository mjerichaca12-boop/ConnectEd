import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Modal,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Image,
    Linking,
    Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Colors from "../../src/constants/Colors";
import AppHeader from "../../src/components/common/AppHeader";
import FileViewerModal from "../../src/components/common/FileViewerModal";
import { useConversationQuery } from "../../src/hooks/query/messages/use-conversation-query";
import { useSendMessageMutation } from "../../src/hooks/query/messages/use-send-message-mutation";
import { useMarkReadMutation } from "../../src/hooks/query/messages/use-mark-read-mutation";
import { supabase } from "../../src/lib/supabase";

export default function ConversationScreen() {
    const { id, name, isRoom } = useLocalSearchParams<{ id: string, name: string, isRoom?: string }>();
    const isRoomBool = isRoom === 'true';
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

    const { data: messages = [], isLoading } = useConversationQuery(id);
    const { mutate: send, isPending: isSending } = useSendMessageMutation(id, isRoomBool);
    const { mutate: markRead } = useMarkReadMutation(id);

    useEffect(() => {
        if (messages.length > 0) {
            markRead();
        }
    }, [messages.length, markRead]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id || null);
        });
    }, []);

    const title = typeof name === 'string' ? name : "Chat";
    const debugTitle = `${title} (${currentUserId?.slice(-4)} → ${id?.slice(-4)})`;

    const handleSend = async () => {
        if (!inputText.trim() && !attachment) return;
        if (isUploading) return;

        let fileUrl = undefined;
        let fileType = undefined;

        try {
            if (attachment) {
                const uploadedUrl = await uploadFile(attachment.uri, attachment.name, attachment.mimeType || 'application/octet-stream');
                if (!uploadedUrl) return; 
                fileUrl = uploadedUrl;
                fileType = attachment.type;
            }

            const messageContent = inputText.trim() || (attachment?.type === 'image' ? 'Sent a photo' : `Sent a document: ${attachment?.name}`);
            const tempId = `temp_${Date.now()}`;
            const tempMessage = {
                id: tempId,
                sender_id: currentUserId,
                content: messageContent,
                file_url: fileUrl,
                file_name: attachment?.name,
                file_type: fileType,
                created_at: new Date().toISOString(),
                status: 'sending'
            };
            
            setSendingMessages(prev => [...prev, tempMessage]);
            
            send({ 
                content: messageContent, 
                fileUrl, 
                fileType 
            }, {
                onSuccess: () => {
                    setSendingMessages(prev => prev.filter(m => m.id !== tempId));
                },
                onError: (err: any) => {
                    setSendingMessages(prev => prev.filter(m => m.id !== tempId));
                    Alert.alert("Send Error", err.message);
                }
            });
            
            setInputText("");
            setAttachment(null);
        } catch (err: any) {
            Alert.alert("Send Error", err.message);
        }
    };

    const uploadFile = async (uri: string, name: string, type: string) => {
        try {
            console.log('Starting upload for:', name, 'URI:', uri);
            setIsUploading(true);
            
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });
            const arrayBuffer = decode(base64);
            
            const fileExt = name.split('.').pop() || 'file';
            const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
            const filePath = `${currentUserId || 'anonymous'}/${fileName}`;

            console.log('Uploading to path:', filePath);
            const { data, error } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, arrayBuffer, {
                    contentType: type,
                    upsert: true
                });

            if (error) {
                console.error('Storage upload error:', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            console.log('Upload success. Public URL:', publicUrl);
            return publicUrl;
        } catch (error: any) {
            console.error('Upload catch error:', error);
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
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Error", "Please allow gallery access to pick photos.");
                return;
            }

            setAttachMenuVisible(false);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    name: asset.fileName || `image_${Date.now()}.jpg`,
                    type: 'image',
                    mimeType: asset.mimeType || 'image/jpeg'
                });
            }
        } catch (err: any) {
            console.error('Image picker error:', err);
            Alert.alert("Picker Error", err.message);
        } finally {
            isPickingRef.current = false;
        }
    };

    const handleSaveImage = async (url: string) => {
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
            Alert.alert("Save Error", error instanceof Error ? error.message : "Failed to save photo");
        }
    };

    const handleSaveFile = async (url: string, fileName?: string) => {
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
    };

    const handleViewAttachment = (url: string, fileName?: string) => {
        if (!url) return;
        setViewerUrl(url);
        setViewerFileName(fileName || "Attachment");
        setViewerVisible(true);
    };

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

    const handlePickDocument = async () => {
        if (isPickingRef.current) return;
        
        try {
            isPickingRef.current = true;
            setAttachMenuVisible(false);
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    name: asset.name || `doc_${Date.now()}`,
                    type: 'document',
                    mimeType: asset.mimeType || 'application/octet-stream'
                });
            }
        } catch (err: any) {
            console.error('Document picker error:', err);
            Alert.alert("Picker Error", err.message);
        } finally {
            isPickingRef.current = false;
        }
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

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isMe = item.sender_id === currentUserId;
        
        const reversedMessages = [...messages, ...sendingMessages].reverse();
        const newestMyMessageIndex = reversedMessages.findIndex(m => m.sender_id === currentUserId);
        const showStatus = isMe && index === newestMyMessageIndex;
        
        let statusLabel = "";
        let statusIcon: "time-outline" | "checkmark-circle" | "checkmark-done-circle" = "checkmark-circle";
        let statusColor = "#64748B";

        if (showStatus) {
            if (item.status === 'sending') {
                statusLabel = "Sending";
                statusIcon = "time-outline";
                statusColor = "#94A3B8";
            } else if (item.is_read) {
                statusLabel = "Seen";
                statusIcon = "checkmark-done-circle";
                statusColor = Colors.light.primary;
            } else {
                statusLabel = "Delivered";
                statusIcon = "checkmark-circle";
                statusColor = "#64748B";
            }
        }

        const attachmentsList = Array.isArray(item.attachments) && item.attachments.length > 0
            ? item.attachments
            : (item.file_url ? [{ file_url: item.file_url, file_name: item.file_name, file_type: item.file_type, file_size: item.file_size }] : []);

        const hasAttachments = attachmentsList.length > 0;

        return (
            <View style={styles.messageWrapper}>
                <View style={[
                    styles.messageBubble, 
                    isMe ? styles.myMessage : styles.theirMessage,
                    hasAttachments && styles.attachmentBubble
                ]}>
                    
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
                                        onPress={() => handleViewAttachment(attUrl, fileName)}
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
                                        onPress={() => handleViewAttachment(attUrl, fileName)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="open-outline" size={15} color={isMe ? "#FFFFFF" : Colors.light.primary} />
                                        <Text style={[styles.actionButtonText, isMe ? styles.myActionButtonText : styles.theirActionButtonText]} numberOfLines={1}>
                                            View
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.attachmentActionButton, isMe ? styles.myActionButton : styles.theirActionButton]}
                                        onPress={() => isImg ? handleSaveImage(attUrl) : handleSaveFile(attUrl, fileName)}
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
                                    name={item.is_read ? "checkmark-done" : "checkmark"} 
                                    size={13} 
                                    color={item.is_read ? "#93C5FD" : "rgba(255,255,255,0.7)"} 
                                    style={{ marginLeft: 3 }}
                                />
                            )}
                        </View>
                    </View>
                </View>

                {showStatus && (
                    <View style={styles.statusContainer}>
                        <Ionicons name={statusIcon} size={11} color={statusColor} style={{ marginRight: 3 }} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                )}
            </View>
        );
    };

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
                    data={[...messages, ...sendingMessages].reverse()}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    inverted={true}
                    showsVerticalScrollIndicator={false}
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
                            disabled={(!inputText.trim() && !attachment) || isUploading || isSending}
                        >
                            {isSending ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Ionicons name="send" size={18} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Attachment Selection Menu */}
            <Modal
                visible={isAttachMenuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setAttachMenuVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setAttachMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.attachMenu, { bottom: Math.max(insets.bottom, 12) + 60 }]}>
                            <TouchableOpacity style={styles.attachMenuItem} onPress={handlePickImage}>
                                <Ionicons name="image-outline" size={20} color={Colors.light.primary} />
                                <Text style={styles.attachMenuText}>Photo / Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.attachMenuItem} onPress={handlePickDocument}>
                                <Ionicons name="document-text-outline" size={20} color={Colors.light.primary} />
                                <Text style={styles.attachMenuText}>Document / File</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

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
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.3)",
    },
    attachMenu: {
        position: "absolute",
        left: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 6,
        width: 170,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
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
