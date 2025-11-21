
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Edit3, Tag, FileText, Search } from 'lucide-react';
import { PromptTemplate, PromptCategory } from '../types';
import { getPrompts, savePrompt, deletePrompt, generateId } from '../services/storageService';
import { Button, Card, Modal } from '../components/UI';

const CATEGORIES: PromptCategory[] = ['脑洞', '大纲', '卷纲', '细纲', '正文', '简介', '人物', '书名'];

export const PromptLibrary: React.FC = () => {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('脑洞');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
    
    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formCategory, setFormCategory] = useState<PromptCategory>('脑洞');

    useEffect(() => {
        loadPrompts();
    }, []);

    const loadPrompts = () => {
        setPrompts(getPrompts());
    };

    const handleOpenCreate = () => {
        setEditingPrompt(null);
        setFormTitle('');
        setFormContent('');
        setFormCategory(selectedCategory);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (prompt: PromptTemplate) => {
        setEditingPrompt(prompt);
        setFormTitle(prompt.title);
        setFormContent(prompt.content);
        setFormCategory(prompt.category);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!formTitle.trim() || !formContent.trim()) return;

        const promptToSave: PromptTemplate = {
            id: editingPrompt ? editingPrompt.id : generateId(),
            title: formTitle,
            content: formContent,
            category: formCategory,
            createdAt: editingPrompt ? editingPrompt.createdAt : Date.now()
        };

        savePrompt(promptToSave);
        loadPrompts();
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (confirm('确定要删除这个提示词吗？')) {
            deletePrompt(id);
            loadPrompts();
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        // Could add a toast here
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
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${
                                selectedCategory === cat 
                                ? 'bg-indigo-50 text-indigo-700' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {cat}
                            <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full text-slate-400">
                                {prompts.filter(p => p.category === cat).length}
                            </span>
                        </button>
                    ))}
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
                    {filteredPrompts.length === 0 ? (
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
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleOpenEdit(prompt)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                title="编辑"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(prompt.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 mb-4 flex-1 font-mono whitespace-pre-wrap line-clamp-4">
                                        {prompt.content}
                                    </div>
                                    <div className="flex justify-end pt-2 border-t border-slate-100">
                                        <button 
                                            onClick={() => handleCopy(prompt.content)}
                                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3" /> 复制内容
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
                                onChange={(e) => setFormCategory(e.target.value as PromptCategory)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">提示词内容</label>
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
