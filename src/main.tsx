import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Google Maps Platform Quota & Auth Error listener
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-auth-error'));
};
const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('ApiTargetBlockedMapError') || msg.includes('RefererNotAllowedMapError') || msg.includes('UnauthorizedMapError')) {
    window.dispatchEvent(new CustomEvent('gmp-auth-error'));
  }
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('google.maps.Marker is deprecated')) {
    return;
  }
  origWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);
