import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogOut, Package, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function OfficePortal() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [officeName, setOfficeName] = useState('');
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [canAddOrders, setCanAddOrders] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('office_id')
      .eq('id', user.id)
      .single();

    if (profile?.office_id) {
      setOfficeId(profile.office_id);
      const { data: office } = await supabase
        .from('offices')
        .select('name, can_add_orders')
        .eq('id', profile.office_id)
        .single();
      setOfficeName(office?.name || '');
      setCanAddOrders(office?.can_add_orders || false);
    }

    const { data: sts } = await supabase.from('order_statuses').select('*').order('sort_order');
    setStatuses(sts || []);

    if (profile?.office_id) {
      const { data: ords } = await supabase
        .from('orders')
        .select('*')
        .eq('office_id', profile.office_id)
        .order('created_at', { ascending: false });
      setOrders(ords || []);
    } else {
      setOrders([]);
    }

    setLoading(false);
  };

  const getStatusName = (statusId: string) => statuses.find(s => s.id === statusId)?.name || '-';
  const getStatusColor = (statusId: string) => statuses.find(s => s.id === statusId)?.color || '#6b7280';

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">بوابة المكتب</h1>
            {officeName && <p className="text-muted-foreground text-sm">{officeName}</p>}
          </div>
          <div className="flex gap-2">
            {canAddOrders && <AddOfficeOrderDialog officeId={officeId} onOrderAdded={loadData} />}
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">الباركود</TableHead>
                    <TableHead className="text-right">كود العميل</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">الشحن</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">جارٍ التحميل...</TableCell></TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                  ) : orders.map(o => (
                    <TableRow key={o.id} className="border-border">
                      <TableCell className="text-xs"><div className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString('ar-EG')}</div><div className="font-mono font-bold">{o.barcode || '-'}</div></TableCell>
                      <TableCell className="text-sm">{o.customer_code || '-'}</TableCell>
                      <TableCell className="font-medium text-sm">{o.customer_name}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{o.customer_phone}</TableCell>
                      <TableCell className="text-sm">{o.product_name}</TableCell>
                      <TableCell className="text-sm font-bold">{o.price} ج.م</TableCell>
                      <TableCell className="text-sm">{o.delivery_price} ج.م</TableCell>
                      <TableCell className="text-sm">{o.address || '-'}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: getStatusColor(o.status_id) }} className="text-xs text-white">
                          {getStatusName(o.status_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('ar-EG')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AddOfficeOrderDialog({ officeId, onOrderAdded }: { officeId: string | null; onOrderAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_code: '',
    product_name: '', quantity: '1', price: '0', delivery_price: '0',
    governorate: '', color: '', size: '', address: '',
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const totalCollection = (parseFloat(form.price) || 0) + (parseFloat(form.delivery_price) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error('اسم العميل ورقم الهاتف مطلوبين');
      return;
    }
    if (!officeId) {
      toast.error('لا يوجد مكتب مرتبط بحسابك');
      return;
    }

    setLoading(true);
    try {
      const fullAddress = [form.governorate, form.address].filter(Boolean).join(' - ');
      const { error } = await supabase.from('orders').insert({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_code: form.customer_code || null,
        product_name: form.product_name || 'بدون منتج',
        quantity: parseInt(form.quantity) || 1,
        price: parseFloat(form.price) || 0,
        delivery_price: parseFloat(form.delivery_price) || 0,
        color: form.color,
        size: form.size,
        address: fullAddress,
        office_id: officeId,
      });
      if (error) throw error;

      toast.success('تم إضافة الأوردر بنجاح');
      setForm({
        customer_name: '', customer_phone: '', customer_code: '',
        product_name: '', quantity: '1', price: '0', delivery_price: '0',
        governorate: '', color: '', size: '', address: '',
      });
      setOpen(false);
      onOrderAdded();
    } catch (err: any) {
      toast.error(err.message || 'حصل خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة أوردر</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader><DialogTitle>إضافة أوردر جديد</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم العميل *</Label>
              <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">رقم الهاتف *</Label>
              <Input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} className="bg-secondary border-border" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الكود (اختياري)</Label>
              <Input value={form.customer_code} onChange={e => set('customer_code', e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المحافظة</Label>
              <Input value={form.governorate} onChange={e => set('governorate', e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">العنوان</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} className="bg-secondary border-border" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">اسم المنتج</Label>
            <Input value={form.product_name} onChange={e => set('product_name', e.target.value)} className="bg-secondary border-border" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الكمية</Label>
              <Input type="number" min={1} value={form.quantity} onChange={e => set('quantity', e.target.value)}
                onFocus={e => { if (e.target.value === '1') set('quantity', ''); }}
                className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">السعر</Label>
              <Input type="number" min={0} value={form.price} onChange={e => set('price', e.target.value)}
                onFocus={e => { if (e.target.value === '0') set('price', ''); }}
                className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">سعر التوصيل</Label>
              <Input type="number" min={0} value={form.delivery_price} onChange={e => set('delivery_price', e.target.value)}
                onFocus={e => { if (e.target.value === '0') set('delivery_price', ''); }}
                className="bg-secondary border-border" />
            </div>
          </div>

          <div className="p-2 bg-secondary rounded border border-border text-center">
            <span className="text-xs text-muted-foreground">إجمالي التحصيل: </span>
            <span className="font-bold">{totalCollection} ج.م</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">اللون</Label>
              <Input value={form.color} onChange={e => set('color', e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المقاس</Label>
              <Input value={form.size} onChange={e => set('size', e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إضافة الأوردر'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
