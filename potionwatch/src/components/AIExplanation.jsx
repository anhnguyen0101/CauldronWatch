import React, { useState, useEffect } from 'react'
import { X, HelpCircle, Loader2 } from 'lucide-react'
import { fetchAIExplanation } from '../services/api'

export default function AIExplanation({ 
  componentName, 
  data, 
  isOpen, 
  onClose 
}) {
  const [explanation, setExplanation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchExplanation = async () => {
    if (!data) {
      setError('No data available for explanation')
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAIExplanation(componentName, data)
      setExplanation(result)
    } catch (err) {
      console.error('Error fetching AI explanation:', err)
      setError('Failed to load explanation')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && data) {
      fetchExplanation()
    } else {
      // Reset when closed
      setExplanation(null)
      setError(null)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, componentName])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold">AI Explanation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-800 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
              <p className="text-sm text-gray-400">AI is analyzing this component...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">
              <p>{error}</p>
              <button
                onClick={fetchExplanation}
                className="mt-4 px-4 py-2 bg-accent hover:bg-accent/80 rounded-md text-white text-sm"
              >
                Retry
              </button>
            </div>
          ) : explanation ? (
            <div className="space-y-4">
              <div className="bg-neutral-800/40 rounded-lg p-4 border border-neutral-700">
                <h4 className="text-sm font-semibold mb-2 text-accent">What This Shows</h4>
                <p className="text-sm leading-relaxed text-gray-300">
                  {explanation.main_idea}
                </p>
              </div>

              {explanation.key_points && explanation.key_points.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Key Points</h4>
                  <ul className="space-y-2">
                    {explanation.key_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-accent mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {explanation.examples && explanation.examples.length > 0 && (
                <div className="bg-neutral-800/30 rounded-lg p-4 border border-neutral-700">
                  <h4 className="text-sm font-semibold mb-3 text-accent">Live Examples from Your Data</h4>
                  <div className="space-y-3">
                    {explanation.examples.map((example, i) => (
                      <div key={i} className="bg-neutral-900/50 rounded-md p-3 border-l-2 border-accent/50">
                        {example.title && (
                          <div className="font-medium text-white text-sm mb-1">{example.title}</div>
                        )}
                        <div className="text-sm text-gray-300 leading-relaxed">
                          {example.description}
                        </div>
                        {example.data && (
                          <div className="mt-2 text-xs text-gray-400 font-mono bg-neutral-900/50 p-2 rounded">
                            {typeof example.data === 'string' ? example.data : JSON.stringify(example.data, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanation.how_to_read && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">How to Read This</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {explanation.how_to_read}
                  </p>
                </div>
              )}

              {explanation.what_to_look_for && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">What to Look For</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {explanation.what_to_look_for}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// Helper component for the question mark icon button
export function AIHelpButton({ componentName, data, className = "", iconSize = "w-4 h-4" }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-1.5 rounded-md hover:bg-neutral-800/60 text-gray-400 hover:text-accent transition-colors ${className}`}
        title="Get AI explanation"
        aria-label="Get AI explanation"
      >
        <HelpCircle className={iconSize} />
      </button>
      <AIExplanation
        componentName={componentName}
        data={data}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

