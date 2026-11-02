import type { ChatMessage } from "@/lib/types";

import { ApprovalModal } from "./ApprovalModal";
import { CitationCard } from "./CitationCard";
import { RichText } from "./RichText";
import { SuggestedActions } from "./SuggestedActions";

type MessageProps = {
  message: ChatMessage;
  disabled?: boolean;
  onAction: (action: string) => void;
  onApproval: (message: ChatMessage, approved: boolean) => void;
};

export function Message({
  message,
  disabled = false,
  onAction,
  onApproval,
}: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] space-y-3 px-4 py-3 text-[15px] leading-7",
          isUser
            ? "bg-maroon text-white"
            : "border border-greystone border-l-4 border-l-maroon bg-white text-ink",
        ].join(" ")}
      >
        <RichText content={message.content} />

        {message.citations?.map((citation, index) => (
          <CitationCard
            key={`${citation.href ?? citation.source}-${index}`}
            citation={citation}
          />
        ))}

        {message.approval && (
          <ApprovalModal
            approval={message.approval}
            disabled={disabled}
            onApprove={() => onApproval(message, true)}
            onCancel={() => onApproval(message, false)}
          />
        )}

        {message.suggestedActions && (
          <SuggestedActions
            actions={message.suggestedActions}
            disabled={disabled}
            onSelect={onAction}
          />
        )}
      </div>
    </div>
  );
}
