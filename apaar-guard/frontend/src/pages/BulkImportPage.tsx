import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Download, 
  ShieldAlert, 
  RefreshCw,
  Check,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

const STANDARD_FIELDS = [
  { key: 'roll_number', label: 'Roll Number', required: true },
  { key: 'full_name', label: 'Student Full Name', required: true },
  { key: 'apaar_id', label: 'APAAR ID (12 Digits)', required: false },
  { key: 'course_code', label: 'Course Code (e.g. CSE)', required: true },
  { key: 'admission_year', label: 'Admission Year', required: true },
  { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD)', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'email', label: 'Email Address', required: false },
  { key: 'phone', label: 'Phone Number', required: false },
];

export const BulkImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2: Mapping
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Step 3: Validation Preview
  const [validating, setValidating] = useState(false);
  const [stagingData, setStagingData] = useState<any>(null);

  // Step 4: Options
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  // Step 5: Results
  const [committing, setCommitting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const lower = selected.name.toLowerCase();
      if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        setErrorMsg('Unsupported file format. Please upload a valid .csv, .xlsx, or .xls file.');
        setFile(null);
        return;
      }
      setFile(selected);
      setErrorMsg(null);
    }
  };

  const handleInspect = async () => {
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<any>('/import/inspect', formData);
      setFileInfo(res);
      setMapping(res.suggested_mapping || {});
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect file.');
    } finally {
      setUploading(false);
    }
  };

  const handleValidateStaging = async () => {
    if (!file) return;
    setValidating(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping_json', JSON.stringify(mapping));
      const res = await api.post<any>('/import/validate', formData);
      setStagingData(res);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation failed. Please verify column mapping.');
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!stagingData) return;
    setCommitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        filename: fileInfo.filename,
        file_hash: stagingData.file_hash,
        staged_rows: stagingData.staged_rows,
        options: {
          skip_duplicates: skipDuplicates,
          update_existing: updateExisting && confirmUpdate,
        }
      };
      const res = await api.post<any>('/import/commit', payload);
      setImportResult(res);
      setStep(5);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit import records.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Steps Indicator */}
      <div>
        <h1 className="text-2xl font-bold text-[#172033] tracking-tight">Bulk Student Import Wizard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Safely ingest, map, validate, and commit institutional student batches.
        </p>

        {/* Wizard Steps Nav */}
        <div className="mt-6 flex items-center justify-between border-b border-slate-200 pb-4">
          {[
            { num: 1, title: 'Upload File' },
            { num: 2, title: 'Column Mapping' },
            { num: 3, title: 'Pre-Commit Validation' },
            { num: 4, title: 'Import Options' },
            { num: 5, title: 'Results & Audit' },
          ].map((s) => (
            <div key={s.num} className="flex items-center space-x-2 text-xs sm:text-sm font-medium">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                step === s.num
                  ? 'bg-blue-600 text-white shadow-sm'
                  : step > s.num
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </span>
              <span className={step === s.num ? 'text-blue-900 font-semibold' : 'text-slate-500 hidden sm:inline'}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center transition bg-slate-50/50">
            <UploadCloud className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Select or Drag CSV / XLSX File</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Supported formats: .CSV, .XLSX (Max file size: 10 MB, up to 5,000 records).
            </p>

            <input
              type="file"
              id="file-upload"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-blue-600" />
              {file ? file.name : 'Browse Files on Device'}
            </label>

            {file && (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Privacy & Verification Notice */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold m-0">Verification & Privacy Notice</p>
              <p className="mt-1 text-amber-800 m-0 leading-relaxed">
                Imported APAAR IDs are checked locally for 12-digit format and duplicates.
                Local import and validation do not constitute official DigiLocker or UIDAI verification.
              </p>
            </div>
          </div>

          {/* Template Download Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200 gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Download Template:
              </span>
              <a
                href="/api/import/template?format=csv"
                download
                className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Template (CSV)
              </a>
              <span className="text-slate-300">|</span>
              <a
                href="/api/import/template?format=xlsx"
                download
                className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Template (Excel XLSX)
              </a>
            </div>

            <button
              onClick={handleInspect}
              disabled={!file || uploading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Inspecting File...
                </>
              ) : (
                <>
                  <span>Next: Column Mapping</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && fileInfo && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 m-0">Map File Columns to Student Fields</h2>
              <p className="text-xs text-slate-500 mt-1">
                Detected {fileInfo.headers.length} headers in '{fileInfo.filename}' ({fileInfo.total_rows} total rows).
              </p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-800 font-semibold px-2.5 py-1 rounded-full border border-blue-200">
              Auto-Mapping Applied
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STANDARD_FIELDS.map((field) => (
              <div key={field.key} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </span>
                  <span className="text-[11px] text-slate-400 block font-mono">{field.key}</span>
                </div>
                <div className="w-48">
                  <select
                    value={mapping[field.key] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none ${
                      field.required && !mapping[field.key]
                        ? 'border-rose-300 bg-rose-50/50 text-rose-900'
                        : 'border-slate-300 bg-white text-slate-800'
                    }`}
                  >
                    <option value="">-- Do Not Import --</option>
                    {fileInfo.headers.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* First 3 preview rows */}
          <div>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Preview First Uploaded Records
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    {fileInfo.headers.slice(0, 6).map((h: string) => (
                      <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fileInfo.sample_preview.map((row: any, idx: number) => (
                    <tr key={idx}>
                      {fileInfo.headers.slice(0, 6).map((h: string) => (
                        <td key={h} className="px-3 py-2 text-slate-700 font-mono">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <button
              onClick={handleValidateStaging}
              disabled={validating}
              className="inline-flex items-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {validating ? 'Validating Batch...' : 'Next: Preview Validation Results'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PRE-COMMIT VALIDATION */}
      {step === 3 && stagingData && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0">Pre-Commit Validation Breakdown</h2>
            <p className="text-xs text-slate-500 mt-1">
              Every row evaluated against APAAR 12-digit format, exact duplicate, and roll number rules.
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Total Rows</span>
              <span className="text-2xl font-bold text-slate-900">{stagingData.summary.total_rows}</span>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs text-emerald-700 block">Valid Rows</span>
              <span className="text-2xl font-bold text-emerald-800">{stagingData.summary.valid_count}</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-700 block">Duplicates Detected</span>
              <span className="text-2xl font-bold text-amber-800">{stagingData.summary.duplicate_count}</span>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-xs text-rose-700 block">Format/Field Errors</span>
              <span className="text-2xl font-bold text-rose-800">{stagingData.summary.invalid_count}</span>
            </div>
          </div>

          {/* Row Errors Breakdown Table */}
          {stagingData.summary.errors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Detailed Error Descriptions ({stagingData.summary.errors.length})
                </h3>
                <span className="text-xs text-rose-600 font-semibold">Plain-English Explanations</span>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-100/60 text-rose-900 border-b border-rose-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold w-20">Row #</th>
                      <th className="px-3 py-2 font-semibold">Error Explanation</th>
                      <th className="px-3 py-2 font-semibold">Identified Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {stagingData.summary.errors.map((err: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono font-bold text-rose-800">{err.row_index}</td>
                        <td className="px-3 py-2 text-rose-900">{err.error_message}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{err.raw_data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Adjust Mapping
            </button>
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
            >
              <span>Next: Import Options</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT OPTIONS */}
      {step === 4 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0">Configure Ingestion Options</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select how duplicate and invalid rows should be handled by the database transaction.
            </p>
          </div>

          <div className="space-y-4">
            {/* Option 1: Skip duplicates */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start space-x-3">
              <input
                type="checkbox"
                id="skip-dup"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300"
              />
              <div>
                <label htmlFor="skip-dup" className="text-sm font-bold text-slate-800 block cursor-pointer">
                  Skip Duplicates Safely (Recommended)
                </label>
                <p className="text-xs text-slate-500 mt-0.5 m-0">
                  Any record matching an existing APAAR ID or roll number will be skipped and logged without raising fatal transaction aborts.
                </p>
              </div>
            </div>

            {/* Option 2: Overwrite/Update existing */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="update-existing"
                  checked={updateExisting}
                  onChange={(e) => {
                    setUpdateExisting(e.target.checked);
                    if (!e.target.checked) setConfirmUpdate(false);
                  }}
                  className="mt-1 h-4 w-4 text-amber-600 rounded border-slate-300"
                />
                <div>
                  <label htmlFor="update-existing" className="text-sm font-bold text-amber-900 block cursor-pointer">
                    Update Existing Records
                  </label>
                  <p className="text-xs text-amber-800 mt-0.5 m-0">
                    Never overwrites silently. Requires explicit institutional authorization.
                  </p>
                </div>
              </div>

              {updateExisting && (
                <div className="ml-7 mt-2 p-3 bg-white rounded-lg border border-amber-300 text-xs text-amber-900 space-y-3">
                  <div className="font-semibold text-amber-950">
                    Before / After Differences Summary ({stagingData?.summary?.update_candidates?.length || 0} candidate records)
                  </div>

                  {stagingData?.summary?.update_candidates && stagingData.summary.update_candidates.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border border-amber-200 rounded-md">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-amber-100/70 text-amber-950 border-b border-amber-200">
                          <tr>
                            <th className="px-2.5 py-1.5 font-semibold">Roll Number</th>
                            <th className="px-2.5 py-1.5 font-semibold">Current Record (DB)</th>
                            <th className="px-2.5 py-1.5 font-semibold">Import File Update</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 bg-white">
                          {stagingData.summary.update_candidates.map((cand: any, idx: number) => (
                            <tr key={idx} className="hover:bg-amber-50/40">
                              <td className="px-2.5 py-1.5 font-mono font-bold text-slate-800">{cand.roll_number}</td>
                              <td className="px-2.5 py-1.5 text-slate-600">
                                <div>{cand.current_name}</div>
                                <div className="text-[10px] font-mono text-slate-400">APAAR: {cand.current_apaar || 'None'}</div>
                              </td>
                              <td className="px-2.5 py-1.5 font-medium text-amber-900">
                                <div>{cand.new_name}</div>
                                <div className="text-[10px] font-mono text-amber-700">APAAR: {cand.new_apaar || 'None'}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No existing records match roll numbers in this batch.</p>
                  )}

                  <div className="flex items-center space-x-2 pt-2 border-t border-amber-200">
                    <input
                      type="checkbox"
                      id="confirm-upd"
                      checked={confirmUpdate}
                      onChange={(e) => setConfirmUpdate(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="confirm-upd" className="font-semibold cursor-pointer">
                      I have reviewed the differences above and explicitly authorize updating existing records.
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <button
              onClick={handleCommit}
              disabled={committing || (updateExisting && !confirmUpdate)}
              className="inline-flex items-center px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {committing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Executing Transaction...
                </>
              ) : (
                <>
                  <span>Commit Import to Database</span>
                  <Check className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: RESULTS & AUDIT */}
      {step === 5 && importResult && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 text-center sm:text-left">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 m-0">Bulk Import Completed</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Job ID: <span className="font-mono font-bold text-slate-700">{importResult.job_id}</span> • Completed at {new Date(importResult.completed_at).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Total Processed</span>
              <span className="text-xl font-bold text-slate-900">{importResult.total_rows}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs text-emerald-700 block">Created</span>
              <span className="text-xl font-bold text-emerald-800">{importResult.created_rows}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-xs text-blue-700 block">Updated</span>
              <span className="text-xl font-bold text-blue-800">{importResult.updated_rows}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300">
              <span className="text-xs text-slate-600 block">Skipped</span>
              <span className="text-xl font-bold text-slate-800">{importResult.skipped_rows}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-xs text-rose-700 block">Invalid Rows</span>
              <span className="text-xl font-bold text-rose-800">{importResult.invalid_rows}</span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-200 gap-3">
            {importResult.invalid_rows > 0 ? (
              <a
                href={`/api/import/jobs/${importResult.job_id}/errors`}
                download
                className="inline-flex items-center text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg hover:bg-rose-100"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download Error Report (.CSV)
              </a>
            ) : (
              <span className="text-xs text-emerald-700 font-medium">All records ingested cleanly.</span>
            )}

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setFileInfo(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Import Another Batch
              </button>
              <button
                onClick={() => navigate('/students')}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
              >
                View Student Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
