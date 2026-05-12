export function BuildBadge() {
  const id = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
  return (
    <div
      data-build-id={id}
      style={{
        position: 'fixed',
        right: 8,
        bottom: 8,
        zIndex: 2147483647,
        padding: '2px 6px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        lineHeight: 1.2,
        color: 'rgba(255,255,255,0.9)',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 4,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      v{id}
    </div>
  );
}
