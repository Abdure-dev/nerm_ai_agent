import "server-only";

import { GoogleAuth } from "google-auth-library";

import { searchNermKnowledge, type RetrievedDocument } from "@/lib/nerm-knowledge";
import type { ApprovalRequest, ChatMessage, ChatResponse, Citation } from "@/lib/types";

const GOOGLE_CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_RAG_RESULT_LIMIT = 8;
// streamAssist answers routinely take 10-30s; leave headroom before aborting.
const ENTERPRISE_TIMEOUT_MS = 60_000;

// Reuse one client so access tokens are cached between requests.
const googleAuth = new GoogleAuth({ scopes: [GOOGLE_CLOUD_SCOPE] });

type EnterpriseStreamChunk = {
  answer?: {
    state?: string;
    replies?: Array<{
      groundedContent?: {
        content?: {
          text?: string;
        };
        textGroundingMetadata?: {
          references?: Array<{
            content?: string;
            documentMetadata?: {
              document?: string;
              pageIdentifier?: string;
              title?: string;
              uri?: string;
            };
          }>;
        };
      };
    }>;
  };
  sessionInfo?: {
    session?: string;
  };
  error?: {
    message?: string;
  };
};

export async function runNermAgent(
  messages: Pick<ChatMessage, "role" | "content">[],
  session?: string
): Promise<ChatResponse> {
  const enterpriseProjectId = process.env.ENTERPRISE_PROJECT_ID;
  const enterpriseAppId = process.env.ENTERPRISE_APP_ID;

  const smallTalk = answerSmallTalk(messages.at(-1)?.content ?? "");
  if (smallTalk) {
    // Keep the mode badge and Gemini session intact across local replies.
    return {
      ...smallTalk,
      mode: enterpriseProjectId && enterpriseAppId ? "enterprise" : "demo",
      session,
    };
  }

  if (enterpriseProjectId && enterpriseAppId) {
    return runEnterpriseAssistant(
      messages,
      enterpriseProjectId,
      enterpriseAppId,
      process.env.ENTERPRISE_LOCATION ?? "global",
      session
    );
  }

  return runDemoAgent(messages);
}

const EXAMPLE_QUESTIONS = [
  "How do I change an assignment's end date?",
  "How do I add a new person and assignment?",
  "How do I reactivate a service account?",
];

// Greetings, thanks, and "what can you do" retrieve no NERM documents, so the
// grounded prompt would refuse them. Answer these locally and instantly instead.
function answerSmallTalk(message: string): ChatResponse | undefined {
  const normalized = message.trim().toLowerCase().replace(/[!.?,]+$/g, "");

  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening))( there)?$/.test(normalized)) {
    return {
      answer:
        "Hello! I can explain University of Chicago NERM workflows: how to create people, assignments, organizations, and service or test accounts, how to change end dates or reactivate accounts, which fields are required, and who gets notified. What would you like to know?",
      suggestedActions: EXAMPLE_QUESTIONS,
    };
  }

  if (/^(thanks|thank you|thx|ty)( so much| very much)?$/.test(normalized)) {
    return {
      answer: "You're welcome. Let me know if you have another NERM question.",
    };
  }

  if (
    /^(what can you (do|help( me)? with)|help|what do you know|what questions can i ask)$/.test(
      normalized
    )
  ) {
    return {
      answer:
        "I answer questions about UChicago NERM workflows, based on the NERM workflow configuration:\n\n- Creating people, assignments, organizations, service accounts, and test accounts\n- Changing or ending assignments and adjusting end dates\n- Reactivating, expiring, or transferring ownership of accounts\n- Bulk CSV imports\n- Required fields, date rules, and who is notified\n\nI cannot look up or change individual NERM records.",
      suggestedActions: EXAMPLE_QUESTIONS,
    };
  }

  return undefined;
}

