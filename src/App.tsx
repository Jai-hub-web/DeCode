import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, FolderOpen, Settings, Zap, TerminalSquare, FilePlus, FolderPlus, LogOut, Code, Plus } from 'lucide-react';
import DCodeEditor from './components/Editor';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface User {
  id: string;
  username: string;
}

interface Project {
  id: string;
  name: string;
  language: string;
  updatedAt: string;
}

const defaultSnippets: Record<string, string> = {
  typescript: `// Welcome to DCode.\n// TypeScript Environment\n\nconsole.log("Hello, DCode!");`,
  javascript: `// Welcome to DCode.\n// JavaScript Environment\n\nfunction main() {\n  console.log("Hello, DCode!");\n}\n\nmain();`,
  python: `# Welcome to DCode.\n# Python Environment\n\ndef main():\n    print("Hello, DCode!")\n\nif __name__ == "__main__":\n    main()`,
  java: `// Welcome to DCode.\n// Java Environment\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, DCode!");\n    }\n}`,
  cpp: `// Welcome to DCode.\n// C++ Environment\n\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, DCode!" << std::endl;\n    return 0;\n}`,
  c: `// Welcome to DCode.\n// C Environment\n\n#include <stdio.h>\n\nint main() {\n    printf("Hello, DCode!\\n");\n    return 0;\n}`,
  go: `// Welcome to DCode.\n// Go Environment\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, DCode!")\n}`,
  rust: `// Welcome to DCode.\n// Rust Environment\n\nfn main() {\n    println!("Hello, DCode!");\n}`
};

const getExtension = (lang: string) => {
  const extMap: Record<string, string> = { typescript: 'ts', javascript: 'js', python: 'py', java: 'java', cpp: 'cpp', c: 'c', go: 'go', rust: 'rs' };
  return extMap[lang] || 'txt';
};

const getLangFromExtension = (filename: string) => {
  const ext = filename.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'typescript', js: 'javascript', py: 'python', java: 'java', cpp: 'cpp', c: 'c', go: 'go', rs: 'rust'
  };
  return map[ext] || 'txt';
};

