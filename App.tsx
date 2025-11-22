import React, { useState, useRef, useEffect } from 'react';
import { GradeLevel, Subject, Quiz, QuestionType, UserAnswer, GroundingSource } from './types';
import * as GeminiService from './services/geminiService';
import { Loading } from './components/Loading';

// --- Icons ---
const BookOpenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;
const ChatBubbleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;

export default function App() {
  const [activeMode, setActiveMode] = useState<'study' | 'creative' | 'chat'>('study');
  const [grade, setGrade] = useState<string>(GradeLevel.Grade10);
  const [subject, setSubject] = useState<string>(Subject.History);
  
  // --- Study Mode State ---
  const [inputText, setInputText] = useState("");
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<{score: number, feedback: Record<number, string> } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  // --- Creative Mode State ---
  const [creativePrompt, setCreativePrompt] = useState("");
  const [creativeImage, setCreativeImage] = useState<string | null>(null);
  const [creativeVideo, setCreativeVideo] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'gen_img' | 'edit_img' | 'gen_video'>('gen_img');
  const [editSourceFile, setEditSourceFile] = useState<File | null>(null);
  const [isProcessingCreative, setIsProcessingCreative] = useState(false);

  // --- Chat Mode State ---
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);

  // --- Veo Key Check ---
  useEffect(() => {
    if (editMode === 'gen_video') {
        // Simple check if the API for selection is available, not blocking rendering but preparing context
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
             window.aistudio.hasSelectedApiKey().then(hasKey => {
                 if (!hasKey) {
                     // Ideally show a modal here, for now we rely on the button action
                 }
             });
        }
    }
  }, [editMode]);

  // --- Handlers: Study Mode ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (inputFiles.length + newFiles.length > 20) {
        alert("Maximum 20 files allowed");
        return;
      }
      setInputFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!inputText && inputFiles.length === 0) {
        alert("Please enter text or upload files.");
        return;
    }
    setIsGeneratingQuiz(true);
    try {
      const generatedQuiz = await GeminiService.generateQuiz(inputText, inputFiles, grade, subject);
      setQuiz(generatedQuiz);
      setUserAnswers({});
      setQuizResult(null);
    } catch (e) {
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!quiz) return;
    setIsGrading(true);
    let score = 0;
    const feedback: Record<number, string> = {};
    const promises: Promise<void>[] = [];

    for (const q of quiz.questions) {
      const answer = userAnswers[q.id];
      
      if (q.type === QuestionType.MultipleChoice || q.type === QuestionType.TrueFalse) {
        const isCorrect = answer === q.correctAnswer;
        if (isCorrect) score++;
        feedback[q.id] = isCorrect ? "Correct!" : `Incorrect. The answer was ${q.correctAnswer}`;
      } else {
        // Async grade short answer
        const p = GeminiService.gradeShortAnswer(q.text, answer || "", q.correctAnswer).then(res => {
            if (res.isCorrect) score++;
            feedback[q.id] = res.feedback;
        });
        promises.push(p);
      }
    }

    await Promise.all(promises);
    setQuizResult({ score, feedback });
    setIsGrading(false);
  };

  // --- Handlers: Creative ---
  const handleCreativeSubmit = async () => {
    setIsProcessingCreative(true);
    setCreativeImage(null);
    setCreativeVideo(null);
    try {
        if (editMode === 'gen_img') {
            const url = await GeminiService.generateCreativeImage(creativePrompt);
            setCreativeImage(url);
        } else if (editMode === 'edit_img') {
             if (!editSourceFile) return alert("Upload an image to edit");
             const url = await GeminiService.editImageWithPrompt(editSourceFile, creativePrompt);
             setCreativeImage(url);
        } else if (editMode === 'gen_video') {
             // Check key
             if (window.aistudio) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    await window.aistudio.openSelectKey();
                }
             }
             const url = await GeminiService.generateVideo(creativePrompt, editSourceFile || undefined);
             setCreativeVideo(url);
        }
    } catch (e) {
        alert("Generation failed. " + e);
    } finally {
        setIsProcessingCreative(false);
    }
  };

  // --- Handlers: Chat ---
  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const newMessage = { role: 'user' as const, text: chatInput };
    setMessages(prev => [...prev, newMessage]);
    setChatInput("");
    setChatLoading(true);

    const { text, groundingChunks } = await GeminiService.chatWithTutor(chatInput, messages, useSearch, useMaps);
    
    setMessages(prev => [...prev, { role: 'model', text }]);
    
    if (groundingChunks && groundingChunks.length > 0) {
        const sources: GroundingSource[] = [];
        groundingChunks.forEach((chunk: any) => {
            if (chunk.web) sources.push(chunk.web);
            if (chunk.maps) sources.push(chunk.maps);
        });
        setGroundingSources(sources);
    }
    setChatLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
             <h1 className="text-xl font-bold text-gray-800 tracking-tight">ScholarGenius</h1>
          </div>
          
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
            {[
                { id: 'study', label: 'Study Gen', icon: BookOpenIcon },
                { id: 'creative', label: 'Creative Studio', icon: SparklesIcon },
                { id: 'chat', label: 'AI Tutor', icon: ChatBubbleIcon }
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveMode(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeMode === tab.id 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <tab.icon />
                    <span className="hidden sm:inline">{tab.label}</span>
                </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <select 
                value={grade} 
                onChange={(e) => setGrade(e.target.value)}
                className="bg-gray-50 border-gray-200 rounded-lg text-sm p-2 focus:ring-2 focus:ring-primary outline-none"
            >
                {Object.values(GradeLevel).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
                className="bg-gray-50 border-gray-200 rounded-lg text-sm p-2 focus:ring-2 focus:ring-primary outline-none"
            >
                {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* --- STUDY MODE --- */}
        {activeMode === 'study' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
                {/* Left Frame: Input */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col overflow-hidden">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-2 h-6 bg-primary rounded-full"></span>
                        Source Material
                    </h2>
                    
                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                        <textarea
                            className="w-full flex-1 p-4 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-primary/20 resize-none text-gray-700 placeholder-gray-400"
                            placeholder="Paste your notes, summaries, or textbook text here..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        
                        <div className="bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-200 hover:border-primary/50 transition-colors">
                            <label className="cursor-pointer flex flex-col items-center gap-2 text-center">
                                <span className="bg-white p-3 rounded-full shadow-sm text-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                </span>
                                <span className="text-sm font-medium text-gray-600">Upload images or files (Max 20)</span>
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>
                            {inputFiles.length > 0 && (
                                <div className="mt-4 flex gap-2 flex-wrap">
                                    {inputFiles.map((f, i) => (
                                        <div key={i} className="text-xs bg-white px-2 py-1 rounded border shadow-sm truncate max-w-[100px]">
                                            {f.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleGenerateQuiz}
                            disabled={isGeneratingQuiz}
                            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-semibold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                        >
                            {isGeneratingQuiz ? "Thinking & Generating..." : "Generate Study Outline & Quiz"}
                            {!isGeneratingQuiz && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>}
                        </button>
                    </div>
                </div>

                {/* Right Frame: Output */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col overflow-hidden relative">
                     <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-2 h-6 bg-secondary rounded-full"></span>
                        Your Study Outline
                    </h2>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {isGeneratingQuiz && <Loading />}
                        
                        {!isGeneratingQuiz && !quiz && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                                <BookOpenIcon />
                                <p className="mt-2">Your generated quiz will appear here.</p>
                            </div>
                        )}

                        {quiz && !isGeneratingQuiz && (
                            <div className="space-y-8 pb-20">
                                <div className="border-b pb-4">
                                    <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
                                    <p className="text-sm text-gray-500 mt-1">Complete the questions below to test your knowledge.</p>
                                </div>

                                {quiz.questions.map((q, index) => (
                                    <div key={q.id} className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                                        <div className="flex items-start gap-3 mb-3">
                                            <span className="bg-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm text-gray-600 shrink-0">
                                                {index + 1}
                                            </span>
                                            <p className="font-medium text-gray-800 pt-1">{q.text}</p>
                                        </div>

                                        {/* Render Question Inputs */}
                                        <div className="ml-11">
                                            {q.type === QuestionType.MultipleChoice && q.options && (
                                                <div className="space-y-2">
                                                    {q.options.map((opt, i) => (
                                                        <label key={i} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${userAnswers[q.id] === opt ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-gray-200'}`}>
                                                            <input 
                                                                type="radio" 
                                                                name={`q-${q.id}`} 
                                                                value={opt}
                                                                checked={userAnswers[q.id] === opt}
                                                                onChange={(e) => setUserAnswers({...userAnswers, [q.id]: e.target.value})}
                                                                className="text-primary focus:ring-primary"
                                                            />
                                                            <span className="text-gray-700 text-sm">{opt}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === QuestionType.TrueFalse && (
                                                <div className="flex gap-4">
                                                    {['True', 'False'].map((val) => (
                                                         <label key={val} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer border transition-all ${userAnswers[q.id] === val ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-gray-200 bg-white hover:bg-gray-100'}`}>
                                                            <input 
                                                                type="radio" 
                                                                name={`q-${q.id}`} 
                                                                value={val}
                                                                checked={userAnswers[q.id] === val}
                                                                onChange={(e) => setUserAnswers({...userAnswers, [q.id]: e.target.value})}
                                                                className="hidden"
                                                            />
                                                            {val}
                                                         </label>
                                                    ))}
                                                </div>
                                            )}

                                            {q.type === QuestionType.ShortAnswer && (
                                                <textarea 
                                                    className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm"
                                                    rows={2}
                                                    placeholder="Type your answer..."
                                                    value={userAnswers[q.id] || ''}
                                                    onChange={(e) => setUserAnswers({...userAnswers, [q.id]: e.target.value})}
                                                />
                                            )}

                                            {/* Grading Feedback */}
                                            {quizResult && quizResult.feedback[q.id] && (
                                                <div className={`mt-3 text-sm p-3 rounded-lg ${quizResult.feedback[q.id].includes("Correct!") ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {quizResult.feedback[q.id]}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Submit Button Footer */}
                    {quiz && !isGeneratingQuiz && (
                        <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t border-gray-100">
                            {quizResult ? (
                                <div className="flex items-center justify-between">
                                    <div className="text-lg font-bold">
                                        Score: <span className="text-primary">{quizResult.score}</span> / {quiz.questions.length}
                                    </div>
                                    <button onClick={handleGenerateQuiz} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700">
                                        Try New Quiz
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleSubmitQuiz}
                                    disabled={isGrading}
                                    className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                                >
                                    {isGrading ? "Grading..." : "Submit & Grade"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- CREATIVE STUDIO MODE --- */}
        {activeMode === 'creative' && (
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Creative Studio</h1>
                <p className="text-gray-500 mb-8">Use AI to visualize your history lessons or create science diagrams.</p>

                <div className="flex gap-4 mb-6 border-b">
                     <button onClick={() => setEditMode('gen_img')} className={`pb-3 px-2 font-medium text-sm border-b-2 ${editMode === 'gen_img' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Generate Image</button>
                     <button onClick={() => setEditMode('edit_img')} className={`pb-3 px-2 font-medium text-sm border-b-2 ${editMode === 'edit_img' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Edit Image (Nano)</button>
                     <button onClick={() => setEditMode('gen_video')} className={`pb-3 px-2 font-medium text-sm border-b-2 ${editMode === 'gen_video' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Generate Video (Veo)</button>
                </div>

                <div className="space-y-6">
                    {(editMode === 'edit_img' || editMode === 'gen_video') && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                             <label className="block text-sm font-medium text-gray-700 mb-2">Reference Image (Optional for Video)</label>
                             <input type="file" onChange={(e) => e.target.files && setEditSourceFile(e.target.files[0])} />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
                        <textarea 
                            value={creativePrompt}
                            onChange={(e) => setCreativePrompt(e.target.value)}
                            className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary outline-none"
                            rows={3}
                            placeholder={editMode === 'edit_img' ? "E.g., Add a retro filter..." : "E.g., A cell dividing in 3D..."}
                        />
                    </div>

                    <button 
                        onClick={handleCreativeSubmit}
                        disabled={isProcessingCreative}
                        className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                    >
                        {isProcessingCreative ? "Creating Magic..." : "Generate"}
                    </button>

                    {/* Output Display */}
                    <div className="mt-8 bg-gray-900 rounded-2xl p-1 min-h-[300px] flex items-center justify-center">
                        {isProcessingCreative ? <div className="text-white animate-pulse">Processing...</div> : (
                            <>
                                {creativeImage && <img src={creativeImage} alt="Generated" className="max-h-[500px] rounded-xl object-contain" />}
                                {creativeVideo && (
                                    <video controls className="max-h-[500px] rounded-xl w-full">
                                        <source src={creativeVideo} type="video/mp4" />
                                    </video>
                                )}
                                {!creativeImage && !creativeVideo && <span className="text-gray-500">Output will appear here</span>}
                            </>
                        )}
                    </div>
                    
                    {editMode === 'gen_video' && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Video generation requires a specific API Key selection. See <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Billing Docs</a>.
                        </p>
                    )}
                </div>
            </div>
        )}

        {/* --- CHAT TUTOR MODE --- */}
        {activeMode === 'chat' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700">AI Tutor</h2>
                    <div className="flex gap-4 text-xs font-medium text-gray-600">
                         <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useSearch} onChange={e => setUseSearch(e.target.checked)} className="rounded text-primary" /> Google Search</label>
                         <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useMaps} onChange={e => setUseMaps(e.target.checked)} className="rounded text-primary" /> Google Maps</label>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-400 mt-20">
                            <ChatBubbleIcon />
                            <p>Ask me anything about your homework!</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {chatLoading && <div className="flex justify-start"><div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none text-sm text-gray-500">Thinking...</div></div>}
                    
                    {/* Grounding Sources */}
                    {groundingSources.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border text-xs">
                            <p className="font-bold text-gray-500 mb-2">Sources:</p>
                            <ul className="space-y-1">
                                {groundingSources.map((s, i) => (
                                    <li key={i}>
                                        <a href={s.uri} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate block max-w-xs">
                                            {s.title || s.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex gap-2">
                        <input 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                            placeholder="Ask a question..."
                            className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary outline-none"
                        />
                        <button onClick={handleChatSubmit} disabled={chatLoading} className="bg-primary text-white p-3 rounded-xl hover:bg-primary/90">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
}
