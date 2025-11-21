
import { Novel, Chapter, KnowledgeCategory, PromptTemplate, PromptCategory } from '../types';

const STORAGE_KEY = 'inkflow_novels_v1';
const PROMPTS_STORAGE_KEY = 'inkflow_prompts_v1';

// --- Novels ---

export const getNovels = (): Novel[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load novels', e);
    return [];
  }
};

export const saveNovel = (novel: Novel): void => {
  const novels = getNovels();
  const index = novels.findIndex((n) => n.id === novel.id);
  if (index >= 0) {
    novels[index] = { ...novel, updatedAt: Date.now() };
  } else {
    novels.push({ ...novel, updatedAt: Date.now() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(novels));
};

export const deleteNovel = (id: string): void => {
  const novels = getNovels().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(novels));
};

export const getNovelById = (id: string): Novel | undefined => {
  return getNovels().find((n) => n.id === id);
};

// --- Prompts ---

const DEFAULT_PROMPTS: Omit<PromptTemplate, 'id' | 'createdAt'>[] = [
    {
        title: "创意风暴",
        category: "脑洞",
        content: "请基于以下关键词：[关键词1]、[关键词2]，提供3个截然不同的小说核心创意（High Concept）。每个创意包含：核心冲突、独特卖点、一句话梗概。"
    },
    {
        title: "三幕式大纲",
        category: "大纲",
        content: "请使用经典的三幕式结构（铺垫、对抗、结局）为一部关于[主题]的小说撰写大纲。重点描述情节点（Plot Points）和角色的弧光变化。"
    },
    {
        title: "章节细纲生成",
        category: "细纲",
        content: "当前章节的目标是[目标]。请为这一章列出5-7个具体的场景节拍（Beats），包括对话焦点、动作描写和情感转折。"
    },
    {
        title: "沉浸式描写",
        category: "正文",
        content: "请扩写以下场景：[场景简述]。要求运用“展示而非讲述”（Show, Don't Tell）的技巧，调动五感（视觉、听觉、嗅觉等），侧重于氛围渲染和人物的潜台词。"
    },
    {
        title: "反派设计",
        category: "人物",
        content: "请设计一个名为[名字]的反派角色。不要让他仅仅是“邪恶”的，请给出他扭曲的价值观来源、一个令人同情的弱点，以及他与主角的镜像关系。"
    },
    {
        title: "吸引人的书名",
        category: "书名",
        content: "这本小说关于[核心内容]。请生成10个书名，分为三种风格：1. 网文热血风；2. 出版文艺风；3. 悬疑极其抓人眼球风。"
    }
];

export const getPrompts = (): PromptTemplate[] => {
    try {
        const data = localStorage.getItem(PROMPTS_STORAGE_KEY);
        if (!data) {
            // Initialize defaults
            const defaults = DEFAULT_PROMPTS.map(p => ({
                ...p,
                id: generateId(),
                createdAt: Date.now()
            }));
            localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(defaults));
            return defaults as PromptTemplate[];
        }
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

export const savePrompt = (prompt: PromptTemplate): void => {
    const prompts = getPrompts();
    const index = prompts.findIndex(p => p.id === prompt.id);
    if (index >= 0) {
        prompts[index] = { ...prompt }; // Update
    } else {
        prompts.push({ ...prompt }); // Create
    }
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
};

export const deletePrompt = (id: string): void => {
    const prompts = getPrompts().filter(p => p.id !== id);
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
};

// --- Backup & Restore ---

export const createBackup = (): string => {
    const backup = {
        version: 1,
        timestamp: Date.now(),
        novels: getNovels(),
        prompts: getPrompts()
    };
    return JSON.stringify(backup, null, 2);
};

export const restoreBackup = (jsonString: string): { success: boolean, message: string } => {
    try {
        const data = JSON.parse(jsonString);
        
        if (!data.novels && !data.prompts) {
            return { success: false, message: '无效的备份文件格式：未找到小说或提示词数据。' };
        }

        // Merge Novels
        const currentNovels = getNovels();
        const currentPrompts = getPrompts();

        let newNovelsCount = 0;
        let updatedNovelsCount = 0;
        let newPromptsCount = 0;

        if (data.novels && Array.isArray(data.novels)) {
            data.novels.forEach((n: Novel) => {
                const idx = currentNovels.findIndex(cn => cn.id === n.id);
                if (idx === -1) {
                    currentNovels.push(n);
                    newNovelsCount++;
                } else {
                    // Overwrite existing with backup version
                    currentNovels[idx] = n;
                    updatedNovelsCount++;
                }
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentNovels));
        }

        // Merge Prompts
        if (data.prompts && Array.isArray(data.prompts)) {
             data.prompts.forEach((p: PromptTemplate) => {
                const idx = currentPrompts.findIndex(cp => cp.id === p.id);
                if (idx === -1) {
                    currentPrompts.push(p);
                    newPromptsCount++;
                } else {
                    currentPrompts[idx] = p;
                }
             });
             localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(currentPrompts));
        }

        return { 
            success: true, 
            message: `恢复成功！\n新增小说: ${newNovelsCount} 本\n更新小说: ${updatedNovelsCount} 本\n新增提示词: ${newPromptsCount} 条` 
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
