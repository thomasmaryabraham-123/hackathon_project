import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  Building2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { PatientAdmissionRecord, UserLoginLog, Hospital } from '../../types/bedlink';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { api, DatabaseStatus, SqlQueryResult } from '../../api/client';
import { AdminAdmissionsTab } from './admin/AdminAdmissionsTab';
import { AdminAuditLogsTab } from './admin/AdminAuditLogsTab';
import { AdminHospitalsTab } from './admin/AdminHospitalsTab';
import { AdminSqlStudioTab } from './admin/AdminSqlStudioTab';
import { AdminAddHospitalModal } from './admin/AdminAddHospitalModal';
import { PatientDossierModal } from './admin/PatientDossierModal';

interface AdminDashboardViewProps {
  admissionRecords: PatientAdmissionRecord[];
  userLogs: UserLoginLog[];
  hospitals: Hospital[];
  onDischargePatient: (recordId: string) => void;
  onAddHospital: (hospital: Hospital) => void;
  language: LanguageCode;
  onRefreshData?: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  admissionRecords,
  userLogs,
  hospitals,
  onDischargePatient,
  onAddHospital,
  language,
  onRefreshData,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  const [activeTab, setActiveTab] = useState<'admissions' | 'audit' | 'hospitals' | 'sql_studio'>('admissions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordForDossier, setSelectedRecordForDossier] = useState<PatientAdmissionRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAddHospOpen, setIsAddHospOpen] = useState(false);

  // SQL Studio State
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM admission_records ORDER BY created_at DESC LIMIT 10;');
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDbStatus = async () => {
    try {
      const status = await api.getDatabaseStatus();
      setDbStatus(status);
    } catch (err: any) {
      console.warn('Failed to load DB status:', err.message);
    }
  };

  useEffect(() => {
    loadDbStatus();
  }, [activeTab]);

  const handleRunSql = async (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    if (!q.trim()) return;
    setIsExecutingSql(true);
    setQueryResult(null);
    try {
      const result = await api.executeSqlQuery(q);
      setQueryResult(result);
      if (result.success) {
        showToast(`Read-only SQL executed in ${result.executionMs} ms!`);
        loadDbStatus();
        if (onRefreshData) onRefreshData();
      } else {
        showToast(`SQL Error: ${result.error || 'Execution failed'}`);
      }
    } catch (err: any) {
      setQueryResult({ success: false, error: err.message });
      showToast(`Error: ${err.message}`);
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleResetDb = async () => {
    try {
      const res = await api.resetDatabase();
      if (res.success) {
        showToast('Database reset and synced successfully.');
        loadDbStatus();
        if (onRefreshData) onRefreshData();
      } else {
        showToast(`Reset blocked: ${res.error || 'Not permitted'}`);
      }
    } catch (err: any) {
      showToast(`Reset failed: ${err.message}`);
    }
  };

  const admittedCount = admissionRecords.filter((r) => r.dischargeStatus === 'Admitted / In Care').length;
  const dischargedCount = admissionRecords.filter((r) => r.dischargeStatus === 'Discharged').length;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Admin Header Card */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950 text-purple-300 text-xs font-bold border border-purple-800">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>CENTRAL OPERATIONS • Western Railway Grid Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {t.adminPortalTitle}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-3xl leading-relaxed">
              Real-time persistent SQLite database records: audit user authentication sessions, track patient intake timestamps, monitor hospital bed reservations, and verify discharge summaries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                loadDbStatus();
                if (onRefreshData) onRefreshData();
                showToast('Synchronized with Node.js backend & SQLite database.');
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sync DB</span>
            </button>
            <button
              onClick={() => setIsAddHospOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer min-h-[44px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Hospital</span>
            </button>
          </div>
        </div>

        {/* 6 Top Stat Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PATIENT RECORDS</div>
            <div className="text-2xl font-black text-white mt-1">{admissionRecords.length}</div>
            <div className="text-[11px] text-purple-400 font-medium">Tracked in DB</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CURRENTLY ADMITTED</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{admittedCount}</div>
            <div className="text-[11px] text-slate-400 font-medium">In Care</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DISCHARGED</div>
            <div className="text-2xl font-black text-blue-400 mt-1">{dischargedCount}</div>
            <div className="text-[11px] text-slate-400 font-medium">Stabilized</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AUDIT LOGS</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{userLogs.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Audited Sessions</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HOSPITALS</div>
            <div className="text-2xl font-black text-rose-400 mt-1">{hospitals.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Western Corridor</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DATABASE ENGINE</div>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">SQLite 3</div>
            <div className="text-[11px] text-slate-400 font-medium font-mono">{dbStatus ? `${dbStatus.sizeKb} KB (WAL)` : 'Connected'}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex border-b border-slate-200 pb-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('admissions')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'admissions'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t.tabAdmissions}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'admissions' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {admissionRecords.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{t.tabAuditLogs}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'audit' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {userLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('hospitals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'hospitals'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{t.tabHospitalsBeds}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'hospitals' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {hospitals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sql_studio')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'sql_studio'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>{t.tabSqlStudio}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-900 text-emerald-100">
              Read-Only
            </span>
          </button>
        </div>

        {activeTab === 'admissions' && (
          <AdminAdmissionsTab
            admissionRecords={admissionRecords}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onDischargePatient={onDischargePatient}
            onSelectRecord={(rec) => setSelectedRecordForDossier(rec)}
            t={t}
          />
        )}

        {activeTab === 'audit' && <AdminAuditLogsTab userLogs={userLogs} />}

        {activeTab === 'hospitals' && <AdminHospitalsTab hospitals={hospitals} t={t} />}

        {activeTab === 'sql_studio' && (
          <AdminSqlStudioTab
            dbStatus={dbStatus}
            sqlQuery={sqlQuery}
            setSqlQuery={setSqlQuery}
            queryResult={queryResult}
            isExecutingSql={isExecutingSql}
            onRunSql={handleRunSql}
            onResetDb={handleResetDb}
          />
        )}
      </div>

      <AdminAddHospitalModal
        isOpen={isAddHospOpen}
        onClose={() => setIsAddHospOpen(false)}
        onAddHospital={onAddHospital}
      />

      <PatientDossierModal
        record={selectedRecordForDossier}
        onClose={() => setSelectedRecordForDossier(null)}
      />
    </div>
  );
};
