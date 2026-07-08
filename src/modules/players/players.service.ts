import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * كان مفقودًا تمامًا: لا وجود لأي طريقة يعرف بها اللاعب شخصيته وملفه السري بعد
   * توزيع الأدوار (RoleAssignmentService يكتب في قاعدة البيانات لكن لا شيء كان يقرأ
   * منها للاعب نفسه). هذا ما تعرضه شاشة "القراءة" في الواجهة.
   *
   * أمان: يتحقق أن playerId ينتمي فعلاً لهذه الغرفة قبل إعادة أي بيانات — لا يمكن للاعب
   * قراءة ملف لاعب آخر بتغيير المعرّف في الطلب.
   */
  async getMyCharacter(roomCode: string, playerId: string) {
    const room = await this.prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) throw new NotFoundException('لم يتم العثور على الغرفة');

    const player = await this.prisma.roomPlayer.findUnique({
      where: { id: playerId },
      include: { character: true },
    });

    if (!player || player.roomId !== room.id) {
      throw new ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
    }

    if (!player.character) {
      // طبيعي قبل توليد القضية/توزيع الأدوار — الواجهة تعرض حالة انتظار بدل خطأ
      return { assigned: false as const };
    }

    const evidences = await this.prisma.evidence.findMany({
      where: { ownerCharacterId: player.character.id },
      select: { id: true, title: true, description: true, isRevealed: true, isDecisive: true },
    });

    return {
      assigned: true as const,
      character: {
        id: player.character.id,
        roleType: player.character.roleType,
        roleName: player.character.roleName,
        dossier: player.character.dossier,
      },
      evidences,
    };
  }

  /** حالة كل اللاعبين في الغرفة (لشاشة اللوبي والانتظار) — بلا أي بيانات سرية. */
  async getRoomPlayersPublic(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        players: {
          include: {
            character: { select: { roleType: true, roleName: true } },
            user: { select: { displayName: true } },
          },
        },
      },
    });
    if (!room) throw new NotFoundException('لم يتم العثور على الغرفة');

    return room.players.map((p) => ({
      id: p.id,
      displayName: p.user?.displayName ?? p.localName ?? 'لاعب',
      isReady: p.isReady,
      roleType: p.character?.roleType ?? null,
      roleName: p.character?.roleName ?? null,
    }));
  }
}
