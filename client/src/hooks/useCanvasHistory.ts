import { useState, useCallback } from 'react';
import { Node } from '@xyflow/react';

// Simplified node structure for history (only track position/id)
/**
 * Simplified node structure for history tracking.
 * Only tracks position and ID to save memory.
 */
type HistoryNode = {
    id: string;
    position: { x: number; y: number };
};

/**
 * A snapshot of the canvas state at a specific point in time.
 */
type HistorySnapshot = HistoryNode[];

/**
 * Return type definition for the useCanvasHistory hook.
 */
interface UseCanvasHistoryReturn {
    /** Stack of past states (undo source). */
    past: HistorySnapshot[];
    /** Stack of future states (redo source). */
    future: HistorySnapshot[];
    /** Captures the current state of nodes into the 'past' stack. */
    takeSnapshot: (nodes: Node[]) => void;
    /** Reverts to the previous state. Returns the restored nodes or null. */
    undo: (currentNodes: Node[]) => Node[] | null;
    /** Reapplies a reverted state. Returns the restored nodes or null. */
    redo: (currentNodes: Node[]) => Node[] | null;
    /** Whether undo is available. */
    canUndo: boolean;
    /** Whether redo is available. */
    canRedo: boolean;
    /** Clears both undo and redo stacks. */
    clearHistory: () => void;
}

const MAX_HISTORY = 50;

/**
 * A hook for managing undo/redo history for canvas nodes.
 * 
 * Features:
 * - Tracks position changes for nodes.
 * - Supports Undo and Redo operations.
 * - Caps history size to MAX_HISTORY (50) to prevent memory issues.
 * 
 * @returns {UseCanvasHistoryReturn} History management controls.
 */
export const useCanvasHistory = (): UseCanvasHistoryReturn => {
    const [past, setPast] = useState<HistorySnapshot[]>([]);
    const [future, setFuture] = useState<HistorySnapshot[]>([]);

    // Helper to extract relevant state from nodes
    const serializeNodes = (nodes: Node[]): HistorySnapshot => {
        return nodes.map(n => ({
            id: n.id,
            position: { ...n.position }
        }));
    };

    // Take a snapshot of the *current* state before a change happens
    // Or call this AFTER a change with the NEW state? 
    // STandard: Undo stack contains 'past states'.
    // When we make a change: Push CURRENT state to PAST. Clear FUTURE.
    const takeSnapshot = useCallback((nodes: Node[]) => {
        const snapshot = serializeNodes(nodes);
        setPast(prev => {
            const newPast = [...prev, snapshot];
            if (newPast.length > MAX_HISTORY) {
                return newPast.slice(newPast.length - MAX_HISTORY);
            }
            return newPast;
        });
        setFuture([]); // Clear redo stack on new action
    }, []);

    const undo = useCallback((currentNodes: Node[]) => {
        if (past.length === 0) return null;

        const newPast = [...past];
        const previousState = newPast.pop(); // Get last saved state

        if (!previousState) return null;

        // Current state becomes 'future'
        const currentSnapshot = serializeNodes(currentNodes);
        setFuture(prev => [...prev, currentSnapshot]);

        setPast(newPast);

        // Return recreated nodes based on history + current data
        // We only restore positions; we keep current data/data references
        return currentNodes.map(node => {
            const savedNode = previousState.find(p => p.id === node.id);
            if (savedNode) {
                return { ...node, position: savedNode.position };
            }
            return node;
        });
    }, [past]);

    const redo = useCallback((currentNodes: Node[]) => {
        if (future.length === 0) return null;

        const newFuture = [...future];
        const nextState = newFuture.pop(); // Get next state

        if (!nextState) return null;

        // Current state goes back to 'past'
        const currentSnapshot = serializeNodes(currentNodes);
        setPast(prev => [...prev, currentSnapshot]);

        setFuture(newFuture);

        return currentNodes.map(node => {
            const savedNode = nextState.find(f => f.id === node.id);
            if (savedNode) {
                return { ...node, position: savedNode.position };
            }
            return node;
        });
    }, [future]);

    const clearHistory = useCallback(() => {
        setPast([]);
        setFuture([]);
    }, []);

    return {
        past,
        future,
        takeSnapshot,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        clearHistory
    };
};
