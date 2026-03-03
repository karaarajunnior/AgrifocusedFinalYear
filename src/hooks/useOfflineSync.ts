import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { getOfflineProductQueue, removeOfflineProductDraft } from '../utils/offlineProductQueue';
import { getOfflineOrderQueue, removeOfflineOrderDraft } from '../utils/offlineOrderQueue';

/**
 * Hook to handle offline/online transitions and background synchronization.
 */
export function useOfflineSync(onSyncComplete?: () => void) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Connection restored! Syncing pending data...', { icon: '🔄' });
            syncData();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.error('You are offline. Changes will be saved locally.', { icon: '📡' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check/sync if we just loaded and are online
        if (navigator.onLine) {
            syncData();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const syncData = async () => {
        const productQueue = getOfflineProductQueue();
        const orderQueue = getOfflineOrderQueue();

        if (productQueue.length === 0 && orderQueue.length === 0) return;

        let successCount = 0;

        // Sync Products
        for (const item of productQueue) {
            try {
                await api.post('/products', item.payload);
                removeOfflineProductDraft(item.id);
                successCount++;
            } catch (e) {
                console.error(`Sync: Failed to upload product ${item.id}`, e);
            }
        }

        // Sync Orders
        for (const item of orderQueue) {
            try {
                await api.post('/orders', item.payload);
                removeOfflineOrderDraft(item.id);
                successCount++;
            } catch (e) {
                console.error(`Sync: Failed to place order ${item.id}`, e);
            }
        }

        if (successCount > 0) {
            toast.success(`Successfully synced ${successCount} pending item(s)`);
            if (onSyncComplete) onSyncComplete();
        }
    };

    return { isOnline, syncData };
}
