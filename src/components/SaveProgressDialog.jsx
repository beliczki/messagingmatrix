import React from 'react';
import { AlertCircle, Save, RefreshCw } from 'lucide-react';

const SaveProgressDialog = ({ saveProgress }) => {
  if (!saveProgress) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="mb-4">
            {saveProgress.error ? (
              <AlertCircle size={48} className="mx-auto text-red-500" />
            ) : saveProgress.step === saveProgress.total ? (
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Save size={24} className="text-green-600" />
              </div>
            ) : (
              <RefreshCw size={48} className="mx-auto text-blue-500 animate-spin" />
            )}
          </div>

          <h3 className={`text-xl font-semibold mb-2 ${
            saveProgress.error ? 'text-red-700' :
            saveProgress.step === saveProgress.total ? 'text-green-700' :
            'text-gray-800'
          }`}>
            {saveProgress.error ? 'Save Failed' :
             saveProgress.step === saveProgress.total ? 'Success!' :
             'Saving to Spreadsheet'}
          </h3>

          <p className="text-gray-600 mb-4">{saveProgress.message}</p>

          {!saveProgress.error && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(saveProgress.step / saveProgress.total) * 100}%` }}
              />
            </div>
          )}

          <p className="text-sm text-gray-500">
            {saveProgress.error ? '' : `Step ${saveProgress.step} of ${saveProgress.total}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SaveProgressDialog;
