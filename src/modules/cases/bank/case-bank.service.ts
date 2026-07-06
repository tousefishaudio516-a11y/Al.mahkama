import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CasePatternService } from './case-pattern.service';
import { Dossier, GroundTruth } from './schemas';
import { FALLBACK_CASE } from './fallback-case';

export type CaseDossier = Dossier & { characterName: string; roleType: string };

export interface PickedCase {
  groundTruth: GroundTruth;
  dossiers: CaseDossier[];
  patternType: 'defendant_guilty' | 'defendant_innocent' | 'defendant_partial';
  sourceTemplateId: string | null; // null فقط في حالة الطوارئ القصوى أدناه
  isFallback: boolean;
}

/**
 * لا يوجد أي نداء API هنا إطلاقاً. كل قضية مكتوبة ومُراجَعة يدويًا مسبقًا، ومُخزَّنة في
 * جدول case_templates (استوردت عبر prisma/import-case-templates.ts والتحقق من بنيتها
 * عبر Zod وقت الاستيراد، وليس وقت التشغيل). هذا يستبدل CaseGeneratorService بالكامل:
 * صفر تكلفة، صفر حدود معدل API، صفر مخاطر خصوصية (لا يُرسَل أي محتوى لأي طرف خارجي).
 *
 * منطق تجنّب التكرار: يعتمد على casePatternType (نفس منطق CasePatternService القديم)
 * بالإضافة إلى استبعاد القوالب المستخدمة مؤخرًا في نفس الغرفة تحديدًا (عبر sourceTemplateId
 * في جدول cases)، مع تفضيل القوالب الأقل استخدامًا عمومًا (timesUsed) لتوزيع عادل عبر الـ100 قضية.
 */
@Injectable()
export class CaseBankService {
  private readonly logger = new Logger(CaseBankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patternService: CasePatternService,
  ) {}

  async pickCaseForRoom(roomId: string): Promise<PickedCase> {
    const { pattern } = await this.patternService.pickPatternType(roomId);

    const recentlyUsedTemplateIds = await this.getRecentlyUsedTemplateIds(roomId);

    const template =
      (await this.findBestTemplate(pattern, recentlyUsedTemplateIds)) ??
      (await this.findBestTemplate(null, recentlyUsedTemplateIds)) ?? // أي نمط، طالما لم يُستخدم مؤخرًا
      (await this.findBestTemplate(null, [])); // كل شيء استُخدم مؤخرًا (بنك صغير) -> تجاهل الاستبعاد

    if (!template) {
      // البنك فارغ تمامًا (لم يُستورَد شيء بعد) — قضية طوارئ واحدة مدمجة لضمان عدم توقف اللعبة كليًا
      this.logger.error(
        `بنك القضايا فارغ تمامًا للغرفة ${roomId}. استورد القضايا عبر: npm run import:cases`,
      );
      return {
        groundTruth: FALLBACK_CASE,
        dossiers: this.buildFallbackDossiers(),
        patternType: 'defendant_innocent',
        sourceTemplateId: null,
        isFallback: true,
      };
    }

    await this.prisma.caseTemplate.update({
      where: { id: template.id },
      data: { timesUsed: { increment: 1 } },
    });

    return {
      groundTruth: template.groundTruth as unknown as GroundTruth,
      dossiers: template.dossiers as unknown as CaseDossier[],
      patternType: template.casePatternType,
      sourceTemplateId: template.id,
      isFallback: false,
    };
  }

  private async getRecentlyUsedTemplateIds(roomId: string): Promise<string[]> {
    // نتجنب إعادة نفس القضية على نفس الغرفة خلال آخر 5 جولات (الغرفة الواحدة قد تلعب أكثر من جولة)
    const recentCases = await this.prisma.case.findMany({
      where: { roomId, sourceTemplateId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { sourceTemplateId: true },
    });
    return recentCases.map((c) => c.sourceTemplateId).filter((id): id is string => !!id);
  }

  private async findBestTemplate(
    pattern: 'defendant_guilty' | 'defendant_innocent' | 'defendant_partial' | null,
    excludeIds: string[],
  ) {
    const candidates = await this.prisma.caseTemplate.findMany({
      where: {
        isActive: true,
        ...(pattern ? { casePatternType: pattern } : {}),
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { timesUsed: 'asc' }, // توزيع عادل: الأقل استخدامًا أولاً
      take: 5, // من بين الأقل استخدامًا، اختر عشوائيًا لتفادي نمط يمكن ملاحظته
    });

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private buildFallbackDossiers(): CaseDossier[] {
    return FALLBACK_CASE.characters.map((character) => ({
      known_facts: character.knows_facts,
      false_beliefs: character.is_real_culprit
        ? []
        : [
            {
              belief: 'يعتقد أن مشرف المناوبة الليلية هو المسؤول عن الحادثة بسبب وجوده في الموقع',
              is_intentional_conflict: true,
            },
          ],
      missing_facts_hint: ['هناك تفاصيل عن طلب الصيانة لم تُكشف بعد'],
      held_evidence: character.physical_evidence_held.slice(0, 3),
      lie_or_hide_reason: character.is_real_culprit
        ? 'يخفي علاقته بطلب الصيانة وسداد الدين خشية كشف تورطه'
        : null,
      motive_category: character.motive_category,
      narrative_voice_notes: 'هادئ ومباشر أثناء الاستجواب، يجيب فقط عمّا يُسأل عنه صراحة.',
      characterName: character.name,
      roleType: character.role_type,
    }));
  }
}
