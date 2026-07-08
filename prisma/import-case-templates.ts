/**
 * يستورد كل قضايا البنك من مجلد case-bank-source/*.json إلى جدول case_templates.
 * كل ملف يجب أن يحتوي: { groundTruth: {...}, dossiers: [...] } بنفس بنية GroundTruth/Dossier
 * (راجع src/modules/cases/bank/schemas.ts و case-bank-source/_TEMPLATE_EXAMPLE.json كمرجع).
 *
 * التحقق هنا عبر Zod يحل محل ما كان "فحص الاتساق" و"فحص سياسة المحتوى" يفعلانه وقت
 * التوليد الحي بالذكاء الاصطناعي — الآن يحدث مرة واحدة وقت الاستيراد بدل كل جلسة لعب.
 * أي ملف يفشل التحقق يُرفض برسالة واضحة ولا يُدرَج، ولا يوقف استيراد بقية الملفات.
 *
 * التشغيل: npm run import:cases
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { groundTruthSchema, dossierSchema } from '../src/modules/cases/bank/schemas';

const prisma = new PrismaClient();
const SOURCE_DIR = path.join(__dirname, '..', 'case-bank-source');

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`المجلد غير موجود: ${SOURCE_DIR}`);
    console.error('أنشئه وضع فيه ملفات JSON (واحد لكل قضية) قبل تشغيل هذا السكربت.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_')); // _TEMPLATE_EXAMPLE.json مستثنى عمدًا

  if (files.length === 0) {
    console.error(`لا توجد ملفات .json في ${SOURCE_DIR} (بخلاف ملفات تبدأ بـ "_")`);
    process.exit(1);
  }

  let imported = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(SOURCE_DIR, file);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const groundTruthResult = groundTruthSchema.safeParse(raw.groundTruth);
      if (!groundTruthResult.success) {
        const issues = groundTruthResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' | ');
        throw new Error(`groundTruth غير صالح: ${issues}`);
      }

      if (!Array.isArray(raw.dossiers)) {
        throw new Error('dossiers يجب أن تكون مصفوفة');
      }
      if (raw.dossiers.length !== groundTruthResult.data.characters.length) {
        throw new Error(
          `عدد dossiers (${raw.dossiers.length}) لا يطابق عدد characters (${groundTruthResult.data.characters.length})`,
        );
      }

      const validatedDossiers = raw.dossiers.map((d: unknown, i: number) => {
        const result = dossierSchema.safeParse(d);
        if (!result.success) {
          const issues = result.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(' | ');
          throw new Error(`dossiers[${i}] غير صالح: ${issues}`);
        }
        return {
          ...result.data,
          characterName: groundTruthResult.data.characters[i].name,
          roleType: groundTruthResult.data.characters[i].role_type,
        };
      });

      const existing = await prisma.caseTemplate.findFirst({
        where: { title: groundTruthResult.data.title },
        select: { id: true },
      });
      if (existing) {
        console.log(`⏭️  ${file} → "${groundTruthResult.data.title}" موجودة مسبقًا، تم التخطي`);
        continue;
      }

      await prisma.caseTemplate.create({
        data: {
          title: groundTruthResult.data.title,
          crimeType: groundTruthResult.data.crime_type,
          setting: groundTruthResult.data.setting,
          groundTruth: groundTruthResult.data as unknown as object,
          dossiers: validatedDossiers as unknown as object,
          casePatternType: raw.casePatternType ?? 'defendant_innocent',
        },
      });

      imported++;
      console.log(`✅ ${file} → "${groundTruthResult.data.title}"`);
    } catch (err) {
      failed++;
      console.error(`❌ ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nتم استيراد ${imported} قضية بنجاح، وفشل ${failed}.`);
  if (failed > 0) {
    console.log('صحّح الملفات الفاشلة أعلاه وأعد تشغيل السكربت لها فقط (لن يُعاد استيراد الناجحة تلقائيًا كنسخ مكررة إلا لو أعدت التشغيل على نفس الملفات).');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
