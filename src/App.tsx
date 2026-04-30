import { useState, useEffect, useCallback } from 'react'
import GameBoard from './components/GameBoard'
import type { GameState } from './components/GameBoard'
import { fetchPuzzle, validateWord } from './api'

interface FoundWord {
  word: string;
  score: number;
  valid: boolean;
  meaning?: string | null;
}

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [puzzleLetters, setPuzzleLetters] = useState<string[] | null>(null)
  const [foundWords, setFoundWords] = useState<FoundWord[]>([])
  const [totalScore, setTotalScore] = useState(0)
  const [targetWord, setTargetWord] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [wordsSinceRefresh, setWordsSinceRefresh] = useState<number>(0)
  const [isRevealed, setIsRevealed] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<{ message: string; valid: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNewPuzzle = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setFoundWords([])
    setTotalScore(0)
    setFeedback(null)
    setGameState(null)
    try {
      const puzzle = await fetchPuzzle()
      setPuzzleLetters(puzzle.scrambled)
      setTargetWord(puzzle.word)
      setRefreshKey(0)
      setWordsSinceRefresh(0)
      setIsRevealed(false)
    } catch {
      setError('Could not connect to the game server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNewPuzzle()
  }, [loadNewPuzzle])

  const handleMove = (newState: GameState) => setGameState(newState)

  const handleClear = () => {
    if (gameState) {
      setGameState({ ...gameState, selectedPositions: [] })
    }
  }

  const selectedWord = gameState?.selectedPositions
    ? gameState.selectedPositions.map(pos => gameState.boxes[pos.r][pos.c]).join('')
    : ''

  const handleSubmit = async () => {
    if (!selectedWord || isValidating) return
    setIsValidating(true)
    setFeedback(null)
    try {
      const result = await validateWord(selectedWord)
      setFeedback({ message: result.message, valid: result.valid })

      const alreadyFound = foundWords.some(w => w.word === selectedWord)
      if (!alreadyFound) {
        setFoundWords(prev => [{ word: selectedWord, score: result.score, valid: result.valid, meaning: result.meaning }, ...prev])
        if (result.valid) {
          setTotalScore(prev => prev + result.score)
          const newWordsSince = wordsSinceRefresh + 1;
          if (newWordsSince >= 3) {
            setRefreshKey(k => k + 1)
            setWordsSinceRefresh(0)
            setFeedback({ message: '3 Words Found! Board Shuffled.', valid: true })
          } else {
            setWordsSinceRefresh(newWordsSince)
          }
        }
      } else {
        setFeedback({ message: 'Already submitted!', valid: false })
      }
      handleClear()
    } catch {
      setFeedback({ message: 'Server error. Try again.', valid: false })
    } finally {
      setIsValidating(false)
      // Clear feedback after 2.5 seconds
      setTimeout(() => setFeedback(null), 2500)
    }
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is holding modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Ignore if currently loading, validating, or error state
      if (isLoading || isValidating || error || !gameState) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (gameState.selectedPositions && gameState.selectedPositions.length > 0) {
          setGameState({
            ...gameState,
            selectedPositions: gameState.selectedPositions.slice(0, -1)
          });
        }
        return;
      }

      // Handle letter selection
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        const selectedSet = new Set(gameState.selectedPositions?.map(p => `${p.r},${p.c}`) || []);
        
        let foundPosition = null;
        for (let r = 0; r < gameState.boxes.length; r++) {
          for (let c = 0; c < gameState.boxes[r].length; c++) {
            if (gameState.boxes[r][c] === key && !selectedSet.has(`${r},${c}`)) {
              foundPosition = { r, c };
              break; // Found the first available matching letter
            }
          }
          if (foundPosition) break;
        }

        if (foundPosition) {
          setGameState({
            ...gameState,
            selectedPositions: [...(gameState.selectedPositions || []), foundPosition]
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <main className="min-h-screen bg-transparent text-white p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-24 items-center lg:items-start justify-center pt-2 lg:pt-8">
        
        {/* Left Column: Game Area */}
        <div className="flex flex-col items-center w-full max-w-[380px]">
          <header className="mb-6 text-center">
        <h1 className="text-5xl font-bold tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          WORDPBOX
        </h1>
        <p className="mt-2 text-blue-200">Select Letters to Build a Word</p>
      </header>

      {/* Score display */}
      <div className="mb-4 flex items-center gap-6">
        <div className="text-center">
          <div className="text-3xl font-black text-white drop-shadow-md">
            {totalScore}
          </div>
          <div className="text-xs text-blue-300 uppercase tracking-widest">Score</div>
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={loadNewPuzzle}
            disabled={isLoading}
            className="px-6 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-300 text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'New Puzzle'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRefreshKey(k => k + 1)
                setWordsSinceRefresh(0)
              }}
              disabled={isLoading || !puzzleLetters}
              className="px-4 py-1.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors duration-300 text-xs font-bold uppercase tracking-wider shadow-sm disabled:opacity-50"
            >
              Shuffle
            </button>
            <button
              onClick={() => setIsRevealed(true)}
              disabled={isLoading || isRevealed || !targetWord}
              className="px-4 py-1.5 rounded-full bg-blue-900/50 text-blue-200 hover:bg-blue-800 transition-colors duration-300 text-xs font-bold uppercase tracking-wider border border-blue-800 shadow-sm disabled:opacity-50 min-w-[100px]"
            >
              {isRevealed ? targetWord : 'Reveal'}
            </button>
          </div>
        </div>
      </div>

      {/* Game Board */}
      {isLoading ? (
        <div className="w-full max-w-[380px] aspect-square flex items-center justify-center">
          <div className="text-slate-500 text-lg animate-pulse tracking-widest uppercase">Loading Puzzle...</div>
        </div>
      ) : error ? (
        <div className="w-full max-w-[380px] aspect-square flex flex-col items-center justify-center gap-4">
          <div className="text-red-500 text-center">{error}</div>
          <button onClick={loadNewPuzzle} className="px-6 py-2 rounded-full bg-blue-600 text-white font-bold text-sm shadow-md">
            Retry
          </button>
        </div>
      ) : (
        <GameBoard
          gameState={gameState}
          onMove={handleMove}
          puzzleLetters={puzzleLetters}
          refreshKey={refreshKey}
        />
      )}

      {/* Word input & controls */}
      <div className="mt-3 text-center flex flex-col items-center justify-center min-h-[5rem]">
        {feedback && (
          <div className={`mb-3 px-5 py-2 rounded-full text-sm font-bold tracking-wider transition-all shadow-sm ${feedback.valid ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {feedback.message}
          </div>
        )}
        {selectedWord ? (
          <>
            <div className="text-4xl font-black tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] mb-4">
              {selectedWord}
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleClear}
                className="px-6 py-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-300 font-bold uppercase text-sm tracking-wider"
              >
                Clear
              </button>
              <button
                onClick={handleSubmit}
                disabled={isValidating}
                className={`px-8 py-2 rounded-full font-black uppercase text-sm tracking-widest shadow-md hover:shadow-lg transition-all duration-300 ${
                  isValidating
                    ? 'bg-blue-300 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1'
                }`}
              >
                {isValidating ? 'Checking...' : 'Submit'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-slate-400 text-sm tracking-widest uppercase">
            Select letters to form a word
          </div>
        )}
      </div>

          <footer className="mt-12 text-blue-300/80 text-sm flex flex-col items-center gap-2 text-center">
            <span>Select letters from the puzzle above to form valid English words.</span>
            <span className="px-3 py-1 rounded bg-blue-900/50 border border-blue-800 text-xs text-blue-200">
              ⌨️ Desktop users: You can also use your keyboard to type, Backspace to delete, and Enter to submit.
            </span>
          </footer>
        </div>

        {/* Right Column: Submitted Words */}
        <div className="w-full max-w-[500px] flex flex-col lg:pt-4">
          {foundWords.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-[1px] bg-blue-800 flex-1"></div>
                <h2 className="text-center text-blue-300 uppercase tracking-widest text-xs font-bold whitespace-nowrap">
                  Submitted Words — {foundWords.filter(fw => fw.valid).length} valid
                </h2>
                <div className="h-[1px] bg-blue-800 flex-1"></div>
              </div>
              
              <div className="flex flex-col gap-2">
                {foundWords.map((fw, i) => (
                  <div
                    key={i}
                    className={`relative overflow-hidden px-4 py-3 rounded-xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                      fw.valid 
                        ? 'bg-blue-900/40 border-blue-800 hover:border-blue-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all' 
                        : 'bg-slate-900/60 border-red-900/30 opacity-80'
                    }`}
                  >
                    {/* Decorative background glow for valid words */}
                    {fw.valid && (
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-xl font-black tracking-widest ${fw.valid ? 'text-white' : 'text-slate-500 line-through'}`}>
                        {fw.word}
                      </span>
                      {fw.valid ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30 shadow-sm">
                          +{fw.score} PTS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30 shadow-sm">
                          INVALID
                        </span>
                      )}
                    </div>
                    
                    {fw.valid && fw.meaning && (
                      <p className="text-blue-200/80 text-xs leading-relaxed mt-2 pt-2 border-t border-blue-800 relative z-10">
                        {fw.meaning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 border border-dashed border-slate-800 bg-transparent rounded-2xl p-8 mt-12 lg:mt-0 opacity-50 min-h-[300px]">
              <span className="text-4xl mb-4">✨</span>
              <p className="text-sm tracking-widest uppercase text-center leading-relaxed">Words you find will<br/>appear here</p>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}

export default App