const generateSnippet = (filename: string, lang: string) => {
  if (lang === 'java') {
    const className = filename.replace(/\.java$/, '').split('/').pop() || 'Main';
    return `// Welcome to DCode.\n// Java Environment\n\npublic class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Hello, DCode!");\n    }\n}`;
  }
  return defaultSnippets[lang] || '';
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLang, setNewProjectLang] = useState('typescript');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // IDE State
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [language, setLanguage] = useState('typescript');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('Output will appear here...');
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiChatSession, setAiChatSession] = useState<{messages: {role: 'user'|'assistant', content: string}[], latestFixedCode: string} | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; type: 'file' | 'folder' } | null>(null);
  const [inputModal, setInputModal] = useState<{ type: 'file' | 'folder' | 'rename' | 'rename-project'; path: string; title: string; placeholder: string; initialValue?: string } | null>(null);
  const [inputValue, setInputValue] = useState('');

  // --- API Calls ---

  const handleLogin = async () => {
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true);
    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim() })
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        fetchProjects(data.user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchProjects = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/projects?userId=${userId}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    setIsCreatingProject(true);
    try {
      const res = await fetch('http://localhost:3001/api/projects/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: newProjectName.trim(), language: newProjectLang })
      });
      const data = await res.json();
      if (data.project) {
        // Create initial file
        const initialFile = `main.${getExtension(newProjectLang)}`;
        await fetch('http://localhost:3001/api/files/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: initialFile, content: generateSnippet(initialFile, newProjectLang), project: data.project.id })
        });
        
        setCurrentProject(data.project);
        setLanguage(newProjectLang);
        setNewProjectName('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const fetchFiles = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`http://localhost:3001/api/files?project=${currentProject.id}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error("Failed to fetch files", err);
    }
  };

  useEffect(() => {
    if (currentProject) {
      fetchFiles();
      // Auto-load main file if no file is selected
      if (!currentFile) {
         const ext = getExtension(currentProject.language);
         loadFile(`main.${ext}`);
      }
    }
  }, [currentProject]);

  const loadFile = async (filename: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`http://localhost:3001/api/files/${encodeURIComponent(filename)}?project=${currentProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setCode(data.content);
        setCurrentFile(filename);
        setLanguage(getLangFromExtension(filename));
      }
    } catch (err) {
      console.error("Failed to load file", err);
    }
  };

  const saveFile = async (filename: string, content: string) => {
    if (!currentProject) return;
    try {
      await fetch('http://localhost:3001/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content, project: currentProject.id })
      });
      fetchFiles();
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  const handleInputSubmit = async () => {
    if (!inputModal || !inputValue.trim() || !currentProject) return;
    const { type, path: folderOrFilePath } = inputModal;
    const name = inputValue.trim();
    
    if (type === 'file') {
      const fullPath = folderOrFilePath ? `${folderOrFilePath}/${name}` : name;
      const lang = getLangFromExtension(name);
      const content = generateSnippet(fullPath, lang);
      await saveFile(fullPath, content);
      loadFile(fullPath);
      if (folderOrFilePath) setExpandedFolders(new Set([...expandedFolders, folderOrFilePath]));
    } else if (type === 'folder') {
      const fullPath = folderOrFilePath ? `${folderOrFilePath}/${name}` : name;
      try {
        await fetch('http://localhost:3001/api/files/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foldername: fullPath, project: currentProject.id })
        });
        if (folderOrFilePath) setExpandedFolders(new Set([...expandedFolders, folderOrFilePath]));
      } catch (err) {
        console.error("Failed to create folder", err);
      }
    } else if (type === 'rename') {
      try {
        await fetch(`http://localhost:3001/api/files/${encodeURIComponent(folderOrFilePath)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newFilename: name, project: currentProject.id })
        });
        if (currentFile === folderOrFilePath) setCurrentFile(name);
      } catch (err) {
        console.error("Failed to rename", err);
      }
    } else if (type === 'rename-project') {
      try {
        const res = await fetch(`http://localhost:3001/api/projects/${currentProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.project) {
          setCurrentProject(data.project);
        }
      } catch (err) {
        console.error("Failed to rename project", err);
      }
    }
    
    fetchFiles();
    setInputModal(null);
  };

  const runCode = async () => {
    if (!currentFile || !currentProject) return;
    setIsRunning(true);
    setHasError(false);
    setAiChatSession(null);
    setOutput('Running...');
    try {
      // Autosave before run
      await saveFile(currentFile, code);
      
      const res = await fetch('http://localhost:3001/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, filename: currentFile, project: currentProject.id })
      });
      const data = await res.json();
      setOutput(data.output || 'No output.');
      if (data.output && (data.output.includes('Error Output') || data.output.toLowerCase().includes('error') || data.output.toLowerCase().includes('exception'))) {
        setHasError(true);
      }
      fetchFiles();
    } catch (err: any) {
      setOutput('Error: ' + err.message);
      setHasError(true);
    } finally {
      setIsRunning(false);
    }
  };

  const askAiForFix = async (isFollowUp = false) => {
    if (!code || !output) return;
    if (isFollowUp && !chatInput.trim()) return;
    
    setIsAskingAi(true);
    try {
      let requestBody;
      
      if (!isFollowUp) {
        requestBody = { code, errorOutput: output, language };
      } else {
        const newMessages = [...(aiChatSession?.messages || []), { role: 'user', content: chatInput }];
        setAiChatSession(prev => prev ? { ...prev, messages: newMessages } : null);
        requestBody = { messages: newMessages, language };
        setChatInput('');
      }

      const res = await fetch('http://localhost:3001/api/ai/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();
      
      if (data.message) {
        setAiChatSession(prev => {
          const initialUserMsg = !isFollowUp ? [{ role: 'user', content: `[Error Output]\n${output}\n\nPlease fix this error.` }] : [];
          return {
             messages: prev ? [...prev.messages, data.message] : [...initialUserMsg, data.message] as {role: 'user'|'assistant', content: string}[],
             latestFixedCode: data.fixedCode || prev?.latestFixedCode || ''
          };
        });
      } else {
        alert('AI could not provide a fix: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to contact AI');
    } finally {
      setIsAskingAi(false);
    }
  };

  const exportCode = () => {
    if (!currentProject) return;
    window.location.href = `http://localhost:3001/api/projects/${currentProject.id}/export`;
  };

  const handleDelete = async (path: string) => {
    if (!currentProject) return;
    try {
      await fetch(`http://localhost:3001/api/files/${encodeURIComponent(path)}?project=${currentProject.id}`, { method: 'DELETE' });
      if (currentFile === path) setCurrentFile(null);
      fetchFiles();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, type });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderTree = (nodes: FileNode[], paddingLeft = 12) => {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={node.path}>
            <div 
              className="cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between group text-white/90"
              style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '12px' }}
              onClick={() => {
                const newExpanded = new Set(expandedFolders);
                if (isExpanded) newExpanded.delete(node.path);
                else newExpanded.add(node.path);
                setExpandedFolders(newExpanded);
              }}
              onContextMenu={(e) => handleContextMenu(e, node.path, 'folder')}
            >
              <div className="flex items-center gap-2 py-1">
                <span className="text-white/30 text-[10px] w-3">{isExpanded ? '▼' : '▶'}</span> 
                <FolderOpen size={12} className="text-[#0055ff]" />
                {node.name}
              </div>
            </div>
            {isExpanded && node.children && renderTree(node.children, paddingLeft + 12)}
          </div>
        );
      } else {
        return (
          <div 
            key={node.path} 
            onClick={() => loadFile(node.path)}
            onContextMenu={(e) => handleContextMenu(e, node.path, 'file')}
            className={`cursor-pointer transition-colors flex items-center gap-2 py-1 hover:bg-white/5 ${currentFile === node.path ? 'text-[#0055ff] bg-[#0055ff]/10' : 'text-white/60 hover:text-white'}`}
            style={{ paddingLeft: `${paddingLeft + 16}px`, paddingRight: '12px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            {node.name}
          </div>
        );
      }
    });
  };

  // --- Screens ---

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#050505] text-[#f8f8ff] font-['Inter',sans-serif] selection:bg-[#0055ff] selection:text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md p-8 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl shadow-[#0055ff]/10"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0055ff]/20 flex items-center justify-center border border-[#0055ff]/30">
              <Zap size={20} className="text-[#0055ff]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DCode</h1>
              <p className="text-xs text-white/40 font-['JetBrains_Mono',monospace]">Mono-Cyber Workspace</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Username</label>
              <input 
                type="text" 
                placeholder="Enter your username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-[#ffffff05] border border-white/10 focus:border-[#0055ff]/50 rounded-lg px-4 py-3 outline-none text-sm text-white placeholder-white/20 transition-colors"
                autoFocus
              />
            </div>

            <button 
              onClick={handleLogin}
              disabled={!loginUsername.trim() || isLoggingIn}
              className="w-full mt-4 bg-[#0055ff] hover:bg-[#0044cc] text-white py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#0055ff]/20"
            >
              {isLoggingIn ? 'Authenticating...' : 'Enter Workspace'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex h-screen w-full bg-[#050505] text-[#f8f8ff] font-['Inter',sans-serif]">
        <div className="w-64 border-r border-white/5 bg-[#0a0a0a]/60 backdrop-blur-md flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 rounded-lg bg-[#0055ff]/20 flex items-center justify-center border border-[#0055ff]/30">
              <Zap size={16} className="text-[#0055ff]" />
            </div>
            <span className="font-bold tracking-tight">DCode</span>
          </div>
          
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0055ff] to-[#00aaff] flex items-center justify-center text-white font-bold text-sm">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90">{user.username}</div>
              <button onClick={() => {setUser(null); setProjects([]);}} className="text-[10px] text-white/40 hover:text-red-400 flex items-center gap-1 transition-colors">
                <LogOut size={10} /> Logout
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="max-w-4xl w-full">
            <h2 className="text-3xl font-bold mb-8 text-white/90">Your Projects</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Create New Project Card */}
              <div className="bg-[#0a0a0a] border border-dashed border-white/20 hover:border-[#0055ff]/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-white/5 h-[200px]"
                   onClick={() => setIsCreatingProject(true)}>
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-[#0055ff]">
                  <Plus size={24} />
                </div>
                <h3 className="text-sm font-semibold text-white">Create New Project</h3>
                <p className="text-xs text-white/40 mt-1">Start an empty workspace</p>
              </div>

              {/* Existing Projects */}
              {projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProject(p); setLanguage(p.language); }}
                     className="bg-[#0a0a0a] border border-white/10 hover:border-white/30 rounded-2xl p-6 cursor-pointer transition-all hover:bg-white/5 h-[200px] flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Code size={16} className="text-[#0055ff]" />
                      <span className="text-xs font-['JetBrains_Mono',monospace] text-white/50 uppercase">{p.language}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white/90 group-hover:text-white transition-colors">{p.name}</h3>
                  </div>
                  <div className="text-[10px] text-white/40">
                    Last updated {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create Project Modal */}
        {isCreatingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsCreatingProject(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-6">New Project</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Project Name</label>
                  <input 
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., neural-net"
                    className="w-full bg-[#ffffff05] border border-white/10 focus:border-[#0055ff]/50 rounded-lg px-4 py-2.5 outline-none text-sm text-white transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Language</label>
                  <select 
                    value={newProjectLang}
                    onChange={(e) => setNewProjectLang(e.target.value)}
                    className="w-full bg-[#ffffff05] border border-white/10 focus:border-[#0055ff]/50 rounded-lg px-4 py-2.5 outline-none text-sm text-white transition-colors appearance-none"
                  >
                    <option value="typescript" className="bg-[#0a0a0a]">TypeScript</option>
                    <option value="javascript" className="bg-[#0a0a0a]">JavaScript</option>
                    <option value="python" className="bg-[#0a0a0a]">Python</option>
                    <option value="java" className="bg-[#0a0a0a]">Java</option>
                    <option value="cpp" className="bg-[#0a0a0a]">C++</option>
                    <option value="c" className="bg-[#0a0a0a]">C</option>
                    <option value="go" className="bg-[#0a0a0a]">Go</option>
                    <option value="rust" className="bg-[#0a0a0a]">Rust</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setIsCreatingProject(false)} className="px-4 py-2 text-xs text-white/60 hover:text-white transition-colors">Cancel</button>
                <button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="px-4 py-2 text-xs bg-[#0055ff] hover:bg-[#0044cc] text-white rounded-lg font-semibold transition-colors disabled:opacity-50">Create</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // IDE View
  return (
    <div className="flex h-screen w-full bg-[#050505] text-[#f8f8ff] font-['Inter',sans-serif] overflow-hidden selection:bg-[#0047ab] selection:text-white" onClick={() => setContextMenu(null)}>
      
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute z-20 top-0 left-0 h-full w-[260px] bg-[#0a0a0a]/60 backdrop-blur-md border-r border-white/5 flex flex-col"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <span className="text-xs font-semibold tracking-widest text-[#0047ab] uppercase">Explorer</span>
              <div className="flex items-center gap-2">
                <button onClick={() => { setInputModal({ type: 'file', path: '', title: 'New File', placeholder: 'Enter file name' }); setInputValue(''); }} className="text-white/40 hover:text-white"><FilePlus size={14} /></button>
                <button onClick={() => { setInputModal({ type: 'folder', path: '', title: 'New Folder', placeholder: 'Enter folder name' }); setInputValue(''); }} className="text-white/40 hover:text-white"><FolderPlus size={14} /></button>
              </div>
            </div>
            <div className="flex-1 py-2 text-sm font-['JetBrains_Mono',monospace] overflow-y-auto">
              <div className="px-3 mb-2 text-xs font-bold text-white/50 uppercase tracking-wider">{currentProject.name}</div>
              {files.length === 0 && <div className="text-white/30 ml-5 italic text-xs">No files generated yet...</div>}
              {renderTree(files)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {aiChatSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAiChatSession(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-[600px] h-[80vh] flex flex-col bg-[#0a0a0a] border border-purple-500/30 rounded-xl overflow-hidden shadow-2xl shadow-purple-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-purple-500/10 border-b border-purple-500/20 p-4 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2"><Zap size={16}/> AI Debugger Chat</h3>
              <button onClick={() => setAiChatSession(null)} className="text-white/40 hover:text-white">✕</button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {aiChatSession.messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                   <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white/5 border border-white/10 text-white/80'}`}>
                      {msg.role === 'user' ? (
                         <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                         <div className="whitespace-pre-wrap leading-relaxed">
                            {msg.content.split('```').map((part, i) => {
                               if (i % 2 !== 0) {
                                  return <div key={i} className="bg-[#050505] p-3 my-2 rounded-lg border border-white/10 font-['JetBrains_Mono',monospace] text-xs text-white/70 overflow-x-auto whitespace-pre">{part.replace(/^[a-z]*\n/, '')}</div>;
                               }
                               return <span key={i}>{part}</span>;
                            })}
                         </div>
                      )}
                   </div>
                </div>
              ))}
              {isAskingAi && (
                 <div className="flex items-start">
                   <div className="p-3 rounded-lg text-sm bg-white/5 border border-white/10 text-white/50 animate-pulse">
                     Thinking...
                   </div>
                 </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-[#050505] shrink-0">
               <div className="flex gap-2 mb-3">
                 <input 
                   type="text"
                   value={chatInput}
                   onChange={e => setChatInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && askAiForFix(true)}
                   placeholder="Ask a follow-up question..."
                   className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-white outline-none"
                   disabled={isAskingAi}
                 />
                 <button 
                   onClick={() => askAiForFix(true)}
                   disabled={!chatInput.trim() || isAskingAi}
                   className="px-4 py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                 >
                   Send
                 </button>
               </div>
               
               <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                 <button onClick={() => setAiChatSession(null)} className="px-4 py-2 text-xs text-white/60 hover:text-white transition-colors">Close</button>
                 {aiChatSession.latestFixedCode && (
                   <button 
                     onClick={() => { setCode(aiChatSession.latestFixedCode); setAiChatSession(null); setHasError(false); }} 
                     className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold transition-colors flex items-center gap-2"
                   >
                     <Code size={14}/> Apply Latest Fix
                   </button>
                 )}
               </div>
            </div>
          </motion.div>
        </div>
      )}

      {inputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setInputModal(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-[300px] bg-[#0a0a0a] border border-white/10 rounded-xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-4">{inputModal.title}</h3>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputModal.placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInputSubmit();
                if (e.key === 'Escape') setInputModal(null);
              }}
              className="w-full bg-[#ffffff05] border border-white/10 focus:border-[#0055ff]/50 rounded-lg px-3 py-2 outline-none text-sm text-white mb-4 font-['JetBrains_Mono',monospace]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setInputModal(null)} className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleInputSubmit} className="px-3 py-1.5 text-xs bg-[#0055ff] hover:bg-[#0044cc] text-white rounded font-semibold transition-colors">Confirm</button>
            </div>
          </motion.div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl shadow-black/50 py-1 min-w-[120px] text-xs font-medium"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'folder' && (
            <>
              <div onClick={() => { setInputModal({ type: 'file', path: contextMenu.path, title: 'New File', placeholder: 'Enter file name' }); setInputValue(''); setContextMenu(null); }} className="px-4 py-2 hover:bg-[#0055ff]/20 hover:text-[#5599ff] cursor-pointer transition-colors text-white/80 flex items-center gap-2"><FilePlus size={12}/> New File</div>
              <div onClick={() => { setInputModal({ type: 'folder', path: contextMenu.path, title: 'New Folder', placeholder: 'Enter folder name' }); setInputValue(''); setContextMenu(null); }} className="px-4 py-2 hover:bg-[#0055ff]/20 hover:text-[#5599ff] cursor-pointer transition-colors text-white/80 flex items-center gap-2"><FolderPlus size={12}/> New Folder</div>
            </>
          )}
          <div onClick={() => { setInputModal({ type: 'rename', path: contextMenu.path, title: 'Rename', placeholder: 'Enter new name', initialValue: contextMenu.path }); setInputValue(contextMenu.path); setContextMenu(null); }} className="px-4 py-2 hover:bg-[#0055ff]/20 hover:text-[#5599ff] cursor-pointer transition-colors text-white/80 flex items-center gap-2">Rename</div>
          <div onClick={() => { handleDelete(contextMenu.path); setContextMenu(null); }} className="px-4 py-2 hover:bg-red-500/20 hover:text-red-400 cursor-pointer transition-colors text-white/80 flex items-center gap-2">Delete</div>
        </div>
      )}

      <div className="flex flex-col flex-1 relative z-10 w-full transition-all duration-300" style={{ marginLeft: isSidebarOpen ? '260px' : '0' }}>
        <div className="h-12 flex items-center px-4 border-b border-white/5 justify-between relative bg-[#0a0a0a]">
          <div className="flex items-center gap-4 w-1/3">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-white/50 hover:text-white transition-colors focus:outline-none">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <span className="text-sm font-medium opacity-80 flex items-center gap-2">
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => {setCurrentProject(null); fetchProjects(user.id);}}>
                <Zap size={14} className="text-[#0047ab] inline mr-1 mb-0.5" />
                DCode 
              </span>
              <span className="text-white/30">/</span> 
              <span 
                className="text-white font-['JetBrains_Mono',monospace] text-xs bg-white/5 px-2 py-1 rounded cursor-pointer hover:bg-white/10 transition-colors flex items-center gap-2 group"
                onClick={() => {
                  setInputModal({ type: 'rename-project', path: '', title: 'Rename Project', placeholder: 'Enter new project name', initialValue: currentProject.name });
                  setInputValue(currentProject.name);
                }}
              >
                {currentProject.name}
                <svg className="opacity-0 group-hover:opacity-100 transition-opacity" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </span>
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 w-1/3">
            <button 
              onClick={runCode}
              disabled={isRunning || !currentFile}
              className="flex items-center gap-1.5 bg-[#0055ff]/20 text-[#5599ff] border border-[#0055ff]/30 hover:bg-[#0055ff]/30 hover:text-white px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v4"></path></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
              )}
              {isRunning ? 'Running...' : 'Run Code'}
            </button>

            <button
              onClick={exportCode}
              disabled={!currentProject}
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 text-xs text-white/40 w-1/3">
            <span className="bg-white/5 px-2 py-1 rounded font-['JetBrains_Mono',monospace]">{currentFile || 'No file selected'}</span>
          </div>
        </div>

        <div className="flex-1 relative bg-[#050505] flex flex-col">
          <div className="flex-1 min-h-[50%] relative">
            <DCodeEditor language={language} code={code} onChange={setCode} />
          </div>
          
          <div className="h-1/3 min-h-[150px] border-t border-white/10 bg-[#0a0a0a] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 text-xs text-white/50 uppercase tracking-wider font-semibold">
              <div className="flex items-center"><TerminalSquare size={12} className="mr-2" /> Output</div>
              {hasError && (
                <button 
                  onClick={() => askAiForFix(false)}
                  disabled={isAskingAi}
                  className="flex items-center gap-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 px-2 py-1 rounded text-[10px] transition-colors disabled:opacity-50"
                >
                  <Zap size={10} /> {isAskingAi ? 'Asking AI...' : '✨ Ask AI to Fix'}
                </button>
              )}
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-['JetBrains_Mono',monospace] text-xs text-white/80 whitespace-pre-wrap">
              {output}
            </div>
          </div>
        </div>

        <div className="h-7 border-t border-white/5 bg-[#080808] flex items-center justify-between px-3 text-[11px] font-['JetBrains_Mono',monospace]">
          <div className="flex items-center gap-4 text-white/60">
             <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-[#0047ab] animate-pulse"></div>
               Connection Status: Secure
             </div>
          </div>
          <div className="flex items-center gap-4 text-white/50">
            <span className="capitalize">{language}</span>
            <span>UTF-8</span>
            <Settings size={12} className="cursor-pointer hover:text-white transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
