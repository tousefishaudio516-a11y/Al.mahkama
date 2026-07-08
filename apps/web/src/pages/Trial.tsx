import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useIdentity } from '../state/IdentityContext';
import { getSocket, joinRoomChannel, emitWithAck } from '../api/socket';
import { Timer } from '../components/Timer';
import { EventFeed } from '../components/EventFeed';
import { EvidenceList } from '../components/EvidenceList';
import { RoleBadge } from '../components/RoleBadge';
import type { EvidenceItem, MyCharacterResponse, TrialEvent } from '../types';

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'statement', label: 'تصريح' },
  { value: 'question', label: 'سؤال' },
  { value: 'objection', label: 'اعتراض' },
];

export function Trial() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();

  const [remaining, setRemaining] = useState<number>(0);
  const [events, setEvents] = useState<TrialEvent[]>([]);
  const [myCharacter, setMyCharacter] = useState<MyCharacterResponse | null>(null);
  const [message, setMessage] = useState('');
  const [eventType, setEventType] = useState('statement');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    joinRoomChannel(roomCode, identity.playerId);
    api.getMyCharacter(roomCode, identity.playerId).then(setMyCharacter).catch(() => {});
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

    // احتياطي: لو فاتنا بث timer_update لأي سبب، تحقق محليًا كل ثانية وانتقل عند الوصول للصفر
    const localTick = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

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
      setError(err instanceof Error ? err.message : 'تعذّر إنهاء المحاكمة');
    }
  }

  const isJudge = myCharacter?.character?.roleType === 'judge';

  return (
    <div className="screen">
      <div className="brand">
        <div className="brand__seal">ع</div>
        <h1 className="brand__title">جلسة المحاكمة</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <Timer seconds={remaining} />

      {myCharacter?.character && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <RoleBadge roleType={myCharacter.character.roleType} roleName={myCharacter.character.roleName} />
        </div>
      )}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>سجل المحاكمة</h3>
        <EventFeed events={events} />
      </div>

      <div className="panel stack">
        <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب تصريحك أو سؤالك..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button className="btn btn--primary" onClick={handleSend}>
          إرسال
        </button>
      </div>

      {myCharacter?.evidences && myCharacter.evidences.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>أدلتك (يمكنك كشفها الآن)</h3>
          <EvidenceList evidences={myCharacter.evidences} onReveal={handleReveal} canReveal />
        </div>
      )}

      {isJudge && (
        <>
          <div className="spacer-lg" />
          <button className="btn btn--danger" onClick={handleEndEarly}>
            إنهاء المحاكمة الآن والانتقال للحكم
          </button>
        </>
      )}
    </div>
  );
}
