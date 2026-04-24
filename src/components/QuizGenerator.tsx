import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import { parseMCQs, extractPdfText, uploadPdfForVision, GenerationMode, Difficulty, ExtractionMode } from '../services/geminiService';
import { QuizData } from '../types';
import { Loader2, Sparkles, UploadCloud, File as FileIcon, X, Key, ChevronDown } from 'lucide-react';

interface QuizGeneratorProps {
  onGenerate: (quizData: QuizData) => void;
}

export function QuizGenerator({ onGenerate }: QuizGeneratorProps) {
  const [rawText, setRawText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; kind: 'txt' | 'docx' | 'pdf'; file: File } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Parsing Dataset...");
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [mode, setMode] = useState<GenerationMode>('parse');
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  // Vision reads diagrams/images in PDFs; text is faster and keeps the request small.
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('vision');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse mode has no need for the text/vision toggle — a parse-ready PDF either has
  // selectable text (we still send it to vision, which handles both) or it doesn't.
  // Pin it to vision so the user never has to think about it.
  useEffect(() => {
    if (mode === 'parse' && uploadedFile?.kind === 'pdf') {
      setExtractionMode('vision');
    }
  }, [mode, uploadedFile?.kind]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — vision path uploads to Supabase Storage; text path extracts client-side

  const hasTypedText = rawText.trim().length > 0 && !uploadedFile;
  const hasFile = !!uploadedFile;

  // Lightweight dirty-state bridge: App reads `window.__quizmintDirty` before
  // discarding generator input (logo / Dashboard back). Reset on unmount so the
  // flag only reflects the currently mounted generator.
  useEffect(() => {
    (window as unknown as { __quizmintDirty?: boolean }).__quizmintDirty =
      rawText.trim().length > 0 || !!uploadedFile;
    return () => {
      (window as unknown as { __quizmintDirty?: boolean }).__quizmintDirty = false;
    };
  }, [rawText, uploadedFile]);

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
        setUploadedFile({ name: file.name, kind: 'txt', file });
      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setRawText(result.value);
        setUploadedFile({ name: file.name, kind: 'docx', file });
        // DOCX vision isn't supported — mammoth already pulled the text, so force text mode.
        setExtractionMode('text');
      } else if (file.type === 'application/pdf') {
        setUploadedFile({ name: file.name, kind: 'pdf', file });
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
      const isPdf = uploadedFile?.kind === 'pdf';
      let storagePath: string | undefined;
      let textForApi = rawText;

      if (isPdf && uploadedFile) {
        if (extractionMode === 'vision') {
          // Upload to Supabase Storage; server will download, process, then delete.
          setProgressText("Uploading document...");
          storagePath = await uploadPdfForVision(uploadedFile.file);
        } else {
          // Text-only: extract in the browser so the request stays small.
          setProgressText("Extracting text from document...");
          textForApi = await extractPdfText(uploadedFile.file);
        }
      }

      setProgressText("Analyzing document structure...");
      const quizData = await parseMCQs({
        rawText: textForApi,
        storagePath,
        userApiKey: userApiKey || undefined,
        options: {
          mode,
          count: mode === 'generate' ? count : undefined,
          difficulty: mode === 'generate' ? difficulty : undefined,
        },
      });
      
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
    if (uploadedFile?.kind === 'txt' || uploadedFile?.kind === 'docx') {
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mb-6 border border-emerald-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-[32px] font-medium text-[var(--c-text)] mb-4 leading-[1.2]">
            Initialize Knowledge Engine
          </h1>
          <p className="text-[16px] text-[var(--c-text-subtle)]">
            {mode === 'parse'
              ? 'Paste your raw multiple-choice questions or upload a document (TXT, DOCX, PDF). The AI will parse and construct an interactive module.'
              : 'Upload course slides, notes, or any study material (TXT, DOCX, PDF). The AI will read the content and write a brand-new quiz at the difficulty you pick.'}
          </p>
        </div>

        <div className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] overflow-hidden flex flex-col gap-6 p-6">

          {/* Mode toggle */}
          <div>
            <label className="block text-[14px] font-semibold text-emerald-500 mb-3">
              MODE
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--c-app)] border border-[var(--c-border)] rounded-xl">
              {([
                { id: 'parse', label: 'Parse existing Q&A', hint: 'Source already has questions + answers' },
                { id: 'generate', label: 'Generate from content', hint: 'Source is slides/notes, no questions yet' },
              ] as const).map((opt) => {
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    disabled={isGenerating}
                    className={`text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${active ? 'bg-emerald-500/10 border border-emerald-500/40' : 'border border-transparent hover:bg-white/5'}`}
                  >
                    <div className={`text-[13px] font-semibold ${active ? 'text-emerald-500' : 'text-[var(--c-text)]'}`}>{opt.label}</div>
                    <div className="text-[11px] text-[var(--c-text-subtle)] mt-0.5">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'generate' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="count" className="text-[14px] font-semibold text-emerald-500">
                    QUESTION COUNT
                  </label>
                  <span className="text-[13px] font-mono text-[var(--c-text-muted)]">{count}</span>
                </div>
                <input
                  id="count"
                  type="range"
                  min={10}
                  max={50}
                  step={1}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  disabled={isGenerating}
                  className="w-full accent-emerald-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-[11px] text-[var(--c-text-faint)] mt-1">
                  <span>10</span>
                  <span>50</span>
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-semibold text-emerald-500 mb-3">
                  DIFFICULTY
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Easy', 'Medium', 'Hard'] as const).map((d) => {
                    const active = difficulty === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        disabled={isGenerating}
                        className={`px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${active ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-500' : 'bg-[var(--c-app)] border border-[var(--c-border)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]'}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          <div>
            <label className="block text-[14px] font-semibold text-emerald-500 mb-3">
              DOCUMENT UPLOAD
            </label>
            <div
              className={`w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-[var(--c-border)] bg-[var(--c-app)]'} ${hasTypedText ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-slate-500'} ${uploadedFile ? 'hidden' : 'flex'}`}
              onDragOver={hasTypedText ? undefined : onDragOver}
              onDragLeave={onDragLeave}
              onDrop={hasTypedText ? undefined : onDrop}
              onClick={() => !hasTypedText && fileInputRef.current?.click()}
            >
              <UploadCloud className="w-10 h-10 text-[var(--c-text-subtle)] mb-4" />
              <p className="text-[14px] text-[var(--c-text-muted)] font-medium">Drag & drop your file here</p>
              <p className="text-[12px] text-[var(--c-text-faint)] mt-1">
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
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-4">
                <div className="flex items-center space-x-3">
                  <FileIcon className="w-6 h-6 text-emerald-400" />
                  <span className="text-[14px] font-medium text-emerald-200 [.light_&]:text-emerald-700">{uploadedFile.name} attached</span>
                </div>
                {!isGenerating && (
                  <button onClick={removeFile} className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Extraction mode — only exposed in generate mode; parse mode always uses vision. */}
            {mode === 'generate' && uploadedFile?.kind === 'pdf' && (
              <div className="mt-4">
                <label className="block text-[13px] font-semibold text-emerald-500 mb-2">
                  EXTRACTION
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--c-app)] border border-[var(--c-border)] rounded-xl">
                  {([
                    { id: 'text', label: 'Text only', hint: 'Fast. Skips images.' },
                    { id: 'vision', label: 'Text + Images', hint: 'Reads diagrams. Slower.' },
                  ] as const).map((opt) => {
                    const active = extractionMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setExtractionMode(opt.id)}
                        disabled={isGenerating}
                        className={`text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${active ? 'bg-emerald-500/10 border border-emerald-500/40' : 'border border-transparent hover:bg-white/5'}`}
                      >
                        <div className={`text-[13px] font-semibold ${active ? 'text-emerald-500' : 'text-[var(--c-text)]'}`}>{opt.label}</div>
                        <div className="text-[11px] text-[var(--c-text-subtle)] mt-0.5">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {uploadedFile?.kind === 'docx' && (
              <p className="text-[11px] text-[var(--c-text-faint)] mt-3">
                DOCX images aren't analyzed. Convert to PDF for vision extraction.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="rawText" className="block text-[14px] font-semibold text-emerald-500 mb-3">
              RAW DATA INPUT
            </label>
            <textarea
              id="rawText"
              rows={8}
              className="w-full rounded-xl bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 p-4 font-mono text-[14px] text-[var(--c-text-muted)] resize-y outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              placeholder={hasFile
                ? 'Remove the attached file to paste text instead.'
                : mode === 'generate'
                  ? `Or paste your study material here...
(lecture notes, chapter text, slide content — anything the AI can read to write ${count} ${difficulty.toLowerCase()} questions)`
                  : `Or paste your text here...
Example:
1. What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid

Answer Key:
1. C`}
              value={hasFile && uploadedFile?.kind === 'pdf' ? '' : rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isGenerating || hasFile}
            />
          </div>
          
          {/* API Key (optional, collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="flex items-center gap-2 text-[13px] text-[var(--c-text-subtle)] hover:text-[var(--c-text-muted)] transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Use your own API key</span>
              <span className="text-[11px] px-1.5 py-0.5 bg-white/5 border border-[var(--c-border)] rounded text-[var(--c-text-faint)]">Optional</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showApiKey ? 'rotate-180' : ''}`} />
            </button>
            {showApiKey && (
              <div className="mt-3">
                <input
                  type="password"
                  className="w-full rounded-xl bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 font-mono text-[13px] text-[var(--c-text-muted)] outline-none transition-colors"
                  placeholder="Paste your Gemini API key..."
                  value={userApiKey}
                  onChange={(e) => {
                    setUserApiKey(e.target.value);
                    localStorage.setItem('gemini_api_key', e.target.value);
                  }}
                  disabled={isGenerating}
                />
                <p className="mt-2 text-[11px] text-[var(--c-text-faint)]">
                  Your key is stored locally in your browser and never saved on our server. Get one free at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
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
                <span className="text-[12px] font-medium text-emerald-400 uppercase tracking-wider">{progressText}</span>
                <span className="text-[12px] text-[var(--c-text-subtle)] font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-[var(--c-app)] rounded-full overflow-hidden border border-[var(--c-border)]">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300 ease-out relative"
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
              className="inline-flex items-center px-6 py-3 border border-transparent text-[14px] font-medium rounded-xl text-[var(--c-text)] bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--c-text)]" />
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
