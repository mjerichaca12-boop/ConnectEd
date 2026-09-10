import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    resolveStorageUrl,
    isImageFileType,
    getFileExtension,
    getSanitizedFileName,
    getMimeTypeFromFileName,
    autoDownloadFile
} from '../file-downloader';
import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';

vi.mock('../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: vi.fn((bucket: string) => ({
                getPublicUrl: vi.fn((path: string) => ({
                    data: {
                        publicUrl: `https://mock-supabase.co/storage/v1/object/public/${bucket}/${path}`,
                    },
                })),
            })),
        },
    },
}));

vi.mock('expo-linking', () => ({
    openURL: vi.fn().mockResolvedValue(true),
}));

describe('file-downloader utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('resolveStorageUrl', () => {
        it('returns empty string for null, undefined, or non-strings', () => {
            expect(resolveStorageUrl(null)).toBe('');
            expect(resolveStorageUrl(undefined)).toBe('');
            expect(resolveStorageUrl('' as any)).toBe('');
            expect(resolveStorageUrl(123 as any)).toBe('');
        });

        it('returns full http/https URLs as-is', () => {
            const url = 'https://example.com/files/lecture1.pdf';
            expect(resolveStorageUrl(url)).toBe(url);
        });

        it('returns data and blob URLs as-is', () => {
            const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            expect(resolveStorageUrl(dataUrl)).toBe(dataUrl);
        });

        it('resolves relative paths with known bucket prefixes', () => {
            expect(resolveStorageUrl('class-materials/algebra/lesson1.pdf')).toBe(
                'https://mock-supabase.co/storage/v1/object/public/class-materials/algebra/lesson1.pdf'
            );
            expect(resolveStorageUrl('assignment-attachments/task1.docx')).toBe(
                'https://mock-supabase.co/storage/v1/object/public/assignment-attachments/task1.docx'
            );
            expect(resolveStorageUrl('announcements/notice.png')).toBe(
                'https://mock-supabase.co/storage/v1/object/public/announcements/notice.png'
            );
        });

        it('uses defaultBucket when path has no known bucket prefix', () => {
            expect(resolveStorageUrl('my-folder/document.pdf', 'class-materials')).toBe(
                'https://mock-supabase.co/storage/v1/object/public/class-materials/my-folder/document.pdf'
            );
        });

        it('extracts first item from JSON array strings', () => {
            const jsonArray = '["https://example.com/item1.pdf", "https://example.com/item2.pdf"]';
            expect(resolveStorageUrl(jsonArray)).toBe('https://example.com/item1.pdf');
        });
    });

    describe('isImageFileType', () => {
        it('identifies image file names and extensions correctly', () => {
            expect(isImageFileType('photo.jpg')).toBe(true);
            expect(isImageFileType('picture.png')).toBe(true);
            expect(isImageFileType('graphic.webp')).toBe(true);
            expect(isImageFileType('drawing.svg')).toBe(true);
            expect(isImageFileType('animation.gif')).toBe(true);
        });

        it('identifies non-image files correctly', () => {
            expect(isImageFileType('document.pdf')).toBe(false);
            expect(isImageFileType('notes.docx')).toBe(false);
            expect(isImageFileType('archive.zip')).toBe(false);
            expect(isImageFileType('data.csv')).toBe(false);
        });

        it('identifies image mime types', () => {
            expect(isImageFileType(undefined, undefined, 'image/jpeg')).toBe(true);
            expect(isImageFileType(undefined, undefined, 'image/png')).toBe(true);
            expect(isImageFileType(undefined, undefined, 'application/pdf')).toBe(false);
        });
    });

    describe('getFileExtension', () => {
        it('extracts extension from file name or url', () => {
            expect(getFileExtension('sample.pdf')).toBe('pdf');
            expect(getFileExtension('archive.tar.gz')).toBe('gz');
            expect(getFileExtension(undefined, 'https://example.com/image.png?v=123')).toBe('png');
        });

        it('returns empty string if no valid extension', () => {
            expect(getFileExtension('noextension')).toBe('');
        });
    });

    describe('getSanitizedFileName', () => {
        it('sanitizes illegal file system characters and spaces', () => {
            const raw = 'Math 101: Chapter 1 / Section 2 <Final>?.pdf';
            const sanitized = getSanitizedFileName(raw);
            expect(sanitized).not.toContain(':');
            expect(sanitized).not.toContain('/');
            expect(sanitized).not.toContain('<');
            expect(sanitized).not.toContain('>');
            expect(sanitized).not.toContain('?');
            expect(sanitized).toBe('Math 101_ Chapter 1 _ Section 2 _Final__.pdf');
        });

        it('infers extension from url if missing in fileName', () => {
            const sanitized = getSanitizedFileName('Calculus Notes', 'https://example.com/file.pdf');
            expect(sanitized).toBe('Calculus Notes.pdf');
        });

        it('generates a fallback file name when none is provided', () => {
            const sanitized = getSanitizedFileName(null, null);
            expect(sanitized).toMatch(/^file_\d+$/);
        });
    });

    describe('getMimeTypeFromFileName', () => {
        it('returns appropriate mime types for standard extensions', () => {
            expect(getMimeTypeFromFileName('test.pdf')).toBe('application/pdf');
            expect(getMimeTypeFromFileName('image.png')).toBe('image/png');
            expect(getMimeTypeFromFileName('doc.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            expect(getMimeTypeFromFileName('sheet.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(getMimeTypeFromFileName('unknown.xyz')).toBe('application/octet-stream');
        });
    });

    describe('autoDownloadFile', () => {
        it('returns error if URL is empty or invalid', async () => {
            const alertSpy = vi.spyOn(Alert, 'alert');
            const result = await autoDownloadFile({ url: '' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid URL');
            expect(alertSpy).toHaveBeenCalled();
        });

        it('handles web platform download via DOM anchor and falls back to Linking', async () => {
            const origPlatform = Platform.OS;
            (Platform as any).OS = 'web';

            const mockAppendChild = vi.fn();
            const mockRemoveChild = vi.fn();
            const mockClick = vi.fn();
            const mockAnchor = {
                href: '',
                download: '',
                target: '',
                rel: '',
                click: mockClick,
            };

            const origDocument = global.document;
            (global as any).document = {
                createElement: vi.fn().mockReturnValue(mockAnchor),
                body: {
                    appendChild: mockAppendChild,
                    removeChild: mockRemoveChild,
                },
            };

            const result = await autoDownloadFile({
                url: 'https://example.com/document.pdf',
                fileName: 'document.pdf',
            });

            expect(result.success).toBe(true);
            expect(mockAnchor.download).toBe('document.pdf');
            expect(mockClick).toHaveBeenCalled();
            expect(mockAppendChild).toHaveBeenCalled();
            expect(mockRemoveChild).toHaveBeenCalled();

            (global as any).document = origDocument;
            (Platform as any).OS = origPlatform;
        });
    });
});
