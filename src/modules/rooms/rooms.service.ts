import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRoomDto, PlayModeDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

// كود الغرفة: 6 خانات أحرف كبيرة + أرقام، بدون رموز ملتبسة (0/O, 1/I)
const generateRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://aicourt.app';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * إنشاء غرفة جديدة بأحد النمطين (القسم 4 - المرحلة -1 والمرحلة 0 في GDD).
   * multiplayer: 5-20 لاعبًا، ينشئ كود + QR + رابط دعوة.
   * single_device: 3-20 لاعبًا، يستقبل أسماء اللاعبين مباشرة وينشئهم كـ RoomPlayer محليين.
   */
  async createRoom(dto: CreateRoomDto) {
    const isSingleDevice = dto.playMode === PlayModeDto.single_device;

    if (isSingleDevice) {
      if (!dto.localPlayerNames || dto.localPlayerNames.length < 3) {
        throw new BadRequestException('وضع الهاتف الواحد يتطلب 3 لاعبين على الأقل');
      }
      if (dto.localPlayerNames.length > 20) {
        throw new BadRequestException('الحد الأقصى لعدد اللاعبين هو 20');
      }
    }

    const hostUser = await this.prisma.user.create({
      data: { displayName: dto.hostDisplayName, isGuest: true },
    });

    const code = generateRoomCode();

    const room = await this.prisma.room.create({
      data: {
        code,
        hostUserId: hostUser.id,
        playMode: dto.playMode,
        minPlayers: isSingleDevice ? 3 : 5,
        maxPlayers: 20,
        status: 'lobby',
      },
    });

    if (isSingleDevice) {
      // إنشاء لاعبين محليين مباشرة بلا حسابات مستخدمين منفصلة (القسم "إعداد اللاعبين المحليين")
      await this.prisma.roomPlayer.createMany({
        data: dto.localPlayerNames!.map((name) => ({
          roomId: room.id,
          localName: name,
        })),
      });
      return this.getRoomByCode(code);
    }

    // multiplayer: توليد رابط الدعوة و QR Code (القسم "دعم QR Code")
    const inviteLink = `${APP_BASE_URL}/join/${code}`;
    const qrCodeUrl = await QRCode.toDataURL(inviteLink, { errorCorrectionLevel: 'H', margin: 1 });

    await this.prisma.room.update({
      where: { id: room.id },
      data: { inviteLink, qrCodeUrl },
    });

    // المضيف نفسه أول لاعب في الغرفة الجماعية
    await this.prisma.roomPlayer.create({
      data: { roomId: room.id, userId: hostUser.id },
    });

    // كان هذا يعيد `updatedRoom` مباشرة بلا `players` إطلاقًا (Prisma لا يُرجع العلاقات
    // إلا بـ include صريح)، فكانت الواجهة تعجز عن معرفة هوية RoomPlayer الخاصة بالمضيف
    // نفسه بعد الإنشاء مباشرة. استخدام getRoomByCode هنا يعيد نفس الشكل المستخدم في كل
    // مكان آخر بالتطبيق (متسق مع مسار single_device و مسار الانضمام لاحقًا).
    return this.getRoomByCode(code);
  }

  /**
   * الانضمام لغرفة جماعية عبر الكود (أو بعد مسح QR / فتح رابط الدعوة، فكلاهما يحمل نفس الكود).
   */
  async joinRoom(dto: JoinRoomDto) {
    const room = await this.getRoomByCode(dto.code);

    if (room.playMode !== 'multiplayer') {
      throw new BadRequestException('لا يمكن الانضمام عن بعد لغرفة بوضع الهاتف الواحد');
    }
    if (room.status !== 'lobby') {
      throw new BadRequestException('انتهت مرحلة الانضمام لهذه الغرفة');
    }
    if (room.players.length >= room.maxPlayers) {
      throw new BadRequestException('الغرفة ممتلئة');
    }

    const user = await this.prisma.user.create({
      data: { displayName: dto.displayName, isGuest: true },
    });

    const player = await this.prisma.roomPlayer.create({
      data: { roomId: room.id, userId: user.id },
    });

    return { room, player, user };
  }

  async getRoomByCode(code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: { players: true },
    });
    if (!room) throw new NotFoundException('لم يتم العثور على الغرفة بهذا الكود');
    return room;
  }

  /** هل الغرفة جاهزة لبدء توليد القضية؟ (اكتمال الحد الأدنى للاعبين) */
  async isReadyToGenerate(code: string): Promise<boolean> {
    const room = await this.getRoomByCode(code);
    return room.players.length >= room.minPlayers;
  }
}
