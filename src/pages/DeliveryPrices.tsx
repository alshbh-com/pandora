import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DeliveryPrices() {
  const [offices, setOffices] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [filterOffice, setFilterOffice] = useState('all');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [price, setPrice] = useState('');
  const [pickupPrice, setPickupPrice] = useState('');

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from('delivery_prices').select('*, offices(name)').order('created_at', { ascending: false });
    setPrices(data || []);
  };

  const save = async () => {
    if (!officeId || !governorate.trim()) { toast.error('المكتب والمحافظة مطلوبين'); return; }
    const p = parseFloat(price) || 0;
    const pp = parseFloat(pickupPrice) || 0;
    if (editId) {
      await supabase.from('delivery_prices').update({ office_id: officeId, governorate, price: p, pickup_price: pp }).eq('id', editId);
      toast.success('تم التعديل');
    } else {
      await supabase.from('delivery_prices').insert({ office_id: officeId, governorate, price: p, pickup_price: pp });
      toast.success('تم الإضافة');
    }
    setOpen(false); resetForm(); load();
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('delivery_prices').delete().eq('id', id);
    toast.success('تم الحذف'); load();
  };

  const edit = (item: any) => {
    setEditId(item.id); setOfficeId(item.office_id); setGovernorate(item.governorate); setPrice(String(item.price)); setPickupPrice(String(item.pickup_price || 0)); setOpen(true);
  };

  const resetForm = () => { setEditId(null); setOfficeId(''); setGovernorate(''); setPrice(''); setPickupPrice(''); };

  const filtered = filterOffice === 'all' ? prices : prices.filter(p => p.office_id === filterOffice);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">أسعار التوصيل</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-2" />إضافة سعر</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editId ? 'تعديل سعر' : 'إضافة سعر توصيل'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>المكتب *</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="اختر مكتب" /></SelectTrigger>
                  <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المحافظة / المنطقة *</Label>
                <Input value={governorate} onChange={e => setGovernorate(e.target.value)} className="bg-secondary border-border" placeholder="مثال: القاهرة" />
              </div>
              <div className="space-y-2">
                <Label>سعر التوصيل (ج.م)</Label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-secondary border-border" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>البيك اب (ج.م)</Label>
                <Input type="number" value={pickupPrice} onChange={e => setPickupPrice(e.target.value)} className="bg-secondary border-border" placeholder="0" />
              </div>
              <Button onClick={save} className="w-full">{editId ? 'حفظ التعديل' : 'إضافة'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Select value={filterOffice} onValueChange={setFilterOffice}>
        <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue placeholder="فلتر بالمكتب" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل المكاتب</SelectItem>
          {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">المكتب</TableHead>
                <TableHead className="text-right">المحافظة / المنطقة</TableHead>
                <TableHead className="text-right">سعر التوصيل</TableHead>
                <TableHead className="text-right">البيك اب</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد أسعار</TableCell></TableRow>
              ) : filtered.map(item => (
                <TableRow key={item.id} className="border-border">
                  <TableCell className="font-medium">{item.offices?.name || '-'}</TableCell>
                  <TableCell>{item.governorate}</TableCell>
                  <TableCell className="font-bold">{item.price} ج.م</TableCell>
                  <TableCell className="font-bold">{item.pickup_price || 0} ج.م</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
