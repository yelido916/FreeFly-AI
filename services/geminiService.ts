import { GoogleGenAI, SchemaType, Type } from "@google/genai";
import { Novel, Chapter, KnowledgeEntry } from '../types';
import { incrementUsageStats } from './storageService';

// Initialize the client (Global instance for standard calls)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-pro-preview';
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
  const previousChapters = novel.chapters.slice(Math.max(0, currentChapterIndex - 2), currentChapterIndex);
  
  let contextString = `小说标题: ${novel.title}\n类型: ${novel.genre}\n简介/梗概: ${novel.description}\n\n`;
  
  let knowledgeConstraint = "";

  if (referenceContent.length > 0) {
      contextString += `【📚 核心设定与知识库 (必须遵循)】:\n${referenceContent.join('\n\n')}\n\n`;
      
      knowledgeConstraint = `
      【⚠️ 知识库使用约束 (重要)】:
      1. **严格一致性**: 你生成的每一个字都必须严格遵守上述【核心设定与知识库】中的事实。
      2. **严禁冲突**: 绝对不要创造与上述设定相矛盾的情节或描述。
      3. **深度整合**: 请积极利用上述资料中的细节来增强文章的连贯性和沉浸感。
      `;
  }

  if (previousChapters.length > 0) {
    contextString += `前情回顾:\n`;
    previousChapters.forEach((chap, idx) => {
       contextString += `第 ${idx + 1} 章: ${chap.summary || chap.content.substring(0, 500) + '...'}\n`;
    });
  }

  let lengthInstruction = "";
  if (targetWordCount && targetWordCount > 0) {
      lengthInstruction = `\n\n【字数要求】：请生成大约 ${targetWordCount} 个中文字符的内容。尽量贴近这个字数，不要过短或过长。`;
  }

  const finalPrompt = `
${contextString}

${knowledgeConstraint}

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
        temperature: 0.8,
      },
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onStream(text);
      }
      // Track Usage Metadata if available (usually in last chunk)
      if (chunk.usageMetadata) {
         incrementUsageStats(chunk.usageMetadata.promptTokenCount || 0, chunk.usageMetadata.candidatesTokenCount || 0);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Analyzes the user's prompt and story context to intelligently select relevant knowledge entries.
 */
export const recommendRelevantKnowledge = async (
    prompt: string,
    novelTitle: string,
    outline: string,
    knowledgeIndex: { id: string; title: string; category: string }[]
): Promise<string[]> => {
    try {
        const indexStr = knowledgeIndex.map(k => `- [${k.category}] ${k.title} (ID: ${k.id})`).join('\n');

        const analysisPrompt = `
        你是一个“上下文检索助手”。
        小说信息：标题：${novelTitle}
        大纲/背景：${outline.substring(0, 500)}...
        用户指令： "${prompt}"
        【可用知识库索引】：${indexStr}
        任务：判断需要引用哪些知识库条目？仅返回ID数组。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: analysisPrompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.1,
            }
        });

        // Track Usage
        if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        const jsonText = response.text;
        if (!jsonText) return [];
        
        return JSON.parse(jsonText) as string[];
    } catch (e) {
        console.error("Smart context selection failed", e);
        return [];
    }
};

export const generateSummary = async (chapterContent: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `请用3-4句话总结以下章节内容（使用中文），作为未来写作的上下文：\n\n${chapterContent}`,
        });
        
        if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }
        
        return response.text || "";
    } catch (e) {
        console.error("Summary generation failed", e);
        return "";
    }
}

export const generateIdeas = async (topic: string): Promise<string> => {
     try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `基于主题“${topic}”，提供3个富有创意的小说标题和一句话的简短钩子（Hook）。请以简单的列表形式用中文返回。`,
        });

        if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        return response.text || "";
    } catch (e) {
        return "";
    }
}

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
        你是一位专业的小说连贯性编辑。请分析以下“生成文本”，将其与“知识库设定”进行对比。
        检查人物OOC、世界观冲突。
        
        知识库设定：${context}
        生成文本：${textToAnalyze}
        
        输出简练的分析报告。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                temperature: 0.2,
            }
        });

        if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        return response.text || "无法生成分析报告。";
    } catch (e) {
        console.error("Consistency check failed", e);
        return "分析失败，请检查网络连接。";
    }
};

