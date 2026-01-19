import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';

// Miro-style cards
import { FrameNode } from './nodes/FrameNode';
import { BrandNameCard } from './nodes/BrandNameCard';
import { OverviewCard } from './nodes/OverviewCard';
import { StrategyCard } from './nodes/StrategyCard';
import { ColorPaletteCard } from './nodes/ColorPaletteCard';
import { TypographyCard } from './nodes/TypographyCard';
import { ImageryCard } from './nodes/ImageryCard';
import { VaultNode } from './nodes/VaultNode';
import { VoiceOrbNode } from './nodes/VoiceOrbNode';

// UI Components
import { DropZone } from './DropZone';

// Hooks & Store
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioStream } from '../../hooks/useAudioStream';
import { useBrandStore } from '../../stores/useBrandStore';
import { useShallow } from 'zustand/react/shallow';

interface MiroCanvasProps {
    onBack?: () => void;
}

/**
 * MiroCanvas - Miro-style moodboard layout for brand identity
 * Uses organized frames instead of free-floating ReactFlow nodes
 */
export const MiroCanvas: React.FC<MiroCanvasProps> = ({ onBack }) => {
    // ========== ZUSTAND STORE SUBSCRIPTIONS ==========
    const { dna, colorOptions, fontOptions, logoInspirations, vaultStats, phase, loadingMessage } = useBrandStore(
        useShallow((state) => ({
            dna: state.dna,
            colorOptions: state.colorOptions,
            fontOptions: state.fontOptions,
            logoInspirations: state.logoInspirations,
            vaultStats: state.vaultStats,
            phase: state.phase,
            loadingMessage: state.loadingMessage,
        }))
    );

    const { voiceState, aiMessage } = useBrandStore(
        useShallow((state) => ({
            voiceState: state.voiceState,
            aiMessage: state.aiMessage,
        }))
    );

    // Actions
    const updateDNA = useBrandStore((state) => state.updateDNA);
    const setColorOptions = useBrandStore((state) => state.setColorOptions);
    const setFontOptions = useBrandStore((state) => state.setFontOptions);
    const setLogoInspirations = useBrandStore((state) => state.setLogoInspirations);
    const setVaultStats = useBrandStore((state) => state.setVaultStats);
    const setPhase = useBrandStore((state) => state.setPhase);
    const setLoadingMessage = useBrandStore((state) => state.setLoadingMessage);
    const setVoiceState = useBrandStore((state) => state.setVoiceState);
    const setAiMessage = useBrandStore((state) => state.setAiMessage);
    const selectColor = useBrandStore((state) => state.selectColor);
    const selectFont = useBrandStore((state) => state.selectFont);

    // ========== WEBSOCKET & AUDIO ==========
    const ws = useWebSocket({
        autoConnect: true,
        onConnected: () => console.log('🔌 WebSocket connected'),
        onDisconnected: () => console.log('🔌 WebSocket disconnected'),
        onDNAUpdate: (newDNA) => {
            console.log('📥 DNA Update received:', newDNA);
            updateDNA(newDNA);
            // NOTE: Don't transition here - wait for RESEARCH_COMPLETE
        },
        onColorSuggestions: (palettes) => {
            console.log('🎨 Color suggestions:', palettes);
            setColorOptions(palettes);
        },
        onFontSuggestions: (fonts) => {
            console.log('🔤 Font suggestions:', fonts);
            setFontOptions(fonts);
        },
        onLogoResearchResult: (logos) => {
            console.log('🖼️ Logo inspirations:', logos);
            setLogoInspirations(logos.map((l: any, i: number) => ({
                id: `logo-${i}`,
                url: l.imageUrl || l.url,
                brandName: l.brandName || 'Unknown',
                source: l.source || '',
                description: l.description || '',
            })));
        },
        onVaultUpdate: (stats) => {
            console.log('🏦 Vault update:', stats);
            setVaultStats(stats);
        },
        onAiMessage: (text) => setAiMessage(text),
        onError: (msg) => console.error('WebSocket error:', msg),
        // RESEARCH_COMPLETE - only transition to canvas when ALL data is ready
        onResearchComplete: (summary) => {
            console.log('🎉 Research complete! Summary:', summary);

            // Validation: ensure we have the minimum required data
            const hasColors = colorOptions.length > 0;
            const hasFonts = fontOptions.length > 0;
            const hasBrandName = dna.name && dna.name.length > 0;

            if (hasColors && hasFonts) {
                console.log('✅ All required data present - showing canvas');
                setPhase('canvas');
            } else {
                console.warn('⚠️ Research complete but missing data:', {
                    hasColors,
                    hasFonts,
                    hasBrandName,
                    colorCount: colorOptions.length,
                    fontCount: fontOptions.length
                });
                // Still transition - the data might arrive in the next tick
                // This handles race conditions where RESEARCH_COMPLETE arrives
                // before the last COLOR_SUGGESTIONS/FONT_SUGGESTIONS messages
                setTimeout(() => {
                    setPhase('canvas');
                }, 500);
            }
        },
    });

    const audio = useAudioStream({
        onAudioData: (data) => ws.sendAudio(data),
    });

    // ========== HANDLERS ==========
    const handleFileUpload = useCallback(async (files: FileList) => {
        if (files.length === 0) return;
        const file = files[0];
        console.log('📁 File uploaded:', file.name);

        setPhase('loading');
        setLoadingMessage('Analyzing your brand...');

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            ws.sendFile(file, base64, 'extraction');
        };
        reader.readAsDataURL(file);
    }, [ws, setPhase, setLoadingMessage]);

    const handleVaultUpload = useCallback((files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        console.log('🏦 Vault upload:', file.name);

        setVaultStats({ ...vaultStats, isIngesting: true });

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            ws.sendFile(file, base64, 'vault');
        };
        reader.readAsDataURL(file);
    }, [ws, vaultStats, setVaultStats]);

    const handleColorSelect = useCallback((color: string) => {
        // Find the palette containing this color and select it
        const palette = colorOptions.find(p => p.colors.includes(color));
        if (palette) {
            selectColor(palette.name);
            ws.sendSelection('color', palette.name);
        }
    }, [colorOptions, selectColor, ws]);

    const handleFontSelect = useCallback((font: string) => {
        selectFont(font);
        ws.sendSelection('font', font);
    }, [selectFont, ws]);

    const toggleVoice = useCallback(() => {
        if (voiceState === 'idle' || voiceState === 'inactive') {
            audio.start();
            setVoiceState('listening');
            if (!ws.sessionId) {
                ws.startSession();
            }
        } else {
            audio.stop();
            setVoiceState('idle');
        }
    }, [voiceState, audio, ws, setVoiceState]);

    // ========== DERIVED DATA ==========
    const displayColors = colorOptions.length > 0
        ? colorOptions[0].colors
        : dna.colors || [];

    // Pass full font objects to preserve pairing data for display
    const displayFonts = fontOptions.length > 0
        ? fontOptions
        : dna.typography?.map((name: string) => ({ name, category: 'sans-serif' })) || [];

    const logoImages = logoInspirations.map(l => ({
        url: l.url,
        label: l.brandName,
    }));

    // ========== RENDER ==========

    // Phase: Onboarding
    if (phase === 'onboarding') {
        return (
            <div className="miro-canvas onboarding">
                <DropZone onFilesDropped={(files) => handleFileUpload(files)} />
                <style>{canvasStyles}</style>
            </div>
        );
    }

    // Phase: Loading
    if (phase === 'loading') {
        return (
            <div className="miro-canvas loading">
                <motion.div
                    className="loading-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <Sparkles className="loading-icon" size={48} />
                    <h2>{loadingMessage || 'Analyzing your brand...'}</h2>
                </motion.div>
                <style>{canvasStyles}</style>
            </div>
        );
    }

    // Phase: Canvas (Main Moodboard)
    return (
        <div className="miro-canvas">
            <div className="canvas-grid">
                {/* Row 1: Brand Name + Overview */}
                <div className="canvas-row row-1">
                    <BrandNameCard
                        name={dna.name || 'Your Brand'}
                        tagline={dna.mission?.slice(0, 50)}
                    />
                    <OverviewCard />
                </div>

                {/* Row 2: Brand Strategy Frame */}
                <div className="canvas-row row-2">
                    {/* @ts-ignore - FrameNode is used as a wrapper here */}
                    <FrameNode title="Brand Strategy" width={700}>
                        <StrategyCard
                            mission={dna.mission}
                            values={dna.values}
                            voice={dna.voice}
                        />
                    </FrameNode>
                </div>

                {/* Row 3: Visual Identity Frame */}
                <div className="canvas-row row-3">
                    {/* @ts-ignore - FrameNode is used as a wrapper here */}
                    <FrameNode title="Visual Identity" width={900}>
                        <ColorPaletteCard
                            colors={displayColors}
                            paletteName="Color Palette"
                            onColorClick={handleColorSelect}
                        />
                        <TypographyCard
                            fonts={displayFonts}
                            onFontClick={handleFontSelect}
                        />
                        {logoImages.length > 0 && (
                            <ImageryCard
                                images={logoImages}
                                title="Logo Inspiration"
                            />
                        )}
                    </FrameNode>
                </div>

                {/* Row 4: Tools Frame */}
                <div className="canvas-row row-4">
                    {/* @ts-ignore - FrameNode is used as a wrapper here */}
                    <FrameNode title="Tools" width={400}>
                        <VaultNode
                            id="vault-tool"
                            position={{ x: 0, y: 0 }}
                            data={{
                                fileCount: vaultStats.fileCount,
                                totalTokens: vaultStats.totalTokens,
                                isIngesting: vaultStats.isIngesting,
                                onUpload: handleVaultUpload,
                            }}
                            {...({} as any)}
                        />
                    </FrameNode>

                    {/* AI Voice Orb */}
                    <div className="voice-orb-container">
                        <VoiceOrbNode
                            id="voice-orb"
                            position={{ x: 0, y: 0 }}
                            data={{
                                state: voiceState,
                                message: aiMessage,
                                onActivate: toggleVoice,
                                onDeactivate: toggleVoice,
                            }}
                            {...({} as any)}
                        />
                    </div>
                </div>
            </div>

            {/* Connection Status */}
            <div className="connection-status">
                {ws.status === 'connected' ? (
                    <Wifi size={16} className="status-icon connected" />
                ) : (
                    <WifiOff size={16} className="status-icon disconnected" />
                )}
            </div>

            <style>{canvasStyles}</style>
        </div>
    );
};

// ========== STYLES ==========
const canvasStyles = `
    .miro-canvas {
        width: 100vw;
        height: 100vh;
        background: #f5f5f5;
        background-image: 
            radial-gradient(circle, #ddd 1px, transparent 1px);
        background-size: 20px 20px;
        overflow: auto;
        padding: 40px;
        box-sizing: border-box;
    }

    .miro-canvas.onboarding,
    .miro-canvas.loading {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loading-content {
        text-align: center;
        color: #1a1a1a;
    }

    .loading-icon {
        color: #f59e0b;
        margin-bottom: 16px;
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
    }

    .canvas-grid {
        display: flex;
        flex-direction: column;
        gap: 32px;
        max-width: 1200px;
        margin: 0 auto;
    }

    .canvas-row {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
        align-items: flex-start;
    }

    .row-4 {
        align-items: center;
    }

    .voice-orb-container {
        margin-left: auto;
    }

    .connection-status {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        padding: 8px 12px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .status-icon.connected { color: #22c55e; }
    .status-icon.disconnected { color: #ef4444; }
`;

export default MiroCanvas;
