import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { isOwner } = useAuth();
  const [statuses, setStatuses] = useState<any[]>([]);

  // User creation
  const [userOpen, setUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserCode, setNewUserCode] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('courier');
  const [creatingUser, setCreatingUser] = useState(false);

  // Accounting password
  const [accountingPassword, setAccountingPassword] = useState('');
  const [currentAccountingPassword, setCurrentAccountingPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadStatuses();
    loadAccountingPassword();
  }, []);

  const loadStatuses = async () => {
    const { data } = await supabase.from('order_statuses').select('*').order('sort_order');
    setStatuses(data || []);
  };

  const loadAccountingPassword = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'accounting_password')
      .maybeSingle();
    if (data?.value) {
      setCurrentAccountingPassword(data.value);
      setAccountingPassword(data.value);
    }
  };

  const saveAccountingPassword = async () => {
    setSavingPassword(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'accounting_password', value: accountingPassword, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSavingPassword(false);
    if (error) {
      toast.error('فشل حفظ كلمة المرور');
      return;
    }
    setCurrentAccountingPassword(accountingPassword);
    // Clear session so password is required again
    sessionStorage.removeItem('accounting_verified');
    toast.success(accountingPassword ? 'تم حفظ كلمة مرور سيستم الحسابات' : 'تم إزالة كلمة المرور');
  };

  const createUser = async () => {
    if (!newUserName || !newUserCode) return;
    setCreatingUser(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/auth-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: 'create-user',
          userData: { full_name: newUserName, phone: newUserPhone, login_code: newUserCode, role: newUserRole }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('تم إنشاء المستخدم بنجاح');
      setUserOpen(false); setNewUserName(''); setNewUserPhone(''); setNewUserCode(''); setNewUserRole('courier');
    } catch (err: any) {
      toast.error(err.message || 'خطأ في إنشاء المستخدم');
    }
    setCreatingUser(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      {/* Accounting Password - Owner only */}
      {isOwner && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              كلمة مرور سيستم الحسابات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">حدد كلمة مرور للدخول إلى سيستم الحسابات. اتركها فارغة لإلغاء الحماية.</p>
            <div className="flex gap-2 items-end max-w-sm">
              <div className="flex-1 space-y-1">
                <Label>كلمة المرور</Label>
                <Input
                  type="text"
                  value={accountingPassword}
                  onChange={(e) => setAccountingPassword(e.target.value)}
                  className="bg-secondary border-border"
                  placeholder="أدخل كلمة المرور..."
                  dir="ltr"
                />
              </div>
              <Button onClick={saveAccountingPassword} disabled={savingPassword}>
                {savingPassword ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
            {currentAccountingPassword && (
              <p className="text-xs text-muted-foreground">كلمة المرور الحالية مفعّلة ✅</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order Statuses */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>حالات الأوردر</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">اللون</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell><Badge style={{ backgroundColor: s.color }}>{s.name}</Badge></TableCell>
                  <TableCell><div className="h-5 w-5 rounded" style={{ backgroundColor: s.color }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Management - Owner only */}
      {isOwner && (
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>إدارة المستخدمين</CardTitle>
            <Dialog open={userOpen} onOpenChange={setUserOpen}>
              <DialogTrigger asChild><Button size="sm"><UserPlus className="h-4 w-4 ml-1" />إضافة مستخدم</Button></DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>الاسم</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="bg-secondary border-border" /></div>
                  <div><Label>الهاتف</Label><Input value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} className="bg-secondary border-border" dir="ltr" /></div>
                  <div><Label>كود الدخول (كلمة المرور)</Label><Input value={newUserCode} onChange={(e) => setNewUserCode(e.target.value)} className="bg-secondary border-border" dir="ltr" /></div>
                  <div>
                    <Label>الصلاحية</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مسؤول (Admin)</SelectItem>
                        <SelectItem value="courier">مندوب (Courier)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createUser} className="w-full" disabled={creatingUser}>
                    {creatingUser ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
