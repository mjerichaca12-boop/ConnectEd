import { useState, useRef, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Upload, FileText, X, File, Image as ImageIcon, Video, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { DeleteConfirmationModal } from "@/app/components/ui/DeleteConfirmationModal";

export function LessonMaterialsSubTab({ lesson }) {
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (lesson?.id) {
      loadMaterials();
    }
  }, [lesson?.id]);

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("lesson_materials")
        .select("*")
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load materials");
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (fileType?.includes('image')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    if (fileType?.includes('video')) return <Video className="w-8 h-8 text-purple-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      const sizeMB = file.size / (1024 * 1024);
      if (file.type.includes("pdf") || file.type.includes("document") || file.type.includes("word")) {
        if (sizeMB > 20) { toast.error(`${file.name} exceeds 20MB limit for documents.`); continue; }
      } else if (file.type.includes("presentation") || file.type.includes("powerpoint")) {
        if (sizeMB > 50) { toast.error(`${file.name} exceeds 50MB limit for presentations.`); continue; }
      } else if (file.type.includes("image")) {
        if (sizeMB > 10) { toast.error(`${file.name} exceeds 10MB limit for images.`); continue; }
      } else if (file.type.includes("video")) {
        if (sizeMB > 100) { toast.error(`${file.name} exceeds 100MB limit for videos.`); continue; }
      } else {
        if (sizeMB > 20) { toast.error(`${file.name} exceeds 20MB limit.`); continue; }
      }

      await uploadSingleFile(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadSingleFile = async (file) => {
    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `lesson_materials/${lesson.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("class-materials")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("class-materials")
        .getPublicUrl(filePath);

      const payload = {
        lesson_id: lesson.id,
        file_name: file.name,
        file_url: publicUrlData.publicUrl,
        file_size: file.size,
        file_type: file.type || 'unknown'
      };

      const { error: dbError } = await supabase.from("lesson_materials").insert(payload);
      if (dbError) throw dbError;

      toast.success(`${file.name} uploaded successfully`, { id: toastId });
      loadMaterials();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to upload ${file.name}`, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const filePathMatches = itemToDelete.file_url.match(/class-materials\/(.*)/);
      if (filePathMatches && filePathMatches[1]) {
        await supabase.storage.from("class-materials").remove([filePathMatches[1]]);
      }

      const { error } = await supabase.from("lesson_materials").delete().eq("id", itemToDelete.id);
      if (error) throw error;

      toast.success("Material deleted");
      loadMaterials();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete material");
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center transition-colors hover:bg-gray-100 relative">
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Click to upload or drag and drop</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
          Supported files: PDF/DOCX (Max 20MB), PPT/PPTX (Max 50MB), Images (Max 10MB), Videos (Max 100MB)
        </p>
        <input 
          type="file" 
          multiple
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mov,.avi"
        />
        <button 
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg shadow-sm pointer-events-none"
        >
          {isUploading ? "Uploading..." : "Select Files"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : materials.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No materials uploaded for this lesson yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {materials.map((mat) => (
            <div key={mat.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-start hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                {getFileIcon(mat.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate" title={mat.file_name}>{mat.file_name}</h4>
                <p className="text-xs text-gray-500 mt-1">{formatFileSize(mat.file_size)}</p>
                <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={mat.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded-md transition-colors"
                    title="Download/View"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => setItemToDelete(mat)}
                    className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {itemToDelete && (
        <DeleteConfirmationModal
          title="Delete Material"
          message={`Are you sure you want to completely remove "${itemToDelete.file_name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setItemToDelete(null)}
          confirmText="Delete"
        />
      )}
    </div>
  );
}
