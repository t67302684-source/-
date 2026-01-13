
export interface ListingAnalysis {
  title: string;
  bulletPoints: string[];
  productAttributes: {
    material: string;
    color: string;
    size: string;
    other: string;
  };
}

export interface ImageAnalysisItem {
  id: number;
  originalUrl?: string;
  mainTitle: string;
  subTitle: string;
  content: string;
  designStrategy: string;
  aiPromptScript: string;
}

export interface GeneratedImageItem {
  id: string;
  type: 'selling-point' | 'detail';
  mainTitle: string;
  subTitle: string;
  content: string;
  imageUrl?: string;
  status: 'idle' | 'generating' | 'done';
}
