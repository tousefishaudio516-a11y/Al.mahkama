import type {
  MyCharacterResponse,
  PlayMode,
  PublicPlayer,
  RevealPayload,
  Room,
  TrialEvent,
  VerdictEnum,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://al-mahkama.onrender.com';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    let message = `خطأ في الخادم (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message ?? message;
    } catch {
      /* الاستجابة ليست JSON، نستخدم الرسالة الافتراضية */
    }
    throw new ApiError(Array.isArray(message) ? message.join('، ') : message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * ملاحظة مهمة عن المعرّفات: بعض نقاط النهاية في الخادم تستخدم كود الغرفة المكوّن من 6
 * أحرف (roomCode، وهو ما يظهر للاعبين)، وأخرى تستخدم معرّف UUID الداخلي (roomId). هذا
 * ليس خطأ من هذه الواجهة — إنه شكل الخادم الفعلي؛ الدوال أدناه مسمّاة بوضوح لتفادي الخلط.
 */
export const api = {
  // ---------------- الغرف ----------------
  createRoom(payload: { playMode: PlayMode; hostDisplayName: string; localPlayerNames?: string[] }) {
    return request<Room>('/rooms', { method: 'POST', body: JSON.stringify(payload) });
  },

  joinRoom(payload: { code: string; displayName: string }) {
    return request<{ room: Room; player: { id: string }; user: { id: string } }>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getRoomByCode(code: string) {
    return request<Room>(`/rooms/${code}`);
  },

  // ---------------- اللاعبون ----------------
  getRoomPlayersPublic(roomCode: string) {
    return request<PublicPlayer[]>(`/rooms/${roomCode}/players`);
  },

  getMyCharacter(roomCode: string, playerId: string) {
    return request<MyCharacterResponse>(`/rooms/${roomCode}/players/${playerId}/me`);
  },

  // ---------------- القضية (roomId الداخلي وليس الكود) ----------------
  generateCase(roomId: string, requestingPlayerId: string) {
    return request<{ id: string; title: string; crimeType: string; setting: string; status: string }>(
      `/rooms/${roomId}/case/generate`,
      { method: 'POST', body: JSON.stringify({ requestingPlayerId }) },
    );
  },

  // ---------------- القراءة (roomCode) ----------------
  markReady(roomCode: string, playerId: string) {
    return request<{ readyCount: number; totalCount: number; allReady: boolean }>(
      `/rooms/${roomCode}/ready`,
      { method: 'POST', body: JSON.stringify({ playerId }) },
    );
  },

  getCurrentTurn(roomCode: string) {
    return request<{ currentPlayerId: string | null; index: number; total: number } | null>(
      `/rooms/${roomCode}/reading/current-turn`,
    );
  },

  closeFile(roomCode: string) {
    return request<{ finished: boolean; nextPlayerId: string | null }>(
      `/rooms/${roomCode}/reading/close-file`,
      { method: 'POST' },
    );
  },

  // ---------------- المحاكمة (roomCode) ----------------
  getRemainingSeconds(roomCode: string) {
    return request<number>(`/rooms/${roomCode}/trial/remaining`);
  },

  recordEvent(
    roomCode: string,
    dto: { actorPlayerId?: string; eventType: string; content: string; metadata?: unknown },
  ) {
    return request<TrialEvent>(`/rooms/${roomCode}/trial/events`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  revealEvidence(roomCode: string, evidenceId: string, actorPlayerId: string) {
    return request(`/rooms/${roomCode}/trial/evidence/${evidenceId}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ actorPlayerId }),
    });
  },

  endTrialEarly(roomCode: string, judgePlayerId: string) {
    return request(`/rooms/${roomCode}/trial/end-early`, {
      method: 'POST',
      body: JSON.stringify({ judgePlayerId }),
    });
  },

  // ---------------- الحكم والكشف (roomId الداخلي) ----------------
  submitVerdict(roomId: string, dto: { judgePlayerId: string; verdict: VerdictEnum; penalty?: string }) {
    return request(`/rooms/${roomId}/verdict`, { method: 'POST', body: JSON.stringify(dto) });
  },

  getReveal(roomId: string) {
    return request<RevealPayload>(`/rooms/${roomId}/reveal`);
  },
};

export { ApiError };
