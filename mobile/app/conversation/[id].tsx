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

    useEffect(() => {
        // No manual scrolling needed with inverted FlatList
    }, [messages]);

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
            
            // Read file as Base64 for maximum compatibility on Android
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
        console.log('handlePickImage called');
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

            console.log('Image picker result:', result.canceled ? 'cancelled' : 'picked');
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

            // Logging for debugging environment
            console.log('FileSystem State:', { 
                document: FileSystem.documentDirectory, 
                cache: FileSystem.cacheDirectory,
                keys: Object.keys(FileSystem)
            });

            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            
            if (!storageDir) {
                // Fallback for images: just open in browser if library is failing
                Alert.alert("Notice", "Internal storage is unavailable. Opening image in browser...");
                Linking.openURL(url);
                return;
            }

            const cleanUrl = url.split('?')[0];
            const fileExt = cleanUrl.split('.').pop() || 'jpg';
            const fileName = `temp_image_${Date.now()}.${fileExt}`;
            const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;
            
            const { uri } = await FileSystem.downloadAsync(url, fileUri);
            
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert("Success", "Photo saved to your gallery!");
        } catch (error: any) {
            console.error('Save image error:', error);
            Alert.alert("Save Error", error instanceof Error ? error.message : "Failed to save photo");
        }
    };

    const handleSaveFile = async (url: string, fileName?: string) => {
        try {
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            
            if (!storageDir) {
                // Last resort fallback: open in browser
                console.warn('FileSystem unavailable, falling back to Linking.openURL');
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

    const getAttachmentFileName = (fileUrl: string, content?: string) => {
        if (content && content.startsWith('Sent a document: ')) {
            return content.replace('Sent a document: ', '');
        }
        if (fileUrl) {
            try {
                const decoded = decodeURIComponent(fileUrl);
                const parts = decoded.split('/');
                const filenameWithQuery = parts[parts.length - 1];
                const rawFilename = filenameWithQuery.split('?')[0];
                // Strip timestamps e.g. 1787718518717- from storage filename
                return rawFilename.replace(/^\d+-/, '');
            } catch (e) {
                // Fallback
            }
        }
        return 'View Attachment';
    };

    const handleOpenFile = async (url: string, fileName?: string) => {
        try {
            await WebBrowser.openBrowserAsync(url);
        } catch (error) {
            console.error('Failed to open WebBrowser, falling back to download:', error);
            handleSaveFile(url, fileName);
        }
    };

    const handlePickDocument = async () => {
        console.log('handlePickDocument called');
        if (isPickingRef.current) return;
        
        try {
            isPickingRef.current = true;
            // Document picker doesn't need explicit permission request on modern Expo
            setAttachMenuVisible(false);
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
            });

            console.log('Document picker result:', result.canceled ? 'cancelled' : 'picked');
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
            if (err.message?.includes('picking in progress')) {
                // Ignore race condition errors
            } else {
                Alert.alert("Picker Error", err.message);
            }
        } finally {
            isPickingRef.current = false;
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isMe = item.sender_id === currentUserId;
        
        // Find newest message sent by current user to show seen/delivered status under it
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

        return (
            <View style={styles.messageWrapper}>
                <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                    {item.file_url && isImageAttachment(item.file_url, item.file_type) && (
                        <TouchableOpacity onPress={() => handleSaveImage(item.file_url)}>
                            <Image source={{ uri: item.file_url }} style={styles.messageImage} resizeMode="cover" />
                        </TouchableOpacity>
                    )}
                    {item.file_url && !isImageAttachment(item.file_url, item.file_type) && (
                        <TouchableOpacity 
                            style={styles.fileContainer} 
                            onPress={() => handleOpenFile(item.file_url, getAttachmentFileName(item.file_url, item.content))}
                        >
                            <Ionicons name="document-attach" size={24} color={isMe ? "#FFF" : Colors.light.primary} />
                            <Text style={[styles.fileText, { color: isMe ? "#FFF" : Colors.light.text }]} numberOfLines={1}>
                                {getAttachmentFileName(item.file_url, item.content)}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <View style={styles.messageTextContainer}>
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                            {item.content || item.message_text || (item.file_type === 'image' ? 'Photo' : 'Document')}
                        </Text>
                        {(!item.file_url && (
                            String(item.content || item.message_text || '').toLowerCase().includes('attachment') || 
                            String(item.content || item.message_text || '').toLowerCase().includes('document:') || 
                            String(item.content || item.message_text || '').toLowerCase().includes('photo')
                        )) && (
                            <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 2, fontStyle: 'italic', fontWeight: 'bold' }}>
                                ⚠️ Attachment upload failed on sender's device
                            </Text>
                        )}
                        <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
                            {formatTime(item.created_at)}
                        </Text>
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
                    inverted
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
 
                <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    {/* Attachment Preview */}
                    {attachment && (
                        <View style={styles.previewContainer}>
                            <View style={styles.previewContent}>
                                {(attachment.type === 'image' || isImageFileName(attachment.name)) ? (
                                    <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
                                ) : (
                                    <View style={styles.previewFile}>
                                        <Ionicons name="document-outline" size={24} color={Colors.light.primary} />
                                        <Text style={styles.previewFileName} numberOfLines={1}>{attachment.name}</Text>
                                    </View>
                                )}
                                <TouchableOpacity 
                                    style={styles.removeAttachment} 
                                    onPress={() => setAttachment(null)}
                                >
                                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
 
                    <View style={styles.inputContainer}>
                        <TouchableOpacity onPress={() => setAttachMenuVisible(true)} style={styles.attachButton}>
                            <Ionicons name="add" size={24} color={Colors.light.primary} />
                        </TouchableOpacity>
 
                        <TextInput
                            style={styles.input}
                            placeholder="Type a message"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
 
                        <TouchableOpacity 
                            onPress={handleSend} 
                            style={[styles.sendButton, (!inputText.trim() && !attachment && !isUploading && !isSending) && { opacity: 0.5 }]} 
                            disabled={(!inputText.trim() && !attachment) || isUploading || isSending}
                        >
                            {(isUploading || isSending) ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Ionicons name="send" size={20} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Attach Menu Modal */}
            <Modal
                transparent={true}
                visible={isAttachMenuVisible}
                animationType="fade"
                onRequestClose={() => setAttachMenuVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setAttachMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.attachMenu, { bottom: 80 + insets.bottom }]}>
                            <TouchableOpacity style={styles.attachMenuItem} onPress={handlePickDocument}>
                                <Ionicons name="document-text-outline" size={24} color={Colors.light.text} />
                                <Text style={styles.attachMenuText}>Document</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.attachMenuItem} onPress={handlePickImage}>
                                <Ionicons name="image-outline" size={24} color={Colors.light.text} />
                                <Text style={styles.attachMenuText}>Photo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    listContent: {
        padding: 16,
        paddingBottom: 16,
    },
    messageBubble: {
        maxWidth: "80%",
        padding: 12,
        borderRadius: 16,
        marginBottom: 4,
    },
    messageWrapper: {
        width: "100%",
        marginBottom: 8,
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
    myMessage: {
        alignSelf: "flex-end",
        backgroundColor: Colors.light.primary,
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: "flex-start",
        backgroundColor: "#E2E8F0",
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
        marginRight: 8,
    },
    myMessageText: {
        color: "#FFFFFF",
    },
    theirMessageText: {
        color: "#1E293B",
    },
    timeText: {
        fontSize: 10,
        color: "#64748B",
        minWidth: 50,
        textAlign: 'right',
        marginTop: 4,
    },
    myTimeText: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    theirTimeText: {
        color: "#94A3B8",
    },
    messageTextContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
    },
    messageImage: {
        width: 200,
        height: 150,
        borderRadius: 8,
        marginBottom: 8,
    },
    fileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
    },
    fileText: {
        marginLeft: 8,
        fontSize: 14,
        flex: 1,
    },
    inputWrapper: {
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
    },
    previewContainer: {
        padding: 12,
        backgroundColor: "#F8FAFC",
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
        padding: 12,
        backgroundColor: "#FFFFFF",
    },
    attachButton: {
        padding: 8,
        marginRight: 8,
    },
    input: {
        flex: 1,
        backgroundColor: "#F1F5F9",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        maxHeight: 100,
        fontSize: 16,
    },
    sendButton: {
        marginLeft: 8,
        backgroundColor: Colors.light.primary,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.2)",
    },
    attachMenu: {
        position: "absolute",
        left: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 8,
        width: 150,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    attachMenuItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
    },
    attachMenuText: {
        marginLeft: 12,
        fontSize: 16,
        color: Colors.light.text,
    },
});
