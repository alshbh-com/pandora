import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Loader2 } from 'lucide-react';
import logo from '@/assets/logo.jpg';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    
    setLoading(true);
    setError('');
    
    const result = await login(password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
      
      <Card className="w-full max-w-sm border-border bg-card/80 backdrop-blur-xl shadow-glow relative z-10">
        <CardContent className="pt-8 pb-6 px-6">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={logo} alt="The Pilito" className="mx-auto h-24 w-24 rounded-2xl shadow-glow mb-4 object-cover" />
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              The Pilito
            </h1>
            <p className="text-sm text-muted-foreground mt-1">نظام إدارة الشحن</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pr-10 text-base bg-secondary/50 border-border focus:border-primary focus:ring-primary/30"
                dir="ltr"
                autoFocus
              />
            </div>
            
            {error && (
              <p className="text-sm text-destructive text-center bg-destructive/10 py-2 rounded-lg">{error}</p>
            )}
            
            <Button type="submit" className="w-full h-12 text-base font-semibold gradient-primary hover:opacity-90 transition-opacity border-0" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تسجيل الدخول'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
