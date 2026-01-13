
import React from 'react';
import { GeneratedImageItem } from '../types';

interface ImageGenerationBlockProps {
  item: GeneratedImageItem;
  onUpdate: (id: string, updates: Partial<GeneratedImageItem>) => void;
  onGenerate: (id: string) => void;
}

export const ImageGenerationBlock: React.FC<ImageGenerationBlockProps> = ({ item, onUpdate, onGenerate }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
      <div className="relative aspect-square rounded-lg bg-slate-100 overflow-hidden group">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.mainTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            {item.status === 'generating' ? (
              <div className="flex flex-col items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                <span className="text-xs font-medium">Generating...</span>
              </div>
            ) : (
              <>
                <i className="fa-regular fa-image text-4xl mb-2 opacity-50"></i>
                <span className="text-sm">Click Generate to create</span>
              </>
            )}
          </div>
        )}
        <div className="absolute top-2 right-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${item.type === 'selling-point' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                {item.type.replace('-', ' ')}
            </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Main Title</label>
          <input 
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            value={item.mainTitle}
            onChange={(e) => onUpdate(item.id, { mainTitle: e.target.value })}
            placeholder="Main feature name..."
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Subtitle</label>
          <input 
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            value={item.subTitle}
            onChange={(e) => onUpdate(item.id, { subTitle: e.target.value })}
            placeholder="Secondary description..."
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Content/Script</label>
          <textarea 
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all h-20 resize-none"
            value={item.content}
            onChange={(e) => onUpdate(item.id, { content: e.target.value })}
            placeholder="Detailed selling points..."
          />
        </div>
      </div>

      <button 
        onClick={() => onGenerate(item.id)}
        disabled={item.status === 'generating'}
        className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
          item.status === 'generating' 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
            : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-100 active:scale-[0.98]'
        }`}
      >
        <i className="fa-solid fa-wand-magic-sparkles"></i>
        {item.imageUrl ? 'Regenerate' : 'Generate'}
      </button>
    </div>
  );
};
