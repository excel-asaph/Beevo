import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * A lightweight error boundary component to catch React lifecycle errors.
 * 
 * Features:
 * - Catches errors in child component tree.
 * - Displays a user-friendly error UI.
 * - detailed stack trace (collapsible).
 */
export class SimpleErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] h-full bg-red-50 p-6 text-center text-red-900 overflow-auto">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="mb-4 text-sm font-medium">
                        {this.props.componentName ? `Error in ${this.props.componentName}` : "Component crashed"}
                    </p>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 w-full max-w-2xl text-left overflow-x-auto">
                        <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                            {this.state.error?.toString()}
                        </pre>
                        {this.state.errorInfo && (
                            <details className="mt-2">
                                <summary className="text-xs text-red-400 cursor-pointer hover:text-red-600">Stack Trace</summary>
                                <pre className="text-[10px] text-gray-500 mt-2 whitespace-pre-wrap">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
