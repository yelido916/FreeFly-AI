import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Sparkles, PlusCircle, FileText, MoreVertical, ChevronRight, ChevronDown, Book, PenTool, Database, Trash2, Plus, RefreshCw, LogIn, Copy, BookOpenText, X, Hash, AlignLeft, GripVertical, ScanSearch, ShieldCheck, AlertTriangle, Users, CheckSquare, Square, Layers, BrainCircuit, ChevronUp, Wand2, Bot, Zap, Play, Pause, AlertCircle, Eraser, Trash, Loader2 } from 'lucide-react';
import { Novel, Chapter, KnowledgeEntry, KnowledgeCategory, PromptTemplate, PromptCategory } from '../types';
import { saveNovel, fetchNovelById, generateId, getDefaultCategories, fetchPrompts, fetchPromptCategories } from '../services/storageService';
import { generateStorySegment, generateSummary, analyzeStoryConsistency, fixStoryConsistency, analyzeStoryEvolution, KnowledgeUpdateSuggestion, recommendRelevantKnowledge, expandKnowledgeEntry } from '../services/geminiService';
import { Button, Modal } from '../components/UI';

interface NovelEditorProps {
  novelId: string;
  onBack: () => void;
}

type ViewMode = 'writing' | 'knowledge';

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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isSmartContextMode, setIsSmartContextMode] = useState(false);
  const [analyzingContext, setAnalyzingContext] = useState(false);
  
  // Consistency & Auto-Update State
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [consistencyReport, setConsistencyReport] = useState<string | null>(null);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  const [isFixingConsistency, setIsFixingConsistency] = useState(false);
  
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);
  const [knowledgeUpdates, setKnowledgeUpdates] = useState<KnowledgeUpdateSuggestion[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set()); // Index of updates
  const [isUpdateReviewModalOpen, setIsUpdateReviewModalOpen] = useState(false);
  
  // Prompt Library Integration State
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [availablePrompts, setAvailablePrompts] = useState<PromptTemplate[]>([]);
  const [promptCategories, setPromptCategories] = useState<string[]>([]);
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<string>('正文');
  const [activePromptTemplate, setActivePromptTemplate] = useState<PromptTemplate | null>(null);
  const [promptSelectionTarget, setPromptSelectionTarget] = useState<'writing' | 'knowledge'>('writing');

  // Knowledge AI Assistant State
  const [isKnowledgeAiModalOpen, setIsKnowledgeAiModalOpen] = useState(false);
  const [knowledgeAiPrompt, setKnowledgeAiPrompt] = useState('');
  const [knowledgeAiOutput, setKnowledgeAiOutput] = useState('');
  const [isKnowledgeAiGenerating, setIsKnowledgeAiGenerating] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryCategoryId, setNewEntryCategoryId] = useState('');

  // Save to KB State
  const [isSaveKbModalOpen, setIsSaveKbModalOpen] = useState(false);
  const [kbSaveTitle, setKbSaveTitle] = useState('');
  const [kbSaveCategoryId, setKbSaveCategoryId] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadNovel = async () => {
        const loaded = await fetchNovelById(novelId);
        if (loaded) {
            // Migration for old novels without knowledge base
            if (!loaded.knowledgeCategories) {
                loaded.knowledgeCategories = getDefaultCategories();
                loaded.knowledgeEntries = [];
                await saveNovel(loaded); // Sync Update
            }

            setNovel(loaded);
            
            if (loaded.chapters.length > 0) {
                setActiveChapterId(loaded.chapters[0].id);
            } else {
                createChapter(loaded); // Async handling inside
            }

            if (loaded.knowledgeCategories.length > 0) {
                const firstCatId = loaded.knowledgeCategories[0].id;
                setActiveCategoryId(firstCatId);
                setKbSaveCategoryId(firstCatId);
                setNewEntryCategoryId(firstCatId);
            }
        }
    };
    loadNovel();
  }, [novelId]);

  // Load prompts and categories when modal opens
  useEffect(() => {
      const loadPrompts = async () => {
        if (isPromptModalOpen) {
            const prompts = await fetchPrompts();
            setAvailablePrompts(prompts);
            const cats = await fetchPromptCategories();
            setPromptCategories(cats);
            // Ensure selected category is valid
            if (!cats.includes(selectedPromptCategory) && cats.length > 0) {
                setSelectedPromptCategory(cats[0]);
            }
        }
      };
      loadPrompts();
  }, [isPromptModalOpen]);

  // Auto-save effect for Novel
  useEffect(() => {
    if (!novel) return;
    
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
        await saveNovel(novel);
    }, 2000);

    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
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

  // Calculate Token Usage (Approximate)
  const getEstimatedTokens = () => {
      if (!novel) return 0;
      let totalChars = 0;
      novel.knowledgeEntries.forEach(e => {
          if (selectedKnowledgeIds.has(e.id)) {
              totalChars += e.content.length;
          }
      });
      return totalChars;
  };

  // --- Chapter Logic ---
  const createChapter = async (currentNovel: Novel) => {
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
    await saveNovel(updatedNovel);
  };

  const updateActiveChapter = (field: keyof Chapter, value: string) => {
    if (!novel || !activeChapterId) return;
    const updatedChapters = novel.chapters.map(ch => 
      ch.id === activeChapterId ? { ...ch, [field]: value } : ch
    );
    setNovel({ ...novel, chapters: updatedChapters });
  };

  // --- Knowledge Base Logic ---
  const handleAddCategory = async () => {
      if (!novel || !newCategoryName.trim()) return;
      const newCat: KnowledgeCategory = { id: generateId(), name: newCategoryName.trim() };
      const updatedNovel = { ...novel, knowledgeCategories: [...novel.knowledgeCategories, newCat] };
      setNovel(updatedNovel);
      await saveNovel(updatedNovel); // Immediate save for structure changes
      setActiveCategoryId(newCat.id);
      setNewCategoryName('');
      setIsAddCatModalOpen(false);
  };

  const deleteCategory = async (e: React.MouseEvent, catId: string) => {
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
      await saveNovel(updatedNovel); // Immediate save
      
      if (activeCategoryId === catId) {
          setActiveCategoryId(null);
          setActiveEntryId(null);
      }
  };

  const handleCreateEntry = async () => {
      if (!novel || !activeCategoryId) return;
      const newEntry: KnowledgeEntry = {
          id: generateId(),
          categoryId: activeCategoryId,
          title: '新条目',
          content: ''
      };
      const updatedNovel = { ...novel, knowledgeEntries: [...novel.knowledgeEntries, newEntry] };
      setNovel(updatedNovel);
      await saveNovel(updatedNovel); // Immediate save
      setActiveEntryId(newEntry.id);
  };

  const updateActiveEntry = (field: keyof KnowledgeEntry, value: string) => {
      if (!novel || !activeEntryId) return;
      const updatedEntries = novel.knowledgeEntries.map(e => 
          e.id === activeEntryId ? { ...e, [field]: value } : e
      );
      setNovel({ ...novel, knowledgeEntries: updatedEntries });
  };

  const deleteEntry = async (e: React.MouseEvent, entryId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if(!novel || !confirm('确定要删除这个条目吗？')) return;
      
      const updatedEntries = novel.knowledgeEntries.filter(e => e.id !== entryId);
      const updatedNovel = { ...novel, knowledgeEntries: updatedEntries };
      
      setNovel(updatedNovel);
      await saveNovel(updatedNovel); // Immediate save
      
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
      e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
  };

  const onDragOverCat = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const onDropCat = async (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedCatIndex === null || !novel) return;
      if (draggedCatIndex === targetIndex) return;

      const newCategories = [...novel.knowledgeCategories];
      const [removed] = newCategories.splice(draggedCatIndex, 1);
      newCategories.splice(targetIndex, 0, removed);

      const updatedNovel = { ...novel, knowledgeCategories: newCategories };
      setNovel(updatedNovel);
      await saveNovel(updatedNovel);
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

  const onDropEntry = async (e: React.DragEvent, targetIndex: number) => {
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
      await saveNovel(updatedNovel);
      setDraggedEntryIndex(null);
  };


  // --- AI Logic ---
  const toggleKnowledgeSelection = (id: string) => {
      if (isSmartContextMode) return; // Disable manual toggle in smart mode
      const newSet = new Set(selectedKnowledgeIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedKnowledgeIds(newSet);
  };

  const toggleCategoryCollapse = (catId: string) => {
      const newSet = new Set(collapsedCategories);
      if (newSet.has(catId)) {
          newSet.delete(catId);
      } else {
          newSet.add(catId);
      }
      setCollapsedCategories(newSet);
  };

  const isAllKnowledgeSelected = novel && novel.knowledgeEntries.length > 0 && 
        novel.knowledgeEntries.every(e => selectedKnowledgeIds.has(e.id));

  const handleToggleSelectAllKnowledge = () => {
      if (!novel || isSmartContextMode) return;
      if (isAllKnowledgeSelected) {
          setSelectedKnowledgeIds(new Set());
      } else {
          const allIds = novel.knowledgeEntries.map(e => e.id);
          setSelectedKnowledgeIds(new Set(allIds));
      }
  };

  const handleAIWrite = async () => {
    if (!novel || !activeChapterId || isAIWriting) return;

    setIsAIWriting(true);
    setAiOutput(''); // Clear previous output (will trigger auto-save clear)
    
    const currentChapterIndex = novel.chapters.findIndex(c => c.id === activeChapterId);
    
    // Construct the final prompt
    let promptToUse = '';
    if (activePromptTemplate) {
        promptToUse = activePromptTemplate.content;
        if (aiPrompt.trim()) {
            promptToUse += `\n\n用户补充指令/具体细节:\n${aiPrompt.trim()}`;
        }
    } else {
        promptToUse = aiPrompt.trim() || "请顺着当前的内容自然地续写。";
    }

    let finalSelectedIds = new Set(selectedKnowledgeIds);

    // --- SMART CONTEXT SELECTION STEP ---
    if (isSmartContextMode) {
        setAnalyzingContext(true);
        try {
            // Prepare index for AI
            const index = novel.knowledgeEntries.map(e => ({
                id: e.id,
                title: e.title,
                category: novel.knowledgeCategories.find(c => c.id === e.categoryId)?.name || 'Unknown'
            }));
            
            // Find outline (simplified: looks for entries in "Outline" categories)
            const outlineEntries = novel.knowledgeEntries.filter(e => {
                const catName = novel.knowledgeCategories.find(c => c.id === e.categoryId)?.name || '';
                return /大纲|卷纲|细纲|Synopsis|Outline/.test(catName);
            });
            const outlineText = outlineEntries.map(e => e.content).join('\n').substring(0, 2000);

            const recommendedIds = await recommendRelevantKnowledge(
                promptToUse, 
                novel.title, 
                novel.description + '\n' + outlineText, 
                index
            );
            
            // Update the set for generation
            finalSelectedIds = new Set(recommendedIds);
            
            // Optional: Visually update the checkboxes to show what AI picked (for user feedback)
            setSelectedKnowledgeIds(finalSelectedIds);

        } catch (e) {
            console.error("Smart context failed", e);
        } finally {
            setAnalyzingContext(false);
        }
    }

    // Gather reference content based on final selection
    const references = novel.knowledgeEntries
        .filter(e => finalSelectedIds.has(e.id))
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
      // Default to first category if it not set
      if (!kbSaveCategoryId && novel?.knowledgeCategories.length) {
          setKbSaveCategoryId(novel.knowledgeCategories[0].id);
      }
      setIsSaveKbModalOpen(true);
  };

  const handleConfirmSaveKb = async () => {
      if (!novel || !kbSaveCategoryId || !kbSaveTitle.trim()) return;
      
      const newEntry: KnowledgeEntry = {
          id: generateId(),
          categoryId: kbSaveCategoryId,
          title: kbSaveTitle.trim(),
          content: aiOutput
      };
      
      const updatedNovel = { ...novel, knowledgeEntries: [...novel.knowledgeEntries, newEntry] };
      setNovel(updatedNovel);
      await saveNovel(updatedNovel);
      setIsSaveKbModalOpen(false);
      alert('已保存到知识库！');
  };
  
  // --- Knowledge AI Assistant Logic ---
  const handleOpenKnowledgeAi = () => {
      setKnowledgeAiPrompt('');
      setKnowledgeAiOutput('');
      setNewEntryTitle('');
      if (activeCategoryId) setNewEntryCategoryId(activeCategoryId);
      setIsKnowledgeAiModalOpen(true);
  };

  const handleKnowledgeAiGenerate = async () => {
      if (!novel || (!activeEntryId && !activeCategoryId)) return;
      
      // If entry selected, use its content. If not, use empty context or category desc?
      // Assuming entry is selected for expansion. 
      const currentContent = activeEntryId 
        ? novel.knowledgeEntries.find(e => e.id === activeEntryId)?.content || ''
        : '';

      setIsKnowledgeAiGenerating(true);
      try {
          const result = await expandKnowledgeEntry(currentContent, knowledgeAiPrompt);
          setKnowledgeAiOutput(result);
      } catch (e) {
          alert("生成失败");
      } finally {
          setIsKnowledgeAiGenerating(false);
      }
  };
  
  const handleSaveKnowledgeOutputAsNew = async () => {
      if (!novel || !newEntryCategoryId || !newEntryTitle.trim() || !knowledgeAiOutput) return;
      
      const newEntry: KnowledgeEntry = {
          id: generateId(),
          categoryId: newEntryCategoryId,
          title: newEntryTitle.trim(),
          content: knowledgeAiOutput
      };
      
      const updatedNovel = { ...novel, knowledgeEntries: [...novel.knowledgeEntries, newEntry] };
      setNovel(updatedNovel);
      await saveNovel(updatedNovel);
      
      setIsKnowledgeAiModalOpen(false);
      // Switch to new entry
      setActiveCategoryId(newEntryCategoryId);
      setActiveEntryId(newEntry.id);
      alert('新条目创建成功！');
  };

  const handleReplaceCurrentEntry = () => {
      if (!activeEntryId) return;
      updateActiveEntry('content', knowledgeAiOutput);
      setIsKnowledgeAiModalOpen(false);
  };
  
  const handleAppendToCurrentEntry = () => {
       if (!activeEntryId) return;
       const current = novel?.knowledgeEntries.find(e => e.id === activeEntryId)?.content || '';
       updateActiveEntry('content', current + '\n\n' + knowledgeAiOutput);
       setIsKnowledgeAiModalOpen(false);
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

  const handleAutoFixConsistency = async () => {
      if (!novel || !aiOutput || !consistencyReport) return;
      
      setIsFixingConsistency(true);
      
      // Same logic to get context as check
      const targetCategoryIds = novel.knowledgeCategories
        .filter(c => 
            /人物|角色|Character|主角|反派|世界观|背景|设定|物品|金手指|World|Setting|Item/i.test(c.name)
        )
        .map(c => c.id);
      const relevantEntries = novel.knowledgeEntries.filter(e => targetCategoryIds.includes(e.categoryId));
      const categoryMap = novel.knowledgeCategories.reduce((acc, cat) => {
          acc[cat.id] = cat.name;
          return acc;
      }, {} as Record<string, string>);

      try {
          const fixedText = await fixStoryConsistency(aiOutput, consistencyReport, relevantEntries, categoryMap);
          setAiOutput(fixedText);
          alert("修正完成！生成结果已更新。");
          setIsConsistencyModalOpen(false);
      } catch (e) {
          alert("修正失败，请检查网络连接。");
      } finally {
          setIsFixingConsistency(false);
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

  const handleConfirmUpdates = async () => {
      if (!novel) return;
      
      let updatedCategories = [...novel.knowledgeCategories];
      let updatedEntries = [...novel.knowledgeEntries];
      
      // Helper to find or create category
      const ensureCategoryForType = (type: string): string => {
          // 1. Keyword mapping
          const keywordMap: Record<string, string[]> = {
              'CHARACTER': ['人物', '角色', 'Character', 'Person', '主角', '配角'],
              'WORLD': ['世界', '地点', '背景', '势力', 'World', 'Location', 'Map', 'Geography'],
              'ITEM': ['物品', '道具', '金手指', '武器', 'Item', 'Artifact', 'System'],
              'OTHER': ['其他', '杂项', '设定', 'Other']
          };
          
          const keywords = keywordMap[type] || ['其他'];
          
          // 2. Try to find existing category
          const existingCat = updatedCategories.find(c => keywords.some(k => c.name.includes(k)));
          if (existingCat) return existingCat.id;

          // 3. If not found, create specific new category
          const defaultNames: Record<string, string> = { 
              'CHARACTER': '人物档案 (自动归档)', 
              'WORLD': '世界观设定 (自动归档)', 
              'ITEM': '物品与金手指 (自动归档)', 
              'OTHER': '未分类设定 (自动归档)' 
          };
          
          const newName = defaultNames[type] || '新设定 (自动归档)';
          
          // Check if we already created this specific category in previous loop iterations
          const alreadyCreatedCat = updatedCategories.find(c => c.name === newName);
          if (alreadyCreatedCat) return alreadyCreatedCat.id;

          const newCat = { id: generateId(), name: newName };
          updatedCategories.push(newCat);
          return newCat.id;
      };

      for (const index of selectedUpdates) {
          const update = knowledgeUpdates[index];
          if (!update) continue;

          // Case 1: UPDATE
          if (update.type === 'UPDATE') {
              let targetEntryIndex = -1;
              
              // Try ID
              if (update.originalId) {
                  targetEntryIndex = updatedEntries.findIndex(e => e.id === update.originalId);
              }
              
              // Try Name Fuzzy Match if ID failed
              if (targetEntryIndex === -1) {
                  targetEntryIndex = updatedEntries.findIndex(e => e.title === update.name);
              }

              if (targetEntryIndex !== -1) {
                  // Found -> Update content
                  updatedEntries[targetEntryIndex] = {
                      ...updatedEntries[targetEntryIndex],
                      content: update.description 
                  };
                  continue; 
              }
              // If not found, fall through to NEW logic
          }

          // Case 2: NEW (or failed UPDATE)
          const catId = ensureCategoryForType(update.categoryType);
          updatedEntries.push({
              id: generateId(),
              categoryId: catId,
              title: update.name,
              content: update.description
          });
      }

      const updatedNovel = { 
          ...novel, 
          knowledgeCategories: updatedCategories, 
          knowledgeEntries: updatedEntries 
      };
      
      setNovel(updatedNovel);
      await saveNovel(updatedNovel);
      setIsUpdateReviewModalOpen(false);
      alert(`成功同步！\n已更新/新增 ${selectedUpdates.size} 条设定。`);
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
      if (promptSelectionTarget === 'writing') {
          setActivePromptTemplate(template);
      } else if (promptSelectionTarget === 'knowledge') {
          setKnowledgeAiPrompt(template.content);
      }
      setIsPromptModalOpen(false);
  };
  
  const openPromptModal = (target: 'writing' | 'knowledge') => {
      setPromptSelectionTarget(target);
      setIsPromptModalOpen(true);
  };

  const handleRemovePromptTemplate = () => {
      setActivePromptTemplate(null);
  };

  const activeChapter = novel?.chapters.find(c => c.id === activeChapterId);
  const activeEntry = novel?.knowledgeEntries.find(e => e.id === activeEntryId);
  const activeCategoryName = novel?.knowledgeCategories.find(c => c.id === activeCategoryId)?.name || '';
  const entriesInCategory = novel?.knowledgeEntries.filter(e => e.categoryId === activeCategoryId) || [];
  
  // Stats
  const currentChapterWords = getWordCount(activeChapter?.content);
  const totalWords = novel ? novel.chapters.reduce((acc, c) => acc + getWordCount(c.content), 0) : 0;
  const estimatedReferenceTokens = getEstimatedTokens();

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
                            {/* Prompt Selection */}
                            <div className="mb-3">
                                {activePromptTemplate ? (
                                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 relative group">
                                        <div className="text-xs text-indigo-400 font-semibold mb-1 flex items-center">
                                            <BookOpenText className="w-3 h-3 mr-1" /> 引用模板
                                        </div>
                                        <div className="text-sm text-indigo-900 font-medium mb-1">{activePromptTemplate.title}</div>
                                        <div className="text-xs text-indigo-700 line-clamp-2">{activePromptTemplate.content}</div>
                                        <button 
                                            onClick={handleRemovePromptTemplate}
                                            className="absolute top-2 right-2 text-indigo-300 hover:text-indigo-500"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => openPromptModal('writing')}
                                        className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 text-xs hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <BookOpenText className="w-3 h-3" /> 📚 引用提示词
                                    </button>
                                )}
                            </div>

                            <div className="mb-4 flex-shrink-0 relative">
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder={activePromptTemplate ? "补充具体的指令细节..." : "告诉 AI 您想写什么..."}
                                    className="w-full h-32 p-3 border border-slate-200 rounded-lg resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-8"
                                />
                                {aiPrompt && (
                                    <button 
                                        onClick={() => setAiPrompt('')}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 bg-white/80 rounded-full p-1 backdrop-blur-sm"
                                        title="清空内容"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                        <span className="text-xs text-slate-500">字数:</span>
                                        <input 
                                            type="number"
                                            value={targetWordCount}
                                            onChange={(e) => setTargetWordCount(e.target.value)}
                                            placeholder="默认"
                                            className="w-12 bg-transparent text-xs border-none focus:ring-0 p-0 text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            引用知识库 {estimatedReferenceTokens > 0 && <span className="text-slate-400 normal-case font-normal"> (约 {estimatedReferenceTokens} Tokens)</span>}
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleToggleSelectAllKnowledge}
                                            disabled={isSmartContextMode}
                                            className="text-[10px] text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                                        >
                                            {isAllKnowledgeSelected ? '取消全选' : '全选'}
                                        </button>
                                        <button 
                                            onClick={() => setIsSmartContextMode(!isSmartContextMode)}
                                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors border ${isSmartContextMode ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                            title="自动分析大纲和指令，只引用相关条目，节省 Token"
                                        >
                                            <Bot className="w-3 h-3" /> 智能引用
                                        </button>
                                    </div>
                                </div>
                                <div className={`space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 ${isSmartContextMode ? 'opacity-60 pointer-events-none bg-slate-50' : ''}`}>
                                    {analyzingContext && (
                                        <div className="flex items-center justify-center py-4 text-xs text-indigo-500">
                                            <ScanSearch className="w-4 h-4 mr-2 animate-spin" /> 正在分析相关性...
                                        </div>
                                    )}
                                    {novel.knowledgeCategories.map(cat => {
                                        const entries = novel.knowledgeEntries.filter(e => e.categoryId === cat.id);
                                        if (entries.length === 0) return null;
                                        const isCollapsed = collapsedCategories.has(cat.id);
                                        
                                        return (
                                            <div key={cat.id}>
                                                <div 
                                                    className="text-xs font-medium text-slate-700 mb-1 bg-slate-50 px-2 py-1 rounded flex items-center justify-between cursor-pointer hover:bg-slate-100"
                                                    onClick={() => toggleCategoryCollapse(cat.id)}
                                                >
                                                    <span>{cat.name}</span>
                                                    {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                                </div>
                                                {!isCollapsed && (
                                                    <div className="pl-2 space-y-1">
                                                        {entries.map(entry => (
                                                            <label key={entry.id} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={selectedKnowledgeIds.has(entry.id)}
                                                                    onChange={() => toggleKnowledgeSelection(entry.id)}
                                                                    className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                                />
                                                                <span className="truncate">{entry.title}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {novel.knowledgeEntries.length === 0 && <div className="text-xs text-slate-400 text-center py-2">暂无知识库条目</div>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                <Button 
                                    onClick={handleAIWrite} 
                                    isLoading={isAIWriting} 
                                    className="col-span-2 w-full"
                                    icon={<Sparkles className="w-4 h-4" />}
                                >
                                    {isAIWriting ? 'AI 思考中...' : '生成内容'}
                                </Button>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={handleAutoSyncKnowledge} 
                                    isLoading={isSyncingKnowledge}
                                    icon={<Users className="w-3 h-3" />}
                                    className="text-xs"
                                >
                                    同步设定档案
                                </Button>
                                <Button 
                                    variant="secondary" 
                                    size="sm"
                                    onClick={() => {}} // TODO: Rewrite
                                    icon={<RefreshCw className="w-3 h-3" />}
                                    className="text-xs"
                                    disabled
                                >
                                    重写选段
                                </Button>
                            </div>
                        </div>

                        {/* Output Panel */}
                        {aiOutput && (
                            <div className="h-1/2 border-t border-slate-200 flex flex-col bg-slate-50 animate-slide-up">
                                <div className="px-4 py-2 border-b border-slate-200 flex justify-between items-center bg-white">
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                        生成结果 ({getWordCount(aiOutput)}字)
                                        {/* Saved Draft Indicator */}
                                        <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 rounded border border-slate-200">已保存草稿</span>
                                    </span>
                                    <div className="flex gap-1">
                                         <button 
                                            onClick={handleConsistencyCheck}
                                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                            title="检查连贯性 (OOC/Bug)"
                                            disabled={isCheckingConsistency}
                                        >
                                            {isCheckingConsistency ? <Loader2 className="w-4 h-4 animate-spin"/> : <ShieldCheck className="w-4 h-4" />}
                                        </button>
                                        <button 
                                            onClick={() => setAiOutput('')}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="清空结果"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-slate-700 font-serif">
                                    {aiOutput}
                                </div>
                                <div className="p-3 border-t border-slate-200 bg-white flex gap-2 justify-end">
                                    <Button size="sm" variant="ghost" onClick={handleOpenSaveKb} icon={<Save className="w-3 h-3"/>}>存入设定</Button>
                                    <Button size="sm" variant="secondary" onClick={handleAIWrite} icon={<RefreshCw className="w-3 h-3"/>}>重写</Button>
                                    <Button size="sm" onClick={handleInsertContent} icon={<LogIn className="w-3 h-3"/>}>插入正文</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* --- KNOWLEDGE BASE MODE --- */}
            {viewMode === 'knowledge' && (
                <div className="flex w-full h-full">
                    {/* Column 1: Categories */}
                    <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                            <span className="font-bold text-slate-700">分类</span>
                            <button onClick={() => setIsAddCatModalOpen(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {novel.knowledgeCategories.map((cat, index) => (
                                <div 
                                    key={cat.id}
                                    draggable
                                    onDragStart={(e) => onDragStartCat(e, index)}
                                    onDragOver={(e) => onDragOverCat(e, index)}
                                    onDrop={(e) => onDropCat(e, index)}
                                    onClick={() => { setActiveCategoryId(cat.id); setActiveEntryId(null); }}
                                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${activeCategoryId === cat.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <GripVertical className="w-3 h-3 text-slate-300 cursor-grab opacity-0 group-hover:opacity-100" />
                                        <span className="truncate">{cat.name}</span>
                                        <span className="text-xs text-slate-400 bg-slate-200/50 px-1.5 rounded-full">
                                            {novel.knowledgeEntries.filter(e => e.categoryId === cat.id).length}
                                        </span>
                                    </div>
                                    <button onClick={(e) => deleteCategory(e, cat.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Entries List */}
                    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
                         <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <span className="font-bold text-slate-700 truncate">{activeCategoryName || '选择分类'}</span>
                            <button onClick={handleCreateEntry} disabled={!activeCategoryId} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded disabled:opacity-50">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {entriesInCategory.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">该分类暂无条目</div>
                            ) : (
                                entriesInCategory.map((entry, index) => (
                                    <div 
                                        key={entry.id}
                                        draggable
                                        onDragStart={(e) => onDragStartEntry(e, index)}
                                        onDragOver={onDragOverEntry}
                                        onDrop={(e) => onDropEntry(e, index)}
                                        onClick={() => setActiveEntryId(entry.id)}
                                        className={`group flex items-center justify-between px-3 py-3 rounded-lg text-sm cursor-pointer transition-colors border border-transparent ${activeEntryId === entry.id ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                             <GripVertical className="w-3 h-3 text-slate-300 cursor-grab opacity-0 group-hover:opacity-100" />
                                             <span className="truncate">{entry.title}</span>
                                        </div>
                                        <button onClick={(e) => deleteEntry(e, entry.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Column 3: Entry Editor */}
                    <div className="flex-1 flex flex-col bg-slate-50/30">
                        {activeEntry ? (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-start">
                                     <input 
                                        value={activeEntry.title}
                                        onChange={(e) => updateActiveEntry('title', e.target.value)}
                                        className="text-2xl font-bold text-slate-900 border-none focus:ring-0 focus:outline-none bg-transparent placeholder-slate-300 flex-1 mr-4"
                                        placeholder="条目标题"
                                     />
                                     <div className="flex gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            onClick={handleOpenKnowledgeAi}
                                            icon={<Sparkles className="w-3 h-3 text-indigo-500" />}
                                            className="bg-indigo-50 border-indigo-100 hover:bg-indigo-100 text-indigo-700"
                                        >
                                            AI 助手
                                        </Button>
                                        <button 
                                            onClick={(e) => deleteEntry(e, activeEntry.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="删除条目"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                     </div>
                                </div>
                                <div className="flex-1 p-8 overflow-y-auto">
                                     <textarea
                                        value={activeEntry.content}
                                        onChange={(e) => updateActiveEntry('content', e.target.value)}
                                        className="w-full h-full min-h-[50vh] resize-none border-none focus:ring-0 outline-none text-base leading-relaxed text-slate-700 bg-transparent font-mono placeholder-slate-300"
                                        placeholder="在此输入详细设定..."
                                     />
                                </div>
                                <div className="h-8 bg-white border-t border-slate-200 flex items-center justify-end px-4 text-xs text-slate-400">
                                     <span>{getWordCount(activeEntry.content)} 字</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-300 flex-col">
                                <Database className="w-16 h-16 mb-4 opacity-20" />
                                <p>选择或创建一个条目开始编辑</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Modals */}
        <Modal isOpen={isAddCatModalOpen} onClose={() => setIsAddCatModalOpen(false)} title="新建分类">
            <div className="space-y-4">
                <input 
                    value={newCategoryName} 
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="分类名称 (如: 功法技能)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsAddCatModalOpen(false)}>取消</Button>
                    <Button onClick={handleAddCategory}>创建</Button>
                </div>
            </div>
        </Modal>
        
        {/* Prompt Library Selection Modal */}
        <Modal isOpen={isPromptModalOpen} onClose={() => setIsPromptModalOpen(false)} title="选择提示词" zIndexClass="z-[60]">
            <div className="h-96 flex flex-col">
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {promptCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedPromptCategory(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedPromptCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {availablePrompts.filter(p => p.category === selectedPromptCategory).map(prompt => (
                        <div 
                            key={prompt.id}
                            onClick={() => handleSelectPromptTemplate(prompt)}
                            className="p-3 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all group"
                        >
                            <div className="font-bold text-slate-800 text-sm mb-1 group-hover:text-indigo-700">{prompt.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-2">{prompt.content}</div>
                        </div>
                    ))}
                    {availablePrompts.filter(p => p.category === selectedPromptCategory).length === 0 && (
                        <div className="text-center text-slate-400 py-8 text-sm">该分类下暂无提示词</div>
                    )}
                </div>
            </div>
        </Modal>

        {/* Consistency Report Modal */}
        <Modal isOpen={isConsistencyModalOpen} onClose={() => setIsConsistencyModalOpen(false)} title="连贯性检查报告">
             <div className="max-h-[60vh] overflow-y-auto p-4 bg-slate-50 rounded-lg mb-4 whitespace-pre-wrap text-sm leading-relaxed border border-slate-200">
                 {consistencyReport || "分析中..."}
             </div>
             <div className="flex justify-end gap-3">
                 <Button variant="ghost" onClick={() => setIsConsistencyModalOpen(false)}>关闭</Button>
                 <Button 
                    onClick={handleAutoFixConsistency} 
                    isLoading={isFixingConsistency}
                    icon={<Wand2 className="w-4 h-4"/>}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 border-none text-white"
                 >
                     ✨ 根据报告自动修订
                 </Button>
             </div>
        </Modal>
        
        {/* Knowledge Sync Review Modal */}
        <Modal isOpen={isUpdateReviewModalOpen} onClose={() => setIsUpdateReviewModalOpen(false)} title="设定档案同步建议">
             <div className="mb-4">
                 <p className="text-sm text-slate-600 mb-2">AI 检测到以下设定变化，建议更新到知识库：</p>
                 <div className="max-h-[50vh] overflow-y-auto space-y-2">
                     {knowledgeUpdates.map((item, idx) => (
                         <div 
                            key={idx} 
                            onClick={() => toggleUpdateSelection(idx)}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-start gap-3 ${selectedUpdates.has(idx) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                         >
                             <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedUpdates.has(idx) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                 {selectedUpdates.has(idx) && <CheckSquare className="w-3 h-3 text-white" />}
                             </div>
                             <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-1">
                                     <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.type === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                         {item.type === 'NEW' ? '新档案' : '更新'}
                                     </span>
                                     <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                         {item.categoryType}
                                     </span>
                                     <span className="font-bold text-sm text-slate-800">{item.name}</span>
                                 </div>
                                 <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                                 <p className="text-[10px] text-slate-400 mt-1 italic">理由: {item.reason}</p>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
             <div className="flex justify-end gap-3">
                 <Button variant="ghost" onClick={() => setIsUpdateReviewModalOpen(false)}>取消</Button>
                 <Button onClick={handleConfirmUpdates} disabled={selectedUpdates.size === 0}>
                     确认同步 ({selectedUpdates.size})
                 </Button>
             </div>
        </Modal>

        {/* Save to Knowledge Base Modal */}
        <Modal isOpen={isSaveKbModalOpen} onClose={() => setIsSaveKbModalOpen(false)} title="保存到知识库">
             <div className="space-y-4">
                 <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">条目标题</label>
                     <input 
                        value={kbSaveTitle}
                        onChange={(e) => setKbSaveTitle(e.target.value)}
                        placeholder="例如：魔法防御机制"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                     />
                 </div>
                 <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">选择分类</label>
                     <select 
                        value={kbSaveCategoryId}
                        onChange={(e) => setKbSaveCategoryId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                         {novel.knowledgeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                 </div>
                 <div className="max-h-32 overflow-y-auto p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-500">
                     {aiOutput.substring(0, 300)}...
                 </div>
                 <div className="flex justify-end gap-3">
                     <Button variant="ghost" onClick={() => setIsSaveKbModalOpen(false)}>取消</Button>
                     <Button onClick={handleConfirmSaveKb}>保存</Button>
                 </div>
             </div>
        </Modal>
        
        {/* Knowledge AI Assistant Modal */}
        <Modal isOpen={isKnowledgeAiModalOpen} onClose={() => setIsKnowledgeAiModalOpen(false)} title="设定扩充与衍生助手">
             <div className="flex flex-col h-[60vh]">
                 <div className="flex-shrink-0 mb-4 space-y-3">
                     <div className="flex gap-2">
                         <button 
                             onClick={() => openPromptModal('knowledge')}
                             className="flex items-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
                         >
                             <BookOpenText className="w-3 h-3" /> 引用提示词
                         </button>
                     </div>
                     <textarea 
                        value={knowledgeAiPrompt}
                        onChange={(e) => setKnowledgeAiPrompt(e.target.value)}
                        placeholder="输入指令（例如：根据当前描述，扩写外貌细节；或者：基于此设定，创造一个对立的角色）..."
                        className="w-full h-24 p-3 border border-slate-200 rounded-lg resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                     />
                     <Button 
                        onClick={handleKnowledgeAiGenerate} 
                        isLoading={isKnowledgeAiGenerating}
                        className="w-full"
                        icon={<Sparkles className="w-4 h-4"/>}
                     >
                         开始生成
                     </Button>
                 </div>
                 
                 <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 p-3 overflow-y-auto text-sm whitespace-pre-wrap mb-4">
                     {knowledgeAiOutput || <span className="text-slate-400 italic">生成结果将显示在这里...</span>}
                 </div>

                 <div className="flex-shrink-0 border-t border-slate-100 pt-4">
                     {knowledgeAiOutput ? (
                         <div className="space-y-3">
                             <div className="flex gap-2 items-end">
                                 <div className="flex-1">
                                     <label className="block text-xs text-slate-500 mb-1">新条目标题</label>
                                     <input 
                                        value={newEntryTitle}
                                        onChange={(e) => setNewEntryTitle(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                        placeholder="新条目名称"
                                     />
                                 </div>
                                 <div className="w-1/3">
                                     <label className="block text-xs text-slate-500 mb-1">目标分类</label>
                                     <select 
                                        value={newEntryCategoryId}
                                        onChange={(e) => setNewEntryCategoryId(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                     >
                                         {novel.knowledgeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </select>
                                 </div>
                             </div>
                             <div className="flex justify-end gap-2">
                                 <Button variant="ghost" size="sm" onClick={handleAppendToCurrentEntry}>追加到当前文档</Button>
                                 <Button variant="ghost" size="sm" onClick={handleReplaceCurrentEntry}>覆盖当前文档</Button>
                                 <Button size="sm" onClick={handleSaveKnowledgeOutputAsNew} disabled={!newEntryTitle.trim()}>新建条目并归档</Button>
                             </div>
                         </div>
                     ) : (
                         <div className="flex justify-end">
                             <Button variant="ghost" onClick={() => setIsKnowledgeAiModalOpen(false)}>关闭</Button>
                         </div>
                     )}
                 </div>
             </div>
        </Modal>
    </div>
  );
};