export const fixStoryConsistency = async (
    originalText: string,
    consistencyReport: string,
    entries: KnowledgeEntry[],
    categoryMap: Record<string, string>
): Promise<string> => {
    try {
        const context = entries.map(e =>
            `【${categoryMap[e.categoryId] || '设定'}】 ${e.title}:\n${e.content}`
        ).join('\n\n');

        const prompt = `
        你是一位资深的小说修订编辑。
        请根据提供的【检查报告】，重写【原始文本】，修正其中的逻辑错误、人物OOC或设定冲突。
        
        【知识库设定 (参考)】：
        ${context}
        
        【检查报告 (需修正的问题)】：
        ${consistencyReport}
        
        【原始文本】：
        ${originalText}
        
        要求：
        1. 修正所有报告中指出的问题。
        2. 保持原有的叙事风格和流畅度。
        3. 直接输出修正后的正文，不需要额外的解释。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        });

        if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        return response.text || originalText;
    } catch (e) {
        console.error("Consistency fix failed", e);
        throw e;
    }
};

export interface KnowledgeUpdateSuggestion {
    name: string;
    description: string;
    type: 'NEW' | 'UPDATE';
    categoryType: 'CHARACTER' | 'WORLD' | 'ITEM' | 'OTHER';
    reason: string;
    originalId?: string; 
}

export const analyzeStoryEvolution = async (
    chapterContent: string,
    existingEntries: KnowledgeEntry[],
    categoryMap: Record<string, string>
): Promise<KnowledgeUpdateSuggestion[]> => {
    try {
        const contextString = existingEntries.map(e => 
            `ID: ${e.id} | Type: ${categoryMap[e.categoryId]} | Name: ${e.title}\nSummary: ${e.content.substring(0, 100)}...`
        ).join('\n---\n');

        const prompt = `
        作为小说设定整理助手，请阅读【最新章节】，对比【现有知识库】，捕捉新出现的或发生变化的重要元素（人物、世界观、物品）。

        【现有知识库摘要】:
        ${contextString}

        【最新章节内容】:
        ${chapterContent}

        请返回一个 JSON 数组，格式如下：
        [
          {
            "name": "条目名称",
            "description": "新的完整设定描述（包含旧信息和新变化）",
            "type": "NEW" | "UPDATE",
            "categoryType": "CHARACTER" | "WORLD" | "ITEM" | "OTHER",
            "reason": "变更理由",
            "originalId": "如果是UPDATE，必须填入现有知识库的ID" 
          }
        ]
        
        如果没有任何值得记录的设定，返回空数组 []。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.3,
            }
        });

        if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        const jsonText = response.text;
        if (!jsonText) return [];

        try {
            const result = JSON.parse(jsonText) as KnowledgeUpdateSuggestion[];
            return result;
        } catch (parseError) {
            return [];
        }

    } catch (e) {
        console.error("Story evolution analysis failed", e);
        return [];
    }
};


export const generateBookCover = async (
    title: string,
    description: string,
    style: string,
    genre: string
): Promise<string | null> => {
    
    try {
        const prompt = `
        A high quality book cover for a novel. Title: "${title}", Genre: ${genre}, Style: ${style}.
        Scene: ${description.substring(0, 300)}
        No text on image.
        `;

        // Reverted to generateContent for gemini-2.5-flash-image
        // This avoids 404 issues with Imagen 3 if not provisioned
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL_NAME,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });

        // Iterate through parts to find the image
        if (response.candidates && response.candidates.length > 0) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return part.inlineData.data;
                }
            }
        }
        
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        throw e;
    }
}

export const generatePromptTemplate = async (
    userIntent: string,
    category: string
): Promise<string> => {
    try {
        const prompt = `
        作为提示词工程师，请为“${category}”分类编写一个 Prompt 模板。
        用户需求：“${userIntent}”。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.7 }
        });

        if (response.usageMetadata) {
             incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        return response.text?.trim() || "";
    } catch (e) {
        throw e;
    }
};

export const optimizePromptTemplate = async (
    currentContent: string,
    instruction: string
): Promise<string> => {
    try {
        const prompt = `
        优化以下提示词。
        现有：“${currentContent}”
        建议：“${instruction}”
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.6 }
        });

        if (response.usageMetadata) {
             incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        return response.text?.trim() || "";
    } catch (e) {
        throw e;
    }
}

export const expandKnowledgeEntry = async (
    currentContent: string,
    userPrompt: string
): Promise<string> => {
    try {
        const prompt = `
        你是一个专业的设定扩充助手。
        
        【当前设定文档内容】：
        ${currentContent}
        
        【用户指令】：
        ${userPrompt}
        
        请根据当前文档内容和用户指令，生成新的设定内容。
        如果用户指令是关于扩写，请丰富细节。
        如果用户指令是关于衍生（例如创造相关人物或物品），请生成新的实体描述。
        请直接返回内容，无需寒暄。
        `;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.7 }
        });

         if (response.usageMetadata) {
            incrementUsageStats(response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
        }

        return response.text?.trim() || "";
    } catch (e) {
        console.error("Expand knowledge failed", e);
        throw e;
    }
};