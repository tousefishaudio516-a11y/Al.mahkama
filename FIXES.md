# سجل الإصلاحات — ai-court

كل الإصلاحات المذكورة في المراجعة طُبِّقت فعلياً على الكود. هذا ملخص بالملفات المتأثرة.

## 🔴 حرجة

### 1. تسريب `groundTruth` الكامل
- **`modules/cases/cases.service.ts`**: `generateCaseForRoom` تعيد الآن `PublicCaseSummary` فقط (`id/title/crimeType/setting`) بدل كائن `Case` الخام من Prisma.
- **`modules/cases/cases.controller.ts`**: تعليق صريح يمنع تغيير هذا لاحقًا بالخطأ.

### 2. لا Runtime Validation لمخرجات Claude
- **`modules/cases/ai/schemas.ts`** (جديد): مخططات Zod كاملة لـ groundTruth/dossier/consistency/content-policy، مع تحققات دلالية إضافية (فاعل حقيقي واحد بالضبط، متهم واحد بالضبط، الأدوار الأساسية موجودة، أسماء الشخصيات فريدة، `real_culprit_name` يطابق شخصية فعلية).
- **`modules/cases/ai/anthropic-client.service.ts`**: `generateValidated()` الجديدة تحلّل وتتحقق عبر Zod قبل إعادة أي بيانات، وترمي خطأ فوري وواضح عند أي مخالفة بدل السماح لها بالمرور بصمت.

### 3. افتراض وجود أدوار أساسية (judge/defendant/witness_main)
- **`schemas.ts`**: `superRefine` يفشل التحقق إن غاب أي من الأدوار الخمسة الأساسية، فتُعاد المحاولة تلقائيًا (لا تصل قضية ناقصة الأدوار للاعبين إطلاقًا).
- **`modules/players/role-assignment.service.ts`**: تحقق دفاعي إضافي يرمي `InternalServerErrorException` واضحًا بدل الانهيار الصامت إن حدث نقص رغم كل شيء.

### 4. لا Fallback عند فشل Claude
- **`modules/cases/ai/anthropic-client.service.ts`**: إعادة محاولة تلقائية (حتى مرتين) عند أخطاء 429/5xx/انقطاع شبكة تحديدًا (وليس عند أخطاء تنسيق الطلب).
- **`modules/cases/ai/fallback-case.ts`** (جديد): قضية احتياطية كاملة مكتوبة ومُراجَعة يدويًا، مطابقة لمخطط Zod ومتوافقة مع سياسات المحتوى.
- **`modules/cases/ai/case-generator.service.ts`**: عند فشل كل محاولات التوليد (`MAX_REGENERATION_ATTEMPTS`)، تُستخدم القضية الاحتياطية بدل رمي 500 وإيقاف اللعبة بالكامل.

### 5. حماية WebSocket غير مكتملة
- **`modules/gateway/rooms.gateway.ts`**: `cors: origin: '*'` أصبح يقرأ `CORS_ORIGIN` من env. `join_room` يتحقق أن `playerId` ينتمي فعلاً لهذه الغرفة في قاعدة البيانات قبل الربط. كل حدث لاحق (`mark_ready`, `trial_event`, `reveal_evidence`) يستخدم هوية اللاعب المرتبطة فعليًا بالـ socket (عبر Redis) بدل أي `playerId` يرسله العميل ضمن الحمولة — يمنع انتحال الهوية.
- **`common/redis/redis.service.ts`**: ربط عكسي `socket -> player` (`getPlayerForSocket`, `unbindSocket`) لدعم هذا التحقق.
- **`modules/trial/trial.service.ts`** و **`modules/verdict/verdict.service.ts`**: تحقق ملكية على مستوى الخدمة نفسها (`assertPlayerInRoom` / فحص `player.roomId === roomId`) — يحمي REST وWebSocket معًا، ويصلح ثغرة إضافية مكتشفة: القاضي/أي لاعب كان يستطيع نظريًا التصرف في غرفة ليست غرفته طالما يملك `playerId` صالحًا لأي غرفة.

