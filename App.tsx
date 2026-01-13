
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
  const [consistencyPrompt, setConsistencyPrompt] = useState('Keep product design identical but set in a luxury home environment');

  const gemini = new GeminiService();

  useEffect(() => {
    // 启动检查
    const key = (import.meta as any).env?.VITE_API_KEY || (process as any).env?.API_KEY;
    if (!key) {
      setConfigError("Missing API_KEY. Please add VITE_API_KEY to your Vercel project environment variables.");
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
          mainTitle: result.data.bulletPoints[i]?.split(/[:：]/)[0] || 'Key Feature',
          subTitle: 'Premium Benefit',
          content: result.data.bulletPoints[i] || 'Selling point description.',
          status: 'idle' as const
        })),
        ...Array(3).fill(null).map((_, i) => ({
          id: `dt-${i}`,
          type: 'detail' as const,
          mainTitle: 'Product Detail',
          subTitle: `Material: ${result.data.productAttributes.material || 'Premium'}`,
          content: 'Close-up shot showing high-quality finishing.',
          status: 'idle' as const
        }))
      ];
      setGeneratedImages(initialGenerated);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMainImage = async (type: 'base' | 'effect') => {
    if (!analysis) return;
    const prompt = type === 'base' 
      ? `Professional product photography, ${analysis.title}, pure white background, 8k`
      : `Lifestyle photography of ${analysis.title}, ${consistencyPrompt}, 8k`;
    
    try {
      if (type === 'base') setBaseImage(null); else setEffectImage(null);
      const url = await gemini.generateProductImage(prompt);
      if (type === 'base') setBaseImage(url); else setEffectImage(url);
    } catch (e) {
      alert("Image failed: API limit or safety block.");
    }
  };

  const handleGenerateStepImage = async (id: string) => {
    const item = generatedImages.find(i => i.id === id);
    if (!item || !analysis) return;
    setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'generating' } : i));
    try {
      const prompt = `Amazon infographic, ${analysis.title}. Focus on: ${item.mainTitle}. ${item.content}`;
      const url = await gemini.generateProductImage(prompt);
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, imageUrl: url, status: 'done' } : i));
    } catch (e) {
      setGeneratedImages(prev => prev.map(i => i.id === id ? { ...i, status: 'idle' } : i));
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {configError && (
        <div className="bg-red-600 text-white p-2 text-center text-xs font-bold animate-pulse">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>
          {configError}
        </div>
      )}
      
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              <i className="fa-brands fa-amazon"></i>
            </div>
            <h1 className="text-xl font-black text-slate-900">AMZ VISUAL AI</h1>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <input 
              className="flex-1 sm:w-80 px-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              placeholder="Paste ASIN (e.g. B0CZ8X...)"
              value={asinInput}
              onChange={(e) => setAsinInput(e.target.value)}
            />
            <button 
              onClick={handleAnalyze}
              disabled={loading || !!configError}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-all"
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-bolt mr-2"></i>}
              Analyze
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-12">
        {analysis ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <AnalysisCard title="Listing Intelligence" icon="fa-solid fa-brain">
                <h4 className="font-bold text-slate-900 mb-4">{analysis.title}</h4>
                <div className="space-y-3">
                  {analysis.bulletPoints.map((bp, i) => (
                    <p key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-orange-500">•</span> {bp}
                    </p>
                  ))}
                </div>
              </AnalysisCard>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {imageConcepts.map((c, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h5 className="font-bold text-sm text-orange-600 mb-1">{c.mainTitle}</h5>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{c.content}</p>
                    <div className="text-[10px] bg-slate-50 p-2 rounded italic text-slate-400">
                      Dir: {c.designStrategy}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
                <div className="aspect-square bg-slate-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                  {baseImage ? <img src={baseImage} className="w-full h-full object-contain p-4" /> : <i className="fa-regular fa-image text-4xl text-slate-200"></i>}
                </div>
                <button onClick={() => handleGenerateMainImage('base')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">Generate White Background</button>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <div className="aspect-square bg-slate-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                  {effectImage ? <img src={effectImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-wand-sparkles text-4xl text-slate-200"></i>}
                </div>
                <textarea className="w-full p-3 text-xs bg-slate-50 border border-slate-100 rounded-lg mb-4 h-16 resize-none" value={consistencyPrompt} onChange={(e) => setConsistencyPrompt(e.target.value)} />
                <button onClick={() => handleGenerateMainImage('effect')} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm">Apply Context Variation</button>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedImages.map((img) => (
                <ImageGenerationBlock key={img.id} item={img} onUpdate={(id, up) => setGeneratedImages(prev => prev.map(i => i.id === id ? {...i, ...up} : i))} onGenerate={handleGenerateStepImage} />
              ))}
            </section>
          </>
        ) : (
          <div className="py-20 text-center text-slate-400">
            <i className="fa-solid fa-search text-6xl mb-6 opacity-20"></i>
            <h2 className="text-2xl font-bold">Ready to analyze</h2>
            <p className="text-sm">Enter an ASIN above to extract data and generate visuals.</p>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-bold">Analyzing Competition...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
