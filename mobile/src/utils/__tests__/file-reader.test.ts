import { describe, it, expect, vi } from 'vitest';
import { readFileAsArrayBuffer } from '../file-reader';

describe('readFileAsArrayBuffer', () => {
    it('should read file using fetch arrayBuffer when available', async () => {
        const mockBuffer = new ArrayBuffer(8);
        const mockFetch = vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
        });
        global.fetch = mockFetch;

        const result = await readFileAsArrayBuffer('file:///test/path.pdf');
        expect(result).toBe(mockBuffer);
        expect(mockFetch).toHaveBeenCalledWith('file:///test/path.pdf');
    });

    it('should fallback to reading blob when arrayBuffer is not on response', async () => {
        const mockBuffer = new ArrayBuffer(16);
        const mockBlob = new Blob(['hello']);
        const mockFetch = vi.fn().mockResolvedValue({
            blob: vi.fn().mockResolvedValue(mockBlob),
        });
        global.fetch = mockFetch;

        // Mock FileReader
        class MockFileReader {
            onloadend: (() => void) | null = null;
            result: ArrayBuffer | null = null;
            readAsArrayBuffer(_blob: any) {
                this.result = mockBuffer;
                if (this.onloadend) this.onloadend();
            }
        }
        (global as any).FileReader = MockFileReader;

        const result = await readFileAsArrayBuffer('file:///test/path.pdf');
        expect(result).toBe(mockBuffer);
    });

    it('should decode base64 string if FileReader returns data URL', async () => {
        // Base64 for "Hello World" is "SGVsbG8gV29ybGQ="
        const mockBlob = new Blob(['hello']);
        const mockFetch = vi.fn().mockResolvedValue({
            blob: vi.fn().mockResolvedValue(mockBlob),
        });
        global.fetch = mockFetch;

        class MockFileReaderBase64 {
            onloadend: (() => void) | null = null;
            result: string | null = null;
            readAsArrayBuffer(_blob: any) {
                this.result = 'data:image/jpeg;base64,SGVsbG8gV29ybGQ=';
                if (this.onloadend) this.onloadend();
            }
        }
        (global as any).FileReader = MockFileReaderBase64;

        const result = await readFileAsArrayBuffer('file:///test/image.jpg');
        expect(result).toBeInstanceOf(ArrayBuffer);
        const decodedString = Buffer.from(result).toString('utf-8');
        expect(decodedString).toBe('Hello World');
    });

    it('should throw an error when all reading strategies fail', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
        await expect(readFileAsArrayBuffer('content://invalid/path')).rejects.toThrow('Failed to read file at URI: content://invalid/path');
    });
});

