import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure PDF.js worker using standard Vite syntax
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;
}

// ── In-memory parse cache ──────────────────────────────────────
// Keyed by "filename|filesize" to avoid re-processing the same file
const _docCache = new Map();
const _cacheKey = (file) => `${file.name}|${file.size}`;
export const clearDocCache = () => _docCache.clear();

export async function parsePDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      isEvalSupported: false,
      disableStream: true,
      disableAutoFetch: true,
      isOffscreenCanvasSupported: false,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    return fullText.trim();
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file: ' + error.message);
  }
}

export async function parseWord(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw new Error('Failed to parse Word document');
  }
}

export async function parsePowerPoint(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Collect all slide XML files sorted by slide number
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) {
      return `[PowerPoint] No slide text could be extracted from ${file.name}.`;
    }

    const slideTexts = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xmlContent = await zip.files[slideFiles[i]].async('string');
      // Extract all <a:t> text nodes from the slide XML
      const textMatches = [...xmlContent.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g)];
      const slideText = textMatches.map(m => m[1]).join(' ').trim();
      if (slideText) {
        slideTexts.push(`[Slide ${i + 1}]\n${slideText}`);
      }
    }

    return slideTexts.length > 0
      ? slideTexts.join('\n\n')
      : `[PowerPoint] Slides in ${file.name} appear to contain no extractable text (may be image-based).`;
  } catch (error) {
    console.error('Error parsing PowerPoint:', error);
    throw new Error('Failed to parse PowerPoint file: ' + error.message);
  }
}

export async function parseDocument(file) {
  // Check cache first
  const key = _cacheKey(file);
  if (_docCache.has(key)) {
    console.log(`[documentParser] Cache hit for: ${file.name}`);
    return _docCache.get(key);
  }

  const fileExtension = file.name.split('.').pop().toLowerCase();
  let result;

  try {
    switch (fileExtension) {
      case 'pdf':
        result = await parsePDF(file);
        break;
      case 'doc':
      case 'docx':
        result = await parseWord(file);
        break;
      case 'ppt':
      case 'pptx':
        result = await parsePowerPoint(file);
        break;
      case 'txt':
      case 'md':
      case 'csv':
      case 'json':
      case 'html':
      case 'xml':
      case 'rtf':
      case 'odt':
      case 'ods':
      case 'xls':
      case 'xlsx':
        result = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        break;
      default:
        result = `File uploaded: ${file.name} (${fileExtension.toUpperCase()} file). Text extraction not supported for this file type.`;
    }
  } catch (error) {
    console.error(`Error parsing ${fileExtension} file:`, error);
    throw error;
  }

  // Store in cache
  _docCache.set(key, result);
  return result;
}

export function getSupportedFileTypes() {
  return {
    extensions: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.json', '.html', '.xml', '.rtf', '.odt', '.ods', '.xls', '.xlsx'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'text/html',
      'application/xml',
      'text/xml',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  };
}
