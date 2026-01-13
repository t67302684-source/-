
import React, { useState, useEffect } from 'react';
import { GeminiService } from './services/geminiService';
import { ListingAnalysis, ImageAnalysisItem, GeneratedImageItem } from './types';
import { AnalysisCard } from './components/AnalysisCard';
import { ImageGenerationBlock } from './components/ImageGenerationBlock';

const App: React.FC = () => {
  const [asinInput, setAsinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ListingAnalysis | null>(null);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [imageConcepts, setImageConcepts] = useState<ImageAnalysisItem[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageItem[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [effectImage, setEffectImage] = useState<string | null>(null);
  const [consistencyPrompt, setConsistencyPrompt] = useState('保持产品外观一致，但将其放置在一个现代化的豪华客厅中');

  const gemini = new GeminiService();

  useEffect(() => {
    const key = (process as any).env?.API_KEY;
    if (!key) {
      setConfigError("未检测到 API_KEY。请确保您的环境变量中已配置。");
    }
  }, []);

  const handleAnalyze = async () => {
    if (!asinInput) return;
    setLoading(true);
    setAnalysis(null);
    setConfigError(null);
    
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
      alert(error.message || "分析失败，请检查网络或 ASIN。");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainImage = async (type: 'base' | 'effect') => {
    if (!analysis) return;
    const prompt = type === 'base' 
      ? `Professional product photography, ${analysis.title}, pure white background, 8k resolution, minimalist style`
      : `Lifestyle photography of ${analysis.title}, ${consistencyPrompt}, high quality, realistic lighting, 8k`;
    
    try {
      if (type === 'base') setBaseImage(null); else setEffectImage(null);
      const url = await gemini.generateProductImage(prompt);
      if (type === 'base') setBaseImage(url); else setEffectImage(url);
    } catch (e) {
      alert("生成失败：可能触发了安全限制或 API 额度不足。");
    }
  };

  const handleGenerateStepImage = async (id: string) => {
    const item = generatedImages.find(i => i.id === id);
    if (!item || !analysis) return;
    setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
    try {
      const prompt = `Professional Amazon infographic for ${analysis.title}. Focus on: ${item.mainTitle}. Description: ${item.content}. High resolution, clean composition.`;
      const url = await gemini.generateProductImage(prompt);
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done' } : i));
    } catch (e) {
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'idle' } : i));
    }
  };

  const handleEditStepImage = async (id: string) => {
    const item = generatedImages.find(i => i.id === id);
    if (!item || !item.imageUrl || !item.editPrompt) return;
    
    setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
    try {
      const url = await gemini.editImage(item.imageUrl, item.editPrompt);
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done', editPrompt: '' } : i));
    } catch (e) {
      alert("修改失败，请重试。");
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'done' } : i));
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      {configError && (
        <div className="bg-red-600 text-white p-2 text-center text-xs font-bold animate-pulse">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>
          {configError}
        </div>
      )}
      
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
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
              placeholder="粘贴亚马逊 ASIN 或产品链接 (例如：B0CZ8X...)"
              value={asinInput}
              onChange={(e) => setAsinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button 
              onClick={handleAnalyze}
              disabled={loading || !!configError}
              className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-all shadow-md shadow-orange-100"
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
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-orange-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-bold text-base text-slate-800">{c.mainTitle}</h5>
                      <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md font-bold">概念 {i+1}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{c.content}</p>
                    <div className="text-[10px] bg-slate-50 p-3 rounded-lg border border-slate-100 italic text-slate-400">
                      <span className="font-bold text-slate-500 not-italic mr-1">策略指导:</span> {c.designStrategy}
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
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                    {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-8" /> : <i className="fa-regular fa-image text-5xl text-slate-200"></i>}
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">白底渲染图</div>
                  </div>
                  <button onClick={() => handleGenerateMainImage('base')} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg active:scale-95">生成专业白底图</button>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                    {effectImage ? <img src={effectImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-wand-sparkles text-5xl text-slate-200"></i>}
                    <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">生活场景图</div>
                  </div>
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">场景自定义指令</label>
                    <textarea 
                      className="w-full p-4 text-xs bg-slate-50 border border-slate-100 rounded-xl h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                      value={consistencyPrompt} 
                      onChange={(e) => setConsistencyPrompt(e.target.value)} 
                    />
                  </div>
                  <button onClick={() => handleGenerateMainImage('effect')} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg active:scale-95">生成场景变体</button>
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
                    onGenerate={handleGenerateStepImage}
                    onEdit={handleEditStepImage}
                  />
                ))}
              </section>
            </div>
          </>
        ) : (
          <div className="py-32 text-center text-slate-400">
            <div className="relative inline-block mb-8">
              <i className="fa-solid fa-magnifying-glass text-7xl opacity-10"></i>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 animate-bounce">
                <i className="fa-solid fa-plus text-xs"></i>
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-4">准备好打造爆款了吗？</h2>
            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">在上方输入竞对 ASIN，AI 将深度分析卖点并为您生成全套详情页视觉方案。</p>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-sm w-full">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-orange-500">
                <i className="fa-solid fa-robot text-2xl"></i>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">AI 正在深度分析中...</h3>
            <p className="text-sm text-slate-500">正在检索实时 Listing 数据并策划视觉方案，请稍候。</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
