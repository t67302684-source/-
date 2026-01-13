
import { GoogleGenAI, Type } from "@google/genai";
import { ListingAnalysis, ImageAnalysisItem } from "../types";

export class GeminiService {
  private getApiKey(): string {
    // 兼容 Vite (VITE_API_KEY) 和标准环境变量 (API_KEY)
    const key = (import.meta as any).env?.VITE_API_KEY || (process as any).env?.API_KEY;
    return key || '';
  }

  private getAI() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("API_KEY is missing. Please set VITE_API_KEY in Vercel Environment Variables.");
    }
    return new GoogleGenAI({ apiKey });
  }

  async analyzeListing(asinOrUrl: string): Promise<{ data: ListingAnalysis, sources: any[] }> {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Search for Amazon product with ASIN/URL: ${asinOrUrl}. 
        Extract: Title, 5 Bullets, Material, Color, Size.
        Output ONLY JSON.`,
        config: {
          tools: [{ googleSearch: {} }],
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

      const data = JSON.parse(response.text || '{}');
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { data, sources };
    } catch (e: any) {
      console.error("Gemini Error:", e);
      throw new Error(e.message || "Failed to analyze listing.");
    }
  }

  async generateImageAnalysis(listingData: ListingAnalysis): Promise<ImageAnalysisItem[]> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Product: ${listingData.title}. Generate 4 infographic image concepts with mainTitle, subTitle, content, designStrategy.`,
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
    throw new Error("No image generated.");
  }
}
