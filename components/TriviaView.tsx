'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';

interface TriviaQuestion {
  category: string;
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface TriviaViewProps {
  onBack: () => void;
}

// Deterministic-enough shuffle for a small answer list — real randomness
// via Math.random() is fine here since this never runs during SSR (the
// question set itself only exists after a real client-side fetch).
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function TriviaView({ onBack }: TriviaViewProps) {
  const [questions, setQuestions] = useState<TriviaQuestion[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [fetchToken, setFetchToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch('/api/trivia?amount=10')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data as { results: TriviaQuestion[] };
      })
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.results);
        setIndex(0);
        setScore(0);
        setSelected(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load trivia questions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchToken]);

  const current = questions?.[index] ?? null;

  // Re-shuffled only when the question itself changes, not on every
  // render/selection — otherwise picking an answer would reorder the
  // options out from under the user.
  const options = useMemo(() => {
    if (!current) return [];
    return shuffle([current.correct_answer, ...current.incorrect_answers]);
  }, [current]);

  function selectAnswer(answer: string) {
    if (selected) return; // one answer per question
    setSelected(answer);
    if (answer === current?.correct_answer) setScore((s) => s + 1);
  }

  function nextQuestion() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  function playAgain() {
    setFetchToken((t) => t + 1);
  }

  const isFinished = questions !== null && index >= questions.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full p-4 overflow-y-auto bg-[#050810] text-slate-100">
      <div className="relative z-10 flex items-center gap-2 mb-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded border transition bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/80">Trivia</p>
          <h1 className="text-3xl font-bold text-white">Cosmic Trivia</h1>
          <p className="text-sm text-neutral-400">
            Real questions from{' '}
            <a
              href="https://opentdb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neutral-200"
            >
              Open Trivia DB
            </a>
            .
          </p>
        </div>

        {loading && <p className="text-sm text-neutral-400">Loading questions…</p>}

        {!loading && error && (
          <div className="p-4 space-y-3 text-sm border rounded-lg border-red-900/60 bg-red-950/20 text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={playAgain}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wide rounded border border-neutral-700 hover:border-neutral-500 hover:bg-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && current && !isFinished && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wide text-neutral-500">
              <span>
                Question {index + 1} / {questions?.length}
              </span>
              <span>{current.category}</span>
              <span
                className={
                  current.difficulty === 'hard'
                    ? 'text-red-400'
                    : current.difficulty === 'medium'
                      ? 'text-cyan-300'
                      : 'text-emerald-400'
                }
              >
                {current.difficulty}
              </span>
            </div>

            <div className="p-5 border rounded-lg border-neutral-700 bg-neutral-900/60">
              <p className="text-base text-white">{current.question}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.map((option) => {
                const isCorrect = option === current.correct_answer;
                const isPicked = option === selected;
                const showResult = selected !== null;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectAnswer(option)}
                    disabled={showResult}
                    className={`px-4 py-3 text-sm text-left border rounded-lg transition ${
                      showResult && isCorrect
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                        : showResult && isPicked
                          ? 'border-red-500 bg-red-950/40 text-red-200'
                          : 'border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-neutral-500 hover:bg-white/5'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-400">
                  {selected === current.correct_answer ? 'Correct!' : `Not quite — it was "${current.correct_answer}".`}
                </p>
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
                >
                  {questions && index + 1 >= questions.length ? 'See results' : 'Next question →'}
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !error && isFinished && questions && (
          <div className="p-6 space-y-4 text-center border rounded-lg border-neutral-700 bg-neutral-900/60">
            <p className="text-sm text-neutral-400">Final score</p>
            <p className="text-4xl font-bold text-white">
              {score} / {questions.length}
            </p>
            <button
              type="button"
              onClick={playAgain}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wide rounded-lg bg-white text-black hover:bg-neutral-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Play again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
