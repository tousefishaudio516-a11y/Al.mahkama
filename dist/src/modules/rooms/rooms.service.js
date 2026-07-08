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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const QRCode = __importStar(require("qrcode"));
const prisma_service_1 = require("../../common/prisma/prisma.service");
const create_room_dto_1 = require("./dto/create-room.dto");
const generateRoomCode = (0, nanoid_1.customAlphabet)('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://aicourt.app';
let RoomsService = class RoomsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRoom(dto) {
        const isSingleDevice = dto.playMode === create_room_dto_1.PlayModeDto.single_device;
        if (isSingleDevice) {
            if (!dto.localPlayerNames || dto.localPlayerNames.length < 3) {
                throw new common_1.BadRequestException('وضع الهاتف الواحد يتطلب 3 لاعبين على الأقل');
            }
            if (dto.localPlayerNames.length > 20) {
                throw new common_1.BadRequestException('الحد الأقصى لعدد اللاعبين هو 20');
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
            await this.prisma.roomPlayer.createMany({
                data: dto.localPlayerNames.map((name) => ({
                    roomId: room.id,
                    localName: name,
                })),
            });
            return this.getRoomByCode(code);
        }
        const inviteLink = `${APP_BASE_URL}/join/${code}`;
        const qrCodeUrl = await QRCode.toDataURL(inviteLink, { errorCorrectionLevel: 'H', margin: 1 });
        await this.prisma.room.update({
            where: { id: room.id },
            data: { inviteLink, qrCodeUrl },
        });
        await this.prisma.roomPlayer.create({
            data: { roomId: room.id, userId: hostUser.id },
        });
        return this.getRoomByCode(code);
    }
    async joinRoom(dto) {
        const room = await this.getRoomByCode(dto.code);
        if (room.playMode !== 'multiplayer') {
            throw new common_1.BadRequestException('لا يمكن الانضمام عن بعد لغرفة بوضع الهاتف الواحد');
        }
        if (room.status !== 'lobby') {
            throw new common_1.BadRequestException('انتهت مرحلة الانضمام لهذه الغرفة');
        }
        if (room.players.length >= room.maxPlayers) {
            throw new common_1.BadRequestException('الغرفة ممتلئة');
        }
        const user = await this.prisma.user.create({
            data: { displayName: dto.displayName, isGuest: true },
        });
        const player = await this.prisma.roomPlayer.create({
            data: { roomId: room.id, userId: user.id },
        });
        return { room, player, user };
    }
    async getRoomByCode(code) {
        const room = await this.prisma.room.findUnique({
            where: { code },
            include: { players: true },
        });
        if (!room)
            throw new common_1.NotFoundException('لم يتم العثور على الغرفة بهذا الكود');
        return room;
    }
    async isReadyToGenerate(code) {
        const room = await this.getRoomByCode(code);
        return room.players.length >= room.minPlayers;
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map