import React, { useState } from 'react';
import { Building2, Truck, ShieldCheck, ArrowLeft, Zap } from 'lucide-react';
import { PatientInfo } from '../../types/bedlink';
import { AuthSession } from '../../api/client';
import { AadhaarScannerModal } from './AadhaarScannerModal';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { PatientLoginForm } from './login/PatientLoginForm';
import { NurseLoginForm } from './login/NurseLoginForm';
import { AmbulanceLoginForm } from './login/AmbulanceLoginForm';
import { AdminLoginForm } from './login/AdminLoginForm';
import { EmergencyCallBar } from '../common/EmergencyCallBar';

interface BedLinkLoginPageProps {
  onLoginAsPatient: (info: PatientInfo, sessionUser: AuthSession) => void;
  onLoginAsNurse: (sessionUser: AuthSession) => void;
  onLoginAsAmbulance: (sessionUser: AuthSession) => void;
  onLoginAsAdmin: (sessionUser: AuthSession) => void;
  onDirectEmergencyLogin: () => Promise<void>;
  language: LanguageCode;
}

export const BedLinkLoginPage: React.FC<BedLinkLoginPageProps> = ({
  onLoginAsPatient,
  onLoginAsNurse,
  onLoginAsAmbulance,
  onLoginAsAdmin,
  language,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  // Patient search is the single dominant primary path
  const [viewMode, setViewMode] = useState<'patient' | 'staff'>('patient');
  const [staffTab, setStaffTab] = useState<'nurse' | 'ambulance' | 'admin'>('nurse');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedData, setScannedData] = useState<Partial<PatientInfo> | null>(null);

  const handleAadhaarScanSuccess = (data: Partial<PatientInfo>) => {
    // Fill the form fields for user review and validation, DO NOT auto-login!
    setScannedData(data);
    setIsScannerOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Dominant Header for Patient Path */}
      {viewMode === 'patient' ? (
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Western Line Emergency Hospital Grid</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t.findHospitalBedNow}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            {t.findHospitalBedNowDesc}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMode('patient')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.backToPatientSearch}</span>
          </button>
          <span className="text-xs font-bold text-slate-500">{t.staffLoginTitle}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {viewMode === 'patient' ? (
          <PatientLoginForm
            onLogin={onLoginAsPatient}
            onOpenScanner={() => setIsScannerOpen(true)}
            scannedData={scannedData}
            t={t}
          />
        ) : (
          <div className="space-y-6">
            {/* Staff Sub-tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1">
              <button
                type="button"
                onClick={() => setStaffTab('nurse')}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                  staffTab === 'nurse'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t.tabNurse}</span>
              </button>
              <button
                type="button"
                onClick={() => setStaffTab('ambulance')}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                  staffTab === 'ambulance'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{t.tabAmbulance}</span>
              </button>
              <button
                type="button"
                onClick={() => setStaffTab('admin')}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                  staffTab === 'admin'
                    ? 'bg-white text-purple-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                <span>{t.tabAdmin}</span>
              </button>
            </div>

            {staffTab === 'nurse' && <NurseLoginForm onLoginSuccess={onLoginAsNurse} t={t} />}
            {staffTab === 'ambulance' && <AmbulanceLoginForm onLoginSuccess={onLoginAsAmbulance} t={t} />}
            {staffTab === 'admin' && <AdminLoginForm onLoginSuccess={onLoginAsAdmin} t={t} />}
          </div>
        )}
      </div>

      {/* Secondary Toggle to switch between Patient and Staff */}
      {viewMode === 'patient' && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setViewMode('staff')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer min-h-[44px] inline-flex items-center gap-1"
          >
            <span>{t.staffPortalToggle}</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      {/* Persistent Emergency Call Bar */}
      <EmergencyCallBar t={t} showDisclaimer={true} />

      {/* Aadhaar Scanner Modal */}
      <AadhaarScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleAadhaarScanSuccess}
        language={language}
      />
    </div>
  );
};
