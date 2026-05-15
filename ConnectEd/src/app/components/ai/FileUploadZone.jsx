import { useRef, useState } from "react";
import { parseDocument, getSupportedFileTypes } from "@/app/lib/documentParser";

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

  return (
    <div>
      <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">📎 Upload Materials</h3>

      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`block border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-green-500 ${
          isProcessing 
            ? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
            : 'border-gray-300 hover:border-green-400 bg-gray-50 hover:bg-green-50'
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
          <div>
            <p className="text-xs text-gray-500">Processing files...</p>
            <div className="flex justify-center mt-2">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">Drag & drop files here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, PowerPoint, Text files supported</p>
            <p className="text-xs text-gray-300 mt-1">{supportedTypes.extensions.join(', ')}</p>
          </>
        )}
      </label>

      {uploadedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadedFiles.map((file, index) => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            const getFileIcon = (ext) => {
              switch (ext) {
                case 'pdf': return '📕';
                case 'doc':
                case 'docx': return '📘';
                case 'ppt':
                case 'pptx': return '📙';
                case 'txt': return '📄';
                case 'csv': return '📊';
                case 'json': return '📋';
                case 'md': return '📝';
                default: return '📄';
              }
            };
            
            return (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{getFileIcon(fileExtension)}</span>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-600 truncate block">{file.name}</span>
                    <span className="text-xs text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(index)}
                  className="text-gray-400 hover:text-red-500 text-xs ml-2 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
