import React, { useState } from 'react';
import { useBrand } from '../context/BrandContext';
import { generateCampaignImage, generateCampaignVideo, checkVideoStatus } from '../services/gemini';
import { Button } from './ui/Button';
import { Junction } from '../types';
import { Image as ImageIcon, Video, Layers, Download, RefreshCw } from 'lucide-react';

export const Forge: React.FC = () => {
  const { dna, addAsset, addThought } = useBrand();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [showSafeZones, setShowSafeZones] = useState(true);

  const handleGenerate = async () => {
    if (!dna) {
        alert("Please define Brand DNA in the Architect module first.");
        return;
    }
    setIsGenerating(true);
    setGeneratedUrl(null);
    
    addThought(`Forge Activated. Mode: ${activeTab.toUpperCase()}. Prompt: ${prompt}`, Junction.FORGE);

    try {
        if (activeTab === 'image') {
            const url = await generateCampaignImage(prompt, JSON.stringify(dna));
            if (url) {
                setGeneratedUrl(url);
                addAsset({
                    id: Date.now().toString(),
                    type: 'image',
                    url,
                    prompt,
                    status: 'completed'
                });
                addThought("Visual Artifact Forged using Nano Banana Pro.", Junction.FORGE);
            }
        } else {
            // Video Logic
            // Check for API Key first for Veo
            if (window.aistudio?.hasSelectedApiKey) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    await window.aistudio.openSelectKey();
                }
            }
            
            addThought("Requesting Veo 3.1 Cinematic Sequence...", Junction.FORGE);
            const { videoUri, operation } = await generateCampaignVideo(prompt + ` Style: ${dna.voice}`);
            
            // Polling simulation
            if (operation) {
                let op = operation;
                while (!op.done) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    op = await checkVideoStatus(op);
                    
                    if (op.error) {
                        throw new Error(`Video generation error: ${op.error.message || 'Unknown error'}`);
                    }
                }

                const dlLink = op.response?.generatedVideos?.[0]?.video?.uri;
                if (dlLink) {
                     addThought("Downloading Cinematic Stream...", Junction.FORGE);
                     
                     // Important: Fetch blob with key to create a playable local URL
                     // Direct playback from the API URL often fails due to auth/CORS in video tags
                     const response = await fetch(`${dlLink}&key=${process.env.API_KEY}`);
                     if (!response.ok) throw new Error("Failed to download video content");
                     
                     const blob = await response.blob();
                     const finalUrl = URL.createObjectURL(blob);
                     
                     setGeneratedUrl(finalUrl);
                     addAsset({
                        id: Date.now().toString(),
                        type: 'video',
                        url: finalUrl,
                        prompt,
                        status: 'completed'
                    });
                     addThought("Cinematic Asset Rendered.", Junction.FORGE);
                } else {
                    throw new Error("No video URI in response");
                }
            }
        }
    } catch (error: any) {
        console.error(error);
        addThought(`Forge process failed: ${error.message}`, Junction.FORGE);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
       {/* Control Panel */}
       <div className="w-full md:w-1/3 space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 flex items-center text-orange-400">
                  <Layers className="mr-2" /> The Forge
              </h2>
              
              <div className="flex space-x-2 mb-6 bg-slate-900 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('image')}
                    className={`flex-1 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'image' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                      <ImageIcon className="inline w-4 h-4 mr-1"/> Nano Banana (Img)
                  </button>
                  <button 
                    onClick={() => setActiveTab('video')}
                    className={`flex-1 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'video' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                      <Video className="inline w-4 h-4 mr-1"/> Veo 3.1 (Vid)
                  </button>
              </div>

              <textarea 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white h-32 mb-4 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  placeholder={`Describe the ${activeTab} campaign...`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
              />

              <Button onClick={handleGenerate} isLoading={isGenerating} className="w-full bg-orange-600 hover:bg-orange-500">
                  {isGenerating ? 'Forging Assets...' : 'Generate Asset'}
              </Button>
          </div>
       </div>

       {/* Viewport */}
       <div className="w-full md:w-2/3 bg-black/40 rounded-xl border border-slate-700 flex items-center justify-center relative overflow-hidden min-h-[400px]">
           {generatedUrl ? (
               <div className="relative max-w-full max-h-full flex items-center justify-center">
                   {activeTab === 'image' ? (
                       <img src={generatedUrl} alt="Generated" className="max-h-[600px] object-contain rounded-lg" />
                   ) : (
                       <video src={generatedUrl} controls autoPlay loop className="max-h-[600px] rounded-lg shadow-2xl" />
                   )}
                   
                   {/* Safe Zone Overlay */}
                   {activeTab === 'image' && showSafeZones && (
                       <div className="absolute inset-0 pointer-events-none border-[20px] border-red-500/20 z-10">
                           <div className="absolute bottom-16 right-4 bg-black/80 text-white text-xs px-2 py-1 rounded">UI Safe Zone</div>
                       </div>
                   )}
                   
                   <div className="absolute top-4 right-4 flex space-x-2 z-20">
                       {activeTab === 'image' && (
                           <button 
                                onClick={() => setShowSafeZones(!showSafeZones)}
                                className={`p-2 rounded-full backdrop-blur-md transition-colors ${showSafeZones ? 'bg-red-500/50 text-white' : 'bg-black/50 text-slate-300'}`}
                                title="Toggle Safe Zones"
                            >
                               <Layers size={20} />
                           </button>
                       )}
                       <a 
                            href={generatedUrl} 
                            download={`forge-asset.${activeTab === 'image' ? 'png' : 'mp4'}`}
                            className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70"
                        >
                           <Download size={20} />
                       </a>
                   </div>
               </div>
           ) : (
               <div className="text-center text-slate-500">
                   {isGenerating ? (
                       <div className="flex flex-col items-center">
                           <RefreshCw className="animate-spin w-10 h-10 mb-4 text-orange-500"/>
                           <p>Forging in progress...</p>
                       </div>
                   ) : (
                       <div className="flex flex-col items-center">
                           <div className="w-20 h-20 border-2 border-dashed border-slate-600 rounded-lg mb-4 flex items-center justify-center">
                               <Layers className="text-slate-600"/>
                           </div>
                           <p>No Asset Generated</p>
                       </div>
                   )}
               </div>
           )}
       </div>
    </div>
  );
};