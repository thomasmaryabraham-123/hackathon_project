import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  MapPin,
  Navigation,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  User,
} from 'lucide-react';
import { PatientInfo } from '../../../types/bedlink';
import { WESTERN_LINE_STATIONS } from '../../../data/stations';
import { Translations } from '../../../i18n/translations';
import { api, AuthSession } from '../../../api/client';
import { useLocation } from '../../../hooks/useLocation';

interface PatientLoginFormProps {
  onLogin: (info: PatientInfo, sessionUser: AuthSession) => void;
  onOpenScanner: () => void;
  scannedData?: Partial<PatientInfo> | null;
  t: Translations;
}

interface FormErrors {
  patientName?: string;
  relativeName?: string;
  phone?: string;
  age?: string;
}

const INDIAN_PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;

export const PatientLoginForm: React.FC<PatientLoginFormProps> = ({
  onLogin,
  onOpenScanner,
  scannedData,
  t,
}) => {
  const [mode, setMode] = useState<'quick' | 'full'>('quick');

  // Form State
  const [patientName, setPatientName] = useState('');
  const [isUnknownName, setIsUnknownName] = useState(false);
  const [relativeName, setRelativeName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [selectedBlood, setSelectedBlood] = useState<string>("Don't know");

  // Validation & Error State
  const [errors, setErrors] = useState<FormErrors>({});
  const [, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field refs for focus on invalid
  const patientNameRef = useRef<HTMLInputElement>(null);
  const relativeNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);

  // Location Hook
  const location = useLocation('Bandra Station');

  // Request GPS on mount for speed
  useEffect(() => {
    location.requestGps();
  }, [location.requestGps]);

  // Apply scanned Aadhaar data if provided
  useEffect(() => {
    if (scannedData) {
      if (scannedData.patientName) {
        setPatientName(scannedData.patientName);
        setIsUnknownName(false);
      }
      if (scannedData.relativeName) setRelativeName(scannedData.relativeName);
      if (scannedData.phone) setPhoneNumber(scannedData.phone);
      if (scannedData.age !== undefined && scannedData.age !== null) setPatientAge(String(scannedData.age));
      if (scannedData.gender) setPatientGender(scannedData.gender);
      if (scannedData.bloodType) setSelectedBlood(scannedData.bloodType);
      if (scannedData.nearestStation) location.selectStationManually(scannedData.nearestStation);
      setMode('full');
    }
  }, [scannedData, location.selectStationManually]);

  const bloodOptions = ["Don't know", 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  // Inline Validation Helper
  const validateField = (field: keyof FormErrors, value?: any): string | undefined => {
    if (field === 'patientName') {
      if (isUnknownName) return undefined;
      const v = (value !== undefined ? value : patientName).trim();
      if (!v) return "Please enter the patient's name (or choose 'I don't know their name').";
    }
    if (field === 'relativeName') {
      if (mode === 'quick') return undefined; // Quick emergency requires only patient & contact phone
      const v = (value !== undefined ? value : relativeName).trim();
      if (!v) return "Please enter your name or attendant's name.";
    }
    if (field === 'phone') {
      const v = (value !== undefined ? value : phoneNumber).trim();
      if (!v) return 'Please enter a 10-digit phone number to reach you.';
      if (!INDIAN_PHONE_REGEX.test(v)) return 'Please enter a valid 10-digit Indian phone number.';
    }
    if (field === 'age') {
      if (mode === 'quick') return undefined;
      const raw = value !== undefined ? value : patientAge;
      if (raw === '' || raw === null || raw === undefined) return 'Please enter patient age (0-120).';
      const num = Number(raw);
      if (isNaN(num) || num < 0 || num > 120 || !Number.isInteger(num)) {
        return 'Age must be a whole number between 0 and 120.';
      }
    }
    return undefined;
  };

  const handleBlur = (field: keyof FormErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {};
    const patientNameErr = validateField('patientName');
    if (patientNameErr) newErrors.patientName = patientNameErr;

    const phoneErr = validateField('phone');
    if (phoneErr) newErrors.phone = phoneErr;

    if (mode === 'full') {
      const relativeErr = validateField('relativeName');
      if (relativeErr) newErrors.relativeName = relativeErr;

      const ageErr = validateField('age');
      if (ageErr) newErrors.age = ageErr;
    }

    setErrors(newErrors);
    setTouched({ patientName: true, relativeName: true, phone: true, age: true });

    // Focus first invalid field
    if (newErrors.patientName && patientNameRef.current) {
      patientNameRef.current.focus();
    } else if (newErrors.phone && phoneRef.current) {
      phoneRef.current.focus();
    } else if (newErrors.relativeName && relativeNameRef.current) {
      relativeNameRef.current.focus();
    } else if (newErrors.age && ageRef.current) {
      ageRef.current.focus();
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);

    const isUnidentified = isUnknownName || !patientName.trim();
    const resolvedPatientName = isUnidentified ? 'Unknown patient' : patientName.trim();
    const resolvedRelativeName = relativeName.trim() || (isUnidentified ? 'Emergency Attendant' : 'Attendant');
    const resolvedAge = patientAge !== '' ? Number(patientAge) : 30;
    const resolvedStation = location.selectedStationName || 'Bandra Station';

    try {
      const res = await api.login({
        role: 'patient',
        patientName: resolvedPatientName,
        relativeName: resolvedRelativeName,
        phone: phoneNumber.trim(),
        age: resolvedAge,
        gender: patientGender,
        bloodType: selectedBlood,
        nearestStation: resolvedStation,
        isUnidentified,
      });

      const info: PatientInfo = {
        patientName: resolvedPatientName,
        relativeName: resolvedRelativeName,
        phone: phoneNumber.trim(),
        age: resolvedAge,
        gender: patientGender,
        bloodType: selectedBlood,
        nearestStation: resolvedStation,
        useGps: location.source === 'gps',
        userLat: location.coords?.lat,
        userLng: location.coords?.lng,
        accuracyMeters: location.accuracyMeters,
        locationSource: location.source,
        isUnidentified,
        admissionId: res.admissionId || res.user.admissionId,
      };

      onLogin(info, res.user);
    } catch (err: any) {
      console.error('Patient login failed:', err);
      setServerError(err.message || 'Unable to connect to emergency server. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher: Quick Emergency vs Full Intake */}
      <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setMode('quick')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
            mode === 'quick'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
          <span>{t.quickEmergencyTitle} (Fastest)</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('full')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
            mode === 'full'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4 text-slate-500" />
          <span>Complete Intake Form</span>
        </button>
      </div>

      {serverError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{serverError}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shrink-0 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Aadhaar Fast Scan Option */}
      <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-xs sm:text-sm text-slate-900">
              {t.autofillAadhaar}
            </div>
            <p className="text-[11px] text-slate-600">
              Multimodal verification • Details remain editable before submitting
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenScanner}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
        >
          <ScanLine className="w-3.5 h-3.5 text-amber-400" />
          <span>Scan Aadhaar</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Step 1: Location Status & GPS */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label htmlFor="stationSelect" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>{t.selectStationLabel} *</span>
            </label>
            <button
              type="button"
              onClick={location.requestGps}
              disabled={location.isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors cursor-pointer self-start sm:self-auto min-h-[36px]"
            >
              <Navigation className={`w-3.5 h-3.5 ${location.isLoading ? 'animate-spin' : ''}`} />
              <span>{location.isLoading ? t.locationStatusFinding : t.useMyGps}</span>
            </button>
          </div>

          <select
            id="stationSelect"
            value={location.selectedStationName}
            onChange={(e) => location.selectStationManually(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white min-h-[44px]"
          >
            {WESTERN_LINE_STATIONS.map((station) => (
              <option key={station.id} value={station.name}>
                {station.name} ({station.zone})
              </option>
            ))}
          </select>

          {/* Location Status Badge */}
          {location.statusText && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
              location.isOutsideArea
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : location.source === 'gps'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-slate-200/80 text-slate-800'
            }`}>
              {location.source === 'gps' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span className="font-medium">{location.statusText}</span>
            </div>
          )}
        </div>

        {/* Step 2: Patient Identification */}
        <div className="space-y-3.5">
          {/* Patient Name with 'I don't know their name' choice */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="patientNameInput" className="text-xs font-bold text-slate-800">
                {t.patientNameLabel}
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !isUnknownName;
                  setIsUnknownName(nextVal);
                  if (nextVal) {
                    setPatientName('Unknown patient');
                    setErrors((prev) => ({ ...prev, patientName: undefined }));
                  } else {
                    setPatientName('');
                  }
                }}
                className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors cursor-pointer min-h-[32px] ${
                  isUnknownName
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                }`}
              >
                {isUnknownName ? '✓ ' + t.unknownPatientChoice : t.unknownPatientChoice}
              </button>
            </div>
            <input
              id="patientNameInput"
              ref={patientNameRef}
              type="text"
              required={!isUnknownName}
              disabled={isUnknownName}
              aria-invalid={Boolean(errors.patientName)}
              aria-describedby={errors.patientName ? 'patientNameError' : undefined}
              placeholder={isUnknownName ? 'Marked as Unknown patient' : t.patientNamePlaceholder}
              value={isUnknownName ? 'Unknown patient' : patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                if (errors.patientName) setErrors((prev) => ({ ...prev, patientName: undefined }));
              }}
              onBlur={() => handleBlur('patientName')}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white min-h-[44px] ${
                errors.patientName
                  ? 'border-rose-500 bg-rose-50/20'
                  : 'border-slate-200'
              } ${isUnknownName ? 'opacity-80 bg-slate-50 italic' : ''}`}
            />
            {errors.patientName && (
              <p id="patientNameError" role="alert" className="text-xs text-rose-600 font-semibold mt-1">
                {errors.patientName}
              </p>
            )}
          </div>

          {/* Contact Phone (Required in all paths) */}
          <div>
            <label htmlFor="phoneInput" className="block text-xs font-bold text-slate-800 mb-1">
              {t.phoneLabel}
            </label>
            <input
              id="phoneInput"
              ref={phoneRef}
              type="tel"
              required
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phoneError' : undefined}
              placeholder="e.g. 9820154321"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              onBlur={() => handleBlur('phone')}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white min-h-[44px] ${
                errors.phone ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
              }`}
            />
            {errors.phone && (
              <p id="phoneError" role="alert" className="text-xs text-rose-600 font-semibold mt-1">
                {errors.phone}
              </p>
            )}
          </div>

          {/* Blood Group with explicit 'Don't know' preselected */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                {t.bloodGroupLabel}
              </label>
              <span className="text-[11px] text-slate-500">Preselected: {selectedBlood}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bloodOptions.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setSelectedBlood(b)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
                    selectedBlood === b
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Extended fields shown in 'full' mode */}
          {mode === 'full' && (
            <div className="space-y-3.5 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              <div>
                <label htmlFor="relativeNameInput" className="block text-xs font-bold text-slate-800 mb-1">
                  {t.relativeNameLabel}
                </label>
                <input
                  id="relativeNameInput"
                  ref={relativeNameRef}
                  type="text"
                  required
                  aria-invalid={Boolean(errors.relativeName)}
                  aria-describedby={errors.relativeName ? 'relativeNameError' : undefined}
                  placeholder={t.relativeNamePlaceholder}
                  value={relativeName}
                  onChange={(e) => {
                    setRelativeName(e.target.value);
                    if (errors.relativeName) setErrors((prev) => ({ ...prev, relativeName: undefined }));
                  }}
                  onBlur={() => handleBlur('relativeName')}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white min-h-[44px] ${
                    errors.relativeName ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {errors.relativeName && (
                  <p id="relativeNameError" role="alert" className="text-xs text-rose-600 font-semibold mt-1">
                    {errors.relativeName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ageInput" className="block text-xs font-bold text-slate-800 mb-1">
                    {t.ageLabel} (0–120)
                  </label>
                  <input
                    id="ageInput"
                    ref={ageRef}
                    type="number"
                    min="0"
                    max="120"
                    required
                    aria-invalid={Boolean(errors.age)}
                    aria-describedby={errors.age ? 'ageError' : undefined}
                    placeholder="e.g. 28"
                    value={patientAge}
                    onChange={(e) => {
                      setPatientAge(e.target.value);
                      if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }));
                    }}
                    onBlur={() => handleBlur('age')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white min-h-[44px] ${
                      errors.age ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {errors.age && (
                    <p id="ageError" role="alert" className="text-xs text-rose-600 font-semibold mt-1">
                      {errors.age}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t.genderLabel}
                  </label>
                  <div className="flex gap-1.5">
                    {(['Female', 'Male', 'Other'] as const).map((g) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => setPatientGender(g)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer min-h-[44px] ${
                          patientGender === g
                            ? 'bg-rose-50 border-rose-500 text-rose-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {g === 'Female' ? t.female : g === 'Male' ? t.male : t.other}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[50px] mt-4"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Verifying and Connecting…</span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
              <span>{mode === 'quick' ? t.findBed1Tap : t.continueButton}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
