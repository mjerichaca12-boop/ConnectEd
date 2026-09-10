import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

function getFileSystem(): any {
    try {
        return require('expo-file-system/legacy');
    } catch {
        try {
            return require('expo-file-system');
        } catch {
            return null;
        }
    }
}

function getSharing(): any {
    try {
        return require('expo-sharing');
    } catch {
        return null;
    }
}

function getMediaLibrary(): any {
    try {
        return require('expo-media-library/legacy');
    } catch {
        try {
            return require('expo-media-library');
        } catch {
            return null;
        }
    }
}

export interface DownloadOptions {
    url: string;
    fileName?: string | null;
    defaultBucket?: string;
    showSuccessAlert?: boolean;
    showErrorAlert?: boolean;
    saveToGalleryIfImage?: boolean;
}

export interface DownloadResult {
    success: boolean;
    uri?: string;
    error?: string;
}

const KNOWN_BUCKETS = [
    'class-materials',
    'assignment-attachments',
    'announcements',
    'chat-attachments',
    'avatars',
    'submissions',
];

/**
 * Resolves a raw file string (which could be a full URL, relative Supabase storage path,
 * or JSON array string) into an absolute public URL.
 */
export function resolveStorageUrl(urlOrPath?: string | null, defaultBucket: string = 'class-materials'): string {
    if (!urlOrPath || typeof urlOrPath !== 'string') return '';
    
    let trimmed = urlOrPath.trim();
    if (!trimmed) return '';

    // Remove wrapping quotes if present
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        trimmed = trimmed.slice(1, -1).trim();
    }

    // Handle JSON arrays e.g. ["url1", "url2"]
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return resolveStorageUrl(parsed[0], defaultBucket);
            }
        } catch {
            // Not valid JSON, proceed with trimmed string
        }
    }

    // If already absolute URL or data/blob URI
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('file://')
    ) {
        return trimmed;
    }

    // Check if path starts with a known bucket prefix
    for (const bucket of KNOWN_BUCKETS) {
        if (trimmed.startsWith(`${bucket}/`)) {
            const cleanPath = trimmed.replace(`${bucket}/`, '');
            const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
            return data?.publicUrl || trimmed;
        }
    }

    // Use defaultBucket
    const bucket = defaultBucket || 'class-materials';
    const { data } = supabase.storage.from(bucket).getPublicUrl(trimmed);
    return data?.publicUrl || trimmed;
}

/**
 * Checks whether a given file name, URL, or mime type represents an image.
 */
export function isImageFileType(fileName?: string | null, url?: string | null, mimeType?: string | null): boolean {
    if (mimeType && mimeType.toLowerCase().startsWith('image/')) return true;
    
    const lowerName = (fileName || '').toLowerCase();
    const lowerUrl = (url || '').split('?')[0].toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.tif', '.tiff'];

    return imageExtensions.some(ext => lowerName.endsWith(ext) || lowerUrl.endsWith(ext));
}

/**
 * Returns a normalized file extension from a file name or URL.
 */
export function getFileExtension(fileName?: string | null, url?: string | null): string {
    const raw = (fileName || '').trim() || (url || '').split('?')[0].trim();
    const parts = raw.split('.');
    if (parts.length > 1) {
        const ext = parts.pop()?.toLowerCase() || '';
        if (ext.length <= 5 && /^[a-z0-9]+$/i.test(ext)) {
            return ext;
        }
    }
    return '';
}

/**
 * Returns standard MIME type for sharing / opening files.
 */
export function getMimeTypeFromFileName(fileName?: string | null, url?: string | null): string {
    const ext = getFileExtension(fileName, url);
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'xls': return 'application/vnd.ms-excel';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'ppt': return 'application/vnd.ms-powerpoint';
        case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'svg': return 'image/svg+xml';
        case 'txt': return 'text/plain';
        case 'csv': return 'text/csv';
        case 'zip': return 'application/zip';
        default: return 'application/octet-stream';
    }
}

/**
 * Sanitizes a file name for saving locally.
 */
