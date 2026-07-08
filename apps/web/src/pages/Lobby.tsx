import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useIdentity } from '../state/IdentityContext';
import type { PublicPlayer, Room } from '../types';

export function Lobby() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // ملاحظة: لا يوجد حقل صريح "isHost" على RoomPlayer في الخادم حاليًا، فنعتمد افتراضًا
  // معقولًا (أول لاعب انضم = المضيف، وهو ترتيب الإنشاء الفعلي في RoomsService).
  // يكفي لتحديد من يملك زر "بدء اللعبة"، لكنه ليس تحققًا أمنيًا صارمًا على مستوى الخادم.
  const isHost = identity?.playerId && room?.players?.[0]?.id === identity.playerId;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [roomData, playersData] = await Promise.all([
          api.getRoomByCode(roomCode),
          api.getRoomPlayersPublic(roomCode),
        ]);
        if (cancelled) return;
        setRoom(roomData);
        setPlayers(playersData);

        // انتقال تلقائي لكل اللاعبين فور اكتمال توليد القضية (لا يوجد بث Socket لهذا التحوّل بعد،
        // فنعتمد على الاستطلاع الدوري كحل عملي بسيط وموثوق).
        if (roomData.status === 'reading' || roomData.status === 'trial') {
          navigate(`/room/${roomCode}/reading`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'تعذّر تحميل بيانات الغرفة');
      }
    }

    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomCode, navigate]);

  async function handleStart() {
    if (!room || !identity) return;
    setStarting(true);
    setError(null);
    try {
      await api.generateCase(room.id, identity.playerId);
      // الاستطلاع أعلاه سيتكفّل بنقل الجميع تلقائيًا فور تحوّل الحالة إلى reading
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر بدء اللعبة');
      setStarting(false);
    }
  }

  if (!room) {
    return (
      <div className="screen">
        {error ? <div className="error-banner">{error}</div> : <p className="center-note">...جارٍ التحميل</p>}
      </div>
    );
  }

  const canStart = players.length >= room.minPlayers;

  return (
    <div className="screen">
      <div className="brand">
        <div className="brand__seal">ع</div>
        <h1 className="brand__title">غرفة الانتظار</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {room.playMode === 'multiplayer' && (
        <>
          <div className="room-code">{room.code}</div>
          <p className="center-note">شارك هذا الكود مع أصدقائك، أو أرسل رابط الدعوة مباشرة.</p>
          {room.qrCodeUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 18px' }}>
              <img src={room.qrCodeUrl} alt="QR" width={160} height={160} style={{ borderRadius: 12 }} />
            </div>
          )}
        </>
      )}

      <div className="panel">
        <p className="center-note" style={{ margin: 0 }}>
          {players.length} / {room.minPlayers}+ لاعبين (الحد الأدنى للبدء)
        </p>
        <div className="spacer-lg" />
        <div className="players-grid">
          {players.map((p) => (
            <div key={p.id} className={`player-tile ${p.isReady ? 'player-tile--ready' : ''}`}>
              {p.displayName}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <>
          <div className="spacer-lg" />
          <button className="btn btn--primary" disabled={!canStart || starting} onClick={handleStart}>
            {starting ? '...جارٍ التحضير' : canStart ? 'بدء اللعبة' : `بانتظار ${room.minPlayers - players.length} لاعبين إضافيين`}
          </button>
        </>
      ) : (
        <p className="center-note">بانتظار أن يبدأ المضيف اللعبة...</p>
      )}
    </div>
  );
}
