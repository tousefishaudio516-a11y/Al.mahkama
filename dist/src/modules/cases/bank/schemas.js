"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentPolicyResultSchema = exports.consistencyResultSchema = exports.dossierSchema = exports.groundTruthSchema = exports.ROLE_TYPES = exports.MOTIVE_CATEGORIES = void 0;
const zod_1 = require("zod");
const nullableEnumPreprocess = (val) => {
    if (val === 'null' || val === '' || val === undefined)
        return null;
    return val;
};
exports.MOTIVE_CATEGORIES = [
    'financial',
    'professional',
    'legal',
    'business',
    'administrative_violation',
    'past_mistake',
    'non_romantic_personal_dispute',
    'conflicting_interest',
];
const motiveCategorySchema = zod_1.z.preprocess(nullableEnumPreprocess, zod_1.z.enum(exports.MOTIVE_CATEGORIES).nullable());
exports.ROLE_TYPES = [
    'judge',
    'prosecutor',
    'defense',
    'defendant',
    'witness_main',
    'secondary',
];
const roleTypeSchema = zod_1.z.enum(exports.ROLE_TYPES);
const characterSchema = zod_1.z.object({
    role_type: roleTypeSchema,
    role_name: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    priority_order: zod_1.z.number().int(),
    relationships: zod_1.z.array(zod_1.z.string()).default([]),
    knows_facts: zod_1.z.array(zod_1.z.string()).default([]),
    physical_evidence_held: zod_1.z.array(zod_1.z.string()).default([]),
    motive_category: motiveCategorySchema,
    is_real_culprit: zod_1.z.boolean(),
    is_defendant: zod_1.z.boolean(),
});
exports.groundTruthSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1),
    crime_type: zod_1.z.string().min(1),
    setting: zod_1.z.string().min(1),
    victim: zod_1.z.object({ name: zod_1.z.string().min(1), background: zod_1.z.string() }),
    timeline: zod_1.z
        .array(zod_1.z.object({ time: zod_1.z.string(), event: zod_1.z.string() }))
        .min(1, 'الخط الزمني لا يمكن أن يكون فارغًا'),
    characters: zod_1.z.array(characterSchema).min(3, 'عدد الشخصيات أقل من الحد الأدنى المعقول'),
    decisive_evidence: zod_1.z.array(zod_1.z.string()).default([]),
    real_culprit_name: zod_1.z.string().min(1),
    motive: zod_1.z.string().min(1),
    correct_verdict: zod_1.z.object({
        verdict: zod_1.z.enum(['guilty', 'not_guilty']),
        reasoning: zod_1.z.string().min(1),
    }),
})
    .superRefine((data, ctx) => {
    const culprits = data.characters.filter((c) => c.is_real_culprit);
    if (culprits.length !== 1) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `يجب وجود فاعل حقيقي واحد بالضبط (is_real_culprit=true)، وُجد ${culprits.length}`,
        });
    }
    const defendants = data.characters.filter((c) => c.is_defendant);
    if (defendants.length !== 1) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `يجب وجود متهم واحد بالضبط (is_defendant=true)، وُجد ${defendants.length}`,
        });
    }
    const requiredRoles = [
        'judge',
        'prosecutor',
        'defense',
        'defendant',
        'witness_main',
    ];
    for (const role of requiredRoles) {
        if (!data.characters.some((c) => c.role_type === role)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `الدور الأساسي "${role}" مفقود من قائمة الشخصيات`,
            });
        }
    }
    const defendantCharacter = data.characters.find((c) => c.role_type === 'defendant');
    if (defendantCharacter && !defendantCharacter.is_defendant) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'الشخصية بدور "defendant" يجب أن تحمل is_defendant=true',
        });
    }
    const culpritName = data.real_culprit_name.trim();
    if (!data.characters.some((c) => c.name.trim() === culpritName)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `real_culprit_name ("${culpritName}") لا يطابق اسم أي شخصية في القائمة`,
        });
    }
    const names = data.characters.map((c) => c.name.trim());
    const duplicateNames = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicateNames.length > 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `أسماء شخصيات مكررة: ${[...new Set(duplicateNames)].join('، ')}`,
        });
    }
});
exports.dossierSchema = zod_1.z.object({
    known_facts: zod_1.z.array(zod_1.z.string()).default([]),
    false_beliefs: zod_1.z
        .array(zod_1.z.object({
        belief: zod_1.z.string().min(1),
        is_intentional_conflict: zod_1.z.boolean(),
    }))
        .default([]),
    missing_facts_hint: zod_1.z.array(zod_1.z.string()).default([]),
    held_evidence: zod_1.z.array(zod_1.z.string()).max(3).default([]),
    lie_or_hide_reason: zod_1.z.string().nullable().default(null),
    motive_category: motiveCategorySchema,
    narrative_voice_notes: zod_1.z.string().default(''),
});
exports.consistencyResultSchema = zod_1.z.object({
    is_consistent: zod_1.z.boolean(),
    issues: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.contentPolicyResultSchema = zod_1.z.object({
    is_compliant: zod_1.z.boolean(),
    violations: zod_1.z.array(zod_1.z.string()).default([]),
});
//# sourceMappingURL=schemas.js.map