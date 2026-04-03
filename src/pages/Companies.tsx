import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Companies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    setCompanies(data || []);
  };

  const save = async () => {
    if (!name.trim()) return;
    const payload = { name, agreement_price: Number(price) };
    if (editId) {
      await supabase.from('companies').update(payload).eq('id', editId);
      toast.success('تم التعديل');
    } else {
      await supabase.from('companies').insert(payload);
      toast.success('تم الإضافة');
    }
    setOpen(false); setName(''); setPrice('0'); setEditId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('companies').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الشركات</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setName(''); setPrice('0'); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة شركة</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editId ? 'تعديل شركة' : 'إضافة شركة'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم الشركة</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" /></div>
              <div><Label>سعر الاتفاق</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-secondary border-border" /></div>
              <Button onClick={save} className="w-full">{editId ? 'حفظ' : 'إضافة'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">سعر الاتفاق</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id} className="border-border">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.agreement_price} ج.م</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setName(c.name); setPrice(String(c.agreement_price)); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
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
