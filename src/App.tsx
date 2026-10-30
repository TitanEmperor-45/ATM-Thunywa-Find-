/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  APIProvider,
  Map,
  useMap,
  Marker,
  InfoWindow,
  Circle,
  Polyline
} from '@vis.gl/react-google-maps';
import {
  Search,
  MapPin,
  Navigation,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Car,
  Footprints,
  Compass,
  ChevronRight,
  Info,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  X,
  Building,
  KeyRound,
  Sparkles,
  Download,
  WifiOff,
  Accessibility,
  Calendar,
  Clock,
  Trash2,
  Plus,
  Database,
  Globe,
  Code
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ATMData, INITIAL_ATMS, INITIAL_SECURITY_ZONES, SecurityZoneData } from './data/initialData';
import { initializeFirestoreData, reportATMStatus } from './services/atmService';
import {
  signInWithCalendar,
  initCalendarAuth,
  calendarSignOut,
  fetchCalendarEvents,
  createAtmVisitEvent,
  deleteCalendarEvent,
  CalendarEventItem
} from './services/calendarService';
import {
  getDistanceKm,
  formatDistance,
  evaluateSecurityRisk,
  SecurityRiskAlert
} from './utils/geoUtils';
import {
  createAtmMarkerIcon,
  createUserLocationIcon,
  createSecurityZoneIcon
} from './utils/markerIcons';
import { generateNavigationRoute, NavigationRoute } from './utils/navigationUtils';

// Popular South African reference locations for quick testing and location centering
const SA_CITIES = [
  { name: 'Johannesburg CBD', coords: { lat: -26.2041, lng: 28.0473 }, zoom: 14 },
  { name: 'Sandton City', coords: { lat: -26.1075, lng: 28.0527 }, zoom: 14 },
  { name: 'Rosebank Mall', coords: { lat: -26.1462, lng: 28.0416 }, zoom: 14 },
  { name: 'Pretoria Central', coords: { lat: -25.7461, lng: 28.1881 }, zoom: 14 },
  { name: 'Cape Town CBD', coords: { lat: -33.9249, lng: 18.4241 }, zoom: 14 },
  { name: 'Durban Central', coords: { lat: -29.8587, lng: 31.0218 }, zoom: 14 }
];

