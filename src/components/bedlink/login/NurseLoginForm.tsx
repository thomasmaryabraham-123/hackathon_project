import React, { useState, useEffect } from 'react';
import { Building2, Lock, ArrowRight, AlertCircle, Search, RefreshCw } from 'lucide-react';
import { Translations } from '../../../i18n/translations';
import { api, AuthSession } from '../../../api/client';
import { Hospital } from '../../../types/bedlink';

interface NurseLoginFormProps {
  onLoginSuccess: (sessionUser: AuthSession) => void;
  t: Translations;
}

export const NurseLoginForm: React.FC<NurseLoginFormProps> = ({ onLoginSuccess, t }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [nurseHospital, setNurseHospital] = useState('');
  const [nurseStaffId, setNurseStaffId] = useState('');
  const [nursePasscode, setNursePasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const list = await api.getHospitals();
        setHospitals(list);
        if (list.length > 0) {
          setNurseHospital(list[0].id);
        }
      } catch (err: any) {
        console.warn('Could not load hospitals list:', err);
      } finally {
        setLoadingHospitals(false);
      }
    }
    load();
  }, []);

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.stationVicinity.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by zone
  const hospitalsByZone = filteredHospitals.reduce<Record<string, Hospital[]>>((acc, h) => {
    const z = h.zone || 'Other';
    if (!acc[z]) acc[z] = [];
    acc[z].push(h);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!nurseStaffId.trim()) {
      setLoginError('Staff ID is required.');
      return;
    }
    if (!nursePasscode.trim()) {
      setLoginError('Security Passcode is required.');
      return;
    }
    if (!nurseHospital) {
      setLoginError('Please select your assigned hospital facility.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.login({
        role: 'nurse',
        username: nurseStaffId.trim(),
        passcode: nursePasscode.trim(),
        hospitalId: nurseHospital,
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setLoginError(err.message || 'Nurse authentication failed. Please check staff credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">{t.tabNurse}</h3>
        <p className="text-xs text-slate-500">
          Emergency triage station: update bed availability, manage holds, and page doctors.
        </p>
      </div>

      {loginError && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-900">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{loginError}</span>
        </div>
      )}

      <div className="space-y-3.5">
        <div>
          <label htmlFor="nurseHospitalSelect" className="block text-xs font-bold text-slate-700 mb-1">
            Assigned Hospital Facility *
          </label>
          {loadingHospitals ? (
            <div className="p-3 bg-slate-50 border rounded-xl text-xs text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Loading facilities across Western Line corridor…</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search hospital or zone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50"
                />
              </div>
              <select
                id="nurseHospitalSelect"
                value={nurseHospital}
                onChange={(e) => setNurseHospital(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white min-h-[44px]"
              >
                {Object.entries(hospitalsByZone).map(([zone, list]) => (
                  <optgroup key={zone} label={zone}>
                    {list.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.stationVicinity})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="nurseStaffIdInput" className="block text-xs font-bold text-slate-700 mb-1">
            Staff / Badge ID *
          </label>
          <input
            id="nurseStaffIdInput"
            type="text"
            required
            value={nurseStaffId}
            onChange={(e) => setNurseStaffId(e.target.value)}
            placeholder="Enter your assigned staff badge ID"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white min-h-[44px]"
          />
        </div>

        <div>
          <label htmlFor="nursePasscodeInput" className="block text-xs font-bold text-slate-700 mb-1">
            Security Passcode *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="nursePasscodeInput"
              type="password"
              required
              value={nursePasscode}
              onChange={(e) => setNursePasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white min-h-[44px]"
            />
          </div>
        </div>

        {import.meta.env.DEV && (
          <details className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            <summary className="font-bold cursor-pointer">Dev demo credentials</summary>
            <div className="mt-2 space-y-1 text-[11px]">
              <div>Seven Hills: <code>NS-7H-104</code> / <code>123456</code></div>
              <div>Bombay Hospital: <code>NS-BH-101</code> / <code>123456</code></div>
              <div>Lilavati: <code>NS-LIL-101</code> / <code>123456</code></div>
              <div>Nanavati: <code>NS-NAN-101</code> / <code>123456</code></div>
              <div>Shatabdi: <code>NS-SHAT-101</code> / <code>123456</code></div>
              <div>Cardinal Gracias: <code>NS-CG-101</code> / <code>123456</code></div>
              <button
                type="button"
                onClick={() => {
                  setNurseStaffId('NS-7H-104');
                  setNursePasscode('123456');
                  setNurseHospital('hosp-sevenhills');
                }}
                className="text-emerald-700 font-bold underline mt-1 block cursor-pointer"
              >
                Auto-fill Seven Hills demo
              </button>
            </div>
          </details>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
      >
        <Building2 className="w-4 h-4" />
        <span>{isSubmitting ? 'Authenticating…' : 'Enter Nurse Triage Station'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
};
