import React, { useState } from 'react';
import { LibraryData } from '../types';
import { Database, CheckSquare, Square } from 'lucide-react';

interface Props {
  library: LibraryData;
  setLibrary: React.Dispatch<React.SetStateAction<LibraryData>>;
}

const LibraryManager: React.FC<Props> = ({ library, setLibrary }) => {
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  
  // 切换表单中的变量关联
  const toggleVarInForm = (formId: string, varId: string) => {
    setLibrary(prev => ({
      ...prev,
      forms: prev.forms.map(f => {
        if (f.id !== formId) return f;
        const exists = f.variableIds.includes(varId);
        return {
          ...f,
          variableIds: exists 
            ? f.variableIds.filter(v => v !== varId) 
            : [...f.variableIds, varId]
        };
      })
    }));
  };

  const selectedForm = library.forms.find(f => f.id === selectedFormId);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
      {/* 顶部标题栏 */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800 mb-4">
          <Database size={20} className="text-blue-600" />
          模板库维护
        </h2>
        
        {/* 表单选择下拉框 */}
        <div className="max-w-xl">
            <label className="block text-sm font-medium text-slate-500 mb-1">选择要配置的表单模板</label>
            <select 
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
            >
                <option value="">-- 请选择表单 --</option>
                {library.forms.map(form => (
                    <option key={form.id} value={form.id}>
                        {form.name} ({form.id})
                    </option>
                ))}
            </select>
        </div>
      </div>

      {/* 主配置区域 */}
      <div className="p-6 overflow-hidden flex-1 flex flex-col">
        {!selectedForm ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Database size={48} className="mb-4 opacity-20" />
            <p>请从上方下拉菜单选择一个表单以开始维护字段。</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="mb-4 flex justify-between items-end">
                 <div>
                    <h3 className="text-xl font-bold text-slate-800">{selectedForm.name}</h3>
                    <span className="text-sm text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">ID: {selectedForm.id}</span>
                 </div>
                 <div className="text-sm text-slate-500">
                     当前包含: <span className="font-bold text-blue-600">{selectedForm.variableIds.length}</span> 个变量
                 </div>
             </div>

             <div className="bg-slate-50 border border-slate-200 rounded-lg flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide flex">
                    <div className="w-12 text-center">状态</div>
                    <div className="w-24">变量ID</div>
                    <div className="flex-1">默认标签</div>
                    <div className="w-20">类型</div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {library.variables.map(v => {
                        const isChecked = selectedForm.variableIds.includes(v.id);
                        return (
                            <label 
                                key={v.id} 
                                className={`flex items-center p-2 rounded cursor-pointer transition-colors border ${
                                    isChecked 
                                    ? 'bg-blue-50 border-blue-200' 
                                    : 'hover:bg-white border-transparent hover:border-slate-200'
                                }`}
                            >
                                <div className="w-12 flex justify-center flex-shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => toggleVarInForm(selectedForm.id, v.id)}
                                        className="hidden" // 隐藏原生checkbox，使用自定义图标
                                    />
                                    {isChecked ? (
                                        <CheckSquare className="text-blue-600" size={20} />
                                    ) : (
                                        <Square className="text-slate-300" size={20} />
                                    )}
                                </div>
                                <div className="w-24 text-xs font-mono text-slate-500 truncate flex-shrink-0">{v.id}</div>
                                <div className={`flex-1 text-sm font-medium truncate pr-4 ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>
                                    {v.label}
                                </div>
                                <div className="w-20 text-xs text-slate-400 flex-shrink-0">
                                    {v.type}
                                </div>
                            </label>
                        );
                    })}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryManager;