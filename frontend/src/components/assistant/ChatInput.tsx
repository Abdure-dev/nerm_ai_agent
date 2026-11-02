"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
};

export function ChatInput({ disabled = false, onSubmit }: ChatInputProps) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || disabled) {
      return;
    }

    setMessage("");
    await onSubmit(trimmedMessage);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 bg-white p-4 pt-3"
    >
      <label htmlFor="chat-message" className="sr-only">
        Message
      </label>

      <textarea
        id="chat-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Ask about NERM..."
        rows={1}
        disabled={disabled}
        className="min-h-12 flex-1 resize-none border border-greystone px-4 py-3 text-sm outline-none transition placeholder:text-greystone-dark focus:border-maroon focus:ring-2 focus:ring-maroon/20 disabled:bg-greystone-light"
      />

      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="h-12 bg-maroon px-6 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