## 🟠 مهمة

### 6. لا Rate Limiting
- **`app.module.ts`**: `ThrottlerModule` عام (60 طلب/دقيقة) مطبَّق عبر `APP_GUARD`.
- **`modules/cases/cases.controller.ts`**: حد أشد (3/دقيقة) على `POST /rooms/:roomId/case/generate` تحديدًا لأنها الأغلى تكلفة (حتى ~30 نداء Claude في أسوأ حالة).

### 7. لا Cleanup فعلي
- **`modules/cleanup/cleanup.service.ts` + `cleanup.module.ts`** (جديد): Cron فعلي عبر `@nestjs/schedule` — حذف غرف lobby المهجورة (>6 ساعات) كل ساعة، وحذف الغرف المنتهية (>48 ساعة) يوميًا، بترتيب حذف صحيح يحترم قيود FK.

### 8. فحص تشابه سطحي
- لم يُستبدل بالكامل (Embeddings/pgvector خارج نطاق هذا التصحيح كما اتفقنا)، لكن تُرك كما هو كنقطة انطلاق مقبولة مؤقتًا — موصى بترقيته لاحقًا فقط.

### 9. مطابقة ملفات الشخصيات بالاسم
- **`modules/cases/ai/case-generator.service.ts`** و **`cases.service.ts`**: المطابقة الآن بالفهرس (index) حصريًا، مضمونة الترتيب عبر `Promise.all` على نفس المصفوفة الأصلية. بالإضافة، `schemas.ts` يرفض أي قضية بأسماء شخصيات مكررة من الأساس.

### 10. `motive_category` = `"null"` نصية
- **`schemas.ts`**: `nullableEnumPreprocess` يحوّل السلسلة `"null"`/الفارغة/`undefined` إلى `null` فعلي قبل التحقق، فلا يصل أبدًا لـ Prisma بصيغة غير صالحة.

## 🟡 أداء وتكلفة

### 11/13. لا Cache + كل العمليات على نفس الموديل
- **`.env.example`**: `ANTHROPIC_MODEL_MAIN` و`ANTHROPIC_MODEL_VALIDATION` منفصلان وقابلان للتهيئة.
- **`anthropic-client.service.ts`**: خطوات ملف الشخصية الفردي وفحص الاتساق وفحص السياسة تستخدم `useValidationModel: true` (موديل أرخف قابل للتهيئة)، وتبقى الحقيقة الأساسية فقط على الموديل الرئيسي.
- Redis caching لنتائج التوليد لم يُنفَّذ (كل قضية فريدة أصلاً بحكم تصميم اللعبة، فالفائدة محدودة)، لكن البنية التحتية (`RedisService`) جاهزة لإضافته لاحقًا إن ظهرت حاجة فعلية (مثل إعادة توليد نفس الإعدادات).

## ملاحظات لم تُطبَّق (خارج نطاق هذا التصحيح، تحتاج قرار منتج)
- تنظيف سجلات `User` الخاصة بالضيوف (`isGuest: true`) القديمة — لم يُنفَّذ لتفادي فقدان `totalPoints` لمستخدمين قد يعودون؛ يحتاج قرارًا بشأن مدة الاحتفاظ.
- نظام مصادقة كامل (JWT) بدل الاعتماد على UUID كهوية ضمنية — التصحيح الحالي يسدّ ثغرة "الوثوق بأي قيمة من العميل" لكنه لا يستبدل تصميم الهوية بالكامل.

