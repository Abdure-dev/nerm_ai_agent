export type MessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
  suggestedActions?: string[];
  approval?: ApprovalRequest;
};

export type ChatRequest = {
  messages: Pick<ChatMessage, "role" | "content">[];
  session?: string;
};

export type ChatResponse = {
  answer: string;
  mode?: "enterprise" | "demo";
  session?: string;
  citations?: Citation[];
  suggestedActions?: string[];
  approval?: ApprovalRequest;
};

export type Citation = {
  title: string;
  source: string;
  excerpt?: string;
  href?: string;
};

export type ApprovalRequest = {
  action: "extend_assignment";
  title: string;
  description: string;
  details: {
    assignmentId: string;
    newEndDate: string;
    reason: string;
  };
};
