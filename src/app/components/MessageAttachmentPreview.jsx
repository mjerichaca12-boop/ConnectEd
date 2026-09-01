/**
 * MessageAttachmentPreview.jsx
 * Shared component for rendering message attachments in both AdminMessages and TeacherMessages.
 * Supports: images (thumbnail + lightbox + zoom), PDFs (embedded viewer), documents (icon + metadata + view + download)
 */

import { useState, useCallback, useEffect } from "react";
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

  // Fallback to extension check if fileType is missing or generic (e.g. application/octet-stream)
  let ext = String(fileName || "").split(".").pop().toLowerCase();
  
  // If no extension found in name, or name was just "file", try to extract it from the URL
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

// ─── Image Lightbox ────────────────────────────────────────────────────────────

function ImageLightbox({ url, name, onClose }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));

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
            onClick={zoomOut}
            disabled={zoom <= 0.25}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={zoom >= 4}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <a
            href={url}
            download={name}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
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

function PdfViewerModal({ url, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </a>
          <a
            href={url}
            download={name}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
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

function AttachmentCard({ att, isSelf }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const url = att.url || att.file_url || "";
  const name = att.name || att.file_name || "file";
  const size = att.size || att.file_size || 0;
  const fileType = att.type || att.file_type || "";
  
  // Re-calculate kind robustly based on type and name to fix "generic document" bug
  let kind = getAttachmentKind(fileType, name, url);
  if (kind === "document" && att.kind && att.kind !== "document") {
    kind = att.kind; // Use provided kind if our inference still says document but explicitly set otherwise
  }

  const FileIcon = getFileIcon(fileType, name);
  const sizeLabel = formatFileSize(size);

  // ── Image ──
  if (kind === "image") {
    return (
      <>
        <div className="relative group">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block rounded-xl overflow-hidden border border-white/20 shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-white/50"
            title="Click to view full size"
          >
            <img
              src={url}
              alt={name}
              className="max-w-[220px] max-h-[220px] object-cover rounded-xl"
              loading="lazy"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </button>

          {/* Download button below image */}
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <p className={`text-[11px] truncate max-w-[160px] ${isSelf ? "text-white/70" : "text-gray-500"}`}>
              {name}
            </p>
            <div className="flex items-center gap-1">
              {sizeLabel && (
                <span className={`text-[10px] ${isSelf ? "text-white/50" : "text-gray-400"}`}>{sizeLabel}</span>
              )}
              <a
                href={url}
                download={name}
                target="_blank"
                rel="noreferrer"
                className={`p-1 rounded-md transition-colors ${isSelf ? "hover:bg-white/10 text-white/70" : "hover:bg-gray-200 text-gray-500"}`}
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {lightboxOpen && (
          <ImageLightbox url={url} name={name} onClose={() => setLightboxOpen(false)} />
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
              onClick={() => setPdfOpen(true)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              <ExternalLink className="w-3 h-3" /> View
            </button>
            <a
              href={url}
              download={name}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              <Download className="w-3 h-3" /> Download
            </a>
          </div>
        </div>

        {pdfOpen && (
          <PdfViewerModal url={url} name={name} onClose={() => setPdfOpen(false)} />
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
          <a
            href={url}
            download={name}
            target="_blank"
            rel="noreferrer"
            className={`p-1 rounded-md transition-colors ${isSelf ? "hover:bg-white/10 text-white/70" : "hover:bg-gray-200 text-gray-500"}`}
            title="Download"
          >
            <Download className="w-3 h-3" />
          </a>
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
        <a
          href={url}
          download={name}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
            isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <Download className="w-3 h-3" /> Download
        </a>
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
  // Priority: use msg.attachments[] if available (from message_attachments join)
  // Fallback: use flat fields (file_url, file_name etc.) stored directly on the message row
  const attachments = [];

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
        <AttachmentCard key={att.id || idx} att={att} isSelf={isSelf} />
      ))}
    </div>
  );
}
