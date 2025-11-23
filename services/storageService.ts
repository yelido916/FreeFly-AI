
import { Novel, Chapter, KnowledgeCategory, PromptTemplate, PromptCategory, UsageStats } from '../types';

const STORAGE_KEY = 'inkflow_novels_v1';
const PROMPTS_STORAGE_KEY = 'inkflow_prompts_v1';
const PROMPT_CATEGORIES_KEY = 'inkflow_prompt_categories_v1';
const STATS_STORAGE_KEY = 'inkflow_stats_v1';

// Configuration
const SERVER_CONFIG_KEY = 'inkflow_server_config';

interface ServerConfig {
    useServer: boolean;
    serverUrl: string;
}

export const getServerConfig = (): ServerConfig => {
    try {
        const data = localStorage.getItem(SERVER_CONFIG_KEY);
        return data ? JSON.parse(data) : { useServer: false, serverUrl: 'http://localhost:3001' };
    } catch {
        return { useServer: false, serverUrl: 'http://localhost:3001' };
    }
};

export const saveServerConfig = (config: ServerConfig) => {
    localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config));
};

// Helper to decide fetch method
const isServerMode = () => getServerConfig().useServer;
const getApiUrl = () => getServerConfig().serverUrl;

// Helper to safely read local storage
const readLocal = <T>(key: string, defaultVal: T): T => {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultVal;
    } catch {
        return defaultVal;
    }
};

// --- Novels ---

export const fetchNovels = async (): Promise<Novel[]> => {
    if (isServerMode()) {
        try {
            const res = await fetch(`${getApiUrl()}/api/novels`);
            if (!res.ok) throw new Error('Failed to fetch from server');
            return await res.json();
        } catch (e) {
            // Use console.warn instead of error for fallback scenarios to avoid "Failed to fetch" spam
            console.warn("Server unreachable, falling back to local storage.");
            return readLocal<Novel[]>(STORAGE_KEY, []);
        }
    } else {
        return readLocal<Novel[]>(STORAGE_KEY, []);
    }
};

export const saveNovel = async (novel: Novel): Promise<void> => {
    const updatedNovel = { ...novel, updatedAt: Date.now() };
    
    // Always save to local as a backup/cache first or parallel
    const saveToLocal = () => {
         const novels = readLocal<Novel[]>(STORAGE_KEY, []);
         const index = novels.findIndex((n) => n.id === novel.id);
         if (index >= 0) {
             novels[index] = updatedNovel;
         } else {
             novels.push(updatedNovel);
         }
         localStorage.setItem(STORAGE_KEY, JSON.stringify(novels));
    };

    if (isServerMode()) {
        try {
            await fetch(`${getApiUrl()}/api/novels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedNovel)
            });
            // Also sync to local to keep them in sync if we fallback later
            saveToLocal();
        } catch (e) {
            console.warn("Server save failed, saved to local only.");
            saveToLocal();
            // We don't throw here to prevent UI disruption
        }
    } else {
        saveToLocal();
    }
};

export const deleteNovel = async (id: string): Promise<void> => {
     const deleteLocal = () => {
        let novels = readLocal<Novel[]>(STORAGE_KEY, []);
        novels = novels.filter((n) => n.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(novels));
    };

    if (isServerMode()) {
        try {
            await fetch(`${getApiUrl()}/api/novels/${id}`, { method: 'DELETE' });
            deleteLocal();
        } catch(e) {
            console.warn("Server delete failed, deleting locally.");
            deleteLocal();
        }
    } else {
        deleteLocal();
    }
};

export const fetchNovelById = async (id: string): Promise<Novel | undefined> => {
    let serverNovel: Novel | undefined;
    if (isServerMode()) {
        try {
            const res = await fetch(`${getApiUrl()}/api/novels/${id}`);
            if (res.ok) {
                serverNovel = await res.json();
            }
        } catch (e) {
            console.warn("Fetch ID from server failed, checking local.");
        }
    }
    
    if (serverNovel) return serverNovel;

    // Fallback
    const novels = readLocal<Novel[]>(STORAGE_KEY, []);
    return novels.find((n) => n.id === id);
};

// --- Prompts ---

const DEFAULT_CATEGORIES = ['脑洞', '大纲', '卷纲', '细纲', '正文', '简介', '人物', '书名'];

// Removed DEFAULT_PROMPTS to ensure library starts empty

export const fetchPromptCategories = async (): Promise<string[]> => {
    if (isServerMode()) {
        try {
            const res = await fetch(`${getApiUrl()}/api/prompt-categories`);
            if(res.ok) return await res.json();
        } catch {}
    }
    
    const local = readLocal<string[]>(PROMPT_CATEGORIES_KEY, []);
    if (local.length === 0) {
         localStorage.setItem(PROMPT_CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
         return DEFAULT_CATEGORIES;
    }
    return local;
};

export const addPromptCategory = async (name: string): Promise<void> => {
     const addLocal = () => {
        const cats = readLocal<string[]>(PROMPT_CATEGORIES_KEY, DEFAULT_CATEGORIES);
        if (!cats.includes(name)) {
            cats.push(name);
            localStorage.setItem(PROMPT_CATEGORIES_KEY, JSON.stringify(cats));
        }
    };

    if (isServerMode()) {
        try {
            await fetch(`${getApiUrl()}/api/prompt-categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            addLocal();
        } catch { addLocal(); }
    } else {
        addLocal();
    }
};

export const deletePromptCategory = async (name: string): Promise<void> => {
    const delLocal = () => {
        let cats = readLocal<string[]>(PROMPT_CATEGORIES_KEY, DEFAULT_CATEGORIES);
        cats = cats.filter(c => c !== name);
        localStorage.setItem(PROMPT_CATEGORIES_KEY, JSON.stringify(cats));
    };

    if (isServerMode()) {
        try {
             await fetch(`${getApiUrl()}/api/prompt-categories/${name}`, { method: 'DELETE' });
             delLocal();
        } catch { delLocal(); }
    } else {
        delLocal();
    }
};

export const fetchPrompts = async (): Promise<PromptTemplate[]> => {
    if (isServerMode()) {
        try {
            const res = await fetch(`${getApiUrl()}/api/prompts`);
            if (res.ok) return await res.json();
        } catch {}
    }

    // Return local or empty array. Do NOT seed with defaults.
    return readLocal<PromptTemplate[]>(PROMPTS_STORAGE_KEY, []);
};

export const savePrompt = async (prompt: PromptTemplate): Promise<void> => {
    const saveLocal = () => {
        const prompts = readLocal<PromptTemplate[]>(PROMPTS_STORAGE_KEY, []);
        const index = prompts.findIndex(p => p.id === prompt.id);
        if (index >= 0) {
            prompts[index] = { ...prompt };
        } else {
            prompts.push({ ...prompt });
        }
        localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
    };

    if (isServerMode()) {
        try {
            await fetch(`${getApiUrl()}/api/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prompt)
            });
            saveLocal();
        } catch { saveLocal(); }
    } else {
        saveLocal();
    }
};

export const deletePrompt = async (id: string): Promise<void> => {
    const delLocal = () => {
        let prompts = readLocal<PromptTemplate[]>(PROMPTS_STORAGE_KEY, []);
        prompts = prompts.filter(p => p.id !== id);
        localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
    };

    if (isServerMode()) {
        try {
            await fetch(`${getApiUrl()}/api/prompts/${id}`, { method: 'DELETE' });
            delLocal();
        } catch { delLocal(); }
    } else {
        delLocal();
    }
};

// --- Usage Stats ---

const getTodayString = () => new Date().toISOString().split('T')[0];

export const fetchUsageStats = async (): Promise<UsageStats> => {
    const defaultStats: UsageStats = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        dailyStats: {}
    };

    let serverStats;
    if (isServerMode()) {
        try {
            const res = await fetch(`${getApiUrl()}/api/stats`);
            if (res.ok) serverStats = await res.json();
        } catch {}
    }

    if (serverStats) return serverStats;
    
    return readLocal(STATS_STORAGE_KEY, defaultStats);
};

export const incrementUsageStats = async (inputTokens: number, outputTokens: number): Promise<void> => {
    // Get current (local or server, falling back to local)
    let stats = await fetchUsageStats();
    const today = getTodayString();

    // Update Totals
    stats.totalInputTokens += inputTokens;
    stats.totalOutputTokens += outputTokens;

    // Update Daily
    if (!stats.dailyStats[today]) {
        stats.dailyStats[today] = { input: 0, output: 0 };
    }
    stats.dailyStats[today].input += inputTokens;
    stats.dailyStats[today].output += outputTokens;

    // Save
    const saveLocal = () => localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));

    if (isServerMode()) {
        try {
            await fetch(`${getApiUrl()}/api/stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stats)
            });
            saveLocal(); // Sync backup
        } catch (e) {
            saveLocal();
        }
    } else {
        saveLocal();
    }
};

