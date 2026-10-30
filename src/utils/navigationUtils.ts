import { ATMData } from '../data/initialData';
import { getDistanceKm, estimateTravelTime } from './geoUtils';

export interface RouteStep {
  instruction: string;
  distance: string;
  iconType: 'straight' | 'right' | 'left' | 'destination';
}

export interface NavigationRoute {
  destinationAtm: ATMData;
  origin: { lat: number; lng: number };
  totalDistanceKm: number;
  totalDistanceFormatted: string;
  travelTime: string;
  mode: 'driving' | 'walking';
  pathCoordinates: { lat: number; lng: number }[];
  steps: RouteStep[];
  isSecurityRiskOnRoute: boolean;
  securityNote?: string;
}

export function generateNavigationRoute(
  origin: { lat: number; lng: number },
  destination: ATMData,
  mode: 'driving' | 'walking'
): NavigationRoute {
  const distKm = getDistanceKm(origin.lat, origin.lng, destination.location.lat, destination.location.lng);
  const travelTime = estimateTravelTime(distKm, mode);

  // Generate intermediate realistic path coordinates for the map polyline
  const stepsCount = 5;
  const path: { lat: number; lng: number }[] = [origin];

  // Create an authentic grid-like route typical of SA city street blocks
  const midLat = origin.lat + (destination.location.lat - origin.lat) * 0.45;
  const midLng = origin.lng;
  path.push({ lat: midLat, lng: midLng });

  const secondMidLat = midLat;
  const secondMidLng = origin.lng + (destination.location.lng - origin.lng) * 0.8;
  path.push({ lat: secondMidLat, lng: secondMidLng });

  path.push(destination.location);

  // Determine directional steps based on coordinates
  const steps: RouteStep[] = [];
  const dLat = destination.location.lat - origin.lat;
  const dLng = destination.location.lng - origin.lng;

  const latDirection = dLat > 0 ? 'North' : 'South';
  const lngDirection = dLng > 0 ? 'East' : 'West';

  steps.push({
    instruction: `Head ${latDirection} towards main road / connecting street`,
    distance: `${Math.round(distKm * 250)} m`,
    iconType: 'straight'
  });

  steps.push({
    instruction: `Turn ${dLng > 0 ? 'Right' : 'Left'} onto avenue heading ${lngDirection}`,
    distance: `${Math.round(distKm * 500)} m`,
    iconType: dLng > 0 ? 'right' : 'left'
  });

  if (destination.type.includes('Mall')) {
    steps.push({
      instruction: `Enter shopping centre secure parking or main pedestrian concourse`,
      distance: '100 m',
      iconType: 'straight'
    });
  } else if (destination.type.includes('Forecourt')) {
    steps.push({
      instruction: `Pull into well-lit service station forecourt`,
      distance: '50 m',
      iconType: 'straight'
    });
  }

  steps.push({
    instruction: `Arrive safely at ${destination.name} (${destination.address})`,
    distance: 'Destination',
    iconType: 'destination'
  });

  const isRisk = destination.securityRating === 'High Risk Area';

  return {
    destinationAtm: destination,
    origin,
    totalDistanceKm: distKm,
    totalDistanceFormatted: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
    travelTime,
    mode,
    pathCoordinates: path,
    steps,
    isSecurityRiskOnRoute: isRisk,
    securityNote: isRisk
      ? 'Caution: Target ATM is in an area with past reported card-skimming incidents. Maintain situational awareness or choose an indoor mall alternative.'
      : undefined
  };
}
