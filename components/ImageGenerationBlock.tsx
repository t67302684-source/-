
import React from 'react';
import { GeneratedImageItem } from '../types';

interface ImageGenerationBlockProps {
  item: GeneratedImageItem;
  onUpdate: (id: string, updates: Partial<GeneratedImageItem>) => void;
  onGenerate: (id: string) => void;
  onEdit: (id: string) => void;
}

export const ImageGenerationBlock: React.FC<ImageGenerationBlockProps> = ({ item, onUpdate, onGenerate, onEdit }) => {
  const isGenerating = item.status === 'generating';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
      <div className="relative aspect-square rounded-lg bg-slate-100 overflow-hidden group">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.mainTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                <span className="text-xs font-medium">正在生成...</span>
              </div>
            ) : (
              <>
                <i className="fa-regular fa-image text-4xl mb-2 opacity-50"></i>
                <span className="text-sm">点击按钮开始生成</span>
              </>
            )}
          </div>
        )}
        <div className="absolute top-2 right-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${item.type === 'selling-point' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                {item.type === 'selling-point' ? '卖点展示' : '细节特写'}
            </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">主标题</label>
          <input 
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            value={item.mainTitle}
            onChange={(e) => onUpdate(item.id, { mainTitle: e.target.value })}
            placeholder="例如：100% 纯棉..."
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">副标题</label>
          <input 
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            value={item.subTitle}
            onChange={(e) => onUpdate(item.id, { subTitle: e.target.value })}
            placeholder="补充说明文字..."
          />
        </div>
        
        {item.imageUrl && (
          <div className="pt-2 border-t border-slate-100">
            <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-1">AI 局部修改指令</label>
            <div className="flex gap-2">
              <input 
                className="flex-1 px-3 py-1.5 text-xs border border-orange-100 rounded bg-orange-50/30 focus:ring-1 focus:ring-orange-400 outline-none"
                value={item.editPrompt || ''}
                onChange={(e) => onUpdate(item.id, { editPrompt: e.target.value })}
                placeholder="例如：增加光影感、换成复古背景..."
                onKeyDown={(e) => e.key === 'Enter' && onEdit(item.id)}
              />
              <button 
                onClick={() => onEdit(item.id)}
                disabled={isGenerating || !item.editPrompt}
                className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded text-xs font-bold hover:bg-orange-200 disabled:opacity-50"
              >
                修改
              </button>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={() => onGenerate(item.id)}
        disabled={isGenerating}
        className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
          isGenerating 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
            : 'bg-slate-900 text-white hover:bg-black shadow-md active:scale-[0.98]'
        }`}
      >
        <i className="fa-solid fa-wand-magic-sparkles"></i>
        {item.imageUrl ? '重新生成全图' : '点击生成图片'}
      </button>
    </div>
  );
};
