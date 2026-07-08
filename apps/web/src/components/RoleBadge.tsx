import type { RoleType } from '../types';

export const ROLE_LABELS: Record<RoleType, string> = {
  judge: 'القاضي',
  prosecutor: 'الادعاء',
  defense: 'الدفاع',
  defendant: 'المتهم',
  witness_main: 'شاهد رئيسي',
  secondary: 'شخصية ثانوية',
};

export function RoleBadge({ roleType, roleName }: { roleType: RoleType; roleName?: string }) {
  const variant = roleType === 'judge' ? 'badge--brass' : roleType === 'defendant' ? 'badge--signal' : 'badge--muted';
  return <span className={`badge ${variant}`}>{roleName ?? ROLE_LABELS[roleType]}</span>;
}
