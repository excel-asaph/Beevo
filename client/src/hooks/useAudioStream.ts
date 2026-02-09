import { useRef, useState, useCallback, useEffect } from 'react';
import { AUDIO_CONFIG } from '@shared/constants';

/**
 * Configuration options for the audio stream hook.
 */
interface UseAudioStreamOptions {
    /** Callback receiving base64 encoded audio chunks. */
    onAudioData?: (base64Audio: string) => void;
    /** Callback triggered when VAD detects speech start. */
    onSpeechStart?: () => void;
    /** Callback triggered when VAD detects silence after speech. */
    onSpeechEnd?: () => void;
    /** Duration of silence (in ms) before triggering onSpeechEnd. Default: 400ms. */
    silenceThresholdMs?: number;
}

/**
 * Return type definition for the useAudioStream hook.
 */
interface UseAudioStreamReturn {
    isRecording: boolean;
    isMuted: boolean;
    /** True when VAD detects active speech. */
    isSpeaking: boolean;
    /** Starts microphone recording and processing. */
    startRecording: () => Promise<void>;
    /** Stops recording and closes audio contexts. */
    stopRecording: () => void;
    toggleMute: () => void;
    /** Queues and plays a base64 audio chunk. */
    playAudio: (base64Audio: string) => void;
    /** Immediately stops all audio playback. */
    stopPlayback: () => void;
}

/**
 * A hook for handling real-time audio input/output with Voice Activity Detection (VAD).
 * 
 * Features:
 * - MICROPHONE INPUT: Captures, downsamples, and encodes audio to base64.
 * - VAD (Voice Activity Detection): Detects speech vs. silence based on RMS threshold.
 * - PLAYBACK: Decodes and plays streaming audio chunks.
 * - ECHO CANCELLATION: Configures browser audio constraints for clear speech.
 * 
 * @param {UseAudioStreamOptions} options - Callbacks and config.
 * @returns {UseAudioStreamReturn} Controls and state.
 */
export function useAudioStream(options: UseAudioStreamOptions = {}): UseAudioStreamReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Audio context refs
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const nextPlayTimeRef = useRef<number>(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    // VAD refs
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSpeakingRef = useRef(false);
    const lastSpeechTimeRef = useRef<number>(0);

    // Store options in ref
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Use ref for mute state to avoid stale closures in audio processor
    const isMutedRef = useRef(isMuted);
    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    // VAD: Calculate RMS (volume level) of audio chunk
    const calculateRMS = useCallback((audioData: Float32Array): number => {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }, []);

    // VAD: Threshold for detecting speech (increased to reduce false positives from background noise)
    const SPEECH_THRESHOLD = 0.05;
    const SILENCE_THRESHOLD_MS = optionsRef.current.silenceThresholdMs || 400;

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
                // Check ref for current mute state
                if (isMutedRef.current) return;

                const inputData = event.inputBuffer.getChannelData(0);

                // VAD: Check if user is speaking
                const rms = calculateRMS(inputData);
                const isSpeakingNow = rms > SPEECH_THRESHOLD;

                if (isSpeakingNow) {
                    // User is speaking
                    lastSpeechTimeRef.current = Date.now();
                    if (!isSpeakingRef.current) {
                        isSpeakingRef.current = true;
                        setIsSpeaking(true);
                        console.log('🎙️ Speech started');
                        optionsRef.current.onSpeechStart?.(); // Notify that speech started
                    }
                    // Clear any pending silence timer
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                } else if (isSpeakingRef.current) {
                    // User was speaking but now silent - start silence timer
                    if (!silenceTimerRef.current) {
                        silenceTimerRef.current = setTimeout(() => {
                            if (isSpeakingRef.current) {
                                isSpeakingRef.current = false;
                                setIsSpeaking(false);
                                console.log('🎤 Speech ended - triggering onSpeechEnd');
                                optionsRef.current.onSpeechEnd?.();
                            }
                            silenceTimerRef.current = null;
                        }, SILENCE_THRESHOLD_MS);
                    }
                }

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
            console.log('🎤 Recording started with VAD enabled');

        } catch (error) {
            console.error('Failed to start recording:', error);
            throw error;
        }
    }, [isMuted, calculateRMS]); // logic remains the same, ref handles the internal state check

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

            // Track active source for interruption
            activeSourcesRef.current.add(source);
            source.onended = () => {
                activeSourcesRef.current.delete(source);
            };

            // Schedule playback to avoid gaps
            const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + buffer.duration;

        } catch (error) {
            console.error('Failed to play audio:', error);
        }
    }, []);

    // Stop all active audio playback immediately
    const stopPlayback = useCallback(() => {
        // Stop all active audio sources
        activeSourcesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Ignore errors from already stopped sources
            }
        });
        activeSourcesRef.current.clear();
        // Reset the playback queue time
        nextPlayTimeRef.current = 0;
        console.log('🔇 Audio playback stopped');
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
        isSpeaking,
        startRecording,
        stopRecording,
        toggleMute,
        playAudio,
        stopPlayback
    };
}
