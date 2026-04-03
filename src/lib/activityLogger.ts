import { supabase } from '@/integrations/supabase/client';

export async function logActivity(action: string, details: Record<string, any> = {}) {
  try {
    await supabase.rpc('log_activity', {
      _action: action,
      _details: details as any,
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