## تحديث لاحق: الانتقال من Claude إلى ChatGPT
- `modules/cases/ai/anthropic-client.service.ts` حُذف واستُبدل بـ **`modules/cases/ai/openai-client.service.ts`** (`OpenAiClientService`)، بنفس الواجهة العامة (`generateRaw`/`generateValidated`) فلم يتغيّر أي شيء في `schemas.ts` أو `case-generator.service.ts` أو خدمتي التحقق منطقيًا — فقط استُبدل مزوّد الاتصال.
- يستخدم `chat.completions.create` من حزمة `openai` الرسمية، مع `response_format: { type: 'json_object' }` (وضع JSON الصارم من OpenAI) لزيادة موثوقية الإخراج قبل التحقق عبر Zod (الذي يبقى ضروريًا؛ الوضع الصارم يضمن JSON صحيح تركيبيًا فقط، لا مطابقة المخطط الدلالي).
- كل استدعاء مستقل بالكامل (لا يُحمَّل أي سياق أو رسائل سابقة بين استدعاء وآخر) — أي أن كل توليد (حقيقة أساسية/ملف شخصية/تحقق) هو "محادثة جديدة" فعليًا بحسب طلبك.
- متغيرات البيئة الجديدة: `OPENAI_API_KEY`, `OPENAI_MODEL_MAIN` (افتراضي `gpt-4o`), `OPENAI_MODEL_VALIDATION` (افتراضي `gpt-4o-mini`) — تحقق من توفر هذه الأسماء لحسابك على platform.openai.com قبل التشغيل، فقد تتغير التسميات لاحقًا.
- التبعية `@anthropic-ai/sdk` أُزيلت من `package.json` واستُبدلت بـ `openai`.

## تحديث نهائي: الانتقال الكامل من AI حي إلى بنك قضايا ثابت (100 قضية جاهزة)
بعد اكتشاف وجود 100 قصة جاهزة مكتوبة يدويًا، تقرر التخلي عن أي توليد حي بالذكاء الاصطناعي نهائيًا:

- **حُذف بالكامل**: `modules/cases/ai/openai-client.service.ts`, `case-generator.service.ts`, `prompts.ts`, ومجلدا `consistency/` و`similarity/` بأكملهما (فحص الاتساق وفحص سياسة المحتوى والتشابه لم تعد ضرورية — القصص مكتوبة ومُراجَعة يدويًا مسبقًا).
- **مجلد جديد** `modules/cases/bank/` يحتوي:
  - `schemas.ts` — نفس مخططات Zod السابقة، لكنها الآن تتحقق من صحة كل قصة **وقت الاستيراد لمرة واحدة**، وليس وقت كل جلسة لعب.
  - `case-pattern.service.ts` — نفس منطق اختيار نمط الذنب/البراءة كما كان.
  - `fallback-case.ts` — قضية طوارئ وحيدة تُستخدم فقط إن كان البنك فارغًا تمامًا (لم يُستورَد شيء بعد).
  - `case-bank.service.ts` (**جديد**) — يستبدل `CaseGeneratorService` بالكامل: يختار قضية من جدول `case_templates` بدل أي توليد حي، مع تفضيل الأقل استخدامًا (`timesUsed`) وتجنّب إعادة نفس القضية على نفس الغرفة خلال آخر 5 جولات.
- **جدول Prisma جديد** `CaseTemplate` (`case_templates`): يخزّن كل قضية جاهزة (`groundTruth` + `dossiers` + `casePatternType`)، مع `isActive` (لتعطيل قضية بها خطأ لاحقًا دون حذفها) و`timesUsed` (لتوزيع عادل). حقل `sourceTemplateId` أُضيف لجدول `Case` لتتبع أي قضية من البنك استُخدمت في كل جولة فعلية.
- **سكربت استيراد جديد** `prisma/import-case-templates.ts` (شغّله عبر `npm run import:cases`): يقرأ كل ملفات `.json` من مجلد `case-bank-source/` (باستثناء الملفات التي تبدأ بـ `_`)، يتحقق من بنية كل قصة عبر Zod (يرفض أي قصة ناقصة الأدوار الأساسية، أو بأكثر/أقل من فاعل حقيقي واحد، أو بأسماء شخصيات مكررة — تمامًا كما كان يحدث وقت التوليد الحي، لكن الآن مرة واحدة فقط عند الاستيراد)، ويتخطى القصص المستورَدة مسبقًا (بمطابقة العنوان) لتفادي التكرار عند إعادة التشغيل.
- **ملف مرجعي** `case-bank-source/_TEMPLATE_EXAMPLE.json`: مثال كامل مبني على قضية "سرقة الصندوق الحديدي"، بنفس الشكل المطلوب بالضبط، مع تعليقات توضيحية (حقول تبدأ بـ `_شرح`) لمساعدتك على تنسيق الـ100 قصة الفعلية بنفس البنية.
- **إزالة تامة** لتبعية `openai` من `package.json`، ولكل متغيرات `OPENAI_*` من `.env`/`.env.example` — لا يوجد أي مفتاح API مطلوب بعد الآن، ولا أي اتصال خارجي في مسار اللعب الفعلي إطلاقاً.
- الحد الصارم (`@Throttle`) على `POST /rooms/:roomId/case/generate` خُفِّف من 3/دقيقة إلى 20/دقيقة، بما أنه لم يعد هناك تكلفة API لتفاديها — الحد المتبقي فقط لمنع سبام الكتابة في قاعدة البيانات.

