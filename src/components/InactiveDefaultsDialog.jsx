import React, { useMemo } from 'react';
import { AlertCircle, X, Check, Trash2 } from 'lucide-react';
import { generatePMMID } from '../utils/patternEvaluator';
import settings from '../services/settings';

const INACTIVE_STATUSES = ['INACTIVE', 'DEAD', 'ERROR'];

const InactiveDefaultsDialog = ({
  show,
  defaultPMMIDMap,
  messages,
  audiences,
  onSelectNewDefault,
  onRemoveDefault,
  onClose
}) => {
  // Find defaults whose message status is now inactive
  const inactiveDefaults = useMemo(() => {
    if (!show || !defaultPMMIDMap || !messages?.length) return [];

    const results = [];
    const pmmidPattern = settings.getPattern('pmmid');

    for (const [nv, msgId] of Object.entries(defaultPMMIDMap)) {
      const msg = messages.find(m => String(m.id) === msgId && m.status !== 'deleted');

      // Message no longer exists or was deleted
      if (!msg) {
        // Try to parse number+variant from the key to find alternatives
        const nvMatch = nv.match(/^(\d+)(.*)$/);
        const number = nvMatch ? parseInt(nvMatch[1], 10) : null;
        const variant = nvMatch ? nvMatch[2] || 'a' : null;

        const alternatives = number != null ? messages.filter(m =>
          m.number === number &&
          (m.variant || 'a') === variant &&
          m.status !== 'deleted' &&
          !INACTIVE_STATUSES.includes((m.status || 'INCOMING').toUpperCase())
        ) : [];

        results.push({
          numberVariant: nv,
          msgId,
          number: number || '?',
          variant: variant || '',
          status: 'DELETED',
          pmmid: '(not found)',
          alternatives
        });
        continue;
      }

      const status = (msg.status || 'INCOMING').toUpperCase();
      if (!INACTIVE_STATUSES.includes(status)) continue;

      const pmmid = generatePMMID(msg, audiences, pmmidPattern);

      // Find other versions of the same number+variant that could become the new default
      const alternatives = messages.filter(m =>
        String(m.id) !== msgId &&
        m.number === msg.number &&
        m.variant === msg.variant &&
        m.status !== 'deleted' &&
        !INACTIVE_STATUSES.includes((m.status || 'INCOMING').toUpperCase())
      );

      results.push({
        numberVariant: nv,
        msgId,
        number: msg.number,
        variant: msg.variant,
        status,
        pmmid,
        alternatives
      });
    }

    return results;
  }, [show, defaultPMMIDMap, messages, audiences]);

  if (!show || inactiveDefaults.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} />
            <div>
              <h2 className="text-xl font-bold">Inactive Default Messages</h2>
              <p className="text-sm text-amber-100">
                {inactiveDefaults.length} default{inactiveDefaults.length > 1 ? 's' : ''} changed status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-amber-700 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-auto flex-1">
          <div className="space-y-4">
            {inactiveDefaults.map((item) => (
              <div key={item.numberVariant} className="border border-amber-300 rounded-lg p-4 bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg text-blue-600">MC{item.number}{item.variant}</span>
                  <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded font-semibold">
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono mb-3">{item.pmmid}</p>

                {item.alternatives.length > 0 ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select a new default:
                    </label>
                    <div className="space-y-2">
                      {item.alternatives.map(alt => {
                        const altPmmid = generatePMMID(alt, audiences, settings.getPattern('pmmid'));
                        const altAudience = audiences.find(a => a.key === alt.audience);
                        return (
                          <div key={alt.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
                            <div>
                              <span className="text-sm font-medium">{altAudience?.name || alt.audience}</span>
                              <span className="text-xs text-gray-500 ml-2">({(alt.status || 'INCOMING').toUpperCase()})</span>
                              <p className="text-xs text-gray-400 font-mono">{altPmmid}</p>
                            </div>
                            <button
                              onClick={() => onSelectNewDefault(alt)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-semibold flex items-center gap-1"
                            >
                              <Check size={14} />
                              Set Default
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No active versions available.</p>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => onRemoveDefault(item.numberVariant)}
                    className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Remove Default
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 px-6 py-4 flex justify-end border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
          >
            Close for Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactiveDefaultsDialog;
