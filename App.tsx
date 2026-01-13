
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

  const gemini = new GeminiService();

  const handleAnalyze = async () => {
    if (!asinInput) return;
    setLoading(true);
    setAnalysis(null);
    setGroundingSources([]);
    
    try {
      // 1. 获取真实 Listing 数据（带搜索证据）
      const { data, sources } = await gemini.analyzeListing(asinInput);
      setAnalysis(data);
      setGroundingSources(sources);
      
      // 2. 提取图片策划思路
      const concepts = await gemini.generateImageAnalysis(data);
      setImageConcepts(concepts);

      // 3. 预设 6 张生成任务
      const initialGenerated: GeneratedImageItem[] = [
        ...Array(3).fill(null).map((_, i) => ({
          id: `sp-${i}`,
          type: 'selling-point' as const,
          mainTitle: data.bulletPoints[i]?.split(/[:：]/)[0] || 'Key Feature',
          subTitle: 'Market Leading Design',
          content: data.bulletPoints[i] || 'Analysis of competitive advantage for this SKU.',
          status: 'idle' as const
        })),
        ...Array(3).fill(null).map((_, i) => ({
          id: `dt-${i}`,
          type: 'detail' as const,
          mainTitle: 'Precision Detail',
          subTitle: `Focus on ${data.productAttributes.material || 'Quality'}`,
          content: 'Close-up showcasing texture, assembly quality, and material finish.',
          status: 'idle' as const
        }))
      ];
      setGeneratedImages(initialGenerated);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. The model couldn't reach Amazon servers. Try providing the full product title instead of just the ASIN.");
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
      alert("Image generation failed. Try a simpler prompt.");
    }
  };

  const handleGenerateStepImage = async (id: string) => {
    const item = generatedImages.find(i => i.id === id);
    if (!item || !analysis) return;

    setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
    
    try {
      const prompt = `Amazon infographic, ${analysis.title}. Focus: ${item.mainTitle}. Style: clean layout, high contrast, commercial quality. ${item.content}`;
      const url = await gemini.generateProductImage(prompt);
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done' } : i));
    } catch (e) {
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'idle' } : i));
      alert("Generation limit reached or content blocked.");
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
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Competitor Intel & Gen-AI</p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <div className="relative flex-1 sm:w-96">
              <i className="fa-solid fa-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                className="w-full pl-10 pr-4 py-3 bg-slate-100 border-2 border-transparent rounded-xl focus:border-orange-500 focus:bg-white outline-none text-sm transition-all"
                placeholder="Paste ASIN (e.g. B0CZ8X...) or URL"
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
                <span className="text-xs text-blue-700 font-medium">Verified using live data from {groundingSources.length} sources</span>
              </div>
            )}

            {/* Section 1: Listing Intelligence */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">01</span>
                  Competitor Intelligence
                </h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalysisCard title="Listing Copy Analysis" icon="fa-solid fa-file-lines">
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
                  <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-6">
                    <div className="bg-slate-50 px-4 py-2 rounded-lg">
                      <p className="text-[10px] uppercase font-black text-slate-400">Material</p>
                      <p className="text-sm font-bold text-slate-800">{analysis.productAttributes.material || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-lg">
                      <p className="text-[10px] uppercase font-black text-slate-400">Color</p>
                      <p className="text-sm font-bold text-slate-800">{analysis.productAttributes.color || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-lg">
                      <p className="text-[10px] uppercase font-black text-slate-400">Size</p>
                      <p className="text-sm font-bold text-slate-800">{analysis.productAttributes.size || 'N/A'}</p>
                    </div>
                  </div>
                </AnalysisCard>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageConcepts.map((concept) => (
                    <div key={concept.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black text-orange-500 uppercase">Image Plan #{concept.id}</span>
                        <i className="fa-solid fa-lightbulb text-slate-200 group-hover:text-orange-300 transition-colors"></i>
                      </div>
                      <h5 className="font-bold text-slate-900 mb-2">{concept.mainTitle}</h5>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed line-clamp-3">{concept.content}</p>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Visual Strategy</p>
                        <p className="text-[11px] text-slate-700 italic leading-snug">{concept.designStrategy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 2: Consistency & Base */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">02</span>
                Consistency & Style Control
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center relative border border-slate-100 mb-6">
                    {baseImage ? (
                      <img src={baseImage} className="w-full h-full object-contain p-4" />
                    ) : (
                      <div className="text-center opacity-30">
                        <i className="fa-solid fa-camera-retro text-6xl mb-4"></i>
                        <p className="text-sm font-bold">Ready to generate base</p>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold mb-2">Clean Main Image</h3>
                    <p className="text-sm text-slate-500 mb-6 px-4">Generate a distraction-free white background image for your listing.</p>
                    <button 
                      onClick={() => handleGenerateMainImage('base')}
                      className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-wand-sparkles"></i>
                      Generate Base Product
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center relative border border-slate-100 mb-6">
                    {effectImage ? (
                      <img src={effectImage} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center opacity-30">
                        <i className="fa-solid fa-couch text-6xl mb-4"></i>
                        <p className="text-sm font-bold">Ready for lifestyle preview</p>
                      </div>
                    )}
                  </div>
                  <div className="mb-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Scene Context & Consistency</label>
                    <textarea 
                      className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none font-medium"
                      value={consistencyPrompt}
                      onChange={(e) => setConsistencyPrompt(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => handleGenerateMainImage('effect')}
                    className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-palette"></i>
                    Apply Scene & Generate
                  </button>
                </div>
              </div>
            </section>

            {/* Section 3: Infographic Series */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">03</span>
                The 6-Image Selling Series
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

        {/* Empty State */}
        {!analysis && !loading && (
          <div className="max-w-2xl mx-auto py-24 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-xl border border-slate-100 mb-8">
              <i className="fa-solid fa-magnifying-glass-chart text-4xl text-orange-500"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Intelligence Starts Here</h2>
            <p className="text-slate-500 text-lg mb-8 leading-relaxed">
              Enter any Amazon ASIN or product URL. Our AI will bypass anti-scraping measures using Google Grounding to extract REAL listing data and generate high-conversion creative assets.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-2"><i className="fa-solid fa-check text-green-500"></i> Real-time Analysis</span>
              <span className="flex items-center gap-2"><i className="fa-solid fa-check text-green-500"></i> Copywriting Extraction</span>
              <span className="flex items-center gap-2"><i className="fa-solid fa-check text-green-500"></i> Image Series Gen</span>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl scale-in-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Analyzing ASIN...</h3>
              <p className="text-slate-500 text-sm mb-6">
                Using Google Search Grounding to bypass Amazon WAF and retrieve verified listing data.
              </p>
              <div className="flex justify-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Status Bar */}
      {analysis && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-8 z-50 animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center gap-3 pr-8 border-r border-white/10">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Session</span>
          </div>
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-tag text-orange-500"></i>
            <span className="text-sm font-bold tracking-tight">{asinInput.toUpperCase()}</span>
          </div>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-orange-500 transition-colors flex items-center justify-center text-xs"
          >
            <i className="fa-solid fa-chevron-up"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
