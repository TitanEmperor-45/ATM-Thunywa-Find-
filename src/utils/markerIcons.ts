// SVG Marker Generator for Google Maps JavaScript API
export function createAtmMarkerIcon(status: 'online' | 'offline', bank: string) {
  const isOnline = status === 'online';
  const bgColor = isOnline ? '#10b981' : '#64748b';
  const textLabel = bank.slice(0, 3).toUpperCase();
  const badgeIcon = isOnline ? '✓' : '•';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M23 52 C23 52 42 32 42 20 C42 9.5 33.5 1 23 1 C12.5 1 4 9.5 4 20 C4 32 23 52 23 52 Z" 
            fill="${bgColor}" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>
      <circle cx="23" cy="20" r="14" fill="#ffffff"/>
      <text x="23" y="24" font-size="10" font-weight="900" font-family="system-ui, sans-serif" fill="${bgColor}" text-anchor="middle">
        ${textLabel}
      </text>
      <circle cx="34" cy="10" r="7" fill="${isOnline ? '#059669' : '#334155'}" stroke="#ffffff" stroke-width="1.5"/>
      <text x="34" y="13" font-size="8" font-weight="bold" font-family="system-ui, sans-serif" fill="#ffffff" text-anchor="middle">
        ${badgeIcon}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

export function createUserLocationIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="15" fill="#3b82f6" fill-opacity="0.25"/>
      <circle cx="17" cy="17" r="9" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="17" cy="17" r="3.5" fill="#ffffff"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

export function createSecurityZoneIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#4f46e5" fill-opacity="0.9" stroke="#ffffff" stroke-width="2"/>
      <path d="M18 10 L18 20 M18 24 L18.01 24" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}
