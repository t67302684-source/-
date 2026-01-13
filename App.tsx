
import React, { useState, useEffect } from 'react';
import { GeminiService } from './services/geminiService';
import { ListingAnalysis, ImageAnalysisItem, GeneratedImageItem } from './types';
import { AnalysisCard } from './components/AnalysisCard';
import { ImageGenerationBlock } from './components/ImageGenerationBlock';

declare global {
  interface Window {
    // Use any to avoid conflicting with existing AIStudio types in the environment
    aistudio: any;
  }
}

const App: React.FC = () => {
  const [asinInput, setAsinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ListingAnalysis | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [imageConcepts, setImageConcepts] = useState<ImageAnalysisItem[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageItem[]>([]);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  const gemini = new GeminiService();

  useEffect(() => {
    const checkKey = async () => {
      // 优先检查环境变量，如果没有则检查 window.aistudio 状态
      const envKey = (process as any).env?.API_KEY;
      if (envKey) {
        setHasApiKey(true);
        return;
      }

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
      // 触发后直接假设成功以避免 Race Condition
      setHasApiKey(true);
    } else {
      alert("请在支持的 AI Studio 环境中使用或通过环境变量配置 API_KEY。");
    }
  };

  const handleAnalyze = async () => {
    if (!asinInput) return;
    if (!hasApiKey) {
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
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        alert("API Key 无效或未找到，请重新选择。");
      } else {
        alert(error.message || "分析失败，请检查网络或 ASIN。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainImage = async (type: 'base' | 'effect') => {
    if (!analysis) return;
    const prompt = type === 'base' 
      ? `Professional product photography, ${analysis.title}, pure white background, 8k resolution, minimalist style`
      : `Lifestyle photography of ${analysis.title}, in a modern setting, high quality, realistic lighting, 8k`;
    
    try {
      const url = await gemini.generateProductImage(prompt);
      if (type === 'base') setAnalysis(prev => prev ? {...prev} : null); // Trigger re-render
      type === 'base' ? setBaseImage(url) : setEffectImage(url);
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found")) setHasApiKey(false);
      alert("生成失败：请检查 API Key 权限或稍后再试。");
    }
  };

  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [effectImage, setEffectImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      {!hasApiKey && (
        <div className="bg-orange-600 text-white py-3 px-4 flex justify-center items-center gap-4 sticky top-0 z-[100] shadow-lg">
          <span className="text-sm font-medium">
            <i className="fa-solid fa-key mr-2"></i>
            需要配置 API Key 才能使用 AI 生成功能
          </span>
          <button 
            onClick={handleSelectKey}
            className="bg-white text-orange-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            立即设置
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="text-[10px] underline opacity-80"
          >
            查看计费说明
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
              placeholder="粘贴亚马逊 ASIN 或产品链接..."
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
              一键分析
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-12">
        {analysis ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <AnalysisCard title="Listing 竞对情报" icon="fa-solid fa-brain">
                  <h4 className="font-bold text-slate-900 mb-4 text-lg">{analysis.title}</h4>
                  <div className="space-y-4">
                    {analysis.bulletPoints.map((bp, i) => (
                      <div key={i} className="text-sm text-slate-600 flex gap-2 leading-relaxed">
                        <span className="text-orange-500 font-bold">{i+1}.</span> 
                        <p>{bp}</p>
                      </div>
                    ))}
                  </div>
                </AnalysisCard>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {imageConcepts.map((c, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h5 className="font-bold text-base text-slate-800 mb-2">{c.mainTitle}</h5>
                    <p className="text-xs text-slate-500 mb-3">{c.content}</p>
                    <div className="text-[10px] bg-slate-50 p-2 rounded border text-slate-400">
                      设计策略: {c.designStrategy}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-slate-200 pt-12">
               <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-2">
                 <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                 核心图像生成
               </h2>
               <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                    {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-8" /> : <i className="fa-regular fa-image text-5xl text-slate-200"></i>}
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold">白底渲染图</div>
                  </div>
                  <button onClick={() => handleGenerateMainImage('base')} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg">生成专业白底图</button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                    {effectImage ? <img src={effectImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-wand-sparkles text-5xl text-slate-200"></i>}
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold">生活场景图</div>
                  </div>
                  <button onClick={() => handleGenerateMainImage('effect')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg">生成场景变体</button>
                </div>
              </section>
            </div>

            <div className="border-t border-slate-200 pt-12">
               <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-2">
                 <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                 详情页 A+ 卖点套图
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
                         const url = await gemini.generateProductImage(`Professional Amazon infographic for ${analysis.title}. Focus on: ${item.mainTitle}. ${item.content}`);
                         setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done' } : i));
                       } catch (e) {
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
                       } catch (e) {
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
            <h2 className="text-3xl font-black text-slate-800 mb-4">准备好打造爆款了吗？</h2>
            <p className="text-slate-500 max-w-md mx-auto">输入竞对 ASIN，AI 将深度分析卖点并生成视觉方案。</p>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-sm">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">AI 正在深度分析中...</h3>
            <p className="text-sm text-slate-500">正在检索实时 Listing 数据并策划视觉方案。</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
