
import React, { useState, useEffect } from 'react';
import { GeminiService } from './services/geminiService';
import { ListingAnalysis, ImageAnalysisItem, GeneratedImageItem } from './types';
import { AnalysisCard } from './components/AnalysisCard';
import { ImageGenerationBlock } from './components/ImageGenerationBlock';

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

declare global {
  interface Window {
    // Removed readonly to match standard global property declarations and avoid modifier mismatch errors
    aistudio: AIStudio;
  }
}

export type ModelType = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';

const App: React.FC = () => {
  const [asinInput, setAsinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ListingAnalysis | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [imageConcepts, setImageConcepts] = useState<ImageAnalysisItem[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-flash-preview');
  
  const isEnvKeyAvailable = !!process.env.API_KEY && process.env.API_KEY !== 'undefined';
  const [hasApiKey, setHasApiKey] = useState<boolean>(isEnvKeyAvailable);

  const gemini = new GeminiService(selectedModel);

  useEffect(() => {
    const checkKey = async () => {
      if (isEnvKeyAvailable) {
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
      }
    };
    checkKey();
  }, [isEnvKeyAvailable]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    } else {
      alert("请在 Vercel Settings -> Environment Variables 中配置 API_KEY 并重新部署。");
    }
  };

  const handleAnalyze = async () => {
    if (!asinInput) return;
    
    if (!hasApiKey && !isEnvKeyAvailable) {
      if (window.aistudio) {
        await handleSelectKey();
      } else {
        alert("未检测到有效 API Key。");
        return;
      }
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
          mainTitle: result.data.bulletPoints[i]?.split(/[:：]/)[0] || '产品优势',
          subTitle: '核心卖点',
          content: result.data.bulletPoints[i] || '优势描述',
          status: 'idle' as const
        })),
        ...Array(3).fill(null).map((_, i) => ({
          id: `dt-${i}`,
          type: 'detail' as const,
          mainTitle: '细节展示',
          subTitle: `参数: ${result.data.productAttributes.material || '精选材质'}`,
          content: '微距拍摄展示质感。',
          status: 'idle' as const
        }))
      ];
      setGeneratedImages(initialGenerated);
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
        if (window.aistudio) await window.aistudio.openSelectKey();
      }
      alert(error.message || "分析出现异常，请尝试切换模型或重新输入。");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainImage = async (type: 'base' | 'effect') => {
    if (!analysis) return;
    const prompt = type === 'base' 
      ? `Professional product photo of ${analysis.title}, pure white background, studio lighting, high quality 8k render`
      : `Lifestyle photography of ${analysis.title} in a premium home environment, soft natural light, photorealistic 8k`;
    
    try {
      const url = await gemini.generateProductImage(prompt);
      if (type === 'base') setBaseImage(url);
      else setEffectImage(url);
    } catch (e: any) {
      alert("生成失败，如果是 429 错误请尝试切换到 Flash 模型。");
    }
  };

  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [effectImage, setEffectImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      {!hasApiKey && !isEnvKeyAvailable && (
        <div className="bg-red-600 text-white py-2 px-4 flex justify-center items-center gap-4 sticky top-0 z-[100] shadow-md">
          <span className="text-xs font-bold uppercase tracking-wider">
            <i className="fa-solid fa-key mr-2"></i>
            未配置 API KEY
          </span>
          <button onClick={handleSelectKey} className="bg-white text-red-600 px-3 py-1 rounded text-[10px] font-black hover:bg-slate-100">立即配置</button>
        </div>
      )}
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fa-brands fa-amazon"></i>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">AMZ 视觉智造</h1>
          </div>
          
          <div className="flex flex-1 w-full gap-2 items-center">
            <input 
              className="flex-1 px-4 py-2.5 bg-slate-100 border border-transparent rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none text-sm transition-all"
              placeholder="输入 ASIN 或 亚马逊产品链接"
              value={asinInput}
              onChange={(e) => setAsinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button 
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : "开始分析"}
            </button>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button 
              onClick={() => setSelectedModel('gemini-3-flash-preview')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedModel === 'gemini-3-flash-preview' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <i className="fa-solid fa-bolt mr-1.5"></i>Flash
            </button>
            <button 
              onClick={() => setSelectedModel('gemini-3-pro-preview')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedModel === 'gemini-3-pro-preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <i className="fa-solid fa-brain mr-1.5"></i>Pro
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-12">
        {analysis ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <AnalysisCard title="产品详情提取" icon="fa-solid fa-file-invoice">
                  <h4 className="font-bold text-slate-900 mb-4">{analysis.title}</h4>
                  <div className="space-y-3">
                    {analysis.bulletPoints.map((bp, i) => (
                      <p key={i} className="text-xs text-slate-600 leading-relaxed border-l-2 border-orange-100 pl-3">
                        {bp}
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-50 p-2 rounded"><strong>材质:</strong> {analysis.productAttributes.material}</div>
                    <div className="bg-slate-50 p-2 rounded"><strong>尺寸:</strong> {analysis.productAttributes.size}</div>
                  </div>
                </AnalysisCard>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {imageConcepts.map((c, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-bold text-slate-800">{c.mainTitle}</h5>
                      <span className="text-[9px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">创意 {i+1}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">{c.content}</p>
                    <div className="text-[10px] text-slate-400 font-medium">💡 {c.designStrategy}</div>
                  </div>
                ))}
              </div>
            </section>

            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-camera-retro text-orange-500"></i>
                渲染主图生成
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-dashed border-slate-200">
                    {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-4" /> : <i className="fa-regular fa-image text-4xl text-slate-200"></i>}
                  </div>
                  <button onClick={() => handleGenerateMainImage('base')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">生成干净白底图</button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-dashed border-slate-200">
                    {effectImage ? <img src={effectImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-sparkles text-4xl text-slate-200"></i>}
                  </div>
                  <button onClick={() => handleGenerateMainImage('effect')} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm">生成生活化场景图</button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-12">
               <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <i className="fa-solid fa-layer-group text-orange-500"></i>
                 A+ 卖点详情图
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
                         const prompt = `Professional Amazon E-commerce infographic for ${analysis.title}. Focus on: ${item.mainTitle}. ${item.content}. Sharp details, commercial photography style.`;
                         const url = await gemini.generateProductImage(prompt);
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
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-magnifying-glass text-3xl text-orange-500"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">准备就绪</h2>
            <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed mb-6">
              输入 ASIN，我们将为您深度调研竞对并设计视觉套图。免费用户推荐使用 Flash 模型。
            </p>
            <div className="flex justify-center gap-4">
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  FLASH: 极速 & 高配额
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                  PRO: 深度分析 & 思考模式
               </div>
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-xs w-full">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="font-bold text-slate-900 mb-2">正在通过 {selectedModel.includes('pro') ? 'PRO' : 'FLASH'} 模型分析...</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">正在全网搜寻产品规格。如果是 Pro 模型，AI 会通过“思考”绕过部分反爬限制。</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
