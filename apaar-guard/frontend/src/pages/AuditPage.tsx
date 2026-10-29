import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      params.append('limit', '100');
      const data = await api.get<any[]>(`/audit?${params.toString()}`);
      setLogs(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const distinctActions = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'STUDENT_CREATED',
    'STUDENT_UPDATED',
    'STUDENT_ARCHIVED',
    'VALIDATION_BATCH_RUN',
    'BULK_IMPORT_COMPLETED',
    'REVIEW_CASE_RESOLVE',
    'REVIEW_CASE_FALSE_POSITIVE',
    'INTAKE_CONFIG_UPDATED',
    'REPORT_EXPORTED',
    'DATABASE_SEEDED'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">System Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, read-only institutional event ledger tracking all mutations, reviews, and data exports.
          </p>
        </div>
        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
          >
            <option value="">All Audit Events</option>
            {distinctActions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Security & Privacy Notice */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">Audit Integrity & Privacy Guarantee</span>
          <p className="mt-0.5 text-slate-600 m-0">
            Audit logs cannot be modified or deleted through any portal interface. In adherence to privacy guidelines, 
            passwords and unmasked APAAR IDs are strictly stripped from all logged metadata.
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Event ID</th>
                <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                <th className="px-5 py-3.5 font-semibold">Actor / Role</th>
                <th className="px-5 py-3.5 font-semibold">Action</th>
                <th className="px-5 py-3.5 font-semibold">Target</th>
                <th className="px-5 py-3.5 font-semibold">Outcome</th>
                <th className="px-5 py-3.5 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    Loading audit trail events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-xs">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      #{log.id}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <div className="font-semibold text-slate-900">{log.actor_name}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{log.actor_role.replace('_', ' ')}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">
                      <span className="font-medium">{log.target_type}</span>{' '}
                      {log.target_id && <span className="font-mono text-slate-400">({log.target_id})</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        log.outcome === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-600 max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
