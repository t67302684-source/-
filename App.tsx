
import React, { useState } from 'react';
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
  
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [effectImage, setEffectImage] = useState<string | null>(null);
  const [consistencyPrompt, setConsistencyPrompt] = useState('Keep product design identical but set in a luxury home environment, sunset lighting');

  // 注意：在 Vercel 部署时，请确保在 Vercel Dashboard 的 Environment Variables 中设置了 API_KEY
  const gemini = new GeminiService();

  const handleAnalyze = async () => {
    if (!asinInput) return;
    setLoading(true);
    setAnalysis(null);
    setGroundingSources([]);
    
    console.log("Starting analysis for:", asinInput);
    
    try {
      // 1. 获取真实 Listing 数据
      const result = await gemini.analyzeListing(asinInput);
      setAnalysis(result.data);
      setGroundingSources(result.sources);
      
      // 2. 提取图片策划思路
      const concepts = await gemini.generateImageAnalysis(result.data);
      setImageConcepts(concepts);

      // 3. 预设 6 张生成任务
      const initialGenerated: GeneratedImageItem[] = [
        ...Array(3).fill(null).map((_, i) => ({
          id: `sp-${i}`,
          type: 'selling-point' as const,
          mainTitle: result.data.bulletPoints[i]?.split(/[:：]/)[0] || 'Key Feature',
          subTitle: 'Market Leading Design',
          content: result.data.bulletPoints[i] || 'Analysis of competitive advantage.',
          status: 'idle' as const
        })),
        ...Array(3).fill(null).map((_, i) => ({
          id: `dt-${i}`,
          type: 'detail' as const,
          mainTitle: 'Precision Detail',
          subTitle: `Focus on ${result.data.productAttributes.material || 'Quality'}`,
          content: 'Close-up showcasing texture and assembly quality.',
          status: 'idle' as const
        }))
      ];
      setGeneratedImages(initialGenerated);
      console.log("Analysis completed successfully");
    } catch (error: any) {
      console.error("Vercel App Error:", error);
      alert(`Error: ${error.message || "Something went wrong during analysis."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainImage = async (type: 'base' | 'effect') => {
    if (!analysis) return;
    const prompt = type === 'base' 
      ? `High-end e-commerce product photography, ${analysis.title}, pure white background, studio lighting, front view, 8k resolution`
      : `Professional lifestyle photography of ${analysis.title}. Scene: ${consistencyPrompt}. Ultra-realistic, 8k, advertising style.`;
    
    try {
      if (type === 'base') setBaseImage(null); else setEffectImage(null);
      const url = await gemini.generateProductImage(prompt);
      if (type === 'base') setBaseImage(url); else setEffectImage(url);
    } catch (e) {
      console.error("Image Gen Error:", e);
      alert("Image generation failed. This might be due to API rate limits or safety filters.");
    }
  };

  const handleGenerateStepImage = async (id: string) => {
    const item = generatedImages.find(i => i.id === id);
    if (!item || !analysis) return;

    setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
    
    try {
      const prompt = `Amazon infographic, ${analysis.title}. Focus: ${item.mainTitle}. Style: clean layout, commercial quality. ${item.content}`;
      const url = await gemini.generateProductImage(prompt);
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done' } : i));
    } catch (e) {
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'idle' } : i));
      console.error("Step Image Gen Error:", e);
    }
  };

  const updateGeneratedItem = (id: string, updates: Partial<GeneratedImageItem>) => {
    setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fa-brands fa-amazon"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">AMZ VISUAL AI</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Vercel Powered Edition</p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <div className="relative flex-1 sm:w-96">
              <i className="fa-solid fa-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                className="w-full pl-10 pr-4 py-3 bg-slate-100 border-2 border-transparent rounded-xl focus:border-orange-500 focus:bg-white outline-none text-sm transition-all"
                placeholder="Enter ASIN (e.g. B0CZ8X...)"
                value={asinInput}
                onChange={(e) => setAsinInput(e.target.value)}
              />
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg active:scale-95"
            >
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
              Analyze
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-12">
        {analysis && (
          <>
            {/* Grounding Info */}
            {groundingSources.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center gap-3">
                <i className="fa-solid fa-earth-americas text-blue-500"></i>
                <span className="text-xs text-blue-700 font-medium">Verified using live data via Search Grounding</span>
              </div>
            )}

            {/* Intelligence Results */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalysisCard title="Competitor Copy Intel" icon="fa-solid fa-file-lines">
                  <h4 className="font-black text-lg text-slate-900 mb-4 leading-tight">{analysis.title}</h4>
                  <div className="space-y-4">
                    {analysis.bulletPoints.map((bp, i) => (
                      <div key={i} className="flex gap-3 group">
                        <div className="flex-none w-6 h-6 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] font-bold group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          {i+1}
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{bp}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-4">
                    {Object.entries(analysis.productAttributes).map(([key, val]) => (
                      val && (
                        <div key={key} className="bg-slate-50 px-4 py-2 rounded-lg">
                          <p className="text-[10px] uppercase font-black text-slate-400">{key}</p>
                          <p className="text-sm font-bold text-slate-800">{val}</p>
                        </div>
                      )
                    ))}
                  </div>
                </AnalysisCard>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageConcepts.map((concept, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                      <span className="text-[10px] font-black text-orange-500 uppercase">Concept #{idx+1}</span>
                      <h5 className="font-bold text-slate-900 mb-2">{concept.mainTitle}</h5>
                      <p className="text-xs text-slate-500 mb-4 line-clamp-3">{concept.content}</p>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Visual Direction</p>
                        <p className="text-[11px] text-slate-700 italic leading-snug">{concept.designStrategy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Image Controls */}
            <section className="space-y-8">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">02</span>
                Image Generation & Variation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-100 mb-6">
                    {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-4" /> : <i className="fa-solid fa-camera text-4xl opacity-20"></i>}
                  </div>
                  <button 
                    onClick={() => handleGenerateMainImage('base')}
                    className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
                  >
                    Generate White Background Main
                  </button>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-100 mb-6">
                    {effectImage ? <img src={effectImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-palette text-4xl opacity-20"></i>}
                  </div>
                  <textarea 
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl mb-4 h-20 resize-none"
                    value={consistencyPrompt}
                    onChange={(e) => setConsistencyPrompt(e.target.value)}
                  />
                  <button 
                    onClick={() => handleGenerateMainImage('effect')}
                    className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all"
                  >
                    Apply Scene Variation
                  </button>
                </div>
              </div>
            </section>

            {/* 6-Image Series */}
            <section className="space-y-8">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">03</span>
                Infographic Selling Series
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {generatedImages.map((img) => (
                  <ImageGenerationBlock 
                    key={img.id} 
                    item={img} 
                    onUpdate={updateGeneratedItem}
                    onGenerate={handleGenerateStepImage}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center">
            <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center">
              <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-xl font-bold">Bypassing WAF...</h3>
              <p className="text-slate-500 text-sm">Searching web grounding for real ASIN data.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
