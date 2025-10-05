import React, { useState } from 'react'
import { Copy, FileText, Code, Palette, Zap, Database } from 'lucide-react'
import GoogleSheetsSync from './GoogleSheetsSync'

// This is where you'll paste your Claude artifact component
// Replace the PlaceholderArtifact with your actual component
const PlaceholderArtifact = () => {
  const [copied, setCopied] = useState(false)
  const [syncedData, setSyncedData] = useState(null)

  const handleDataSync = (data) => {
    setSyncedData(data)
    console.log('Synced data from Google Sheets:', data)
  }

  const handleCopyInstructions = () => {
    const instructions = `
HOW TO USE THIS REACT SKELETON:

1. Get your Claude artifact component code
2. Replace the PlaceholderArtifact component in src/components/ArtifactContainer.jsx
3. If your artifact uses any additional dependencies, install them with npm install
4. Run 'npm run dev' to start the development server

COMMON CLAUDE ARTIFACT PATTERNS:
- Most artifacts are single React components
- They often use hooks like useState, useEffect
- They frequently use Tailwind CSS for styling
- Some use libraries like Lucide React for icons

EXAMPLE REPLACEMENT:
// Replace this entire PlaceholderArtifact component with your Claude artifact
const YourArtifactComponent = () => {
  // Your artifact code goes here
  return (
    <div>Your artifact JSX</div>
  )
}

// Then update the export at the bottom:
export default YourArtifactComponent
    `

    navigator.clipboard.writeText(instructions)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="artifact-placeholder">
      <div className="max-w-4xl mx-auto p-8">
        {/* Google Sheets Integration */}
        <GoogleSheetsSync onDataSync={handleDataSync} />
        
        <div className="text-center">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-full">
              <Code size={48} className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Claude Artifact React Skeleton
          </h1>
          <p className="text-xl opacity-90 mb-8">
            Ready to receive your Claude artifact! Simply paste your component code to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 text-left">
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur">
            <FileText className="mb-3 text-blue-300" size={24} />
            <h3 className="font-semibold mb-2">Easy Setup</h3>
            <p className="text-sm opacity-90">
              Modern Vite + React setup with hot reload and fast development
            </p>
          </div>
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur">
            <Palette className="mb-3 text-green-300" size={24} />
            <h3 className="font-semibold mb-2">Tailwind Ready</h3>
            <p className="text-sm opacity-90">
              Pre-configured Tailwind CSS for beautiful, responsive designs
            </p>
          </div>
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur">
            <Zap className="mb-3 text-yellow-300" size={24} />
            <h3 className="font-semibold mb-2">Instant Preview</h3>
            <p className="text-sm opacity-90">
              See your changes instantly with fast refresh and live updates
            </p>
          </div>
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur">
            <Database className="mb-3 text-purple-300" size={24} />
            <h3 className="font-semibold mb-2">Live Sync</h3>
            <p className="text-sm opacity-90">
              Connect to Google Sheets for real-time data synchronization
            </p>
          </div>
        </div>

        <div className="bg-white/10 p-6 rounded-lg backdrop-blur mb-6">
          <h3 className="text-lg font-semibold mb-3">Quick Start Instructions</h3>
          <div className="text-left text-sm space-y-2 opacity-90">
            <p>1. <strong>Install dependencies:</strong> <code className="bg-black/20 px-2 py-1 rounded">npm install</code></p>
            <p>2. <strong>Start development:</strong> <code className="bg-black/20 px-2 py-1 rounded">npm run dev</code></p>
            <p>3. <strong>Paste your Claude artifact</strong> in <code className="bg-black/20 px-2 py-1 rounded">src/components/ArtifactContainer.jsx</code></p>
            <p>4. <strong>Watch it come to life!</strong> Your artifact will appear here instantly</p>
          </div>
        </div>

        <button
          onClick={handleCopyInstructions}
          className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg transition-colors backdrop-blur"
        >
          <Copy size={20} />
          {copied ? 'Copied!' : 'Copy Detailed Instructions'}
        </button>

        {/* Display synced data */}
        {syncedData && (
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur mb-6">
            <h3 className="text-lg font-semibold mb-3">Synced Data Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left text-sm">
              <div>
                <h4 className="font-medium mb-2">Audiences ({syncedData.audiences?.length || 0})</h4>
                <div className="space-y-1">
                  {syncedData.audiences?.slice(0, 3).map(audience => (
                    <div key={audience.id} className="bg-white/20 px-2 py-1 rounded">
                      {audience.name} ({audience.key})
                    </div>
                  ))}
                  {syncedData.audiences?.length > 3 && (
                    <div className="text-xs opacity-75">+{syncedData.audiences.length - 3} more</div>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Topics ({syncedData.topics?.length || 0})</h4>
                <div className="space-y-1">
                  {syncedData.topics?.slice(0, 3).map(topic => (
                    <div key={topic.id} className="bg-white/20 px-2 py-1 rounded">
                      {topic.name} ({topic.key})
                    </div>
                  ))}
                  {syncedData.topics?.length > 3 && (
                    <div className="text-xs opacity-75">+{syncedData.topics.length - 3} more</div>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Messages ({syncedData.messages?.length || 0})</h4>
                <div className="space-y-1">
                  {syncedData.messages?.slice(0, 3).map((message, index) => (
                    <div key={index} className="bg-white/20 px-2 py-1 rounded text-xs">
                      {message.messageId}: {message.content.substring(0, 30)}...
                    </div>
                  ))}
                  {syncedData.messages?.length > 3 && (
                    <div className="text-xs opacity-75">+{syncedData.messages.length - 3} more</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-sm opacity-75">
          <p>This skeleton includes React 18, Vite, Tailwind CSS, Lucide React icons, and Google Sheets integration</p>
        </div>
        </div>
      </div>
    </div>
  )
}

export default PlaceholderArtifact
