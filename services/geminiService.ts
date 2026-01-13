
import { GoogleGenAI, Type } from "@google/genai";
import { ListingAnalysis, ImageAnalysisItem } from "../types";

export class GeminiService {
  private getApiKey(): string {
    return (process as any).env?.API_KEY || '';
  }

  private getAI() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("API_KEY 缺失，请在环境变量中设置。");
    }
    return new GoogleGenAI({ apiKey });
  }

  async analyzeListing(asinOrUrl: string): Promise<{ data: ListingAnalysis, sources: any[] }> {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `请搜索亚马逊产品 ASIN/链接: ${asinOrUrl}。
        提取以下信息：标题 (Title)、5个卖点 (Bullet Points)、材质 (Material)、颜色 (Color)、尺寸 (Size)。
        请直接输出 JSON 格式。`,
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
      throw new Error(e.message || "分析 Listing 失败。");
    }
  }

  async generateImageAnalysis(listingData: ListingAnalysis): Promise<ImageAnalysisItem[]> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `针对产品: ${listingData.title}。请策划4个高转化率的亚马逊详情页图片概念。
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
    throw new Error("图像生成失败。");
  }

  async editImage(base64Image: string, editPrompt: string): Promise<string> {
    const ai = this.getAI();
    // 移除 base64 前缀
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
          { text: `Based on this image, please edit it according to this instruction: ${editPrompt}. Keep the product itself consistent.` }
        ]
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("图像修改失败。");
  }
}
