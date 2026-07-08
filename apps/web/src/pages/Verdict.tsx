import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useIdentity } from '../state/IdentityContext';
import type { MyCharacterResponse, Room, VerdictEnum } from '../types';

export function Verdict() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();

  const [room, setRoom] = useState<Room | null>(null);
  const [myCharacter, setMyCharacter] = useState<MyCharacterResponse | null>(null);
  const [verdict, setVerdict] = useState<VerdictEnum>('guilty');
  const [penalty, setPenalty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    api.getMyCharacter(roomCode, identity.playerId).then(setMyCharacter).catch(() => {});
  }, [roomCode, identity]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await api.getRoomByCode(roomCode);
        if (cancelled) return;
        setRoom(r);
        if (r.status === 'reveal' || r.status === 'ended') {
          navigate(`/room/${roomCode}/reveal`, { replace: true });
        }
      } catch {
        /* تجاهل فشل استطلاع مؤقت */
      }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomCode, navigate]);

  if (!identity) return <div className="screen" />;

  const isJudge = myCharacter?.character?.roleType === 'judge';

  async function handleSubmit() {
    if (!identity || !room) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitVerdict(room.id, { judgePlayerId: identity.playerId, verdict, penalty: penalty.trim() || undefined });
      navigate(`/room/${roomCode}/reveal`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الحكم');
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <div className="brand">
        <div className="brand__seal">ع</div>
        <h1 className="brand__title">وقت الحكم</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isJudge ? (
        <div className="panel stack">
          <p className="center-note">بصفتك القاضي، أصدر حكمك النهائي في هذه القضية.</p>
          <div className="field">
            <label>الحكم</label>
            <select className="input" value={verdict} onChange={(e) => setVerdict(e.target.value as VerdictEnum)}>
              <option value="guilty">مذنب</option>
              <option value="not_guilty">بريء</option>
            </select>
          </div>
          <div className="field">
            <label>العقوبة (اختياري)</label>
            <input className="input" value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="مثال: الحبس سنة مع وقف التنفيذ" />
          </div>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '...جارٍ الإرسال' : 'إصدار الحكم'}
          </button>
        </div>
      ) : (
        <p className="center-note">انتهت المحاكمة. بانتظار أن يصدر القاضي حكمه النهائي...</p>
      )}
    </div>
  );
}
