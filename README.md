# AI Court — لعبة "محكمة الذكاء" (Backend + Frontend)

مشروع كامل من جزأين:

```
ai-court/
├── apps/
│   ├── server/   # الخادم (NestJS) — REST + WebSocket + قاعدة البيانات
│   └── web/      # الواجهة الأمامية (React + Vite) — تُنشر على Netlify
├── FIXES.md      # سجل كامل لكل الإصلاحات والتغييرات المعمارية عبر تطور المشروع
└── README.md     # هذا الملف
```

## البنية الفنية

**الخادم (`apps/server`):**
- NestJS 10 + TypeScript
- PostgreSQL 16 + Prisma ORM
- Redis (حالة WebSocket اللحظية)
- Socket.IO (اتصال لحظي)
- **توليد القضايا:** بنك قضايا ثابت مكتوب يدويًا — **لا يوجد أي استدعاء API خارجي بأي شكل، صفر تكلفة تشغيلية**

**الواجهة (`apps/web`):**
- React 18 + TypeScript + Vite
- React Router (تنقّل بين الشاشات)
- Socket.IO Client (بث لحظي)
- تصميم عربي RTL كامل، بلا أي مكتبة UI خارجية (CSS خام مع نظام تصميم موحّد)

## ⚠️ لماذا لا يمكن نشر كل شيء على Netlify

**Netlify يستضيف الواجهة الأمامية فقط.** الخادم الخلفي (`apps/server`) يحتاج:
- اتصال WebSocket دائم (Socket.IO) — Netlify Functions قصيرة العمر (Serverless) ولا تدعم هذا.
- اتصال مستمر بـ Redis وPostgreSQL.

لذلك: **الواجهة على Netlify، والخادم على استضافة تدعم Node.js دائمًا** (Render مُوصى به لطبقته المجانية).

---

## النشر: الواجهة على Netlify

1. من لوحة Netlify: **Add new site → Import an existing project**، اختر مستودع Git الذي يحتوي هذا المشروع.
2. إعدادات البناء ستُقرأ تلقائيًا من `netlify.toml` (موجود في جذر المشروع):
   - Base directory: `apps/web`
   - Build command: `npm install && npm run build`
   - Publish directory: `apps/web/dist`
3. أضف متغيرات البيئة (Site settings → Environment variables):
   - `VITE_API_URL` = رابط خادمك بعد نشره على Render (مثال: `https://ai-court-server.onrender.com`)
   - `VITE_SOCKET_URL` = نفس الرابط
4. Deploy. بعد نجاح النشر ستحصل على رابط مثل `https://ai-court.netlify.app`.
5. **مهم:** ارجع لخادم Render وأضف رابط Netlify هذا إلى `CORS_ORIGIN` في متغيرات بيئته، وإلا سيرفض الخادم كل الطلبات القادمة من الواجهة (خطأ CORS في المتصفح).

## النشر: الخادم على Render (مجاني)

1. من لوحة Render: **New → Web Service**، اربط نفس المستودع.
2. الإعدادات:
   - Root directory: `apps/server`
   - Build command: `npm install && npx prisma generate && npm run build`
   - Start command: `npm run start:prod` (أو `node dist/main.js` حسب سكربتات `package.json`)
3. أضف متغيرات البيئة (كلها من `.env.example`): `DATABASE_URL` (رابط Supabase)، `REDIS_URL` (استخدم Redis Cloud المجاني أو Upstash)، `CORS_ORIGIN` (رابط Netlify)، `APP_BASE_URL` (رابط Render نفسه).
4. بعد أول نشر ناجح، شغّل مرة واحدة عبر Render Shell (أو محليًا موصولاً بنفس `DATABASE_URL`):
   ```bash
   npx prisma migrate deploy
   npm run import:cases
   ```

---

## البدء السريع محليًا (الخادم)

```bash
cd apps/server
npm install
cp .env.example .env   # ثم عدّل DATABASE_URL و REDIS_URL
npx prisma migrate dev --name init
npm run import:cases   # يستورد قضايا case-bank-source/*.json
npm run start:dev      # يعمل على http://localhost:3000
```

## البدء السريع محليًا (الواجهة)

```bash
cd apps/web
npm install
cp .env.example .env   # القيم الافتراضية تكفي للتطوير المحلي (localhost:3000)
npm run dev             # يعمل على http://localhost:5173
```

---

## المسارات والـ WebSocket (الخادم)

### REST API

