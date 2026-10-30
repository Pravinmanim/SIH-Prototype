import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Eye, 
  Copy, 
  Check, 
  RotateCcw,
  FileCode,
  Calendar,
  User as UserIcon,
  Globe,
  Tag,
  Target
} from 'lucide-react';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';

interface AuditLogItem {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditApiResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Examine Modal / Drawer state
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch paginated audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      if (actionFilter) params.append('action', actionFilter);
      if (outcomeFilter) params.append('outcome', outcomeFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get<AuditApiResponse | AuditLogItem[]>(`/audit?${params.toString()}`);
      
      if (Array.isArray(res)) {
        setLogs(res);
        setTotal(res.length);
        setTotalPages(Math.ceil(res.length / pageSize) || 1);
      } else {
        setLogs(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.total_pages || 1);
      }
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, outcomeFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle copy audit details
  const handleCopyDetails = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearFilters = () => {
    setActionFilter('');
    setOutcomeFilter('');
    setSearch('');
    setPage(1);
  };

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

  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Page Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] tracking-tight">System Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, read-only institutional event ledger tracking all student mutations, reviews, and exports.
          </p>
        </div>
      </div>

      {/* Security & Immutability Notice */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block text-blue-950">Audit Integrity & Privacy Guarantee</span>
          <p className="mt-0.5 text-blue-800 m-0 leading-relaxed">
            Audit logs cannot be altered, purged, or deleted through any portal interface. In adherence to privacy guidelines, 
            passwords, session secrets, and unmasked APAAR IDs are strictly stripped from all logged metadata.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <Card rounded="2xl" className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by actor, action, target, or details..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Action Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white font-medium text-slate-700 hover:border-slate-400 transition"
            >
              <option value="">All Actions</option>
              {distinctActions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Outcome Filter */}
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white font-medium text-slate-700 hover:border-slate-400 transition"
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">SUCCESS Only</option>
              <option value="FAILURE">FAILURE Only</option>
            </select>

            {/* Reset Filters */}
            {(actionFilter || outcomeFilter || search) && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Logs Table Card */}
      <Card rounded="2xl" className="overflow-hidden border border-slate-200/80 shadow-xs">
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
                <th className="px-5 py-3.5 font-semibold text-right">Examine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-xs">
                    Loading audit trail events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500 text-xs">
                    No audit records match the current filter or search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-500">
                      #{log.id}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {log.actor_name}
                      </div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        {log.actor_role.replace('_', ' ')}
                      </div>
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
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        log.outcome === 'SUCCESS' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-600 max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                        title="Examine full audit record"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Examine</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1 bg-white outline-none font-medium text-slate-700"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400 ml-2">
              Showing {startIndex} - {endIndex} of {total} events
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-medium text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* EXAMINE ROW DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setSelectedLog(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900 m-0">Audit Event #{selectedLog.id}</h2>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedLog.outcome === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {selectedLog.outcome}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(selectedLog.created_at).toUTCString()} ({new Date(selectedLog.created_at).toLocaleString()})
                </p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Immutability & Compliance Ribbon */}
            <div className="p-4 bg-blue-50 border-b border-blue-200/80 text-blue-900 text-xs flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold m-0 text-blue-950">Verified Institutional Ledger Record</p>
                <p className="mt-0.5 text-blue-800 m-0 leading-relaxed">
                  Cryptographically immutable entry. Recorded synchronously during transaction execution.
                </p>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Actor & Execution Context */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  Actor & Origin Context
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">Actor Name</span>
                    <span className="font-semibold text-slate-900">{selectedLog.actor_name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Role</span>
                    <span className="font-medium text-slate-800 capitalize">{selectedLog.actor_role.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">IP Address</span>
                    <span className="font-mono text-xs text-slate-700 flex items-center gap-1 mt-0.5">
                      <Globe className="w-3 h-3 text-slate-400" />
                      {selectedLog.ip_address || 'Internal Service / Localhost'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">System Timestamp</span>
                    <span className="font-mono text-xs text-slate-700 block mt-0.5">
                      {selectedLog.created_at}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action & Target Scope */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  Action & Target Scope
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">Action Performed</span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900 inline-block mt-1">
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Target Type</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1 mt-1">
                      <Target className="w-3.5 h-3.5 text-slate-400" />
                      {selectedLog.target_type}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500 block">Target Entity ID</span>
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {selectedLog.target_id ? selectedLog.target_id : 'System-wide / Batch Scope'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Payload & Change Details */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 m-0">
                    <FileCode className="w-3.5 h-3.5 text-slate-400" />
                    Recorded Event Payload
                  </h3>
                  {selectedLog.details && (
                    <button
                      onClick={() => handleCopyDetails(selectedLog.details || '')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Payload</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                  {selectedLog.details || 'No additional text metadata logged for this event.'}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                APAAR GUARD • Immutable Institutional Audit Log
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
