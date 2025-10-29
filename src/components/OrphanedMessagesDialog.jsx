import React from 'react';
import { AlertCircle, X, Check } from 'lucide-react';

const OrphanedMessagesDialog = ({
  show,
  orphanedMessages,
  topics,
  audiences,
  correctingMessage,
  setCorrectingMessage,
  onCorrect,
  onClose
}) => {
  if (!show || orphanedMessages.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} />
            <div>
              <h2 className="text-xl font-bold">Orphaned Messages Detected</h2>
              <p className="text-sm text-red-100">
                {orphanedMessages.length} message{orphanedMessages.length > 1 ? 's' : ''} cannot be placed in the matrix
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-700 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-auto flex-1">
          <p className="text-gray-700 mb-4">
            The following messages have invalid topic or audience keys and cannot be displayed in the matrix.
            Please correct the keys to place them properly.
          </p>

          <div className="space-y-4">
            {orphanedMessages.map((msg) => (
              <div key={msg.id} className="border border-red-300 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg text-blue-600">MC{msg.number}</span>
                      <span className="text-sm font-semibold text-gray-500">{msg.variant}</span>
                      <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">
                        {msg.missingTopic && msg.missingAudience ? 'Both keys invalid' :
                         msg.missingTopic ? 'Topic key invalid' : 'Audience key invalid'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{msg.name || 'No name'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Topic Key {msg.missingTopic && <span className="text-red-600">*</span>}
                    </label>
                    <div className="text-xs text-gray-500 mb-2">
                      Current: <span className={msg.missingTopic ? 'text-red-600 font-semibold' : 'text-gray-700'}>{msg.topic || '(empty)'}</span>
                    </div>
                    <select
                      value={correctingMessage?.id === msg.id ? correctingMessage.newTopic : msg.topic}
                      onChange={(e) => setCorrectingMessage({ id: msg.id, newTopic: e.target.value, newAudience: msg.audience })}
                      className={`w-full border rounded px-3 py-2 text-sm ${msg.missingTopic ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    >
                      <option value="">Select topic key...</option>
                      {topics.map(t => (
                        <option key={t.key} value={t.key}>
                          {t.key} - {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Audience Key {msg.missingAudience && <span className="text-red-600">*</span>}
                    </label>
                    <div className="text-xs text-gray-500 mb-2">
                      Current: <span className={msg.missingAudience ? 'text-red-600 font-semibold' : 'text-gray-700'}>{msg.audience || '(empty)'}</span>
                    </div>
                    <select
                      value={correctingMessage?.id === msg.id ? correctingMessage.newAudience : msg.audience}
                      onChange={(e) => setCorrectingMessage({
                        id: msg.id,
                        newTopic: correctingMessage?.id === msg.id ? correctingMessage.newTopic : msg.topic,
                        newAudience: e.target.value
                      })}
                      className={`w-full border rounded px-3 py-2 text-sm ${msg.missingAudience ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    >
                      <option value="">Select audience key...</option>
                      {audiences.map(a => (
                        <option key={a.key} value={a.key}>
                          {a.key} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      if (correctingMessage?.id === msg.id) {
                        onCorrect(msg, correctingMessage.newTopic, correctingMessage.newAudience);
                        setCorrectingMessage(null);
                      } else {
                        onCorrect(msg, msg.topic, msg.audience);
                      }
                    }}
                    disabled={correctingMessage?.id === msg.id && (
                      (msg.missingTopic && !correctingMessage.newTopic) ||
                      (msg.missingAudience && !correctingMessage.newAudience)
                    )}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-semibold flex items-center gap-2"
                  >
                    <Check size={16} />
                    Save Correction
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-t">
          <p className="text-sm text-gray-600">
            Correct all invalid keys to dismiss this dialog
          </p>
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

export default OrphanedMessagesDialog;