### الخطوة التالية المطلوبة منك
نسّق الـ100 قصة (حتى لو كانت متفرقة حاليًا) بنفس شكل `_TEMPLATE_EXAMPLE.json`، ضع كل قصة في ملف `.json` منفصل داخل `case-bank-source/` (مثال: `case-001.json`)، ثم شغّل:
```bash
npx prisma migrate dev --name add_case_templates
npm run import:cases
```

## تحديث نهائي: بناء الواجهة الأمامية (apps/web) + إصلاحات خلفية اكتُشفت أثناء البناء

بناء الواجهة الفعلية كشف عدة ثغرات ونواقص لم تظهر إلا عند محاولة تشغيل تدفّق اللعبة كاملاً من طرف إلى طرف. كلها أُصلحت:

### 🔴 ثغرات/نواقص حرجة اكتُشفت وأُصلحت

1. **لا يوجد أي endpoint لاسترجاع شخصية اللاعب وملفه السري.** `RoleAssignmentService` تكتب في قاعدة البيانات لكن لا شيء كان يقرأ منها للاعب نفسه — شاشة "القراءة" لم تكن لتعمل إطلاقًا. أُضيف `PlayersController`/`PlayersService` جديدان (`GET /rooms/:roomCode/players/:playerId/me` و`GET /rooms/:roomCode/players`)، بتحقق ملكية صارم (لا يمكن لاعب قراءة ملف لاعب آخر).

2. **وضع "الهاتف الواحد" كان سيفشل بالكامل.** `ReadingService.initSingleDeviceReadingOrder()` معرّفة لكن لا تُستدعى من أي مكان — أول محاولة "إغلاق ملف" كانت سترمي خطأ "لم تبدأ مرحلة القراءة بعد". أُصلح بربطها فعليًا في `CasesService.generateCaseForRoom()` بعد توزيع الأدوار (مشروطة بـ `playMode === 'single_device'`). أُضيف أيضًا `GET /rooms/:roomCode/reading/current-turn` لمعرفة دور من الحالي (كانت الواجهة عاجزة عن معرفة ذلك بأي شكل).

3. **لا يوجد أي مؤقّت فعلي من جهة الخادم.** `RoomsGateway.broadcastRemainingTime()` و`TrialService.endTrialByTimeout()` معرّفتان لكن لا شيء يستدعيهما — المحاكمة كانت لن تنتهي تلقائيًا بانتهاء الوقت (20 دقيقة) إطلاقًا، ولا يصل أي بث `timer_update` لحظي لأي عميل. أُضيفت `TrialTimerService` جديدة (`modules/gateway/trial-timer.service.ts`) تعمل كل 3 ثوانٍ عبر `@Interval` من `@nestjs/schedule`، تبث الوقت المتبقي لكل غرفة في حالة `trial`، وتُنهي المحاكمة تلقائيًا (`endTrialByTimeout` + بث `trial_ended`) عند وصول الوقت للصفر.

