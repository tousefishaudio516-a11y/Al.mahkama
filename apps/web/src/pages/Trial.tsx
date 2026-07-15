import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useIdentity } from '../state/IdentityContext';
import { getSocket, joinRoomChannel, emitWithAck } from '../api/socket';
import { Timer } from '../components/Timer';
import { EventFeed } from '../components/EventFeed';
import { EvidenceList } from '../components/EvidenceList';
import { RoleBadge } from '../components/RoleBadge';
import type { EvidenceItem, MyCharacterResponse, PublicPlayer, TrialEvent } from '../types';

/**
 * قاعة المحكمة (شاشة 6) — إعادة تصميم بصري كامل + إعادة تنظيم الأزرار في شبكة صريحة
 * (طلب الكلام / عرض دليل / سؤال لاعب / إصدار الحكم) كما طُلب. لا تغيير في أي استدعاء API
 * أو Socket: نفس eventType values ('statement'|'question'|'objection')، ونفس أحداث
 * trial_event / reveal_evidence / end_trial_early تماماً. "طلب الكلام" و"سؤال لاعب" مجرد
 * اختصارين يضبطان eventType ثم يركّزان حقل الكتابة (لا إرسال تلقائي بلا نص). "عرض دليل"
 * يمرّر الشاشة لقسم أدلتك بدل إرسال أي شيء. "إصدار الحكم" تستدعي نفس end_trial_early
 * الموجودة أصلاً (القاضي فقط، بلا تغيير في الصلاحيات المُتحقَّق منها في الخادم).
 */
