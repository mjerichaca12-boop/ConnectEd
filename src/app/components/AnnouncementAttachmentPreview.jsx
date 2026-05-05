import { useState } from "react";
import { File } from "lucide-react";

const getAttachmentLink = (attachment) => String(attachment?.fileUrl || attachment?.filePath || "").trim();

function AnnouncementAttachmentPreview({ attachment, index = 0, announcementId = "", variant = "light" }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const attachmentLink = getAttachmentLink(attachment);
  const fileName = String(attachment?.fileName || `Attachment ${index + 1}`).trim();
  const fileKind = String(attachment?.kind || "").trim();
  const isDark = variant === "dark";

  const fallbackClassName = isDark
    ? "border-white/10 bg-black/20 text-gray-300"
    : "border-gray-200 bg-gray-50 text-gray-600";
  const documentClassName = isDark
    ? "border-white/10 bg-black/20 text-gray-200 hover:bg-black/30"
    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100";

  if (!attachmentLink || loadFailed) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm ${fallbackClassName}`}
        role="status"
      >
        <File className="h-4 w-4" />
        <span>File not available</span>
      </div>
    );
  }

  if (fileKind === "image") {
    return (
      <a href={attachmentLink} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachmentLink}
          alt={fileName || `Attachment ${index + 1}`}
          loading="lazy"
          onError={() => setLoadFailed(true)}
          className={`w-full max-h-80 rounded-xl border object-cover ${isDark ? "border-white/10" : "border-gray-200"}`}
        />
      </a>
    );
  }

  if (fileKind === "video") {
    return (
      <div className={`overflow-hidden rounded-xl border ${isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-gray-50"}`}>
        <video
          controls
          src={attachmentLink}
          onError={() => setLoadFailed(true)}
          className="w-full max-h-80 bg-black"
        />
      </div>
    );
  }

  return (
    <a
      href={attachmentLink}
      target="_blank"
      rel="noreferrer"
      download={fileName}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${documentClassName}`}
      onClick={(event) => {
        if (!attachmentLink) {
          event.preventDefault();
          setLoadFailed(true);
        }
      }}
      title={fileName}
      data-announcement-id={announcementId}
    >
      <File className="h-3 w-3" />
      <span className="truncate max-w-[16rem]">{fileName}</span>
    </a>
  );
}

export { AnnouncementAttachmentPreview };