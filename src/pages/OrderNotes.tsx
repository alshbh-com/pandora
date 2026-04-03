import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [notesRes, profilesRes, ordersRes] = await Promise.all([
      supabase.from('order_notes').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('orders').select('id, barcode, customer_name, tracking_id, customer_code, offices(name)'),
    ]);
    setNotes(notesRes.data || []);
    setProfiles(profilesRes.data || []);
    setOrders(ordersRes.data || []);
  };

  const getUser = (id: string) => profiles.find(p => p.id === id)?.full_name || 'غير معروف';
  const getOrder = (id: string) => orders.find(o => o.id === id);

  const toggleExpand = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = notes.filter(n => {
    if (!search.trim()) return true;
    const order = getOrder(n.order_id);
    const user = getUser(n.user_id);
    return n.note.includes(search) || user.includes(search) || order?.barcode?.includes(search) || order?.customer_name?.includes(search);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />ملاحظات الأوردرات
        </h1>
        <Badge variant="outline">{filtered.length} ملاحظة</Badge>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث في الملاحظات..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 bg-secondary border-border" />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الأوردر</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">كود المكتب</TableHead>
                  <TableHead className="text-right">اسم المكتب</TableHead>
                  <TableHead className="text-right">الملاحظة</TableHead>
                  <TableHead className="text-right">بواسطة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد ملاحظات</TableCell></TableRow>
                ) : filtered.map(n => {
                  const order = getOrder(n.order_id);
                  const isLong = n.note.length > 60;
                  const isExpanded = expandedNotes.has(n.id);
                  return (
                    <TableRow key={n.id} className="border-border">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(n.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="font-mono text-xs">{order?.barcode || order?.tracking_id || '-'}</TableCell>
                      <TableCell className="text-sm">{order?.customer_name || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{order?.customer_code || '-'}</TableCell>
                      <TableCell className="text-sm">{order?.offices?.name || '-'}</TableCell>
                      <TableCell className="text-sm max-w-[300px]">
                        <div className={isExpanded ? 'whitespace-pre-wrap break-words' : ''}>
                          {isExpanded || !isLong ? n.note : n.note.slice(0, 60) + '...'}
                        </div>
                        {isLong && (
                          <Button size="sm" variant="ghost" className="h-5 p-0 text-xs text-primary" onClick={() => toggleExpand(n.id)}>
                            {isExpanded ? <><ChevronUp className="h-3 w-3 ml-1" />تقليص</> : <><ChevronDown className="h-3 w-3 ml-1" />عرض المزيد</>}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{getUser(n.user_id)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
