import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  PhoneCall, 
  Mail, 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  MapPin,
  RefreshCw
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n/LanguageContext';

export const InstitutionSettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [instName, setInstName] = useState('');
  const [instCode, setInstCode] = useState('');
  const [aicteId, setAicteId] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportHours, setSupportHours] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get<any>('/institution/settings');
      setInstName(data.name || '');
      setInstCode(data.code || '');
      setAicteId(data.aicte_id || '');
      setState(data.state || '');
      setDistrict(data.district || '');
      setSupportPhone(data.support_phone || '');
      setSupportEmail(data.support_email || '');
      setSupportHours(data.support_hours || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load institution settings.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        support_phone: supportPhone.trim() || null,
        support_email: supportEmail.trim() || null,
        support_hours: supportHours.trim() || null,
        state: state.trim() || null,
        district: district.trim() || null,
      };

      const res = await api.put<any>('/institution/settings', payload);
      setSuccessMsg(res.message || 'Support contact information updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 max-w-xl mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only authorized Institution Administrators may configure institutional support contact details and profile metadata.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page Title */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-2">
          <Building2 className="w-3.5 h-3.5" />
          <span>Institutional Administration</span>
        </div>
        <h1 className="text-2xl font-bold text-[#172033] tracking-tight">{t('navSettings')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure institutional helpdesk contact details, operating hours, and profile parameters.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold m-0">{successMsg}</p>
            <p className="text-[11px] text-emerald-800 m-0 mt-0.5">
              The updated contact info is now active across the Institutional Masthead and Help Centre.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-medium m-0">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Read-Only Institutional Profile */}
        <Card rounded="2xl" className="p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 m-0">AICTE Institution Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Institution Name</span>
              <input
                type="text"
                value={instName}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-not-allowed"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Institution Code</span>
              <input
                type="text"
                value={instCode}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-mono font-semibold cursor-not-allowed"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">AICTE Permanent ID</span>
              <input
                type="text"
                value={aicteId || 'AICTE-APPROVED'}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-mono font-semibold cursor-not-allowed"
              />
            </div>
          </div>
        </Card>

        {/* Card 2: Help Desk & Support Configuration */}
        <Card rounded="2xl" className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900 m-0">Institution Helpdesk Configuration</h3>
            </div>
            <span className="text-[11px] text-blue-600 font-semibold">
              Displayed in Portal Masthead & Help Centre
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed m-0">
            Configure the internal institutional contact details for student enrollment coordinators, verification officers, and academic staff.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Support Phone Number
              </label>
              <div className="relative">
                <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+91 (011) 2345-6789 or 9876543210"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Direct phone line for enrollment support.
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Support Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="helpdesk@apex.edu"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Institutional support inbox.
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">
                Helpdesk Operating Hours
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supportHours}
                  onChange={(e) => setSupportHours(e.target.value)}
                  placeholder="Monday - Friday, 9:00 AM - 5:00 PM IST"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-blue-500 bg-white"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Office timings when institutional officers are available.
              </span>
            </div>
          </div>
        </Card>

        {/* Card 3: Location Details */}
        <Card rounded="2xl" className="p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 m-0">Campus Location Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. New Delhi"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">State / Union Territory</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Delhi"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Institution Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
