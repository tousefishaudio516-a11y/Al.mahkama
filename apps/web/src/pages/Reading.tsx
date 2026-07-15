import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useIdentity } from '../state/IdentityContext';
import { getSocket, joinRoomChannel, emitWithAck } from '../api/socket';
import { RoleBadge } from '../components/RoleBadge';
import { EvidenceList } from '../components/EvidenceList';
import type { MyCharacterResponse, Room } from '../types';

/**
 * شاشة الملف السري (شاشة 5) — إعادة تصميم بصري بالكامل فقط. لا تغيير في أي منطق:
 * نفس استدعاءات API/Socket (getMyCharacter, mark_ready, getCurrentTurn, closeFile)،
 * ونفس آلية إخفاء بيانات اللاعب السابق عند تبديل الدور في وضع الهاتف الواحد
 * (إعادة تصفير data/revealed في useEffect عند تغيّر currentPlayerId — كانت موجودة أصلاً).
 */
export function Reading() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();

  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRoomByCode(roomCode).then(setRoom).catch(() => setError('تعذّر تحميل الغرفة'));
  }, [roomCode]);

  if (!identity) {
    return (
      <div className="screen">
        <p className="center-note">لا توجد جلسة محفوظة على هذا الجهاز لهذه الغرفة.</p>
      </div>
    );
  }

  if (!room) {
    return <div className="screen">{error ? <div className="error-banner">{error}</div> : <p className="center-note">...جارٍ التحميل</p>}</div>;
  }

  return room.playMode === 'multiplayer' ? (
    <MultiplayerReading roomCode={roomCode} playerId={identity.playerId} onTrialStart={() => navigate(`/room/${roomCode}/trial`)} />
  ) : (
    <SingleDeviceReading roomCode={roomCode} onTrialStart={() => navigate(`/room/${roomCode}/trial`)} />
  );
}

