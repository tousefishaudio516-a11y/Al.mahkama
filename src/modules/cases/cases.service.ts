import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CaseBankService } from './bank/case-bank.service';
import { RoleAssignmentService } from '../players/role-assignment.service';
import { ReadingService } from '../trial/reading.service';

/** الشكل الآمن الوحيد المسموح بإرساله للعميل قبل مرحلة الكشف الرسمية (reveal). */
export interface PublicCaseSummary {
  id: string;
  title: string;
  crimeType: string;
  setting: string;
  status: 'generating' | 'reading';
}

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseBank: CaseBankService,
    private readonly roleAssignment: RoleAssignmentService,
    private readonly readingService: ReadingService,
  ) {}

  /**
   * المرحلة 1 في GDD: توليد القضية وتوزيع الأدوار.
   * يُستدعى بعد اكتمال الحد الأدنى للاعبين في الغرفة (كلا النمطين).
   *
   * أمان حرج: يعيد فقط PublicCaseSummary (لا groundTruth، لا correctVerdict، لا أي حقل
   * يكشف الحل). سابقًا كان هذا المسار يعيد كائن Case الخام من Prisma كاملاً بما فيه
   * ground_truth — أي أن الحل الكامل للقضية كان يُرسل للعميل فور توليدها. هذا أُصلح هنا
   * وعلى مستوى الـ Controller أيضًا كطبقة حماية مزدوجة.
   */
  async generateCaseForRoom(roomId: string, requestingPlayerId?: string): Promise<PublicCaseSummary> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });

    // تحقق عضوية بسيط: كان هذا المسار مفتوحًا بلا أي تحقق سابقًا (أي شخص يعرف roomId
    // فقط يستطيع استدعاءه). ملاحظة: هذا تحقق "عضو في الغرفة"، وليس "المضيف تحديدًا" —
    // مفهوم "المضيف" لوضع single_device غير موجود فعليًا كحقل مرتبط بأي RoomPlayer في
    // المخطط الحالي (RoomPlayer.userId فارغ للاعبين المحليين)، فتقييد الإجراء لصلاحية
    // "المضيف فقط" يحتاج تصميمًا إضافيًا للمخطط لاحقًا إن أردت ذلك.
    if (requestingPlayerId) {
      const player = await this.prisma.roomPlayer.findUnique({ where: { id: requestingPlayerId } });
      if (!player || player.roomId !== roomId) {
        throw new ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
      }
    }

    await this.prisma.room.update({ where: { id: roomId }, data: { status: 'generating' } });

    const { groundTruth, dossiers, patternType, sourceTemplateId } =
      await this.caseBank.pickCaseForRoom(roomId);

    const createdCase = await this.prisma.case.create({
      data: {
        roomId,
        title: groundTruth.title,
        crimeType: groundTruth.crime_type,
        setting: groundTruth.setting,
        groundTruth: groundTruth as unknown as object,
        timeline: groundTruth.timeline as unknown as object,
        casePatternType: patternType,
        correctVerdict: groundTruth.correct_verdict as unknown as object,
        sourceTemplateId,
      },
    });

    // إنشاء الشخصيات + دمج ملفاتها السرية المشتقة.
    // المطابقة بالفهرس (index) لا بالاسم: groundTruth.characters[i] ↔ dossiers[i]،
    // بما أن كل قضية في البنك مخزَّنة مسبقًا بمصفوفتين متطابقتي الترتيب (تحقّق منه Zod
    // وقت الاستيراد في prisma/import-case-templates.ts، بما في ذلك تفرّد أسماء الشخصيات).
    const createdCharacters = await Promise.all(
      groundTruth.characters.map(async (character, index) => {
        const dossier = dossiers[index];
        return this.prisma.character.create({
          data: {
            caseId: createdCase.id,
            roleType: character.role_type as any,
            roleName: character.role_name,
            priorityOrder: character.priority_order,
            dossier: dossier as unknown as object,
            motiveCategory: (dossier?.motive_category ?? null) as any,
            isIntentionalConflict:
              dossier?.false_beliefs?.some((b) => b.is_intentional_conflict) ?? false,
          },
        });
      }),
    );

    // ربط real_culprit_character_id و defendant_character_id بعد إنشاء الشخصيات
    // (مطابقة بالترتيب لنفس السبب الموضح أعلاه). groundTruthSchema يضمن الآن وجود
    // فاعل حقيقي واحد بالضبط ومتهم واحد بالضبط، فلا حاجة للتعامل مع حالة "-1" هنا كمسار طبيعي.
    const realCulpritIndex = groundTruth.characters.findIndex((c) => c.is_real_culprit);
    const defendantIndex = groundTruth.characters.findIndex((c) => c.is_defendant);
    const realCulpritEntity = realCulpritIndex >= 0 ? createdCharacters[realCulpritIndex] : undefined;
    const defendantEntity = defendantIndex >= 0 ? createdCharacters[defendantIndex] : undefined;

    await this.prisma.case.update({
      where: { id: createdCase.id },
      data: {
        realCulpritCharacterId: realCulpritEntity?.id,
        defendantCharacterId: defendantEntity?.id,
      },
    });

    // الأدلة القابلة للكشف (evidences) من held_evidence لكل شخصية (نفس المطابقة بالفهرس).
    await Promise.all(
      groundTruth.characters.flatMap((_, index) => {
        const dossier = dossiers[index];
        const character = createdCharacters[index];
        if (!dossier || !character) return [];
        return (dossier.held_evidence ?? []).map((title) =>
          this.prisma.evidence.create({
            data: {
              caseId: createdCase.id,
              ownerCharacterId: character.id,
              title,
              description: title,
              isDecisive: groundTruth.decisive_evidence?.includes(title) ?? false,
            },
          }),
        );
      }),
    );

    // المرحلة 1: توزيع الأدوار الفعلي على اللاعبين
    await this.roleAssignment.assignRoles(roomId, createdCase.id);

    // كان مفقودًا تمامًا سابقًا: بدون هذا الاستدعاء، وضع "الهاتف الواحد" كان سيفشل
    // بالكامل عند أول محاولة "إغلاق الملف" (BadRequestException: لم تبدأ مرحلة القراءة).
    if (room.playMode === 'single_device') {
      await this.readingService.initSingleDeviceReadingOrder(roomId);
    }

    await this.prisma.room.update({ where: { id: roomId }, data: { status: 'reading' } });

    return {
      id: createdCase.id,
      title: createdCase.title,
      crimeType: createdCase.crimeType,
      setting: createdCase.setting,
      status: 'reading',
    };
  }
}
