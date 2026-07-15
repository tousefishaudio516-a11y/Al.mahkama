import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useIdentity } from '../state/IdentityContext';

/**
 * الشاشة الرئيسية — إعادة تصميم بصري فقط. نفس استدعاءات API تماماً
 * (api.createRoom / api.joinRoom) بنفس الحقول، لم يتغيّر أي منطق.
 */
export function Home() {
  const navigate = useNavigate();
  const { setIdentity } = useIdentity();
  const { roomCode: inviteCode } = useParams();

  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'create-local'>(inviteCode ? 'join' : 'menu');
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
      const room = await api.createRoom({ playMode: 'multiplayer', hostDisplayName: displayName.trim() });
      const hostPlayer = room.players?.find((p) => p.userId === room.hostUserId);
      if (!hostPlayer) throw new Error('تعذّر تحديد هوية المحقق (المضيف) بعد فتح الملف');
      setIdentity({ roomCode: room.code, roomId: room.id, playerId: hostPlayer.id, displayName: displayName.trim() });
      navigate(`/room/${room.code}/lobby`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر فتح ملف قضية جديد');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSingleDevice() {
    const names = localNames.map((n) => n.trim()).filter(Boolean);
    if (names.length < 3) return setError('أدخل 3 محققين على الأقل');
    setLoading(true);
    setError(null);
    try {
      const room = await api.createRoom({
        playMode: 'single_device',
        hostDisplayName: names[0],
        localPlayerNames: names,
      });
      const firstPlayer = room.players?.[0];
      if (!firstPlayer) throw new Error('تعذّر تسجيل المحققين');
      setIdentity({ roomCode: room.code, roomId: room.id, playerId: firstPlayer.id, displayName: names[0] });
      navigate(`/room/${room.code}/lobby`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر فتح ملف قضية جديد');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!displayName.trim()) return setError('اكتب اسمك أولاً');
    if (joinCode.trim().length !== 6) return setError('رقم الملف مكوّن من 6 خانات');
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
      setError(err instanceof ApiError ? err.message : 'تعذّر الانضمام لهذا الملف');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div className="court-brand">
        <div className="court-brand__scales">⚖</div>
        <h1 className="court-brand__title">محكمة الذكاء</h1>
        <div className="court-brand__subtitle">أرشيف القضايا السرية</div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {mode === 'menu' && (
        <div className="stack">
          <button className="stamp-btn stamp-btn--gold" onClick={() => setMode('create')}>
            📁 قضية جديدة
          </button>
          <button className="stamp-btn stamp-btn--wood" onClick={() => setMode('join')}>
            🔑 دخول غرفة
          </button>
          <button className="stamp-btn stamp-btn--wood" onClick={() => setMode('create-local')}>
            📱 إنشاء غرفة (هاتف واحد)
          </button>
          {/* لا يوجد أي endpoint في الباك إند لعرض قائمة القضايا السابقة — زر معطَّل
              بصرياً فقط بشارة "قريباً"، بلا أي استدعاء API وهمي، بناءً على القرار المتفق عليه. */}
          <div style={{ position: 'relative' }}>
            <button className="stamp-btn stamp-btn--outline" disabled style={{ width: '100%' }}>
              📂 أرشيف القضايا
            </button>
            <span
              style={{
                position: 'absolute',
                top: -8,
                left: 10,
                background: 'var(--wax-500)',
                color: 'var(--paper-100)',
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 999,
                fontFamily: 'var(--font-display)',
              }}
            >
              قريباً
            </span>
          </div>
          <button className="stamp-btn stamp-btn--outline" onClick={() => navigate('/settings')}>
            ⚙ الإعدادات
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="wood-panel stack">
          <h3>فتح ملف قضية جديد</h3>
          <div className="file-field">
            <label>اسم المحقق (اسمك)</label>
            <input className="file-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: سارة" />
          </div>
          <button className="stamp-btn stamp-btn--gold" onClick={handleCreateMultiplayer} disabled={loading}>
            {loading ? '...جارٍ فتح الملف' : 'فتح الملف'}
          </button>
          <button className="stamp-btn stamp-btn--outline" onClick={() => setMode('menu')}>
            رجوع
          </button>
        </div>
      )}

      {mode === 'create-local' && (
        <div className="wood-panel stack">
          <p className="center-note">أدخلوا أسماء المحققين بالترتيب (3 على الأقل)</p>
          {localNames.map((name, i) => (
            <div className="file-field" key={i}>
              <label>المحقق {i + 1}</label>
              <input
                className="file-input"
                value={name}
                onChange={(e) => {
                  const next = [...localNames];
                  next[i] = e.target.value;
                  setLocalNames(next);
                }}
              />
            </div>
          ))}
          {localNames.length < 12 && (
            <button className="stamp-btn stamp-btn--outline stamp-btn--sm" onClick={() => setLocalNames([...localNames, ''])}>
              + إضافة محقق
            </button>
          )}
          <button className="stamp-btn stamp-btn--gold" onClick={handleCreateSingleDevice} disabled={loading}>
            {loading ? '...جارٍ فتح الملف' : 'بدء التحقيق'}
          </button>
          <button className="stamp-btn stamp-btn--outline" onClick={() => setMode('menu')}>
            رجوع
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="wood-panel stack">
          <h3>الدخول إلى ملف قائم</h3>
          <div className="file-field">
            <label>اسم المحقق (اسمك)</label>
            <input className="file-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: سارة" />
          </div>
          <div className="file-field">
            <label>رقم الملف (الكود)</label>
            <input
              className="file-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
          </div>
          <button className="stamp-btn stamp-btn--gold" onClick={handleJoin} disabled={loading}>
            {loading ? '...جارٍ الدخول' : 'دخول'}
          </button>
          <button className="stamp-btn stamp-btn--outline" onClick={() => setMode('menu')}>
            رجوع
          </button>
        </div>
      )}
    </div>
  );
}
