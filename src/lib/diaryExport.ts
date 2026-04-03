import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const RETURN_STATUSES = ['مرتجع', 'فرق شحن', 'عمولة التسليم', 'رفض دون شحن', 'غرامة مرتجع'];

function calcRow(dOrder: any) {
  const price = dOrder.orders?.price || 0;
  const status = dOrder.status_inside_diary;
  const partial = dOrder.partial_amount || 0;
  return {
    price,
    executed: status === 'تم التسليم' ? price : 0,
    postponed: status === 'مؤجل' ? price : 0,
    returned: status === 'تسليم جزئي' ? (price - partial) : (RETURN_STATUSES.includes(status) ? price : 0),
    partial: status === 'تسليم جزئي' ? partial : 0,
    shippingDiff: Number(dOrder.manual_shipping_diff) || 0,
    transferDelivery: Number(dOrder.manual_delivery_commission) || 0,
    refuseNoShipping: Number(dOrder.manual_reject_no_ship) || 0,
    returnPenalty: Number(dOrder.manual_return_penalty) || 0,
    pickup: Number(dOrder.manual_pickup) || 0,
    status,
    returnStatus: dOrder.manual_return_status || '',
  };
}

function calcOrangeRow(dOrder: any) {
  const order = dOrder.orders;
  const manualTotal = Number((dOrder as any).manual_total_amount);
  const manualShipping = Number((dOrder as any).manual_shipping_amount);
  const total = manualTotal > 0 ? manualTotal : (order?.price || 0) + (order?.delivery_price || 0);
  const shipping = manualShipping > 0 ? manualShipping : (order?.delivery_price || 0);
  const pickup = Number(dOrder.manual_pickup) || Number(order?.shipping_paid) || 0;
  const manualArrived = Number(dOrder.manual_arrived);
  let arrived = 0;
  if (manualArrived > 0) arrived = manualArrived;
  else if (dOrder.status_inside_diary === 'تم التسليم') arrived = total;
  else if (dOrder.status_inside_diary === 'تسليم جزئي') arrived = (dOrder.partial_amount || 0) + shipping;
  return { total, shipping, pickup, arrived, status: dOrder.status_inside_diary, returnStatus: dOrder.manual_return_status || '' };
}

