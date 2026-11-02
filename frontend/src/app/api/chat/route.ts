import { NextResponse } from "next/server";

import {
  AgentUpstreamError,
  runNermAgent,
} from "@/lib/nerm-agent";
import type { ChatRequest, ChatResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequest>;
    const messages = body.messages
      ?.filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 8000),
      }));

    if (!messages?.length || messages.at(-1)?.role !== "user") {
      return NextResponse.json(
        { error: "A user message is required." },
        { status: 400 }
      );
    }

    const response: ChatResponse = await runNermAgent(messages, body.session);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat request failed:", error);

    if (error instanceof AgentUpstreamError) {
      return NextResponse.json(
        {
          error:
            "The school AI service is temporarily unavailable. Please try the request again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Unable to process the request." },
      { status: 500 }
    );
  }
}
