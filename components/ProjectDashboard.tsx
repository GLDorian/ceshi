import React, { useState, useRef } from 'react';
import { ProjectFile } from '../types';
import { Plus, UploadCloud, FileText, Trash2, Clock, Search, FolderOpen, Download, AlertTriangle } from 'lucide-react';

interface Props {
  projects: ProjectFile[];
  onCreateProject: (name: string, description: string) => void;
  onImportProject: (fileData: ProjectFile) => void;
  onDeleteProject: (id: string) => void;
  onOpenProject: (id: string) => void;
}

const ProjectDashboard: React.FC<Props> = ({ projects, onCreateProject, onImportProject, onDeleteProject, onOpenProject }) => {
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  // Delete Modal State (Replaces window.confirm)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    if (!newName.trim()) return alert("请输入项目名称");
    onCreateProject(newName, newDesc);
    setNewName('');
    setNewDesc('');
    setIsCreateModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // 简单的格式校验
      if (!json.data || !json.data.project) {
          // 尝试兼容旧格式
          if (Array.isArray(json.project)) {
              const converted: ProjectFile = {
                  meta: {
                      id: `PROJ_${Date.now()}`,
                      name: file.name.replace('.json', '').replace('.dgp', ''),
                      description: 'Imported from legacy format',
                      createdAt: Date.now(),
                      lastModified: Date.now()
                  },
                  data: {
                      project: json.project,
                      library: json.library,
                      versions: json.versions || []
                  }
              };
              onImportProject(converted);
              return;
          }
          alert("无法识别的文件格式");
          return;
      }
      
      const imported: ProjectFile = {
          ...json,
          meta: {
              ...json.meta,
              id: `PROJ_${Date.now()}_IMP`,
              name: json.meta.name + ' (Imported)',
              lastModified: Date.now()
          }
      };
      onImportProject(imported);

    } catch (e) {
      console.error(e);
      alert("文件解析失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportProject = (e: React.MouseEvent, project: ProjectFile) => {
      e.stopPropagation();
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeName = project.meta.name.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      link.download = `${safeName}_backup_${new Date().toISOString().slice(0, 10)}.dgp.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- 重构后的删除逻辑 ---
  // 1. 点击按钮仅触发状态变更
  const initiateDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); // 阻止冒泡，不打开项目
      e.preventDefault();
      setDeleteConfirmId(id); // 打开模态框
  };

  // 2. 确认删除
  const confirmDelete = () => {
      if (deleteConfirmId) {
          onDeleteProject(deleteConfirmId);
          setDeleteConfirmId(null);
      }
  };

  const filteredProjects = projects
    .filter(p => p.meta.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.meta.lastModified - a.meta.lastModified);

  const projectToDelete = projects.find(p => p.meta.id === deleteConfirmId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">我的项目</h1>
                <p className="text-slate-500 text-sm mt-1">管理您的所有 CRF 设计与文档生成项目</p>
            </div>
            <div className="flex gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept=".json,.dgp"/>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium"
                >
                    <UploadCloud size={18} /> 导入项目
                </button>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                    <Plus size={18} /> 新建项目
                </button>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    placeholder="搜索项目名称..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Grid */}
            {filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FolderOpen size={32} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700">没有找到项目</h3>
                    <p className="text-slate-500 mt-2">创建一个新项目或导入现有文件开始工作。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map(project => (
                        <div key={project.meta.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden relative">
                            {/* Card Body - Clickable */}
                            <div className="p-6 flex-1 cursor-pointer" onClick={() => onOpenProject(project.meta.id)}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <FileText size={24} />
                                    </div>
                                    <div className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                        v{project.data.versions.length + 1}.0
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                                    {project.meta.name}
                                </h3>
                                <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">
                                    {project.meta.description || '无描述'}
                                </p>
                            </div>
                            
                            {/* Footer - Actions */}
                            <div 
                                className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 relative z-10"
                            >
                                <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {new Date(project.meta.lastModified).toLocaleDateString()}
                                </span>
                                <div className="flex gap-2">
                                     <button 
                                        onClick={(e) => handleExportProject(e, project)}
                                        className="p-2 hover:bg-blue-100 hover:text-blue-600 rounded-full transition-colors cursor-pointer"
                                        title="导出/备份项目"
                                        type="button"
                                    >
                                        <Download size={16} className="pointer-events-none" />
                                    </button>
                                    
                                    {/* 重构后的删除按钮 */}
                                    <button 
                                        onClick={(e) => initiateDelete(e, project.meta.id)}
                                        className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors cursor-pointer"
                                        title="删除此项目"
                                        type="button"
                                    >
                                        <Trash2 size={16} className="pointer-events-none" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-[500px] animate-in fade-in zoom-in duration-200">
                <h2 className="text-xl font-bold text-slate-800 mb-6">新建项目</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">项目名称</label>
                        <input 
                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="例如: Protocol 101 CRF Design"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">描述 (可选)</label>
                        <textarea 
                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            placeholder="简要描述项目内容..."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                    <button 
                        onClick={() => setIsCreateModalOpen(false)}
                        className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleCreate}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                    >
                        创建项目
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal (NEW) */}
      {deleteConfirmId && projectToDelete && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-[400px] flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-100">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">删除项目?</h3>
                <p className="text-slate-500 mb-6 text-sm">
                    您确定要删除 <span className="font-bold text-slate-700">"{projectToDelete.meta.name}"</span> 吗?
                    <br/>
                    此操作将永久删除该项目的所有数据且<span className="text-red-600 font-bold">无法恢复</span>。
                </p>
                <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg shadow-red-200 transition-colors"
                    >
                        确认删除
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default ProjectDashboard;