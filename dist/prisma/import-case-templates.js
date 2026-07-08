"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const schemas_1 = require("../src/modules/cases/bank/schemas");
const prisma = new client_1.PrismaClient();
const SOURCE_DIR = path.join(__dirname, '..', 'case-bank-source');
async function main() {
    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`المجلد غير موجود: ${SOURCE_DIR}`);
        console.error('أنشئه وضع فيه ملفات JSON (واحد لكل قضية) قبل تشغيل هذا السكربت.');
        process.exit(1);
    }
    const files = fs
        .readdirSync(SOURCE_DIR)
        .filter((f) => f.endsWith('.json') && !f.startsWith('_'));
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
            const groundTruthResult = schemas_1.groundTruthSchema.safeParse(raw.groundTruth);
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
                throw new Error(`عدد dossiers (${raw.dossiers.length}) لا يطابق عدد characters (${groundTruthResult.data.characters.length})`);
            }
            const validatedDossiers = raw.dossiers.map((d, i) => {
                const result = schemas_1.dossierSchema.safeParse(d);
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
                    groundTruth: groundTruthResult.data,
                    dossiers: validatedDossiers,
                    casePatternType: raw.casePatternType ?? 'defendant_innocent',
                },
            });
            imported++;
            console.log(`✅ ${file} → "${groundTruthResult.data.title}"`);
        }
        catch (err) {
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
//# sourceMappingURL=import-case-templates.js.map