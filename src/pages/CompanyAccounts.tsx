import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CompanyAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: companies } = await supabase.from('companies').select('*');
      if (!companies) return;

      const result = await Promise.all(companies.map(async (company) => {
        const { count: orderCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        const { data: orders } = await supabase
          .from('orders')
          .select('price, delivery_price')
          .eq('company_id', company.id);

        const totalWork = orders?.reduce((sum, o) => sum + Number(o.price), 0) || 0;

        const { data: payments } = await supabase
          .from('company_payments')
          .select('amount')
          .eq('company_id', company.id);

        const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        return {
          ...company,
          orderCount: orderCount || 0,
          totalWork,
          totalPaid,
          remaining: totalWork - totalPaid,
        };
      }));

      setAccounts(result);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">حسابات الشركات</h1>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">الشركة</TableHead>
                <TableHead className="text-right">عدد الأوردرات</TableHead>
                <TableHead className="text-right">إجمالي الشغل</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} className="border-border">
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.orderCount}</TableCell>
                  <TableCell>{a.totalWork} ج.م</TableCell>
                  <TableCell>{a.totalPaid} ج.م</TableCell>
                  <TableCell className={a.remaining > 0 ? 'text-amber-500 font-bold' : ''}>
                    {a.remaining} ج.م
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
