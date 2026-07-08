export function Timer({ seconds }: { seconds: number }) {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  const urgent = clamped <= 60;

  return (
    <div className={`timer ${urgent ? 'timer--urgent' : ''}`}>
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