async function runEnterpriseAssistant(
  messages: Pick<ChatMessage, "role" | "content">[],
  projectId: string,
  appId: string,
  location: string,
  session?: string
): Promise<ChatResponse> {
  const userQuery = messages.at(-1)?.content.trim();

  if (!userQuery) {
    throw new AgentUpstreamError("A school AI service query is required.");
  }

  // Include the previous user turn so follow-ups ("what about test accounts?")
  // still retrieve the right workflow documents.
  const retrievalQuery = messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) => message.content)
    .join(" ");
  const references = await searchNermKnowledge(retrievalQuery);
  const referenceBlock = references.length
    ? `\n\nNERM reference documents (generated from the UChicago NERM workflow configuration):\n\n${references
        .map((reference, index) => `--- Document ${index + 1}: ${reference.title} ---\n${reference.content}`)
        .join("\n\n")}`
    : "";

  const query = `You are the University of Chicago NERM AI Assistant.
Answer only questions about University of Chicago Non-Employee Risk Management
(NERM), including approved UChicago NERM documentation and workflows.

Use the NERM reference documents included below, and any connected UChicago
NERM documentation, as the source of truth. Explain NERM workflows by name,
including the steps, required fields, rules, and notifications they describe.
Do not retrieve, infer, or mention unrelated information from UChicago systems,
emails, calendars, files, prior collaborations, projects, or other connected
services. If the answer is not available in these NERM sources, say:
"I could not find this in the available UChicago NERM documentation."

Never invent UChicago policies, deadlines, contacts, user records, approvals,
or citations. Do not claim to view or change a user's NERM record. Give a
direct, concise answer and identify the relevant documentation when available.
Do not open with a greeting or restate your role unless the user asks. Write for
a non-technical university staff member: describe field rules in plain words
(for example "letters, numbers, and basic punctuation only") instead of showing
regular-expression patterns, and omit internal workflow IDs unless asked. Use
short "##" headings, numbered steps, or "-" bullet points when they improve
clarity. Do not use emoji, tables, or horizontal-rule separators.${referenceBlock}

User request: ${userQuery}`;

  const accessToken = await googleAuth.getAccessToken();

  if (!accessToken) {
    throw new AgentUpstreamError(
      "Google Application Default Credentials are unavailable."
    );
  }

  const endpointLocation = ["global", "us", "eu"].includes(location)
    ? location
    : "global";
  const endpoint = [
    `https://${endpointLocation}-discoveryengine.googleapis.com/v1`,
    `projects/${encodeURIComponent(projectId)}`,
    `locations/${encodeURIComponent(location)}`,
    "collections/default_collection",
    `engines/${encodeURIComponent(appId)}`,
    "assistants/default_assistant:streamAssist",
  ].join("/");
  const body: Record<string, unknown> = {
    query: { text: query },
  };
  const ragDataStore = getRagDataStore();

  if (ragDataStore) {
    body.toolsSpec = {
      vertexAiSearchSpec: {
        dataStoreSpecs: [
          {
            dataStore: ragDataStore,
            numResults: DEFAULT_RAG_RESULT_LIMIT,
          },
        ],
      },
    };
  }

  if (session) {
    body.session = session;
  }

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Goog-User-Project": projectId,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(ENTERPRISE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AgentUpstreamError(
        "The school AI service took too long to respond. Please try again."
      );
    }

    throw new AgentUpstreamError(
      "The school AI service could not be reached. Please try again."
    );
  }
  const responseText = await response.text();

  if (!response.ok) {
    let message = `The school AI request failed with status ${response.status}.`;

    try {
      const payload = JSON.parse(responseText) as EnterpriseStreamChunk;
      message = payload.error?.message ?? message;
    } catch {
      // Keep the status-based message when Google returns a non-JSON error.
    }

    throw new AgentUpstreamError(message);
  }

  let chunks: EnterpriseStreamChunk[];

  try {
    chunks = JSON.parse(responseText) as EnterpriseStreamChunk[];
  } catch {
    throw new AgentUpstreamError(
      "The school AI service returned an unreadable streaming response."
    );
  }

  const answer = cleanAssistantAnswer(
    chunks
    .flatMap((chunk) => chunk.answer?.replies ?? [])
    .map((reply) => reply.groundedContent?.content?.text ?? "")
    .join("")
    .trim()
  );
  const returnedSession = chunks.find(
    (chunk) => chunk.sessionInfo?.session
  )?.sessionInfo?.session;

  return {
    answer:
      answer ||
      "The request completed without a text answer. Please try rephrasing the question.",
    mode: "enterprise",
    session: returnedSession ?? session,
    citations: references.length
      ? citeUsedReferences(answer, references)
      : extractEnterpriseCitations(chunks),
  };
}

