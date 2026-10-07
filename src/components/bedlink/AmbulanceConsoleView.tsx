import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Phone,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { EmergencyCase, Hospital } from '../../types/bedlink';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { api } from '../../api/client';
import { calculateDistanceKm } from '../../utils/geo';

interface AmbulanceConsoleViewProps {
  emergencyCase: EmergencyCase | null;
  onAdvanceStage?: (caseId: string, stage: number, street?: string, etaMinutes?: number, lat?: number, lng?: number) => void;
  language: LanguageCode;
  hospitals?: Hospital[];
}

export const AmbulanceConsoleView: React.FC<AmbulanceConsoleViewProps> = ({
  emergencyCase,
  onAdvanceStage,
  language,
  hospitals = [],
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  const [currentStage, setCurrentStage] = useState(emergencyCase?.pipelineStage || 2);
  const [sirenActive, setSirenActive] = useState(true);

  // Live coordinates state
  const [currentLat, setCurrentLat] = useState<number>(emergencyCase?.lat || 19.0544);
  const [currentLng, setCurrentLng] = useState<number>(emergencyCase?.lng || 72.8402);
  const [currentStreetName, setCurrentStreetName] = useState<string>(
    emergencyCase?.currentStreet || 'Western Express Highway, Bandra Corridor'
  );
  const [gpsStatus, setGpsStatus] = useState<'watching' | 'simulated' | 'error'>('watching');
  const [lastPatchedTime, setLastPatchedTime] = useState<number>(Date.now());
  const [secondsSinceLastSend, setSecondsSinceLastSend] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(Date.now());

  // Find assigned destination hospital
  const targetHospital =
    hospitals.find((h) => h.id === emergencyCase?.hospitalId || h.name === emergencyCase?.hospitalName) ||
    hospitals[0];

  const destinationLat = targetHospital?.lat || 19.1228;
  const destinationLng = targetHospital?.lng || 72.8797;
  const destinationHospitalName = emergencyCase?.hospitalName || targetHospital?.name || 'Assigned Hospital ER';

  // Dynamic ETA calculation
  const distanceToDest = calculateDistanceKm(currentLat, currentLng, destinationLat, destinationLng);
  const dynamicEta = Math.max(1, Math.round(distanceToDest * 3.5)); // ~3.5 min/km Mumbai traffic

  // Throttled sender
  const sendLocationUpdate = async (lat: number, lng: number, streetText?: string, eta?: number) => {
    if (!emergencyCase) return;
    const now = Date.now();
    if (now - lastSentRef.current < 4000) return;
    lastSentRef.current = now;
    setLastPatchedTime(now);

    const etaVal = eta !== undefined ? eta : dynamicEta;
    const streetVal = streetText || currentStreetName;

    try {
      await api.updateAmbulanceLocation(emergencyCase.caseId, lat, lng, streetVal, etaVal);
    } catch (err) {
      console.warn('Failed to update ambulance telemetry:', err);
    }
  };

  // Watch position with strict cleanup on unmount & role switch
  useEffect(() => {
    if (!emergencyCase) return;

    if (typeof window !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentLat(lat);
          setCurrentLng(lng);
          setGpsStatus('watching');
          sendLocationUpdate(lat, lng);
        },
        (err) => {
          console.warn('Ambulance watchPosition unavailable or blocked:', err.message);
          setGpsStatus('simulated');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setGpsStatus('simulated');
    }

    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [emergencyCase?.caseId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceLastSend(Math.floor((Date.now() - lastPatchedTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastPatchedTime]);

  if (!emergencyCase || (emergencyCase.holdStatus !== 'active' && emergencyCase.holdStatus !== 'confirmed')) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-3 shadow-xs">
        <Truck className="w-12 h-12 text-blue-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-900">No Inbound Emergency Case Dispatched</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Unit is on standby in the Western Railway dispatch sector. Once a commuter reserves an emergency bed, telemetry coordinates will stream here.
        </p>
      </div>
    );
  }

  const handleSimulateStep = () => {
    const stepLat = currentLat + (destinationLat - currentLat) * 0.25 + (Math.random() - 0.5) * 0.001;
    const stepLng = currentLng + (destinationLng - currentLng) * 0.25 + (Math.random() - 0.5) * 0.001;
    setCurrentLat(stepLat);
    setCurrentLng(stepLng);
    setGpsStatus('simulated');
    lastSentRef.current = 0;
    sendLocationUpdate(stepLat, stepLng);
  };

  const stages = [
    {
      num: 2,
      title: t.enRouteToPatient,
      desc: t.enRouteToPatientDesc,
      street: `Western Express Highway, en route to ${emergencyCase.location || 'Scene'}`,
    },
    {
      num: 3,
      title: t.arrivedAtScene,
      desc: t.arrivedAtSceneDesc,
      street: `At Patient Scene - ${emergencyCase.location || 'Station Corridor'}`,
    },
    {
      num: 4,
      title: t.inTransitToHospital,
      desc: t.inTransitToHospitalDesc,
      street: `Approaching ${destinationHospitalName} Emergency Bay`,
    },
    {
      num: 5,
      title: t.deliveredToEr,
      desc: t.deliveredToErDesc,
      street: `${destinationHospitalName} - ${emergencyCase.bedBay || 'Emergency Bay'}`,
    },
  ];

  const handleStageClick = (st: typeof stages[0]) => {
    setCurrentStage(st.num);
    setCurrentStreetName(st.street);
    const stageEta = st.num === 5 ? 0 : dynamicEta;
    if (onAdvanceStage) {
      onAdvanceStage(emergencyCase.caseId, st.num, st.street, stageEta, currentLat, currentLng);
    }
    lastSentRef.current = 0;
    sendLocationUpdate(currentLat, currentLng, st.street, stageEta);
  };

  return (
    <div className="space-y-6">
      {/* Warning banner when GPS is off/simulated */}
      {gpsStatus !== 'watching' && (
        <div
          role="alert"
          className="p-4 bg-amber-500 text-slate-950 rounded-2xl flex items-center gap-3 font-extrabold text-xs shadow-md"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{t.gpsSimulatedBanner}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black">{t.driverConsoleTitle}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1 border ${
                gpsStatus === 'watching'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${gpsStatus === 'watching' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
                <span>{gpsStatus === 'watching' ? 'Live Device GPS Active' : 'Road Telemetry Mode'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilot: <strong className="text-white">{emergencyCase.driverName}</strong> • Vehicle:{' '}
              <span className="font-mono text-rose-300">{emergencyCase.vehicleNo}</span> • Case:{' '}
              <span className="font-mono text-emerald-400">{emergencyCase.caseId}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSirenActive(!sirenActive)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              sirenActive
                ? 'bg-rose-600 text-white animate-pulse shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>{sirenActive ? t.sirenActive : t.sirenInactive}</span>
          </button>
          <a
            href={`tel:${emergencyCase.hospitalPhone}`}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>{t.callErDesk}</span>
          </a>
        </div>
      </div>

      {/* Real-Time GPS Telemetry Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Vehicle Coordinates &amp; Dynamic Reach ETA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Sent: {secondsSinceLastSend}s ago
            </span>
            <button
              type="button"
              onClick={handleSimulateStep}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold border border-slate-700 cursor-pointer min-h-[36px]"
            >
              Step Forward
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Current Coordinates</div>
            <div className="font-mono text-emerald-400 font-bold text-sm mt-0.5">
              {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
            </div>
            <div className="text-xs text-slate-400 truncate mt-0.5">{currentStreetName}</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Destination Hospital</div>
            <div className="text-white font-bold text-sm mt-0.5 truncate">
              {destinationHospitalName}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Distance: ~{distanceToDest.toFixed(1)} km (straight line)
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Estimated Traffic ETA</div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {currentStage === 5 ? '0' : dynamicEta} mins
              </div>
            </div>
            <Truck className="w-8 h-8 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Advance Emergency Milestones */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t.advanceMilestone}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Advance milestones to update patient family and hospital triage team in real time.
            </p>
          </div>

          <div className="space-y-3">
            {stages.map((st) => {
              const isPassed = currentStage >= st.num;
              const isCurrent = currentStage === st.num;
              return (
                <div
                  key={st.num}
                  onClick={() => handleStageClick(st)}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                      : isPassed
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {st.num}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{st.title}</div>
                      <div className="text-xs text-slate-500">{st.desc}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{st.street}</div>
                    </div>
                  </div>
                  <div>
                    {isCurrent && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white">
                        Active Stage
                      </span>
                    )}
                    {!isCurrent && isPassed && (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right col: Destination hospital info */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Assigned Destination &amp; Bay
            </h4>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-emerald-950 font-black text-sm">
                {destinationHospitalName}
              </div>
              <div className="text-xs font-bold text-emerald-700 mt-0.5">
                {emergencyCase.bedBay || 'Emergency Bay #01'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Attending Specialist: <strong>{emergencyCase.specialistName || 'Trauma Lead'}</strong>
              </div>
            </div>
            <div className="space-y-1 text-xs text-slate-600 pt-1">
              <div>
                Patient: <strong>{emergencyCase.patientName}</strong> ({emergencyCase.age}y • {emergencyCase.gender})
              </div>
              <div>
                Blood: <strong className="text-rose-600">{emergencyCase.bloodType || "Don't know"}</strong>
              </div>
              <div>
                Contact: <strong>{emergencyCase.relativeName}</strong> ({emergencyCase.relativePhone})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
