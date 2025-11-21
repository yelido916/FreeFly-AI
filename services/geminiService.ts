import { GoogleGenAI } from "@google/genai";
import { Novel, Chapter, KnowledgeEntry } from '../types';

// Initialize the client
// Note: In a real production app, you might proxy this through a backend to hide the key,
// but for this client-side demo, we use the env var directly as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

const SYSTEM_INSTRUCTION = `
你是一位专家级的小说家和创意写作助手。
请用高质量、引人入胜且描写细腻的简体中文进行写作。
你的目标是帮助用户撰写小说，生成章节、大纲或续写场景。
保持语气、角色声音和情节走向的一致性。
`;

/**
 * Generates a continuation or a new chapter based on context.
 */
export const generateStorySegment = async (
  novel: Novel,
  currentChapterIndex: number,
  prompt: string,
  referenceContent: string[], // Selected knowledge base content
  targetWordCount: number | undefined, // New: Target word count
  onStream: (text: string) => void
): Promise<string> => {
  
  // Build context from previous chapters (summary or raw text if short)
  // For efficiency, we take the last 2 chapters' content or summaries if available
  const previousChapters = novel.chapters.slice(Math.max(0, currentChapterIndex - 2), currentChapterIndex);
  
  let contextString = `小说标题: ${novel.title}\n类型: ${novel.genre}\n简介/梗概: ${novel.description}\n\n`;
  
  if (referenceContent.length > 0) {
      contextString += `【参考资料 / 知识库】:\n${referenceContent.join('\n\n')}\n\n`;
  }

  if (previousChapters.length > 0) {
    contextString += `前情回顾:\n`;
    previousChapters.forEach((chap, idx) => {
       contextString += `第 ${idx + 1} 章: ${chap.summary || chap.content.substring(0, 500) + '...'}\n`;
    });
  }

  let lengthInstruction = "";
  if (targetWordCount && targetWordCount > 0) {
      lengthInstruction = `\n\n【重要要求】：请生成大约 ${targetWordCount} 个中文字符的内容。尽量贴近这个字数，不要过短或过长。`;
  }

  const finalPrompt = `
${contextString}

当前任务:
${prompt}
${lengthInstruction}

请用中文撰写。
`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8, // Slightly creative
      },
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onStream(text);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Generates a summary for a chapter to keep context window manageable.
 */
export const generateSummary = async (chapterContent: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `请用3-4句话总结以下章节内容（使用中文），作为未来写作的上下文：\n\n${chapterContent}`,
        });
        return response.text || "";
    } catch (e) {
        console.error("Summary generation failed", e);
        return "";
    }
}

/**
 * Generates a title for a novel based on a description.
 */
export const generateIdeas = async (topic: string): Promise<string> => {
     try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `基于主题“${topic}”，提供3个富有创意的小说标题和一句话的简短钩子（Hook）。请以简单的列表形式用中文返回。`,
        });
        return response.text || "";
    } catch (e) {
        return "";
    }
}

/**
 * Analyzes text for consistency against knowledge base entries (Characters, World, Background).
 */
