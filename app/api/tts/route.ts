import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        const voiceId = process.env.ELEVENLABS_VOICE_ID;
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!voiceId) {
            return NextResponse.json(
                { error: "Missing ELEVENLABS_VOICE_ID in .env.local" },
                { status: 500 }
            );
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: "Missing ELEVENLABS_API_KEY in .env.local" },
                { status: 500 }
            );
        }

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_flash_v2_5",
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs API error:", errorText);

            return NextResponse.json(
                { error: errorText },
                { status: response.status }
            );
        }

        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        });
    } catch (error) {
        console.error("TTS route crashed:", error);
        return NextResponse.json({ error: "TTS route crashed" }, { status: 500 });
    }
}