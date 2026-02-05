import { useEffect, useState, useRef, useCallback } from 'react'
import CornerstoneViewport from './CornerstoneViewport'
import MPRViewer from './MPRViewer'
import MPRViewerCornerstone from './MPRViewerCornerstone'
import ThreeDRenderViewer from './ThreeDRenderViewer'
import ScoutViewer from './ScoutViewer'
import DICOMViewer from './DICOMViewer'
import FilmingViewer from './FilmingViewer'
import { useDataContext } from '../contexts/DataContext'
import { useFrontendDicomContext } from '../contexts/FrontendDicomContext'
import { generateCineFrames } from '../utils/frontendCineGenerator'

interface ScanState {
  isScanning: boolean
  currentSlice: number
  totalSlices: number
}

interface PlanningData {
  z_pixel_start: number
  z_pixel_end: number
  scout_height_px: number
  fov: { x_min: number; x_max: number; y_min: number; y_max: number }
}

interface ImageDisplayAreaProps {
  caseId: string
  activeTab: 'EXAMINATION' | 'VIEWING' | 'FILMING'
  scoutRefreshToken?: number
  scanState?: ScanState
  isPlanningActive?: boolean
  onPlanningDataReady?: (data: PlanningData) => void
  reconRefreshToken?: number
  onScanComplete?: () => void
}

