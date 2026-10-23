import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { requireOptionalNativeModule } from 'expo';
import { Alert, Linking, Platform } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';

export type Coordinates = { latitude: number; longitude: number };
type State = { coordinates: Coordinates | null; locating: boolean; error: string; locate: () => Promise<Coordinates | null> };
const Context = createContext<State | null>(null);

export function LocationProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return <AccountLocationProvider key={session?.user.id ?? 'signed-out'}>{children}</AccountLocationProvider>;
}

function AccountLocationProvider({ children }: PropsWithChildren) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const pending = useRef<Promise<Coordinates | null> | null>(null);
  const locate = useCallback(() => {
    if (pending.current) return pending.current;
    setLocating(true); setError('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const task = Promise.resolve().then(async () => {
      try {
        if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoLocation')) {
          throw new Error('Bản ứng dụng này chưa có GPS. Cần build và cài lại Makko để dùng vị trí. Bạn vẫn có thể xem đơn và nhập địa chỉ thủ công.');
        }
        const Location = await import('expo-location');
        if (!await Location.hasServicesEnabledAsync()) throw new Error('Dịch vụ định vị đang tắt. Hãy bật Dịch vụ định vị trên điện thoại rồi thử lại.');
        let permission = await Location.getForegroundPermissionsAsync();
        if (!alive.current) return null;
        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (!alive.current) return null;
        if (!permission.granted) {
          if (!permission.canAskAgain && Platform.OS !== 'web') {
            Alert.alert('Cho phép truy cập vị trí',
              'Makko cần vị trí để tìm đơn gần bạn hoặc lưu nơi nhận hàng. Bạn có thể bật quyền vị trí trong Cài đặt, sau đó quay lại và thử lại.', [
                { text: 'Để sau', style: 'cancel' },
                { text: 'Mở Cài đặt', onPress: () => {
                  void Linking.openSettings().catch(() => {
                    if (alive.current) setError('Không mở được Cài đặt. Vui lòng mở Cài đặt của điện thoại để kiểm tra quyền vị trí.');
                  });
                } },
              ]);
            throw new Error('Quyền vị trí chưa được cho phép. Chọn Mở Cài đặt trong thông báo để bật quyền.');
          }
          throw new Error('Bạn chưa cho phép dùng vị trí. Bấm Dùng vị trí hiện tại để thử lại; bạn vẫn có thể nhập địa chỉ thủ công.');
        }
        const position = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Lấy vị trí quá lâu. Vui lòng thử lại ở nơi có tín hiệu GPS.')), 20000); }),
        ]);
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (!alive.current) return null;
        setCoordinates(point);
        return point;
      } catch (failure) {
        if (!alive.current) return null;
        setCoordinates(null);
        setError(failure instanceof Error ? failure.message : 'Không lấy được vị trí hiện tại.');
        return null;
      } finally {
        clearTimeout(timeout); if (alive.current) setLocating(false); pending.current = null;
      }
    });
    pending.current = task;
    return task;
  }, []);
  return <Context.Provider value={{ coordinates, locating, error, locate }}>{children}</Context.Provider>;
}

export function useCurrentLocation() {
  const value = useContext(Context);
  if (!value) throw new Error('LocationProvider is required');
  return value;
}
