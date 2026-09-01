import { useRef, useState } from "react";
import { parseDocument, getSupportedFileTypes } from "@/app/lib/documentParser";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";

export function FileUploadZone({ uploadedFiles, setUploadedFiles, setFileContents }) {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = async (files) => {
    const newFiles = Array.from(files);
    setIsProcessing(true);
    
    for (const file of newFiles) {
      console.log("Processing file:", file.name, file.type, file.size);
      
      try {
        const content = await parseDocument(file);
        console.log("File processed successfully:", file.name, "Content length:", content?.length || 0);
        
        setUploadedFiles((prev) => [...prev, file]);
        setFileContents((prev) => [
          ...prev,
          { name: file.name, content, type: file.type },
        ]);
      } catch (error) {
        console.error("Error processing file:", file.name, error);
        alert(`Failed to process ${file.name}: ${error.message}`);
      }
    }
    
    setIsProcessing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileContents((prev) => prev.filter((_, i) => i !== index));
  };

  const supportedTypes = getSupportedFileTypes();
  const acceptString = supportedTypes.extensions.join(',');

  const getDocColor = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return 'text-red-500 bg-red-50 border-red-100';
      case 'doc':
      case 'docx': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'ppt':
      case 'pptx': return 'text-amber-500 bg-amber-50 border-amber-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
          <UploadCloud className="w-4 h-4 text-green-600" /> 📎 Upload Materials
        </h3>
      </div>

      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`block border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all focus-within:ring-2 focus-within:ring-green-500/20 ${
          isProcessing 
            ? 'border-gray-250 bg-gray-50/50 cursor-not-allowed' 
            : 'border-gray-250 hover:border-green-400 bg-gray-50/50 hover:bg-green-50/20 active:scale-[0.99]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptString}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isProcessing}
        />
        {isProcessing ? (
          <div className="py-2">
            <Loader2 className="w-5 h-5 animate-spin text-green-600 mx-auto mb-2" />
            <p className="text-[11px] text-gray-500 font-semibold">Extracting documents text...</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <UploadCloud className="w-6 h-6 text-gray-400 mx-auto" />
            <div>
              <p className="text-xs text-gray-600 font-bold">Drag & drop files here</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">or click to browse local files</p>
            </div>
            <p className="text-[9px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md inline-block">
              PDF, Word, PPTX, TXT
            </p>
          </div>
        )}
      </label>

      {uploadedFiles.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5 select-scrollbar">
          {uploadedFiles.map((file, index) => {
            const ext = file.name.split('.').pop().toUpperCase();
            const badgeColor = getDocColor(file.name);
            
            return (
              <div
                key={index}
                className="flex items-center justify-between bg-white border border-gray-150 rounded-xl px-2.5 py-2 shadow-sm animate-fadeIn"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg border flex-shrink-0 flex items-center justify-center ${badgeColor}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-gray-800 truncate block leading-tight">
                      {file.name}
                    </span>
                    <span className="text-[9px] text-gray-400 font-semibold leading-none block mt-0.5">
                      {ext} · {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(index)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50/50 transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Simple internal helper loader
function Loader2({ className }) {
  return (
    <div className={`w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}
