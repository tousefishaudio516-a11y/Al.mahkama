import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * توزيع الأدوار على اللاعبين بعد توليد القضية.
 * يطبّق منطق GDD القسم 2 (الأدوار الأساسية/الثانوية) والقسم 6.4 (التوزيع الديناميكي)
 * والقسم 6.6 (جدول الأدوار المصغّر لوضع الهاتف الواحد بـ 3/4 لاعبين).
 */
@Injectable()
export class RoleAssignmentService {
  private readonly logger = new Logger(RoleAssignmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assignRoles(roomId: string, caseId: string) {
    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { players: true },
    });

    // الشخصيات مرتّبة حسب أولويتها كما وُلّدت (priorityOrder)
    const characters = await this.prisma.character.findMany({
      where: { caseId },
      orderBy: { priorityOrder: 'asc' },
    });

    const playerCount = room.players.length;

    // القسم 6.6: عند وجود أقل من 5 لاعبين (لا يحدث إلا في single_device)
    // يُفعَّل نظام أدوار مصغّر بدل الأساسي الكامل.
    const activeCharacters =
      playerCount < 5
        ? this.pickReducedRoleSet(characters, playerCount)
        : characters.slice(0, playerCount);

    // تحقق دفاعي: سابقًا كان أي نقص في عدد الشخصيات المولّدة (مثلاً AI لم يولّد شخصية
    // كافية، أو pickReducedRoleSet لم يجد أحد الأدوار المطلوبة) يؤدي لانهيار صامت لاحقًا
    // عند activeCharacters[index] غير المعرّف. الآن يُرمى خطأ واضح فورًا بدل ذلك.
    if (activeCharacters.length < playerCount) {
      this.logger.error(
        `عدد الشخصيات المتاحة (${activeCharacters.length}) أقل من عدد اللاعبين (${playerCount}) للغرفة ${roomId}`,
      );
      throw new InternalServerErrorException(
        'تعذّر توزيع الأدوار: عدد الشخصيات المولّدة للقضية أقل من عدد اللاعبين في الغرفة.',
      );
    }

    // توزيع عشوائي بسيط للاعبين على الشخصيات المفعّلة (يمكن استبداله لاحقًا
    // بخوارزمية تفضيلات إن أُضيف اختيار الأدوار من اللاعب)
    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);

    const assignments = shuffledPlayers.map((player, index) => ({
      playerId: player.id,
      characterId: activeCharacters[index].id,
    }));

    await Promise.all(
      assignments.map((a) =>
        this.prisma.roomPlayer.update({
          where: { id: a.playerId },
          data: { characterId: a.characterId },
        }),
      ),
    );

    return assignments;
  }

  /**
   * جدول الأدوار المصغّر (القسم 6.6):
   * 3 لاعبين: قاضٍ، متهم، شاهد
   * 4 لاعبين: قاضٍ، متهم، شاهد، (ادعاء أو دفاع)
   */
  private pickReducedRoleSet(characters: { roleType: string }[], playerCount: number) {
    const byRole = (role: string) => characters.find((c) => c.roleType === role);

    const judge = byRole('judge');
    const defendant = byRole('defendant');
    const witness = byRole('witness_main');
    const prosecutorOrDefense = byRole('prosecutor') ?? byRole('defense');

    const base = [judge, defendant, witness].filter(Boolean) as typeof characters;

    if (playerCount === 3) return base as any;
    if (playerCount === 4) return [...base, prosecutorOrDefense].filter(Boolean) as any;

    return characters.slice(0, playerCount);
  }
}
