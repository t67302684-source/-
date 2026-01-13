
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ListingAnalysis, ImageAnalysisItem } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async analyzeListing(asinOrUrl: string): Promise<{ data: ListingAnalysis, sources: any[] }> {
    // 使用 gemini-3-pro-preview 并开启 googleSearch 工具以获取最新、真实的亚马逊页面数据
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Search for Amazon product with ASIN or URL: ${asinOrUrl}. 
      1. Extract the REAL Product Title.
      2. Extract the 5 Bullet Points (Features).
      3. Extract Material, Color, Size, and any other unique attributes.
      4. If this is a specific brand, capture its unique selling points.
      
      Return the information strictly in JSON format.`,
      config: {
        tools: [{ googleSearch: {} }], // 开启搜索以绕过直接抓取的限制
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
              }
            }
          },
          required: ["title", "bulletPoints", "productAttributes"]
        }
      }
    });

    try {
      const data = JSON.parse(response.text || '{}');
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { data, sources };
    } catch (e) {
      console.error("Parse Error:", response.text);
      throw new Error("Failed to parse real-time listing analysis. Please ensure the ASIN is correct.");
    }
  }

  async generateImageAnalysis(listingData: ListingAnalysis): Promise<ImageAnalysisItem[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on the following REAL product data:
      Title: ${listingData.title}
      Bullets: ${listingData.bulletPoints.join('; ')}
      Attributes: ${JSON.stringify(listingData.productAttributes)}
      
      Create 4 professional Amazon infographic concepts. 
      Analyze the competitor's likely image strategy and provide:
      Main Title (Punchy), Subtitle (Supporting), Content (Benefit-driven), Design Strategy (Visual instructions), and an AI Image Generation Prompt.`,
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

    const items = JSON.parse(response.text || '[]');
    return items.map((item: any, idx: number) => ({ ...item, id: idx + 1 }));
  }

  async generateProductImage(prompt: string, aspectRatio: "1:1" | "16:9" | "4:3" = "1:1"): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Image generation failed.");
  }
}
