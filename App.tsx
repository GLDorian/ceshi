import React, { useState, useEffect } from 'react';
import DocumentBuilder from './components/DocumentBuilder.tsx';
import ProjectDashboard from './components/ProjectDashboard.tsx';
import { LibraryData, ProjectNode, ProjectVersion, ProjectFile } from './types.ts';

// 声明全局函数
declare global {
  interface Window {
    hideAppLoader: () => void;
  }
}

const INITIAL_LIBRARY: LibraryData = {
  variables: [
    { id: 'DEM_01', label: '受试者姓名缩写', type: 'text', format: '最多4位字母' },
    { id: 'DEM_02', label: '出生日期', type: 'date', format: 'YYYY-MM-DD' },
    { id: 'VS_01', label: '收缩压 (mmHg)', type: 'number', format: '3位整数' },
    { id: 'VS_02', label: '舒张压 (mmHg)', type: 'number', format: '3位整数' },
    { id: 'VS_03', label: '心率 (bpm)', type: 'number', format: '3位整数' },
    { id: 'AE_01', label: '不良事件名称', type: 'text' },
    { id: 'AE_02', label: '严重程度', type: 'select', options: ['轻度', '中度', '重度'] },
    { id: 'AE_03', label: '与药物相关性', type: 'radio', options: ['肯定有关', '可能有关', '可能无关', '肯定无关'] }
  ],
  forms: [
    { id: 'DM', name: '人口学资料', type: 'standard', variableIds: ['DEM_01', 'DEM_02'] },
    { id: 'VS', name: '生命体征', type: 'standard', variableIds: ['VS_01', 'VS_02', 'VS_03'] },
    { id: 'AE', name: '不良事件', type: 'standard', variableIds: ['AE_01', 'AE_02', 'AE_03'] }
  ]
};

const PROJECTS_STORAGE_KEY = 'docugen_pro_projects_v11';

const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // 关键：渲染成功后隐藏加载屏
  useEffect(() => {
    if (typeof window.hideAppLoader === 'function') {
      window.hideAppLoader();
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setProjects(parsed);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  const handleCreateProject = (name: string, description: string) => {
    const newProject: ProjectFile = {
        meta: {
            id: `PROJ_${Date.now()}`,
            name,
            description,
            createdAt: Date.now(),
            lastModified: Date.now()
        },
        data: {
            project: [],
            library: JSON.parse(JSON.stringify(INITIAL_LIBRARY)),
            versions: []
        }
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.meta.id);
  };

  const handleImportProject = (fileData: ProjectFile) => {
      setProjects(prev => [fileData, ...prev]);
      setActiveProjectId(fileData.meta.id);
  };

  const handleDeleteProject = (id: string) => {
      setProjects(prev => prev.filter(p => p.meta.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
  };

  const handleOpenProject = (id: string) => setActiveProjectId(id);
  const handleBackToDashboard = () => setActiveProjectId(null);

  const activeProject = projects.find(p => p.meta.id === activeProjectId);

  const updateActiveProjectData = (updater: (data: ProjectFile['data']) => ProjectFile['data']) => {
      if (!activeProjectId) return;
      setProjects(prev => prev.map(p => {
          if (p.meta.id !== activeProjectId) return p;
          return {
              ...p,
              meta: { ...p.meta, lastModified: Date.now() },
              data: updater(p.data)
          };
      }));
  };

  const setProjectWrapper = (valueOrFn: React.SetStateAction<ProjectNode[]>) => {
      updateActiveProjectData(data => ({
          ...data,
          project: typeof valueOrFn === 'function' ? (valueOrFn as any)(data.project) : valueOrFn
      }));
  };

  const setLibraryWrapper = (valueOrFn: React.SetStateAction<LibraryData>) => {
      updateActiveProjectData(data => ({
          ...data,
          library: typeof valueOrFn === 'function' ? (valueOrFn as any)(data.library) : valueOrFn
      }));
  };

  const setVersionsWrapper = (valueOrFn: React.SetStateAction<ProjectVersion[]>) => {
      updateActiveProjectData(data => ({
          ...data,
          versions: typeof valueOrFn === 'function' ? (valueOrFn as any)(data.versions) : valueOrFn
      }));
  };

  return (
    <div className="h-screen w-screen bg-slate-100 flex flex-col overflow-hidden font-sans">
      {!activeProjectId || !activeProject ? (
        <ProjectDashboard 
            projects={projects}
            onCreateProject={handleCreateProject}
            onImportProject={handleImportProject}
            onDeleteProject={handleDeleteProject}
            onOpenProject={handleOpenProject}
        />
      ) : (
        <div className="flex-1 p-4 h-full overflow-hidden">
             <DocumentBuilder
                library={activeProject.data.library}
                project={activeProject.data.project}
                versions={activeProject.data.versions}
                projectMeta={activeProject.meta}
                setLibrary={setLibraryWrapper}
                setProject={setProjectWrapper}
                setVersions={setVersionsWrapper}
                onBack={handleBackToDashboard}
            />
        </div>
      )}
    </div>
  );
};

export default App;