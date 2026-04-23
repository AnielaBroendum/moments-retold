import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const tone = (formData.get("tone") as string) || "nostalgic";

    if (!file) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    const promptByTone: Record<string, string> = {
      nostalgic: `Look at this image and write a short nostalgic story inspired by it.
Max 120 words.
Do not assume identities or sensitive personal details.
Focus on atmosphere, memory, and emotion.
Write elegantly and simply.`,

      cinematic: `Look at this image and write a short cinematic story inspired by it.
Max 120 words.
Do not assume identities or sensitive personal details.
Make it vivid, visual, and dramatic without being over-the-top.`,

      funny: `Look at this image and write a short funny story inspired by it.
Max 120 words.
Do not assume identities or sensitive personal details.
Keep it playful, charming, and light.`,
    };

    const prompt = promptByTone[tone] || promptByTone.nostalgic;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const story = response.output_text;

    if (!story) {
      return NextResponse.json(
        { error: "No story returned from OpenAI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ story });
  } catch (error) {
    console.error("Story error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Story generation failed",
      },
      { status: 500 }
    );
  }
}