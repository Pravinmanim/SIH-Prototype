import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  ShieldCheck, 
  Copy, 
  BarChart3, 
  Building2, 
  Users, 
  Sliders, 
  FileSpreadsheet, 
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';

export const ToolsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-2">
          <Wrench className="w-3.5 h-3.5" />
          <span>Institutional Utilities Hub</span>
        </div>
        <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Institutional Tools & Utilities</h1>
        <p className="text-sm text-slate-500 mt-1">
          Direct access to student data quality inspection, institutional configuration, and administrative controls.
        </p>
      </div>

      {/* 1. DATA TOOLS SECTION */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900 m-0">Data Integrity & Quality Tools</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Validation Rules Viewer */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Validation Rules Viewer</h3>
              <p className="text-xs text-slate-500 mt-1">
                Inspect institutional formatting algorithms, APAAR 12-digit checks, and heuristic rules.
              </p>
            </div>
            <button
              onClick={() => navigate('/rules')}
              className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
            >
              Inspect Rules Matrix <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Card>

          {/* Duplicate Detection Overview */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <Copy className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Duplicate Detection</h3>
              <p className="text-xs text-slate-500 mt-1">
                Filter and review active duplicate alerts, matching APAAR IDs, and identical roll numbers.
              </p>
            </div>
            <button
              onClick={() => navigate('/students?status=De-Duplicated')}
              className="mt-4 text-xs font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 cursor-pointer"
            >
              View Duplicates Queue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Card>

          {/* Import Template Generator */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Import Templates</h3>
              <p className="text-xs text-slate-500 mt-1">
                Download verified Excel and CSV sample files compliant with database column schemas.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <a
                href="/api/import/template?format=csv"
                download
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                CSV
              </a>
              <span className="text-slate-300">|</span>
              <a
                href="/api/import/template?format=xlsx"
                download
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Excel (.xlsx)
              </a>
            </div>
          </Card>

          {/* Data Quality Reports */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Data Quality Summary</h3>
              <p className="text-xs text-slate-500 mt-1">
                Generate formatted institutional summaries across courses, error rates, and intake utilization.
              </p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="mt-4 text-xs font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer"
            >
              Open Reports Hub <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Card>
        </div>
      </div>

      {/* 2. INSTITUTION TOOLS SECTION */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900 m-0">Institution Profile & Capacity Tools</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Institution Settings & Support */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">Institution Profile & Helpdesk</h3>
              <p className="text-xs text-slate-500 mt-1">
                Manage contact phone number, official support email, and helpdesk office hours for this institution.
              </p>
            </div>
            {isAdmin ? (
              <button
                onClick={() => navigate('/settings')}
                className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
              >
                Configure Support Info <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="mt-4 text-xs text-slate-400 font-medium">
                Admin configuration only
              </span>
            )}
          </Card>

          {/* Intake Monitoring Quotas */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 m-0">AICTE Intake Quota Manager</h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure and audit approved enrollment capacity caps by course code and academic batch year.
              </p>
            </div>
            <button
              onClick={() => navigate('/intake')}
              className="mt-4 text-xs font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 cursor-pointer"
            >
              Manage Quotas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Card>

          {/* Academic Batch Management */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between border-slate-200/60 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
                  Active in Intake
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-800 m-0">Academic Year Management</h3>
              <p className="text-xs text-slate-500 mt-1">
                Batches are tracked automatically per admission year (2024, 2025, 2026) within intake configurations.
              </p>
            </div>
            <button
              onClick={() => navigate('/intake')}
              className="mt-4 text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
            >
              View Intake Batches <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Card>
        </div>
      </div>

      {/* 3. ADMINISTRATION TOOLS SECTION */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Users className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900 m-0">Administration & Governance Tools</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Roles & Permissions Matrix */}
          <Card rounded="2xl" className="p-5">
            <h3 className="font-bold text-sm text-slate-900 m-0 mb-3">Role & Permission Boundary Matrix</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="font-bold text-blue-900 block">Institution Administrator</span>
                <p className="text-blue-800 text-[11px] mt-0.5 m-0">
                  Full rights to create, update, archive student records, perform bulk imports, configure AICTE quotas, and reveal masked APAAR IDs with audit logging.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100">
                <span className="font-bold text-teal-900 block">Verification Officer</span>
                <p className="text-teal-800 text-[11px] mt-0.5 m-0">
                  Review determination rights over flagged review cases, read-only directory view, and export permissions. Cannot import batches or alter institutional quotas.
                </p>
              </div>
            </div>
          </Card>

          {/* Audit Ledger Guarantee */}
          <Card rounded="2xl" className="p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 m-0 mb-2">Immutable Audit Ledger</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every mutation, review case determination, bulk import, report export, and intake reconfiguration is written synchronously to an immutable audit trail.
              </p>
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Passwords and unmasked IDs strictly stripped</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Zero frontend or portal edit/delete endpoints</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/audit')}
              className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
            >
              Open Audit Ledger <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};
