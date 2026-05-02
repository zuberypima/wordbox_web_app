import { useState, useEffect, useCallback } from 'react'
import GameBoard from './components/GameBoard'
import type { GameState } from './components/GameBoard'
import { fetchPuzzle, validateWord } from './api'
import { useAuth } from './context/AuthContext'
import AuthModal from './components/AuthModal'

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [sessionWpm, setSessionWpm] = useState<number>(0)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const { user, token, logout } = useAuth()

  const loadNewPuzzle = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setFoundWords([])
    setTotalScore(0)
    setFeedback(null)
    setGameState(null)
    try {
      const lengths = difficulty === 'easy' ? { min: 4, max: 6 } : difficulty === 'medium' ? { min: 6, max: 8 } : { min: 8, max: 12 };
      const puzzle = await fetchPuzzle(lengths.min, lengths.max)
      setPuzzleLetters(puzzle.scrambled)
      setTargetWord(puzzle.word)
      setStartTime(Date.now())
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
      const result = await validateWord(selectedWord, token)
      setFeedback({ message: result.message, valid: result.valid })

      const alreadyFound = foundWords.some(w => w.word === selectedWord)
      if (!alreadyFound) {
        setFoundWords(prev => [{ word: selectedWord, score: result.score, valid: result.valid, meaning: result.meaning }, ...prev])
        if (result.valid) {
          setTotalScore(prev => prev + result.score)
          
          // Calculate WPM
          const timeElapsed = (Date.now() - startTime) / 1000 / 60; // in minutes
          const wpm = Math.round((selectedWord.length / 5) / timeElapsed);
          if (wpm > 0 && wpm < 200) {
            setSessionWpm(prev => prev === 0 ? wpm : Math.round((prev + wpm) / 2));
          }

          const newWordsSince = wordsSinceRefresh + 1;
          if (newWordsSince >= 3) {
            setRefreshKey(k => k + 1)
            setWordsSinceRefresh(0)
            setGameState(null)
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

  // Dynamic Page Title for SEO and Engagement
  useEffect(() => {
    const wordCount = foundWords.filter(fw => fw.valid).length;
    if (totalScore > 0) {
      document.title = `${totalScore} Points | Typing Game | Word Box`;
    } else {
      document.title = "Typing Game | The Best Online Word Box Puzzle";
    }
  }, [totalScore, foundWords]);

  return (
    <main className="min-h-screen bg-transparent text-white p-4 md:p-8 overflow-x-hidden">
      {/* Top Navigation Bar */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        {/* Top-Left Logo */}
        <div className="flex flex-col items-center md:items-start">
          <div className="relative group cursor-default select-none scale-90 md:scale-100 origin-left">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center bg-slate-900/60 backdrop-blur-xl border border-blue-900/20 rounded-2xl px-6 py-3 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute -inset-2 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <img 
                    src="/favicon.png" 
                    alt="" 
                    className="relative w-12 h-12 rounded-xl shadow-2xl transform group-hover:rotate-12 transition-transform duration-500"
                  />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-3xl font-black tracking-tighter text-white drop-shadow-sm">
                    WORD<span className="text-blue-400 bg-clip-text">BOX</span>
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.5em] text-blue-400/50 mt-1.5 font-black">
                    Word Box Puzzle
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-blue-200/60 font-medium tracking-wide text-[10px] uppercase bg-blue-900/10 px-3 py-1 rounded-full border border-blue-800/10">
            The best online word box & typing game
          </p>
        </div>

        {/* Top-Right Auth Bar */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4 bg-blue-900/30 px-4 py-2 rounded-full border border-blue-800/50">
              <div className="text-xs">
                <div className="text-blue-300 font-bold uppercase tracking-widest opacity-70">Logged in as</div>
                <div className="text-white font-black">{user.email}</div>
              </div>
              <button 
                onClick={logout}
                className="ml-2 p-2 hover:bg-red-500/10 rounded-full text-red-400 transition-all"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-full font-bold uppercase text-xs tracking-widest shadow-lg transition-all hover:opacity-90"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Sign In to Save Scores
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col items-center pt-2 gap-12">
        
        {/* Top Section: Score and Controls */}
        <div className="flex flex-col items-center w-full">
          {/* Header removed from here and moved to Top Nav */}

      {/* Score display */}
      <div className="mb-4 flex items-center gap-6">
        <div className="text-center pr-6">
          <div className="text-3xl font-black text-white drop-shadow-md">
            {totalScore}
          </div>
          <div className="text-[10px] text-blue-300 uppercase tracking-widest">Score</div>
        </div>

        <div className="text-center px-6 border-l border-blue-900/30">
          <div className="text-3xl font-black text-secondary drop-shadow-md">
            {sessionWpm}
          </div>
          <div className="text-[10px] text-blue-300 uppercase tracking-widest">WPM</div>
        </div>
        
        <div className="flex flex-col gap-2">
          {/* Difficulty Selector */}
          <div className="flex bg-blue-900/20 p-1 rounded-xl border border-blue-800/30">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  difficulty === d ? 'bg-primary text-white shadow-lg' : 'text-blue-300/50 hover:text-blue-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          
          <button
            onClick={loadNewPuzzle}
            disabled={isLoading}
            className="px-6 py-1.5 rounded-full bg-primary text-white hover:opacity-90 transition-all duration-300 text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'New Puzzle'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRefreshKey(k => k + 1)
                setWordsSinceRefresh(0)
                setGameState(null)
              }}
              disabled={isLoading || !puzzleLetters}
              className="px-4 py-1.5 rounded-full bg-secondary text-white hover:opacity-90 transition-all duration-300 text-xs font-bold uppercase tracking-wider shadow-sm disabled:opacity-50"
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
                      ? 'bg-primary/50 text-white cursor-not-allowed'
                      : 'bg-primary text-white hover:opacity-90 hover:-translate-y-1'
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
      </div>

      {/* Main Game Row: Letters Grid + Results Aside */}
      <div className="flex flex-col md:flex-row items-start justify-center gap-12 w-full px-4">
        
        {/* Game Board (Letters) */}
        <div className="flex flex-col items-center">
          {isLoading ? (
            <div className="w-full max-w-[380px] aspect-square flex flex-col items-center justify-center gap-8">
              <div className="relative">
                <div className="absolute -inset-8 bg-blue-500/20 blur-3xl rounded-full animate-pulse"></div>
                <img 
                  src="/favicon.png" 
                  alt="Loading..." 
                  className="w-24 h-24 rounded-2xl shadow-2xl animate-float animate-pulse-glow"
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-blue-400 text-sm font-black tracking-[0.4em] uppercase animate-pulse">
                  Preparing Puzzle
                </div>
                <div className="w-48 h-1 bg-blue-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-blue-400 animate-[loading_2s_ease-in-out_infinite]"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="w-full max-w-[380px] aspect-square flex flex-col items-center justify-center gap-4">
              <div className="text-red-500 text-center">{error}</div>
              <button onClick={loadNewPuzzle} className="px-6 py-2 rounded-full bg-primary text-white font-bold text-sm shadow-md hover:opacity-90 transition-all">
                Retry
              </button>
            </div>
          ) : (
            <GameBoard
              key={refreshKey}
              gameState={gameState}
              onMove={handleMove}
              puzzleLetters={puzzleLetters}
              refreshKey={refreshKey}
            />
          )}
        </div>

        {/* Right Section: Discovered Words List */}
        <div className="w-full max-w-[320px] flex flex-col pt-2">
          <div className="flex items-center justify-between mb-6 w-full">
            <h2 className="text-blue-300 uppercase tracking-[0.2em] text-[10px] font-bold opacity-60">
              Discovered
            </h2>
            <div className="px-3 py-0.5 rounded-full bg-blue-900/40 text-blue-300 text-[10px] font-black border border-blue-800/40">
              {foundWords.filter(fw => fw.valid).length}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
            {foundWords.length > 0 ? (
              foundWords.map((fw, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-300 transition-all ${
                    fw.valid 
                      ? 'bg-blue-900/20 border-blue-800/40 hover:border-primary/40 shadow-sm' 
                      : 'bg-slate-900/40 border-red-900/20 opacity-40'
                  }`}
                >
                  <span className={`text-[11px] font-black tracking-widest ${fw.valid ? 'text-white' : 'text-slate-500 line-through'}`}>
                    {fw.word}
                  </span>
                  {fw.valid && (
                    <span className="text-[9px] font-black text-secondary">
                      +{fw.score}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 border border-dashed border-blue-900/10 rounded-2xl opacity-20">
                <span className="text-[9px] tracking-[0.3em] uppercase">No Words Yet</span>
              </div>
            )}
          </div>
        </div>
      </div>



          <footer className="mt-16 border-t border-blue-900/30 pt-10 pb-12 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
              <div>
                <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-4">How to Play</h3>
                <ul className="space-y-2 text-sm text-blue-200/70 leading-relaxed">
                  <li>• Use your keyboard to type letters and build English words.</li>
                  <li>• Valid words must be at least 3 letters long.</li>
                  <li>• Score points based on the length and difficulty of the word.</li>
                  <li>• The board auto-shuffles every 3 valid words to keep things fresh!</li>
                </ul>
              </div>
              <div>
                <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-4">About WordBox</h3>
                <p className="text-sm text-blue-200/70 leading-relaxed">
                  WordBox is the ultimate online typing game and word puzzle designed to sharpen your vocabulary and logic skills. 
                  Challenge yourself with thousands of word combinations in this addicting, fast-paced brain game. 
                  Sign in to track your high scores and compete with word masters worldwide.
                </p>
              </div>
            </div>
            
            <div className="mt-12 text-blue-300/40 text-[10px] uppercase tracking-[0.2em] flex flex-col items-center gap-4">
              <div className="px-4 py-1.5 rounded-full bg-blue-900/20 border border-blue-800/30">
                ⌨️ Desktop: Use Keyboard | Backspace: Delete | Enter: Submit
              </div>
              <span>© {new Date().getFullYear()} WordBox Puzzle Game. All Rights Reserved.</span>
            </div>
          </footer>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </main>
  )
}

export default App