export default function App() {
  // Configured Google Maps API Key with provisioned fallback
  const [apiKey, setApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyA2Bt0e5zEzD3xBbctnvCv4qYF2Z0sNhE4'
  );

  // Core state
  const [atms, setAtms] = useState<ATMData[]>(INITIAL_ATMS);
  const [securityZones, setSecurityZones] = useState<SecurityZoneData[]>(INITIAL_SECURITY_ZONES);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: -26.2041,
    lng: 28.0473 // Default: Central Johannesburg
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [bankFilter, setBankFilter] = useState<string>('All');
  const [accessibilityOnly, setAccessibilityOnly] = useState<boolean>(false);
  const [selectedATM, setSelectedATM] = useState<ATMData | null>(null);
  const [selectedZone, setSelectedZone] = useState<SecurityZoneData | null>(null);
  const [isReportingOpen, setIsReportingOpen] = useState(false);
  const [reportingStatus, setReportingStatus] = useState<'online' | 'offline'>('offline');
  const [reportNote, setReportNote] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null);

  // Navigation state
  const [activeRoute, setActiveRoute] = useState<NavigationRoute | null>(null);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>('driving');

  // Security alert
  const [securityAlert, setSecurityAlert] = useState<SecurityRiskAlert | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  // Offline caching state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastCachedTime, setLastCachedTime] = useState<string | null>(
    localStorage.getItem('atm_thunywa_cached_time')
  );
  const [offlineToast, setOfflineToast] = useState<string | null>(null);

  const handleDownloadForOffline = () => {
    try {
      localStorage.setItem('atm_thunywa_cached_atms', JSON.stringify(atms));
      localStorage.setItem('atm_thunywa_cached_zones', JSON.stringify(securityZones));
      const nowStr = new Date().toLocaleString();
      localStorage.setItem('atm_thunywa_cached_time', nowStr);
      setLastCachedTime(nowStr);
      setOfflineToast('Success! ATMs & Safety Zones cached for offline travel.');
      setTimeout(() => setOfflineToast(null), 3000);
    } catch (err) {
      console.error('Error caching data:', err);
      setOfflineToast('Failed to save data for offline use.');
      setTimeout(() => setOfflineToast(null), 3000);
    }
  };

  // Google Calendar integration state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarUser, setCalendarUser] = useState<any | null>(null);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [scheduleAtm, setScheduleAtm] = useState<ATMData | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [deleteEventTarget, setDeleteEventTarget] = useState<CalendarEventItem | null>(null);
  const [calendarSuccessMsg, setCalendarSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initCalendarAuth(
      (user, token) => {
        setCalendarUser(user);
        setCalendarToken(token);
        loadCalendarEvents();
      },
      () => {
        setCalendarUser(null);
        setCalendarToken(null);
        setCalendarEvents([]);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const loadCalendarEvents = async () => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      const events = await fetchCalendarEvents();
      setCalendarEvents(events);
    } catch (err: any) {
      console.warn('Error loading calendar events:', err);
      setCalendarError(err.message || 'Could not load calendar events');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleCalendarSignIn = async () => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      const res = await signInWithCalendar();
      if (res) {
        setCalendarUser(res.user);
        setCalendarToken(res.accessToken);
        await loadCalendarEvents();
      }
    } catch (err: any) {
      setCalendarError(err.message || 'Failed to sign in with Google Calendar');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleCalendarSignOut = async () => {
    await calendarSignOut();
    setCalendarUser(null);
    setCalendarToken(null);
    setCalendarEvents([]);
  };

  const handleCreateVisitEvent = async () => {
    const target = scheduleAtm || selectedATM;
    if (!target) return;
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      await createAtmVisitEvent({
        atmName: target.name,
        address: target.address,
        startTime: new Date(scheduleDateTime).toISOString(),
        durationMinutes: 30,
        safetyTips: `ATM Security: ${target.securityRating}. ${target.isGuarded ? 'Guarded with CCTV.' : 'Street location - exercise caution.'}`
      });
      setCalendarSuccessMsg(`Scheduled ATM visit for ${target.name} to Google Calendar!`);
      setTimeout(() => setCalendarSuccessMsg(null), 3500);
      await loadCalendarEvents();
    } catch (err: any) {
      setCalendarError(err.message || 'Failed to schedule event');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleConfirmDeleteEvent = async () => {
    if (!deleteEventTarget) return;
    setIsLoadingCalendar(true);
    try {
      await deleteCalendarEvent(deleteEventTarget.id);
      setCalendarEvents((prev) => prev.filter((e) => e.id !== deleteEventTarget.id));
      setDeleteEventTarget(null);
      setCalendarSuccessMsg('Calendar event removed.');
      setTimeout(() => setCalendarSuccessMsg(null), 3000);
    } catch (err: any) {
      setCalendarError(err.message || 'Failed to delete event');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // SerpApi Live Google Maps ATM Fetcher state & function
  const [isFetchingLiveAtms, setIsFetchingLiveAtms] = useState(false);
  const [liveSearchToast, setLiveSearchToast] = useState<string | null>(null);

  const handleFetchLiveGoogleMapsAtms = async (customQuery?: string) => {
    setIsFetchingLiveAtms(true);
    setLiveSearchToast('Searching live Google Maps ATMs via SerpApi...');
    try {
      const q = customQuery?.trim() || searchQuery.trim() || 'South Africa ATM';
      const res = await fetch(
        `/api/live-atms?lat=${userLocation.lat}&lng=${userLocation.lng}&zoom=14&q=${encodeURIComponent(
          q
        )}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to query SerpApi');
      }

      const results = data.local_results || [];
      if (results.length === 0) {
        setLiveSearchToast(`No new live ATMs found in this area for "${q}".`);
        setTimeout(() => setLiveSearchToast(null), 3000);
        return;
      }

      // Convert local_results to ATMData
      const newAtms: ATMData[] = results
        .filter((r: any) => r.gps_coordinates?.latitude && r.gps_coordinates?.longitude)
        .map((r: any, idx: number) => {
          const title = r.title || 'ATM';
          let detectedBank: ATMData['bank'] = 'FNB';
          const lower = title.toLowerCase();
          if (lower.includes('standard')) detectedBank = 'Standard Bank';
          else if (lower.includes('capitec')) detectedBank = 'Capitec';
          else if (lower.includes('nedbank')) detectedBank = 'Nedbank';
          else if (lower.includes('absa')) detectedBank = 'Absa';
          else if (lower.includes('fnb') || lower.includes('first national')) detectedBank = 'FNB';

          const isIndoor =
            lower.includes('mall') ||
            lower.includes('centre') ||
            lower.includes('center') ||
            lower.includes('branch') ||
            lower.includes('square');

          return {
            id: r.place_id || `serp-${r.gps_coordinates.latitude}-${r.gps_coordinates.longitude}-${idx}`,
            name: title,
            bank: detectedBank,
            location: {
              lat: r.gps_coordinates.latitude,
              lng: r.gps_coordinates.longitude
            },
            address: r.address || 'South Africa',
            city: r.address?.includes('Johannesburg')
              ? 'Johannesburg'
              : r.address?.includes('Cape Town')
              ? 'Cape Town'
              : r.address?.includes('Durban')
              ? 'Durban'
              : r.address?.includes('Pretoria')
              ? 'Pretoria'
              : 'South Africa',
            type: isIndoor ? 'Mall/Indoor (Secure)' : 'Branch/Bank Lobby',
            status: 'online',
            notes:
              r.open_state ||
              (r.rating
                ? `${r.rating}★ rating on Google Maps (${r.reviews || 0} reviews)`
                : 'Live Google Maps Verified Place'),
            lastUpdated: 'Live from Google Maps',
            isGuarded: isIndoor,
            hasCCTV: true,
            securityRating: isIndoor ? 'Safe' : 'Moderate',
            accessibility: true
          } as ATMData;
        });

      if (newAtms.length > 0) {
        setAtms((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const toAdd = newAtms.filter((a) => !existingIds.has(a.id));
          return [...toAdd, ...prev];
        });
        setLiveSearchToast(`Found ${newAtms.length} live Google Maps ATMs!`);
      } else {
        setLiveSearchToast('All found ATMs are already loaded on the map.');
      }
      setTimeout(() => setLiveSearchToast(null), 3500);
    } catch (err: any) {
      console.error('SerpApi fetch error:', err);
      setLiveSearchToast(`SerpApi: ${err.message}`);
      setTimeout(() => setLiveSearchToast(null), 4000);
    } finally {
      setIsFetchingLiveAtms(false);
    }
  };

  // Google Maps SerpApi Scraper Modal state & handlers
  const [showScraperModal, setShowScraperModal] = useState(false);
  const [scraperQuery, setScraperQuery] = useState('South Africa ATM');
  const [scrapedResults, setScrapedResults] = useState<any[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scraperError, setScraperError] = useState<string | null>(null);
  const [rawScraperData, setRawScraperData] = useState<any | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleExecuteScrape = async () => {
    setIsScraping(true);
    setScraperError(null);
    try {
      const res = await fetch(
        `/api/scrape-google-maps?q=${encodeURIComponent(scraperQuery)}&lat=${userLocation.lat}&lng=${
          userLocation.lng
        }&zoom=14`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scrape Google Maps');
      }
      setScrapedResults(data.places || []);
      setRawScraperData(data.raw_results || []);
    } catch (err: any) {
      setScraperError(err.message || 'Scrape failed');
    } finally {
      setIsScraping(false);
    }
  };

  const handleImportScrapedAtms = () => {
    if (scrapedResults.length === 0) return;
    const converted: ATMData[] = scrapedResults
      .filter((r) => r.gps_coordinates?.latitude && r.gps_coordinates?.longitude)
      .map((r, idx) => {
        const title = r.title || 'ATM';
        let detectedBank: ATMData['bank'] = 'FNB';
        const lower = title.toLowerCase();
        if (lower.includes('standard')) detectedBank = 'Standard Bank';
        else if (lower.includes('capitec')) detectedBank = 'Capitec';
        else if (lower.includes('nedbank')) detectedBank = 'Nedbank';
        else if (lower.includes('absa')) detectedBank = 'Absa';
        else if (lower.includes('fnb') || lower.includes('first national')) detectedBank = 'FNB';

        const isIndoor =
          lower.includes('mall') ||
          lower.includes('centre') ||
          lower.includes('center') ||
          lower.includes('branch');

        return {
          id: r.place_id || `scraped-${idx}-${Date.now()}`,
          name: title,
          bank: detectedBank,
          location: {
            lat: r.gps_coordinates.latitude,
            lng: r.gps_coordinates.longitude,
          },
          address: r.address || 'South Africa',
          city: r.address?.includes('Johannesburg')
            ? 'Johannesburg'
            : r.address?.includes('Cape Town')
            ? 'Cape Town'
            : r.address?.includes('Durban')
            ? 'Durban'
            : r.address?.includes('Pretoria')
            ? 'Pretoria'
            : 'South Africa',
          type: isIndoor ? 'Mall/Indoor (Secure)' : 'Branch/Bank Lobby',
          status: 'online',
          notes:
            r.open_state ||
            (r.rating
              ? `${r.rating}★ on Google Maps (${r.reviews || 0} reviews)`
              : 'Scraped live from Google Maps'),
          lastUpdated: 'Just now (Google Maps Scraped)',
          isGuarded: isIndoor,
          hasCCTV: true,
          securityRating: isIndoor ? 'Safe' : 'Moderate',
          accessibility: r.wheelchair_accessible ?? true,
        };
      });

    setAtms((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const toAdd = converted.filter((a) => !existingIds.has(a.id));
      return [...toAdd, ...prev];
    });

    setShowScraperModal(false);
    setLiveSearchToast(`Imported ${converted.length} Google Maps ATMs to live map!`);
    setTimeout(() => setLiveSearchToast(null), 3500);
  };

  // AI Safety Advisor chat state
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: 'Hello! I am your ATM Thunywa AI Security & Safety Advisor. Ask me anything about finding functional ATMs, avoiding scams, or travel safety in South Africa.' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleSendAiMessage = async () => {
    if (!aiInput.trim() || isAiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/atm-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          context: { userLocation, selectedATM: selectedATM?.name, securityAlert }
        })
      });
      const data = await res.json();
      if (data.text) {
        setAiMessages((prev) => [...prev, { role: 'assistant', text: data.text }]);
      } else {
        setAiMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I encountered an issue generating advice. Please try again.' }]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setAiMessages((prev) => [...prev, { role: 'assistant', text: 'Network error communicating with AI Advisor.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Initialize and subscribe to Firestore
  useEffect(() => {
    // Load from local cache if available on startup
    const cachedAtms = localStorage.getItem('atm_thunywa_cached_atms');
    const cachedZones = localStorage.getItem('atm_thunywa_cached_zones');
    if (cachedAtms) {
      try {
        setAtms(JSON.parse(cachedAtms));
      } catch (e) {
        console.warn('Failed to parse cached ATMs');
      }
    }
    if (cachedZones) {
      try {
        setSecurityZones(JSON.parse(cachedZones));
      } catch (e) {
        console.warn('Failed to parse cached zones');
      }
    }

    initializeFirestoreData();

    // Listen to ATMs
    const unsubscribeAtms = onSnapshot(
      collection(db, 'atms'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ATMData[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...(doc.data() as any) });
          });
          setAtms(list);
        }
      },
      (error) => {
        console.warn('Realtime Firestore ATMs notice (using client backup):', error);
      }
    );

    // Listen to Security Zones
    const unsubscribeZones = onSnapshot(
      collection(db, 'securityZones'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: SecurityZoneData[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...(doc.data() as any) });
          });
          setSecurityZones(list);
        }
      },
      (error) => {
        console.warn('Realtime Firestore zones notice:', error);
      }
    );

    // Quota defense & Auth error listeners
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    const handleAuthError = () => setAuthError(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('gmp-auth-error', handleAuthError);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribeAtms();
      unsubscribeZones();
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('gmp-auth-error', handleAuthError);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Proactively check security risks whenever userLocation changes
  useEffect(() => {
    const risk = evaluateSecurityRisk(userLocation, securityZones);
    setSecurityAlert(risk);
  }, [userLocation, securityZones]);

  // Auto-fetch real-time Google Maps ATMs on startup
  useEffect(() => {
    handleFetchLiveGoogleMapsAtms('South Africa ATM');
  }, []);

  // Handle Geolocation with browser fallback
  const handleGetMyLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newPos);
          // If within South Africa, perfect; if outside, user can still use city switcher
        },
        (err) => {
          console.warn('Geolocation access declined or unavailable, maintaining chosen city:', err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Filtered ATMs based on search query, status, and bank
  const filteredAtms = useMemo(() => {
    return atms
      .filter((atm) => {
        if (statusFilter === 'online' && atm.status !== 'online') return false;
        if (statusFilter === 'offline' && atm.status !== 'offline') return false;
        if (bankFilter !== 'All' && atm.bank !== bankFilter) return false;
        if (accessibilityOnly && !atm.accessibility) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = atm.name.toLowerCase().includes(q);
          const matchBank = atm.bank.toLowerCase().includes(q);
          const matchAddress = atm.address.toLowerCase().includes(q);
          const matchCity = atm.city.toLowerCase().includes(q);
          if (!matchName && !matchBank && !matchAddress && !matchCity) return false;
        }
        return true;
      })
      .map((atm) => {
        const distKm = getDistanceKm(
          userLocation.lat,
          userLocation.lng,
          atm.location.lat,
          atm.location.lng
        );
        return { ...atm, distanceKm: distKm };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [atms, statusFilter, bankFilter, accessibilityOnly, searchQuery, userLocation]);

  // Closest Online ATM finder
  const handleFindClosestOnlineATM = useCallback(() => {
    const onlineAtms = atms
      .filter((a) => a.status === 'online')
      .map((atm) => ({
        ...atm,
        distKm: getDistanceKm(userLocation.lat, userLocation.lng, atm.location.lat, atm.location.lng)
      }))
      .sort((a, b) => a.distKm - b.distKm);

    if (onlineAtms.length > 0) {
      const closest = onlineAtms[0];
      setSelectedATM(closest);
      const route = generateNavigationRoute(userLocation, closest, travelMode);
      setActiveRoute(route);
    }
  }, [atms, userLocation, travelMode]);

  // Safer Alternative finder when in a high risk zone
  const handleSuggestSaferATM = useCallback(() => {
    const safeOnlineAtms = atms
      .filter((a) => a.status === 'online' && a.securityRating === 'Safe')
      .map((atm) => ({
        ...atm,
        distKm: getDistanceKm(userLocation.lat, userLocation.lng, atm.location.lat, atm.location.lng)
      }))
      .sort((a, b) => a.distKm - b.distKm);

    if (safeOnlineAtms.length > 0) {
      const safer = safeOnlineAtms[0];
      setSelectedATM(safer);
      const route = generateNavigationRoute(userLocation, safer, travelMode);
      setActiveRoute(route);
      setShowSecurityModal(false);
    }
  }, [atms, userLocation, travelMode]);

  // Start Navigation for a specific ATM
  const handleStartNavigation = useCallback(
    (atm: ATMData, mode: 'driving' | 'walking' = travelMode) => {
      setTravelMode(mode);
      const route = generateNavigationRoute(userLocation, atm, mode);
      setActiveRoute(route);
    },
    [userLocation, travelMode]
  );

  // Submit User Report (Online or Offline)
  const handleSubmitReport = async () => {
    if (!selectedATM) return;
    setIsSubmittingReport(true);
    const res = await reportATMStatus(selectedATM.id, reportingStatus, 'user-community', reportNote);
    setIsSubmittingReport(false);

    if (res.success) {
      // Optimistically update local state immediately
      setAtms((prev) =>
        prev.map((a) =>
          a.id === selectedATM.id
            ? {
                ...a,
                status: reportingStatus,
                notes: reportNote || (reportingStatus === 'online' ? 'Dispensing cash' : 'Reported offline by user'),
                lastUpdated: 'Just now',
                availableNotes: reportingStatus === 'online' ? ['R100', 'R200'] : []
              }
            : a
        )
      );
      setSelectedATM((prev) =>
        prev
          ? {
              ...prev,
              status: reportingStatus,
              notes: reportNote || (reportingStatus === 'online' ? 'Dispensing cash' : 'Reported offline by user'),
              lastUpdated: 'Just now',
              availableNotes: reportingStatus === 'online' ? ['R100', 'R200'] : []
            }
          : null
      );
      setReportSuccessMessage(`Thank you! ATM marked as ${reportingStatus.toUpperCase()}.`);
      setTimeout(() => {
        setReportSuccessMessage(null);
        setIsReportingOpen(false);
        setReportNote('');
      }, 1600);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Google Maps Auth / ApiTargetBlockedMapError Notification */}
      {authError && (
        <div className="bg-red-600 text-white px-4 py-3 text-xs font-semibold text-center sticky top-0 z-50 shadow space-y-1">
          <p className="font-bold text-sm">Google Maps API Key Error (ApiTargetBlockedMapError)</p>
          <p>Your API key HTTP referrer restrictions in Google Cloud Console are blocking this domain (<code className="bg-red-900 px-1 rounded font-mono">*.run.app</code>) or Maps JavaScript API is disabled. Please update your API key restrictions in Google Cloud Console or click the key icon (⚙️) in the top right to enter an unrestricted API key.</p>
        </div>
      )}

      {/* Quota Exceeded Notification */}
      {quotaExceeded && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold text-center sticky top-0 z-50 shadow">
          Google Maps Platform quota reached. If you are the app owner, visit{' '}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold text-slate-950 hover:text-slate-800"
          >
            maps developer site
          </a>{' '}
          for instructions to update your account.
        </div>
      )}

      {/* Offline Status Notification */}
      {!isOnline && (
        <div className="bg-red-950/90 border-b border-red-500 text-red-200 px-4 py-2 text-xs font-semibold text-center sticky top-0 z-50 flex items-center justify-center gap-2 shadow">
          <WifiOff size={16} className="text-red-400 animate-pulse" />
          <span>You are offline. Using locally cached ATMs & security zones.</span>
          {lastCachedTime && <span className="opacity-75 text-[11px]">(Cached: {lastCachedTime})</span>}
        </div>
      )}

      {/* Main App Navigation Bar */}
      <header className="bg-slate-800/90 border-b border-slate-700/80 backdrop-blur sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-extrabold text-xl tracking-tighter">
              🇿🇦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  ATM Thunywa
                </h1>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium px-2 py-0.5 rounded-full">
                  Live SA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Functional ATM Locator & High-Risk Safety Navigator
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFindClosestOnlineATM}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition active:scale-95"
            >
              <Navigation size={15} />
              <span>Direct to Closest Online ATM</span>
            </button>

            <button
              onClick={() => setShowAiChat(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition active:scale-95"
            >
              <Sparkles size={15} />
              <span>Ask AI Safety Advisor</span>
            </button>

            <button
              onClick={() => setShowSecurityModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 transition"
            >
              <ShieldAlert size={15} className="text-amber-400" />
              <span>Safety Zones ({securityZones.length})</span>
            </button>

            <button
              onClick={() => {
                setScheduleAtm(selectedATM || atms[0]);
                setShowCalendarModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition active:scale-95"
              title="Google Calendar Integration"
            >
              <Calendar size={15} />
              <span>Google Calendar</span>
            </button>

            <button
              onClick={() => {
                setShowScraperModal(true);
                if (scrapedResults.length === 0) {
                  handleExecuteScrape();
                }
              }}
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition active:scale-95"
              title="Scrape live Google Maps places using SerpApi"
            >
              <Database size={15} />
              <span>Scrape Google Maps</span>
            </button>

            <button
              onClick={handleDownloadForOffline}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-3 py-1.5 rounded-lg text-xs md:text-sm flex items-center gap-1.5 transition"
              title="Download ATMs & Security Zones for Offline Travel"
            >
              <Download size={15} className="text-emerald-400" />
              <span>{lastCachedTime ? 'Offline Ready' : 'Download Offline'}</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 transition"
              title="API Key Settings"
            >
              <KeyRound size={16} />
            </button>
          </div>
        </div>

        {/* API Key Drawer (if user wants to customize) */}
        {showSettings && (
          <div className="max-w-7xl mx-auto mt-3 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1">
                <KeyRound size={14} className="text-blue-400" /> Google Maps API Key Configuration
              </span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Paste your VITE_GOOGLE_MAPS_API_KEY"
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
              />
              <button
                onClick={() => {
                  setApiKey(tempApiKey);
                  setShowSettings(false);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-medium"
              >
                Apply Key
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Proactive High-Risk Security Alert Banner */}
      {securityAlert && (
        <div
          className={`border-b px-4 py-2.5 text-xs md:text-sm transition-all shadow-md ${
            securityAlert.isInside
              ? 'bg-red-950/90 border-red-500 text-red-200'
              : 'bg-amber-950/90 border-amber-500 text-amber-200'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-full bg-red-600/30 text-red-400 animate-pulse">
                <AlertTriangle size={18} />
              </span>
              <div>
                <span className="font-bold tracking-wide uppercase text-[11px] px-1.5 py-0.5 rounded mr-2 bg-red-900/60 border border-red-600/40 text-red-300">
                  {securityAlert.isInside ? 'CRITICAL SECURITY ALERT' : 'SAFETY WARNING'}
                </span>
                <span className="font-semibold">{securityAlert.zone.name}</span>
                <span className="text-slate-300 ml-1.5">
                  ({securityAlert.isInside ? 'You are inside zone' : `${securityAlert.distanceMeters}m away`})
                  : {securityAlert.zone.advisory}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestSaferATM}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded text-xs shadow transition flex items-center gap-1 active:scale-95"
              >
                <ShieldCheck size={14} />
                <span>Suggest Safer Indoor ATM</span>
              </button>
              <button
                onClick={() => setShowSecurityModal(true)}
                className="underline text-xs text-slate-300 hover:text-white"
              >
                Read Scams & Advice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Map with Floating Controls */}
        <div className="flex-1 h-[55vh] lg:h-auto relative bg-slate-950">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={userLocation}
              defaultZoom={13}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              {/* Map Sync Controller */}
              <MapSyncController userLocation={userLocation} activeRoute={activeRoute} />

              {/* User Location Marker */}
              <Marker
                position={userLocation}
                title="Your Current Location"
                icon={{ url: createUserLocationIcon() }}
              />



              {/* ATM Markers */}
              {filteredAtms.map((atm) => (
                <Marker
                  key={atm.id}
                  position={atm.location}
                  title={`${atm.name} (${atm.status.toUpperCase()})`}
                  icon={{ url: createAtmMarkerIcon(atm.status, atm.bank) }}
                  onClick={() => {
                    setSelectedATM(atm);
                    setSelectedZone(null);
                  }}
                />
              ))}

              {/* Active Navigation Polyline */}
              {activeRoute && (
                <Polyline
                  path={activeRoute.pathCoordinates}
                  strokeColor={activeRoute.mode === 'driving' ? '#3b82f6' : '#10b981'}
                  strokeWeight={5}
                  strokeOpacity={0.85}
                />
              )}

              {/* InfoWindow for Selected ATM */}
              {selectedATM && !activeRoute && (
                <InfoWindow
                  position={selectedATM.location}
                  onCloseClick={() => setSelectedATM(null)}
                >
                  <div className="p-1 max-w-xs text-slate-900">
                    <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-1.5">
                      <span className="font-bold text-sm leading-tight text-slate-950">
                        {selectedATM.name}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded text-white ${
                          selectedATM.status === 'online' ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                      >
                        {selectedATM.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mb-1">{selectedATM.address}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-700 mb-2">
                      <span className="font-semibold text-slate-900">{selectedATM.bank}</span>
                      <span>•</span>
                      <span>{selectedATM.type}</span>
                    </div>

                    {selectedATM.notes && (
                      <div className="p-1.5 rounded bg-slate-100 text-[11px] text-slate-700 mb-2 border border-slate-200">
                        {selectedATM.notes}
                      </div>
                    )}
                    {selectedATM.availableNotes && selectedATM.availableNotes.length > 0 && (
                      <div className="text-[11px] text-slate-700 mb-2">
                        <span className="font-semibold text-slate-900">Available Notes: </span>
                        {selectedATM.availableNotes.join(', ')}
                      </div>
                    )}

                    {selectedATM.accessibility && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md mb-2">
                        <Accessibility size={14} className="text-blue-600 shrink-0" />
                        <span>Wheelchair Accessible</span>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 mb-2 flex items-center justify-between">
                      <span>Updated: {selectedATM.lastUpdated}</span>
                      <span
                        className={`font-semibold ${
                          selectedATM.securityRating === 'Safe' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {selectedATM.securityRating}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200">
                      <button
                        onClick={() => handleStartNavigation(selectedATM, 'driving')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-1 rounded text-[11px] flex items-center justify-center gap-1"
                      >
                        <Car size={12} /> Drive
                      </button>
                      <button
                        onClick={() => {
                          setScheduleAtm(selectedATM);
                          setShowCalendarModal(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-1 rounded text-[11px] flex items-center justify-center gap-1"
                        title="Schedule Visit in Google Calendar"
                      >
                        <Calendar size={12} /> Calendar
                      </button>
                      <button
                        onClick={() => {
                          setReportingStatus(selectedATM.status === 'online' ? 'offline' : 'online');
                          setIsReportingOpen(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-medium py-1 px-1 rounded text-[11px] flex items-center justify-center gap-1"
                      >
                        <RefreshCw size={12} /> Report
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}

              {/* InfoWindow for Security Zone */}
              {selectedZone && (
                <InfoWindow
                  position={selectedZone.center}
                  onCloseClick={() => setSelectedZone(null)}
                >
                  <div className="p-1 max-w-xs text-slate-900">
                    <div className="flex items-center gap-1 text-red-700 font-bold text-sm mb-1">
                      <AlertTriangle size={16} />
                      <span>{selectedZone.name}</span>
                    </div>
                    <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {selectedZone.severity} RISK AREA
                    </span>
                    <p className="text-xs text-slate-700 my-1.5">{selectedZone.advisory}</p>
                    <p className="text-[11px] text-slate-800 font-semibold mb-2">
                      💡 Safer Choice: {selectedZone.saferAlternativeRecommendation}
                    </p>
                    <button
                      onClick={handleSuggestSaferATM}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-2 rounded text-xs font-semibold"
                    >
                      Find Nearby Guarded ATM
                    </button>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Floating Map Search & My Location Bar */}
          <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 max-w-lg pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto shadow-xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFetchLiveGoogleMapsAtms();
                    }
                  }}
                  placeholder="Search ATM by bank, suburb, or press Enter for live Google Maps..."
                  className="w-full bg-slate-900/95 border border-slate-700 text-white pl-9 pr-8 py-2 rounded-xl text-xs md:text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Live Google Maps Search Button (SerpApi) */}
              <button
                onClick={() => handleFetchLiveGoogleMapsAtms()}
                disabled={isFetchingLiveAtms}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition whitespace-nowrap"
                title="Search Real-Time Live ATMs on Google Maps via SerpApi"
              >
                <Compass size={16} className={isFetchingLiveAtms ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isFetchingLiveAtms ? 'Searching...' : 'Live Google ATMs'}</span>
              </button>

              {/* My Location GPS Button */}
              <button
                onClick={handleGetMyLocation}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 active:scale-95 transition"
                title="Locate Me (GPS)"
              >
                <MapPin size={16} />
                <span className="hidden sm:inline">My Location</span>
              </button>
            </div>

            {/* Quick South African City Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pointer-events-auto no-scrollbar">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider px-1 shrink-0">
                Quick Cities:
              </span>
              {SA_CITIES.map((city) => (
                <button
                  key={city.name}
                  onClick={() => {
                    setUserLocation(city.coords);
                    setActiveRoute(null);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition border ${
                    userLocation.lat === city.coords.lat
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          {/* Map Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl shadow-lg backdrop-blur text-[11px] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-300">Verified Online ATM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-500 inline-block"></span>
              <span className="text-slate-300">Offline / Standby</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
              <span className="text-slate-300">Your Location</span>
            </div>
          </div>
        </div>

        {/* Right Side: ATM Listing, Filter Bar, Navigation, and Safety Tips */}
        <div className="w-full lg:w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col h-[45vh] lg:h-auto overflow-hidden">
          {/* Active Step-by-Step Navigation View */}
          {activeRoute ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
              <div className="p-4 bg-slate-800/90 border-b border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                      {activeRoute.mode === 'driving' ? <Car size={18} /> : <Footprints size={18} />}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-white">{activeRoute.destinationAtm.name}</h3>
                      <p className="text-xs text-slate-400">{activeRoute.destinationAtm.address}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveRoute(null)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Distance & Travel Time stats */}
                <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Estimated Time</span>
                    <p className="text-base font-bold text-emerald-400">{activeRoute.travelTime}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Distance</span>
                    <p className="text-base font-bold text-slate-200">
                      {activeRoute.totalDistanceFormatted}
                    </p>
                  </div>
                </div>

                {/* Mode Switcher & External Link */}
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-700">
                    <button
                      onClick={() => handleStartNavigation(activeRoute.destinationAtm, 'driving')}
                      className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1 transition ${
                        activeRoute.mode === 'driving' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Car size={14} /> Drive
                    </button>
                    <button
                      onClick={() => handleStartNavigation(activeRoute.destinationAtm, 'walking')}
                      className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1 transition ${
                        activeRoute.mode === 'walking' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Footprints size={14} /> Walk
                    </button>
                  </div>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeRoute.destinationAtm.location.lat},${activeRoute.destinationAtm.location.lng}&travelmode=${activeRoute.mode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 underline font-medium"
                  >
                    <span>Open in Maps</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                {/* Security Warning on Route if high risk */}
                {activeRoute.isSecurityRiskOnRoute && (
                  <div className="mt-3 p-2 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-200 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                    <span>{activeRoute.securityNote}</span>
                  </div>
                )}
              </div>

              {/* Step-by-Step Directions List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Turn-by-Turn Directions
                </div>
                {activeRoute.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 text-xs">
                      <p className="text-slate-200 font-medium leading-relaxed">{step.instruction}</p>
                      <span className="text-[11px] text-slate-400">{step.distance}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Exit Navigation button */}
              <div className="p-3 border-t border-slate-800 bg-slate-900">
                <button
                  onClick={() => setActiveRoute(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Exit Navigation
                </button>
              </div>
            </div>
          ) : (
            // Standard ATM List & Filters
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filter Tabs Header */}
              <div className="p-3 border-b border-slate-800 space-y-2.5">
                {/* Status Filter */}
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ATMs ({atms.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('online')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1 ${
                      statusFilter === 'online'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>Online ({atms.filter((a) => a.status === 'online').length})</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('offline')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1 ${
                      statusFilter === 'offline'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-400 hover:text-red-400'
                    }`}
                  >
                    <XCircle size={13} />
                    <span>Offline ({atms.filter((a) => a.status === 'offline').length})</span>
                  </button>
                </div>

                {/* Bank Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {['All', 'FNB', 'Standard Bank', 'Capitec', 'Nedbank', 'Absa'].map((bank) => (
                    <button
                      key={bank}
                      onClick={() => setBankFilter(bank)}
                      className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
                        bankFilter === bank
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                  <button
                    onClick={() => setAccessibilityOnly(!accessibilityOnly)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center gap-1 ${
                      accessibilityOnly
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title="Toggle Wheelchair Accessible Only"
                  >
                    <Accessibility size={13} />
                    <span>Accessible Only</span>
                  </button>
                </div>
              </div>

              {/* Scrollable ATM Card List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                  <span>Nearby ATMs (Sorted by Proximity)</span>
                  <span>{filteredAtms.length} found</span>
                </div>

                {filteredAtms.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No ATMs found matching your filters.
                  </div>
                ) : (
                  filteredAtms.map((atm) => {
                    const isOnline = atm.status === 'online';
                    return (
                      <div
                        key={atm.id}
                        className={`p-3 rounded-xl border transition cursor-pointer ${
                          selectedATM?.id === atm.id
                            ? 'bg-slate-800 border-blue-500 ring-1 ring-blue-500'
                            : 'bg-slate-800/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          setSelectedATM(atm);
                          setSelectedZone(null);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <span className="font-bold text-sm text-white hover:text-blue-400">
                              {atm.name}
                            </span>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="font-semibold text-slate-300">{atm.bank}</span>
                              <span>•</span>
                              <span>{atm.address}</span>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                              isOnline
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {atm.status}
                          </span>
                        </div>

                        {/* Notes / Last Reported */}
                        <div className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                          <p className="line-clamp-1">{atm.notes || 'Status reported by community.'}</p>
                          <div className="flex items-center justify-between mt-1 text-[10px]">
                            <span className="text-slate-500">Last reported: {atm.lastUpdated}</span>
                            <span className="text-emerald-400 font-bold">
                              {formatDistance((atm as any).distanceKm || 0)} away
                            </span>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-800">
                          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                            {atm.isGuarded && (
                              <span className="text-emerald-400 flex items-center gap-0.5" title="Security Guards Present">
                                <ShieldCheck size={12} /> Guarded
                              </span>
                            )}
                            {atm.accessibility && (
                              <span className="text-blue-400 flex items-center gap-0.5" title="Wheelchair Accessible">
                                <Accessibility size={12} /> Accessible
                              </span>
                            )}
                            {atm.securityRating === 'High Risk Area' && (
                              <span className="text-red-400 flex items-center gap-0.5" title="Known Safety Concerns">
                                <AlertTriangle size={12} /> High Risk Area
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedATM(atm);
                                setReportingStatus(isOnline ? 'offline' : 'online');
                                setIsReportingOpen(true);
                              }}
                              className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded-md transition"
                            >
                              Report
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleAtm(atm);
                                setShowCalendarModal(true);
                              }}
                              className="text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md transition flex items-center gap-1 shadow-sm"
                              title="Schedule ATM visit in Google Calendar"
                            >
                              <Calendar size={11} />
                              <span className="hidden sm:inline">Schedule</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartNavigation(atm, 'driving');
                              }}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 shadow transition active:scale-95 ${
                                isOnline
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                  : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              <Navigation size={12} />
                              <span>Directions</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Community Status Report Modal */}
      {isReportingOpen && selectedATM && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-white">Report ATM Status</h3>
                <p className="text-xs text-slate-400">{selectedATM.name}</p>
              </div>
              <button
                onClick={() => setIsReportingOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {reportSuccessMessage ? (
              <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-center text-emerald-200 text-sm font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span>{reportSuccessMessage}</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase block mb-1.5">
                    What is the current status?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReportingStatus('online')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-semibold text-xs transition ${
                        reportingStatus === 'online'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <CheckCircle2 size={20} className="text-emerald-400" />
                      <span>Online (Working)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportingStatus('offline')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 font-semibold text-xs transition ${
                        reportingStatus === 'offline'
                          ? 'bg-red-600/30 border-red-500 text-red-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <XCircle size={20} className="text-red-400" />
                      <span>Offline (Not Working)</span>
                    </button>
                  </div>
                </div>

                {/* Common Issue Buttons for quick reporting */}
                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase block mb-1.5">
                    Quick reason / details:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Out of Cash',
                      'Screen Blank / Power Out',
                      'Card Reader Jammed',
                      'Suspicious Skimmer Device',
                      'Dispensing Cash Normally',
                      'Long Queue'
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReportNote(reason)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                          reportNote === reason
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <textarea
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Add any extra notes (e.g. only dispensing R50 notes, security guard on site)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsReportingOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReport}
                    disabled={isSubmittingReport}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition active:scale-95 disabled:opacity-50"
                  >
                    {isSubmittingReport ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    <span>Submit Community Report</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* South Africa Security Zones & Safety Advice Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-red-500/20 text-red-400">
                  <ShieldAlert size={22} />
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">High-Risk ATM Security Database</h3>
                  <p className="text-xs text-slate-400">South African Police Service & Community Advisories</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
              <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl text-amber-200">
                <span className="font-bold block mb-1">🛡️ Essential ATM Safety Rules in South Africa:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li><strong>Never accept help from anyone</strong> at an ATM, even if they wear uniform or claim to be bank staff.</li>
                  <li><strong>Cover the keypad with your free hand</strong> whenever typing your 4-digit PIN.</li>
                  <li><strong>Avoid standalone street ATMs after dark</strong>. Prefer machines inside shopping malls, bank lobbies, or 24/7 guarded petrol station forecourts.</li>
                  <li>If your card is swallowed, immediately phone your bank from your mobile to freeze it.</li>
                </ul>
              </div>

              <div className="space-y-2.5">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Known High-Incident Hotspots:
                </span>
                {securityZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{zone.name}</span>
                      <span className="text-[10px] uppercase font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full">
                        {zone.severity} RISK
                      </span>
                    </div>
                    <p className="text-slate-300">{zone.advisory}</p>
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="font-semibold text-emerald-400 block mb-0.5">
                        💡 Recommended Alternative:
                      </span>
                      <span className="text-slate-300">{zone.saferAlternativeRecommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 mt-3 flex justify-end">
              <button
                onClick={() => setShowSecurityModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close Safety Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Safety Advisor Chat Modal */}
      {showAiChat && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full h-[600px] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-600/30 text-purple-400">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">ATM Thunywa AI Security Advisor</h3>
                  <p className="text-xs text-slate-400">Powered by Gemini AI • South African Banking & Safety</p>
                </div>
              </div>
              <button onClick={() => setShowAiChat(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 border border-slate-700 text-slate-400 p-3 rounded-2xl text-xs animate-pulse">
                    AI Advisor is thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                placeholder="Ask about ATM safety, scams, or travel advice..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleSendAiMessage}
                disabled={isAiLoading || !aiInput.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Calendar Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                  <Calendar size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">Google Calendar Integration</h3>
                  <p className="text-xs text-slate-400">Schedule safe daylight ATM visits & sync reminders</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setCalendarError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {calendarError && (
                <div className="p-3 bg-red-950/70 border border-red-700/80 rounded-xl text-red-200">
                  {calendarError}
                </div>
              )}

              {calendarSuccessMsg && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-emerald-200 flex items-center gap-2 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>{calendarSuccessMsg}</span>
                </div>
              )}

              {!calendarUser ? (
                /* Unauthenticated View: Sign in with Google */
                <div className="text-center py-6 px-4 space-y-4 bg-slate-800/40 rounded-xl border border-slate-800">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white mb-1">Connect Your Google Calendar</h4>
                    <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                      Plan and schedule secure ATM visits during broad daylight, receive automated notifications, and synchronize withdrawal appointments directly with your Google Calendar, with permission from your account.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={handleCalendarSignIn}
                      disabled={isLoadingCalendar}
                      className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-md transition disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>{isLoadingCalendar ? 'Connecting...' : 'Sign in with Google'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Authenticated View */
                <div className="space-y-5">
                  {/* User Profile Bar */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                    <div className="flex items-center gap-2.5">
                      {calendarUser.photoURL ? (
                        <img src={calendarUser.photoURL} alt="User" className="w-8 h-8 rounded-full border border-blue-400" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                          {calendarUser.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-slate-100 block">{calendarUser.displayName || 'Google Account'}</span>
                        <span className="text-[11px] text-slate-400">{calendarUser.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleCalendarSignOut}
                      className="text-xs text-slate-400 hover:text-red-400 font-medium px-2 py-1 rounded transition"
                    >
                      Sign Out
                    </button>
                  </div>

                  {/* Schedule New ATM Visit Form */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                    <span className="font-bold text-slate-200 block text-xs uppercase tracking-wider">
                      📅 Schedule Safe ATM Visit
                    </span>

                    <div className="space-y-2">
                      <label className="text-slate-300 font-medium block text-[11px]">Select ATM:</label>
                      <select
                        value={scheduleAtm?.id || selectedATM?.id || atms[0]?.id}
                        onChange={(e) => {
                          const found = atms.find((a) => a.id === e.target.value);
                          if (found) setScheduleAtm(found);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {atms.map((atm) => (
                          <option key={atm.id} value={atm.id}>
                            {atm.name} ({atm.bank} • {atm.securityRating})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-slate-300 font-medium block text-[11px]">Date & Time (Recommend daylight hours):</label>
                      <input
                        type="datetime-local"
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock size={12} className="text-blue-400" /> Auto-reminders set 30m & 10m before
                      </span>
                      <button
                        onClick={handleCreateVisitEvent}
                        disabled={isLoadingCalendar}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow transition"
                      >
                        <Plus size={14} />
                        <span>Add to Calendar</span>
                      </button>
                    </div>
                  </div>

                  {/* Existing Calendar Events List */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                        Upcoming Calendar Events ({calendarEvents.length})
                      </span>
                      <button
                        onClick={loadCalendarEvents}
                        disabled={isLoadingCalendar}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <RefreshCw size={11} className={isLoadingCalendar ? 'animate-spin' : ''} /> Refresh
                      </button>
                    </div>

                    {isLoadingCalendar && calendarEvents.length === 0 ? (
                      <div className="text-center py-4 text-slate-500 text-xs">Loading calendar events...</div>
                    ) : calendarEvents.length === 0 ? (
                      <div className="p-3 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800">
                        No upcoming events scheduled on your Google Calendar.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {calendarEvents.map((evt) => {
                          const startTime = evt.start?.dateTime ? new Date(evt.start.dateTime).toLocaleString() : evt.start?.date || 'All day';
                          return (
                            <div
                              key={evt.id}
                              className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex items-start justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <span className="font-bold text-slate-100 block">{evt.summary}</span>
                                <span className="text-[11px] text-blue-400 flex items-center gap-1">
                                  <Clock size={11} /> {startTime}
                                </span>
                                {evt.location && (
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <MapPin size={11} /> {evt.location}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {evt.htmlLink && (
                                  <a
                                    href={evt.htmlLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                                    title="Open in Google Calendar"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                                <button
                                  onClick={() => setDeleteEventTarget(evt)}
                                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-900/60 text-slate-300 hover:text-red-300 transition"
                                  title="Delete event"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setCalendarError(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Calendar Event Confirmation Dialog (Mandatory User Confirmation) */}
      {deleteEventTarget && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-red-600/20 text-red-400">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h4 className="font-bold text-sm text-white">Delete Calendar Event?</h4>
                <p className="text-xs text-slate-400">This action will modify your Google Calendar.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently remove <strong className="text-white">"{deleteEventTarget.summary}"</strong> from your Google Calendar?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteEventTarget(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteEvent}
                disabled={isLoadingCalendar}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition"
              >
                {isLoadingCalendar ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {offlineToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{offlineToast}</span>
        </div>
      )}

      {/* Google Maps Scraper Modal (SerpApi) */}
      {showScraperModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-5">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-teal-600/20 text-teal-400">
                  <Database size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">Google Maps Data Scraper</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    https://serpapi.com/search?engine=google_maps
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScraperModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scraper Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {scraperError && (
                <div className="p-3 bg-red-950/70 border border-red-700/80 rounded-xl text-red-200">
                  {scraperError}
                </div>
              )}

              {/* Scrape Query Form */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                    <Search size={14} className="text-teal-400" />
                    <span>Search Query (Engine: google_maps)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scraperQuery}
                      onChange={(e) => setScraperQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleExecuteScrape()}
                      placeholder="e.g. FNB ATM Johannesburg, Capitec Cape Town, etc."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      onClick={handleExecuteScrape}
                      disabled={isScraping}
                      className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition whitespace-nowrap"
                    >
                      <Compass size={14} className={isScraping ? 'animate-spin' : ''} />
                      <span>{isScraping ? 'Scraping...' : 'Scrape Live'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Query Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                  <span className="text-slate-400 font-medium shrink-0">Quick Queries:</span>
                  {[
                    'FNB ATM Johannesburg',
                    'Standard Bank Sandton',
                    'Capitec Durban',
                    'Nedbank Cape Town',
                    'Absa Pretoria Central',
                    'SASWITCH ATM South Africa'
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setScraperQuery(q);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-lg whitespace-nowrap transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                  <span>Coordinates: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)} (Zoom 14z)</span>
                  <span className="text-teal-400 font-mono">Engine: google_maps</span>
                </div>
              </div>

              {/* Scraped Results Controls */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                    Scraped Places ({scrapedResults.length})
                  </span>
                  {scrapedResults.length > 0 && (
                    <button
                      onClick={() => setShowRawJson(!showRawJson)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 transition ${
                        showRawJson
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Code size={12} />
                      <span>{showRawJson ? 'View Place Cards' : 'View Raw JSON'}</span>
                    </button>
                  )}
                </div>

                {scrapedResults.length > 0 && (
                  <button
                    onClick={handleImportScrapedAtms}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition"
                  >
                    <Plus size={14} />
                    <span>Import All to Live Map</span>
                  </button>
                )}
              </div>

              {/* Scraped List / Raw JSON View */}
              {isScraping ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Compass size={28} className="mx-auto text-teal-400 animate-spin" />
                  <p className="font-medium text-xs">Querying Google Maps engine via SerpApi...</p>
                  <p className="text-[11px] text-slate-500">Extracting live GPS, open hours, accessibility & photos</p>
                </div>
              ) : scrapedResults.length === 0 ? (
                <div className="py-10 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800 space-y-2">
                  <Database size={24} className="mx-auto opacity-50 text-teal-400" />
                  <p>Click "Scrape Live" above to scrape real-time Google Maps ATMs and banking locations.</p>
                </div>
              ) : showRawJson ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Raw JSON payload from SerpApi:</span>
                    <span>{rawScraperData?.length || 0} items</span>
                  </div>
                  <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[10px] text-emerald-400 font-mono max-h-80 overflow-auto">
                    {JSON.stringify(rawScraperData || scrapedResults, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {scrapedResults.map((place, idx) => (
                    <div
                      key={place.id || idx}
                      className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex gap-3 items-start justify-between"
                    >
                      {place.thumbnail && (
                        <img
                          src={place.thumbnail}
                          alt={place.title}
                          className="w-16 h-16 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-white text-xs leading-snug">
                            {place.title}
                          </h4>
                          {place.rating && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold px-1.5 py-0.2 rounded shrink-0">
                              ★ {place.rating} ({place.reviews || 0})
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-1">{place.address}</p>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                          {place.open_state && (
                            <span className="text-emerald-400 font-medium">{place.open_state}</span>
                          )}
                          {place.wheelchair_accessible && (
                            <span className="text-blue-400 font-medium flex items-center gap-0.5">
                              <Accessibility size={11} /> Wheelchair Accessible
                            </span>
                          )}
                          {place.phone && (
                            <span>📞 {place.phone}</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const converted: ATMData = {
                            id: place.place_id || `scraped-${idx}-${Date.now()}`,
                            name: place.title || 'ATM',
                            bank: place.title.toLowerCase().includes('capitec')
                              ? 'Capitec'
                              : place.title.toLowerCase().includes('standard')
                              ? 'Standard Bank'
                              : place.title.toLowerCase().includes('nedbank')
                              ? 'Nedbank'
                              : place.title.toLowerCase().includes('absa')
                              ? 'Absa'
                              : 'FNB',
                            location: {
                              lat: place.gps_coordinates?.latitude || userLocation.lat,
                              lng: place.gps_coordinates?.longitude || userLocation.lng,
                            },
                            address: place.address || 'South Africa',
                            city: 'South Africa',
                            type: 'Mall/Indoor (Secure)',
                            status: 'online',
                            notes: place.open_state || 'Scraped from Google Maps',
                            lastUpdated: 'Just now',
                            isGuarded: true,
                            hasCCTV: true,
                            securityRating: 'Safe',
                            accessibility: place.wheelchair_accessible ?? true,
                          };
                          setAtms((prev) => [converted, ...prev.filter((a) => a.id !== converted.id)]);
                          setLiveSearchToast(`Added ${place.title} to map!`);
                          setTimeout(() => setLiveSearchToast(null), 3000);
                        }}
                        className="bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white px-2 py-1 rounded-lg text-[10px] font-semibold transition shrink-0 whitespace-nowrap"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
              <span className="text-[11px] text-slate-500">
                Powered by SerpApi Google Maps Engine
              </span>
              <button
                onClick={() => setShowScraperModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {liveSearchToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/80 text-emerald-300 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-medium backdrop-blur">
          <Compass size={18} className="text-emerald-400 shrink-0 animate-spin" />
          <span>{liveSearchToast}</span>
        </div>
      )}
    </div>
  );
}

// Controller component to center and pan the map dynamically
function MapSyncController({
  userLocation,
  activeRoute
}: {
  userLocation: { lat: number; lng: number };
  activeRoute: NavigationRoute | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (activeRoute && typeof google !== 'undefined' && google?.maps?.LatLngBounds) {
      // Fit bounds to include user and target ATM
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(activeRoute.origin);
      bounds.extend(activeRoute.destinationAtm.location);
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    } else if (map && userLocation) {
      map.panTo(userLocation);
    }
  }, [map, userLocation, activeRoute]);

  return null;
}
