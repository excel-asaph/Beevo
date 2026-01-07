import React, { useRef, useEffect } from 'react';
import { User, Bot, Radio } from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

interface ChatHistoryProps {
    messages: ChatMessage[];
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 flex flex-col" style={{ height: '350px', maxHeight: '350px' }}>
            <div className="p-3 border-b border-slate-700 flex-shrink-0">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Radio size={14} />
                    Live Transcription
                </h3>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 p-3 space-y-2"
                style={{
                    overflowY: 'scroll',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#475569 #1e293b'
                }}
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 py-8">
                        <Radio size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">Conversation will appear here</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[90%] px-3 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-sm'
                                    : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                                }`}>
                                <div className="flex items-center gap-1 mb-0.5 opacity-60 text-[9px] uppercase font-bold tracking-wider">
                                    {msg.role === 'user' ? <User size={9} /> : <Bot size={9} />}
                                    <span>{msg.role === 'user' ? 'You' : 'Architect'}</span>
                                </div>
                                <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
