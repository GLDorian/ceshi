
import React, { useState, useRef, useEffect } from 'react';
import { LibraryData, ProjectNode, ProjectFormNode, ProjectVariableNode, ProjectVersion, ProjectMeta, VariableLogic } from '../types.ts';
import { FileText, Plus, X, UploadCloud, Trash2, Save, History, Download, GripVertical, Table as TableIcon, ArrowUp, ArrowDown, ArrowLeft, Link2, Navigation, Check } from 'lucide-react';
import { generateWordDoc, generateExcel, generateChangeLogWord } from '../services/exportService.ts';
import { read, utils } from 'xlsx';

interface Props {
  library: LibraryData;
  setLibrary: React.Dispatch<React.SetStateAction<LibraryData>>;
  project: ProjectNode[];
  setProject: React.Dispatch<React.SetStateAction<ProjectNode[]>>;
  versions: ProjectVersion[];
  setVersions: React.Dispatch<React.SetStateAction<ProjectVersion[]>>;
  onBack: () => void;
  projectMeta: ProjectMeta;
}

interface TempVariable {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'radio';
  isHeader?: boolean;
}

interface DeleteTarget {
  type: 'visit' | 'form' | 'variable' | 'row';
  visitId: string;
  formInstanceId?: string;
  itemId?: string | number;
  displayName?: string;
}

