/**
 * Drive Integration for Assets.jsx
 *
 * Instructions:
 * 1. Add these imports at the top of Assets.jsx after existing imports
 * 2. Add state variables after existing useState declarations
 * 3. Replace loadAssetsList function
 * 4. Add new functions after loadAssetsList
 * 5. Add UI elements in the render section
 */

// ===== 1. ADD THESE IMPORTS =====
import {
  loadDriveAssets,
  uploadToDrive,
  getDriveQuota,
  isDriveEnabled,
  mergeAssets,
  formatFileSize
} from '../utils/driveAssets';
import { HardDrive, Cloud, FolderOpen } from 'lucide-react';

// ===== 2. ADD THESE STATE VARIABLES (after line 17) =====
const [storageSource, setStorageSource] = useState('both'); // 'local', 'drive', 'both'
const [driveFiles, setDriveFiles] = useState([]);
const [driveEnabled, setDriveEnabled] = useState(false);
const [driveQuota, setDriveQuota] = useState(null);
const [loadingDrive, setLoadingDrive] = useState(false);
const [showDriveInfo, setShowDriveInfo] = useState(false);

// ===== 3. REPLACE loadAssetsList FUNCTION (lines 72-76) =====
const loadAssetsList = async () => {
  try {
    // Load local assets
    const assetModules = import.meta.glob('/src/assets/*.*', { eager: true, as: 'url' });
    const localAssetList = await processAssets(assetModules);

    // Check if Drive is enabled
    const driveIsEnabled = await isDriveEnabled();
    setDriveEnabled(driveIsEnabled);

    if (driveIsEnabled && (storageSource === 'drive' || storageSource === 'both')) {
      setLoadingDrive(true);
      try {
        // Load Drive assets
        const driveData = await loadDriveAssets('assets', { pageSize: 100 });
        setDriveFiles(driveData.files);

        // Load quota info
        const quota = await getDriveQuota();
        setDriveQuota(quota);

        // Merge assets based on storage source
        const mergedAssets = mergeAssets(localAssetList, driveData.files, storageSource);
        setAssets(mergedAssets);
      } catch (error) {
        console.error('Error loading Drive assets:', error);
        // Fallback to local assets only
        setAssets(localAssetList);
      } finally {
        setLoadingDrive(false);
      }
    } else {
      // Drive not enabled or source is 'local', use local assets only
      setAssets(localAssetList);
    }
  } catch (error) {
    console.error('Error loading assets:', error);
    setAssets([]);
  }
};

// ===== 4. ADD THESE NEW FUNCTIONS AFTER loadAssetsList =====

// Handle storage source change
const handleStorageSourceChange = async (newSource) => {
  setStorageSource(newSource);

  // Reload assets with new source
  try {
    const assetModules = import.meta.glob('/src/assets/*.*', { eager: true, as: 'url' });
    const localAssetList = await processAssets(assetModules);

    if (newSource === 'local') {
      setAssets(localAssetList);
    } else if (newSource === 'drive') {
      setAssets(driveFiles);
    } else {
      const mergedAssets = mergeAssets(localAssetList, driveFiles, 'both');
      setAssets(mergedAssets);
    }
  } catch (error) {
    console.error('Error changing storage source:', error);
  }
};

// Upload to Drive instead of local
const handleUploadToDrive = async () => {
  setUploadingFiles(pendingUploads.map(u => u.originalName));

  for (const upload of pendingUploads) {
    try {
      setUploadProgress(prev => ({
        ...prev,
        [upload.originalName]: 'uploading'
      }));

      await uploadToDrive(upload.file, 'assets', upload.metadata);

      setUploadProgress(prev => ({
        ...prev,
        [upload.originalName]: 'success'
      }));
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      setUploadProgress(prev => ({
        ...prev,
        [upload.originalName]: 'error'
      }));
    }
  }

  // Reload assets
  await loadAssetsList();

  setTimeout(() => {
    setUploadingFiles([]);
    setUploadProgress({});
    setPendingUploads([]);
    setShowMetadataDialog(false);
  }, 1500);
};

// ===== 5. ADD THIS UI COMPONENT IN THE RENDER (after PageHeader) =====

{/* Storage Source Selector - Add after <PageHeader /> */}
{driveEnabled && (
  <div className="flex items-center gap-2 mb-4 px-4">
    <span className="text-sm text-gray-600">Storage:</span>
    <div className="flex gap-2">
      <button
        onClick={() => handleStorageSourceChange('local')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
          storageSource === 'local'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <HardDrive size={14} />
        Local
      </button>
      <button
        onClick={() => handleStorageSourceChange('drive')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
          storageSource === 'drive'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Cloud size={14} />
        Google Drive
        {loadingDrive && <span className="animate-spin">⟳</span>}
      </button>
      <button
        onClick={() => handleStorageSourceChange('both')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
          storageSource === 'both'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <FolderOpen size={14} />
        Both
      </button>
    </div>

    {/* Drive Info */}
    {driveQuota && (
      <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
        <Cloud size={12} />
        <span>
          {formatFileSize(driveQuota.usage)} / {formatFileSize(driveQuota.limit)}
          ({driveQuota.percentUsed}%)
        </span>
      </div>
    )}
  </div>
)}

{/* Update upload dialog to add Drive option */}
{/* In the metadata dialog, add a checkbox for Drive upload: */}
{driveEnabled && (
  <div className="flex items-center gap-2 mb-4">
    <input
      type="checkbox"
      id="uploadToDrive"
      checked={uploadToDrive}
      onChange={(e) => setUploadToDrive(e.target.checked)}
      className="rounded"
    />
    <label htmlFor="uploadToDrive" className="text-sm text-gray-700">
      <Cloud size={14} className="inline mr-1" />
      Upload to Google Drive
    </label>
  </div>
)}

{/* Update confirm button handler in metadata dialog */}
{/* Replace handleConfirmUploads with: */}
onClick={() => uploadToDrive ? handleUploadToDrive() : handleConfirmUploads()}

// ===== 6. ADD DRIVE SOURCE BADGE TO ASSET CARDS =====
{/* In the asset card rendering, add source indicator: */}
{asset.source === 'drive' && (
  <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
    <Cloud size={10} />
    Drive
  </div>
)}
