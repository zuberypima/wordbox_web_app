import React, { useCallback, useMemo } from 'react';

export interface GameState {
  boxes: string[][];
  selectedPositions: { r: number; c: number }[];
}

interface GameBoardProps {
  onMove: (newState: GameState) => void;
  gameState: GameState | null;
  puzzleLetters?: string[] | null;
  refreshKey?: number;
}

const BOX_SIZE = 5;
const SVG_SIZE = 400;
const PADDING = 20;
const CELL_SIZE = (SVG_SIZE - PADDING * 2) / BOX_SIZE;

// Standard English letter frequencies (similar to Scrabble tile distribution)
const WEIGHTED_LETTERS = 'AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ';

const GameBoard: React.FC<GameBoardProps> = ({ onMove, gameState: externalGameState, puzzleLetters, refreshKey = 0 }) => {
  // Build a 5x5 grid from puzzle letters (padded/filled with random if needed)
  const initialBoxes = useMemo<string[][]>(() => {
    const flat: string[] = [];
    if (puzzleLetters && puzzleLetters.length > 0) {
      // Create a copy of puzzle letters
      const pLetters = [...puzzleLetters].map(l => l.toUpperCase());
      const total = BOX_SIZE * BOX_SIZE;
      
      // Fill the rest with random weighted letters
      for (let i = pLetters.length; i < total; i++) {
        pLetters.push(WEIGHTED_LETTERS[Math.floor(Math.random() * WEIGHTED_LETTERS.length)]);
      }
      
      // Shuffle the entire board randomly so puzzle letters are hidden
      for (let i = pLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pLetters[i], pLetters[j]] = [pLetters[j], pLetters[i]];
      }
      flat.push(...pLetters);
    } else {
      for (let i = 0; i < BOX_SIZE * BOX_SIZE; i++) {
        flat.push(WEIGHTED_LETTERS[Math.floor(Math.random() * WEIGHTED_LETTERS.length)]);
      }
    }
    // Reshape into 5x5
    return Array.from({ length: BOX_SIZE }, (_, r) =>
      flat.slice(r * BOX_SIZE, r * BOX_SIZE + BOX_SIZE)
    );
  }, [puzzleLetters, refreshKey]);

  const [internalGameState, setInternalGameState] = React.useState<GameState>(() => ({
    boxes: initialBoxes,
    selectedPositions: [],
  }));

  // Re-initialize internal state when puzzleLetters changes
  React.useEffect(() => {
    setInternalGameState({ boxes: initialBoxes, selectedPositions: [] });
  }, [initialBoxes]);

  const gameState = externalGameState || internalGameState;

  const handleBoxClick = useCallback((r: number, c: number) => {
    const currentSelections = gameState.selectedPositions || [];
    const isSelected = currentSelections.some(pos => pos.r === r && pos.c === c);

    let newSelections;
    if (isSelected) {
      newSelections = currentSelections.filter(pos => pos.r !== r || pos.c !== c);
    } else {
      newSelections = [...currentSelections, { r, c }];
    }

    const newState: GameState = {
      ...gameState,
      selectedPositions: newSelections
    };

    if (!externalGameState) {
      setInternalGameState(newState);
    }
    onMove(newState);
  }, [gameState, onMove, externalGameState]);

  return (
    <div className="relative w-full max-w-[380px] aspect-square select-none">
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full h-full"
      >
        {gameState.boxes.map((row, r) =>
          row.map((letter, c) => {
            const isSelected = (gameState.selectedPositions || []).some(pos => pos.r === r && pos.c === c);
            return (
              <g key={`box-${r}-${c}`} onClick={() => handleBoxClick(r, c)} className="cursor-pointer group">
                <rect
                  x={PADDING + c * CELL_SIZE + 4}
                  y={PADDING + r * CELL_SIZE + 4}
                  width={CELL_SIZE - 8}
                  height={CELL_SIZE - 8}
                  rx={8}
                  fill={isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)'}
                  className={`transition-all duration-300 ${
                    isSelected
                      ? 'stroke-blue-500 stroke-2'
                      : 'stroke-slate-700 stroke-1 group-hover:stroke-slate-500 group-hover:fill-[rgba(255,255,255,0.08)]'
                  }`}
                  style={isSelected ? { filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' } : {}}
                />
                <text
                  x={PADDING + c * CELL_SIZE + CELL_SIZE / 2}
                  y={PADDING + r * CELL_SIZE + CELL_SIZE / 2}
                  dominantBaseline="central"
                  textAnchor="middle"
                  className={`text-3xl font-black transition-all duration-300 ${
                    isSelected
                      ? 'fill-white'
                      : 'fill-slate-400 group-hover:fill-white'
                  }`}
                  style={{
                    transformOrigin: `${PADDING + c * CELL_SIZE + CELL_SIZE / 2}px ${PADDING + r * CELL_SIZE + CELL_SIZE / 2}px`,
                    ...(isSelected ? { filter: 'drop-shadow(0 0 8px #3b82f6)' } : {}),
                  }}
                >
                  {letter}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
};

export default GameBoard;
