import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { PublicPlayer, RevealPayload } from '../types';

export function Reveal() {
  const { roomCode = '' } = useParams();
  const [payload, setPayload] = useState<RevealPayload | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const room = await api.getRoomByCode(roomCode);
        const [reveal, playersData] = await Promise.all([
          api.getReveal(room.id),
          api.getRoomPlayersPublic(roomCode),
        ]);
        setPayload(reveal);
        setPlayers(playersData);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'تعذّر تحميل الكشف — قد يكون الحكم لم يصدر بعد');
      }
    }
    load();
  }, [roomCode]);

  if (error) {
    return (
      <div className="screen">
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!payload) {
    return <div className="screen"><p className="center-note">...جارٍ تحميل الكشف</p></div>;
  }

  const scoresByPlayer = new Map(players.map((p) => [p.id, p]));
  const sortedScores = [...payload.scores].sort((a, b) => b.points - a.points);
  const totals = new Map<string, number>();
  for (const s of payload.scores) {
    totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points);
  }

  return (
    <div className="screen">
      <div className="brand">
        <div className="brand__seal">ع</div>
        <h1 className="brand__title">الكشف الكامل</h1>
      </div>

      <div className="dossier-card">
        <div className="dossier-card__stamp">مغلقة</div>
        <h2 style={{ marginTop: 30 }}>{payload.groundTruth.title}</h2>
        <p>{payload.groundTruth.setting}</p>
        <h3>الفاعل الحقيقي</h3>
        <p>{payload.groundTruth.real_culprit_name}</p>
        <h3>الدافع</h3>
        <p>{payload.groundTruth.motive}</p>
        <h3>الحكم الصحيح</h3>
        <p>
          {payload.correctVerdict.verdict === 'guilty' ? 'مذنب' : 'بريء'} — {payload.correctVerdict.reasoning}
        </p>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>حكم القاضي في هذه الجولة</h3>
        <p>
          {payload.judgeVerdict.verdict === 'guilty' ? 'مذنب' : 'بريء'} —{' '}
          {payload.judgeVerdict.matchesTruth ? '✅ مطابق للحقيقة' : '❌ غير مطابق للحقيقة'}
        </p>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>الأدلة الحاسمة</h3>
        {payload.decisiveEvidence.map((ev) => (
          <div key={ev.id} className="evidence-chip evidence-chip--revealed">
            <div>
              <div className="evidence-chip__title">{ev.title}</div>
              <div className="evidence-chip__desc">{ev.description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>النقاط</h3>
        <div className="stack">
          {[...totals.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([playerId, total]) => (
              <div key={playerId} className="player-tile" style={{ textAlign: 'right' }}>
                <strong>{scoresByPlayer.get(playerId)?.displayName ?? 'لاعب'}</strong> — {total} نقطة
              </div>
            ))}
        </div>
        <div className="spacer-lg" />
        <details>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-200)' }}>تفاصيل النقاط</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            {sortedScores.map((s) => (
              <div key={s.id} className="event-row">
                <div className="event-row__meta">{scoresByPlayer.get(s.playerId)?.displayName ?? 'لاعب'}</div>
                {s.reason}: {s.points >= 0 ? `+${s.points}` : s.points}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
