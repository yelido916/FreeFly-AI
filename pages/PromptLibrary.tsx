
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Edit3, Tag, FileText, Search, Sparkles, Loader2, ArrowRight, FolderPlus } from 'lucide-react';
import { PromptTemplate, PromptCategory } from '../types';
import { fetchPrompts, savePrompt, deletePrompt, generateId, fetchPromptCategories, addPromptCategory, deletePromptCategory } from '../services/storageService';
import { Button, Card, Modal } from '../components/UI';
import { generatePromptTemplate, optimizePromptTemplate } from '../services/geminiService';

export const PromptLibrary: React.FC = () => {
    const [categories, setCategories] = useState<string[]>([]);
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('脑洞');
    const [searchQuery, setSearchQuery] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
    
    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formCategory, setFormCategory] = useState<string>('脑洞');

    // AI Assistant State
    const [showAiAssist, setShowAiAssist] = useState(false);
    const [aiAssistInput, setAiAssistInput] = useState('');
    const [isGeneratingAiPrompt, setIsGeneratingAiPrompt] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [cats, loadedPrompts] = await Promise.all([
                fetchPromptCategories(),
                fetchPrompts()
            ]);
            setCategories(cats);
            setPrompts(loadedPrompts);
            
            // Validate active category
            if (!cats.includes(selectedCategory) && cats.length > 0) {
                setSelectedCategory(cats[0]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        if (categories.includes(newCategoryName.trim())) {
            alert('分类已存在');
            return;
        }
        await addPromptCategory(newCategoryName.trim());
        const updatedCats = await fetchPromptCategories();
        setCategories(updatedCats);
        setSelectedCategory(newCategoryName.trim());
        setNewCategoryName('');
    };

    const handleDeleteCategory = async (e: React.MouseEvent, cat: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const promptsInCat = prompts.filter(p => p.category === cat);
        if (promptsInCat.length > 0) {
            alert(`无法删除分类“${cat}”，因为它包含 ${promptsInCat.length} 个提示词。\n请先删除或移动分类下的内容。`);
            return;
        }
        
        if (window.confirm(`确定要删除空分类“${cat}”吗？`)) {
            await deletePromptCategory(cat);
            const updatedCats = await fetchPromptCategories();
            setCategories(updatedCats);
            // If we deleted the active category, switch to the first available
            if (selectedCategory === cat) {
                setSelectedCategory(updatedCats[0] || '');
            }
        }
    };

    const handleOpenCreate = () => {
        setEditingPrompt(null);
        setFormTitle('');
        setFormContent('');
        // Default to current category if it exists, else first category
        setFormCategory(selectedCategory && categories.includes(selectedCategory) ? selectedCategory : categories[0]);
        setShowAiAssist(false);
        setAiAssistInput('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (e: React.MouseEvent, prompt: PromptTemplate) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingPrompt(prompt);
        setFormTitle(prompt.title);
        setFormContent(prompt.content);
        setFormCategory(prompt.category);
        setShowAiAssist(false);
        setAiAssistInput('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !formContent.trim()) return;

        const promptToSave: PromptTemplate = {
            id: editingPrompt ? editingPrompt.id : generateId(),
            title: formTitle,
            content: formContent,
            category: formCategory,
            createdAt: editingPrompt ? editingPrompt.createdAt : Date.now()
        };

        await savePrompt(promptToSave);
        loadData();
        setIsModalOpen(false);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (window.confirm('确定要删除这个提示词吗？')) {
            await deletePrompt(id);
            loadData();
        }
    };

    const handleCopy = (e: React.MouseEvent, content: string) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(content);
        // Optional: show toast
    };

    const handleAiAssist = async () => {
        if (!aiAssistInput.trim()) return;
        setIsGeneratingAiPrompt(true);
        try {
            let result = '';
            if (!formContent.trim()) {
                // Generate from scratch
                result = await generatePromptTemplate(aiAssistInput, formCategory);
            } else {
                // Optimize existing
                result = await optimizePromptTemplate(formContent, aiAssistInput);
            }
            
            if (result) {
                setFormContent(result);
                setAiAssistInput(''); // Clear intent after success
            }
        } catch (e) {
            alert('AI 助手暂时繁忙，请重试。');
        } finally {
            setIsGeneratingAiPrompt(false);
        }
    };

    const filteredPrompts = prompts.filter(p => 
        p.category === selectedCategory && 
        (p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex h-[calc(100vh-64px)] bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-indigo-600" />
                        分类目录
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {isLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-300 w-5 h-5" /></div>
                    ) : (
                        categories.map(cat => (
                            <div
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center cursor-pointer group ${
                                    selectedCategory === cat 
                                    ? 'bg-indigo-50 text-indigo-700' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <span className="truncate mr-2">{cat}</span>
                                <div className="flex items-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full mr-1 ${selectedCategory === cat ? 'bg-white/50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
                                        {prompts.filter(p => p.category === cat).length}
                                    </span>
                                    <button 
                                        onClick={(e) => handleDeleteCategory(e, cat)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="删除分类"
                                    >
                                        <Trash2 className="w-3 h-3 pointer-events-none" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-3 border-t border-slate-100">
                    <div className="flex gap-2">
                        <input 
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="新分类名称"
                            className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                        />
                        <button 
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim()}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-slate-800">{selectedCategory}库</h3>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="搜索提示词..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-1.5 rounded-full border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64"
                            />
                        </div>
                    </div>
                    <Button onClick={handleOpenCreate} icon={<Plus className="w-4 h-4" />}>
                        新建提示词
                    </Button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-8">
                    {isLoading ? (
                         <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
                    ) : filteredPrompts.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>该分类下暂无提示词</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredPrompts.map(prompt => (
                                <div key={prompt.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-slate-800 text-lg">{prompt.title}</h4>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                                            <button 
                                                onClick={(e) => handleOpenEdit(e, prompt)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                title="编辑"
                                            >
                                                <Edit3 className="w-4 h-4 pointer-events-none" />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDelete(e, prompt.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4 pointer-events-none" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 mb-4 flex-1 font-mono whitespace-pre-wrap line-clamp-4">
                                        {prompt.content}
                                    </div>
                                    <div className="flex justify-end pt-2 border-t border-slate-100">
                                        <button 
                                            onClick={(e) => handleCopy(e, prompt.content)}
                                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3 pointer-events-none" /> 复制内容
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Modal */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingPrompt ? "编辑提示词" : "新建提示词"}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                            <input 
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="例如：英雄之旅模板"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
                            <select 
                                value={formCategory}
                                onChange={(e) => setFormCategory(e.target.value as string)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-700">提示词内容</label>
                            <button 
                                onClick={() => setShowAiAssist(!showAiAssist)}
                                className={`text-xs flex items-center gap-1 transition-colors ${showAiAssist ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-indigo-600'}`}
                            >
                                <Sparkles className="w-3 h-3" />
                                {showAiAssist ? '收起 AI 助手' : '✨ AI 帮写/优化'}
                            </button>
                        </div>

                        {/* AI Assist Panel */}
                        {showAiAssist && (
                            <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg animate-fade-in">
                                <div className="flex gap-2">
                                    <input 
                                        value={aiAssistInput}
                                        onChange={(e) => setAiAssistInput(e.target.value)}
                                        placeholder={
                                            !formContent.trim() 
                                            ? "描述您的需求（例如：帮我写一个...）..." 
                                            : "输入修改建议（例如：让语气更幽默、增加反派细节）..."
                                        }
                                        className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAiAssist()}
                                    />
                                    <Button 
                                        size="sm" 
                                        onClick={handleAiAssist} 
                                        disabled={!aiAssistInput.trim() || isGeneratingAiPrompt}
                                        className="whitespace-nowrap"
                                    >
                                        {isGeneratingAiPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-indigo-400 mt-1 ml-1">
                                    {!formContent.trim() 
                                        ? "AI 将为您生成专业的提示词模板。" 
                                        : "AI 将根据您的建议优化现有内容。"}
                                </p>
                            </div>
                        )}

                        <textarea 
                            value={formContent}
                            onChange={(e) => setFormContent(e.target.value)}
                            placeholder="输入您的 Prompt 模板..."
                            rows={8}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-1">提示：使用 [ ] 来标记需要填写的变量，例如 [主角名]。</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>取消</Button>
                        <Button onClick={handleSave} disabled={!formTitle.trim() || !formContent.trim()}>保存</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