const DocumentBuilder: React.FC<Props> = ({ library, setLibrary, project, setProject, versions, setVersions, onBack, projectMeta }) => {
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [sidebarTab, setSidebarTab] = useState('visits');
  const [highlightedFormId, setHighlightedFormId] = useState<string | null>(null);
  const [draggingFormIndex, setDraggingFormIndex] = useState<number | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isCustomFormModalOpen, setIsCustomFormModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [addRowTarget, setAddRowTarget] = useState<{ visitId: string; formInstanceId: string } | null>(null);
  const [newRowName, setNewRowName] = useState('');

  const [newVisitName, setNewVisitName] = useState('');
  const [newVisitId, setNewVisitId] = useState('');
  const [newVersionName, setNewVersionName] = useState('');

  const [customFormName, setCustomFormName] = useState('');
  const [customFormId, setCustomFormId] = useState('');
  const [customFormType, setCustomFormType] = useState('standard');
  const [customFormDefaultRows, setCustomFormDefaultRows] = useState('');
  const [tempVariables, setTempVariables] = useState<TempVariable[]>([]);
  
  const [newVarId, setNewVarId] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarType, setNewVarType] = useState('text');

  const [activeAddVarFormId, setActiveAddVarFormId] = useState<string | null>(null);
  const [inlineVarId, setInlineVarId] = useState('');
  const [inlineVarLabel, setInlineVarLabel] = useState('');
  const [inlineVarType, setInlineVarType] = useState('text');
  const [editingLogicVarId, setEditingLogicVarId] = useState<string | null>(null);

  useEffect(() => {
    if (project.length > 0 && !selectedVisitId) {
        setSelectedVisitId(project[0].visitId);
    }
  }, [project, selectedVisitId]);

  const scrollToForm = (instanceId: string) => {
      const element = document.getElementById(instanceId);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setHighlightedFormId(instanceId);
          setTimeout(() => setHighlightedFormId(null), 2000);
      }
  };

  const requestDelete = (target: DeleteTarget) => setDeleteTarget(target);
  const closeDeleteModal = () => setDeleteTarget(null);

  const executeDelete = () => {
    if (!deleteTarget) return;
    const { type, visitId, formInstanceId, itemId } = deleteTarget;

    setProject(prevProject => {
      const newProject = JSON.parse(JSON.stringify(prevProject));
      const vIdx = newProject.findIndex((v: any) => v.visitId === visitId);
      if (vIdx === -1) return prevProject;

      if (type === 'visit') {
        newProject.splice(vIdx, 1);
        if (selectedVisitId === visitId) setSelectedVisitId('');
      } else if (type === 'form' && formInstanceId) {
        newProject[vIdx].forms = newProject[vIdx].forms.filter((f: any) => f.instanceId !== formInstanceId);
      } else if (type === 'variable' && formInstanceId && typeof itemId === 'string') {
        const form = newProject[vIdx].forms.find((f: any) => f.instanceId === formInstanceId);
        if (form) form.variables = form.variables.filter((v: any) => v.variableId !== itemId);
      } else if (type === 'row' && formInstanceId && typeof itemId === 'number') {
        const form = newProject[vIdx].forms.find((f: any) => f.instanceId === formInstanceId);
        if (form && form.rows) form.rows.splice(itemId, 1);
      }
      return newProject;
    });
    closeDeleteModal();
  };

  const handleAddVisit = () => {
    if (!newVisitId.trim() || !newVisitName.trim()) return;
    if (project.some(v => v.visitId === newVisitId.trim())) return alert("ID 已存在");
    const newVisit: ProjectNode = {
      visitId: newVisitId.trim(),
      visitName: newVisitName.trim(),
      order: project.length + 1,
      forms: []
    };
    setProject(prev => [...prev, newVisit]);
    setNewVisitId(''); setNewVisitName(''); setIsVisitModalOpen(false);
    setSelectedVisitId(newVisit.visitId);
  };

  const handleSaveVersion = () => {
    if (!newVersionName.trim()) return;
    setVersions(prev => [{
      versionName: newVersionName,
      timestamp: Date.now(),
      project: JSON.parse(JSON.stringify(project)),
      library: JSON.parse(JSON.stringify(library))
    }, ...prev]);
    setNewVersionName('');
  };

  const handleRestoreVersion = (v: ProjectVersion) => {
    if (confirm(`恢复 "${v.versionName}"?`)) {
      setProject(v.project); setLibrary(v.library);
      setIsVersionModalOpen(false);
    }
  };

  const handleImportExcelStructure = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
      if (data.length < 3) return alert("格式错误");

      const visitIds = data[1].slice(2);
      const visitNames = data[0].slice(2);
      const newVisits: ProjectNode[] = [];
      const missingIds = new Set<string>();

      visitIds.forEach((id, i) => {
        // Fix: Remove non-existent 'Bird' property from ProjectNode object literal during Excel import
        if (id) newVisits.push({ visitId: String(id), visitName: String(visitNames[i] || id), order: i, forms: [] });
      });

      for (let r = 2; r < data.length; r++) {
        const formName = String(data[r][0]);
        const formId = String(data[r][1]);
        const template = library.forms.find(f => f.id === formId);
        if (!template) { missingIds.add(formId); continue; }

        newVisits.forEach((v, i) => {
          if (data[r][i+2]) {
            v.forms.push({
              instanceId: `${formId}_${Date.now()}_${Math.random()}`,
              formId: formId,
              customFormName: formName || template.name,
              rows: template.defaultRows ? [...template.defaultRows] : [],
              variables: [...(template.variableIds || []), ...(template.headerVariableIds || [])].map(vid => ({
                variableId: vid, customLabel: library.variables.find(v => v.id === vid)?.label || vid, included: true
              }))
            });
          }
        });
      }
      setProject(newVisits);
      let msg = `导入完成！`;
      if (missingIds.size > 0) msg += `\n注意：库中缺失 ID: ${Array.from(missingIds).join(', ')}`;
      alert(msg);
    } catch (err) { alert("导入失败"); }
  };

  const handleCreateCustomForm = () => {
    if(!customFormId || !customFormName) return;
    const newLibVars = [...library.variables];
    tempVariables.forEach(tv => {
        if (!newLibVars.find(v => v.id === tv.id)) newLibVars.push({ id: tv.id, label: tv.label, type: tv.type });
    });
    const newForm = {
        id: customFormId, name: customFormName, type: customFormType as any,
        variableIds: tempVariables.filter(v => !v.isHeader).map(v => v.id),
        headerVariableIds: tempVariables.filter(v => v.isHeader).map(v => v.id),
        defaultRows: customFormDefaultRows.split(/[,\n]/).map(s => s.trim()).filter(s => s)
    };
    setLibrary({ ...library, variables: newLibVars, forms: [...library.forms, newForm] });
    setIsCustomFormModalOpen(false); setTempVariables([]);
  };

  const selectedVisit = project.find(v => v.visitId === selectedVisitId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* 顶部工具栏 */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold">{projectMeta.name}</h1>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={12}/> 已同步</span>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={excelInputRef} hidden onChange={handleImportExcelStructure} />
          <button onClick={() => excelInputRef.current?.click()} className="px-3 py-1.5 text-sm bg-white border rounded shadow-sm flex items-center gap-2"><UploadCloud size={16}/> 导入架构</button>
          <button onClick={() => setIsVersionModalOpen(true)} className="px-3 py-1.5 text-sm bg-white border rounded flex items-center gap-2"><History size={16}/> 历史</button>
          <button onClick={() => generateWordDoc(project, library)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded flex items-center gap-2"><FileText size={16}/> 导出 Word</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 */}
        <div className="w-72 bg-white border-r flex flex-col">
          <div className="flex border-b">
            <button onClick={() => setSidebarTab('visits')} className={`flex-1 py-3 text-sm ${sidebarTab === 'visits' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>访视</button>
            <button onClick={() => setSidebarTab('forms')} className={`flex-1 py-3 text-sm ${sidebarTab === 'forms' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>模板</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sidebarTab === 'visits' ? (
              <>
                <button onClick={() => setIsVisitModalOpen(true)} className="w-full py-2 border-2 border-dashed rounded text-blue-600 text-sm font-bold">+ 新增访视</button>
                {project.map(v => (
                  <div key={v.visitId} onClick={() => setSelectedVisitId(v.visitId)} className={`p-3 rounded-lg border cursor-pointer ${selectedVisitId === v.visitId ? 'border-blue-500 bg-blue-50 shadow-sm' : 'bg-white hover:border-blue-200'}`}>
                    <div className="font-bold text-sm">{v.visitName}</div>
                    <div className="text-[10px] text-slate-400">{v.visitId} · {v.forms.length} 表单</div>
                  </div>
                ))}
              </>
            ) : (
              library.forms.map(f => (
                <div key={f.id} className="p-3 bg-white border rounded-lg hover:border-indigo-400 cursor-pointer" onClick={() => {
                  if(!selectedVisitId) return alert("请先选访视");
                  setProject(prev => prev.map(v => v.visitId === selectedVisitId ? {
                    ...v, forms: [...v.forms, {
                      instanceId: `${f.id}_${Date.now()}`, formId: f.id, customFormName: f.name, rows: [...(f.defaultRows || [])],
                      variables: [...(f.variableIds || []), ...(f.headerVariableIds || [])].map(vid => ({ variableId: vid, customLabel: library.variables.find(lv => lv.id === vid)?.label || vid, included: true }))
                    }]
                  } : v));
                }}>
                  <div className="font-bold text-sm">{f.name}</div>
                  <div className="text-[10px] text-slate-400">{f.id}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 主画布 */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
          {selectedVisit ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">{selectedVisit.visitName} <span className="text-sm font-mono text-slate-400">({selectedVisit.visitId})</span></h2>
              {selectedVisit.forms.map((f, idx) => (
                <div key={f.instanceId} id={f.instanceId} className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center"><FileText size={20}/></div>
                      <input className="font-bold text-lg bg-transparent border-b border-transparent focus:border-blue-300 outline-none" value={f.customFormName} onChange={e => {
                        const val = e.target.value;
                        setProject(prev => prev.map(v => v.visitId === selectedVisitId ? { ...v, forms: v.forms.map(form => form.instanceId === f.instanceId ? { ...form, customFormName: val } : form) } : v));
                      }} />
                    </div>
                    <button onClick={() => requestDelete({ type: 'form', visitId: selectedVisitId, formInstanceId: f.instanceId, displayName: f.customFormName })} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                  
                  <div className="space-y-2">
                    {f.variables.map(v => (
                      <div key={v.variableId} className="p-3 bg-slate-50 rounded border flex items-center justify-between group">
                        <div className="flex-1">
                          <div className="text-[10px] text-slate-400 font-mono mb-1">{v.variableId}</div>
                          <input className="w-full text-sm font-medium bg-transparent border-none outline-none focus:text-blue-600" value={v.customLabel} onChange={e => {
                             const val = e.target.value;
                             setProject(prev => prev.map(vn => vn.visitId === selectedVisitId ? { ...vn, forms: vn.forms.map(fn => fn.instanceId === f.instanceId ? { ...fn, variables: fn.variables.map(vr => vr.variableId === v.variableId ? { ...vr, customLabel: val } : vr) } : fn) } : vn));
                          }} />
                        </div>
                        <button onClick={() => requestDelete({ type: 'variable', visitId: selectedVisitId, formInstanceId: f.instanceId, itemId: v.variableId, displayName: v.customLabel })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Navigation size={48} className="mb-4 opacity-20" />
              <p>请选择一个访视节点开始编辑</p>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认框 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl w-96 shadow-2xl text-center">
            <h3 className="text-xl font-bold mb-4">确认删除？</h3>
            <p className="text-slate-500 mb-6 italic">"{deleteTarget.displayName}"</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-slate-100 rounded-lg">取消</button>
              <button onClick={executeDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增访视弹窗 */}
      {isVisitModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl w-96 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">新增访视节点</h3>
            <div className="space-y-4">
              <input className="w-full p-2 border rounded" placeholder="访视 ID (如 V1)" value={newVisitId} onChange={e => setNewVisitId(e.target.value.toUpperCase())} />
              <input className="w-full p-2 border rounded" placeholder="访视名称" value={newVisitName} onChange={e => setNewVisitName(e.target.value)} />
              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setIsVisitModalOpen(false)} className="px-4 py-2">取消</button>
                <button onClick={handleAddVisit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentBuilder;
