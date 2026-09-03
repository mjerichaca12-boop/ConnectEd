/**
 * MessageAttachmentPreview.jsx
 * Shared component for rendering message attachments in both AdminMessages and TeacherMessages.
 * Supports: images (thumbnail + lightbox + zoom), PDFs (embedded viewer), documents (icon + metadata + view + download)
 */

import { useState, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  FileText,
  File,
  FileImage,
  Film,
  Archive,
  Sheet,
  Presentation,
  Loader2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const PDF_TYPE = "application/pdf";
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

export function getAttachmentKind(fileType, fileName, fileUrl = "") {
  const t = String(fileType || "").toLowerCase();
  if (IMAGE_TYPES.some((it) => t === it) || t.startsWith("image/")) return "image";
  if (t === PDF_TYPE) return "pdf";
  if (VIDEO_TYPES.some((vt) => t === vt) || t.startsWith("video/")) return "video";

  let ext = String(fileName || "").split(".").pop().toLowerCase();
  
  if (!ext || ext === String(fileName || "").toLowerCase() || ext === "file") {
    ext = String(fileUrl || "").split("?")[0].split(".").pop().toLowerCase();
  }

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["pdf"].includes(ext)) return "pdf";
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video";

  return "document";
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType, fileName) {
  const t = String(fileType || "").toLowerCase();
  const ext = String(fileName || "").split(".").pop().toLowerCase();

  if (t.startsWith("image/")) return FileImage;
  if (t.startsWith("video/")) return Film;
  if (t === "application/pdf" || ext === "pdf") return FileText;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
  if (["xls", "xlsx", "csv"].includes(ext) || t.includes("spreadsheet") || t.includes("excel")) return Sheet;
  if (["ppt", "pptx"].includes(ext) || t.includes("presentation") || t.includes("powerpoint")) return Presentation;
  if (["doc", "docx"].includes(ext) || t.includes("word") || t.includes("document")) return FileText;
  return File;
}

/**
 * Sanitizes a string for safe use as a filename in Windows/macOS/Linux OSes.
 */
export function sanitizeFileName(str) {
  if (!str) return "attachment";
  let clean = String(str).replace(/[\\/:*?"<>|]/g, "_").trim();
  return clean || "attachment";
}

/**
 * Formats a descriptive, clear filename while preserving the original extension.
 */
export function formatDescriptiveFileName(originalName, senderName = "", fileUrl = "") {
  let name = String(originalName || "").trim();

  const isGeneric = !name || name.toLowerCase() === "file" || name.toLowerCase() === "download" || /^[0-9a-f-]{24,}$/i.test(name);

  let ext = "";
  if (name.includes(".")) {
    ext = name.split(".").pop().toLowerCase();
  }
  if (!ext && fileUrl) {
    const urlPath = fileUrl.split("?")[0];
    if (urlPath.includes(".")) {
      ext = urlPath.split(".").pop().toLowerCase();
    }
  }

  let baseName = name;
  if (ext && baseName.toLowerCase().endsWith("." + ext)) {
    baseName = baseName.slice(0, -(ext.length + 1));
  }

  baseName = sanitizeFileName(baseName);

  if (isGeneric || !baseName || baseName.toLowerCase() === "file" || baseName.toLowerCase() === "download") {
    baseName = "Attachment";
  }

  let formatted = baseName;
  if (senderName) {
    const cleanSender = sanitizeFileName(senderName).replace(/\s+/g, "");
    if (!formatted.toLowerCase().startsWith("message_")) {
      formatted = `Message_${cleanSender}_${formatted}`;
    }
  } else if (!formatted.toLowerCase().startsWith("message_")) {
    formatted = `Message_Attachment_${formatted}`;
  }

  if (ext && !formatted.toLowerCase().endsWith("." + ext)) {
    formatted = `${formatted}.${ext}`;
  }

  return formatted;
}

/**
 * Downloads a file as a blob to force browsers to respect the custom filename for cross-origin URLs.
 */
export async function downloadAttachmentFile(url, rawFileName, senderName = "") {
  if (!url) return;

  const fileName = formatDescriptiveFileName(rawFileName, senderName, url);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  } catch (err) {
    console.warn("[downloadAttachmentFile] Fallback to direct window link:", err);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ─── Image Lightbox ────────────────────────────────────────────────────────────

function ImageLightbox({ url, name, senderName, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    await downloadAttachmentFile(url, name, senderName);
    setDownloading(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/80 text-sm truncate max-w-xs">{name}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= 0.25}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= 4}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Download file with descriptive filename"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={name}
          draggable={false}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s ease" }}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
        />
      </div>
    </div>
  );
}

// ─── PDF Viewer Modal ──────────────────────────────────────────────────────────

function PdfViewerModal({ url, name, senderName, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    await downloadAttachmentFile(url, name, senderName);
    setDownloading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-md">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 flex-shrink-0">
        <p className="text-white/80 text-sm truncate max-w-xs">{name}</p>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors cursor-pointer"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </a>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors cursor-pointer"
            title="Download file with descriptive filename"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Embed */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={`${url}#toolbar=1&navpanes=1`}
          title={name}
          className="w-full h-full border-0"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

// ─── Single Attachment Card ────────────────────────────────────────────────────

function AttachmentCard({ att, isSelf, senderName }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const url = att.url || att.file_url || "";
  const name = att.name || att.file_name || "file";
  const size = att.size || att.file_size || 0;
  const fileType = att.type || att.file_type || "";
  
  let kind = getAttachmentKind(fileType, name, url);
  if (kind === "document" && att.kind && att.kind !== "document") {
    kind = att.kind;
  }

  const FileIcon = getFileIcon(fileType, name);
  const sizeLabel = formatFileSize(size);

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    await downloadAttachmentFile(url, name, senderName);
    setDownloading(false);
  };

  // ── Image ──
  if (kind === "image") {
    return (
      <>
        <div className="relative group">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block rounded-xl overflow-hidden border border-white/20 shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
            title="Click to view full size"
          >
            <img
              src={url}
              alt={name}
              className="max-w-[220px] max-h-[220px] object-cover rounded-xl"
              loading="lazy"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </button>

          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <p className={`text-[11px] truncate max-w-[160px] ${isSelf ? "text-white/70" : "text-gray-500"}`}>
              {name}
            </p>
            <div className="flex items-center gap-1">
              {sizeLabel && (
                <span className={`text-[10px] ${isSelf ? "text-white/50" : "text-gray-400"}`}>{sizeLabel}</span>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className={`p-1 rounded-md transition-colors cursor-pointer ${isSelf ? "hover:bg-white/10 text-white/70" : "hover:bg-gray-200 text-gray-500"}`}
                title="Download"
              >
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {lightboxOpen && (
          <ImageLightbox url={url} name={name} senderName={senderName} onClose={() => setLightboxOpen(false)} />
        )}
      </>
    );
  }

  // ── PDF ──
  if (kind === "pdf") {
    return (
      <>
        <div className={`flex flex-col gap-1.5 p-2.5 rounded-xl border ${isSelf ? "border-white/20 bg-white/10" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex items-start gap-2.5">
            <div className={`p-2 rounded-lg flex-shrink-0 ${isSelf ? "bg-white/15" : "bg-red-50 border border-red-100"}`}>
              <FileText className={`w-5 h-5 ${isSelf ? "text-white/80" : "text-red-500"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isSelf ? "text-white" : "text-gray-800"}`}>{name}</p>
              {sizeLabel && (
                <p className={`text-[11px] ${isSelf ? "text-white/60" : "text-gray-400"}`}>{sizeLabel} • PDF</p>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPdfOpen(true)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              <ExternalLink className="w-3 h-3" /> View
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Download
            </button>
          </div>
        </div>

        {pdfOpen && (
          <PdfViewerModal url={url} name={name} senderName={senderName} onClose={() => setPdfOpen(false)} />
        )}
      </>
    );
  }

  // ── Video ──
  if (kind === "video") {
    return (
      <div className="rounded-xl overflow-hidden border border-white/20 shadow-md">
        <video
          src={url}
          controls
          className="max-w-[280px] rounded-xl"
          preload="metadata"
        >
          Your browser does not support video.
        </video>
        <div className={`flex items-center justify-between px-2 py-1 ${isSelf ? "bg-white/10" : "bg-gray-50"}`}>
          <p className={`text-[11px] truncate max-w-[160px] ${isSelf ? "text-white/70" : "text-gray-500"}`}>{name}</p>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className={`p-1 rounded-md transition-colors cursor-pointer ${isSelf ? "hover:bg-white/10 text-white/70" : "hover:bg-gray-200 text-gray-500"}`}
            title="Download"
          >
            {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          </button>
        </div>
      </div>
    );
  }

  // ── Generic Document ──
  return (
    <div className={`flex flex-col gap-1.5 p-2.5 rounded-xl border ${isSelf ? "border-white/20 bg-white/10" : "border-gray-200 bg-gray-50"}`}>
      <div className="flex items-start gap-2.5">
        <div className={`p-2 rounded-lg flex-shrink-0 ${isSelf ? "bg-white/15" : "bg-blue-50 border border-blue-100"}`}>
          <FileIcon className={`w-5 h-5 ${isSelf ? "text-white/80" : "text-blue-500"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isSelf ? "text-white" : "text-gray-800"}`}>{name}</p>
          {sizeLabel && (
            <p className={`text-[11px] ${isSelf ? "text-white/60" : "text-gray-400"}`}>{sizeLabel}</p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
            isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <ExternalLink className="w-3 h-3" /> View
        </a>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Download
        </button>
      </div>
    </div>
  );
}

// ─── Main Export: MessageAttachmentPreview ─────────────────────────────────────

/**
 * Props:
 *   msg        – the message object (has .attachments[], .fileUrl, .fileName, .fileType, .fileSize, .attachmentKind)
 *   isSelf     – true if this message was sent by the current user (controls color scheme)
 */
export function MessageAttachmentPreview({ msg, isSelf }) {
  const attachments = [];
  const senderName = msg?.senderName || msg?.sender_name || msg?.senderNameFormatted || "";

  if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    msg.attachments.forEach((a) => attachments.push(a));
  } else if (msg.fileUrl || msg.fileName) {
    attachments.push({
      url: msg.fileUrl,
      name: msg.fileName,
      type: msg.fileType,
      size: msg.fileSize,
      kind: msg.attachmentKind || getAttachmentKind(msg.fileType),
    });
  }

  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 space-y-2">
      {attachments.map((att, idx) => (
        <AttachmentCard key={att.id || idx} att={att} isSelf={isSelf} senderName={senderName} />
      ))}
    </div>
  );
}
