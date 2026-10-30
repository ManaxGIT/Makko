import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchWeeklyResource, weeklyResourceEntry } from '@/features/orders/listCache';
export function useFoodResource<T>(key: string, read: (userId: string) => Promise<T>, freshMs = 30000, poll = false) {
    const { session } = useAuth();
    const userId = session?.user.id ?? 'signed-out';
    const entry = weeklyResourceEntry<T>(userId, key);
    const [data, setData] = useState<T | undefined>(entry.data), [fetching, setFetching] = useState(false), [error, setError] = useState('');
    // Query keys include every changing argument. Retain that key's reader so an
    // old callback cannot load a new query into the old cache entry.
    const readForKey = useMemo(() => read, [userId, key]);
    const active = useRef(false), generation = useRef(0);
    const refresh = useCallback(async (force = false) => {
        if (userId === 'signed-out')
            return;
        const target = weeklyResourceEntry<T>(userId, key);
        if (target.data !== undefined && !force && Date.now() - target.updatedAt < freshMs) {
            if (active.current) {
                setData(target.data);
                setFetching(false);
                setError('');
            }
            return;
        }
        const version = ++generation.current;
        if (active.current) {
            setFetching(true);
            setError('');
            if (target.data !== undefined)
                setData(target.data);
        }
        try {
            const result = await fetchWeeklyResource(userId, key, () => readForKey(userId));
            if (result !== null && active.current && version === generation.current)
                setData(result);
        }
        catch (failure) {
            if (active.current && version === generation.current)
                setError(failure instanceof Error ? failure.message : 'Không tải được dữ liệu. Vui lòng thử lại.');
        }
        finally {
            if (active.current && version === generation.current)
                setFetching(false);
        }
    }, [userId, key, freshMs, readForKey]);
    useFocusEffect(useCallback(() => {
        active.current = true;
        setFetching(false);
        setData(weeklyResourceEntry<T>(userId, key).data);
        void refresh();
        let timer: ReturnType<typeof setInterval> | undefined;
        const start = () => { if (poll && !timer && AppState.currentState === 'active')
            timer = setInterval(() => void refresh(true), 15000); };
        const stop = () => { if (timer)
            clearInterval(timer); timer = undefined; };
        start();
        const subscription = poll ? AppState.addEventListener('change', state => { stop(); if (state === 'active') {
            void refresh(true);
            start();
        } }) : undefined;
        return () => { active.current = false; generation.current++; stop(); subscription?.remove(); };
    }, [userId, key, refresh, poll]));
    return { data, error, fetching, refresh, setData };
}
