import React, { useState, useEffect, useRef } from 'react';
import { Plus, BookOpen, Trash2, Search, AlignLeft, Image as ImageIcon, Palette, Loader2, Settings, Download, Upload, HardDrive, Cloud, Wifi, WifiOff, Edit } from 'lucide-react';
import { Novel } from '../types';
import { fetchNovels, saveNovel, generateId, getRandomGradient, deleteNovel, getDefaultCategories, createBackup, restoreBackup, getServerConfig, saveServerConfig } from '../services/storageService';
import { Button, Card, Modal } from '../components/UI';
import { generateIdeas, generateBookCover } from '../services/geminiService';

interface NovelLibraryProps {
  onSelectNovel: (novelId: string) => void;
}

const COVER_STYLES = [
    { id: 'Cinematic', name: '电影质感' },
    { id: 'Anime', name: '日系二次元' },
    { id: 'Fantasy Art', name: '史诗奇幻' },
    { id: 'Chinese Ink', name: '中国水墨' },
    { id: 'Cyberpunk', name: '赛博朋克' },
    { id: 'Minimalist', name: '极简设计' },
    { id: 'Oil Painting', name: '古典油画' },
    { id: 'Horror', name: '暗黑恐怖' },
    { id: 'Watercolor', name: '清新水彩' },
];

