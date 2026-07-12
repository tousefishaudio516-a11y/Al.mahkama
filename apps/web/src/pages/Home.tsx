import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useIdentity } from '../state/IdentityContext';

export function Home() {
  const navigate = useNavigate();
  const { setIdentity } = useIdentity();
  const { roomCode: inviteCode } = useParams();

  const [mode, setMode] = useState<'choose' | 'create' | 'join' | 'create-local'>(inviteCode ? 'join' : 'choose');
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState(inviteCode?.toUpperCase() ?? '');
  const [localNames, setLocalNames] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inviteCode) {
      setMode('join');
      setJoinCode(inviteCode.toUpperCase());
    }
  }, [inviteCode]);

  async function handleCreateMultiplayer() {
    if (!displayName.trim()) return setError('اكتب اسمك أولاً');
    setLoading(true);
    setError(null);
    try {
      const room = await api.createRoom({ playMode: 'multiplayer', hostDisplayName: displayName.trim() }); console.log('ROOM RESPONSE', room);
      const hostPlayer = room.players?.[0];
      if (!hostPlayer) throw new Error('تعذّر تحديد هوية المضيف بعد إنشاء الغرفة');
      setIdentity({ roomCode: room.code, roomId: room.id, playerId: hostPlayer.id, displayName: displayName.trim() });
      window.location.href =(`/room/${room.code}/lobby`);
    } catch (err) {
      console.error(err); setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSingleDevice() {
    const names = localNames.map((n) => n.trim()).filter(Boolean);
    if (names.length < 3) return setError('أدخل 3 أسماء لاعبين على الأقل');
    setLoading(true);
    setError(null);
    try {
      const room = await api.createRoom({
        playMode: 'single_device',
        hostDisplayName: names[0],
        localPlayerNames: names,
      });
      const firstPlayer = room.players?.[0];
      if (!firstPlayer) throw new Error('تعذّر إنشاء اللاعبين المحليين');
      // في وضع الهاتف الواحد: الجهاز نفسه "يمثّل" أول لاعب فقط لأغراض تحديد الهوية التقنية
      setIdentity({ roomCode: room.code, roomId: room.id, playerId: firstPlayer.id, displayName: names[0] });
      navigate(`/room/${room.code}/lobby`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الغرفة');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!displayName.trim()) return setError('اكتب اسمك أولاً');
    if (joinCode.trim().length !== 6) return setError('كود الغرفة مكوّن من 6 خانات');
    setLoading(true);
    setError(null);
    try {
      const { room, player } = await api.joinRoom({
        code: joinCode.trim().toUpperCase(),
        displayName: displayName.trim(),
      });
      setIdentity({ roomCode: room.code, roomId: room.id, playerId: player.id, displayName: displayName.trim() });
      navigate(`/room/${room.code}/lobby`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر الانضمام للغرفة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div className="brand">
        <div className="brand__seal">ع</div>
        <h1 className="brand__title">محكمة الذكاء</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {mode === 'choose' && (
        <div className="stack">
          <button className="btn btn--primary" onClick={() => setMode('create')}>
            إنشاء غرفة جديدة (عن بُعد)
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('create-local')}>
            لعب على هاتف واحد (Pass &amp; Play)
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('join')}>
            الانضمام لغرفة بكود
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="panel stack">
          <div className="field">
            <label>اسمك</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: سارة" />
          </div>
          <button className="btn btn--primary" onClick={handleCreateMultiplayer} disabled={loading}>
            {loading ? '...جارٍ الإنشاء' : 'إنشاء الغرفة'}
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('choose')}>
            رجوع
          </button>
        </div>
      )}

      {mode === 'create-local' && (
        <div className="panel stack">
          <p className="center-note">أدخلوا أسماءكم بالترتيب (3 لاعبين على الأقل)</p>
          {localNames.map((name, i) => (
            <div className="field" key={i}>
              <label>اللاعب {i + 1}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => {
                  const next = [...localNames];
                  next[i] = e.target.value;
                  setLocalNames(next);
                }}
              />
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={() => setLocalNames([...localNames, ''])}>
            + إضافة لاعب
          </button>
          <button className="btn btn--primary" onClick={handleCreateSingleDevice} disabled={loading}>
            {loading ? '...جارٍ الإنشاء' : 'بدء اللعبة'}
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('choose')}>
            رجوع
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="panel stack">
          <div className="field">
            <label>اسمك</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: سارة" />
          </div>
          <div className="field">
            <label>كود الغرفة</label>
            <input
              className="input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
          </div>
          <button className="btn btn--primary" onClick={handleJoin} disabled={loading}>
            {loading ? '...جارٍ الانضمام' : 'انضمام'}
          </button>
          <button className="btn btn--ghost" onClick={() => setMode('choose')}>
            رجوع
          </button>
        </div>
      )}
    </div>
  );
}
