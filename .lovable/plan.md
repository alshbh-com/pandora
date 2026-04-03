

## المشكلة

عند تقفيل أوردرات المندوب (من صفحة المناديب أو تحصيلات المناديب)، يتم تعيين `is_closed = true` على الأوردر. هذا يجعل الأوردر يختفي من **حسابات المكاتب** لأن الصفحة تفلتر فقط الأوردرات اللي `is_closed = false`.

النتيجة: الأوردرات المقفلة بتروح للأوردرات القديمة بدل ما تظهر في حسابات المكاتب، فالمستخدم مش بيقدر يحسب مع المكتب.

## الحل

فصل مفهوم "تقفيل المندوب" عن "تقفيل المكتب" بإضافة عمود جديد `is_courier_closed` للأوردرات.

### التغييرات المطلوبة

**1. Migration: إضافة عمود `is_courier_closed`**
- إضافة عمود `is_courier_closed boolean default false` لجدول `orders`
- تحديث الأوردرات الحالية المقفلة اللي ليها `courier_id` بحيث `is_courier_closed = true`

**2. تعديل عمليات تقفيل المندوب**
- في `Couriers.tsx` و `CourierCollections.tsx`: تغيير التقفيل ليعمل `is_courier_closed = true` بدلاً من `is_closed = true`
- الأوردر يختفي من المندوب لكن يفضل ظاهر في حسابات المكاتب

**3. تعديل صفحة حسابات المكاتب (`OfficeAccounts.tsx`)**
- تغيير الفلتر من `is_closed = false` إلى عرض الأوردرات اللي `is_closed = false` (بغض النظر عن `is_courier_closed`)
- كده الأوردرات المقفلة من المندوب هتظهر في حسابات المكاتب

**4. تعديل صفحة أوردرات المندوب**
- إخفاء الأوردرات اللي `is_courier_closed = true` من عند المندوب

**5. تعديل صفحة الأوردرات القديمة**
- الأوردرات القديمة تبقى فقط اللي `is_closed = true` (التقفيل النهائي بعد حساب المكتب)

### الملفات المتأثرة
- Migration SQL جديد
- `src/pages/Couriers.tsx` — تقفيل المندوب يستخدم `is_courier_closed`
- `src/pages/CourierCollections.tsx` — نفس التعديل
- `src/pages/OfficeAccounts.tsx` — الفلتر يبقى كما هو (is_closed = false) فالأوردرات المقفلة من المندوب هتظهر
- `src/pages/Orders.tsx` — التقفيل الرئيسي يبقى `is_closed = true` (تقفيل نهائي)
- `src/pages/CourierOrders.tsx` — إخفاء الأوردرات اللي `is_courier_closed = true`

