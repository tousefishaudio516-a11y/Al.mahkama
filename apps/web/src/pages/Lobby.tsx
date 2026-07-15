import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useIdentity } from '../state/IdentityContext';
import type { PublicPlayer, Room } from '../types';

/**
 * شاشة انتظار اللاعبين (تجمع شاشتَي 2+3 من الطلب، لأنهما تعتمدان على نفس بيانات الغرفة
 * الفعلية القادمة من الخادم).
 *
 * ملاحظة مهمة عن "زر إضافة لاعب حتى 12": في وضع الهاتف الواحد، الباك إند يستقبل كل
 * أسماء اللاعبين المحليين دفعة واحدة عند الإنشاء (لا يوجد endpoint لإضافة لاعب لغرفة
 * موجودة بالفعل)، فتم تنفيذ عداد/زر الإضافة (حتى 12) في شاشة الإنشاء نفسها (Home.tsx)
 * قبل الإرسال — وهذا مطابق تماماً لتعليمة "لا تغيير في الـ API". هنا في الانتظار تُعرض
 * البطاقات الفعلية فقط. في وضع "متعدد اللاعبين" الحقيقي، لا يوجد "زر إضافة" أصلاً لأن كل
 * لاعب ينضم بنفسه عبر الكود/QR من جهازه؛ نعرض بدلاً منه بطاقات فارغة للانتظار (حتى 12
 * بصرياً) تمتلئ تلقائياً فور انضمام لاعب حقيقي عبر الاستطلاع الدوري (polling) الموجود أصلاً.
 */
export function Lobby() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const isHost = identity?.playerId && room?.players?.[0]?.id === identity.playerId;
  // الحد الأدنى المطلوب في التصميم الجديد: 3 لاعبين (الباك إند لا يمنع البدء بهذا العدد
  // فعلياً؛ حقل room.minPlayers الرسمي يبقى كما هو في الخادم بلا أي تعديل، وهذا مجرد
  // شرط عرض الزر في الواجهة فقط، تماماً كما طُلب).
  const MIN_TO_START = 3;
  const MAX_VISUAL_SLOTS = 12;

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

        if (roomData.status === 'reading' || roomData.status === 'trial') {
          // بقية اللاعبين (غير المُصدِر لطلب التوليد) يصلون هنا فقط عبر الاستطلاع، بلا
          // بيانات ملخص القضية (title/crimeType/setting) لأن الخادم لا يعيدها إلا في استجابة
          // POST /case/generate نفسها لمن استدعاها فقط، ولا يوجد أي endpoint آخر لاسترجاعها
          // لاحقاً (لم نُضِف واحداً حفاظاً على تعليمة عدم تعديل الباك إند). شاشة ملف القضية
          // نفسها مصمَّمة للتعامل مع غياب هذه البيانات بشكل سليم (راجع CaseFile.tsx).
          navigate(`/room/${roomCode}/casefile`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'تعذّر تحميل بيانات الملف');
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
      const caseSummary = await api.generateCase(room.id, identity.playerId);
      // تمرير الملخص عبر state بدل انتظار الاستطلاع الدوري: هذه هي اللحظة الوحيدة التي
      // تتوفر فيها بيانات عنوان/نوع/مكان القضية على الإطلاق لأي عميل (راجع التعليق في
      // useEffect أعلاه)، فنستغلها هنا للمضيف تحديداً بدل فقدانها.
      navigate(`/room/${roomCode}/casefile`, { state: caseSummary });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر بدء القضية');
      setStarting(false);
    }
  }

  if (!room) {
    return (
      <div className="screen">
        {error ? <div className="error-banner">{error}</div> : <p className="center-note">...جارٍ فتح الملف</p>}
      </div>
    );
  }

  const canStart = players.length >= MIN_TO_START;
  const emptySlots = Math.max(0, Math.min(MAX_VISUAL_SLOTS, room.maxPlayers) - players.length);

  return (
    <div className="screen">
      <div className="court-brand">
        <div className="court-brand__scales">⚖</div>
        <h1 className="court-brand__title">غرفة الانتظار</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {room.playMode === 'multiplayer' && (
        <>
          <div className="room-code-display">{room.code}</div>
          <p className="center-note">شارك رقم الملف هذا مع بقية المحققين، أو أرسل رابط الدعوة مباشرة.</p>
          {room.qrCodeUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 18px' }}>
              <img src={room.qrCodeUrl} alt="QR" width={150} height={150} style={{ borderRadius: 8, border: '4px solid #ecdfc0' }} />
            </div>
          )}
        </>
      )}

      <div className="wood-panel">
        <h3 style={{ textAlign: 'center' }}>
          المحققون ({players.length}{room.playMode === 'multiplayer' ? ` / ${room.minPlayers}+ موصى به` : ''})
        </h3>
        <div className="spacer-lg" />
        <div className="player-card-grid">
          {players.map((p) => (
            <div key={p.id} className={`player-card ${p.isReady ? 'player-card--ready' : ''}`}>
              🕵 {p.displayName}
            </div>
          ))}
          {room.playMode === 'multiplayer' &&
            Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="player-card player-card--empty">
                بانتظار محقق...
              </div>
            ))}
        </div>
      </div>

      {isHost ? (
        <>
          <div className="spacer-lg" />
          {canStart ? (
            <button className="stamp-btn stamp-btn--gold" disabled={starting} onClick={handleStart}>
              {starting ? '...جارٍ فتح ملف القضية' : '🔨 بدء القضية'}
            </button>
          ) : (
            <p className="center-note">بانتظار {MIN_TO_START - players.length} محققين إضافيين لبدء القضية...</p>
          )}
        </>
      ) : (
        <p className="center-note">بانتظار أن يبدأ رئيس التحقيق القضية...</p>
      )}
    </div>
  );
}
