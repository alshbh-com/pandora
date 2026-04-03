import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';

// We'll use a soft-delete approach: orders with is_deleted = true go to trash
// Since we don't have is_deleted column, we'll use a convention:
// Trash items are stored in localStorage until we add a DB column
// For now, let's implement with a migration to add is_deleted

export default function TrashBin() {
  const { isOwner } = useAuth();
  const [trashedOrders, setTrashedOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setLoading(true);
    // Load soft-deleted orders from localStorage
    const trashIds: string[] = JSON.parse(localStorage.getItem('trash_order_ids') || '[]');
    if (trashIds.length === 0) {
      setTrashedOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .in('id', trashIds)
      .order('updated_at', { ascending: false });
    setTrashedOrders(data || []);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleAll = () => {
    if (selected.size === trashedOrders.length) setSelected(new Set());
    else setSelected(new Set(trashedOrders.map(o => o.id)));
  };

  const restoreSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // Remove from trash
    const trashIds: string[] = JSON.parse(localStorage.getItem('trash_order_ids') || '[]');
    const updated = trashIds.filter(id => !ids.includes(id));
    localStorage.setItem('trash_order_ids', JSON.stringify(updated));
    logActivity('استعادة أوردرات من سلة المحذوفات', { count: ids.length });
    toast.success(`تم استعادة ${ids.length} أوردر`);
    setSelected(new Set());
    loadTrash();
  };

  const permanentDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`حذف ${selected.size} أوردر نهائياً؟ لا يمكن التراجع!`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from('orders').delete().in('id', ids);
    if (error) { toast.error(error.message); return; }
    // Remove from trash
    const trashIds: string[] = JSON.parse(localStorage.getItem('trash_order_ids') || '[]');
    const updated = trashIds.filter(id => !ids.includes(id));
    localStorage.setItem('trash_order_ids', JSON.stringify(updated));
    logActivity('حذف نهائي من سلة المحذوفات', { count: ids.length });
    toast.success('تم الحذف نهائياً');
    setSelected(new Set());
    loadTrash();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">سلة المحذوفات</h1>
      <p className="text-sm text-muted-foreground">الأوردرات المحذوفة تبقى هنا حتى تحذفها نهائياً أو تستعيدها.</p>

      {selected.size > 0 && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={restoreSelected}>
            <RotateCcw className="h-4 w-4 ml-1" />استعادة ({selected.size})
          </Button>
          {isOwner && (
            <Button size="sm" variant="destructive" onClick={permanentDelete}>
              <Trash2 className="h-4 w-4 ml-1" />حذف نهائي ({selected.size})
            </Button>
          )}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-10"><Checkbox checked={trashedOrders.length > 0 && selected.size === trashedOrders.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
                ) : trashedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">سلة المحذوفات فارغة</TableCell></TableRow>
                ) : trashedOrders.map(o => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                    <TableCell className="text-sm">{o.customer_name}</TableCell>
                    <TableCell className="text-sm">{o.offices?.name || '-'}</TableCell>
                    <TableCell className="font-bold text-sm">{o.price} ج.م</TableCell>
                    <TableCell>
                      <Badge style={{ backgroundColor: o.order_statuses?.color }} className="text-xs">
                        {o.order_statuses?.name || '-'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}