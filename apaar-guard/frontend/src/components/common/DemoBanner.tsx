import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export const DemoBanner: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="bg-[#142B4A] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-blue-900/40">
      <div className="flex items-center space-x-2">
        <span className="bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded border border-amber-500/30 tracking-wider">
          DEMO PROTOTYPE
        </span>
        <span className="text-slate-200">
          Official verification unavailable. Local checks are not official verification.
        </span>
      </div>
      {user && (
        <div className="flex items-center space-x-3 text-slate-300 mt-1 sm:mt-0">
          <span className="flex items-center space-x-1.5">
            <span className="text-slate-400">Institution:</span>
            <span className="font-medium text-white">{user.institution?.name || `ID #${user.institution_id}`}</span>
            <span className="text-slate-400">({user.institution?.code})</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center space-x-1.5">
            <span className="text-slate-400">Persona:</span>
            <span className="font-semibold text-amber-300">
              {user.role === 'institution_admin' ? 'Institution Admin (Asha)' : 'Verification Officer (Ravi)'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};