export function getSanitizedFileName(fileName?: string | null, url?: string | null): string {
    let base = (fileName || '').trim();

    if (!base && url) {
        try {
            const urlPath = url.split('?')[0];
            const lastPart = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            base = decodeURIComponent(lastPart);
        } catch {
            base = `file_${Date.now()}`;
        }
    }

    if (!base) {
        base = `file_${Date.now()}`;
    }

    // Replace invalid file system characters with underscores
    let sanitized = base.replace(/[\\/:*?"<>|]/g, '_').trim();

    // Ensure extension exists if url has one
    const extInName = getFileExtension(sanitized);
    const extInUrl = getFileExtension(undefined, url);
    if (!extInName && extInUrl) {
        sanitized = `${sanitized}.${extInUrl}`;
    }

    return sanitized || `download_${Date.now()}`;
}

/**
 * Main auto-download function:
 * - Automatically resolves the URL from Supabase storage or direct links.
 * - On Web: initiates an automatic browser file download anchor click.
 * - On iOS/Android: downloads locally with FileSystem, saves to Gallery if photo, or opens native Share/Save sheet.
 * - Automatically falls back to browser opening if native saving encounters any issue.
 */
export async function autoDownloadFile(options: DownloadOptions): Promise<DownloadResult> {
    const fullUrl = resolveStorageUrl(options.url, options.defaultBucket);
    if (!fullUrl) {
        if (options.showErrorAlert !== false) {
            Alert.alert("Download Error", "The file link is invalid or unavailable.");
        }
        return { success: false, error: "Invalid URL" };
    }

    const safeFileName = getSanitizedFileName(options.fileName, fullUrl);

    // ── 1. Web Platform ──
    if (Platform.OS === 'web') {
        try {
            if (typeof document !== 'undefined') {
                const link = document.createElement('a');
                link.href = fullUrl;
                link.download = safeFileName;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return { success: true, uri: fullUrl };
            }
        } catch (webErr) {
            console.warn('[FileDownloader] Web DOM anchor click failed, falling back to Linking:', webErr);
        }

        try {
            await Linking.openURL(fullUrl);
            return { success: true, uri: fullUrl };
        } catch (linkErr: any) {
            if (options.showErrorAlert !== false) {
                Alert.alert("Download Error", "Could not open download link.");
            }
            return { success: false, error: linkErr?.message || "Failed to open link" };
        }
    }

    // ── 2. Native Mobile (iOS / Android) ──
    try {
        const fs = getFileSystem();
        const storageDir = fs?.documentDirectory || fs?.cacheDirectory;

        if (!storageDir || !fs?.downloadAsync) {
            // Fallback to direct URL opening if FileSystem is unavailable
            await Linking.openURL(fullUrl);
            return { success: true, uri: fullUrl };
        }

        const fileUri = storageDir.endsWith('/') ? `${storageDir}${safeFileName}` : `${storageDir}/${safeFileName}`;

        // Download the file locally
        const downloadResult = await fs.downloadAsync(fullUrl, fileUri);
        const localUri = downloadResult?.uri || fileUri;

        // If it's an image and gallery saving is enabled
        const isImg = isImageFileType(safeFileName, fullUrl);
        if (options.saveToGalleryIfImage !== false && isImg) {
            const ml = getMediaLibrary();
            if (ml && typeof ml.requestPermissionsAsync === 'function') {
                try {
                    const { status } = await ml.requestPermissionsAsync();
                    if (status === 'granted' && typeof ml.saveToLibraryAsync === 'function') {
                        await ml.saveToLibraryAsync(localUri);
                        if (options.showSuccessAlert !== false) {
                            Alert.alert("Saved", "Photo saved to your gallery!");
                        }
                        return { success: true, uri: localUri };
                    }
                } catch (mlErr) {
                    console.warn("[FileDownloader] MediaLibrary failed, falling back to Share:", mlErr);
                }
            }
        }

        // Share / Save native sheet
        const sharing = getSharing();
        if (sharing && typeof sharing.isAvailableAsync === 'function' && (await sharing.isAvailableAsync())) {
            const mimeType = getMimeTypeFromFileName(safeFileName, fullUrl);
            await sharing.shareAsync(localUri, {
                dialogTitle: `Save or open ${safeFileName}`,
                mimeType: mimeType || undefined,
                UTI: isImg ? 'public.image' : undefined,
            });
            return { success: true, uri: localUri };
        } else {
            if (options.showSuccessAlert !== false) {
                Alert.alert("Success", "File downloaded successfully.");
            }
            return { success: true, uri: localUri };
        }
    } catch (nativeErr: any) {
        console.warn("[FileDownloader] Native download encountered error, falling back to browser redirect:", nativeErr);
        try {
            await Linking.openURL(fullUrl);
            return { success: true, uri: fullUrl };
        } catch (fallbackErr: any) {
            if (options.showErrorAlert !== false) {
                Alert.alert("Download Error", nativeErr?.message || "Failed to download file.");
            }
            return { success: false, error: nativeErr?.message || "Download failed" };
        }
    }
}
