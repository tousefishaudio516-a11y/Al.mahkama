export type PlayMode = 'multiplayer' | 'single_device';
export type RoomStatus = 'lobby' | 'generating' | 'reading' | 'trial' | 'verdict' | 'reveal' | 'ended';
export type RoleType = 'judge' | 'prosecutor' | 'defense' | 'defendant' | 'witness_main' | 'secondary';
export type TrialEventType = 'statement' | 'evidence_reveal' | 'question' | 'objection' | 'system';
export type VerdictEnum = 'guilty' | 'not_guilty';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  playMode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  inviteLink?: string | null;
  qrCodeUrl?: string | null;
  trialDurationSeconds: number;
  hostUserId?: string;
  players?: RoomPlayerRaw[];
}

export interface RoomPlayerRaw {
  id: string;
  roomId: string;
  userId?: string | null;
  localName?: string | null;
  characterId?: string | null;
  isReady: boolean;
}

export interface PublicPlayer {
  id: string;
  displayName: string;
  isReady: boolean;
  roleType: RoleType | null;
  roleName: string | null;
}

export interface FalseBelief {
  belief: string;
  is_intentional_conflict: boolean;
}

export interface Dossier {
  known_facts: string[];
  false_beliefs: FalseBelief[];
  missing_facts_hint: string[];
  held_evidence: string[];
  lie_or_hide_reason: string | null;
  motive_category: string | null;
  narrative_voice_notes: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  description: string;
  isRevealed: boolean;
  isDecisive: boolean;
}

export interface MyCharacterResponse {
  assigned: boolean;
  character?: {
    id: string;
    roleType: RoleType;
    roleName: string;
    dossier: Dossier;
  };
  evidences?: EvidenceItem[];
}

export interface TrialEvent {
  id: string;
  roomId: string;
  actorPlayerId: string | null;
  eventType: TrialEventType;
  content: string;
  metadata?: unknown;
  createdAt: string;
}

export interface RevealPayload {
  groundTruth: {
    title: string;
    crime_type: string;
    setting: string;
    victim: { name: string; background: string };
    motive: string;
    real_culprit_name: string;
  };
  timeline: { time: string; event: string }[];
  realCulpritCharacterId: string | null;
  decisiveEvidence: EvidenceItem[];
  correctVerdict: { verdict: VerdictEnum; reasoning: string };
  judgeVerdict: { verdict: VerdictEnum; matchesTruth: boolean };
  scores: { id: string; playerId: string; points: number; reason: string }[];
}

/** الهوية المحلية المحفوظة لكل لاعب على متصفحه (لا يوجد نظام مصادقة كامل في هذا الإصدار). */
export interface LocalIdentity {
  roomCode: string;
  roomId: string;
  playerId: string;
  displayName: string;
}
