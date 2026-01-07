import { useRef, useState, useCallback, useEffect } from 'react';
import { AUDIO_CONFIG } from '@shared/constants';

interface UseAudioStreamOptions {
    onAudioData?: (base64Audio: string) => void;
}

interface UseAudioStreamReturn {
    isRecording: boolean;
    isMuted: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    toggleMute: () => void;
    playAudio: (base64Audio: string) => void;
}

export function useAudioStream(options: UseAudioStreamOptions = {}): UseAudioStreamReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Audio context refs
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const nextPlayTimeRef = useRef<number>(0);

    // Store options in ref
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const startRecording = useCallback(async () => {
        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            streamRef.current = stream;

            // Create input audio context
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const inputContext = new AudioCtx({ sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE });
            inputContextRef.current = inputContext;

            // Create output audio context for playback
            const outputContext = new AudioCtx({ sampleRate: AUDIO_CONFIG.OUTPUT_SAMPLE_RATE });
            outputContextRef.current = outputContext;
            nextPlayTimeRef.current = 0;

            // Set up audio processing
            const source = inputContext.createMediaStreamSource(stream);
            const processor = inputContext.createScriptProcessor(AUDIO_CONFIG.CHUNK_SIZE, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (event) => {
                if (isMuted) return;

                const inputData = event.inputBuffer.getChannelData(0);

                // Convert Float32 audio to Int16
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    // Clamp to [-1, 1] and convert to int16
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Convert to base64
                const bytes = new Uint8Array(int16Data.buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Audio = btoa(binary);

                // Send to callback
                optionsRef.current.onAudioData?.(base64Audio);
            };

            source.connect(processor);
            processor.connect(inputContext.destination);

            setIsRecording(true);
            console.log('🎤 Recording started');

        } catch (error) {
            console.error('Failed to start recording:', error);
            throw error;
        }
    }, [isMuted]);

    const stopRecording = useCallback(() => {
        // Stop media stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Disconnect processor
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        // Close audio contexts
        if (inputContextRef.current) {
            inputContextRef.current.close();
            inputContextRef.current = null;
        }

        if (outputContextRef.current) {
            outputContextRef.current.close();
            outputContextRef.current = null;
        }

        setIsRecording(false);
        console.log('🎤 Recording stopped');
    }, []);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    const playAudio = useCallback((base64Audio: string) => {
        if (!outputContextRef.current) {
            // Create output context if not exists (for when receiving audio before recording)
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            outputContextRef.current = new AudioCtx({ sampleRate: AUDIO_CONFIG.OUTPUT_SAMPLE_RATE });
            nextPlayTimeRef.current = 0;
        }

        const ctx = outputContextRef.current;

        try {
            // Decode base64 to binary
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Convert Int16 to Float32
            const int16Data = new Int16Array(bytes.buffer);
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            // Create audio buffer and play
            const buffer = ctx.createBuffer(1, float32Data.length, AUDIO_CONFIG.OUTPUT_SAMPLE_RATE);
            buffer.copyToChannel(float32Data, 0);

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);

            // Schedule playback to avoid gaps
            const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + buffer.duration;

        } catch (error) {
            console.error('Failed to play audio:', error);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording();
        };
    }, [stopRecording]);

    return {
        isRecording,
        isMuted,
        startRecording,
        stopRecording,
        toggleMute,
        playAudio
    };
}
