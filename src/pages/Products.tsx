import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
  };

  const save = async () => {
    if (!name.trim()) return;
    const payload = { name, quantity: Number(quantity) };
    if (editId) {
      await supabase.from('products').update(payload).eq('id', editId);
      toast.success('تم التعديل');
    } else {
      await supabase.from('products').insert(payload);
      toast.success('تم الإضافة');
    }
    setOpen(false); setName(''); setQuantity('0'); setEditId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المنتجات والمخزون</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setName(''); setQuantity('0'); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة منتج</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editId ? 'تعديل منتج' : 'إضافة منتج'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم المنتج</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" /></div>
              <div><Label>عدد القطع</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-secondary border-border" /></div>
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
                <TableHead className="text-right">المنتج</TableHead>
                <TableHead className="text-right">المخزون</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="border-border">
                  <TableCell className="font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {p.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.quantity > 0 ? 'default' : 'destructive'}>
                      {p.quantity} قطعة
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(p.id); setName(p.name); setQuantity(String(p.quantity)); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
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
