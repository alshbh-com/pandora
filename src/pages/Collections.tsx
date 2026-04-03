import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('courier_collections')
        .select('*, orders(tracking_id)')
        .order('created_at', { ascending: false })
        .limit(100);
      setCollections(data || []);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">التحصيلات</h1>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">الأوردر</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">لا توجد تحصيلات</TableCell></TableRow>
              ) : collections.map((c) => (
                <TableRow key={c.id} className="border-border">
                  <TableCell className="font-mono text-xs">{c.orders?.tracking_id || '-'}</TableCell>
                  <TableCell>{c.amount} ج.م</TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString('ar-EG')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