export function exportDiaryToPDF(
  diary: any,
  diaryOrders: any[],
  officeName: string,
  sheet: 'financial' | 'orange' | 'both' = 'both'
) {
  const w = window.open('', '_blank');
  if (!w) return;

  const totals = diaryOrders.reduce((acc: any, d: any) => {
    const r = calcRow(d);
    return {
      price: acc.price + r.price, executed: acc.executed + r.executed, postponed: acc.postponed + r.postponed,
      returned: acc.returned + r.returned, partial: acc.partial + r.partial, shippingDiff: acc.shippingDiff + r.shippingDiff,
      transferDelivery: acc.transferDelivery + r.transferDelivery, refuseNoShipping: acc.refuseNoShipping + r.refuseNoShipping,
      returnPenalty: acc.returnPenalty + r.returnPenalty, pickup: acc.pickup + r.pickup,
    };
  }, { price: 0, executed: 0, postponed: 0, returned: 0, partial: 0, shippingDiff: 0, transferDelivery: 0, refuseNoShipping: 0, returnPenalty: 0, pickup: 0 });

  const orangeTotals = diaryOrders.reduce((acc: any, d: any) => {
    const r = calcOrangeRow(d);
    return { total: acc.total + r.total, shipping: acc.shipping + r.shipping, pickup: acc.pickup + r.pickup, arrived: acc.arrived + r.arrived };
  }, { total: 0, shipping: 0, pickup: 0, arrived: 0 });

  const extraDue = Number((diary as any).orange_extra_due) || 0;
  const extraDueReason = (diary as any).orange_extra_due_reason || '';
  const orangeClientDue = (orangeTotals.total + extraDue) - (orangeTotals.arrived + orangeTotals.shipping + orangeTotals.pickup);

  const cashEntries: number[] = Array.isArray((diary as any).cash_arrived_entries) ? (diary as any).cash_arrived_entries.map(Number).filter((n: number) => !isNaN(n)) : [];
  const totalCash = cashEntries.reduce((s: number, v: number) => s + v, 0);
  const balanceNum = Number((diary as any).balance) || 0;
  const previousDueNum = Number((diary as any).previous_due) || 0;
  const manualArrivedTotal = (diary as any).manual_arrived_total != null ? Number((diary as any).manual_arrived_total) : totals.executed;
  const diaryDiff = totals.price - totalCash;
  const finalDue = (diaryDiff + previousDueNum) - (balanceNum + manualArrivedTotal + totals.returned + totals.postponed + totals.pickup + totals.shippingDiff + totals.transferDelivery + totals.refuseNoShipping + totals.returnPenalty);
  const dueWithPostponed = finalDue + totals.postponed;
  const showPostponedDue = (diary as any).show_postponed_due !== false;

  const financialRows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    return `<tr>
      <td>${idx + 1}</td><td>${order?.customer_name || ''}</td><td>${dOrder.n_column || ''}</td>
      <td>${order?.barcode || order?.customer_code || ''}</td><td>${row.price}</td>
      <td>${row.executed || ''}</td><td>${row.postponed || ''}</td><td>${row.returned || ''}</td>
      <td>${row.partial || ''}</td><td>${row.pickup || ''}</td>
      <td>${row.shippingDiff || ''}</td><td>${row.transferDelivery || ''}</td>
      <td>${row.refuseNoShipping || ''}</td><td>${row.returnPenalty || ''}</td>
      <td>${row.status}</td>
      <td>${row.returnStatus}</td>
    </tr>`;
  }).join('');

  const orangeRows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const r = calcOrangeRow(dOrder);
    return `<tr>
      <td>${idx + 1}</td><td>${order?.barcode || ''}</td><td>${order?.customer_name || ''}</td>
      <td>${order?.address || ''}</td><td>${order?.quantity || 1}</td>
      <td>${r.total}</td><td>${r.shipping}</td><td>${r.pickup}</td><td>${r.arrived || ''}</td>
      <td>${dOrder.status_inside_diary}</td><td>${r.returnStatus}</td>
    </tr>`;
  }).join('');

  const printFinancial = sheet === 'financial' || sheet === 'both';
  const printOrange = sheet === 'orange' || sheet === 'both';

  const financialSection = printFinancial ? `
    <div class="section-title">📊 الشيت المالي</div>
    <table>
      <thead><tr>
        <th>#</th><th>الاسم</th><th>ن</th><th>الكود</th><th>السعر</th>
        <th>منفذ</th><th>نزول</th><th>مرتجع</th><th>تسليم جزئي</th><th>بيك اب</th>
        <th>فرق شحن</th><th>عمولة التسليم</th><th>رفض دون شحن</th><th>غرامة مرتجع</th>
        <th>الحالة</th><th>حالة المرتجع</th>
      </tr></thead>
      <tbody>${financialRows}
        <tr class="total-row">
          <td colspan="4">الإجمالي</td>
          <td>${totals.price}</td><td>${manualArrivedTotal}</td><td>${totals.postponed}</td>
          <td>${totals.returned}</td><td>${totals.partial}</td><td>${totals.pickup}</td>
          <td>${totals.shippingDiff}</td><td>${totals.transferDelivery}</td>
          <td>${totals.refuseNoShipping}</td><td>${totals.returnPenalty}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
    <div class="summary">
      <div><strong>الملخص المالي:</strong></div>
      <div>الواصل نقدي: ${totalCash} | الرصيد: ${balanceNum} | مستحق سابق: ${previousDueNum}</div>
      <div>فرق اليومية = ${totals.price} - ${totalCash} = <strong>${diaryDiff}</strong></div>
      <div>المستحق = (${diaryDiff} + ${previousDueNum}) - (${balanceNum} + ${manualArrivedTotal} + ${totals.returned} + ${totals.postponed} + ${totals.pickup} + ${totals.shippingDiff} + ${totals.transferDelivery} + ${totals.refuseNoShipping} + ${totals.returnPenalty}) = <strong>${finalDue}</strong></div>
      ${showPostponedDue ? `<div>المستحق بالنزول (المؤجل) = ${finalDue} + ${totals.postponed} = <strong>${dueWithPostponed}</strong></div>` : ''}
    </div>
  ` : '';

  const orangeSection = printOrange ? `
    ${printFinancial ? '<div class="page-break"></div>' : ''}
    <div class="header">The Pilito - ${officeName}</div>
    <div class="section-title">📋 الشيت البرتقالي</div>
    <table>
      <thead><tr>
        <th>#</th><th>الباركود</th><th>الاسم</th><th>العنوان</th><th>القطع</th>
        <th>الإجمالي</th><th>الشحن</th><th>بيك اب</th><th>الواصل</th>
        <th>الحالة</th><th>حالة المرتجع</th>
      </tr></thead>
      <tbody>${orangeRows}
        <tr class="total-row">
          <td colspan="5">الإجمالي</td>
          <td>${orangeTotals.total}</td><td>${orangeTotals.shipping}</td>
          <td>${orangeTotals.pickup}</td><td>${orangeTotals.arrived}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
    <div class="summary">
      <div><strong>حساب المستحق للعميل:</strong></div>
      ${extraDue > 0 ? `<div>مستحق إضافي: ${extraDue}${extraDueReason ? ` (${extraDueReason})` : ''}</div>` : ''}
      <div>المستحق للعميل = (${orangeTotals.total} + ${extraDue}) - (${orangeTotals.arrived} + ${orangeTotals.shipping} + ${orangeTotals.pickup}) = <strong>${orangeClientDue}</strong></div>
    </div>
  ` : '';

  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<title>${officeName} - يومية ${diary.diary_number}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; }
  .header { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 5px; }
  .sub { text-align: center; color: #666; margin-bottom: 10px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th, td { border: 1px solid #333; padding: 3px 5px; text-align: right; font-size: 9px; }
  th { background: #f0f0f0; font-weight: bold; }
  .total-row { background: #e8f4e8; font-weight: bold; }
  .section-title { font-size: 14px; font-weight: bold; margin: 15px 0 5px; padding: 5px; background: #f5f5f5; border: 1px solid #ccc; }
  .summary { margin-top: 8px; border: 2px solid #000; padding: 8px; font-size: 11px; }
  .summary div { margin: 3px 0; }
  .page-break { page-break-before: always; }
</style></head><body>
  <div class="header">The Pilito - ${officeName}</div>
  <div class="sub">يومية رقم ${diary.diary_number} | ${format(new Date(diary.diary_date), 'dd/MM/yyyy')} | ${diary.is_closed ? 'مقفولة' : 'مفتوحة'} | ${diaryOrders.length} أوردر</div>
  ${financialSection}
  ${orangeSection}
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

export function exportDiaryToExcel(diary: any, diaryOrders: any[], officeName: string) {
  const wb = XLSX.utils.book_new();

  // Financial sheet
  const financialRows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    return {
      '#': idx + 1, 'الاسم': order?.customer_name || '', 'ن': dOrder.n_column || '',
      'الكود': order?.barcode || order?.customer_code || '', 'السعر': row.price,
      'منفذ': row.executed || '', 'نزول': row.postponed || '', 'مرتجع': row.returned || '',
      'تسليم جزئي': row.partial || '', 'بيك اب': row.pickup || '',
      'فرق شحن': row.shippingDiff || '', 'عمولة التسليم': row.transferDelivery || '',
      'رفض دون شحن': row.refuseNoShipping || '', 'غرامة مرتجع': row.returnPenalty || '',
      'الحالة': row.status, 'حالة المرتجع': row.returnStatus,
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(financialRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'الشيت المالي');

  // Orange sheet
  const orangeRowsData = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const r = calcOrangeRow(dOrder);
    return {
      '#': idx + 1, 'الباركود': order?.barcode || '', 'الاسم': order?.customer_name || '',
      'العنوان': order?.address || '', 'القطع': order?.quantity || 1,
      'الإجمالي': r.total, 'الشحن': r.shipping, 'بيك اب': r.pickup, 'الواصل': r.arrived || '',
      'الحالة': dOrder.status_inside_diary, 'حالة المرتجع': r.returnStatus,
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(orangeRowsData);
  XLSX.utils.book_append_sheet(wb, ws2, 'الشيت البرتقالي');

  XLSX.writeFile(wb, `${officeName}-يومية-${diary.diary_number}.xlsx`);
}

export function shareDiaryWhatsApp(diary: any, diaryOrders: any[], officeName: string) {
  let text = `📋 *${officeName}* - يومية رقم ${diary.diary_number}\n`;
  text += `📅 ${format(new Date(diary.diary_date), 'dd/MM/yyyy')}\n`;
  text += `📊 حالة: ${diary.is_closed ? 'مقفولة' : 'مفتوحة'} | تجميد: ${diary.lock_status_updates ? 'نعم' : 'لا'}\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;

  const totals = { executed: 0, postponed: 0, returned: 0, partial: 0, price: 0 };

  diaryOrders.forEach((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    text += `${idx + 1}. ${order?.customer_name} | #${order?.barcode || '-'} | ${row.price} | ${row.status}\n`;
    totals.executed += row.executed;
    totals.postponed += row.postponed;
    totals.returned += row.returned;
    totals.partial += row.partial;
    totals.price += row.price;
  });

  text += `\n━━━━━━━━━━━━━━━━━━\n`;
  text += `📊 *الإجمالي* (${diaryOrders.length} أوردر)\n`;
  text += `💰 إجمالي السعر: ${totals.price}\n`;
  text += `✅ منفذ: ${totals.executed}\n`;
  text += `⏳ نزول: ${totals.postponed}\n`;
  text += `🔄 مرتجع: ${totals.returned}\n`;
  text += `📦 تسليم جزئي: ${totals.partial}\n`;

  window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

export function exportDiaryAsJSON(diary: any, diaryOrders: any[], officeName: string) {
  const payload = {
    office_name: officeName,
    diary_number: diary.diary_number,
    diary_date: diary.diary_date,
    is_closed: diary.is_closed,
    lock_status_updates: diary.lock_status_updates,
    orders: diaryOrders.map((dOrder: any) => {
      const order = dOrder.orders;
      const row = calcRow(dOrder);
      return {
        barcode: order?.barcode,
        customer_name: order?.customer_name,
        address: order?.address,
        price: order?.price,
        delivery_price: order?.delivery_price,
        quantity: order?.quantity,
        status_inside_diary: dOrder.status_inside_diary,
        partial_amount: dOrder.partial_amount,
        n_column: dOrder.n_column,
        calculations: row,
      };
    }),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diary-${diary.diary_number}-${officeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