export const analyzeStoryConsistency = async (
    textToAnalyze: string,
    entries: KnowledgeEntry[],
    categoryMap: Record<string, string>
): Promise<string> => {
    try {
        const context = entries.map(e =>
            `【${categoryMap[e.categoryId] || '设定'}】 ${e.title}:\n${e.content}`
        ).join('\n\n');

        const prompt = `
        你是一位专业的小说连贯性编辑。请分析以下“生成文本”，将其与提供的“知识库设定”进行对比。

        任务目标：
        1. **人物一致性**: 检查角色的言行、性格、能力是否与设定矛盾 (OOC)。
        2. **世界观与逻辑**: 检查环境描写、魔法/科技规则、历史背景、物品使用是否与世界观设定冲突。

        知识库设定：
        ${context}

        生成文本：
        ${textToAnalyze}

        输出要求：
        1. 若发现冲突，请分点列出，格式为：“❌ [冲突类型] 描述... (依据: 设定标题)”。
        2. 若发现潜在风险（如语气略有偏移），标记为“⚠️”。
        3. 若未发现明显问题，请回答“✅ 未检测到明显的设定冲突。”
        4. 请保持客观、简练。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                temperature: 0.2, // Low temperature for analytical tasks
            }
        });

        return response.text || "无法生成分析报告。";
    } catch (e) {
        console.error("Consistency check failed", e);
        return "分析失败，请检查网络连接。";
    }
};

export interface KnowledgeUpdateSuggestion {
    name: string;
    description: string;
    type: 'NEW' | 'UPDATE';
    categoryType: 'CHARACTER' | 'WORLD' | 'ITEM' | 'OTHER';
    reason: string;
    originalId?: string; // Helper to link back if update
}

/**
 * Analyzes chapter content to suggest updates to ALL knowledge profiles (Characters, World, Items).
 */
export const analyzeStoryEvolution = async (
    chapterContent: string,
    existingEntries: KnowledgeEntry[],
    categoryMap: Record<string, string>
): Promise<KnowledgeUpdateSuggestion[]> => {
    try {
        // Summarize existing entries to avoid context overflow
        const contextString = existingEntries.map(e => 
            `ID: ${e.id} | Type: ${categoryMap[e.categoryId]} | Name: ${e.title}\nSummary: ${e.content.substring(0, 100)}...`
        ).join('\n---\n');

        const prompt = `
        作为小说设定整理助手，请阅读以下【最新章节内容】以及现有的【知识库摘要】。
        你的任务是捕捉故事中新出现的或发生变化的所有重要元素，并输出 JSON 格式的更新建议。

        范围包括：
        1. **人物 (CHARACTER)**: 新角色登场、老角色技能/性格/状态更新。
        2. **世界观 (WORLD)**: 新地点、新组织、新历史背景、新法则。
        3. **物品/金手指 (ITEM)**: 获得新道具、武器升级、重要物品丢失。
        4. **其他 (OTHER)**: 不属于上述但重要的设定。

        【现有知识库摘要】:
        ${contextString}

        【最新章节内容】:
        ${chapterContent}

        任务要求：
        1. **NEW**: 只有当该元素在【现有知识库】中完全不存在，且在章节中有具体描述时，才标记为 NEW。
        2. **UPDATE**: 如果元素已存在（请仔细比对名称），且发生了重要变化（如：重伤、升级、秘密揭露），标记为 UPDATE。
        3. 忽略琐碎信息（如角色只是吃了个饭，或仅仅路过某地）。

        请**严格**只返回一个 JSON 数组，格式如下：
        [
            {
                "name": "条目名称",
                "description": "完整的设定描述（Markdown格式，包含外貌/功能/地理位置/历史等）",
                "type": "NEW" (或 "UPDATE"),
                "categoryType": "CHARACTER" (或 "WORLD", "ITEM", "OTHER"),
                "reason": "简述理由（例如：第X章获得了神剑...）",
                "originalId": "如果是UPDATE，请准确填入上方提供的ID，否则留空"
            }
        ]
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.3,
            }
        });

        const jsonText = response.text;
        if (!jsonText) return [];

        try {
            const result = JSON.parse(jsonText) as KnowledgeUpdateSuggestion[];
            return result;
        } catch (parseError) {
            console.error("Failed to parse knowledge update JSON", parseError);
            return [];
        }

    } catch (e) {
        console.error("Story evolution analysis failed", e);
        return [];
    }
};


/**
 * Generates a book cover image based on novel details and style.
 */
export const generateBookCover = async (
    title: string,
    description: string,
    style: string,
    genre: string
): Promise<string | null> => {
    try {
        // Construct a prompt optimized for image generation
        // We translate context to English implicitly by structure or let Gemini handle it, 
        // but explicit English descriptors usually help image models.
        const prompt = `
        A high quality book cover for a novel.
        Title: "${title}"
        Genre: ${genre}
        Art Style: ${style}
        
        Description of the story/scene:
        ${description.substring(0, 300)}
        
        Requirements:
        - No text on the image (or minimal text).
        - High resolution, visually striking.
        - Aspect ratio 1:1.
        `;

        const response = await ai.models.generateContent({
            model: IMAGE_MODEL_NAME,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                }
            }
        });

        // Extract image
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        throw e;
    }
}