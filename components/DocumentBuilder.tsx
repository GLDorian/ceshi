import React, { useState, useRef, useEffect } from 'react';
import { LibraryData, ProjectNode, ProjectFormNode, ProjectVariableNode, ProjectVersion, ProjectMeta, VariableLogic } from '../types';
import { FileText, Plus, Wand2, X, UploadCloud, Trash2, List, Save, Check, History, FileDiff, Download, GripVertical, Table as TableIcon, ArrowUp, ArrowDown, ArrowLeft, Link2, Navigation } from 'lucide-react';
import { polishText } from '../services/geminiService';
import { generateWordDoc, generateExcel, generateChangeLogWord } from '../services/exportService';
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
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
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
  const [newVarIsHeader, setNewVarIsHeader] = useState(false);

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
      const visitIndex = newProject.findIndex((v: any) => v.visitId === visitId);
      if (visitIndex === -1) return prevProject;

      if (type === 'visit') {
        newProject.splice(visitIndex, 1);
        if (selectedVisitId === visitId) setSelectedVisitId('');
      } else if (type === 'form' && formInstanceId) {
        const forms = newProject[visitIndex].forms;
        const formIndex = forms.findIndex((f: any) => f.instanceId === formInstanceId);
        if (formIndex !== -1) forms.splice(formIndex, 1);
      } else if (type === 'variable' && formInstanceId && typeof itemId === 'string') {
        const forms = newProject[visitIndex].forms;
        const form = forms.find((f: any) => f.instanceId === formInstanceId);
        if (form) form.variables = form.variables.filter((v: any) => v.variableId !== itemId);
      } else if (type === 'row' && formInstanceId && typeof itemId === 'number') {
        const forms = newProject[visitIndex].forms;
        const form = forms.find((f: any) => f.instanceId === formInstanceId);
        if (form && form.rows) form.rows.splice(itemId, 1);
      }
      return newProject;
    });
    closeDeleteModal();
  };

  const handleAddVisit = () => {
    if (!newVisitId.trim() || !newVisitName.trim()) return;
    if (project.some(v => v.visitId === newVisitId.trim())) {
      alert(`访视ID "${newVisitId}" 已存在`);
      return;
    }
    const newVisit: ProjectNode = {
      visitId: newVisitId.trim(),
      visitName: newVisitName.trim(),
      order: project.length + 1,
      forms: []
    };
    setProject(prev => [...prev, newVisit]);
    setNewVisitId('');
    setNewVisitName('');
    setIsVisitModalOpen(false);
    setSelectedVisitId(newVisit.visitId);
  };

  const handleSaveVersion = () => {
    if (!newVersionName.trim()) return;
    const newVersion: ProjectVersion = {
      versionName: newVersionName.trim(),
      timestamp: Date.now(),
      project: JSON.parse(JSON.stringify(project)),
      library: JSON.parse(JSON.stringify(library))
    };
    setVersions(prev => [newVersion, ...prev]);
    setNewVersionName('');
  };

  const handleRestoreVersion = (v: ProjectVersion) => {
    if (window.confirm(`确定要恢复版本 "${v.versionName}" 吗？`)) {
      setProject(v.project);
      setLibrary(v.library);
      setIsVersionModalOpen(false);
      if (v.project.length > 0) setSelectedVisitId(v.project[0].visitId);
    }
  };

  const handleCompareVersion = (oldVersion: ProjectVersion) => {
    const currentSnapshot: ProjectVersion = { versionName: '当前草稿', timestamp: Date.now(), project: project, library: library };
    generateChangeLogWord(currentSnapshot, oldVersion);
  };

  const handleUpdateVariableLogic = (visitId: string, formInstanceId: string, variableId: string, logic?: VariableLogic) => {
      setProject(prev => {
          const newProject = JSON.parse(JSON.stringify(prev));
          const v = newProject.find((p: any) => p.visitId === visitId);
          const f = v?.forms.find((fm: any) => fm.instanceId === formInstanceId);
          const variable = f?.variables.find((vr: any) => vr.variableId === variableId);
          if (variable) variable.logic = logic;
          return newProject;
      });
  };

  const getAvailableLogicTriggers = (visitId: string, formInstanceId: string, currentVarId: string) => {
      const visit = project.find(v => v.visitId === visitId);
      const form = visit?.forms.find(f => f.instanceId === formInstanceId);
      if (!form) return [];
      return form.variables.filter(v => {
          if (v.variableId === currentVarId) return false;
          const template = library.variables.find(t => t.id === v.variableId);
          return template && (template.type === 'select' || template.type === 'radio');
      });
  };

  const getOptionsForTrigger = (visitId: string, formInstanceId: string, triggerId: string) => {
      const visit = project.find(v => v.visitId === visitId);
      const form = visit?.forms.find(f => f.instanceId === formInstanceId);
      const varInstance = form?.variables.find(v => v.variableId === triggerId);
      if (varInstance && varInstance.customOptions && varInstance.customOptions.length > 0) return varInstance.customOptions;
      const template = library.variables.find(v => v.id === triggerId);
      return template?.options || [];
  };

  const handleImportExcelStructure = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

      if (!data || data.length < 3) {
        alert("Excel 格式错误：需包含访视名（R1）、访视ID（R2）、表单定义（R3+）");
        return;
      }

      const visitIdRow = data[1];
      const visitNameRow = data[0];
      const newVisits: ProjectNode[] = [];
      const colIndexToVisitId = new Map<number, string>();
      const missingFormIds = new Set<string>(); // 用于追踪库中不存在的 ID

      for (let c = 2; c < visitIdRow.length; c++) {
        const vId = String(visitIdRow[c] || "").trim();
        if (vId) {
          const vName = String(visitNameRow?.[c] || vId).trim();
          colIndexToVisitId.set(c, vId);
          if (!newVisits.some(v => v.visitId === vId)) {
             newVisits.push({ visitId: vId, visitName: vName, order: newVisits.length + 1, forms: [] });
          }
        }
      }

      let importedCount = 0;
      for (let r = 2; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length < 2) continue;
        const formId = String(row[1] || "").trim(); // B列
        const formName = String(row[0] || "").trim(); // A列
        if (!formId) continue;

        const template = library.forms.find(f => f.id === formId);
        if (!template) {
          missingFormIds.add(formId); // 记录库中找不到的表单
          continue;
        }

        colIndexToVisitId.forEach((vId, colIdx) => {
           if (String(row[colIdx] || "").trim()) {
               const visitNode = newVisits.find(v => v.visitId === vId);
               if (visitNode && !visitNode.forms.some(f => f.formId === formId)) {
                 visitNode.forms.push({
                   instanceId: `${formId}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                   formId: formId,
                   customFormName: formName || template.name, // A列优先
                   rows: template.defaultRows ? [...template.defaultRows] : [],
                   variables: [
                     ...(template.variableIds || []),
                     ...(template.headerVariableIds || [])
                   ].map(vid => ({
                       variableId: vid,
                       customLabel: library.variables.find(v => v.id === vid)?.label || vid,
                       included: true
                   }))
                 });
                 importedCount++;
               }
           }
        });
      }

      if (newVisits.length > 0) {
          setProject(newVisits);
          setSelectedVisitId(newVisits[0].visitId);
      }

      let finishMsg = `导入成功！共处理 ${newVisits.length} 个访视，${importedCount} 个表单实例。`;
      if (missingFormIds.size > 0) {
        finishMsg += `\n\n警告：以下表单 ID 在库中未找到，已跳过导入：\n${Array.from(missingFormIds).join(', ')}`;
      }
      alert(finishMsg);

    } catch (error: any) {
      alert(`导入失败: ${error.message}`);
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handleExportBackup = () => {
    const fileData = { meta: { ...projectMeta, lastModified: Date.now() }, data: { project, library, versions } };
    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectMeta.name.replace(/[^a-z0-9]/gi, '_')}_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const handleMoveVisitUp = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index <= 0) return;
    setProject(prev => {
        const newProject = JSON.parse(JSON.stringify(prev));
        [newProject[index - 1], newProject[index]] = [newProject[index], newProject[index - 1]];
        newProject.forEach((v: any, i: number) => v.order = i + 1);
        return newProject;
    });
  };

  const handleMoveVisitDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setProject(prev => {
        if (index >= prev.length - 1) return prev;
        const newProject = JSON.parse(JSON.stringify(prev));
        [newProject[index], newProject[index + 1]] = [newProject[index + 1], newProject[index]];
        newProject.forEach((v: any, i: number) => v.order = i + 1);
        return newProject;
    });
  };

  const handleMoveFormUp = (e: React.MouseEvent, visitId: string, index: number) => {
    e.stopPropagation();
    if (index <= 0) return;
    setProject(prev => {
        const newProject = JSON.parse(JSON.stringify(prev));
        const v = newProject.find((v: any) => v.visitId === visitId);
        if (v) {
            const f = v.forms;
            [f[index - 1], f[index]] = [f[index], f[index - 1]];
        }
        return newProject;
    });
  };

  const handleMoveFormDown = (e: React.MouseEvent, visitId: string, index: number) => {
    e.stopPropagation();
    setProject(prev => {
        const newProject = JSON.parse(JSON.stringify(prev));
        const v = newProject.find((v: any) => v.visitId === visitId);
        if (v && index < v.forms.length - 1) {
            const f = v.forms;
            [f[index], f[index + 1]] = [f[index + 1], f[index]];
        }
        return newProject;
    });
  };
  
  const handleOutlineDragStart = (e: React.DragEvent, index: number) => {
    setDraggingFormIndex(index);
    e.dataTransfer.setData('index', index.toString());
  };

  const handleOutlineDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggingFormIndex === null || draggingFormIndex === targetIndex) return;
    setProject(prev => {
        const newProject = JSON.parse(JSON.stringify(prev));
        const v = newProject.find((v: any) => v.visitId === selectedVisitId);
        if (v) {
            const f = v.forms;
            const [moved] = f.splice(draggingFormIndex, 1);
            f.splice(targetIndex, 0, moved);
        }
        return newProject;
    });
    setDraggingFormIndex(null);
  };

  const handleMoveVariable = (e: React.MouseEvent, visitId: string, formInstanceId: string, variableId: string, direction: 'up' | 'down') => {
      e.stopPropagation();
      setProject(prev => {
          const newProject = JSON.parse(JSON.stringify(prev));
          const visit = newProject.find((v: any) => v.visitId === visitId);
          const form = visit?.forms.find((f: any) => f.instanceId === formInstanceId);
          if (!form) return prev;
          
          const curIdx = form.variables.findIndex((v: any) => v.variableId === variableId);
          if (direction === 'up' && curIdx > 0) {
            [form.variables[curIdx], form.variables[curIdx - 1]] = [form.variables[curIdx - 1], form.variables[curIdx]];
          } else if (direction === 'down' && curIdx < form.variables.length - 1) {
            [form.variables[curIdx], form.variables[curIdx + 1]] = [form.variables[curIdx + 1], form.variables[curIdx]];
          }
          return newProject;
      });
  };

  const handleCreateCustomForm = () => {
    if(!customFormId.trim() || !customFormName.trim()) return;
    const newFormId = customFormId.trim();
    const newLibVars = [...library.variables];
    tempVariables.forEach(tv => {
        if (!newLibVars.some(lv => lv.id === tv.id)) {
            newLibVars.push({ id: tv.id, label: tv.label, type: tv.type as any });
        }
    });
    const headerIds = tempVariables.filter(v => v.isHeader).map(v => v.id);
    const colIds = tempVariables.filter(v => !v.isHeader).map(v => v.id);
    const newFormTemplate = {
        id: newFormId, name: customFormName.trim(), type: customFormType as 'standard' | 'grid',
        variableIds: colIds, headerVariableIds: customFormType === 'grid' ? headerIds : [],
        defaultRows: customFormType === 'grid' && customFormDefaultRows ? customFormDefaultRows.split(/[\n,，;；]+/).map(s => s.trim()).filter(s => s) : []
    };
    setLibrary(prev => ({ variables: newLibVars, forms: [...prev.forms, newFormTemplate] }));
    if (selectedVisitId) {
        setProject(prev => {
             const newP = JSON.parse(JSON.stringify(prev));
             const vIdx = newP.findIndex((v: any) => v.visitId === selectedVisitId);
             if (vIdx !== -1) {
                 newP[vIdx].forms.push({
                     instanceId: `${newFormId}_${Date.now()}`, formId: newFormId,
                     rows: newFormTemplate.defaultRows ? [...newFormTemplate.defaultRows] : [],
                     variables: tempVariables.map(tv => ({ variableId: tv.id, customLabel: tv.label, included: true }))
                 });
             }
             return newP;
        });
    }
    setIsCustomFormModalOpen(false);
    setTempVariables([]);
  };

  const addTempVariable = () => {
      const idToUse = newVarId.trim() || `V_${Math.random().toString(36).substr(2,4).toUpperCase()}`;
      if (tempVariables.some(v => v.id === idToUse)) return alert("变量 ID 已存在");
      setTempVariables([...tempVariables, { id: idToUse, label: newVarLabel || '新字段', type: newVarType as any, isHeader: newVarIsHeader }]);
      setNewVarLabel(''); setNewVarId('');
  };

  const handleSaveInlineVariable = () => {
    if (!activeAddVarFormId) return;
    const finalId = inlineVarId.trim();
    if (!finalId) return alert("请输入变量ID");
    if (!library.variables.some(v => v.id === finalId)) {
        setLibrary(prev => ({ ...prev, variables: [...prev.variables, { id: finalId, label: inlineVarLabel || '新字段', type: inlineVarType as any }] }));
    }
    setProject(prev => {
        const newP = JSON.parse(JSON.stringify(prev));
        const visit = newP.find((v: any) => v.visitId === selectedVisitId);
        const form = visit?.forms.find((f: any) => f.instanceId === activeAddVarFormId);
        if (form && !form.variables.some((v: any) => v.variableId === finalId)) {
            form.variables.push({ variableId: finalId, customLabel: inlineVarLabel || '新字段', included: true });
        }
        return newP;
    });
    setInlineVarId(''); setInlineVarLabel(''); setActiveAddVarFormId(null);
  };

  const handleInitiateAddRow = (visitId: string, formInstanceId: string) => {
      setAddRowTarget({ visitId, formInstanceId });
      setNewRowName('');
  };

  const handleConfirmAddRow = () => {
      if (!addRowTarget || !newRowName.trim()) return;
      const rowsToAdd = newRowName.split(/[\n,，;；]+/).map(r => r.trim()).filter(r => r !== '');
      if (rowsToAdd.length === 0) return;
      setProject(prev => {
          const newP = JSON.parse(JSON.stringify(prev));
          const v = newP.find((n: any) => n.visitId === addRowTarget.visitId);
          const f = v?.forms.find((nf: any) => nf.instanceId === addRowTarget.formInstanceId);
          if (f) {
              if (!f.rows) f.rows = [];
              f.rows.push(...rowsToAdd);
          }
          return newP;
      });
      setAddRowTarget(null);
      setNewRowName('');
  };

  const renderVariableRow = (visitId: string, formInstanceId: string, v: ProjectVariableNode, index: number, totalInGroup: number) => {
      const varTemplate = library.variables.find(vt => vt.id === v.variableId);
      const isEditingLogic = editingLogicVarId === `${formInstanceId}_${v.variableId}`;
      const triggers = getAvailableLogicTriggers(visitId, formInstanceId, v.variableId);

      return (
          <div key={v.variableId} className="bg-slate-50 p-4 rounded-lg border border-slate-200 group transition-all hover:border-blue-200 mb-2">
              <div className="grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-4">
                      <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">{v.variableId}</span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{varTemplate?.type || 'text'}</span>
                      </div>
                      <input 
                          className="w-full font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors text-sm"
                          value={v.customLabel}
                          onChange={(e) => {
                              const val = e.target.value;
                              setProject(prev => {
                                  const newP = JSON.parse(JSON.stringify(prev));
                                  const visit = newP.find((n: any) => n.visitId === visitId);
                                  const form = visit?.forms.find((fm: any) => fm.instanceId === formInstanceId);
                                  const variable = form?.variables.find((cv: any) => cv.variableId === v.variableId);
                                  if (variable) variable.customLabel = val;
                                  return newP;
                              });
                          }}
                      />
                  </div>

                  <div className="col-span-5">
                      {(varTemplate?.type === 'select' || varTemplate?.type === 'radio') ? (
                          <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block mb-1">选项 (逗号分隔)</label>
                              <input 
                                  className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded focus:border-blue-500 outline-none"
                                  placeholder="是, 否"
                                  value={v.customOptions ? v.customOptions.join(',') : (varTemplate?.options?.join(',') || '')}
                                  onChange={(e) => {
                                      const val = e.target.value.split(/[,，]+/).map(s => s.trim()).filter(s => s);
                                      setProject(prev => {
                                          const newP = JSON.parse(JSON.stringify(prev));
                                          const f = newP.find((n: any) => n.visitId === visitId)?.forms.find((fm: any) => fm.instanceId === formInstanceId);
                                          const vr = f?.variables.find((cv: any) => cv.variableId === v.variableId);
                                          if(vr) vr.customOptions = val;
                                          return newP;
                                      });
                                  }}
                              />
                          </div>
                      ) : (
                          <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block mb-1">数值格式/单位</label>
                              <input 
                                  className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded focus:border-blue-500 outline-none"
                                  placeholder="例如: mmHg, YYYY-MM-DD"
                                  value={v.customFormat || varTemplate?.format || ''}
                                  onChange={(e) => {
                                      const val = e.target.value;
                                      setProject(prev => {
                                          const newP = JSON.parse(JSON.stringify(prev));
                                          const f = newP.find((n: any) => n.visitId === visitId)?.forms.find((fm: any) => fm.instanceId === formInstanceId);
                                          const vr = f?.variables.find((cv: any) => cv.variableId === v.variableId);
                                          if (vr) vr.customFormat = val;
                                          return newP;
                                      });
                                  }}
                              />
                          </div>
                      )}
                  </div>

                  <div className="col-span-3 flex justify-end items-center gap-1.5 pt-4">
                      <button 
                          onClick={() => setEditingLogicVarId(isEditingLogic ? null : `${formInstanceId}_${v.variableId}`)}
                          className={`p-1.5 rounded transition-colors ${isEditingLogic ? 'text-purple-600 bg-purple-50' : 'text-slate-300 hover:text-purple-600 hover:bg-white'}`}
                          title="设置跳查逻辑"
                      >
                          <Link2 size={16} />
                      </button>
                      <div className="flex flex-col">
                          <button 
                              onClick={(e) => handleMoveVariable(e, visitId, formInstanceId, v.variableId, 'up')}
                              disabled={index === 0}
                              className="p-0.5 text-slate-300 hover:text-blue-600 disabled:opacity-0"
                          >
                              <ArrowUp size={12} />
                          </button>
                          <button 
                              onClick={(e) => handleMoveVariable(e, visitId, formInstanceId, v.variableId, 'down')}
                              disabled={index === totalInGroup - 1}
                              className="p-0.5 text-slate-300 hover:text-blue-600 disabled:opacity-0"
                          >
                              <ArrowDown size={12} />
                          </button>
                      </div>
                      <button 
                          onClick={() => requestDelete({ type: 'variable', visitId, formInstanceId, itemId: v.variableId, displayName: v.customLabel })}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-white rounded transition-colors"
                      >
                          <Trash2 size={16} />
                      </button>
                  </div>
              </div>

              {v.logic && !isEditingLogic && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-600 font-medium bg-purple-50 w-fit px-2 py-1 rounded border border-purple-100">
                      <Link2 size={12} />
                      依赖 [{v.logic.triggerId}] = "{v.logic.triggerValue}"
                  </div>
              )}

              {isEditingLogic && (
                  <div className="mt-3 p-3 bg-white border border-purple-100 rounded-lg shadow-inner animate-in fade-in slide-in-from-top-1">
                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                          <span>设置显示逻辑</span>
                          {v.logic && <button onClick={() => handleUpdateVariableLogic(visitId, formInstanceId, v.variableId, undefined)} className="text-red-400 hover:text-red-600">清除逻辑</button>}
                      </div>
                      {triggers.length > 0 ? (
                          <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">当</span>
                              <select 
                                  className="text-xs p-1.5 border rounded bg-slate-50 flex-1 outline-none focus:border-purple-300"
                                  value={v.logic?.triggerId || ''}
                                  onChange={(e) => {
                                      const tid = e.target.value;
                                      if (!tid) handleUpdateVariableLogic(visitId, formInstanceId, v.variableId, undefined);
                                      else handleUpdateVariableLogic(visitId, formInstanceId, v.variableId, { triggerId: tid, triggerValue: getOptionsForTrigger(visitId, formInstanceId, tid)[0] || '' });
                                  }}
                              >
                                  <option value="">-- 选择触发变量 --</option>
                                  {triggers.map(t => <option key={t.variableId} value={t.variableId}>{t.customLabel} ({t.variableId})</option>)}
                              </select>
                              <span className="text-xs text-slate-500">等于</span>
                              <select 
                                  className="text-xs p-1.5 border rounded bg-slate-50 flex-1 outline-none focus:border-purple-300"
                                  disabled={!v.logic?.triggerId}
                                  value={v.logic?.triggerValue || ''}
                                  onChange={(e) => handleUpdateVariableLogic(visitId, formInstanceId, v.variableId, { ...v.logic!, triggerValue: e.target.value })}
                              >
                                  {v.logic?.triggerId ? (
                                      getOptionsForTrigger(visitId, formInstanceId, v.logic.triggerId).map(opt => <option key={opt} value={opt}>{opt}</option>)
                                  ) : (
                                      <option value="">等待选择...</option>
                                  )}
                              </select>
                              <button onClick={() => setEditingLogicVarId(null)} className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100"><Check size={16}/></button>
                          </div>
                      ) : (
                          <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed border-slate-200">
                              提示：表单内需要包含 [下拉菜单] 或 [单选框] 类型的字段才能设置跳查逻辑。
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  };

  const selectedVisit = project.find(v => v.visitId === selectedVisitId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <h1 className="text-xl font-bold text-slate-800">{projectMeta.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={excelInputRef} hidden accept=".xlsx,.xls" onChange={handleImportExcelStructure} />
          <button onClick={handleExportBackup} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 shadow-sm"><Download size={16} /> 导出备份</button>
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          <button onClick={() => setIsVersionModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"><History size={16} /> 版本历史</button>
          <button onClick={() => generateWordDoc(project, library)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-all"><FileText size={16} /> 导出 Word</button>
           <button onClick={() => generateExcel(project, library)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm transition-all"><TableIcon size={16} /> 导出 Excel</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-10">
            <div className="flex border-b border-slate-100">
                <button onClick={() => setSidebarTab('visits')} className={`flex-1 py-3 text-sm font-medium transition-colors ${sidebarTab === 'visits' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>访视架构</button>
                <button onClick={() => setSidebarTab('forms')} className={`flex-1 py-3 text-sm font-medium transition-colors ${sidebarTab === 'forms' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>模板库</button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2">
                {sidebarTab === 'visits' ? (
                    <div className="space-y-1">
                        <div className="flex gap-2 mb-3 px-2">
                             <button onClick={() => setIsVisitModalOpen(true)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"><Plus size={14} /> 新建访视</button>
                             <button onClick={() => excelInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"><UploadCloud size={14} /> 导入架构</button>
                        </div>
                        {project.map((visit, index) => (
                            <div key={visit.visitId} className={`group flex items-stretch rounded-lg border transition-all ${selectedVisitId === visit.visitId ? 'bg-white border-blue-400 shadow-md translate-x-1' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                                <button onClick={() => setSelectedVisitId(visit.visitId)} className="flex-1 p-3 text-left">
                                    <div className={`text-sm font-bold ${selectedVisitId === visit.visitId ? 'text-blue-700' : 'text-slate-700'}`}>{visit.visitName}</div>
                                    <div className="text-xs text-slate-400 font-mono">{visit.visitId} · {visit.forms.length} 表单</div>
                                </button>
                                <div className="flex flex-col justify-center px-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 border-l border-slate-100">
                                    <button onClick={(e) => handleMoveVisitUp(e, index)} disabled={index === 0} className="p-1 hover:text-blue-600 text-slate-400 disabled:invisible"><ArrowUp size={12} /></button>
                                    <button onClick={(e) => handleMoveVisitDown(e, index)} disabled={index === project.length - 1} className="p-1 hover:text-blue-600 text-slate-400 disabled:invisible"><ArrowDown size={12} /></button>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); requestDelete({ type: 'visit', visitId: visit.visitId, displayName: visit.visitName }); }} className={`px-3 flex items-center justify-center ${selectedVisitId === visit.visitId ? 'text-blue-200 hover:text-blue-600' : 'text-slate-300 hover:text-red-500'}`}><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-1">
                        <button onClick={() => setIsCustomFormModalOpen(true)} className="w-full mb-4 flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"><Plus size={16} /> 新建自定义表单</button>
                        <div className="space-y-3">
                            {library.forms.map(form => (
                                <div key={form.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => {
                                    if (selectedVisitId) {
                                        setProject(prev => {
                                            const newP = JSON.parse(JSON.stringify(prev));
                                            const idx = newP.findIndex((v: any) => v.visitId === selectedVisitId);
                                            if (idx !== -1) {
                                                 newP[idx].forms.push({
                                                     instanceId: `${form.id}_${Date.now()}`, formId: form.id, customFormName: form.name,
                                                     rows: form.defaultRows ? [...form.defaultRows] : [],
                                                     variables: [...(form.variableIds || []), ...(form.headerVariableIds || [])].map(vid => ({ variableId: vid, customLabel: library.variables.find(v => v.id === vid)?.label || vid, included: true }))
                                                 });
                                            }
                                            return newP;
                                        });
                                    } else alert("请先选择一个访视");
                                }}>
                                    <div className="font-bold text-slate-800 text-sm mb-1">{form.name}</div>
                                    <div className="flex justify-between items-center"><span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{form.id}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 bg-slate-100 p-6 overflow-y-auto scroll-smooth" id="main-canvas">
          {selectedVisit ? (
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <div className="flex justify-between items-center mb-2"><h2 className="text-xl font-bold text-slate-800">{selectedVisit.visitName} <span className="text-slate-400 font-normal text-sm ml-2 font-mono">({selectedVisit.visitId})</span></h2></div>
                
                {selectedVisit.forms.length === 0 && (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                        <FileText size={48} className="mb-4 opacity-50" /><p>访视暂无表单，请从左侧点击模板添加</p>
                    </div>
                )}

                {selectedVisit.forms.map((formNode, index) => {
                    const formTemplate = library.forms.find(f => f.id === formNode.formId);
                    if (!formTemplate) return null;
                    const isGrid = formTemplate.type === 'grid';
                    const isHighlighted = highlightedFormId === formNode.instanceId;

                    return (
                        <div key={formNode.instanceId} id={formNode.instanceId} className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${isHighlighted ? 'border-blue-400 ring-4 ring-blue-100 shadow-lg' : 'border-slate-200'}`}>
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center rounded-t-xl group">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center"><FileText size={18} /></div>
                                    <div>
                                        <input className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors" value={formNode.customFormName || formTemplate.name} onChange={(e) => {
                                                const val = e.target.value;
                                                setProject(prev => {
                                                    const newP = JSON.parse(JSON.stringify(prev));
                                                    const v = newP.find((n: any) => n.visitId === selectedVisit.visitId);
                                                    const f = v?.forms.find((fm: any) => fm.instanceId === formNode.instanceId);
                                                    if(f) f.customFormName = val;
                                                    return newP;
                                                });
                                            }} />
                                        <div className="text-xs text-slate-400 font-mono uppercase tracking-tighter">{formTemplate.id}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={(e) => handleMoveFormUp(e, selectedVisit.visitId, index)} disabled={index === 0} className="p-1.5 rounded text-slate-400 hover:text-blue-600 transition-colors"><ArrowUp size={18} /></button>
                                     <button onClick={(e) => handleMoveFormDown(e, selectedVisit.visitId, index)} disabled={index === selectedVisit.forms.length - 1} className="p-1.5 rounded text-slate-400 hover:text-blue-600 transition-colors"><ArrowDown size={18} /></button>
                                     <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                     <button onClick={() => requestDelete({ type: 'form', visitId: selectedVisit.visitId, formInstanceId: formNode.instanceId, displayName: formNode.customFormName || formTemplate.name })} className="p-1.5 rounded text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                            
                            <div className="p-6">
                                <div className="space-y-4">
                                    {isGrid && (
                                        <div className="overflow-x-auto border rounded-lg border-slate-200 mb-6 shadow-sm">
                                            <table className="w-full border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="p-3 text-left w-32 font-bold text-slate-500 border-r border-slate-200">行标题/时间点</th>
                                                        {formNode.variables.map(v => (
                                                            <th key={v.variableId} className="p-3 min-w-[150px] border-r border-slate-200 text-left font-bold text-slate-600 italic">
                                                                {v.customLabel} ({v.variableId})
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(formNode.rows || []).map((rowLabel, rIdx) => (
                                                        <tr key={rIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-3 font-medium text-slate-700 bg-white border-r border-slate-200 group relative">
                                                                {rowLabel}
                                                                <button onClick={() => requestDelete({ type: 'row', visitId: selectedVisit.visitId, formInstanceId: formNode.instanceId, itemId: rIdx, displayName: rowLabel })} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                                                            </td>
                                                            {formNode.variables.map(v => (<td key={v.variableId} className="p-3 bg-slate-50/20 text-center text-slate-300 italic border-r border-slate-200">[字段]</td>))}
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={formNode.variables.length + 1} className="p-0 border-t border-slate-200">
                                                            <button onClick={() => handleInitiateAddRow(selectedVisit.visitId, formNode.instanceId)} className="w-full py-2 text-xs text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 font-medium">
                                                                <Plus size={14} /> 批量添加行/时间点 (支持换行/逗号/分号)
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        {formNode.variables.map((v, i) => renderVariableRow(selectedVisit.visitId, formNode.instanceId, v, i, formNode.variables.length))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                         <button onClick={() => setActiveAddVarFormId(formNode.instanceId)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors group"><Plus size={16} className="group-hover:rotate-90 transition-transform" /> 添加自定义变量字段</button>
                                    </div>
                                    {activeAddVarFormId === formNode.instanceId && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-2">
                                            <div className="grid grid-cols-12 gap-2 mb-3">
                                                <div className="col-span-3"><label className="text-[9px] font-bold text-blue-400 uppercase block mb-1">变量 ID</label><input className="w-full text-xs p-2 rounded border uppercase" value={inlineVarId} onChange={e => setInlineVarId(e.target.value.toUpperCase())} /></div>
                                                <div className="col-span-5"><label className="text-[9px] font-bold text-blue-400 uppercase block mb-1">显示标签</label><input className="w-full text-xs p-2 rounded border" value={inlineVarLabel} onChange={e => setInlineVarLabel(e.target.value)} /></div>
                                                <div className="col-span-4"><label className="text-[9px] font-bold text-blue-400 uppercase block mb-1">类型</label><select className="w-full text-xs p-2 rounded border bg-white" value={inlineVarType} onChange={e => setInlineVarType(e.target.value as any)}><option value="text">文本</option><option value="number">数字</option><option value="date">日期</option><option value="select">下拉</option><option value="radio">单选</option></select></div>
                                            </div>
                                            <div className="flex justify-end gap-2"><button onClick={() => setActiveAddVarFormId(null)} className="px-3 py-1 text-xs text-slate-500">取消</button><button onClick={handleSaveInlineVariable} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold">保存</button></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Navigation size={64} className="text-slate-200 mb-4" />
                <h2 className="text-xl font-bold text-slate-600">选择一个访视节点</h2>
                <p className="text-slate-500 mt-2">从左侧边栏点击访视名称以在画布上展示详细架构。</p>
            </div>
          )}
        </div>

        <div className="w-64 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 z-10">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Navigation size={16} className="text-blue-500" /> 访视架构大纲</h3></div>
            <div className="flex-1 overflow-y-auto p-2">
                {selectedVisit?.forms.map((formNode, index) => (
                    <div key={formNode.instanceId} draggable onDragStart={(e) => handleOutlineDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleOutlineDrop(e, index)} className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer group transition-all border border-transparent hover:border-slate-100" onClick={() => scrollToForm(formNode.instanceId)}>
                        <div className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical size={14} /></div>
                        <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate text-slate-700">{formNode.customFormName || library.forms.find(f => f.id === formNode.formId)?.name}</div>
                            <div className="text-[9px] text-slate-400 truncate uppercase font-mono tracking-tight">{formNode.formId}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {isVisitModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl p-8 w-[400px] shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-slate-800">新建访视节点</h3>
            <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">访视 ID</label><input className="w-full p-2.5 border rounded-lg uppercase font-mono" placeholder="如: V1" value={newVisitId} onChange={e => setNewVisitId(e.target.value.toUpperCase())} /></div>
                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">访视名称</label><input className="w-full p-2.5 border rounded-lg" placeholder="如: 筛选期" value={newVisitName} onChange={e => setNewVisitName(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8"><button onClick={() => setIsVisitModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">取消</button><button onClick={handleAddVisit} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">创建访视</button></div>
          </div>
        </div>
      )}

      {isVersionModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-[600px] shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">版本历史</h3><button onClick={() => setIsVersionModalOpen(false)}><X size={24}/></button></div>
            <div className="flex gap-2 mb-6"><input className="flex-1 p-2.5 border rounded-lg" placeholder="版本说明" value={newVersionName} onChange={e => setNewVersionName(e.target.value)} /><button onClick={handleSaveVersion} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2"><Save size={18}/> 保存当前</button></div>
            <div className="flex-1 overflow-y-auto border rounded-xl shadow-inner bg-slate-50">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b sticky top-0"><tr><th className="p-4 font-bold text-slate-400 uppercase text-[10px]">名称</th><th className="p-4 font-bold text-slate-400 uppercase text-[10px]">时间</th><th className="p-4 text-right"></th></tr></thead>
                    <tbody className="divide-y">{versions.map((v, i) => (<tr key={i} className="hover:bg-white group"><td className="p-4 font-bold">{v.versionName}</td><td className="p-4 text-xs text-slate-500">{new Date(v.timestamp).toLocaleString()}</td><td className="p-4 text-right space-x-2"><button onClick={() => handleCompareVersion(v)} className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-xs font-bold">对比</button><button onClick={() => handleRestoreVersion(v)} className="px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs font-bold">恢复</button></td></tr>))}</tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {isCustomFormModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-0 w-[800px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50"><h3 className="text-xl font-bold text-slate-800">构建自定义表单模板</h3><button onClick={() => setIsCustomFormModalOpen(false)}><X size={24}/></button></div>
            <div className="p-8 flex-1 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">表单名称</label><input className="w-full p-2.5 border rounded-lg shadow-sm" placeholder="专科查体" value={customFormName} onChange={e => setCustomFormName(e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">表单 ID</label><input className="w-full p-2.5 border rounded-lg uppercase font-mono shadow-sm" placeholder="F_PE_01" value={customFormId} onChange={e => setCustomFormId(e.target.value.toUpperCase())} /></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">结构类型</label><select className="w-full p-2.5 border rounded-lg bg-white" value={customFormType} onChange={e => setCustomFormType(e.target.value)}><option value="standard">普通列表</option><option value="grid">矩阵表格</option></select></div>
                    {customFormType === 'grid' && (<div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">默认行 (逗号分号分隔)</label><input className="w-full p-2.5 border rounded-lg" placeholder="0h, 1h, 2h" value={customFormDefaultRows} onChange={e => setCustomFormDefaultRows(e.target.value)} /></div>)}
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-700 mb-4">添加字段</h4>
                    <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">ID</label><input className="w-full p-2 border rounded text-xs uppercase" value={newVarId} onChange={e => setNewVarId(e.target.value.toUpperCase())} /></div>
                        <div className="col-span-5"><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">标签</label><input className="w-full p-2 border rounded text-xs" value={newVarLabel} onChange={e => setNewVarLabel(e.target.value)} /></div>
                        <div className="col-span-2"><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">类型</label><select className="w-full p-2 border rounded text-xs bg-white" value={newVarType} onChange={e => setNewVarType(e.target.value as any)}><option value="text">文本</option><option value="number">数字</option><option value="date">日期</option><option value="select">下拉</option><option value="radio">单选</option></select></div>
                        <div className="col-span-2 flex items-center h-full pb-2"><button onClick={addTempVariable} className="w-full p-2 bg-blue-600 text-white rounded font-bold text-xs">添加</button></div>
                    </div>
                </div>
                <div className="border rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">标签</th><th className="p-3 text-left">类型</th><th className="p-3"></th></tr></thead>
                        <tbody className="divide-y">{tempVariables.map((v, i) => (<tr key={i}><td className="p-3 font-mono font-bold">{v.id}</td><td className="p-3">{v.label}</td><td className="p-3 uppercase text-xs text-slate-400">{v.type}</td><td className="p-3 text-right"><button onClick={() => setTempVariables(tempVariables.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td></tr>))}</tbody>
                    </table>
                </div>
            </div>
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3"><button onClick={() => setIsCustomFormModalOpen(false)} className="px-6 py-2 border rounded-xl font-bold">取消</button><button onClick={handleCreateCustomForm} className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold">构建表单</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 w-[400px] shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100"><Trash2 size={32} /></div>
                <h3 className="text-xl font-bold mb-2">确认移除?</h3>
                <p className="text-slate-500 text-sm mb-6">确定要永久移除 "<span className="font-bold text-slate-800">{deleteTarget.displayName}</span>" 吗？此操作无法撤销。</p>
                <div className="flex gap-3"><button onClick={closeDeleteModal} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">取消</button><button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100">确认</button></div>
            </div>
        </div>
      )}

      {addRowTarget && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 w-[450px] shadow-2xl">
                <h3 className="text-xl font-bold mb-4">批量追加行/时间点</h3>
                <textarea className="w-full mb-6 p-4 border rounded-xl h-40 resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="支持换行、逗号或分号分隔..." value={newRowName} onChange={e => setNewRowName(e.target.value)} autoFocus />
                <div className="flex justify-end gap-3"><button onClick={() => setAddRowTarget(null)} className="px-4 py-2 font-bold text-slate-400">取消</button><button onClick={handleConfirmAddRow} className="px-8 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg">追加</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default DocumentBuilder;