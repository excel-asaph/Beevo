import React, { useState } from 'react';
import { BrandProvider, useBrand } from './context/BrandContext';
import { Strategist } from './components/Strategist';
import { ArchitectMain } from './components/Architect';
import { Forge } from './components/Forge';
import { Guardian } from './components/Guardian';
import { AgentCanvas } from './components/Agent';
import { DynamicLandingPage } from './components/DynamicLandingPage';
import { HITLControlCenter } from './components/HITLControlCenter';
import { LogoStudioSidebar } from './components/LogoStudio/LogoStudioSidebar';
import { Junction } from '@shared/types';
import { Brain, Search, Code, Layers, ShieldCheck, Activity, Sparkles, MonitorPlay, Hexagon } from 'lucide-react';

type ViewMode = 'dashboard' | 'agent' | 'landing_page' | 'hitl';

const SidebarItem: React.FC<{
    active: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    accent?: boolean;
}> = ({ active, icon, label, onClick, accent }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
            ? accent
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/40'
                : 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
    >
        {icon}
        <span className="font-medium">{label}</span>
        {accent && !active && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded-full">NEW</span>
        )}
    </button>
);

const MainLayout: React.FC = () => {
    const { currentJunction, setJunction } = useBrand();

    // Check URL for mode (for headless testing/snapshots)
    const initialMode = (new URLSearchParams(window.location.search).get('mode') as ViewMode) || 'dashboard';
    const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
    const [isLogoStudioOpen, setIsLogoStudioOpen] = useState(false);

    // If in Agent mode, render the full-screen Agent Canvas
    if (viewMode === 'agent') {
        return <AgentCanvas onBack={() => setViewMode('dashboard')} />;
    }

    // If in Landing Page mode, render the Dynamic Landing Page
    if (viewMode === 'landing_page') {
        return (
            <div className="relative w-full h-full">
                <button
                    onClick={() => setViewMode('dashboard')}
                    className="absolute top-4 right-4 z-[99999] px-4 py-2 bg-black/50 text-white hover:bg-black rounded-lg backdrop-blur-sm transition-colors border border-white/10"
                >
                    Exit Preview
                </button>
                <DynamicLandingPage />
            </div>
        );
    }

    // If in HITL mode, render the Control Center
    if (viewMode === 'hitl') {
        return (
            <div className="relative w-full h-full">
                <button
                    onClick={() => setViewMode('dashboard')}
                    className="absolute top-4 right-4 z-50 px-4 py-2 bg-black/50 text-white hover:bg-black rounded-lg backdrop-blur-sm transition-colors border border-white/10"
                >
                    Exit Control Center
                </button>
                <HITLControlCenter />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center space-x-2 text-white">
                        <div className="p-2 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg">
                            <Brain className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-none">SV-CMO</h1>
                            <span className="text-xs text-slate-500 tracking-wider">ORCHESTRATOR</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {/* Agent Canvas - Featured at top */}
                    <div className="pb-3 mb-3 border-b border-slate-800 space-y-2">
                        <SidebarItem
                            active={false}
                            onClick={() => setViewMode('agent')}
                            icon={<Sparkles size={20} />}
                            label="Agent Canvas"
                            accent
                        />
                        <SidebarItem
                            active={false}
                            onClick={() => setViewMode('landing_page')}
                            icon={<MonitorPlay size={20} />}
                            label="Live Landing Page"
                            accent
                        />
                        <SidebarItem
                            active={false}
                            onClick={() => setViewMode('hitl')}
                            icon={<Activity size={20} />}
                            label="Control Center"
                            accent
                        />
                    </div>

                    {/* Original navigation items */}
                    <SidebarItem
                        active={isLogoStudioOpen}
                        onClick={() => setIsLogoStudioOpen(true)}
                        icon={<Hexagon size={20} />}
                        label="Logo Studio"
                        accent
                    />
                    <SidebarItem
                        active={currentJunction === Junction.STRATEGIST}
                        onClick={() => setJunction(Junction.STRATEGIST)}
                        icon={<Search size={20} />}
                        label="Strategist"
                    />
                    <SidebarItem
                        active={currentJunction === Junction.ARCHITECT}
                        onClick={() => setJunction(Junction.ARCHITECT)}
                        icon={<Code size={20} />}
                        label="Architect"
                    />
                    <SidebarItem
                        active={currentJunction === Junction.FORGE}
                        onClick={() => setJunction(Junction.FORGE)}
                        icon={<Layers size={20} />}
                        label="The Forge"
                    />
                    <SidebarItem
                        active={currentJunction === Junction.GUARDIAN}
                        onClick={() => setJunction(Junction.GUARDIAN)}
                        icon={<ShieldCheck size={20} />}
                        label="Guardian"
                    />
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <Activity className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-slate-300">System Status</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Intelligence</span>
                            <span className="text-green-400">Active</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

                <div className="h-full overflow-y-auto p-8 relative z-10">
                    {currentJunction === Junction.STRATEGIST && <Strategist />}
                    {currentJunction === Junction.ARCHITECT && <ArchitectMain />}
                    {currentJunction === Junction.FORGE && <Forge />}
                    {currentJunction === Junction.GUARDIAN && <Guardian />}
                </div>
            </main>
            <LogoStudioSidebar isOpen={isLogoStudioOpen} onClose={() => setIsLogoStudioOpen(false)} />
        </div>
    );
}

const App: React.FC = () => {
    return (
        <BrandProvider>
            <MainLayout />
        </BrandProvider>
    );
};

export default App;
