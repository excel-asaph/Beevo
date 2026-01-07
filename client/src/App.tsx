import React from 'react';
import { BrandProvider, useBrand } from './context/BrandContext';
import { Strategist } from './components/Strategist';
import { ArchitectMain } from './components/Architect';
import { Forge } from './components/Forge';
import { Guardian } from './components/Guardian';
import { Junction } from '@shared/types';
import { Brain, Search, Code, Layers, ShieldCheck, Activity } from 'lucide-react';

const SidebarItem: React.FC<{
    active: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void
}> = ({ active, icon, label, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
        {icon}
        <span className="font-medium">{label}</span>
    </button>
);

const MainLayout: React.FC = () => {
    const { currentJunction, setJunction, thoughtStream } = useBrand();

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

                {/* Thought Stream Feed */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 h-1/3 flex flex-col">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
                        <Activity className="w-3 h-3 mr-1" /> Thought Stream
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                        {thoughtStream.map(thought => (
                            <div key={thought.id} className="text-xs p-2 rounded bg-slate-800 border border-slate-700/50">
                                <span className={`inline-block px-1 rounded text-[10px] font-bold mb-1 ${thought.junction === Junction.STRATEGIST ? 'bg-blue-900 text-blue-300' :
                                        thought.junction === Junction.ARCHITECT ? 'bg-purple-900 text-purple-300' :
                                            thought.junction === Junction.FORGE ? 'bg-orange-900 text-orange-300' :
                                                'bg-teal-900 text-teal-300'
                                    }`}>
                                    {thought.junction}
                                </span>
                                <p className="text-slate-300 leading-snug">{thought.logic}</p>
                            </div>
                        ))}
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