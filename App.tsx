import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Copy, Download, Eye } from 'lucide-react';
import { ExtractedFile, ExtractionStatus } from './types';
import { processFile } from './services/localParsers';
import clsx from 'clsx';

const App: React.FC = () => {
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      await addFiles(Array.from(event.target.files));
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFiles = async (newFiles: File[]) => {
    const newExtractedFiles: ExtractedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      type: file.type,
      size: file.size,
      status: ExtractionStatus.PENDING,
      content: '',
    }));

    setFiles(prev => [...prev, ...newExtractedFiles]);

    // Process queue sequentially to be nice to browser memory
    for (let i = 0; i < newExtractedFiles.length; i++) {
      const fileObj = newExtractedFiles[i];
      const originalFile = newFiles[i];
      await processSingleFile(fileObj.id, originalFile);
    }
  };

  const processSingleFile = async (id: string, file: File) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: ExtractionStatus.PROCESSING } : f));

    try {
      const extractedText = await processFile(file);
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: ExtractionStatus.COMPLETED, 
        content: extractedText 
      } : f));
      // Auto select the first completed file if none selected
      setSelectedFileId(prev => prev ? prev : id);
    } catch (error: any) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: ExtractionStatus.ERROR, 
        errorMessage: error.message || "Unknown error" 
      } : f));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFileId === id) setSelectedFileId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const downloadText = (filename: string, text: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${filename}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="flex flex-col h-screen bg-background text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 flex items-center px-6 bg-surface shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">OmniExtract</h1>
            <p className="text-xs text-slate-400">Universal Content Extractor (Gemini 2.5 Flash)</p>
          </div>
        </div>
        <div className="ml-auto">
             <label 
               htmlFor="file-upload"
               className="cursor-pointer bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
             >
                <Upload className="w-4 h-4" />
                Upload Files
             </label>
             <input 
               id="file-upload"
               type="file" 
               multiple 
               className="hidden"
               ref={fileInputRef}
               onChange={handleFileSelect}
             />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar / File List */}
        <div className="w-80 border-r border-slate-700 bg-surface flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700">
             <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Files</h2>
             <p className="text-xs text-slate-500">{files.length} documents loaded</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {files.length === 0 && (
                <div 
                  className={clsx(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer mt-4",
                    isDragging ? "border-primary bg-primary/10" : "border-slate-600 hover:border-slate-500"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Drop files here or click to upload</p>
                  <p className="text-xs text-slate-600 mt-2">PDF, IMG, MP3, MP4, DOCX, ZIP...</p>
                </div>
            )}

            {files.map(file => (
              <div 
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                className={clsx(
                  "group relative p-3 rounded-md cursor-pointer border transition-all",
                  selectedFileId === file.id 
                    ? "bg-primary/10 border-primary/50" 
                    : "bg-slate-800/50 border-transparent hover:bg-slate-800 border-slate-700/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Status Icon */}
                    <div className="shrink-0 mt-1">
                      {file.status === ExtractionStatus.PENDING && <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />}
                      {file.status === ExtractionStatus.PROCESSING && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                      {file.status === ExtractionStatus.COMPLETED && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {file.status === ExtractionStatus.ERROR && <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    
                    <div className="min-w-0">
                      <p className={clsx("text-sm font-medium truncate", selectedFileId === file.id ? "text-white" : "text-slate-300")}>
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {(file.size / 1024).toFixed(1)} KB • {file.status}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => removeFile(e, file.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Viewer */}
        <div className="flex-1 flex flex-col bg-[#0f172a] relative">
          {selectedFile ? (
            <>
              <div className="h-14 border-b border-slate-700 flex items-center justify-between px-6 bg-surface/50 backdrop-blur-sm">
                 <div className="flex items-center gap-2">
                    <h2 className="font-medium text-white truncate max-w-md">{selectedFile.name}</h2>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full", 
                        selectedFile.status === ExtractionStatus.COMPLETED ? "bg-green-500/20 text-green-400" :
                        selectedFile.status === ExtractionStatus.ERROR ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                    )}>
                        {selectedFile.status}
                    </span>
                 </div>
                 
                 {selectedFile.status === ExtractionStatus.COMPLETED && (
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={() => copyToClipboard(selectedFile.content)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors text-slate-300"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button 
                        onClick={() => downloadText(selectedFile.name, selectedFile.content)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-primary hover:bg-blue-600 transition-colors text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save .txt
                      </button>
                   </div>
                 )}
              </div>

              <div className="flex-1 overflow-hidden relative">
                {selectedFile.status === ExtractionStatus.PROCESSING && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-20">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                        <p className="text-slate-400 animate-pulse">Trích xuất nội dung... (Đừng đóng tab)</p>
                    </div>
                )}

                {selectedFile.status === ExtractionStatus.ERROR && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">Lỗi trích xuất</h3>
                        <p className="text-red-400 max-w-lg">{selectedFile.errorMessage}</p>
                    </div>
                )}

                {selectedFile.status === ExtractionStatus.COMPLETED && (
                    <textarea 
                      className="w-full h-full bg-[#0f172a] p-8 text-slate-300 font-mono text-sm leading-relaxed resize-none focus:outline-none"
                      value={selectedFile.content}
                      readOnly
                      spellCheck={false}
                    />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
               <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                   <Eye className="w-10 h-10 opacity-50" />
               </div>
               <p>Select a file to view extracted content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;