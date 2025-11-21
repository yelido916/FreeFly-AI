import React from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { NovelLibrary } from './pages/NovelLibrary';
import { PromptLibrary } from './pages/PromptLibrary';
import { NovelEditor } from './pages/NovelEditor';
import { BookOpen, FileText, Sparkles } from 'lucide-react';

// --- Layout Components ---

const NavBar: React.FC = () => {
    const location = useLocation();
    
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 text-indigo-600">
                    <Sparkles className="w-6 h-6" />
                    <span className="text-xl font-bold tracking-tight text-slate-800">FreeFly AI</span>
                </div>
                
                <nav className="hidden sm:flex items-center gap-1">
                    <Link 
                        to="/" 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isActive('/') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <BookOpen className="w-4 h-4" />
                        我的小说
                    </Link>
                    <Link 
                        to="/prompts" 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isActive('/prompts') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <FileText className="w-4 h-4" />
                        提示词库
                    </Link>
                </nav>
            </div>
            
            <div className="flex items-center gap-4">
               {/* User profile or extra settings could go here */}
            </div>
        </div>
    );
};

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <NavBar />
            <main className="flex-1">
                {children}
            </main>
        </div>
    );
};

// --- Routing Helpers ---

const AppContent: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectNovel = (id: string) => {
        navigate(`/editor/${id}`);
    };

    const handleBackToLibrary = () => {
        navigate('/');
    };

    return (
        <Routes>
            {/* Novel Library Route */}
            <Route path="/" element={
                <DashboardLayout>
                    <NovelLibrary onSelectNovel={handleSelectNovel} />
                </DashboardLayout>
            } />
            
            {/* Prompt Library Route */}
            <Route path="/prompts" element={
                <DashboardLayout>
                    <PromptLibrary />
                </DashboardLayout>
            } />

            {/* Editor Route (Fullscreen, no Dashboard Layout) */}
            <Route 
                path="/editor/:id" 
                element={
                    <NovelEditorWrapper onBack={handleBackToLibrary} />
                } 
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

// Wrapper to extract params for Editor
const NovelEditorWrapper: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { id } = useParams<{ id: string }>();
    if (!id) return <Navigate to="/" />;
    return <NovelEditor novelId={id} onBack={onBack} />;
};

const App: React.FC = () => {
  return (
    <HashRouter>
        <AppContent />
    </HashRouter>
  );
};

export default App;