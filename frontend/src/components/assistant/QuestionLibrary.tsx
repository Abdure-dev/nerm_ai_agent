"use client";

import { useState } from "react";

import { QUESTION_LIBRARY } from "@/lib/suggested-questions";

type QuestionLibraryProps = {
  disabled?: boolean;
  onSelect: (question: string) => void;
  onClose: () => void;
};

export function QuestionLibrary({
  disabled = false,
  onSelect,
  onClose,
}: QuestionLibraryProps) {
  const [category, setCategory] = useState(QUESTION_LIBRARY[0].name);
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();

  const questions = query
    ? QUESTION_LIBRARY.flatMap((group) => group.questions).filter((question) =>
        question.toLowerCase().includes(query)
      )
    : (QUESTION_LIBRARY.find((group) => group.name === category)?.questions ?? []);

  return (
    <div
      id="question-library"
      className="border-t border-greystone bg-white px-4 pb-3 pt-4"
    >
      <div className="flex items-center gap-3">
        <p className="font-serif text-lg text-maroon">Common questions</p>
        <label htmlFor="question-filter" className="sr-only">
          Search questions
        </label>
        <input
          id="question-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search questions…"
          className="ml-auto w-48 border border-greystone px-3 py-1.5 text-xs outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20 sm:w-64"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close common questions"
          className="px-2 py-1 text-lg leading-none text-greystone-dark transition hover:text-maroon"
        >
          ×
        </button>
      </div>

      {!query && (
        <div role="tablist" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-greystone">
          {QUESTION_LIBRARY.map((group) => (
            <button
              key={group.name}
              type="button"
              role="tab"
              aria-selected={group.name === category}
              onClick={() => setCategory(group.name)}
              className={`-mb-px border-b-2 pb-2 text-xs font-semibold uppercase tracking-wide transition ${
                group.name === category
                  ? "border-maroon text-maroon"
                  : "border-transparent text-greystone-dark hover:text-ink"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-3 grid max-h-52 gap-1 overflow-y-auto sm:grid-cols-2">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(question)}
              className="w-full px-2 py-1.5 text-left text-sm text-ink transition hover:bg-maroon-light hover:text-maroon disabled:cursor-not-allowed disabled:opacity-50"
            >
              {question}
            </button>
          </li>
        ))}
        {questions.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-greystone-dark">
            No matching questions. Type your own question below.
          </li>
        )}
      </ul>
    </div>
  );
}
