import { z } from 'zod';

/**
 * التحقق الفعلي من بنية كل مخرجات Claude قبل استخدامها في أي منطق أو حفظ في قاعدة البيانات.
 * يعالج المشكلة الحرجة: "لا يوجد Runtime Validation لمخرجات Claude" — JSON.parse وحده لا يكفي
 * لأن النموذج قد يعيد حقولاً ناقصة، enum خاطئ، أو مصفوفة فارغة، وهذا سابقًا كان يمر بصمت
 * ويؤدي لانهيار متأخر وغامض في مكان بعيد عن سبب الخطأ الحقيقي.
 *
 * ملاحظة عن motive_category: الـ prompt يكتب "... | null" داخل وصف نصي لشكل الحقل، وبعض النماذج
 * قد تُخرج السلسلة النصية "null" حرفيًا بدل قيمة JSON الفعلية null. الـ preprocess أدناه يحوّل
 * أي صيغة من null (السلسلة "null"، سلسلة فارغة، undefined) إلى null فعلي قبل التحقق، بدل أن
 * ينكسر إدخال Prisma لاحقًا بصمت مع رسالة خطأ غامضة.
 */
const nullableEnumPreprocess = (val: unknown) => {
  if (val === 'null' || val === '' || val === undefined) return null;
  return val;
};

export const MOTIVE_CATEGORIES = [
  'financial',
  'professional',
  'legal',
  'business',
  'administrative_violation',
  'past_mistake',
  'non_romantic_personal_dispute',
  'conflicting_interest',
] as const;

const motiveCategorySchema = z.preprocess(
  nullableEnumPreprocess,
  z.enum(MOTIVE_CATEGORIES).nullable(),
);

export const ROLE_TYPES = [
  'judge',
  'prosecutor',
  'defense',
  'defendant',
  'witness_main',
  'secondary',
] as const;

const roleTypeSchema = z.enum(ROLE_TYPES);

const characterSchema = z.object({
  role_type: roleTypeSchema,
  role_name: z.string().min(1),
  name: z.string().min(1),
  priority_order: z.number().int(),
  relationships: z.array(z.string()).default([]),
  knows_facts: z.array(z.string()).default([]),
  physical_evidence_held: z.array(z.string()).default([]),
  motive_category: motiveCategorySchema,
  is_real_culprit: z.boolean(),
  is_defendant: z.boolean(),
});

export const groundTruthSchema = z
  .object({
    title: z.string().min(1),
    crime_type: z.string().min(1),
    setting: z.string().min(1),
    victim: z.object({ name: z.string().min(1), background: z.string() }),
    timeline: z
      .array(z.object({ time: z.string(), event: z.string() }))
      .min(1, 'الخط الزمني لا يمكن أن يكون فارغًا'),
    characters: z.array(characterSchema).min(3, 'عدد الشخصيات أقل من الحد الأدنى المعقول'),
    decisive_evidence: z.array(z.string()).default([]),
    real_culprit_name: z.string().min(1),
    motive: z.string().min(1),
    correct_verdict: z.object({
      verdict: z.enum(['guilty', 'not_guilty']),
      reasoning: z.string().min(1),
    }),
  })
  // تحققات دلالية إضافية بخلاف بنية الحقول فقط — هذه هي التي كانت مفقودة تمامًا سابقًا:
  .superRefine((data, ctx) => {
    const culprits = data.characters.filter((c) => c.is_real_culprit);
    if (culprits.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `يجب وجود فاعل حقيقي واحد بالضبط (is_real_culprit=true)، وُجد ${culprits.length}`,
      });
    }

    const defendants = data.characters.filter((c) => c.is_defendant);
    if (defendants.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `يجب وجود متهم واحد بالضبط (is_defendant=true)، وُجد ${defendants.length}`,
      });
    }

    const requiredRoles: (typeof ROLE_TYPES)[number][] = [
      'judge',
      'prosecutor',
      'defense',
      'defendant',
      'witness_main',
    ];
    for (const role of requiredRoles) {
      if (!data.characters.some((c) => c.role_type === role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `الدور الأساسي "${role}" مفقود من قائمة الشخصيات`,
        });
      }
    }

    const defendantCharacter = data.characters.find((c) => c.role_type === 'defendant');
    if (defendantCharacter && !defendantCharacter.is_defendant) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'الشخصية بدور "defendant" يجب أن تحمل is_defendant=true',
      });
    }

    const culpritName = data.real_culprit_name.trim();
    if (!data.characters.some((c) => c.name.trim() === culpritName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `real_culprit_name ("${culpritName}") لا يطابق اسم أي شخصية في القائمة`,
      });
    }

    // أسماء الشخصيات يجب أن تكون فريدة، وإلا يفشل ربط الملفات السرية لاحقًا بصمت
    const names = data.characters.map((c) => c.name.trim());
    const duplicateNames = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicateNames.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `أسماء شخصيات مكررة: ${[...new Set(duplicateNames)].join('، ')}`,
      });
    }
  });

export type GroundTruth = z.infer<typeof groundTruthSchema>;
export type GroundTruthCharacter = z.infer<typeof characterSchema>;

export const dossierSchema = z.object({
  known_facts: z.array(z.string()).default([]),
  false_beliefs: z
    .array(
      z.object({
        belief: z.string().min(1),
        is_intentional_conflict: z.boolean(),
      }),
    )
    .default([]),
  missing_facts_hint: z.array(z.string()).default([]),
  held_evidence: z.array(z.string()).max(3).default([]),
  lie_or_hide_reason: z.string().nullable().default(null),
  motive_category: motiveCategorySchema,
  narrative_voice_notes: z.string().default(''),
});

export type Dossier = z.infer<typeof dossierSchema>;

export const consistencyResultSchema = z.object({
  is_consistent: z.boolean(),
  issues: z.array(z.string()).default([]),
});

export type ConsistencyResult = z.infer<typeof consistencyResultSchema>;

export const contentPolicyResultSchema = z.object({
  is_compliant: z.boolean(),
  violations: z.array(z.string()).default([]),
});

export type ContentPolicyResult = z.infer<typeof contentPolicyResultSchema>;
