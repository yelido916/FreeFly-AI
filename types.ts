
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

export type PromptCategory = string;

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  createdAt: number;
}

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  dailyStats: Record<string, { input: number; output: number }>; // Key is YYYY-MM-DD
}

export type AIModel = 'gemini-3-pro-preview';

export interface GenerationConfig {
  creativity: number; // temperature
}