const ImageDisplayArea = ({ 
  caseId,
  activeTab, 
  scoutRefreshToken, 
  scanState, 
  isPlanningActive, 
  onPlanningDataReady,
  reconRefreshToken,
  onScanComplete
}: ImageDisplayAreaProps) => {
  const { getScoutSummary, getCine, cine } = useDataContext()
  const { mode, volume, metadata: frontendMetadata } = useFrontendDicomContext()
  const [scoutSummary, setScoutSummary] = useState<any>(null)
  const [showCine, setShowCine] = useState(false)
  const [viewerSubTab, setViewerSubTab] = useState<'dicom' | 'mpr' | '3d'>('dicom')
  
  // Cine animation state - use cached frames if available
  const [cineFrames, setCineFrames] = useState<string[]>([])
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [cineFps, setCineFps] = useState(30) // Fast playback: 30 FPS
  const [loadingCine, setLoadingCine] = useState(false)
  const [cineError, setCineError] = useState<string | null>(null)
  const animationRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scanPlaybackJustCompletedRef = useRef(false) // Track if scan playback just completed
  const showingFirstSliceAfterScanRef = useRef(false) // Track if showing first slice after scan complete
  
  
  // Initialize audio element
  useEffect(() => {
    // Create audio element
    const audio = new Audio('/1768289866276212.m4a')
    audio.loop = false // Don't loop - play once for the duration
    audio.volume = 0.5 // Set volume to 50%
    audio.preload = 'auto' // Preload audio
    
    // Add event listeners for debugging
    audio.addEventListener('loadstart', () => {
      console.log('[Audio] Load started')
    })
    audio.addEventListener('canplay', () => {
      console.log('[Audio] Can play')
    })
    audio.addEventListener('canplaythrough', () => {
      console.log('[Audio] Can play through')
    })
    audio.addEventListener('play', () => {
      console.log('[Audio] Playing')
    })
    audio.addEventListener('pause', () => {
      console.log('[Audio] Paused')
    })
    audio.addEventListener('error', (e) => {
      console.error('[Audio] Error:', e)
    })
    
    audioRef.current = audio
    
    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Load cine frames from backend or frontend (uses cached data from context)
  // forceRefresh=true will reload reconstructed cine from backend
  const loadCineFrames = useCallback(async (forceRefresh: boolean = false) => {
    setLoadingCine(true)
    setCineError(null)
    
    try {
      // Check mode: frontend or backend
      if (mode === 'frontend' && volume && frontendMetadata) {
        // Generate cine from frontend volume
        console.log('[ImageDisplayArea] Generating cine from frontend volume')
        const cineData = await generateCineFrames(
          volume,
          frontendMetadata.window.center,
          frontendMetadata.window.width,
          10 // fps
        )
        setCineFrames(cineData.frames)
        setCineFps(cineData.fps)
        console.log(`[ImageDisplayArea] Frontend cine generated: ${cineData.frames.length} frames at ${cineData.fps} fps`)
      } else {
        // Use backend API (existing behavior)
        if (!caseId) {
          setLoadingCine(false)
          return
        }
        
        // Check if already cached (skip cache if forceRefresh)
        if (!forceRefresh) {
          const cached = cine.get(caseId)
          if (cached && cached.frames.length > 0) {
            console.log(`[ImageDisplayArea] Using cached cine for ${caseId}`)
            setCineFrames(cached.frames)
            setCineFps(cached.fps)
            setLoadingCine(false)
            return
          }
        }
        
        console.log(`Loading cine frames for case: ${caseId} (forceRefresh=${forceRefresh})`)
        // forceRefresh=true will get fresh reconstructed cine from backend
        const cineData = await getCine(caseId, forceRefresh)
        
        if (cineData && cineData.frames && cineData.frames.length > 0) {
          setCineFrames(cineData.frames)
          setCineFps(cineData.fps)
          console.log(`Loaded ${cineData.frames.length} cine frames at ${cineData.fps} fps`)
        } else {
          setCineError('No frames available')
        }
      }
    } catch (e: any) {
      console.error('Failed to load cine frames:', e)
      setCineError(e?.message || 'Failed to load cine frames')
    } finally {
      setLoadingCine(false)
    }
  }, [caseId, getCine, cine, mode, volume, frontendMetadata])

  // Reset cine frames when caseId changes or mode/volume changes
  useEffect(() => {
    console.log(`[ImageDisplayArea] Case/mode changed: caseId=${caseId}, mode=${mode}`)
    // Clear previous frames
    setCineFrames([])
    setCurrentFrameIndex(0)
    setCineError(null)
    setShowCine(false)
    
    // Stop any running animation
    if (animationRef.current) {
      clearInterval(animationRef.current)
      animationRef.current = null
    }
    
    // Stop sound if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    
    // Load new frames
    if (mode === 'frontend' && volume) {
      // Frontend mode: generate cine frames
      loadCineFrames()
    } else if (caseId) {
      // Backend mode: load from cache or API
      const cached = cine.get(caseId)
      if (cached && cached.frames.length > 0) {
        console.log(`[ImageDisplayArea] Loading cached cine for ${caseId}`)
        setCineFrames(cached.frames)
        setCineFps(cached.fps)
      }
    }
  }, [caseId, cine, mode, volume, loadCineFrames])

  // Load scout summary when Scout Scan button is clicked (uses cached data)
  const loadScoutSummary = async () => {
    try {
      console.log('Loading scout summary for case:', caseId)
      const response = await getScoutSummary(caseId, 'frontal')
      console.log('Scout summary loaded:', response)
      // scout_summary is an array, get first item
      if (response?.scout_summary && response.scout_summary.length > 0) {
        setScoutSummary(response.scout_summary[0])
      } else {
        setScoutSummary(null)
      }
    } catch (e) {
      console.error('Failed to fetch scout summary', e)
      setScoutSummary(null)
    }
  }

  useEffect(() => {
    if (scoutRefreshToken && scoutRefreshToken > 0) {
      loadScoutSummary()
    }
  }, [scoutRefreshToken, caseId])

  // Track when scanning starts to show cine animation
  const scanStartedRef = useRef(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const prevScanningRef = useRef(false) // Track previous scanning state
  const soundPlayedRef = useRef(false) // Track if sound was already played for this scan
  const cineStoppedByTabSwitchRef = useRef(false) // Track if cine was stopped due to tab switch
  const prevTabRef = useRef<string>(activeTab) // Track previous tab
  
  // Start/stop cine animation based on scan state (only in EXAMINATION tab)
  useEffect(() => {
    const wasScanning = prevScanningRef.current
    const isScanning = scanState?.isScanning || false
    const scanJustStarted = !wasScanning && isScanning // Transition from false to true
    const scanJustStopped = wasScanning && !isScanning // Transition from true to false
    const tabChanged = prevTabRef.current !== activeTab
    const switchedToExamination = tabChanged && activeTab === 'EXAMINATION' && prevTabRef.current !== 'EXAMINATION'
    const switchedAwayFromExamination = tabChanged && prevTabRef.current === 'EXAMINATION' && activeTab !== 'EXAMINATION'
    
    // Update previous state
    prevScanningRef.current = isScanning
    prevTabRef.current = activeTab
    
    // CRITICAL: Stop everything immediately if not in EXAMINATION tab
    if (activeTab !== 'EXAMINATION') {
      console.log('[ImageDisplayArea] Not in EXAMINATION tab - stopping everything')
      // Stop sound immediately
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      // Hide cine immediately
      if (showCine) {
        setShowCine(false)
      }
      // Stop animation immediately
      if (animationRef.current) {
        clearInterval(animationRef.current)
        animationRef.current = null
      }
      // Mark that cine was stopped due to tab switch
      if (switchedAwayFromExamination) {
        cineStoppedByTabSwitchRef.current = true
        console.log('[ImageDisplayArea] Cine stopped due to tab switch - will not auto-play')
      }
      // Reset flags
      scanStartedRef.current = false
      if (!isScanning) {
        soundPlayedRef.current = false
      }
      return
    }
    
    // If switching back to EXAMINATION tab and cine was stopped by tab switch: restore 1st slice (no auto-play)
    if (switchedToExamination && cineStoppedByTabSwitchRef.current) {
      console.log('[ImageDisplayArea] Switched back to EXAMINATION tab - restoring 1st slice (no auto-play)')
      // Restore 1st slice view when returning, so user sees the same frame as after cine playback
      if (cineFrames.length > 0 && !isScanning) {
        setShowCine(true)
        setCurrentFrameIndex(0)
      }
      if (!isScanning) {
        cineStoppedByTabSwitchRef.current = false
      }
      return
    }
    
    // Start cine/sound when scan starts (only if in EXAMINATION tab and not stopped by tab switch)
    if (scanJustStarted && activeTab === 'EXAMINATION' && !cineStoppedByTabSwitchRef.current) {
      console.log('[ImageDisplayArea] Scan started - preparing cine playback')
      scanStartedRef.current = true
      soundPlayedRef.current = false // Reset sound flag
      cineStoppedByTabSwitchRef.current = false // Reset tab switch flag on new scan
      showingFirstSliceAfterScanRef.current = false // Reset - new scan starting
      scanPlaybackJustCompletedRef.current = false // Reset
      setCurrentFrameIndex(0) // Always start from first frame
      
      // Clear any existing hide timer
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      
      // Load frames FIRST, then show cine and start animation
      if (mode === 'frontend' && volume && cineFrames.length > 0) {
        // Frontend mode: use already loaded frames
        console.log(`[ImageDisplayArea] Using frontend cine: ${cineFrames.length} frames`)
        setShowCine(true)
        
        // Play sound when scan starts (only once per scan)
        if (audioRef.current && !soundPlayedRef.current) {
          console.log('[ImageDisplayArea] Attempting to play audio')
          const playAudio = () => {
            if (!audioRef.current) return
            
            audioRef.current.currentTime = 0 // Reset to start
            audioRef.current.play()
              .then(() => {
                console.log('[ImageDisplayArea] Audio playing successfully')
                soundPlayedRef.current = true
              })
              .catch(err => {
                console.error('[ImageDisplayArea] Failed to play audio:', err)
                // Try to play again after a short delay (browser autoplay policy might block first attempt)
                setTimeout(() => {
                  if (audioRef.current && isScanning) {
                    audioRef.current.currentTime = 0
                    audioRef.current.play()
                      .then(() => {
                        console.log('[ImageDisplayArea] Audio playing on retry')
                        soundPlayedRef.current = true
                      })
                      .catch(err2 => {
                        console.error('[ImageDisplayArea] Audio retry failed:', err2)
                        console.warn('[ImageDisplayArea] Browser may be blocking autoplay. User interaction required.')
                      })
                  }
                }, 200)
              })
          }
          
          // Check if audio is ready
          if (audioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            playAudio()
          } else {
            // Wait for audio to be ready
            console.log('[ImageDisplayArea] Audio not ready, waiting...')
            const onCanPlay = () => {
              if (audioRef.current && isScanning && !soundPlayedRef.current) {
                playAudio()
              }
            }
            audioRef.current.addEventListener('canplay', onCanPlay, { once: true })
            audioRef.current.load() // Force load
          }
        }
      } else if (mode !== 'frontend') {
        // Backend mode: ALWAYS load fresh reconstructed cine when scan starts
        console.log(`[ImageDisplayArea] Loading fresh RECONSTRUCTED cine for scan...`)
        loadCineFrames(true).then(() => {
          const freshCine = cine.get(caseId)
          if (freshCine && freshCine.frames.length > 0 && isScanning) {
            console.log(`[ImageDisplayArea] Reconstructed cine loaded: ${freshCine.frames.length} frames`)
            setCineFrames(freshCine.frames)
            setCineFps(freshCine.fps)
            setShowCine(true)
            
            // Play sound when scan starts (only once per scan)
            if (audioRef.current && !soundPlayedRef.current) {
              console.log('[ImageDisplayArea] Attempting to play audio')
              audioRef.current.currentTime = 0
              audioRef.current.play()
                .then(() => {
                  console.log('[ImageDisplayArea] Audio playing successfully')
                  soundPlayedRef.current = true
                })
                .catch(err => {
                  console.error('[ImageDisplayArea] Failed to play audio:', err)
                })
            }
          }
        }).catch(err => {
          console.error('[ImageDisplayArea] Failed to load cine frames:', err)
        })
      }
    } 
    // Continue showing cine if scan is running and we're in EXAMINATION tab (but not if stopped by tab switch)
    else if (isScanning && activeTab === 'EXAMINATION' && !showCine && !cineStoppedByTabSwitchRef.current) {
      // If scan is running but cine is not showing, show it (but don't play sound again)
      console.log('[ImageDisplayArea] Scan running - showing cine (no sound)')
      scanStartedRef.current = true
      setCurrentFrameIndex(0)
      
      // Load frames if needed
      if (mode === 'frontend' && volume && cineFrames.length > 0) {
        // Frontend mode: frames already loaded
        setShowCine(true)
      } else if (mode !== 'frontend') {
        // Backend mode: check cache
        const cached = cine.get(caseId)
        if (cached && cached.frames.length > 0) {
          setCineFrames(cached.frames)
          setCineFps(cached.fps)
          setShowCine(true)
        } else if (cineFrames.length === 0) {
          loadCineFrames().then(() => {
            if (mode === 'frontend' && volume) {
              // Frontend mode: frames already set by loadCineFrames
              if (cineFrames.length > 0 && isScanning) {
                setShowCine(true)
              }
            } else {
              // Backend mode: check cache
              const updatedCached = cine.get(caseId)
              if (updatedCached && updatedCached.frames.length > 0 && isScanning) {
                setCineFrames(updatedCached.frames)
                setCineFps(updatedCached.fps)
                setShowCine(true)
              }
            }
          })
        }
      }
    }
    // Stop when scan stops - keep showing first slice permanently
    else if (scanJustStopped) {
      console.log('[ImageDisplayArea] Scan stopped - showing first slice permanently')
      // Stop sound
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      soundPlayedRef.current = false // Reset sound flag
      cineStoppedByTabSwitchRef.current = false // Reset tab switch flag when scan stops
      scanStartedRef.current = false
      
      // Stop any running animation
      if (animationRef.current) {
        clearInterval(animationRef.current)
        animationRef.current = null
      }
      
      // First slice is already showing (frame 0 was set in playback complete)
      // Mark that we're showing first slice after scan - prevents normal animation
      showingFirstSliceAfterScanRef.current = true
      scanPlaybackJustCompletedRef.current = false
    }
    // Hide cine only when NOT intentionally showing first slice after scan
    else if (!isScanning && showCine && !showingFirstSliceAfterScanRef.current) {
      setShowCine(false)
      scanStartedRef.current = false
      soundPlayedRef.current = false
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
    
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [scanState?.isScanning, caseId, cineFrames.length, loadCineFrames, cine, activeTab, showCine])

  // Animate through cine frames (play once, don't loop) - only in EXAMINATION tab
  // BUT: When scanning, don't use cine frames - use same slices as VIEWER instead
  useEffect(() => {
    // CRITICAL: Stop everything immediately if not in EXAMINATION tab
    if (activeTab !== 'EXAMINATION') {
      console.log('[ImageDisplayArea] Not in EXAMINATION tab - stopping cine animation and sound')
      // Stop animation immediately
      if (animationRef.current) {
        clearInterval(animationRef.current)
        animationRef.current = null
      }
      // Stop sound immediately
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      // Hide cine immediately
      if (showCine) {
        setShowCine(false)
      }
      return
    }
    
    // When scanning, run FAST cine playback in EXAMINATION tab
    if (scanState?.isScanning && showCine && cineFrames.length > 0 && activeTab === 'EXAMINATION') {
      // Don't start another animation if one is already running
      if (animationRef.current) {
        return
      }
      
      console.log(`[ImageDisplayArea] 🎬 Starting SCAN cine playback - ${cineFrames.length} frames at ${cineFps} fps`)
      
      // Reset to first frame
      setCurrentFrameIndex(0)
      
      // Play sound
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(e => console.warn('[Audio] Play failed:', e))
      }
      
      let currentFrame = 0
      
      // Start fast animation for scan playback
      animationRef.current = setInterval(() => {
        currentFrame += 1
        
        if (currentFrame >= cineFrames.length) {
          // Scan cine complete - play once only, show first slice
          console.log('[ImageDisplayArea] ✅ Scan cine playback complete! Showing first slice.')
          clearInterval(animationRef.current!)
          animationRef.current = null
          
          // Mark that scan playback just completed - prevents normal animation from starting
          scanPlaybackJustCompletedRef.current = true
          
          // Show first slice (frame 0)
          setCurrentFrameIndex(0)
          
          // Stop sound
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
          
          // Notify parent that scan is complete (this will trigger scanJustStopped)
          if (onScanComplete) {
            onScanComplete()
          }
          
          return
        }
        
        setCurrentFrameIndex(currentFrame)
      }, 1000 / cineFps)
      
      return
    }
    
    // Only animate if ALL conditions are met: in EXAMINATION tab, cine showing, frames available, NOT scanning
    // AND scan playback didn't just complete (prevents double animation)
    if (showCine && cineFrames.length > 0 && !scanState?.isScanning && activeTab === 'EXAMINATION') {
      // Don't start animation if scan playback just completed
      if (scanPlaybackJustCompletedRef.current) {
        console.log('[ImageDisplayArea] Skipping normal animation - scan playback just completed')
        return
      }
      
      // Don't start animation if showing first slice after scan
      if (showingFirstSliceAfterScanRef.current) {
        console.log('[ImageDisplayArea] Skipping normal animation - showing first slice after scan')
        return
      }
      
      // Don't start another animation if one is already running
      if (animationRef.current) {
        return
      }
      
      console.log(`[ImageDisplayArea] Starting cine animation - ${cineFrames.length} frames at ${cineFps} fps (play once)`)
      
      // Reset to first frame when starting
      setCurrentFrameIndex(0)
      
      let currentFrame = 0
      const maxFrame = cineFrames.length - 1
      
      // Start frame animation - play once through
      animationRef.current = setInterval(() => {
        currentFrame += 1
        
        if (currentFrame > maxFrame) {
          // Reached end - stop animation, sound, and show first frame
          console.log('[ImageDisplayArea] ✅ Cine animation completed! Showing first slice.')
          clearInterval(animationRef.current!)
          animationRef.current = null
          
          // Reset to first frame
          setCurrentFrameIndex(0)
          
          // Stop sound when cine completes
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
          return
        }
        
        setCurrentFrameIndex(currentFrame)
      }, 1000 / cineFps)
    }
  }, [showCine, cineFrames.length, cineFps, scanState?.isScanning, activeTab])

  // Cleanup animation and audio on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [])

  return (
    <>
      {/* VIEWING tab (kept mounted, hidden when not active to preserve slice state) */}
      <div className={activeTab === 'VIEWING' ? 'flex flex-col flex-1 overflow-hidden bg-slate-900' : 'hidden'}>
        <div className="flex border-b border-slate-800 bg-slate-950">
          <button
            onClick={() => setViewerSubTab('dicom')}
            className={`px-6 py-3 text-sm font-medium transition ${
              viewerSubTab === 'dicom'
                ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DICOM Viewer
          </button>
          <button
            onClick={() => setViewerSubTab('mpr')}
            className={`px-6 py-3 text-sm font-medium transition ${
              viewerSubTab === 'mpr'
                ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MPR
          </button>
          <button
            onClick={() => setViewerSubTab('3d')}
            className={`px-6 py-3 text-sm font-medium transition ${
              viewerSubTab === '3d'
                ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3D Mesh
          </button>
        </div>

        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 150px)', minHeight: '600px' }}>
          <div className={viewerSubTab === 'dicom' ? 'h-full' : 'hidden'}>
            <DICOMViewer
              caseId={caseId}
              isActive={activeTab === 'VIEWING' && viewerSubTab === 'dicom'}
              reconRefreshToken={reconRefreshToken}
            />
          </div>
          <div className={viewerSubTab === 'mpr' ? 'h-full' : 'hidden'}>
            {/* Use frontend/backendslice-based MPR with crosshair, independent of Cornerstone stack */}
            <MPRViewer
              caseId={caseId}
              isActive={activeTab === 'VIEWING' && viewerSubTab === 'mpr'}
            />
          </div>
          <div className={viewerSubTab === '3d' ? 'h-full' : 'hidden'}>
            <ThreeDRenderViewer caseId={caseId} />
          </div>
        </div>
      </div>

      {/* FILMING tab */}
      <div className={activeTab === 'FILMING' ? 'flex flex-col flex-1 overflow-hidden bg-slate-900' : 'hidden'}>
        <FilmingViewer caseId={caseId} />
      </div>

      {/* EXAMINATION tab */}
      <div className={activeTab === 'EXAMINATION' ? 'flex flex-col flex-1 overflow-hidden bg-slate-900 p-4 gap-4' : 'hidden'}>
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Scout Image */}
        <div className="flex flex-col flex-1 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-800 rounded-md shadow-lg overflow-hidden min-h-0">
          <div className="px-3 py-2 bg-gradient-to-b from-slate-700 to-slate-800 border-b border-slate-900 text-slate-200 text-sm font-medium">
            Scout View (Frontal)
          </div>
          <div className="flex-1 min-h-0">
            <ScoutViewer 
              caseId={caseId}
              refreshToken={scoutRefreshToken} 
              isPlanningActive={isPlanningActive}
              onPlanningDataReady={onPlanningDataReady}
            />
          </div>
        </div>

        {/* Axial CT Image - Shows same slices as VIEWER when scanning */}
        <div className="flex flex-col flex-1 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-800 rounded-md shadow-lg overflow-hidden min-h-0">
          <div className="flex gap-4 px-3 py-2 text-xs text-slate-200 font-mono bg-gradient-to-b from-slate-700 to-slate-800 border-b border-slate-900 shadow-inner">
            <span>{showCine && scanState?.isScanning ? (currentFrameIndex + 1) : (showCine ? currentFrameIndex + 1 : scanState?.currentSlice || 0)}</span>
            <span>512x512</span>
            {scanState?.isScanning && (
              <span className="text-emerald-400 animate-pulse">● SCANNING</span>
            )}
            {loadingCine && !scanState?.isScanning && (
              <span className="text-blue-400 animate-pulse">Loading...</span>
            )}
          </div>
          <div className="relative flex-1 min-h-[360px] bg-black border border-slate-900 overflow-hidden flex items-center justify-center">
            {showCine ? (
              loadingCine ? (
                <div className="text-slate-400 text-sm animate-pulse">
                  Loading CT frames...
                </div>
              ) : cineError ? (
                <div className="text-red-400 text-sm text-center px-4">
                  {cineError}
                  <button 
                    onClick={loadCineFrames}
                    className="block mx-auto mt-2 px-3 py-1 bg-slate-700 rounded text-xs hover:bg-slate-600"
                  >
                    Retry
                  </button>
                </div>
              ) : cineFrames.length > 0 && cineFrames[currentFrameIndex] ? (
                <img 
                  src={cineFrames[currentFrameIndex]}
                  alt={`CT Slice ${currentFrameIndex + 1}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="text-slate-400 text-sm">
                  No frames available
                </div>
              )
            ) : (
              // Only render CornerstoneViewport when not showing cine and not scanning
              activeTab === 'EXAMINATION' && (
              <CornerstoneViewport
                viewportId="axial-viewport"
                orientation="axial"
              />
              )
            )}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                Axial View
                {showCine && cineFrames.length > 0 && (
                  <span className="ml-2 text-emerald-300">
                    {currentFrameIndex + 1} / {cineFrames.length}
                  </span>
                )}
              </div>
              {showCine && cineFrames.length > 0 && (
                <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                  {cineFps} FPS
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-4 px-3 py-2 text-xs text-slate-200 font-mono bg-gradient-to-b from-slate-800 to-slate-900 border-t border-slate-900 shadow-inner">
            <span>120 kV</span>
            <span>30 mA</span>
          </div>
        </div>
      </div>

      {/* Scout Summary Table */}
      {activeTab === 'EXAMINATION' && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs text-slate-200 border border-slate-800 bg-slate-900 shadow-lg">
            <thead className="bg-gradient-to-b from-slate-700 to-slate-800">
              <tr className="text-left">
                <th className="px-2 py-2 border border-slate-800">Scout Num</th>
                <th className="px-2 py-2 border border-slate-800">Scan Type</th>
                <th className="px-2 py-2 border border-slate-800">Start Loc (mm)</th>
                <th className="px-2 py-2 border border-slate-800">End Loc (mm)</th>
                <th className="px-2 py-2 border border-slate-800">kV</th>
                <th className="px-2 py-2 border border-slate-800">mA</th>
                <th className="px-2 py-2 border border-slate-800">Scout Plane</th>
                <th className="px-2 py-2 border border-slate-800">Voice</th>
                <th className="px-2 py-2 border border-slate-800">WW/WL</th>
              </tr>
            </thead>
            <tbody>
              {scoutSummary ? (
                <tr className="bg-slate-900">
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.scout_num || 1}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.scan_type || 'Scout'}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.start_loc_mm?.toFixed(1) || '-'}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.end_loc_mm?.toFixed(1) || '-'}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.kv || 120}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.ma || 30}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.scout_plane || 'FRONTAL'}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.voice || 'ON'}</td>
                  <td className="px-2 py-2 border border-slate-800 font-mono">{scoutSummary.scout_ww_wl || '-'}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-slate-400 border border-slate-800">
                    No scout data. Click "Scout Scan" to load.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  )
}

export default ImageDisplayArea
