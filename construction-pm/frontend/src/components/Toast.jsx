const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };
export default function Toast({ msg, type = 'info' }) {
  return (
    <div className={`toast ${type}`}>
      <span>{ICONS[type]}</span>
      <span>{msg}</span>
    </div>
  );
}
