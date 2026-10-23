import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { cachedAvatarUrl } from '@/features/orders/listCache';
import { supabase } from '@/lib/supabase';

// Overlay on the existing initials, preserving their layout and error fallback.
export function AvatarImage({ path, borderRadius }: { path?: string | null; borderRadius: number }) {
  const { session } = useAuth();
  const [image, setImage] = useState<{ path: string; userId: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    setImage(null);
    if (!path || !session) return;
    const userId = session.user.id;
    const resolve = async () => {
      const { data, error } = await supabase.storage.from('profile-avatars').createSignedUrl(path, 300);
      if (error) throw error;
      return data.signedUrl;
    };
    const request = /^https?:\/\//i.test(path) ? Promise.resolve(path) : cachedAvatarUrl(userId, path, resolve);
    void request.then(url => { if (active) setImage({ path, userId, url }); }).catch(() => {});
    return () => { active = false; };
  }, [path, session?.user.id]);
  if (!image || image.path !== path || image.userId !== session?.user.id) return null;
  return <Image accessibilityIgnoresInvertColors source={{ uri: image.url }} resizeMode="cover" style={[StyleSheet.absoluteFill, { borderRadius }]} onError={() => setImage(null)} />;
}