export function Trial() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();

  const [remaining, setRemaining] = useState<number>(0);
  const [events, setEvents] = useState<TrialEvent[]>([]);
  const [myCharacter, setMyCharacter] = useState<MyCharacterResponse | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [message, setMessage] = useState('');
  const [eventType, setEventType] = useState<'statement' | 'question' | 'objection'>('statement');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!identity) return;
    joinRoomChannel(roomCode, identity.playerId);
    api.getMyCharacter(roomCode, identity.playerId).then(setMyCharacter).catch(() => {});
    api.getRoomPlayersPublic(roomCode).then(setPlayers).catch(() => {});
    api.getRemainingSeconds(roomCode).then(setRemaining).catch(() => {});

    const socket = getSocket();
    const onTimer = (payload: { remaining: number }) => setRemaining(payload.remaining);
    const onEvent = (ev: TrialEvent) => setEvents((prev) => [...prev, ev]);
    const onEvidenceRevealed = (ev: EvidenceItem) => {
      setMyCharacter((prev) =>
        prev?.evidences
          ? { ...prev, evidences: prev.evidences.map((e) => (e.id === ev.id ? { ...e, isRevealed: true } : e)) }
          : prev,
      );
    };
    const onTrialEnded = () => navigate(`/room/${roomCode}/verdict`);

    socket.on('timer_update', onTimer);
    socket.on('trial_event_broadcast', onEvent);
    socket.on('evidence_revealed', onEvidenceRevealed);
    socket.on('trial_ended', onTrialEnded);

    const localTick = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);

    return () => {
      socket.off('timer_update', onTimer);
      socket.off('trial_event_broadcast', onEvent);
      socket.off('evidence_revealed', onEvidenceRevealed);
      socket.off('trial_ended', onTrialEnded);
      clearInterval(localTick);
    };
  }, [roomCode, identity, navigate]);

  if (!identity) return <div className="screen" />;

  async function handleSend() {
    if (!message.trim() || !identity) return;
    setError(null);
    try {
      await emitWithAck('trial_event', {
        roomId: identity.roomId,
        roomCode,
        event: { actorPlayerId: identity.playerId, eventType, content: message.trim() },
      });
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الحدث');
    }
  }

  async function handleReveal(evidenceId: string) {
    if (!identity) return;
    setError(null);
    try {
      await emitWithAck('reveal_evidence', {
        roomId: identity.roomId,
        roomCode,
        evidenceId,
        actorPlayerId: identity.playerId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر كشف الدليل');
    }
  }

  async function handleEndEarly() {
    if (!identity) return;
    setError(null);
    try {
      await emitWithAck('end_trial_early', {
        roomId: identity.roomId,
        roomCode,
        judgePlayerId: identity.playerId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إصدار الحكم');
    }
  }

  function quickAction(type: 'statement' | 'question') {
    setEventType(type);
    inputRef.current?.focus();
  }

  const isJudge = myCharacter?.character?.roleType === 'judge';
  const hasEvidence = (myCharacter?.evidences?.length ?? 0) > 0;

  return (
    <div className="screen">
      <div className="court-brand">
        <div className="court-brand__scales">⚖</div>
        <h1 className="court-brand__title">جلسة المحكمة</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="courtroom">
        <div className="courtroom__bench">
          <div className="courtroom__bench-icon">👨‍⚖️</div>
          <Timer seconds={remaining} />
          {myCharacter?.character && (
            <RoleBadge roleType={myCharacter.character.roleType} roleName={myCharacter.character.roleName} />
          )}
        </div>

        {/* شريط بطاقات صغيرة لكل اللاعبين حول القاعة — بصري بحت، من نفس بيانات
            getRoomPlayersPublic المستخدمة أصلاً في Lobby/CaseFile، بلا أي منطق جديد. */}
        {players.length > 0 && (
          <div className="courtroom-gallery">
            {players.map((p) => (
              <div key={p.id} className="gallery-seat">
                <div className="gallery-seat__icon">{p.roleType === 'judge' ? '👨‍⚖️' : '🕵'}</div>
                {p.displayName}
              </div>
            ))}
          </div>
        )}

        <EventFeed events={events} />

        <div className="file-field" style={{ marginTop: 14 }}>
          <input
            ref={inputRef}
            className="file-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={eventType === 'question' ? 'اكتب سؤالك...' : 'اكتب تصريحك...'}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
        </div>
        <button className="stamp-btn stamp-btn--gold stamp-btn--sm" onClick={handleSend} style={{ width: '100%' }}>
          📢 إرسال
        </button>

        <div className="action-grid">
          <button className="stamp-btn stamp-btn--wood" onClick={() => quickAction('statement')}>
            🗣 طلب الكلام
          </button>
          <button
            className="stamp-btn stamp-btn--wood"
            onClick={() => evidenceRef.current?.scrollIntoView({ behavior: 'smooth' })}
            disabled={!hasEvidence}
          >
            🗂 عرض دليل
          </button>
          <button className="stamp-btn stamp-btn--wood" onClick={() => quickAction('question')}>
            ❓ سؤال لاعب
          </button>
          {isJudge ? (
            <button className="stamp-btn stamp-btn--wax" onClick={handleEndEarly}>
              🔨 إصدار الحكم
            </button>
          ) : (
            <button className="stamp-btn stamp-btn--outline" disabled>
              🔨 بانتظار القاضي
            </button>
          )}
        </div>

        {/* قسم الشهادات — بصري بحت، يسرد الشهود من نفس قائمة اللاعبين العامة، بلا أي
            استدعاء أو منطق إضافي (مجرد فلترة roleType محلياً). */}
        {players.some((p) => p.roleType === 'witness_main' || p.roleType === 'secondary') && (
          <div className="testimony-section">
            <h3>🗣️ الشهادات</h3>
            <div className="stack">
              {players
                .filter((p) => p.roleType === 'witness_main' || p.roleType === 'secondary')
                .map((p) => (
                  <div key={p.id} className="dialogue-line">
                    <div className="dialogue-line__meta">{p.roleName ?? 'شاهد'}</div>
                    {p.displayName} حاضر ومتاح للاستجواب في القاعة.
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {hasEvidence && (
        <div className="wood-panel" ref={evidenceRef}>
          <h3>أدلتك (يمكنك كشفها الآن)</h3>
          <EvidenceList evidences={myCharacter!.evidences!} onReveal={handleReveal} canReveal />
        </div>
      )}
    </div>
  );
}
