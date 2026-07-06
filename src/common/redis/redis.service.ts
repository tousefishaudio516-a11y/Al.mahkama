import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * تُدير الحالة اللحظية للغرف كما هو موصوف في وثيقة GDD (القسم 8 - Redis):
 * room:{code}:state          -> JSON مختصر لحالة الغرفة الحالية
 * room:{code}:timer           -> timestamp انتهاء مؤقت المحاكمة
 * room:{code}:ready_players    -> SET لمعرفات اللاعبين الجاهزين
 * room:{code}:sockets          -> Hash يربط user/player id بـ socket_id
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  // ---- حالة الغرفة ----
  async setRoomState(code: string, state: Record<string, unknown>) {
    await this.client.set(`room:${code}:state`, JSON.stringify(state));
  }

  async getRoomState<T = Record<string, unknown>>(code: string): Promise<T | null> {
    const raw = await this.client.get(`room:${code}:state`);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  // ---- مؤقت المحاكمة ----
  async setTrialEndTimestamp(code: string, endsAtMs: number) {
    await this.client.set(`room:${code}:timer`, endsAtMs.toString());
  }

  async getTrialEndTimestamp(code: string): Promise<number | null> {
    const raw = await this.client.get(`room:${code}:timer`);
    return raw ? Number(raw) : null;
  }

  // ---- جاهزية اللاعبين ----
  async markPlayerReady(code: string, playerId: string) {
    await this.client.sadd(`room:${code}:ready_players`, playerId);
  }

  async getReadyPlayers(code: string): Promise<string[]> {
    return this.client.smembers(`room:${code}:ready_players`);
  }

  async clearReadyPlayers(code: string) {
    await this.client.del(`room:${code}:ready_players`);
  }

  // ---- ربط اللاعبين بالـ sockets ----
  async bindSocket(code: string, playerId: string, socketId: string) {
    await this.client.hset(`room:${code}:sockets`, playerId, socketId);
    // ربط عكسي: يسمح للـ Gateway بالتحقق من "من هو اللاعب الذي يملك فعلاً هذا الـ socket؟"
    // بدل الوثوق بأي playerId يرسله العميل ضمن حمولة الحدث نفسه (كان بلا تحقق سابقًا).
    await this.client.set(`socket:${socketId}:player`, JSON.stringify({ code, playerId }));
  }

  async getSocketId(code: string, playerId: string): Promise<string | null> {
    return this.client.hget(`room:${code}:sockets`, playerId);
  }

  /** يعيد هوية اللاعب المرتبط فعليًا بهذا الـ socket، أو null إن لم يكن مرتبطًا بأي لاعب بعد. */
  async getPlayerForSocket(socketId: string): Promise<{ code: string; playerId: string } | null> {
    const raw = await this.client.get(`socket:${socketId}:player`);
    return raw ? JSON.parse(raw) : null;
  }

  async unbindSocket(socketId: string) {
    await this.client.del(`socket:${socketId}:player`);
  }
}