// --- Backup & Restore ---

export const createBackup = async (): Promise<string> => {
    const novels = await fetchNovels();
    const prompts = await fetchPrompts();
    const promptCategories = await fetchPromptCategories();
    const stats = await fetchUsageStats();
    
    const backup = {
        version: 1,
        timestamp: Date.now(),
        novels,
        prompts,
        promptCategories,
        stats
    };
    return JSON.stringify(backup, null, 2);
};

export const restoreBackup = async (jsonString: string): Promise<{ success: boolean, message: string }> => {
    try {
        const data = JSON.parse(jsonString);
        
        if (!data.novels && !data.prompts) {
            return { success: false, message: '无效的备份文件格式。' };
        }
        
        if (data.novels && Array.isArray(data.novels)) {
            for (const n of data.novels) {
                await saveNovel(n);
            }
        }

        if (data.prompts && Array.isArray(data.prompts)) {
             for (const p of data.prompts) {
                 await savePrompt(p);
             }
        }

        if (data.promptCategories && Array.isArray(data.promptCategories)) {
            for (const c of data.promptCategories) {
                await addPromptCategory(c);
            }
        }
        
        if (data.stats) {
             // For stats, we can't easily "merge" via save methods without logic, so we just force write to local/server
             if (isServerMode()) {
                 try {
                    await fetch(`${getApiUrl()}/api/stats`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data.stats)
                    });
                 } catch {}
             }
             localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(data.stats));
        }

        return { 
            success: true, 
            message: `恢复操作完成！(数据已写入)` 
        };

    } catch (e) {
        console.error(e);
        return { success: false, message: '解析备份文件失败，请确保文件格式正确。' };
    }
};

// --- Utils ---

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const getDefaultCategories = (): KnowledgeCategory[] => {
    const defaults = ['大纲', '卷纲', '细纲', '人物', '背景', '物品', '金手指', '世界观', '简介'];
    return defaults.map(name => ({
        id: generateId(),
        name
    }));
};

const GRADIENTS = [
  'from-blue-400 to-indigo-600',
  'from-emerald-400 to-cyan-600',
  'from-orange-400 to-pink-600',
  'from-purple-400 to-violet-600',
  'from-rose-400 to-red-600',
  'from-amber-400 to-orange-600',
  'from-teal-400 to-emerald-600',
  'from-slate-500 to-slate-800',
];

export const getRandomGradient = (): string => {
  return GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
};
