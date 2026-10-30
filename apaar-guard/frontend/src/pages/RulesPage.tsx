import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Sparkles
} from 'lucide-react';
import { Card } from '../components/ui/Card';

export const RulesPage: React.FC = () => {
  const [testApaar, setTestApaar] = useState('');
  const [testResult, setTestResult] = useState<{ valid: boolean; reason: string } | null>(null);

  const handleTestApaar = () => {
    const val = testApaar.trim();
    if (!val) {
      setTestResult({ valid: false, reason: 'Identifier cannot be empty.' });
      return;
    }
    if (!/^\d{12}$/.test(val)) {
      setTestResult({ 
        valid: false, 
        reason: 'APAAR ID must contain exactly 12 numeric digits (no letters, spaces, or special characters).' 
      });
      return;
    }
    setTestResult({ 
      valid: true, 
      reason: 'Valid 12-digit numeric structure. (Note: Format validity does not constitute official UIDAI/DigiLocker verification).' 
    });
  };

  const rules = [
    {
      id: "RULE-01",
      name: "APAAR ID 12-Digit Format Validation",
      category: "Identifier Structure",
      description: "Every APAAR ID must consist of exactly 12 numeric digits. Leading zeros are permitted. Letters, spaces, hyphens, and symbols are rejected.",
      examples: {
        valid: ["123456789012", "001234567890"],
        invalid: ["12345678901", "1234-5678-9012", "12345678901A"]
      },
      severity: "Strict Error (Blocks Ready Status)"
    },
    {
      id: "RULE-02",
      name: "Exact Duplicate APAAR Detection",
      category: "Duplicate Prevention",
      description: "No two active student records within the same institution may possess the identical non-empty 12-digit APAAR ID.",
      examples: {
        valid: ["Distinct APAAR ID per student", "Empty APAAR ID for newly enrolled without ID"],
        invalid: ["Student A and Student B sharing 987654321098"]
      },
      severity: "Duplicate Alert (Routes to Human Review)"
    },
    {
      id: "RULE-03",
      name: "Institutional Roll Number Uniqueness",
      category: "Institutional Uniqueness",
      description: "Student roll numbers must be strictly unique within the same institution. Cross-institutional duplicates are permitted (institution isolation).",
      examples: {
        valid: ["Unique roll number within college (e.g. 2024-CSE-001)"],
        invalid: ["Two students registered under 2024-CSE-001 in same institution"]
      },
      severity: "Strict Error (Blocks Creation)"
    },
    {
      id: "RULE-04",
      name: "Indian Mobile Number Validation",
      category: "Contact Validation",
      description: "Optional student phone numbers, when provided, must contain exactly 10 digits and begin with 6, 7, 8, or 9.",
      examples: {
        valid: ["9876543210", "8123456789", "7000111222", "6999888777"],
        invalid: ["1234567890", "987654321", "98765432101"]
      },
      severity: "Format Error (Field-level Rejection)"
    },
    {
      id: "RULE-05",
      name: "Student Name Standards",
      category: "Data Hygiene",
      description: "Student names must contain only alphabetical characters, spaces, dots (for initials), or hyphens. Minimum 2 characters, maximum 100 characters.",
      examples: {
        valid: ["Asha Sharma", "R. K. Narayan", "Mary-Jane Watson"],
        invalid: ["John123", "User#@!", "A"]
      },
      severity: "Field-level Error"
    },
    {
      id: "RULE-06",
      name: "AICTE Intake Quota Monitoring",
      category: "Institutional Compliance",
      description: "Active enrollment within a course and admission year is monitored against the approved AICTE quota. Flags alerts at 85% and blocks/warns at 100%.",
      examples: {
        valid: ["Enrollment: 55 / 60 (91.6% — Warning)", "Enrollment: 40 / 60 (Normal)"],
        invalid: ["Enrollment: 65 / 60 (108.3% — Capacity Exceeded)"]
      },
      severity: "Capacity Warning & Executive Notice"
    }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Algorithmic Validation Specifications</span>
        </div>
        <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Institutional Validation Rules Matrix</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete breakdown of client-side and server-side data quality rules enforced across APAAR GUARD.
        </p>
      </div>

      {/* Mandatory Regulatory Verification Boundary Notice */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-xs text-amber-950 block">CRITICAL VERIFICATION BOUNDARY</span>
          <p className="mt-1 text-[11px] text-amber-800 leading-relaxed m-0">
            Local format and duplicate checks are strictly verification-support tooling. Validating 12-digit numeric structure 
            does not establish student identity, authenticate civil registry records, or replace statutory DigiLocker/UIDAI verification mechanisms.
          </p>
        </div>
      </div>

      {/* Interactive Rule Tester Card */}
      <Card rounded="2xl" className="p-6 bg-gradient-to-r from-blue-50/50 to-white border-blue-200/60">
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900 m-0">Interactive APAAR Format Tester</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Test an identifier string against APAAR GUARD's 12-digit numeric format validation rule.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="text"
            value={testApaar}
            onChange={(e) => setTestApaar(e.target.value)}
            placeholder="Enter 12-digit identifier (e.g. 123456789012)..."
            className="flex-1 px-4 py-2.5 text-xs font-mono border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white"
          />
          <button
            onClick={handleTestApaar}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            Validate Format
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-3.5 rounded-xl text-xs flex items-start space-x-2.5 ${
            testResult.valid
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}>
            {testResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold m-0">{testResult.valid ? 'Format Passed' : 'Format Rejected'}</p>
              <p className="mt-0.5 m-0 leading-relaxed text-[11px]">{testResult.reason}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Rules Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} rounded="2xl" className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {rule.id}
                </span>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {rule.category}
                </span>
              </div>

              <h3 className="font-bold text-sm text-slate-900 m-0">{rule.name}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {rule.description}
              </p>

              {/* Examples */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Valid Patterns
                  </span>
                  {rule.examples.valid.map((ex, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-emerald-900 font-mono text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{ex}</span>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block mb-1">
                    Rejected Patterns
                  </span>
                  {rule.examples.invalid.map((ex, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-rose-900 font-mono text-[11px]">
                      <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Outcome Severity</span>
              <span className="font-semibold text-slate-700">{rule.severity}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
