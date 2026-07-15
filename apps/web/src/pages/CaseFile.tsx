import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PublicPlayer } from '../types';
import { ROLE_LABELS } from '../components/RoleBadge';

interface CaseSummaryState {
  id: string;
  title: string;
  crimeType: string;
  setting: string;
}

/**
 * شاشة "ملف القضية" الجديدة (لا يوجد ما يقابلها سابقاً في المشروع).
 *
 * قيد حقيقي من الباك إند (بلا أي تعديل عليه كما طُلب): عنوان/نوع/مكان القضية تُعاد فقط
 * ضمن استجابة POST /rooms/:roomId/case/generate نفسها، ولا يوجد أي endpoint لاسترجاعها
 * لاحقاً. لذلك من "فتح" القضية فعلياً (المضيف) يرى التفاصيل الكاملة عبر state القادم من
 * Lobby، بينما بقية اللاعبين (الذين وصلوا عبر الاستطلاع الدوري) يرون نسخة مختصرة سليمة
 * بلا تلفيق بيانات. الأدلة/الخط الزمني الكاملان لا يُعرضان هنا عمداً لأنهما يُفترض ألا
 * يصلا للعميل قبل الكشف النهائي أصلاً (مبدأ أمني موجود في المشروع من قبل).
 */
export function CaseFile() {
  const { roomCode = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const caseSummary = location.state as CaseSummaryState | null;

  const [players, setPlayers] = useState<PublicPlayer[]>([]);

  useEffect(() => {
    api.getRoomPlayersPublic(roomCode).then(setPlayers).catch(() => {});
  }, [roomCode]);

  return (
    <div className="screen">
      <div className="court-brand">
        <div className="court-brand__scales">⚖</div>
        <h1 className="court-brand__title">ملف القضية</h1>
      </div>

      <div className="file-card">
        <div className="seal">رسمي</div>
        <div className="file-card__lens">🔍</div>
        <div className="file-card__number">رقم الملف: {roomCode}</div>

        {caseSummary ? (
          <>
            <div className="file-card__title">{caseSummary.title}</div>
            <div className="file-card__meta">
              <span>📍 {caseSummary.setting}</span>
              <span>⚔ {caseSummary.crimeType}</span>
            </div>
            <div className="file-card__section">
              <h3>المقدمة</h3>
              <p>
                فُتح هذا الملف للتحقيق في قضية «{caseSummary.title}» التي وقعت في {caseSummary.setting}. على
                فريق التحقيق استجواب كل الأطراف والوصول إلى الحقيقة قبل انتهاء وقت الجلسة.
              </p>
            </div>
          </>
        ) : (
          <div className="file-card__section">
            <h3>القضية جاهزة</h3>
            <p>تفاصيل القضية الكاملة موجودة الآن في ملفك السري الخاص. افتحه لمعرفة دورك وما تعرفه.</p>
          </div>
        )}

        <div className="file-card__section">
          <h3>الأدلة والخط الزمني</h3>
          <p style={{ opacity: 0.75 }}>🔒 سرّي — ستُكشف تباعاً أثناء جلسة المحكمة فقط.</p>
        </div>

        <div className="file-card__section">
          <h3>الأطراف الحاضرة</h3>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                {p.displayName} — {p.roleName ?? (p.roleType ? ROLE_LABELS[p.roleType] : 'بانتظار تحديد الدور')}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="spacer-lg" />
      <button className="stamp-btn stamp-btn--gold" onClick={() => navigate(`/room/${roomCode}/reading`)}>
        🔓 افتح ملفك السري
      </button>
    </div>
  );
}
