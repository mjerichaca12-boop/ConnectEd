import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

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

/**
 * Reliably reads a local file URI (file://, content://, cache paths) into an ArrayBuffer
 * for binary uploads (e.g., Supabase storage).
 *
 * Platform nuances:
 * - iOS: Local file URIs (file://) frequently fail with fetch() because iOS NSURLSession
 *   does not support or drops local file stream connections ("The network connection was lost").
 *   FileSystem.readAsStringAsync({ encoding: 'base64' }) is native, synchronous-backed,
 *   and 100% reliable for iOS local cache/tmp paths.
 *
 * - Android: Some scoped storage and cache paths throw "isn't readable" with FileSystem checks,
 *   so fetch(uri) or ContentResolver native stream can be used as a primary or fallback strategy.
 *
 * - Web / Testing / Fallback: Standard fetch() with response.arrayBuffer() or response.blob()
 *   with FileReader.
 */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
    const isLocalFileUri = uri.startsWith('file://') || uri.startsWith('/') || Platform?.OS === 'ios';

    // Strategy A: If it's iOS or a local file:// URI, try native FileSystem readAsStringAsync first
    if (isLocalFileUri) {
        try {
            const fs = getFileSystem();
            if (fs && typeof fs.readAsStringAsync === 'function') {
                const base64 = await fs.readAsStringAsync(uri, { encoding: 'base64' });
                if (typeof base64 === 'string') {
                    return decode(base64);
                }
            }
        } catch (fsErr) {
            // FileSystem might fail in test environments or on unusual paths, fall through to fetch
        }
    }

    // Strategy B: Try fetch(uri) with arrayBuffer or blob
    try {
        const response = await fetch(uri);
        if (typeof response.arrayBuffer === 'function') {
            return await response.arrayBuffer();
        }
        if (typeof response.blob === 'function') {
            const blob = await response.blob();
            return await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (reader.result instanceof ArrayBuffer) {
                        resolve(reader.result);
                    } else if (typeof reader.result === 'string') {
                        const base64 = reader.result.includes(',')
                            ? reader.result.split(',')[1]
                            : reader.result;
                        resolve(decode(base64));
                    } else {
                        reject(new Error("Unable to read blob as ArrayBuffer"));
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });
        }
    } catch (fetchErr) {
        // Fetch failed, try FileSystem as fallback if not already attempted
    }

    // Strategy C: If Strategy A was not attempted (e.g. content:// URI on Android), try FileSystem now
    if (!isLocalFileUri) {
        try {
            const fs = getFileSystem();
            if (fs && typeof fs.readAsStringAsync === 'function') {
                const base64 = await fs.readAsStringAsync(uri, { encoding: 'base64' });
                if (typeof base64 === 'string') {
                    return decode(base64);
                }
            }
        } catch (fsErr) {
            // Fallback also failed
        }
    }

    throw new Error(`Failed to read file at URI: ${uri}`);
}

