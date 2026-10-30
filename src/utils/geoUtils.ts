import { SecurityZoneData } from '../data/initialData';

export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function estimateTravelTime(distanceKm: number, mode: 'driving' | 'walking'): string {
  if (mode === 'walking') {
    const minutes = Math.max(1, Math.round((distanceKm / 4.5) * 60));
    return `${minutes} min walk`;
  } else {
    const minutes = Math.max(1, Math.round((distanceKm / 35) * 60));
    return `${minutes} min drive`;
  }
}

export interface SecurityRiskAlert {
  zone: SecurityZoneData;
  distanceMeters: number;
  isInside: boolean;
}

export function evaluateSecurityRisk(
  coords: { lat: number; lng: number },
  zones: SecurityZoneData[]
): SecurityRiskAlert | null {
  for (const zone of zones) {
    const distKm = getDistanceKm(coords.lat, coords.lng, zone.center.lat, zone.center.lng);
    const distMeters = distKm * 1000;
    // Check if user is within the zone or within 500 meters of the boundary
    if (distMeters <= zone.radiusMeters + 350) {
      return {
        zone,
        distanceMeters: Math.round(distMeters),
        isInside: distMeters <= zone.radiusMeters
      };
    }
  }
  return null;
}
