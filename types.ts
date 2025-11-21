
export interface Chapter {
  id: string;
  title: string;
  content: string;
  summary?: string; // AI generated summary for context in next chapters
}

export interface KnowledgeCategory {
  id: string;
  name: string;
}

export interface KnowledgeEntry {
  id: string;
  categoryId: string;
  title: string;
  content: string;
}

export interface Novel {
  id: string;
  title: string;
  description: string;
  genre: string;
  createdAt: number;
  updatedAt: number;
  chapters: Chapter[];
  coverGradient: string; // CSS class for visual distinction
  coverImage?: string; // Base64 encoded image string
  knowledgeCategories: KnowledgeCategory[];
  knowledgeEntries: KnowledgeEntry[];
}

export type PromptCategory = '脑洞' | '大纲' | '卷纲' | '细纲' | '正文' | '简介' | '人物' | '书名';

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  createdAt: number;
}

export type AIModel = 'gemini-2.5-flash';

export interface GenerationConfig {
  creativity: number; // temperature
}
