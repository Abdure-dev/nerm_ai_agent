"use client";

import { useEffect, useRef, useState } from "react";

import type {
  ApprovalRequest,
  ChatMessage,
  ChatResponse,
} from "@/lib/types";

import { ChatInput } from "./ChatInput";
import { Message } from "./Message";
import { QuestionLibrary } from "./QuestionLibrary";

const initialMessages: ChatMessage[] = [
  {
    id: "welcome-message",
    role: "assistant",
    content:
      "Hi, I’m the University of Chicago NERM AI Assistant. I can help you understand UChicago NERM documentation and approved workflows.",
    suggestedActions: [
      "How do I change an assignment's end date?",
      "How do I add a new person and assignment?",
      "How do I reactivate a service account?",
    ],
  },
];

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<
    "enterprise" | "demo" | null
  >(null);
  const [agentSession, setAgentSession] = useState<string>();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function sendMessage(content: string) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
          session: agentSession,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Chat request failed: ${response.status}`);
      }

      const data = (await response.json()) as ChatResponse;
      setAgentMode(data.mode ?? null);
      setAgentSession(data.session);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        suggestedActions: data.suggestedActions,
        approval: data.approval,
      };

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
    } catch (error) {
      console.error(error);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "I could not complete that request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleApproval(message: ChatMessage, approved: boolean) {
    const approval = message.approval;

    if (!approval) {
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.map((currentMessage) =>
        currentMessage.id === message.id
          ? { ...currentMessage, approval: undefined }
          : currentMessage
      )
    );

    void sendMessage(
      approved
        ? formatApprovalMessage(approval)
        : `Cancel the proposed ${approval.action.replaceAll("_", " ")}.`
    );
  }

  function startNewChat() {
    setMessages(initialMessages);
    setAgentMode(null);
    setAgentSession(undefined);
  }

  return (
    <section className="flex h-[min(760px,calc(100vh-11rem))] w-full max-w-4xl flex-col overflow-hidden border border-greystone bg-white shadow-sm">
      <header className="border-b-4 border-maroon px-6 py-5">
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-maroon">
              UChicago NERM
            </p>
            <h1 className="font-serif text-3xl leading-tight text-ink">
              NERM Assistant
            </h1>
            <p className="text-sm text-greystone-dark">
              Guidance on NERM documentation and workflows
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {agentMode === "demo" && (
              <span className="border border-greystone-dark px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-greystone-dark">
                Demo mode
              </span>
            )}
            {agentMode === "enterprise" && (
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-greystone-dark">
                <span className="h-2 w-2 rounded-full bg-maroon" aria-hidden />
                Connected
              </span>
            )}
            <button
              type="button"
              disabled={isLoading}
              onClick={startNewChat}
              className="border border-maroon px-3 py-1.5 text-xs font-semibold text-maroon transition hover:bg-maroon hover:text-white disabled:opacity-50"
            >
              New chat
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto bg-greystone-light/60 p-6">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            disabled={isLoading}
            onAction={(action) => void sendMessage(action)}
            onApproval={handleApproval}
          />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 border-l-4 border-maroon bg-white px-4 py-3 text-sm text-greystone-dark">
              <span className="h-2 w-2 animate-pulse rounded-full bg-maroon" aria-hidden />
              Searching NERM documentation…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isLibraryOpen ? (
        <QuestionLibrary
          disabled={isLoading}
          onClose={() => setIsLibraryOpen(false)}
          onSelect={(question) => {
            setIsLibraryOpen(false);
            void sendMessage(question);
          }}
        />
      ) : (
        <div className="border-t border-greystone bg-white px-4 pt-3">
          <button
            type="button"
            aria-expanded={false}
            aria-controls="question-library"
            onClick={() => setIsLibraryOpen(true)}
            className="text-xs font-semibold uppercase tracking-wide text-maroon transition hover:text-maroon-dark"
          >
            Browse common questions ▸
          </button>
        </div>
      )}

      <ChatInput disabled={isLoading} onSubmit={sendMessage} />
    </section>
  );
}

function formatApprovalMessage(approval: ApprovalRequest): string {
  return [
    `I approve the proposed ${approval.action.replaceAll("_", " ")}.`,
    `Assignment: ${approval.details.assignmentId}.`,
    `New end date: ${approval.details.newEndDate}.`,
    `Reason: ${approval.details.reason}.`,
  ].join(" ");
}
