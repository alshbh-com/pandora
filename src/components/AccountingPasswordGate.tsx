import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: React.ReactNode;
}

export default function AccountingPasswordGate({ children }: Props) {
  const { isOwner } = useAuth();
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // Check if already verified in this session
      const sessionVerified = sessionStorage.getItem('accounting_verified');
      if (sessionVerified === 'true') {
        setVerified(true);
        setLoading(false);
        return;
      }

      // Load stored password
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'accounting_password')
        .maybeSingle();

      setStoredPassword(data?.value || null);
      setLoading(false);

      // If no password is set, allow access (owner should set one)
      if (!data?.value) {
        setVerified(true);
        sessionStorage.setItem('accounting_verified', 'true');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = () => {
    if (password === storedPassword) {
      setVerified(true);
      sessionStorage.setItem('accounting_verified', 'true');
      toast.success('تم التحقق بنجاح');
    } else {
      toast.error('كلمة المرور غير صحيحة');
    }
  };

  if (loading) return null;
  if (verified) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent dir="rtl" className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              سيستم الحسابات محمي
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">أدخل كلمة المرور للدخول إلى سيستم الحسابات</p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور..."
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} className="w-full">دخول</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
