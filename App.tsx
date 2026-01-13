
import React, { useState, useEffect } from 'react';
import { GeminiService } from './services/geminiService';
import { ListingAnalysis, ImageAnalysisItem, GeneratedImageItem } from './types';
import { AnalysisCard } from './components/AnalysisCard';
import { ImageGenerationBlock } from './components/ImageGenerationBlock';

// Define the interface for the global window object extensions
interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

declare global {
  interface Window {
    // Removed readonly modifier to avoid "identical modifiers" error and match default Window property traits
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [asinInput, setAsinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ListingAnalysis | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [imageConcepts, setImageConcepts] = useState<ImageAnalysisItem[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageItem[]>([]);
  
  // 核心逻辑：如果 process.env.API_KEY 存在，则初始 hasApiKey 为 true
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!process.env.API_KEY);

  const gemini = new GeminiService();

  useEffect(() => {
    const checkKey = async () => {
      // 如果环境变量已有，直接确认并退出检查
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }

      // 如果没有环境变量，检查是否在 AI Studio 预览环境中
      if (window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } catch (e) {
          setHasApiKey(false);
        }
      } else {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success after triggering the dialog to mitigate race conditions
      setHasApiKey(true);
    } else {
      alert("请在 Vercel 后台配置 API_KEY 环境变量，或在 AI Studio 中使用。");
    }
  };

  const handleAnalyze = async () => {
    if (!asinInput) return;
    
    // 如果没有任何形式的 Key，且在 AI Studio 中，则引导选择
    if (!process.env.API_KEY && !hasApiKey && window.aistudio) {
      await handleSelectKey();
    }
    
    setLoading(true);
    setAnalysis(null);
    
    try {
      const result = await gemini.analyzeListing(asinInput);
      setAnalysis(result.data);
      setGroundingSources(result.sources);
      
      const concepts = await gemini.generateImageAnalysis(result.data);
      setImageConcepts(concepts);

      const initialGenerated: GeneratedImageItem[] = [
        ...Array(3).fill(null).map((_, i) => ({
          id: `sp-${i}`,
          type: 'selling-point' as const,
          mainTitle: result.data.bulletPoints[i]?.split(/[:：]/)[0] || '核心特性',
          subTitle: '产品优势',
          content: result.data.bulletPoints[i] || '卖点详细描述。',
          status: 'idle' as const
        })),
        ...Array(3).fill(null).map((_, i) => ({
          id: `dt-${i}`,
          type: 'detail' as const,
          mainTitle: '产品细节',
          subTitle: `材质: ${result.data.productAttributes.material || '高品质'}`,
          content: '高清特写，展示产品精湛工艺。',
          status: 'idle' as const
        }))
      ];
      setGeneratedImages(initialGenerated);
    } catch (error: any) {
      console.error(error);
      // 如果 Key 无效，重置状态并提示重新选择 (Gemini API billing/key issues often surface as 403 or 404)
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("403")) {
        if (!process.env.API_KEY) {
          setHasApiKey(false);
          if (window.aistudio) await window.aistudio.openSelectKey();
        } else {
          alert("检测到 API Key 无效，请检查 Vercel 环境变量配置是否正确，并确保已开启账单结算。");
        }
      } else {
        alert(error.message || "分析失败，请稍后重试。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainImage = async (type: 'base' | 'effect') => {
    if (!analysis) return;
    const prompt = type === 'base' 
      ? `Professional product photography of ${analysis.title}, white background, high resolution, 8k, e-commerce style`
      : `Lifestyle shot of ${analysis.title} in use, natural environment, photorealistic, 8k, professional lighting`;
    
    try {
      const url = await gemini.generateProductImage(prompt);
      if (type === 'base') {
        setBaseImage(url);
      } else {
        setEffectImage(url);
      }
    } catch (e: any) {
      alert("生成失败，请检查 API Key 权限。");
    }
  };

  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [effectImage, setEffectImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      {/* 核心判断：只有当环境变量不存在 且 hasApiKey 为 false 时才显示 */}
      {!process.env.API_KEY && !hasApiKey && (
        <div className="bg-orange-600 text-white py-3 px-4 flex justify-center items-center gap-4 sticky top-0 z-[100] shadow-lg">
          <span className="text-sm font-medium">
            <i className="fa-solid fa-key mr-2"></i>
            当前环境未检测到 API Key
          </span>
          <button 
            onClick={handleSelectKey}
            className="bg-white text-orange-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            去设置
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="text-[10px] underline opacity-80"
          >
            关于付费 API 说明
          </a>
        </div>
      )}
      
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fa-brands fa-amazon"></i>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">AMZ 视觉智造</h1>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <input 
              className="flex-1 sm:w-96 px-4 py-2 bg-slate-100 border border-transparent rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none text-sm transition-all"
              placeholder="输入 ASIN 或亚马逊产品链接..."
              value={asinInput}
              onChange={(e) => setAsinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button 
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-all shadow-md"
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-bolt mr-2"></i>}
              分析竞对
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-12">
        {analysis ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <AnalysisCard title="卖点分析" icon="fa-solid fa-brain">
                  <h4 className="font-bold text-slate-900 mb-4 text-lg">{analysis.title}</h4>
                  <div className="space-y-4">
                    {analysis.bulletPoints.map((bp, i) => (
                      <div key={i} className="text-sm text-slate-600 flex gap-2 leading-relaxed">
                        <span className="text-orange-500 font-bold">{i+1}.</span> 
                        <p>{bp}</p>
                      </div>
                    ))}
                  </div>
                  {groundingSources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Google 搜索来源</p>
                      {groundingSources.map((source, idx) => (
                        source.web && (
                          <a key={idx} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-500 truncate hover:underline">
                            {source.web.title || source.web.uri}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </AnalysisCard>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {imageConcepts.map((c, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h5 className="font-bold text-base text-slate-800 mb-2">{c.mainTitle}</h5>
                    <p className="text-xs text-slate-500 mb-3">{c.content}</p>
                    <div className="text-[10px] bg-slate-50 p-2 rounded border text-slate-400">
                      视觉策略: {c.designStrategy}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-slate-200 pt-12">
               <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-2">
                 <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                 核心图生成
               </h2>
               <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                    {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-8" /> : <i className="fa-regular fa-image text-5xl text-slate-200"></i>}
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold">干净白底图</div>
                  </div>
                  <button onClick={() => handleGenerateMainImage('base')} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg">生成 8K 渲染图</button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                    {effectImage ? <img src={effectImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-wand-sparkles text-5xl text-slate-200"></i>}
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold">生活化场景</div>
                  </div>
                  <button onClick={() => handleGenerateMainImage('effect')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg">生成场景图</button>
                </div>
              </section>
            </div>

            <div className="border-t border-slate-200 pt-12">
               <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-2">
                 <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                 A+ 详情套图
               </h2>
               <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {generatedImages.map((img) => (
                  <ImageGenerationBlock 
                    key={img.id} 
                    item={img} 
                    onUpdate={(id, up) => setGeneratedImages(prev => prev.map(i => i.id === id ? {...i, ...up} : i))} 
                    onGenerate={async (id) => {
                       const item = generatedImages.find(i => i.id === id);
                       if (!item || !analysis) return;
                       setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
                       try {
                         const url = await gemini.generateProductImage(`Amazon infographic, ${analysis.title}, focus on: ${item.mainTitle}, ${item.content}, professional commercial lighting`);
                         setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done' } : i));
                       } catch (e: any) {
                         setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'idle' } : i));
                       }
                    }}
                    onEdit={async (id) => {
                       const item = generatedImages.find(i => i.id === id);
                       if (!item || !item.imageUrl || !item.editPrompt) return;
                       setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
                       try {
                         const url = await gemini.editImage(item.imageUrl, item.editPrompt);
                         setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done', editPrompt: '' } : i));
                       } catch (e: any) {
                         setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'done' } : i));
                       }
                    }}
                  />
                ))}
              </section>
            </div>
          </>
        ) : (
          <div className="py-32 text-center text-slate-400">
            <i className="fa-solid fa-magnifying-glass text-7xl opacity-10 mb-8"></i>
            <h2 className="text-3xl font-black text-slate-800 mb-4">输入 ASIN 开始</h2>
            <p className="text-slate-500 max-w-md mx-auto">我们将深度分析竞对 Listing，并为你生成高质量的视觉方案。</p>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-sm">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">正在分析 Listing...</h3>
            <p className="text-sm text-slate-500">正在通过 Google 搜索获取产品实时情报。</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
