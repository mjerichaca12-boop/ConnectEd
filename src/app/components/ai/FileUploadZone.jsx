import { useState, useRef } from "react";
import { UploadCloud, FileText, File as FileIcon, X, CheckCircle, AlertCircle } from "lucide-react";

export function FileUploadZone({ uploadedFiles, setUploadedFiles, setFileContents }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Note: Simplified extraction since mammoth/pdfjs can be tricky without full setup
  // In a real scenario, you'd use mammoth, pdfjs-dist, etc.
  // Here we just extract text from plain text for demo, or mock for others.
  const extractText = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve("Error reading file.");
      reader.readAsText(file);
    });
  };

  const handleFiles = async (files) => {
    const validFiles = Array.from(files).slice(0, 5); // max 5
    
    for (const file of validFiles) {
      if (file.size > 10 * 1024 * 1024) continue; // max 10MB
      
      const newFileObj = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + " MB",
        status: "Reading...",
        type: file.type || "application/octet-stream"
      };
      
      setUploadedFiles(prev => [...prev, newFileObj]);
      
      // Extract content
      try {
        const content = await extractText(file);
        setFileContents(prev => [...prev, { id: newFileObj.id, content }]);
        
        setUploadedFiles(prev => prev.map(f => 
          f.id === newFileObj.id ? { ...f, status: "✓ Ready" } : f
        ));
      } catch (err) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === newFileObj.id ? { ...f, status: "✗ Error" } : f
        ));
      }
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    setFileContents(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Class Materials</h3>
      <div 
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          isDragging ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 font-medium">Click or drag files to upload</p>
        <p className="text-xs text-gray-500 mt-1">.pdf, .docx, .txt, .pptx (Max 10MB)</p>
        <input 
          type="file" 
          multiple 
          accept=".pdf,.docx,.txt,.pptx" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map(file => (
            <div key={file.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 flex-shrink-0">
                <FileText className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">{file.size}</span>
                  <span className={file.status === "✓ Ready" ? "text-green-600 font-medium" : file.status === "✗ Error" ? "text-red-500" : "text-amber-500"}>
                    {file.status}
                  </span>
                </div>
              </div>
              <button onClick={() => removeFile(file.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
