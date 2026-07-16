import { NextResponse } from "next/server";

type ChatRequest = {
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      answer: `The NERM AI Agent received: "${message}"`,
    });
  } catch (error) {
    console.error("Chat request failed:", error);

    return NextResponse.json(
      { error: "Unable to process the request." },
      { status: 500 },
    );
  }
}