4. **أفعال WebSocket الأساسية (تصريح، كشف دليل، تسجيل جاهزية، إنهاء مبكر) كانت تُستدعى عبر REST في التصميم الأصلي للواجهة، فلا تصل لأي لاعب آخر لحظيًا.** البث الفعلي (`trial_event_broadcast`, `evidence_revealed`, `ready_update`, `trial_ended`) موجود فقط داخل معالجات الـ WebSocket، لا داخل الـ REST controllers المقابلة. الحل: الواجهة الآن تستخدم `socket.emit(...)` مباشرة لهذه الأربعة أفعال تحديدًا (بدل REST)، مع نمط **Ack** جديد ({ok, data|error}) يعيده كل معالج WebSocket كقيمة إرجاع — ضروري لأن استثناءات NestJS (كـ `ForbiddenException`) لا تصل تلقائيًا للعميل عبر Socket كما تصل عبر HTTP؛ بدونه كانت أي محاولة غير مصرَّح بها (مثلاً غير القاضي يحاول إنهاء المحاكمة) ستفشل بصمت تام من منظور المُرسِل. أُضيف أيضًا حدث WebSocket جديد `end_trial_early` لم يكن موجودًا (كان REST فقط بلا أي بث لباقي اللاعبين).

5. **إنشاء غرفة جماعية (multiplayer) لم يكن يعيد قائمة اللاعبين إطلاقًا.** `RoomsService.createRoom()` في مسار multiplayer كان يُعيد `{...updatedRoom, hostUserId}` مباشرة من نتيجة `prisma.room.update()` بلا `include: {players: true}` — أي أن الواجهة لم تكن لتعرف أبدًا معرّف RoomPlayer الخاص بالمضيف نفسه فور الإنشاء. أُصلح باستدعاء `this.getRoomByCode(code)` بدل ذلك (نفس الشكل المُستخدم في كل مسار آخر بالتطبيق أصلاً).

6. **نقطة توليد القضية (`POST /rooms/:roomId/case/generate`) كانت مفتوحة بلا أي تحقق عضوية.** أي شخص يعرف `roomId` (UUID) فقط، حتى لو لم يكن أي لاعب مشارك في تلك الغرفة إطلاقًا، كان يستطيع استدعاءها. أُضيف تحقق اختياري (`requestingPlayerId` في جسم الطلب) يتأكد من انتماء الطالب لتلك الغرفة تحديدًا قبل التنفيذ. (ملاحظة: هذا تحقق "عضو في الغرفة"، وليس "المضيف تحديدًا" — مفهوم "المضيف" لوضع `single_device` غير موجود كحقل صريح على أي `RoomPlayer` في المخطط الحالي، فتقييده لصلاحية "المضيف فقط" يحتاج تصميم مخطط إضافي لاحقًا إن أردت ذلك.)

### الملفات الجديدة (الخادم)
- `modules/players/players.service.ts`, `modules/players/players.controller.ts`
- `modules/gateway/trial-timer.service.ts`

### الملفات الجديدة (الواجهة — `apps/web/`)
مشروع React + Vite + TypeScript كامل: `src/pages/{Home,Lobby,Reading,Trial,Verdict,Reveal}.tsx`، `src/api/{client,socket}.ts`، `src/state/IdentityContext.tsx` (هوية اللاعب محفوظة في `localStorage` — هذا مشروع مستقل يعمل في متصفح المستخدم الفعلي، وليس بيئة Artifacts، فاستخدام `localStorage` هنا سليم ومقصود)، `src/styles/global.css` (هوية بصرية "ملف القضية": خلفية حبرية داكنة، بطاقات بلون الورق القديم لعرض الملفات السرية، لمسة نحاسية قضائية، أحمر خافت للتنبيهات/الأدلة الحاسمة)، إضافة إلى `netlify.toml`, `_redirects`, `.env.example`.

راجع قسم "النشر" في `README.md` الجذري لتعليمات Netlify (الواجهة) وRender (الخادم) كاملة.
