import React, { useEffect, useState } from 'react';
import { Activity, BarChart, Book, Cpu, FileQuestion, Info, Server, ShieldCheck, Zap } from 'lucide-react';
import { UsageStats } from '../types';
import { fetchUsageStats, getServerConfig } from '../services/storageService';

export const HelpCenter: React.FC = () => {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'manual' | 'changelog'>('dashboard');

    useEffect(() => {
        const loadStats = async () => {
            const data = await fetchUsageStats();
            setStats(data);
        };
        loadStats();
    }, []);

    const getTodayStats = () => {
        if (!stats) return { input: 0, output: 0 };
        const today = new Date().toISOString().split('T')[0];
        return stats.dailyStats[today] || { input: 0, output: 0 };
    };

    const today = getTodayStats();

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">帮助与统计中心</h1>
                <p className="text-slate-500 mt-2">了解应用运行状态、查看模型用量及使用指南。</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Nav */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-1">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Activity className="w-4 h-4 mr-3" /> 概览统计
                    </button>
                    <button 
                        onClick={() => setActiveTab('manual')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'manual' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Book className="w-4 h-4 mr-3" /> 使用说明
                    </button>
                    <button 
                        onClick={() => setActiveTab('changelog')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'changelog' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <FileQuestion className="w-4 h-4 mr-3" /> 关于与更新
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* System Info Card */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <Cpu className="w-5 h-5 mr-2 text-indigo-600" /> 系统信息
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">主生成模型</p>
                                        <p className="font-mono font-bold text-slate-700">gemini-3-pro-preview</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">绘图模型</p>
                                        <p className="font-mono font-bold text-slate-700 text-blue-600">gemini-2.5-flash-image</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">应用版本</p>
                                        <p className="font-mono font-bold text-slate-700">v1.3.3</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">数据存储模式</p>
                                        <p className="font-mono font-bold text-slate-700 flex items-center">
                                            {getServerConfig().useServer ? <Server className="w-3 h-3 mr-1 text-emerald-500"/> : <Info className="w-3 h-3 mr-1 text-blue-500"/>}
                                            {getServerConfig().useServer ? '私有云服务器' : '浏览器本地存储'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Token Stats Card */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <Zap className="w-5 h-5 mr-2 text-amber-500" /> Token 消耗统计
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Today */}
                                    <div className="border rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-white">
                                        <h4 className="text-sm font-bold text-indigo-900 mb-3">今日用量 (Daily)</h4>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-slate-500 text-xs">输入 (Input)</span>
                                            <span className="text-xl font-mono font-bold text-slate-800">{today.input.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-indigo-100 h-1.5 rounded-full mb-3">
                                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-500 text-xs">输出 (Output)</span>
                                            <span className="text-xl font-mono font-bold text-slate-800">{today.output.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Total */}
                                    <div className="border rounded-xl p-5 bg-gradient-to-br from-emerald-50 to-white">
                                        <h4 className="text-sm font-bold text-emerald-900 mb-3">历史总计 (Total)</h4>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-slate-500 text-xs">总输入</span>
                                            <span className="text-xl font-mono font-bold text-slate-800">{stats?.totalInputTokens.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-emerald-100 h-1.5 rounded-full mb-3">
                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-500 text-xs">总输出</span>
                                            <span className="text-xl font-mono font-bold text-slate-800">{stats?.totalOutputTokens.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-4">
                                    * 统计数据仅供参考。Input Tokens 包括提示词、上下文和知识库引用；Output Tokens 为 AI 生成的内容。
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'manual' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-fade-in prose prose-slate max-w-none">
                            <h2>FreeFly AI 使用手册</h2>
                            
                            <h3>1. 知识库与一致性</h3>
                            <p>
                                在 <strong>知识库模式</strong> 下，您可以创建人物、物品、世界观等分类。填写详细的设定后：
                            </p>
                            <ul>
                                <li>
                                    <strong>引用：</strong> 在写作模式的 AI 助手面板下方，勾选相关的知识库条目。AI 将会在生成内容时严格遵循这些设定。
                                </li>
                                <li>
                                    <strong>智能引用：</strong> 开启“🤖 智能引用”开关，AI 会根据您的大纲和当前指令，自动判断需要检索哪些知识条目，从而大幅节省 Token 并提高相关性。
                                </li>
                                <li>
                                    <strong>检查：</strong> 点击“检查连贯性”按钮，AI 会分析您的草稿是否与设定（如人物性格 OOC）冲突。
                                </li>
                            </ul>

                            <h3>2. 同步设定档案</h3>
                            <p>
                                这是一个强大的功能。写完一章后，点击工具栏中的 <strong>“同步设定档案”</strong>。AI 会阅读整章内容，自动提取新出现的人物、物品或发生的状态变化（如受伤、升级），并建议您更新到知识库中。
                            </p>

                            <h3>3. 提示词库</h3>
                            <p>
                                您可以在“提示词库”中管理常用的 AI 指令（如“大纲生成”、“润色描写”）。在写作时，点击“引用提示词”即可快速调用。您还可以使用内置的 AI 助手来帮您编写或优化提示词。
                            </p>

                            <h3>4. 数据安全与服务器</h3>
                            <p>
                                默认情况下，数据存储在您的浏览器中。为了数据安全，建议定期在“我的小说 -> 数据管理”中导出备份。
                                如果您有技术能力，可以启动本地 Node.js 服务器并开启“私有云同步”，实现跨设备访问。
                            </p>
                        </div>
                    )}

                    {activeTab === 'changelog' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h2 className="text-xl font-bold text-slate-800 mb-4">FreeFly AI 简介</h2>
                                <p className="text-slate-600 mb-4">
                                    FreeFly AI 是一款专为长篇小说创作者设计的 AI 辅助工具。它不仅仅是一个聊天机器人，更是一个拥有“记忆”的创作伴侣。通过深度集成的知识库系统，它解决了 AI 写作中常见的遗忘设定、前后矛盾等问题。
                                </p>
                            </div>

                            <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 py-4">
                                <div className="relative pl-8">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-slate-800">v1.3.3 - 视觉升级</h4>
                                    <p className="text-sm text-slate-400 mb-2">2024-05-26</p>
                                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                        <li>绘图模型恢复为 <strong>gemini-2.5-flash-image</strong> 以解决 404 错误。</li>
                                    </ul>
                                </div>

                                <div className="relative pl-8">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-300 border-4 border-white"></div>
                                    <h4 className="font-bold text-slate-800">v1.3.0 - 模型升级</h4>
                                    <p className="text-sm text-slate-400 mb-2">2024-05-24</p>
                                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                        <li>主生成模型升级为 <strong>gemini-3-pro-preview</strong>，提供更强的逻辑与写作能力。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};