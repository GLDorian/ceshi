
import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const polishText = async (text: string): Promise<string> => {
  try {
    const ai = getAiClient();
    // Use gemini-3-flash-preview for basic text polishing tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `你是一名医学文档专家。请将以下字段标签重写得更加专业、简洁，并适用于临床病例报告表（CRF）或技术数据表。请直接返回修改后的中文文本，不要加引号或解释。
      
      输入: "${text}"`,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return text; // 失败时返回原文
  }
};

export const suggestFormDescription = async (formName: string, variableLabels: string[]): Promise<string> => {
    try {
        const ai = getAiClient();
        // Use gemini-3-flash-preview for basic text generation tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `请为名为"${formName}"且包含这些字段：${variableLabels.join(', ')} 的医疗表单生成一段简短、专业的中文描述（一句话）。`
        });
        return response.text.trim();
    } catch (error) {
        return "";
    }
}