function DossierView({ data }: { data: MyCharacterResponse }) {
  if (!data.assigned || !data.character) {
    return <p className="center-note">...لم يُحدَّد دورك بعد</p>;
  }
  const { character, evidences = [] } = data;
  const dossier = character.dossier;

  return (
    <div className="file-card">
      <div className="seal">سرّي<br />للغاية</div>
      <div className="file-card__lens">🔍</div>
      <div style={{ marginTop: 34, marginBottom: 10 }}>
        <RoleBadge roleType={character.roleType} roleName={character.roleName} />
      </div>

      <div className="file-card__section">
        <h3>ما تعرفه</h3>
        <ul>
          {dossier.known_facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>

      {dossier.false_beliefs.length > 0 && (
        <div className="file-card__section">
          <h3>ما تعتقده (قد لا يكون صحيحًا بالكامل)</h3>
          <ul>
            {dossier.false_beliefs.map((b, i) => (
              <li key={i}>{b.belief}</li>
            ))}
          </ul>
        </div>
      )}

      {dossier.lie_or_hide_reason && (
        <div className="file-card__section">
          <h3>ما تفضّل إخفاءه</h3>
          <p>{dossier.lie_or_hide_reason}</p>
        </div>
      )}

      <div className="file-card__section">
        <h3>الأدلة التي تحملها</h3>
        <EvidenceList evidences={evidences} canReveal={false} />
      </div>

      <p className="center-note" style={{ marginTop: 10 }}>
        🤫 احتفظ بهذه المعلومات لنفسك — ستُستخدم الأدلة لاحقًا أثناء المحاكمة فقط.
      </p>
    </div>
  );
}

function MultiplayerReading({
  roomCode,
  playerId,
  onTrialStart,
}: {
  roomCode: string;
  playerId: string;
  onTrialStart: () => void;
}) {
  const [data, setData] = useState<MyCharacterResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [readyCount, setReadyCount] = useState({ readyCount: 0, totalCount: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMyCharacter(roomCode, playerId)
      .then(setData)
      .catch(() => setError('تعذّر تحميل ملفك السري'));
  }, [roomCode, playerId]);

  useEffect(() => {
    joinRoomChannel(roomCode, playerId);
    const socket = getSocket();
    const onReadyUpdate = (payload: { readyCount: number; totalCount: number; allReady: boolean }) => {
      setReadyCount(payload);
      if (payload.allReady) onTrialStart();
    };
    const onTrialStarted = () => onTrialStart();
    socket.on('ready_update', onReadyUpdate);
    socket.on('trial_started', onTrialStarted);
    return () => {
      socket.off('ready_update', onReadyUpdate);
      socket.off('trial_started', onTrialStarted);
    };
  }, [roomCode, playerId, onTrialStart]);

  async function handleReady() {
    setError(null);
    try {
      const result = await emitWithAck<{ readyCount: number; totalCount: number; allReady: boolean }>(
        'mark_ready',
        { roomCode, playerId },
      );
      setReady(true);
      setReadyCount(result);
      if (result.allReady) onTrialStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل جاهزيتك');
    }
  }

  return (
    <div className="screen secret-screen">
      <div className="court-brand">
        <div className="secret-screen__stamp">ملف سري</div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {data ? <DossierView data={data} /> : <p className="center-note">...جارٍ فك ختم الملف</p>}

      <div className="spacer-lg" />
      {!ready ? (
        <button className="stamp-btn stamp-btn--gold" onClick={handleReady}>
          ✅ انتهيت من القراءة — أنا جاهز
        </button>
      ) : (
        <p className="center-note">
          بانتظار بقية المحققين ({readyCount.readyCount}/{readyCount.totalCount})...
        </p>
      )}
    </div>
  );
}

function SingleDeviceReading({ roomCode, onTrialStart }: { roomCode: string; onTrialStart: () => void }) {
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [data, setData] = useState<MyCharacterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const lastLoadedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // استطلاع دوري لمعرفة دور من الحالي (لا يوجد بث Socket مخصص لهذا التحوّل)
    const interval = setInterval(async () => {
      try {
        const turn = await api.getCurrentTurn(roomCode);
        if (cancelled) return;
        if (!turn) return;
        if (turn.currentPlayerId === null) {
          onTrialStart();
          return;
        }
        setCurrentPlayerId(turn.currentPlayerId);
      } catch {
        /* تجاهل فشل استطلاع مؤقت */
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomCode, onTrialStart]);

  useEffect(() => {
    // هذا الشرط هو ما يضمن إخفاء بيانات اللاعب السابق فوراً عند تبديل الدور —
    // موجود أصلاً في المنطق السابق، لم يتغيّر هنا إطلاقاً.
    if (!currentPlayerId || lastLoadedFor.current === currentPlayerId) return;
    lastLoadedFor.current = currentPlayerId;
    setRevealed(false);
    setData(null);
    api
      .getMyCharacter(roomCode, currentPlayerId)
      .then(setData)
      .catch(() => setError('تعذّر تحميل الملف'));
  }, [roomCode, currentPlayerId]);

  async function handleCloseFile() {
    try {
      const result = await api.closeFile(roomCode);
      if (result.finished) onTrialStart();
      // وإلا: الاستطلاع أعلاه سيلتقط اللاعب التالي تلقائيًا خلال ثانية ونصف تقريبًا
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر المتابعة للاعب التالي');
    }
  }

  if (!currentPlayerId) {
    return <div className="screen"><p className="center-note">...جارٍ تحضير ترتيب القراءة</p></div>;
  }

  return (
    <div className="screen secret-screen">
      <div className="court-brand">
        <h1 className="court-brand__title">📱 مرّر الهاتف الآن</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {!revealed ? (
        <div className="wood-panel" style={{ textAlign: 'center' }}>
          <p>سلّم الهاتف للمحقق التالي في الدور، ثم اضغط للكشف عن ملفك أنت فقط.</p>
          <div className="spacer-lg" />
          <button className="stamp-btn stamp-btn--gold" onClick={() => setRevealed(true)}>
            🔓 هذا هاتفي، اعرض ملفي
          </button>
        </div>
      ) : data ? (
        <>
          <DossierView data={data} />
          <div className="spacer-lg" />
          <button className="stamp-btn stamp-btn--wax" onClick={handleCloseFile}>
            🔒 إخفاء الملف وتسليم الهاتف
          </button>
        </>
      ) : (
        <p className="center-note">...جارٍ التحميل</p>
      )}
    </div>
  );
}
