const STYLES: Record<string, string> = {
  active:      'badge-success',
  paused:      'bg-amber-50 text-amber-700',
  deactivated: 'badge-danger',
};

export function UserStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? 'badge-muted'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
