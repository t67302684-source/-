
import { GoogleGenAI, Type } from "@google/genai";
import { ListingAnalysis, ImageAnalysisItem } from "../types";

export class GeminiService {
  private getApiKey(): string {
    const key = process.env.API_KEY;
    if (!key || key === 'undefined') {
      throw new Error("API_KEY_MISSING");
    }
    return key;
  }

  // Create a fresh instance of GoogleGenAI for each request to ensure the latest API Key is used
  private getAI() {
    return new GoogleGenAI({ apiKey: this.getApiKey() });
  }

  async analyzeListing(asinOrUrl: string): Promise<{ data: ListingAnalysis, sources: any[] }> {
    try {
      const ai = this.getAI();
      // 使用 gemini-3-flash-preview 替代 pro，以获得更高的免费配额
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `你是一个亚马逊资深运营。请针对以下输入进行深度背景调查：
        输入内容：${asinOrUrl}
        
        任务指令：
        1. 使用 Google Search 寻找该产品在全网的信息。
        2. 提取：产品全名(title)、5个核心卖点(bulletPoints)、材质(material)、颜色(color)、尺寸(size)。
        3. 如果信息不全，请根据常识推测。
        
        必须以 JSON 格式输出。`,
        config: {
          tools: [{ googleSearch: {} }],
          // 降低思考预算以节省 Token，防止触发配额限制
          thinkingConfig: { thinkingBudget: 0 }, 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              productAttributes: {
                type: Type.OBJECT,
                properties: {
                  material: { type: Type.STRING },
                  color: { type: Type.STRING },
                  size: { type: Type.STRING },
                  other: { type: Type.STRING }
                },
                required: ["material", "color", "size"]
              }
            },
            required: ["title", "bulletPoints", "productAttributes"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("SEARCH_FAILED");
      
      const data = JSON.parse(text);
      
      if (!data.title || !data.bulletPoints || data.bulletPoints.length === 0) {
        throw new Error("INCOMPLETE_DATA");
      }

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { data, sources };
    } catch (e: any) {
      console.error("Gemini Analysis Error:", e);
      if (e.message?.includes("429") || e.message?.includes("quota")) {
        throw new Error("API 配额已耗尽。请稍后再试，或前往 Google AI Studio 检查您的 API Key 是否绑定了结算账户。建议使用付费项目的 Key 以获得更稳定的体验。");
      }
      if (e.message === "API_KEY_MISSING") {
        throw new Error("未检测到 API Key，请确保已正确配置。");
      }
      throw new Error("分析失败。请检查 ASIN 是否正确，或者直接输入产品全名进行搜索。");
    }
  }

  async generateImageAnalysis(listingData: ListingAnalysis): Promise<ImageAnalysisItem[]> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `针对产品: ${listingData.title}。请策划4个亚马逊图片概念。
      包含：主标题 (mainTitle)、副标题 (subTitle)、图片内容描述 (content)、设计策略 (designStrategy)。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              mainTitle: { type: Type.STRING },
              subTitle: { type: Type.STRING },
              content: { type: Type.STRING },
              designStrategy: { type: Type.STRING },
              aiPromptScript: { type: Type.STRING }
            },
            required: ["mainTitle", "content"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  }

  async generateProductImage(prompt: string, aspectRatio: "1:1" | "16:9" | "4:3" | "3:4" | "9:16" = "1:1"): Promise<string> {
    const ai = this.getAI();
    // 降级为 gemini-2.5-flash-image 以确保免费配额可用
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("图像生成失败。");
  }

  async editImage(base64Image: string, editPrompt: string): Promise<string> {
    const ai = this.getAI();
    const base64Data = base64Image.split(',')[1] || base64Image;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/png'
            }
          },
          { text: `Modify this image: ${editPrompt}. Maintain product structure.` }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("图像修改失败。");
  }
}
