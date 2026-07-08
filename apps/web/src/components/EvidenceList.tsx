import type { EvidenceItem } from '../types';

export function EvidenceList({
  evidences,
  onReveal,
  canReveal,
}: {
  evidences: EvidenceItem[];
  onReveal?: (evidenceId: string) => void;
  canReveal: boolean;
}) {
  if (evidences.length === 0) {
    return <p className="center-note">لا تملك أي دليل مادي في هذه القضية.</p>;
  }

  return (
    <div>
      {evidences.map((ev) => (
        <div key={ev.id} className={`evidence-chip ${ev.isRevealed ? 'evidence-chip--revealed' : ''}`}>
          <div>
            <div className="evidence-chip__title">{ev.title}</div>
            <div className="evidence-chip__desc">{ev.description}</div>
          </div>
          {!ev.isRevealed && canReveal && onReveal && (
            <button className="btn btn--primary btn--sm" onClick={() => onReveal(ev.id)}>
              اكشف
            </button>
          )}
          {ev.isRevealed && <span className="badge badge--brass">مكشوف</span>}
        </div>
      ))}
    </div>
  );
}
