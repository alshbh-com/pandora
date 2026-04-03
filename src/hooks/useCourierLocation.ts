import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that sends the courier's GPS location to the DB every 30 seconds.
 * Returns a promise that resolves once the first location is acquired,
 * or rejects if the user denies permission.
 */
export function useCourierLocation(userId: string | undefined) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPos = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  useEffect(() => {
    if (!userId || !navigator.geolocation) return;

    const sendLocation = async () => {
      const pos = latestPos.current;
      if (!pos) return;
      await supabase.from('courier_locations' as any).upsert({
        courier_id: userId,
        latitude: pos.lat,
        longitude: pos.lng,
        accuracy: pos.accuracy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'courier_id' });
    };

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPos.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    // Send to DB every 30 seconds
    sendLocation(); // initial
    intervalRef.current = setInterval(sendLocation, 30000);

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);
}
