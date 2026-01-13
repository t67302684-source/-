
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ListingAnalysis, ImageAnalysisItem } from "../types";

export class GeminiService {
  // 不再在构造函数中直接保存实例，而是在调用时确保获取最新的 process.env.API_KEY
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async analyzeListing(asinOrUrl: string): Promise<{ data: ListingAnalysis, sources: any[] }> {
    const ai = this.getAI();
    // 使用 gemini-3-pro-preview 结合 googleSearch 工具
    // 提示词增强：明确要求模型先搜索再总结，以规避反爬限制
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a deep web search for the Amazon product using this ASIN or Link: ${asinOrUrl}.
      Find the official listing page or cached data.
      Required Task:
      1. Get the EXACT product title.
      2. List 5 detailed bullet points (key features).
      3. Identify specifications: Material, Color, Dimensions, and unique selling points.
      
      Output ONLY a valid JSON object following this schema:
      {
        "title": "string",
        "bulletPoints": ["string"],
        "productAttributes": {
          "material": "string",
          "color": "string",
          "size": "string",
          "other": "string"
        }
      }`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        // 保持 schema 定义以确保 JSON 输出稳定性
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
              }
            }
          },
          required: ["title", "bulletPoints", "productAttributes"]
        }
      }
    });

    try {
      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      const data = JSON.parse(text);
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { data, sources };
    } catch (e) {
      console.error("Gemini Analysis Error:", e, response);
      throw new Error("Could not retrieve real-time data. Please ensure your API Key has Google Search enabled and the ASIN is valid.");
    }
  }

  async generateImageAnalysis(listingData: ListingAnalysis): Promise<ImageAnalysisItem[]> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `As an Amazon creative director, analyze this product data:
      Title: ${listingData.title}
      Details: ${listingData.bulletPoints.join(' ')}
      
      Generate 4 distinct infographic concepts for A+ content.
      For each, provide: mainTitle, subTitle, content, designStrategy, and aiPromptScript.`,
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
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  }

  async generateProductImage(prompt: string, aspectRatio: "1:1" | "16:9" | "4:3" = "1:1"): Promise<string> {
    const ai = this.getAI();
    // 使用 gemini-2.5-flash-image 处理图像生成
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image part was returned from the model.");
  }
}
