import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  CheckCircle2,
  Truck,
  Radio,
} from 'lucide-react';
import { EmergencyCase, Hospital, BedCounts } from '../../types/bedlink';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { BedInventoryEditor } from './nurse/BedInventoryEditor';
import { DoctorRosterPanel } from './nurse/DoctorRosterPanel';

interface NurseStationViewProps {
  emergencyCase: EmergencyCase | null;
  language: LanguageCode;
  assignedHospitalId: string;
  hospitals: Hospital[];
  onUpdateBedCount: (
    hospitalId: string,
    type: keyof BedCounts,
    delta: number
  ) => void;
  onRespondToHold: (caseId: string, decision: 'accept' | 'reject') => Promise<EmergencyCase | null>;
}

export const NurseStationView: React.FC<NurseStationViewProps> = ({
  emergencyCase,
  language,
  assignedHospitalId,
  hospitals,
  onUpdateBedCount,
  onRespondToHold,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  // Read-only modal/expanded view for tracking ambulance
  const [showAmbulanceTracker, setShowAmbulanceTracker] = useState(false);
  const [pagedDoctorNotice, setPagedDoctorNotice] = useState<string | null>(null);

  // SLA countdown
  const [slaCountdown, setSlaCountdown] = useState(120);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlaCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!emergencyCase?.holdExpiresAt) return;
    const tick = () => setSlaCountdown(Math.max(0, Math.ceil((new Date(emergencyCase.holdExpiresAt!).getTime() - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [emergencyCase?.caseId, emergencyCase?.holdExpiresAt]);

  const currentHospital = hospitals.find((h) => h.id === assignedHospitalId);

  if (!currentHospital) {
    return <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center space-y-2">
      <Building2 className="w-9 h-9 text-amber-600 mx-auto" />
      <h2 className="font-black text-slate-900">Hospital assignment unavailable</h2>
      <p className="text-xs text-slate-500">Your nurse account is not assigned to a currently available facility. Sign in again or ask an administrator to verify the assignment.</p>
    </div>;
  }

  const bedCounts = currentHospital.beds;

  const handlePageDoctor = (name: string) => {
    setPagedDoctorNotice(name);
    setTimeout(() => setPagedDoctorNotice(null), 4000);
  };

  const sampleDoctors = [
    {
      id: 'doc1',
      name: 'Dr. Rohan Mehta',
      status: 'AVAILABLE',
      specialty: 'Trauma & Emergency Specialist',
      dept: 'Emergency & Critical Care - MBBS, MD',
      location: 'In Emergency Triage Bay',
      activeCase: emergencyCase ? `Standby for Case #${emergencyCase.caseId}` : 'Standby for triage',
      avatar: '',
      phone: '+91 22 6767 6701',
    },
    {
      id: 'doc2',
      name: 'Dr. Anita Deshmukh',
      status: 'AVAILABLE',
      specialty: 'Vascular & Trauma Surgeon',
      dept: 'Vascular Surgery - MS, MCh (Vascular)',
      location: 'Surgical ICU Floor 2',
      activeCase: 'Available for vascular trauma',
      avatar: '',
      phone: '+91 22 6767 6702',
    },
    {
      id: 'doc3',
      name: 'Dr. Vikramaditya Rao',
      status: 'IN SURGERY',
      specialty: 'Interventional Cardiologist',
      dept: 'Cardiology & Cath Lab - MD, DM',
      location: 'Cath Lab Room 2',
      activeCase: 'In Surgery',
      avatar: '',
      phone: '+91 22 6767 6703',
    },
    {
      id: 'doc4',
      name: 'Dr. Farhan Qureshi',
      status: 'AVAILABLE',
      specialty: 'Neurosurgeon',
      dept: 'Neurosurgery - MS, MCh',
      location: 'Trauma ICU Floor 3',
      activeCase: 'Available for Neuro consult',
      avatar: '',
      phone: '+91 22 6767 6704',
    },
  ];

  const isCaseActiveOrConfirmed =
    Boolean(emergencyCase) &&
    (emergencyCase?.holdStatus === 'active' || emergencyCase?.holdStatus === 'confirmed');

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {pagedDoctorNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">
            Emergency alert paged to {pagedDoctorNotice}
          </span>
        </div>
      )}

      {/* Hospital Identity Header */}
      <div className="bg-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black">
                {currentHospital.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                Assigned Nurse Station
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentHospital.stationVicinity} • Phone: {currentHospital.phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:${currentHospital.phone}`}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors min-h-[44px]"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Facility Desk</span>
          </a>
        </div>
      </div>

      {/* Incoming Emergency Request Card (Scoped to this hospital) */}
      {emergencyCase && isCaseActiveOrConfirmed ? (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-lg border border-rose-900/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-900/40 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                {t.incomingEmergency}
              </span>
              <span className="text-xs font-mono text-slate-400">
                #{emergencyCase.caseId}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {emergencyCase.holdStatus === 'confirmed' ? (
                <span className="text-xs font-black font-mono text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-700">
                  Confirmed • Ambulance En Route
                </span>
              ) : (
                <>
                  <span className="text-xs text-slate-400">2-Minute Reservation Hold:</span>
                  <span className="text-base font-black font-mono text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-800">
                    {Math.floor(slaCountdown / 60)}:
                    {(slaCountdown % 60).toString().padStart(2, '0')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px]">
                Patient Vitals &amp; Condition
              </span>
              <div className="font-extrabold text-sm text-white">
                {emergencyCase.patientName} ({emergencyCase.age}y • {emergencyCase.gender})
              </div>
              <div className="text-rose-400 font-bold">{emergencyCase.injury}</div>
              <div className="text-slate-400">
                Blood Group: <strong>{emergencyCase.bloodType || "Don't know"}</strong>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px]">
                Reserved Bed &amp; Attendant
              </span>
              <div className="font-extrabold text-sm text-emerald-400">
                {emergencyCase.bedBay || 'Emergency Bay #01'}
              </div>
              <div className="text-slate-300">
                Contact: {emergencyCase.relativeName} ({emergencyCase.relativePhone})
              </div>
              <div className="text-slate-400 font-medium">
                Claim Mode: {emergencyCase.insuranceClaimMode || 'PM-JAY Cashless'}
              </div>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">
                  108 Inbound Telemetry
                </span>
                <div className="font-extrabold text-sm text-white flex items-center gap-1.5 mt-0.5">
                  <Truck className="w-4 h-4 text-rose-500" />
                  <span>ETA ~{emergencyCase.etaMinutes} mins</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {emergencyCase.currentStreet}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAmbulanceTracker(!showAmbulanceTracker)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>{showAmbulanceTracker ? 'Hide Live Telemetry' : 'View Ambulance Telemetry'}</span>
              </button>
            </div>
          </div>

          {emergencyCase.holdStatus === 'active' && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button type="button" disabled={responding} onClick={async () => { setResponding(true); try { await onRespondToHold(emergencyCase.caseId, 'accept'); } finally { setResponding(false); } }} className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-xs">
                {responding ? 'Saving response…' : 'Accept & hold this bed'}
              </button>
              <button type="button" disabled={responding} onClick={async () => { setResponding(true); try { await onRespondToHold(emergencyCase.caseId, 'reject'); } finally { setResponding(false); } }} className="flex-1 min-h-[44px] rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-60 text-white font-black text-xs">
                Decline — offer next facility
              </button>
            </div>
          )}

          {/* Read-only telemetry modal / panel for Nurse */}
          {showAmbulanceTracker && (
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-rose-400" />
                  <span>Read-Only Telemetry for Vehicle {emergencyCase.vehicleNo}</span>
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  Stage {emergencyCase.pipelineStage} of 5
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Pilot</span>
                  <span className="text-white font-bold">{emergencyCase.driverName}</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Pilot Contact</span>
                  <a href={`tel:${emergencyCase.driverPhone}`} className="text-rose-400 font-mono font-bold hover:underline">
                    {emergencyCase.driverPhone}
                  </a>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Current Roadway</span>
                  <span className="text-slate-300 truncate block">{emergencyCase.currentStreet}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-1">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 text-sm">No Active Emergency Inbound Case</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Emergency triage desk is clear. New commuter bed holds will appear here immediately.
          </p>
        </div>
      )}

      {/* Bed Inventory Quick Editor */}
      <BedInventoryEditor
        hospital={currentHospital}
        bedCounts={bedCounts}
        onUpdate={(type, delta) => onUpdateBedCount(currentHospital.id, type, delta)}
        t={t}
      />

      {/* Doctor Roster & Paging */}
      <DoctorRosterPanel
        doctors={sampleDoctors}
        caseId={emergencyCase?.caseId || 'STANDBY'}
        onPageDoctor={handlePageDoctor}
        t={t}
      />
    </div>
  );
};
