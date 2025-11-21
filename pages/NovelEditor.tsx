import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Sparkles, PlusCircle, FileText, MoreVertical, ChevronRight, Book, PenTool, Database, Trash2, Plus, RefreshCw, LogIn, Copy, BookOpenText, X, Hash, AlignLeft, GripVertical, ScanSearch, ShieldCheck, AlertTriangle, Users, CheckSquare, Square, Layers } from 'lucide-react';
import { Novel, Chapter, KnowledgeEntry, KnowledgeCategory, PromptTemplate, PromptCategory } from '../types';
import { saveNovel, getNovelById, generateId, getDefaultCategories, getPrompts } from '../services/storageService';
import { generateStorySegment, generateSummary, analyzeStoryConsistency, analyzeStoryEvolution, KnowledgeUpdateSuggestion } from '../services/geminiService';
import { Button, Modal } from '../components/UI';

interface NovelEditorProps {
  novelId: string;
  onBack: () => void;
}

type ViewMode = 'writing' | 'knowledge';

const PROMPT_CATEGORIES: PromptCategory[] = ['脑洞', '大纲', '卷纲', '细纲', '正文', '简介', '人物', '书名'];

export const NovelEditor: React.FC<NovelEditorProps> = ({ novelId, onBack }) => {
  const [novel, setNovel] = useState<Novel | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('writing');
  
  // Knowledge Base State
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);

  // Drag and Drop State
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);
  const [draggedEntryIndex, setDraggedEntryIndex] = useState<number | null>(null);

  // AI State
  const [isAIWriting, setIsAIWriting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [targetWordCount, setTargetWordCount] = useState('');
  
  // Initialize AI Output from LocalStorage (Auto-save Draft)
  const [aiOutput, setAiOutput] = useState(() => {
      return localStorage.getItem(`inkflow_draft_output_${novelId}`) || '';
  });

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<Set<string>>(new Set());
  
  // Consistency & Auto-Update State
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [consistencyReport, setConsistencyReport] = useState<string | null>(null);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);
  const [knowledgeUpdates, setKnowledgeUpdates] = useState<KnowledgeUpdateSuggestion[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set()); // Index of updates
  const [isUpdateReviewModalOpen, setIsUpdateReviewModalOpen] = useState(false);
  
  // Prompt Library Integration State
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [availablePrompts, setAvailablePrompts] = useState<PromptTemplate[]>([]);
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<PromptCategory>('正文');
  const [activePromptTemplate, setActivePromptTemplate] = useState<PromptTemplate | null>(null);

  // Save to KB State
  const [isSaveKbModalOpen, setIsSaveKbModalOpen] = useState(false);
  const [kbSaveTitle, setKbSaveTitle] = useState('');
  const [kbSaveCategoryId, setKbSaveCategoryId] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = getNovelById(novelId);
    if (loaded) {
      // Migration for old novels without knowledge base
      if (!loaded.knowledgeCategories) {
          loaded.knowledgeCategories = getDefaultCategories();
          loaded.knowledgeEntries = [];
          saveNovel(loaded);
      }

      setNovel(loaded);
      
      if (loaded.chapters.length > 0) {
        setActiveChapterId(loaded.chapters[0].id);
      } else {
        createChapter(loaded);
      }

      if (loaded.knowledgeCategories.length > 0) {
          setActiveCategoryId(loaded.knowledgeCategories[0].id);
          setKbSaveCategoryId(loaded.knowledgeCategories[0].id);
      }
    }
  }, [novelId]);

  // Load prompts when modal opens
  useEffect(() => {
      if (isPromptModalOpen) {
          setAvailablePrompts(getPrompts());
      }
  }, [isPromptModalOpen]);

  // Auto-save effect for Novel
  useEffect(() => {
    if (!novel) return;
    const timer = setTimeout(() => {
        saveNovel(novel);
    }, 2000);
    return () => clearTimeout(timer);
  }, [novel]);

  // Auto-save effect for AI Output Draft
  useEffect(() => {
      const key = `inkflow_draft_output_${novelId}`;
      if (aiOutput) {
          localStorage.setItem(key, aiOutput);
      } else {
          localStorage.removeItem(key);
      }
  }, [aiOutput, novelId]);

  // Helper for word count
  const getWordCount = (str: string | undefined) => {
      if (!str) return 0;
      return str.replace(/\s/g, '').length;
  };

  // --- Chapter Logic ---
  const createChapter = (currentNovel: Novel) => {
    const newChapter: Chapter = {
      id: generateId(),
      title: `第 ${currentNovel.chapters.length + 1} 章`,
      content: '',
    };
    const updatedNovel = {
      ...currentNovel,
      chapters: [...currentNovel.chapters, newChapter],
    };
    setNovel(updatedNovel);
    setActiveChapterId(newChapter.id);
    saveNovel(updatedNovel);
  };

  const updateActiveChapter = (field: keyof Chapter, value: string) => {
    if (!novel || !activeChapterId) return;
    const updatedChapters = novel.chapters.map(ch => 
      ch.id === activeChapterId ? { ...ch, [field]: value } : ch
    );
    setNovel({ ...novel, chapters: updatedChapters });
  };

  // --- Knowledge Base Logic ---
  const handleAddCategory = () => {
      if (!novel || !newCategoryName.trim()) return;
      const newCat: KnowledgeCategory = { id: generateId(), name: newCategoryName.trim() };
      const updatedNovel = { ...novel, knowledgeCategories: [...novel.knowledgeCategories, newCat] };
      setNovel(updatedNovel);
      saveNovel(updatedNovel); // Immediate save for structure changes
      setActiveCategoryId(newCat.id);
      setNewCategoryName('');
      setIsAddCatModalOpen(false);
  };

  const deleteCategory = (e: React.MouseEvent, catId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!novel) return;
      
      const categoryEntries = novel.knowledgeEntries.filter(e => e.categoryId === catId);
      const hasEntries = categoryEntries.length > 0;
      
      if (hasEntries) {
          if (!confirm(`确定要删除分类“${novel.knowledgeCategories.find(c => c.id === catId)?.name}”吗？\n\n这将会连同删除该分类下的 ${categoryEntries.length} 个条目，且不可恢复。`)) return;
      } else {
          if (!confirm('确定要删除这个空分类吗？')) return;
      }

      const updatedCategories = novel.knowledgeCategories.filter(c => c.id !== catId);
      // Filter out entries belonging to this category
      const updatedEntries = novel.knowledgeEntries.filter(e => e.categoryId !== catId);
      
      const updatedNovel = { 
          ...novel, 
          knowledgeCategories: updatedCategories,
          knowledgeEntries: updatedEntries 
      };

      setNovel(updatedNovel);
      saveNovel(updatedNovel); // Immediate save
      
      if (activeCategoryId === catId) {
          setActiveCategoryId(null);
          setActiveEntryId(null);
      }
  };

  const handleCreateEntry = () => {
      if (!novel || !activeCategoryId) return;
      const newEntry: KnowledgeEntry = {
          id: generateId(),
          categoryId: activeCategoryId,
          title: '新条目',
          content: ''
      };
      const updatedNovel = { ...novel, knowledgeEntries: [...novel.knowledgeEntries, newEntry] };
      setNovel(updatedNovel);
      saveNovel(updatedNovel); // Immediate save
      setActiveEntryId(newEntry.id);
  };

  const updateActiveEntry = (field: keyof KnowledgeEntry, value: string) => {
      if (!novel || !activeEntryId) return;
      const updatedEntries = novel.knowledgeEntries.map(e => 
          e.id === activeEntryId ? { ...e, [field]: value } : e
      );
      setNovel({ ...novel, knowledgeEntries: updatedEntries });
  };

  const deleteEntry = (e: React.MouseEvent, entryId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if(!novel || !confirm('确定要删除这个条目吗？')) return;
      
      const updatedEntries = novel.knowledgeEntries.filter(e => e.id !== entryId);
      const updatedNovel = { ...novel, knowledgeEntries: updatedEntries };
      
      setNovel(updatedNovel);
      saveNovel(updatedNovel); // Immediate save
      
      if(activeEntryId === entryId) setActiveEntryId(null);
      
      // Also remove from selection if it was selected for AI
      if (selectedKnowledgeIds.has(entryId)) {
          const newSet = new Set(selectedKnowledgeIds);
          newSet.delete(entryId);
          setSelectedKnowledgeIds(newSet);
      }
  };

  // --- Drag and Drop Logic (Categories) ---
  const onDragStartCat = (e: React.DragEvent, index: number) => {
      setDraggedCatIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Firefox requires data set to drag
      e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
  };

  const onDragOverCat = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const onDropCat = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedCatIndex === null || !novel) return;
      if (draggedCatIndex === targetIndex) return;

      const newCategories = [...novel.knowledgeCategories];
      const [removed] = newCategories.splice(draggedCatIndex, 1);
      newCategories.splice(targetIndex, 0, removed);

      const updatedNovel = { ...novel, knowledgeCategories: newCategories };
      setNovel(updatedNovel);
      saveNovel(updatedNovel);
      setDraggedCatIndex(null);
  };

  // --- Drag and Drop Logic (Entries) ---
  const onDragStartEntry = (e: React.DragEvent, index: number) => {
      setDraggedEntryIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
  };

  const onDragOverEntry = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const onDropEntry = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedEntryIndex === null || !novel || !activeCategoryId) return;
      if (draggedEntryIndex === targetIndex) return;

      // Get only entries for current category to reorder them
      const currentCategoryEntries = novel.knowledgeEntries.filter(e => e.categoryId === activeCategoryId);
      
      // Perform swap on this subset
      const itemToMove = currentCategoryEntries[draggedEntryIndex];
      currentCategoryEntries.splice(draggedEntryIndex, 1);
      currentCategoryEntries.splice(targetIndex, 0, itemToMove);

      // Rebuild the global list: (Entries NOT in this category) + (Reordered entries in this category)
      const otherEntries = novel.knowledgeEntries.filter(e => e.categoryId !== activeCategoryId);
      const newGlobalEntries = [...otherEntries, ...currentCategoryEntries];

      const updatedNovel = { ...novel, knowledgeEntries: newGlobalEntries };
      setNovel(updatedNovel);
      saveNovel(updatedNovel);
      setDraggedEntryIndex(null);
  };


  // --- AI Logic ---
  const toggleKnowledgeSelection = (id: string) => {
      const newSet = new Set(selectedKnowledgeIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedKnowledgeIds(newSet);
  };

  const handleAIWrite = async () => {
    if (!novel || !activeChapterId || isAIWriting) return;

    setIsAIWriting(true);
    setAiOutput(''); // Clear previous output (will trigger auto-save clear)
    
    const currentChapterIndex = novel.chapters.findIndex(c => c.id === activeChapterId);
    
    // Construct the final prompt
    let promptToUse = '';
    if (activePromptTemplate) {
        // If template is selected, use it as base.
        promptToUse = activePromptTemplate.content;
        // Append user input if exists as detailed instructions or variable filling
        if (aiPrompt.trim()) {
            promptToUse += `\n\n用户补充指令/具体细节:\n${aiPrompt.trim()}`;
        }
    } else {
        // No template, just use user input or default
        promptToUse = aiPrompt.trim() || "请顺着当前的内容自然地续写。";
    }

    // Gather reference content
    const references = novel.knowledgeEntries
        .filter(e => selectedKnowledgeIds.has(e.id))
        .map(e => `[${novel.knowledgeCategories.find(c => c.id === e.categoryId)?.name || '资料'}] ${e.title}:\n${e.content}`);

    const wordCount = targetWordCount ? parseInt(targetWordCount) : undefined;

    try {
      await generateStorySegment(
        novel,
        currentChapterIndex,
        promptToUse,
        references,
        wordCount,
        (textChunk) => {
           setAiOutput(prev => prev + textChunk);
        }
      );
    } catch (e) {
      alert("生成失败，请检查网络或API密钥。");
    } finally {
      setIsAIWriting(false);
    }
  };

  const handleInsertContent = () => {
      if (!novel || !activeChapterId || !aiOutput) return;
      
      const currentChapter = novel.chapters.find(c => c.id === activeChapterId);
      if (!currentChapter) return;

      let newContent = currentChapter.content;
      
      // Insert at cursor if textarea is focused, otherwise append
      if (textareaRef.current) {
          const start = textareaRef.current.selectionStart;
          const end = textareaRef.current.selectionEnd;
          
          // If we have a selection or cursor position
          if (start !== undefined && end !== undefined) {
               newContent = newContent.substring(0, start) + aiOutput + newContent.substring(end);
          } else {
               newContent += (newContent ? '\n' : '') + aiOutput;
          }
      } else {
           newContent += (newContent ? '\n' : '') + aiOutput;
      }

      updateActiveChapter('content', newContent);
  };

  const handleOpenSaveKb = () => {
      if (!aiOutput) return;
      setKbSaveTitle('');
      // Default to first category if not set
      if (!kbSaveCategoryId && novel?.knowledgeCategories.length) {
          setKbSaveCategoryId(novel.knowledgeCategories[0].id);
      }
      setIsSaveKbModalOpen(true);
  };

  const handleConfirmSaveKb = () => {
      if (!novel || !kbSaveCategoryId || !kbSaveTitle.trim()) return;
      
      const newEntry: KnowledgeEntry = {
          id: generateId(),
          categoryId: kbSaveCategoryId,
          title: kbSaveTitle.trim(),
          content: aiOutput
      };
      
      const updatedNovel = { ...novel, knowledgeEntries: [...novel.knowledgeEntries, newEntry] };
      setNovel(updatedNovel);
      saveNovel(updatedNovel);
      setIsSaveKbModalOpen(false);
      alert('已保存到知识库！');
  };
  
  const handleConsistencyCheck = async () => {
      if (!novel || !aiOutput) return;
      
      setIsCheckingConsistency(true);
      setConsistencyReport(null);
      
      // Filter for relevant categories: Characters, World, Background, etc.
      const targetCategoryIds = novel.knowledgeCategories
        .filter(c => 
            /人物|角色|Character|主角|反派|世界观|背景|设定|物品|金手指|World|Setting|Item/i.test(c.name)
        )
        .map(c => c.id);
        
      const relevantEntries = novel.knowledgeEntries.filter(e => targetCategoryIds.includes(e.categoryId));
      
      // Create a map for the service to know category names
      const categoryMap = novel.knowledgeCategories.reduce((acc, cat) => {
          acc[cat.id] = cat.name;
          return acc;
      }, {} as Record<string, string>);

      if (relevantEntries.length === 0) {
          setConsistencyReport("未在知识库中检测到相关的设定条目（人物、背景、世界观等），无法进行对比分析。\n\n请先在知识库中补充相关设定。");
          setIsCheckingConsistency(false);
          setIsConsistencyModalOpen(true);
          return;
      }

      try {
          const report = await analyzeStoryConsistency(aiOutput, relevantEntries, categoryMap);
          setConsistencyReport(report);
          setIsConsistencyModalOpen(true);
      } catch (e) {
          alert("分析失败，请稍后重试。");
      } finally {
          setIsCheckingConsistency(false);
      }
  };
  
  const handleAutoSyncKnowledge = async () => {
      if (!novel) return;
      const currentChapter = novel.chapters.find(c => c.id === activeChapterId);
      if (!currentChapter || !currentChapter.content.trim()) {
          alert("请先撰写章节内容，再进行同步。");
          return;
      }

      setIsSyncingKnowledge(true);
      setKnowledgeUpdates([]);
      setSelectedUpdates(new Set());

      // Provide ALL knowledge entries to AI to check for duplicates/updates
      const existingEntries = novel.knowledgeEntries;
      const categoryMap = novel.knowledgeCategories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
      }, {} as Record<string, string>);

      try {
          const suggestions = await analyzeStoryEvolution(
              currentChapter.content,
              existingEntries,
              categoryMap
          );

          if (suggestions.length === 0) {
              alert("AI 未检测到明显的设定更新（人物、物品或世界观）。");
          } else {
              setKnowledgeUpdates(suggestions);
              // Select all by default
              setSelectedUpdates(new Set(suggestions.map((_, i) => i)));
              setIsUpdateReviewModalOpen(true);
          }

      } catch (e) {
          alert("同步失败，请稍后重试。");
      } finally {
          setIsSyncingKnowledge(false);
      }
  };

  const handleConfirmUpdates = () => {
      if (!novel) return;
      
      let newCats = [...novel.knowledgeCategories];
      let newEntries = [...novel.knowledgeEntries];
      
      // Helper to find matching category or create one
      const getTargetCategoryId = (type: 'CHARACTER' | 'WORLD' | 'ITEM' | 'OTHER'): string => {
          const keywordMap = {
              'CHARACTER': ['人物', '角色', 'Character', 'Person'],
              'WORLD': ['世界', '地点', '背景', '势力', 'World', 'Location'],
              'ITEM': ['物品', '道具', '金手指', '武器', 'Item', 'Artifact'],
              'OTHER': ['其他', '杂项', '设定', 'Other']
          };
          
          const keywords = keywordMap[type];
          // Try to find existing category
          const existingCat = newCats.find(c => keywords.some(k => c.name.includes(k)));
          
          if (existingCat) return existingCat.id;
          
          // Create new if not found
          const defaultNames = { 'CHARACTER': '人物档案', 'WORLD': '世界观设定', 'ITEM': '物品与金手指', 'OTHER': '其他设定' };
          const newCatName = `${defaultNames[type]} (AI)`;
          const newCat = { id: generateId(), name: newCatName };
          newCats.push(newCat);
          return newCat.id;
      };

      knowledgeUpdates.forEach((update, index) => {
          if (!selectedUpdates.has(index)) return;

          if (update.type === 'NEW') {
              const targetCatId = getTargetCategoryId(update.categoryType);
              newEntries.push({
                  id: generateId(),
                  categoryId: targetCatId,
                  title: update.name,
                  content: update.description
              });
          } else if (update.type === 'UPDATE' && update.originalId) {
              const entryIndex = newEntries.findIndex(e => e.id === update.originalId);
              if (entryIndex !== -1) {
                  newEntries[entryIndex] = {
                      ...newEntries[entryIndex],
                      content: update.description
                  };
              }
          }
      });

      const updatedNovel = { 
          ...novel, 
          knowledgeCategories: newCats, 
          knowledgeEntries: newEntries 
      };
      
      setNovel(updatedNovel);
      saveNovel(updatedNovel);
      setIsUpdateReviewModalOpen(false);
      alert(`成功同步了 ${selectedUpdates.size} 条设定。`);
  };

  const toggleUpdateSelection = (index: number) => {
      const newSet = new Set(selectedUpdates);
      if (newSet.has(index)) {
          newSet.delete(index);
      } else {
          newSet.add(index);
      }
      setSelectedUpdates(newSet);
  };

  const handleSelectPromptTemplate = (template: PromptTemplate) => {
      setActivePromptTemplate(template);
      setIsPromptModalOpen(false);
  };

  const handleRemovePromptTemplate = () => {
      setActivePromptTemplate(null);
  };

  const activeChapter = novel?.chapters.find(c => c.id === activeChapterId);
  const activeEntry = novel?.knowledgeEntries.find(e => e.id === activeEntryId);
  const entriesInCategory = novel?.knowledgeEntries.filter(e => e.categoryId === activeCategoryId) || [];
  
  // Stats
  const currentChapterWords = getWordCount(activeChapter?.content);
  const totalWords = novel ? novel.chapters.reduce((acc, c) => acc + getWordCount(c.content), 0) : 0;

  if (!novel) return <div className="p-8 text-center">加载中...</div>;

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white flex-shrink-0 z-20">
            <div className="flex items-center gap-4">
                 <div onClick={onBack} className="cursor-pointer flex items-center text-slate-500 hover:text-slate-800 text-sm font-medium">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setViewMode('writing')}
                        className={`px-3 py-1 text-sm rounded-md transition-all flex items-center gap-2 ${viewMode === 'writing' ? 'bg-white text-indigo-600 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <PenTool className="w-3.5 h-3.5" /> 写作
                    </button>
                    <button 
                        onClick={() => setViewMode('knowledge')}
                        className={`px-3 py-1 text-sm rounded-md transition-all flex items-center gap-2 ${viewMode === 'knowledge' ? 'bg-white text-indigo-600 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Database className="w-3.5 h-3.5" /> 知识库
                    </button>
                </div>
                <span className="text-slate-800 font-bold ml-2 truncate max-w-[200px] hidden sm:block">{novel.title}</span>
            </div>

            <div className="flex items-center gap-2">
                 {viewMode === 'writing' && (
                    <Button 
                        size="sm" 
                        variant={showAiPanel ? 'primary' : 'secondary'}
                        onClick={() => setShowAiPanel(!showAiPanel)}
                        icon={<Sparkles className="w-4 h-4" />}
                    >
                        AI 助手
                    </Button>
                 )}
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
            
            {/* --- WRITING MODE --- */}
            {viewMode === 'writing' && (
                <>
                     {/* Sidebar - Chapter List */}
                    <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-slate-50 border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden`}>
                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">目录</h2>
                            </div>
                            {novel.chapters.map((chapter) => (
                                <div 
                                    key={chapter.id}
                                    onClick={() => setActiveChapterId(chapter.id)}
                                    className={`group flex items-center px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${activeChapterId === chapter.id ? 'bg-white shadow-sm text-indigo-600 font-medium ring-1 ring-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <FileText className={`w-4 h-4 mr-2 flex-shrink-0 ${activeChapterId === chapter.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    <span className="truncate flex-1">{chapter.title}</span>
                                </div>
                            ))}
                            <button 
                                onClick={() => createChapter(novel)}
                                className="w-full mt-4 flex items-center justify-center px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                                <PlusCircle className="w-4 h-4 mr-2" /> 添加章节
                            </button>
                        </div>
                    </div>

                    {/* Editor */}
                    <div className="flex-1 flex flex-col relative min-w-0">
                         <div className="absolute top-2 left-2 z-10">
                            <button 
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="p-2 bg-white/50 hover:bg-white rounded-md text-slate-400 shadow-sm border border-slate-100"
                            >
                                {sidebarOpen ? <ArrowLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                         </div>
                         
                         {/* Editor Text Area */}
                         <div ref={scrollRef} className="flex-1 overflow-y-auto h-full bg-slate-50/30 scroll-smooth">
                            <div className="max-w-3xl mx-auto py-12 px-8 min-h-full bg-white shadow-sm border-x border-slate-50 mb-8">
                                <input 
                                    value={activeChapter?.title || ''}
                                    onChange={(e) => updateActiveChapter('title', e.target.value)}
                                    className="text-2xl font-bold text-slate-900 border-none focus:ring-0 focus:outline-none w-full mb-6 placeholder-slate-300"
                                    placeholder="章节标题"
                                />
                                <textarea
                                    ref={textareaRef}
                                    value={activeChapter?.content || ''}
                                    onChange={(e) => updateActiveChapter('content', e.target.value)}
                                    placeholder="在此开始撰写您的故事..."
                                    className="w-full h-full min-h-[60vh] resize-none border-none focus:ring-0 outline-none text-lg leading-relaxed text-slate-800 font-serif placeholder-slate-300 whitespace-pre-wrap"
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* Bottom Status Bar */}
                        <div className="h-8 bg-white border-t border-slate-200 flex items-center justify-between px-6 text-xs text-slate-400 flex-shrink-0 z-10">
                            <div className="flex gap-4">
                                <span className="flex items-center text-slate-600"><AlignLeft size={12} className="mr-1"/> 本章: {currentChapterWords} 字</span>
                                <span className="hidden sm:inline">全书: {totalWords} 字</span>
                            </div>
                            <div>
                                {novel.updatedAt > 0 && `上次保存: ${new Date(novel.updatedAt).toLocaleTimeString()}`}
                            </div>
                        </div>
                    </div>

                    {/* AI Panel */}
                    <div className={`${showAiPanel ? 'w-80 translate-x-0' : 'w-0 translate-x-full'} bg-white border-l border-slate-200 shadow-xl transition-all duration-300 absolute right-0 top-0 bottom-0 z-20 flex flex-col`}>
                        <div className="p-4 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center">
                            <h3 className="font-semibold text-indigo-900 flex items-center">
                                <Sparkles className="w-4 h-4 mr-2 text-indigo-500" /> 
                                AI 写作助手
                            </h3>
                            <button onClick={() => setShowAiPanel(false)} className="text-slate-400 hover:text-slate-600">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto flex flex-col">
                            <div className="mb-4 flex-shrink-0">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">指令</label>
                                    <div className="flex gap-2">
                                        {!activePromptTemplate && (
                                            <button 
                                                onClick={() => setIsPromptModalOpen(true)}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                                            >
                                                <BookOpenText size={12} /> 引用提示词
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Active Template Indicator */}
                                {activePromptTemplate && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 mb-2 flex items-start justify-between group">
                                        <div className="flex-1 min-w-0 mr-2">
                                            <div className="flex items-center gap-1 text-xs font-bold text-indigo-700 mb-0.5">
                                                <Sparkles size={10} />
                                                已引用: {activePromptTemplate.title}
                                            </div>
                                            <div className="text-[10px] text-indigo-500 truncate">
                                                {activePromptTemplate.content}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleRemovePromptTemplate}
                                            className="text-indigo-300 hover:text-indigo-600 p-0.5"
                                            title="取消引用"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}

                                <div className="relative group">
                                    <textarea 
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder={activePromptTemplate ? "在此输入模板中的变量或补充指令..." : "描述您想写的内容..."}
                                        className="w-full text-sm p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 mb-2 bg-slate-50 pr-7"
                                    />
                                    {aiPrompt && (
                                        <button 
                                            onClick={() => setAiPrompt('')}
                                            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50"
                                            title="清空"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                
                                {/* Word Count Control */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-2 py-1 w-full">
                                        <Hash size={12} className="text-slate-400 mr-2" />
                                        <input 
                                            type="number" 
                                            value={targetWordCount}
                                            onChange={(e) => setTargetWordCount(e.target.value)}
                                            placeholder="目标字数 (不限)"
                                            className="bg-transparent text-xs w-full outline-none text-slate-700 placeholder-slate-400"
                                            min="1"
                                        />
                                        <span className="text-xs text-slate-400 whitespace-nowrap ml-1">字</span>
                                    </div>
                                </div>

                                <Button 
                                    className="w-full" 
                                    onClick={handleAIWrite} 
                                    isLoading={isAIWriting}
                                    disabled={!activeChapter}
                                >
                                    {isAIWriting ? '生成中...' : '生成内容'}
                                </Button>
                            </div>

                            {/* AI Output Area */}
                            <div className="mb-4 flex-1 flex flex-col min-h-[150px]">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center">
                                        生成结果
                                        {aiOutput && !isAIWriting && (
                                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-normal normal-case">
                                                已保存草稿
                                            </span>
                                        )}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400">{getWordCount(aiOutput)} 字</span>
                                        {aiOutput && (
                                            <button 
                                                onClick={() => setAiOutput('')}
                                                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition-colors"
                                                title="清空草稿"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed overflow-y-auto font-serif shadow-inner mb-2 relative">
                                    {aiOutput ? aiOutput : <span className="text-slate-400 italic text-xs">AI 生成的内容将出现在这里 (会自动保存草稿)</span>}
                                    {isAIWriting && <span className="animate-pulse ml-1">|</span>}
                                </div>
                                
                                <div className="grid grid-cols-4 gap-2 mt-1">
                                    <button 
                                        onClick={handleAIWrite}
                                        disabled={isAIWriting || !aiOutput}
                                        className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs text-slate-600 disabled:opacity-50"
                                        title="重新生成"
                                    >
                                        <RefreshCw className="w-4 h-4 mb-1" />
                                        重写
                                    </button>
                                    <button 
                                        onClick={handleInsertContent}
                                        disabled={isAIWriting || !aiOutput}
                                        className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-xs text-slate-600 disabled:opacity-50"
                                        title="插入到正文"
                                    >
                                        <LogIn className="w-4 h-4 mb-1" />
                                        插入
                                    </button>
                                    <button 
                                        onClick={handleOpenSaveKb}
                                        disabled={isAIWriting || !aiOutput}
                                        className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-xs text-slate-600 disabled:opacity-50"
                                        title="存入设定"
                                    >
                                        <Save className="w-4 h-4 mb-1" />
                                        存设
                                    </button>
                                    {/* More Tools Dropdown / Consistency Check */}
                                    <button 
                                        onClick={handleConsistencyCheck}
                                        disabled={isAIWriting || !aiOutput}
                                        className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 text-xs text-slate-600 disabled:opacity-50"
                                        title="连贯性与设定检查"
                                    >
                                        {isCheckingConsistency ? (
                                            <RefreshCw className="w-4 h-4 mb-1 animate-spin text-amber-500" />
                                        ) : (
                                            <ScanSearch className="w-4 h-4 mb-1" />
                                        )}
                                        检查
                                    </button>
                                </div>
                                
                                {/* Second Row of Tools */}
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    <button
                                        onClick={handleAutoSyncKnowledge}
                                        disabled={isAIWriting || isSyncingKnowledge}
                                        className="flex items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-xs text-slate-600 disabled:opacity-50 w-full"
                                        title="自动分析章节并同步所有设定"
                                    >
                                        {isSyncingKnowledge ? (
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin text-blue-500" />
                                        ) : (
                                            <Layers className="w-4 h-4 mr-2" />
                                        )}
                                        同步设定档案 (全书)
                                    </button>
                                </div>
                            </div>

                            {/* Reference Selection */}
                            <div className="pt-4 border-t border-slate-100 mt-auto">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center">
                                    <Database className="w-3 h-3 mr-1" /> 引用知识库
                                </h4>
                                <div className="max-h-40 overflow-y-auto pr-1">
                                    {novel.knowledgeCategories.map(cat => {
                                        const entries = novel.knowledgeEntries.filter(e => e.categoryId === cat.id);
                                        if (entries.length === 0) return null;
                                        return (
                                            <div key={cat.id} className="mb-3">
                                                <div className="text-xs font-medium text-slate-700 mb-1 ml-1">{cat.name}</div>
                                                <div className="space-y-1">
                                                    {entries.map(entry => (
                                                        <label key={entry.id} className="flex items-center p-2 rounded hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedKnowledgeIds.has(entry.id)}
                                                                onChange={() => toggleKnowledgeSelection(entry.id)}
                                                                className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                                            />
                                                            <span className="ml-2 text-xs text-slate-600 truncate">{entry.title}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {novel.knowledgeEntries.length === 0 && (
                                        <p className="text-xs text-slate-400 italic">暂无知识库内容，请切换到“知识库”模式添加。</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* --- KNOWLEDGE MODE --- */}
            {viewMode === 'knowledge' && (
                <>
                    {/* Categories Sidebar */}
                    <div className="w-56 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
                        <div className="p-3 border-b border-slate-200 flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-500 uppercase">分类</span>
                             <button onClick={() => setIsAddCatModalOpen(true)} className="text-slate-400 hover:text-indigo-600">
                                 <Plus className="w-4 h-4" />
                             </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {novel.knowledgeCategories.map((cat, index) => (
                                <div 
                                    key={cat.id}
                                    draggable={true}
                                    onDragStart={(e) => onDragStartCat(e, index)}
                                    onDragOver={(e) => onDragOverCat(e, index)}
                                    onDrop={(e) => onDropCat(e, index)}
                                    onClick={() => { setActiveCategoryId(cat.id); setActiveEntryId(null); }}
                                    className={`group px-3 py-2 rounded-md text-sm cursor-pointer flex justify-between items-center transition-all 
                                        ${activeCategoryId === cat.id ? 'bg-white shadow-sm text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}
                                        ${draggedCatIndex === index ? 'opacity-50' : 'opacity-100'}
                                    `}
                                >
                                    <div className="flex items-center overflow-hidden">
                                        <GripVertical className="w-3 h-3 text-slate-300 mr-2 cursor-grab opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                        <span className="truncate">{cat.name}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => deleteCategory(e, cat.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-2 transition-opacity"
                                        title="删除分类"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Entry List (Middle) */}
                    <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
                        <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                             <span className="text-xs font-bold text-slate-500 uppercase">
                                 {novel.knowledgeCategories.find(c => c.id === activeCategoryId)?.name || '列表'}
                             </span>
                             <button onClick={handleCreateEntry} disabled={!activeCategoryId} className="text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                                 <Plus className="w-4 h-4" />
                             </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {entriesInCategory.map((entry, index) => (
                                <div 
                                    key={entry.id}
                                    draggable={true}
                                    onDragStart={(e) => onDragStartEntry(e, index)}
                                    onDragOver={onDragOverEntry}
                                    onDrop={(e) => onDropEntry(e, index)}
                                    onClick={() => setActiveEntryId(entry.id)}
                                    className={`group px-3 py-2 rounded-md text-sm cursor-pointer flex justify-between items-center transition-all
                                        ${activeEntryId === entry.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-700 hover:bg-slate-50 border border-transparent'}
                                        ${draggedEntryIndex === index ? 'opacity-50' : 'opacity-100'}
                                    `}
                                >
                                    <div className="flex items-center overflow-hidden">
                                        <GripVertical className="w-3 h-3 text-slate-300 mr-2 cursor-grab opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                        <span className="truncate">{entry.title}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => deleteEntry(e, entry.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-2"
                                        title="删除条目"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {entriesInCategory.length === 0 && activeCategoryId && (
                                <div className="text-center py-8 px-4 text-xs text-slate-400">
                                    该分类下暂无内容<br/>点击上方 + 号添加
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Entry Editor (Right) */}
                    <div className="flex-1 bg-slate-50/30 flex flex-col p-8 overflow-hidden">
                        {activeEntry ? (
                            <div className="bg-white shadow-sm border border-slate-200 rounded-xl h-full flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                    <input 
                                        value={activeEntry.title}
                                        onChange={(e) => updateActiveEntry('title', e.target.value)}
                                        className="flex-1 text-lg font-bold text-slate-800 border-none focus:ring-0 outline-none placeholder-slate-300 mr-4"
                                        placeholder="条目标题（如：主角姓名）"
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 mr-2">{getWordCount(activeEntry.content)} 字</span>
                                        <button 
                                            onClick={(e) => deleteEntry(e, activeEntry.id)}
                                            className="text-slate-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors"
                                            title="删除此条目"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <textarea 
                                    value={activeEntry.content}
                                    onChange={(e) => updateActiveEntry('content', e.target.value)}
                                    className="flex-1 p-4 resize-none border-none focus:ring-0 outline-none text-slate-600 leading-relaxed"
                                    placeholder="在此输入详细设定..."
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <Book className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>请选择或新建一个条目</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add Category Modal */}
                    <Modal isOpen={isAddCatModalOpen} onClose={() => setIsAddCatModalOpen(false)} title="新建分类">
                        <div className="space-y-4">
                            <input 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="例如：功法体系、灵兽..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsAddCatModalOpen(false)}>取消</Button>
                                <Button onClick={handleAddCategory}>添加</Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {/* Save to Knowledge Base Modal */}
            <Modal isOpen={isSaveKbModalOpen} onClose={() => setIsSaveKbModalOpen(false)} title="保存到知识库">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">选择分类</label>
                        <select 
                            value={kbSaveCategoryId}
                            onChange={(e) => setKbSaveCategoryId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {novel.knowledgeCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">条目标题</label>
                        <input 
                            value={kbSaveTitle}
                            onChange={(e) => setKbSaveTitle(e.target.value)}
                            placeholder="例如：神秘的卷轴内容"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 mt-2">
                        {aiOutput}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsSaveKbModalOpen(false)}>取消</Button>
                        <Button onClick={handleConfirmSaveKb} disabled={!kbSaveTitle.trim()}>保存</Button>
                    </div>
                </div>
            </Modal>
            
            {/* Consistency Check Report Modal */}
            <Modal isOpen={isConsistencyModalOpen} onClose={() => setIsConsistencyModalOpen(false)} title="故事连贯性检查报告">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-100">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p className="text-sm">
                            AI 正在对比生成内容与知识库中的【人物、世界观、背景、物品】等设定。
                            <br/>这仅供参考，以辅助您发现潜在的逻辑漏洞。
                        </p>
                    </div>
                    
                    <div className="bg-white border border-slate-200 rounded-lg p-5 max-h-[60vh] overflow-y-auto shadow-inner">
                        {consistencyReport ? (
                            <div className="prose prose-sm prose-slate max-w-none font-serif leading-relaxed whitespace-pre-wrap">
                                {consistencyReport}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <ShieldCheck className="w-12 h-12 mb-2 opacity-20" />
                                <p>暂无报告</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end">
                        <Button onClick={() => setIsConsistencyModalOpen(false)}>关闭</Button>
                    </div>
                </div>
            </Modal>

            {/* Auto Update Review Modal */}
            <Modal isOpen={isUpdateReviewModalOpen} onClose={() => setIsUpdateReviewModalOpen(false)} title="设定档案同步建议">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                        <Layers className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p className="text-sm">
                            AI 分析了当前章节，捕捉到以下设定变动（人物、物品、世界观等）。请勾选您希望同步的条目。
                        </p>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto space-y-3">
                        {knowledgeUpdates.map((update, index) => (
                            <div 
                                key={index} 
                                className={`border rounded-lg p-4 transition-all cursor-pointer ${
                                    selectedUpdates.has(index) 
                                    ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300' 
                                    : 'border-slate-200 bg-white hover:border-indigo-200'
                                }`}
                                onClick={() => toggleUpdateSelection(index)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        {selectedUpdates.has(index) ? (
                                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                                        ) : (
                                            <Square className="w-5 h-5 text-slate-300" />
                                        )}
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {update.categoryType === 'CHARACTER' ? '人物' :
                                             update.categoryType === 'WORLD' ? '世界观' :
                                             update.categoryType === 'ITEM' ? '物品' : '其他'}
                                        </span>
                                        <h4 className="font-bold text-slate-800">{update.name}</h4>
                                        {update.type === 'NEW' ? (
                                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">New</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Update</span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mb-2 font-medium">
                                    💡 理由: {update.reason}
                                </p>
                                <div className="text-sm text-slate-700 bg-white/50 p-2 rounded border border-slate-100 font-serif whitespace-pre-wrap">
                                    {update.description}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsUpdateReviewModalOpen(false)}>取消</Button>
                        <Button onClick={handleConfirmUpdates} disabled={selectedUpdates.size === 0}>
                            同步选中的设定 ({selectedUpdates.size})
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Prompt Selection Modal */}
            <Modal isOpen={isPromptModalOpen} onClose={() => setIsPromptModalOpen(false)} title="选择提示词模板">
                <div className="h-[450px] flex flex-col">
                    {/* Categories */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                        {PROMPT_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedPromptCategory(cat)}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedPromptCategory === cat ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                        {availablePrompts.filter(p => p.category === selectedPromptCategory).length === 0 ? (
                             <div className="text-center py-12 text-slate-400">
                                <p className="text-sm">该分类下无提示词，请先在提示词库添加。</p>
                             </div>
                        ) : (
                            availablePrompts
                                .filter(p => p.category === selectedPromptCategory)
                                .map(prompt => (
                                    <div 
                                        key={prompt.id}
                                        onClick={() => handleSelectPromptTemplate(prompt)}
                                        className="p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all group"
                                    >
                                        <h4 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-indigo-700">{prompt.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-2">{prompt.content}</p>
                                    </div>
                                ))
                        )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex justify-between items-center">
                         <span>点击选择作为AI指令的基础</span>
                         <button onClick={() => setIsPromptModalOpen(false)} className="text-slate-500 hover:text-slate-700">取消</button>
                    </div>
                </div>
            </Modal>

        </div>
    </div>
  );
};