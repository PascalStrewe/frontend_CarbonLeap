// AdminUpload.tsx
import React, { useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

const AdminUpload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const uploadedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      <div className="p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-[#103D5E] mb-6">Upload Verified Data</h1>
        
        {/* File Upload Area */}
        <div
          className={`bg-white/25 backdrop-blur-md border-2 border-dashed rounded-lg p-8 text-center shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] ${
            dragActive ? 'border-[#103D5E] bg-[#B9D9DF]/20' : 'border-white/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-[#103D5E]" />
          <p className="mt-2 text-sm text-[#103D5E]">
            Drag and drop your files here, or{" "}
            <button className="text-[#103D5E] font-medium hover:underline">
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-[#103D5E]/60">
            Supported formats: CSV, Excel, PDF
          </p>
        </div>
        
        {/* File List */}
        {files.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#103D5E] mb-4">
              Uploaded Files
            </h2>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white/25 backdrop-blur-md p-4 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-[#103D5E]" />
                    <div>
                      <p className="font-medium text-[#103D5E]">{file.name}</p>
                      <p className="text-sm text-[#103D5E]/60">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            
            <button
              className="mt-6 bg-[#103D5E] text-white px-6 py-2 rounded-lg hover:bg-[#103D5E]/90 transition-colors"
            >
              Process Files
            </button>
          </div>
        )}
        
        {/* Processing Status */}
        <div className="mt-8 bg-white/25 backdrop-blur-md rounded-lg p-4 flex items-start space-x-3 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
          <AlertCircle className="h-5 w-5 text-[#103D5E] mt-0.5" />
          <div>
            <h3 className="font-medium text-[#103D5E]">Processing Guidelines</h3>
            <ul className="mt-2 text-sm text-[#103D5E]/70 list-disc list-inside space-y-1">
              <li>CSV/Excel files should follow the provided template format</li>
              <li>PDFs will be processed using RAG to extract relevant data</li>
              <li>All data must include client identifiers for proper mapping</li>
              <li>Processing may take a few minutes for large files</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};