// Show only the local documents the answer actually names; fall back to the
// best match. Gemini references are skipped here because the shared app's other
// connectors (mail, drive, etc.) are not NERM sources.
function citeUsedReferences(
  answer: string,
  references: RetrievedDocument[]
): Citation[] | undefined {
  if (!answer || answer.includes("could not find this")) {
    return undefined;
  }
  const normalizedAnswer = answer.toLowerCase();
  const named = references.filter((reference) =>
    normalizedAnswer.includes(reference.title.toLowerCase())
  );
  return (named.length ? named : references.slice(0, 1)).map(
    (reference) => reference.citation
  );
}

function cleanAssistantAnswer(answer: string): string {
  return answer
    .split("\n")
    .filter((line) => !/^\s*[-—_]{3,}\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEnterpriseCitations(
  chunks: EnterpriseStreamChunk[]
): Citation[] | undefined {
  const citations = chunks
    .flatMap((chunk) => chunk.answer?.replies ?? [])
    .flatMap(
      (reply) =>
        reply.groundedContent?.textGroundingMetadata?.references ?? []
    )
    .map((reference) => {
      const metadata = reference.documentMetadata;
      const title = metadata?.title?.trim() || "UChicago NERM documentation";
      const page = metadata?.pageIdentifier?.trim();
      const document = metadata?.document?.trim();
      const source = page
        ? `University of Chicago NERM documentation — ${page}`
        : document || "University of Chicago NERM documentation";
      const href = safeCitationUrl(metadata?.uri);

      return {
        title,
        source,
        excerpt: reference.content?.trim().slice(0, 360) || undefined,
        href,
      };
    });

  const unique = citations.filter(
    (citation, index) =>
      citations.findIndex(
        (candidate) =>
          candidate.href === citation.href &&
          candidate.title === citation.title &&
          candidate.source === citation.source
      ) === index
  );

  return unique.length > 0 ? unique : undefined;
}

function safeCitationUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function getRagDataStore(): string | undefined {
  const value = process.env.ENTERPRISE_RAG_DATA_STORE?.trim();

  if (!value) {
    return undefined;
  }

  if (
    !/^projects\/\d+\/locations\/[a-z0-9-]+\/collections\/[^/]+\/dataStores\/[^/]+$/i.test(
      value
    )
  ) {
    throw new AgentUpstreamError(
      "ENTERPRISE_RAG_DATA_STORE must be a full Gemini Enterprise data-store resource name."
    );
  }

  return value;
}

function runDemoAgent(
  messages: Pick<ChatMessage, "role" | "content">[]
): ChatResponse {
  const message = messages.at(-1)?.content.trim() ?? "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("what is nerm") ||
    normalized.includes("what nerm is") ||
    normalized.includes("tell me about nerm")
  ) {
    return {
      mode: "demo",
      answer:
        "In this prototype, NERM is the system used to manage non-employee profiles, pending administrative work, assignments, and approval-controlled changes. The records and guidance currently shown by the app are demonstration data until authenticated NERM data sources are connected.",
      citations: [findDocumentation("getting started")],
      suggestedActions: [
        "Show my pending items",
        "Review my profile",
        "How do assignment extensions work?",
      ],
    };
  }

  if (normalized.includes("pending")) {
    return {
      mode: "demo",
      answer:
        "Demo data shows two pending items:\n\n1. Profile review — Pending, due August 1, 2026.\n2. Assignment extension — Needs information, due July 30, 2026.",
      suggestedActions: [
        "Review my profile",
        "Prepare an assignment extension",
      ],
    };
  }

  if (normalized.includes("profile")) {
    return {
      mode: "demo",
      answer:
        "Demo profile profile-001 is active. The listed role is Principal Investigator.",
      suggestedActions: ["Show my pending items"],
      citations: [findDocumentation("profile")],
    };
  }

  if (
    normalized.includes("how") &&
    (normalized.includes("extension") || normalized.includes("assignment"))
  ) {
    return {
      mode: "demo",
      answer:
        "In the demo NERM workflow, an assignment extension needs the assignment ID, a new end date, and a business reason. The assistant then presents the exact proposal for explicit approval; no external change is made automatically.",
      citations: [findDocumentation("assignment extension")],
      suggestedActions: ["Prepare an assignment extension"],
    };
  }

  if (normalized.includes("i approve")) {
    return {
      mode: "demo",
      answer:
        "The demo proposal is marked approved in this conversation. It was not submitted to NERM because no external write connector is configured.",
    };
  }

  if (normalized.includes("cancel")) {
    return {
      mode: "demo",
      answer: "The demo proposal was cancelled. No external change was made.",
    };
  }

  if (
    normalized.includes("prepare") ||
    normalized.includes("extend") ||
    normalized.includes("extension")
  ) {
    const assignmentId = message.match(/\b(?:assignment[-\s]?)?\d{3,}\b/i)?.[0];
    const newEndDate = message.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    const reasonMatch = message.match(/\b(?:because|reason:?)\s+(.+)$/i);

    if (!assignmentId || !newEndDate || !reasonMatch?.[1]) {
      return {
        mode: "demo",
        answer:
          "Please provide the assignment ID, proposed end date in YYYY-MM-DD format, and business reason. For example: “Extend assignment-1042 to 2026-09-30 because the project timeline changed.”",
      };
    }

    const approval: ApprovalRequest = {
      action: "extend_assignment",
      title: "Approve assignment extension",
      description:
        "Review this demo proposal. Approval does not submit an external NERM change.",
      details: {
        assignmentId,
        newEndDate,
        reason: reasonMatch[1].replace(/\.$/, ""),
      },
    };

    return {
      mode: "demo",
      answer:
        "I prepared the following demo assignment-extension proposal for your review.",
      approval,
    };
  }

  if (/^(hi|hello|hey)\b/.test(normalized)) {
    return {
      mode: "demo",
      answer:
        "Hello! I can help with NERM guidance, sample pending items, profile review, and approval-controlled assignment extensions. NERM-specific records currently use controlled demo data until the production data source is connected.",
      suggestedActions: [
        "Show my pending items",
        "Review my profile",
        "How do assignment extensions work?",
      ],
    };
  }

  return {
    mode: "demo",
    answer:
      "I’m running in demo mode because Gemini Enterprise is not configured. I can help with sample NERM profiles, pending items, documentation, and assignment-extension proposals.",
    suggestedActions: [
      "Show my pending items",
      "Review my profile",
      "How do assignment extensions work?",
    ],
  };
}

function findDocumentation(query: string): Citation {
  const normalized = query.toLowerCase();

  if (normalized.includes("extension") || normalized.includes("assignment")) {
    return {
      title: "NERM Assignment Changes",
      source: "NERM Guide §4.2 (demo content)",
      excerpt:
        "Assignment date changes require a new end date, a business reason, and explicit approval before submission.",
    };
  }

  if (normalized.includes("profile")) {
    return {
      title: "NERM Profile Review",
      source: "NERM Guide §2.1 (demo content)",
      excerpt:
        "Users should verify profile roles and active status before submitting related administrative actions.",
    };
  }

  return {
    title: "NERM Getting Started",
    source: "NERM Guide §1.0 (demo content)",
    excerpt:
      "NERM centralizes research profiles, pending administrative work, and approval-controlled changes.",
  };
}

export class AgentUpstreamError extends Error {}