**الغرف:**
- `POST /rooms` — إنشاء غرفة (جماعية أو هاتف واحد)
- `POST /rooms/join` — الانضمام لغرفة جماعية بكود
- `GET /rooms/:code` — معلومات الغرفة + قائمة اللاعبين

**اللاعبون:**
- `GET /rooms/:roomCode/players` — قائمة عامة باللاعبين وحالة جاهزيتهم (بلا أي بيانات سرية)
- `GET /rooms/:roomCode/players/:playerId/me` — شخصية اللاعب وملفه السري وأدلته (محمي: للاعب نفسه فقط)

**القضايا:**
- `POST /rooms/:roomId/case/generate` — اختيار قضية من البنك الثابت وتوزيع الأدوار

**المحاكمة:**
- `POST /rooms/:roomCode/ready` — وضع جماعي: اللاعب جاهز (REST احتياطي؛ الواجهة تستخدم Socket فعليًا للبث اللحظي)
- `GET /rooms/:roomCode/reading/current-turn` — وضع هاتف واحد: دور من الحالي
- `POST /rooms/:roomCode/reading/close-file` — وضع هاتف واحد: أغلقت الملف، التالي
- `GET /rooms/:roomCode/trial/remaining` — الوقت المتبقي بالثواني

**الحكم والكشف:**
- `POST /rooms/:roomId/verdict` — إصدار الحكم (القاضي فقط)
- `GET /rooms/:roomId/reveal` — كشف الحقيقة الكاملة (بعد الحكم فقط، وإلا 403)

### WebSocket (namespace `/rooms`)

**Emit من العميل (مع Ack — كل حدث يعيد `{ok, data|error}`):**
- `join_room` `{roomCode, playerId}`
- `mark_ready` `{roomCode, playerId}`
- `close_file` `{roomCode}`
- `trial_event` `{roomId, roomCode, event: {actorPlayerId, eventType, content}}`
- `reveal_evidence` `{roomId, roomCode, evidenceId, actorPlayerId}`
- `end_trial_early` `{roomId, roomCode, judgePlayerId}`

**Listen من الخادم:**
- `player_joined`, `ready_update`, `trial_started`, `trial_event_broadcast`, `evidence_revealed`, `timer_update` (كل 3 ثوانٍ أثناء المحاكمة)، `trial_ended`, `advance_to_next_local_player`

---

## المبادئ الأمنية الأساسية

⚠️ **لا يُرسَل `ground_truth` أو `correct_verdict` للعميل قبل مرحلة الكشف الرسمية** (`GET /rooms/:roomId/reveal`، والتي بدورها ترفض العمل قبل وجود حكم مُصدَر).

- كل حدث WebSocket يتحقق أن الـ `playerId` المُستخدم مربوط فعليًا بالـ socket المُرسِل (لا يمكن انتحال هوية لاعب آخر).
- كل إجراء على مستوى الخدمة (تسجيل حدث، كشف دليل، إصدار حكم، إنهاء محاكمة) يتحقق أن اللاعب ينتمي فعلاً لهذه الغرفة تحديدًا.
- Rate limiting عام (60 طلب/دقيقة) + تنظيف تلقائي دوري للغرف المهجورة/المنتهية.

## متغيرات البيئة (الخادم)

| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | اتصال PostgreSQL (Supabase مثلاً) |
| `REDIS_URL` | اتصال Redis |
| `CORS_ORIGIN` | روابط الواجهة المسموحة، مفصولة بفواصل (REST + WebSocket معًا) |
| `APP_BASE_URL` | رابط الخادم نفسه (يُستخدم في بناء رابط الدعوة + QR) |
| `PORT` | منفذ الخادم (Render يضبطه تلقائيًا عادة) |

## متغيرات البيئة (الواجهة)

| المتغير | الوصف |
|---|---|
| `VITE_API_URL` | رابط الخادم (REST) |
| `VITE_SOCKET_URL` | رابط الخادم (WebSocket، عادة نفس `VITE_API_URL`) |

## الخطوات التالية المقترحة

- [ ] اختبارات وحدة وتكامل
- [ ] نظام مصادقة حقيقي (بدل هوية RoomPlayer كـ UUID ضمني)
- [ ] لوحة صدارة عبر الجولات المتعددة
- [ ] دعم إعادة الاتصال بعد انقطاع الإنترنت أثناء اللعب

## الترخيص

جميع الحقوق محفوظة © 2024 AI Court.
