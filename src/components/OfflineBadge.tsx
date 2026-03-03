import { WifiOff, Clock } from 'lucide-react';

interface OfflineBadgeProps {
    timestamp?: string;
    isOffline: boolean;
}

export default function OfflineBadge({ timestamp, isOffline }: OfflineBadgeProps) {
    if (!isOffline) return null;

    return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200 shadow-sm animate-pulse mb-6">
            <WifiOff className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-wider">Offline Mode</span>
            {timestamp && (
                <>
                    <span className="h-3 w-px bg-amber-300 mx-1" />
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px] font-bold">
                            Cached: {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
