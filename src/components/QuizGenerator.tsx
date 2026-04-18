import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import { parseMCQs } from '../services/geminiService';
import { QuizData } from '../types';
import { Loader2, Sparkles, UploadCloud, File as FileIcon, X, Key, ChevronDown } from 'lucide-react';

interface QuizGeneratorProps {
  onGenerate: (quizData: QuizData) => void;
}

export function QuizGenerator({ onGenerate }: QuizGeneratorProps) {
  const [rawText, setRawText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: 'text' | 'pdf'; data: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Parsing Dataset...");
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const hasTypedText = rawText.trim().length > 0 && !uploadedFile;
  const hasFile = !!uploadedFile;

  const processFile = async (file: File) => {
    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }

    try {
      if (file.type === 'text/plain') {
        const text = await file.text();
        setRawText(text);
        setUploadedFile({ name: file.name, type: 'text', data: '' });
      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setRawText(result.value);
        setUploadedFile({ name: file.name, type: 'text', data: '' });
      } else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          setUploadedFile({ name: file.name, type: 'pdf', data: base64 });
        };
        reader.readAsDataURL(file);
      } else {
        setError("Unsupported file format. Please upload TXT, DOCX, or PDF.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to read the file.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!rawText.trim() && !uploadedFile) {
      setError("Please enter text or upload a document containing MCQs.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(5);
    setProgressText("Initializing AI Engine...");

    let simulatedProgressInterval = setInterval(() => {
      setProgress((prev) => {
        // Move slowly up to 90%
        if (prev < 90) return prev + (90 - prev) * 0.05;
        return prev;
      });
    }, 500);

    try {
      const filePart = uploadedFile?.type === 'pdf' ? { mimeType: 'application/pdf', data: uploadedFile.data } : undefined;
      setProgressText("Analyzing document structure...");
      const quizData = await parseMCQs(rawText, filePart, userApiKey || undefined);
      
      clearInterval(simulatedProgressInterval);
      setProgress(100);
      setProgressText("Processing complete!");
      
      // Short delay so users see 100% completion
      setTimeout(() => {
        if (quizData && quizData.questions && quizData.questions.length > 0) {
          onGenerate(quizData);
        } else {
          setError("Could not extract any questions. Please check the format.");
          setIsGenerating(false);
          setProgress(0);
        }
      }, 400);
    } catch (err: any) {
      clearInterval(simulatedProgressInterval);
      console.error(err);
      setError(err.message || "An error occurred while generating the quiz.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const removeFile = () => {
    if (uploadedFile?.type === 'text') {
      setRawText('');
    }
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-[60px] w-full max-w-[800px] mx-auto">
      <div className="w-full">
        <div className="mb-10 block">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 mb-6 border border-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-[32px] font-medium text-white mb-4 leading-[1.2]">
            Initialize Knowledge Engine
          </h1>
          <p className="text-[16px] text-slate-400">
            Paste your raw multiple-choice questions or upload a document (TXT, DOCX, PDF). The AI will parse and construct an interactive module.
          </p>
        </div>

        <div className="bg-[#15161A] rounded-xl border border-[#2D2E35] overflow-hidden flex flex-col gap-6 p-6">
          
          {/* Upload Dropzone */}
          <div>
            <label className="block text-[14px] font-semibold text-indigo-500 mb-3">
              DOCUMENT UPLOAD
            </label>
            <div
              className={`w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-[#2D2E35] bg-[#0A0A0C]'} ${hasTypedText ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-slate-500'} ${uploadedFile ? 'hidden' : 'flex'}`}
              onDragOver={hasTypedText ? undefined : onDragOver}
              onDragLeave={onDragLeave}
              onDrop={hasTypedText ? undefined : onDrop}
              onClick={() => !hasTypedText && fileInputRef.current?.click()}
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mb-4" />
              <p className="text-[14px] text-slate-300 font-medium">Drag & drop your file here</p>
              <p className="text-[12px] text-slate-500 mt-1">
                {hasTypedText ? 'Clear the text below to upload a file' : 'Supports TXT, DOCX, and PDF'}
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                accept=".txt,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                disabled={isGenerating || hasTypedText}
              />
            </div>

            {/* Display uploaded file */}
            {uploadedFile && (
              <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mt-4">
                <div className="flex items-center space-x-3">
                  <FileIcon className="w-6 h-6 text-indigo-400" />
                  <span className="text-[14px] font-medium text-indigo-200">{uploadedFile.name} attached</span>
                </div>
                {!isGenerating && (
                  <button onClick={removeFile} className="p-1 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="rawText" className="block text-[14px] font-semibold text-indigo-500 mb-3">
              RAW DATA INPUT
            </label>
            <textarea
              id="rawText"
              rows={8}
              className="w-full rounded-xl bg-[#0A0A0C] border border-[#2D2E35] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-4 font-mono text-[14px] text-slate-300 resize-y outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              placeholder={hasFile
                ? 'Remove the attached file to paste text instead.'
                : `Or paste your text here...
Example:
1. What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid

Answer Key:
1. C`}
              value={hasFile && uploadedFile?.type === 'pdf' ? '' : rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isGenerating || hasFile}
            />
          </div>
          
          {/* API Key (optional, collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-slate-300 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Use your own API key</span>
              <span className="text-[11px] px-1.5 py-0.5 bg-white/5 border border-[#2D2E35] rounded text-slate-500">Optional</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showApiKey ? 'rotate-180' : ''}`} />
            </button>
            {showApiKey && (
              <div className="mt-3">
                <input
                  type="password"
                  className="w-full rounded-xl bg-[#0A0A0C] border border-[#2D2E35] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-4 py-3 font-mono text-[13px] text-slate-300 outline-none transition-colors"
                  placeholder="Paste your Gemini API key..."
                  value={userApiKey}
                  onChange={(e) => {
                    setUserApiKey(e.target.value);
                    localStorage.setItem('gemini_api_key', e.target.value);
                  }}
                  disabled={isGenerating}
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  Your key is stored locally in your browser and never saved on our server. Get one free at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                    aistudio.google.com
                  </a>
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-[rgba(239,68,68,0.05)] border border-red-500/20 rounded-xl text-red-500 text-[14px]">
              {error}
            </div>
          )}

          {isGenerating && (
            <div className="w-full px-2 py-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] font-medium text-indigo-400 uppercase tracking-wider">{progressText}</span>
                <span className="text-[12px] text-slate-400 font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-[#0A0A0C] rounded-full overflow-hidden border border-[#2D2E35]">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[progress-pulse_1.5s_ease-in-out_infinite]"></div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!rawText.trim() && !uploadedFile)}
              className="inline-flex items-center px-6 py-3 border border-transparent text-[14px] font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Generating Module
                </>
              ) : (
                <>
                  <Sparkles className="-ml-1 mr-2 h-5 w-5" />
                  Generate Module
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