export const NovelLibrary: React.FC<NovelLibraryProps> = ({ onSelectNovel }) => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenre, setNewGenre] = useState('奇幻');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);

  // Edit Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGenre, setEditGenre] = useState('');

  // Cover Generation State
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [selectedNovelForCover, setSelectedNovelForCover] = useState<Novel | null>(null);
  const [coverStyle, setCoverStyle] = useState('Fantasy Art');
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [generatedCoverBase64, setGeneratedCoverBase64] = useState<string | null>(null);

  // Settings / Backup State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Server Config State
  const [serverConfig, setServerConfig] = useState(getServerConfig());
  const [serverConnectionStatus, setServerConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');

  useEffect(() => {
    loadLibrary();
  }, [serverConfig.useServer, serverConfig.serverUrl]); // Reload when config changes

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
        const data = await fetchNovels();
        setNovels(data.sort((a, b) => b.updatedAt - a.updatedAt));
        if (serverConfig.useServer) setServerConnectionStatus('connected');
    } catch (e) {
        console.error(e);
        if (serverConfig.useServer) setServerConnectionStatus('failed');
    } finally {
        setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    const newNovel: Novel = {
      id: generateId(),
      title: newTitle,
      description: newDesc,
      genre: newGenre,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chapters: [],
      coverGradient: getRandomGradient(),
      knowledgeCategories: getDefaultCategories(),
      knowledgeEntries: []
    };

    await saveNovel(newNovel);
    setNovels((prev) => [newNovel, ...prev]);
    setIsCreateModalOpen(false);
    resetForm();
    onSelectNovel(newNovel.id);
  };

  const handleOpenEdit = (e: React.MouseEvent, novel: Novel) => {
      e.stopPropagation();
      setEditingNovel(novel);
      setEditTitle(novel.title);
      setEditDesc(novel.description);
      setEditGenre(novel.genre);
      setIsEditModalOpen(true);
  };

  const handleEditSave = async () => {
      if (!editingNovel || !editTitle.trim()) return;
      
      const updatedNovel = {
          ...editingNovel,
          title: editTitle,
          description: editDesc,
          genre: editGenre,
          updatedAt: Date.now()
      };
      
      await saveNovel(updatedNovel);
      setNovels(prev => prev.map(n => n.id === updatedNovel.id ? updatedNovel : n));
      setIsEditModalOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这本小说吗？删除后无法恢复。')) {
      await deleteNovel(id);
      loadLibrary();
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewGenre('奇幻');
  };

  const handleIdeaAssist = async () => {
    if (!newDesc && !newGenre) return;
    setIsGeneratingIdeas(true);
    try {
       const ideas = await generateIdeas(`${newGenre}小说，关于：${newDesc || '史诗般的故事'}`);
       if (ideas) {
          setNewDesc(prev => prev + (prev ? '\n\n' : '') + "灵感构思:\n" + ideas);
       }
    } finally {
       setIsGeneratingIdeas(false);
    }
  };

  // --- Cover Generation Logic ---
  
  const openCoverModal = (e: React.MouseEvent, novel: Novel) => {
      e.stopPropagation();
      setSelectedNovelForCover(novel);
      setGeneratedCoverBase64(null); // Reset prev generation
      setIsCoverModalOpen(true);
  };

  const handleGenerateCover = async () => {
      if (!selectedNovelForCover) return;
      setIsGeneratingCover(true);
      try {
          const base64 = await generateBookCover(
              selectedNovelForCover.title,
              selectedNovelForCover.description || "A mysterious story.",
              coverStyle,
              selectedNovelForCover.genre
          );
          if (base64) {
              setGeneratedCoverBase64(base64);
          }
      } catch (e) {
          alert("封面生成失败，请稍后再试或检查 API 配额。");
      } finally {
          setIsGeneratingCover(false);
      }
  };

  const handleSaveCover = async () => {
      if (!selectedNovelForCover || !generatedCoverBase64) return;
      
      const updatedNovel = { ...selectedNovelForCover, coverImage: generatedCoverBase64, updatedAt: Date.now() };
      await saveNovel(updatedNovel);
      
      // Update local list
      setNovels(prev => prev.map(n => n.id === updatedNovel.id ? updatedNovel : n));
      
      setIsCoverModalOpen(false);
  };

  // --- Backup / Restore Logic ---

  const handleExportData = async () => {
      const backup = await createBackup();
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inkflow_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          const content = e.target?.result as string;
          if (content) {
              const result = await restoreBackup(content);
              alert(result.message);
              if (result.success) {
                  loadLibrary(); // Reload UI
                  setIsSettingsModalOpen(false);
              }
          }
      };
      reader.readAsText(file);
      // Reset input
      event.target.value = '';
  };

  // --- Server Settings Logic ---
  const handleServerConfigSave = () => {
      saveServerConfig(serverConfig);
      loadLibrary();
  };

  // Helper to count words
  const getWordCount = (str: string) => {
      return str.replace(/\s/g, '').length;
  };

  const getTotalWords = (novel: Novel) => {
      return novel.chapters.reduce((acc, chapter) => acc + getWordCount(chapter.content || ''), 0);
  };

  const filteredNovels = novels.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-full bg-slate-50 pb-20">
      {/* Sub Header for Actions */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  所有作品
                  {serverConfig.useServer && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          serverConnectionStatus === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                          serverConnectionStatus === 'failed' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                          {serverConnectionStatus === 'connected' ? '已连接云端' : serverConnectionStatus === 'failed' ? '连接失败' : '连接中...'}
                      </span>
                  )}
              </h2>
              <p className="text-slate-500 text-sm mt-1">管理您的创意宇宙</p>
          </div>
          <div className="flex items-center gap-4">
                <div className="relative hidden sm:block">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="搜索小说..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 rounded-full border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-64 shadow-sm"
                    />
                </div>
                <Button variant="secondary" onClick={() => setIsSettingsModalOpen(true)} icon={<Settings className="w-4 h-4"/>}>
                    数据管理
                </Button>
                <Button onClick={() => setIsCreateModalOpen(true)} icon={<Plus className="w-4 h-4"/>}>
                    新建小说
                </Button>
            </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        ) : novels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
             <div className="w-20 h-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10" />
             </div>
             <h3 className="text-xl font-medium text-slate-900 mb-2">暂无小说</h3>
             <p className="text-slate-500 mb-8">开启您的创作之旅，写下第一部杰作。</p>
             <Button onClick={() => setIsCreateModalOpen(true)} size="lg" icon={<Plus className="w-5 h-5"/>}>新建小说</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNovels.map((novel) => (
              <Card key={novel.id} onClick={() => onSelectNovel(novel.id)} className="group h-full flex flex-col hover:-translate-y-1 transition-transform duration-300 relative">
                <div className={`h-48 w-full relative overflow-hidden flex items-end ${!novel.coverImage ? `bg-gradient-to-r ${novel.coverGradient}` : 'bg-slate-100'}`}>
                   {/* Cover Image */}
                   {novel.coverImage && (
                       <img 
                            src={`data:image/png;base64,${novel.coverImage}`} 
                            alt={novel.title} 
                            className="absolute inset-0 w-full h-full object-cover"
                       />
                   )}
                   
                   {/* Gradient Overlay for text readability */}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                   {/* Actions (Hover) */}
                   <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button 
                            onClick={(e) => handleOpenEdit(e, novel)}
                            className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-indigo-500 hover:text-white transition-colors"
                            title="编辑信息"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => openCoverModal(e, novel)}
                            className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-indigo-500 hover:text-white transition-colors"
                            title="设置封面"
                        >
                            <ImageIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => handleDelete(e, novel.id)}
                            className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500 hover:text-white transition-colors"
                            title="删除"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                   </div>
                   
                   <div className="p-6 relative z-0 w-full">
                        <h3 className="text-white font-bold text-xl drop-shadow-md line-clamp-2 leading-snug">{novel.title}</h3>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md uppercase tracking-wider">{novel.genre}</span>
                        <span className="text-xs text-slate-400">{new Date(novel.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-1">{novel.description || '暂无简介。'}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                            <span>{novel.chapters.length} 章</span>
                            <span className="flex items-center text-slate-400 font-normal">
                                <AlignLeft className="w-3 h-3 mr-1" />
                                {(getTotalWords(novel) / 10000).toFixed(1) === '0.0' 
                                    ? `${getTotalWords(novel)} 字` 
                                    : `${(getTotalWords(novel) / 10000).toFixed(1)}万 字`}
                            </span>
                        </div>
                        <span className="text-indigo-600 text-sm font-medium group-hover:translate-x-1 transition-transform flex items-center">
                            打开 <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </span>
                    </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="新建小说">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例如：永恒的编年史..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    autoFocus
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">类型</label>
                    <select 
                        value={newGenre}
                        onChange={(e) => setNewGenre(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="奇幻">奇幻</option>
                        <option value="科幻">科幻</option>
                        <option value="言情">言情</option>
                        <option value="悬疑">悬疑</option>
                        <option value="武侠">武侠</option>
                        <option value="恐怖">恐怖</option>
                        <option value="文学">文学</option>
                        <option value="同人">同人</option>
                        <option value="轻小说">轻小说</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">简介 / 故事梗概</label>
                <textarea 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="简要描述故事的主要内容..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                />
                <div className="flex justify-end mt-1">
                    <button 
                        onClick={handleIdeaAssist}
                        disabled={isGeneratingIdeas}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
                    >
                       {isGeneratingIdeas ? '正在思考...' : '✨ AI: 帮我构思'}
                    </button>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>取消</Button>
                <Button onClick={handleCreate} disabled={!newTitle.trim()}>创建</Button>
            </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="编辑作品信息">
          <div className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                  <input 
                      type="text" 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
              </div>
              <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">类型</label>
                    <select 
                        value={editGenre}
                        onChange={(e) => setEditGenre(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="奇幻">奇幻</option>
                        <option value="科幻">科幻</option>
                        <option value="言情">言情</option>
                        <option value="悬疑">悬疑</option>
                        <option value="武侠">武侠</option>
                        <option value="恐怖">恐怖</option>
                        <option value="文学">文学</option>
                        <option value="同人">同人</option>
                        <option value="轻小说">轻小说</option>
                    </select>
                </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">简介</label>
                  <textarea 
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                  <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>取消</Button>
                  <Button onClick={handleEditSave} disabled={!editTitle.trim()}>保存修改</Button>
              </div>
          </div>
      </Modal>

      {/* Cover Generation Modal */}
      <Modal isOpen={isCoverModalOpen} onClose={() => setIsCoverModalOpen(false)} title="设计书籍封面">
          <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6">
                  {/* Left: Controls */}
                  <div className="flex-1 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">绘画风格</label>
                          <div className="grid grid-cols-2 gap-2">
                              {COVER_STYLES.map(style => (
                                  <button
                                      key={style.id}
                                      onClick={() => setCoverStyle(style.id)}
                                      className={`px-3 py-2 text-sm rounded-lg border text-left transition-all ${
                                          coverStyle === style.id 
                                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500' 
                                          : 'border-slate-200 hover:border-indigo-200 text-slate-600'
                                      }`}
                                  >
                                      {style.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p>提示：AI 将根据您小说的标题、简介以及选择的风格进行创作。建议完善小说简介以获得更准确的结果。</p>
                      </div>
                      <Button 
                        onClick={handleGenerateCover} 
                        isLoading={isGeneratingCover} 
                        className="w-full"
                        icon={<Palette className="w-4 h-4" />}
                      >
                          {isGeneratingCover ? '正在绘制封面...' : '开始生成'}
                      </Button>
                  </div>

                  {/* Right: Preview */}
                  <div className="flex-1 flex flex-col items-center">
                      <label className="block text-sm font-bold text-slate-700 mb-2 self-start">预览</label>
                      <div className="w-full aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                          {isGeneratingCover ? (
                              <div className="flex flex-col items-center text-indigo-500">
                                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                  <span className="text-sm font-medium">AI 正在挥毫泼墨...</span>
                              </div>
                          ) : generatedCoverBase64 ? (
                              <img 
                                src={`data:image/png;base64,${generatedCoverBase64}`} 
                                className="w-full h-full object-cover shadow-inner" 
                                alt="Generated Cover" 
                              />
                          ) : selectedNovelForCover?.coverImage ? (
                              <img 
                                src={`data:image/png;base64,${selectedNovelForCover.coverImage}`} 
                                className="w-full h-full object-cover shadow-inner" 
                                alt="Current Cover" 
                              />
                          ) : (
                              <div className="text-slate-400 flex flex-col items-center">
                                  <ImageIcon className="w-12 h-12 mb-2 opacity-30" />
                                  <span className="text-sm">暂无封面</span>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button variant="ghost" onClick={() => setIsCoverModalOpen(false)}>取消</Button>
                  <Button onClick={handleSaveCover} disabled={!generatedCoverBase64}>保存封面</Button>
              </div>
          </div>
      </Modal>

      {/* Settings / Backup Modal */}
      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="数据管理">
          <div className="space-y-6">
              
              {/* Server Sync Config */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${serverConfig.useServer ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                          <Cloud className="w-5 h-5" />
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-800">私有云服务器</h4>
                          <p className="text-xs text-slate-500">连接自建的 Node.js 后端进行数据同步</p>
                      </div>
                  </div>
                  
                  <div className="space-y-3">
                      <label className="flex items-center cursor-pointer">
                          <div className="relative">
                              <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={serverConfig.useServer}
                                onChange={() => setServerConfig(prev => ({...prev, useServer: !prev.useServer}))}
                              />
                              <div className={`block w-10 h-6 rounded-full transition-colors ${serverConfig.useServer ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${serverConfig.useServer ? 'translate-x-4' : ''}`}></div>
                          </div>
                          <span className="ml-3 text-sm font-medium text-slate-700">启用服务器同步</span>
                      </label>

                      {serverConfig.useServer && (
                          <div className="pt-2 animate-fade-in">
                              <label className="block text-xs font-medium text-slate-500 mb-1">服务器地址</label>
                              <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={serverConfig.serverUrl}
                                    onChange={(e) => setServerConfig(prev => ({...prev, serverUrl: e.target.value}))}
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="http://localhost:3001"
                                  />
                                  <Button size="sm" onClick={handleServerConfigSave}>保存并重连</Button>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                  请确保本地服务器已启动 (node server/server.js)
                              </p>
                          </div>
                      )}
                  </div>
              </div>

              <div className="border-t border-slate-200 my-4"></div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                          <HardDrive className="w-5 h-5" />
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-800">本地备份</h4>
                          <p className="text-xs text-slate-500">将所有数据导出为 JSON 文件</p>
                      </div>
                  </div>
                  <div className="mt-3">
                      <Button onClick={handleExportData} icon={<Download className="w-4 h-4"/>} variant="primary" className="w-full">
                          导出备份文件
                      </Button>
                  </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                          <Upload className="w-5 h-5" />
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-800">数据恢复</h4>
                          <p className="text-xs text-slate-500">从备份文件恢复数据 (合并更新)</p>
                      </div>
                  </div>
                  <div className="mt-3">
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          accept=".json" 
                          className="hidden" 
                      />
                      <Button onClick={handleImportClick} variant="secondary" className="w-full" icon={<Upload className="w-4 h-4"/>}>
                          选择备份文件导入
                      </Button>
                  </div>
              </div>
              
              <div className="text-xs text-slate-400 text-center pt-2">
                  提示：默认数据存储在 LocalStorage。切换服务器模式后，数据将直接读写服务器。<br/>
                  请在切换前做好备份。
              </div>
          </div>
      </Modal>
    </div>
  );
};