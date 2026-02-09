import React, { useState, useEffect, useRef } from 'react';

/**
 * Props for the ThoughtStream component.
 */
interface ThoughtStreamProps {
    /** The complete text to display. */
    text: string;
    /** Whether the streaming is complete. */
    isComplete: boolean;
    /** Optional class name for styling. */
    className?: string;
}

/**
 * Renders text with a typewriter streaming effect.
 * 
 * Features:
 * - Types out text character by character.
 * - Randomizes typing speed for a natural feel.
 * - Skips animation if `isComplete` is true.
 * - Shows a pulsing cursor while typing.
 * 
 * @param {ThoughtStreamProps} props - The component props.
 */
export const ThoughtStream: React.FC<ThoughtStreamProps> = ({ text, isComplete, className = '' }) => {
    const [displayedText, setDisplayedText] = useState('');
    const indexRef = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // If complete, show everything immediately
    useEffect(() => {
        if (isComplete) {
            setDisplayedText(text);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }
    }, [isComplete, text]);

    // Streaming logic
    useEffect(() => {
        if (isComplete) return;

        const stream = () => {
            const currentLength = displayedText.length;
            const targetLength = text.length;

            if (currentLength < targetLength) {
                // Add next character
                const nextChar = text[currentLength];
                setDisplayedText(prev => prev + nextChar);

                // Randomize delay for "typing" feel (10-30ms)
                timeoutRef.current = setTimeout(stream, Math.random() * 20 + 10);
            }
        };

        if (text.length > displayedText.length) {
            stream();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [text, displayedText, isComplete]);

    return (
        <div className={`font-mono text-xs leading-relaxed ${className}`}>
            {displayedText}
            {!isComplete && (
                <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
            )}
        </div>
    );
};
