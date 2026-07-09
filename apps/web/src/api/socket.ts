import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'https://al-mahkama-server.onrender.com';

let socket: Socket | null = null;

/** اتصال وحيد يُعاد استخدامه عبر كل الشاشات (بدل فتح اتصال جديد في كل صفحة). */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/rooms`, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function joinRoomChannel(roomCode: string, playerId: string) {
  getSocket().emit('join_room', { roomCode, playerId });
}

type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * إرسال حدث عبر Socket مع انتظار رد فعلي (Ack) من الخادم. ضروري لأن هذه الأحداث
 * (خلافًا لـ REST) لا تُعيد استجابة HTTP تلقائيًا؛ الخادم يُعيد { ok, data|error }
 * صراحة كقيمة إرجاع من المعالج، ونستخدمها هنا لعرض رسائل خطأ حقيقية بدل فشل صامت.
 */
export function emitWithAck<T>(event: string, payload: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = getSocket();
    const timer = setTimeout(() => reject(new Error('انتهت مهلة الاتصال بالخادم')), timeoutMs);

    socket.emit(event, payload, (ack: Ack<T>) => {
      clearTimeout(timer);
      if (ack?.ok) resolve(ack.data);
      else reject(new Error(ack?.error ?? 'فشل غير معروف من الخادم'));
    });
  });
}
