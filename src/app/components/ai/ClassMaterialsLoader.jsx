import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { parseDocument } from "@/app/lib/documentParser";
import { BookOpen, Check, Loader2, FileText, File as FileIcon, Table, Presentation, AlertCircle } from "lucide-react";

const STORAGE_BUCKET = "class-materials";

export function ClassMaterialsLoader({ selectedClassId, onMaterialsLoaded }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState(null);
  const [enabledIds, setEnabledIds] = useState(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedClassId || !supabase) {
      setMaterials([]);
      setEnabledIds(new Set());
      setError("");
      return;
    }

    const fetchMaterials = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: lessons, error: lessonsErr } = await supabase
          .from("lessons")
          .select("id")
          .eq("subject_id", selectedClassId);

        if (lessonsErr) throw lessonsErr;

        const lessonIds = (lessons || []).map((l) => l.id);

        if (lessonIds.length === 0) {
          setMaterials([]);
          return;
        }

        const { data: lessonMaterials, error: materialsErr } = await supabase
          .from("lesson_materials")
          .select("id, file_name, file_type, file_url, created_at")
          .in("lesson_id", lessonIds);

        if (materialsErr) throw materialsErr;

        setMaterials(
          (lessonMaterials || []).map((m) => {
            const fileUrl = String(m.file_url || "").trim();
            const filePath = fileUrl ? fileUrl.split('/object/public/class-materials/')[1] || "" : "";
            
            return {
              id: String(m.id),
              title: String(m.file_name || "Untitled").trim(),
              fileType: String(m.file_type || "").trim().toUpperCase(),
              filePath,
              fileUrl,
              fileName: String(m.file_name || "").trim(),
              createdAt: m.created_at,
            };
          })
        );
      } catch (err) {
        console.error("ClassMaterialsLoader: fetch error", err);
        setError("Could not load class materials.");
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [selectedClassId]);

  useEffect(() => {
    setEnabledIds(new Set());
    onMaterialsLoaded?.([]);
  }, [selectedClassId]);

  const toggleMaterial = useCallback(async (material) => {
    const id = material.id;

    if (enabledIds.has(id)) {
      setEnabledIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onMaterialsLoaded?.((prev) => prev.filter((f) => f._materialId !== id));
      return;
    }

    setLoadingFileId(id);
    try {
      let fileBlob = null;
      const filePath = material.filePath;

      if (filePath) {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(filePath);

        if (!error && data) {
          fileBlob = data;
        }
      }

      if (!fileBlob && material.fileUrl) {
        try {
          const resp = await fetch(material.fileUrl);
          if (resp.ok) fileBlob = await resp.blob();
        } catch {
          // ignore
        }
      }

      if (!fileBlob) {
        console.warn("Could not download material:", material.title);
        setLoadingFileId(null);
        return;
      }

      const fileName = material.fileName || material.title || "material";
      const file = new File([fileBlob], fileName, { type: fileBlob.type });
      const content = await parseDocument(file);

      if (content) {
        setEnabledIds((prev) => new Set([...prev, id]));
        onMaterialsLoaded?.((prev) => [
          ...prev,
          { name: material.title || fileName, content, type: fileBlob.type, _materialId: id },
        ]);
      }
    } catch (err) {
      console.error("Failed to parse class material:", material.title, err);
    } finally {
      setLoadingFileId(null);
    }
  }, [enabledIds, onMaterialsLoaded]);

  const getDocTypeInfo = (fileName, fileType) => {
    const ext = fileName.split(".").pop().toLowerCase();
    if (ext === "pdf" || fileType.includes("pdf")) {
      return { icon: FileText, color: "text-red-500 bg-red-50 border-red-100", label: "PDF" };
    }
    if (["doc", "docx"].includes(ext) || fileType.includes("word") || fileType.includes("officedocument.wordprocessingml")) {
      return { icon: FileText, color: "text-blue-500 bg-blue-50 border-blue-100", label: "DOCX" };
    }
    if (["ppt", "pptx"].includes(ext) || fileType.includes("powerpoint") || fileType.includes("presentation")) {
      return { icon: Presentation, color: "text-amber-500 bg-amber-50 border-amber-100", label: "PPTX" };
    }
    if (["xls", "xlsx", "csv"].includes(ext) || fileType.includes("spreadsheet") || fileType.includes("excel")) {
      return { icon: Table, color: "text-green-500 bg-green-50 border-green-100", label: "XLSX" };
    }
    return { icon: FileIcon, color: "text-slate-500 bg-slate-50 border-slate-100", label: ext.toUpperCase() };
  };

  if (!selectedClassId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Class Materials Library
        </h3>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-6">
          <Loader2 className="w-4 h-4 animate-spin text-green-600" /> Loaded lessons metadata...
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && materials.length === 0 && (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <FileIcon className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
          <p className="text-[10px] text-gray-400 font-medium">No materials uploaded to this class yet</p>
        </div>
      )}

      {materials.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 select-scrollbar">
          {materials.map((mat) => {
            const isEnabled = enabledIds.has(mat.id);
            const isLoading = loadingFileId === mat.id;
            const docInfo = getDocTypeInfo(mat.fileName || mat.title, mat.fileType);
            const DocIcon = docInfo.icon;

            return (
              <button
                key={mat.id}
                onClick={() => toggleMaterial(mat)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  isEnabled
                    ? "bg-green-50/60 border-green-300 text-green-700 shadow-sm"
                    : "bg-white border-gray-150 text-gray-600 hover:border-green-200 hover:bg-green-50/10"
                } ${isLoading ? "opacity-60 cursor-wait" : ""}`}
              >
                {/* File Icon Block */}
                <div className={`p-2 rounded-lg border flex-shrink-0 flex items-center justify-center ${docInfo.color}`}>
                  <DocIcon className="w-4 h-4" />
                </div>

                {/* File Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold truncate leading-tight group-hover:text-green-700">
                    {mat.title}
                  </p>
                  <p className="text-[9px] text-gray-400 font-semibold leading-none mt-1">
                    {docInfo.label} Document
                  </p>
                </div>

                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                  ) : isEnabled ? (
                    <div className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 group-hover:border-green-300">
                      +
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {enabledIds.size > 0 && (
        <div className="p-2 bg-emerald-50/50 border border-emerald-100/60 rounded-xl flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] text-emerald-800 font-bold">
            {enabledIds.size} file{enabledIds.size > 1 ? "s" : ""} added to AI prompt context
          </span>
        </div>
      )}
    </div>
  );
}
