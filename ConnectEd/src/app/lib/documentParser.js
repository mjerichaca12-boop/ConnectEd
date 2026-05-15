import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export async function parsePDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF with worker
    // disableStream + disableAutoFetch: fixes "ReadableStream is not iterable" on
    // older mobile browsers (iOS Safari < 16.4) which lack ReadableStream async iteration.
    // isOffscreenCanvasSupported: false fixes canvas errors on Android WebView / mobile Safari.
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
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
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
    // For PowerPoint files, we'll need to use a different approach
    // Since direct PPT parsing in browser is complex, we'll extract text using a workaround
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert to base64 and try to extract text
    // This is a simplified approach - for production, consider using a proper PPT parser
    const blob = new Blob([arrayBuffer], { type: file.type });
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // For PPT files, we'll need to inform user about limitations
        // or implement a server-side parsing solution
        resolve('PowerPoint file detected. Text extraction requires server-side processing. The file has been uploaded for AI analysis.');
      };
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    
    return text;
  } catch (error) {
    console.error('Error parsing PowerPoint:', error);
    throw new Error('Failed to parse PowerPoint file');
  }
}

export async function parseDocument(file) {
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  try {
    switch (fileExtension) {
      case 'pdf':
        return await parsePDF(file);
      
      case 'doc':
      case 'docx':
        return await parseWord(file);
      
      case 'ppt':
      case 'pptx':
        return await parsePowerPoint(file);
      
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
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      
      default:
        // For unsupported files, return a message indicating the file type
        return `File uploaded: ${file.name} (${fileExtension.toUpperCase()} file). Text extraction not supported for this file type. The file has been uploaded for AI analysis.`;
    }
  } catch (error) {
    console.error(`Error parsing ${fileExtension} file:`, error);
    throw error;
  }
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
