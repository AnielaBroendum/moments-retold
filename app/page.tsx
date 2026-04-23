"use client";

import { useState } from "react";

type Tone = "nostalgic" | "cinematic" | "funny";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [story, setStory] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [tone, setTone] = useState<Tone>("nostalgic");
  const [videoLoading, setVideoLoading] = useState(false);

  const toneOptions: Tone[] = ["nostalgic", "cinematic", "funny"];

  const buttonLabel = {
    nostalgic: "Reveal the memory",
    cinematic: "Set the scene",
    funny: "Tell the story",
  }[tone];

  async function handleGenerate() {
    if (!file) return;

    try {
      setLoading(true);
      setError("");
      setStory("");
      setAudioUrl("");

      setLoadingStep("Interpreting the moment...");

      const formData = new FormData();
      formData.append("image", file);
      formData.append("tone", tone);

      await new Promise((resolve) => setTimeout(resolve, 250));

      setLoadingStep("Shaping the story...");

      const storyRes = await fetch("/api/generate-story", {
        method: "POST",
        body: formData,
      });

      let storyData: any = null;
      try {
        storyData = await storyRes.json();
      } catch {
        storyData = null;
      }

      if (!storyRes.ok) {
        throw new Error(storyData?.error || "Story generation failed");
      }

      const generatedStory = storyData?.story;
      if (!generatedStory) {
        throw new Error("No story was returned");
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
      setStory(generatedStory);

      setTimeout(() => {
        document
          .getElementById("story-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);

      setLoadingStep("Giving it a voice...");

      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: generatedStory,
        }),
      });

      if (!ttsRes.ok) {
        let errorMessage = "Voice generation failed";

        try {
          const ttsErrorData = await ttsRes.json();
          errorMessage = ttsErrorData?.error || errorMessage;
        } catch {
          try {
            const rawText = await ttsRes.text();
            if (rawText) errorMessage = rawText;
          } catch { }
        }

        throw new Error(errorMessage);
      }

      const audioBlob = await ttsRes.blob();
      const newAudioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(newAudioUrl);

      setTimeout(() => {
        document
          .getElementById("audio-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;

    setFile(selectedFile);
    setStory("");
    setAudioUrl("");
    setError("");

    if (selectedFile) {
      const previewUrl = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(previewUrl);
    } else {
      setImagePreviewUrl("");
    }
  }

  function downloadStory() {
    if (!story) return;

    const blob = new Blob([story], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "picture-story.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  async function downloadVideo() {
    if (!imagePreviewUrl || !audioUrl) return;

    try {
      setVideoLoading(true);
      setError("");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not create canvas context");
      }

      const safeCtx = ctx;

      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = imagePreviewUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to load image"));
      });

      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("Failed to load audio"));
      });

      const stream = canvas.captureStream(30);
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      const source = audioContext.createMediaElementSource(audio);
      source.connect(destination);
      source.connect(audioContext.destination);

      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const recorded = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      function drawFrame() {
        safeCtx.fillStyle = "#f5f5f4";
        safeCtx.fillRect(0, 0, width, height);

        const imgAspect = image.width / image.height;
        const canvasAspect = width / height;

        let drawWidth = width;
        let drawHeight = height;
        let dx = 0;
        let dy = 0;

        if (imgAspect > canvasAspect) {
          drawHeight = height;
          drawWidth = height * imgAspect;
          dx = (width - drawWidth) / 2;
        } else {
          drawWidth = width;
          drawHeight = width / imgAspect;
          dy = (height - drawHeight) / 2;
        }

        safeCtx.drawImage(image, dx, dy, drawWidth, drawHeight);

        safeCtx.fillStyle = "rgba(0,0,0,0.28)";
        safeCtx.fillRect(0, height - 170, width, 170);

        safeCtx.fillStyle = "#ffffff";
        safeCtx.font = "600 44px sans-serif";
        safeCtx.fillText("Every picture has a story", 60, height - 105);

        safeCtx.font = "28px sans-serif";
        safeCtx.fillText(`Tone: ${tone}`, 60, height - 55);
      }

      drawFrame();
      recorder.start(250);

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const renderLoop = setInterval(drawFrame, 1000 / 30);

      await audio.play();

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
      });

      clearInterval(renderLoop);
      recorder.stop();

      const videoBlob = await recorded;
      const videoUrl = URL.createObjectURL(videoBlob);

      const link = document.createElement("a");
      link.href = videoUrl;
      link.download = "picture-story-video.webm";
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(videoUrl);
      source.disconnect();
      audioContext.close();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Video export failed");
    } finally {
      setVideoLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-neutral-900">
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.45s ease-out;
        }
      `}</style>

      <div className="mx-auto max-w-5xl px-6 py-16 md:px-10 md:py-20">
        <div className="mb-16 max-w-2xl">
          <p className="mb-4 text-xs uppercase tracking-[0.25em] text-[#7D2027]/80">
            Moments, retold
          </p>

          <h1 className="text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
            What does this picture say?
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 md:text-lg">
            Upload a photo and hear one possible story behind it.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <div className="border-b border-neutral-200/60 px-6 py-5 md:px-8">
              <p className="text-sm font-medium text-neutral-800">
                Upload and configure
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Choose an image and the storytelling style.
              </p>
            </div>

            <div className="space-y-8 px-6 py-6 md:px-8 md:py-8">
              <div>
                <label className="mb-3 block text-sm font-medium text-neutral-800">
                  Image
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-neutral-300 bg-stone-50 px-6 py-10 text-center transition hover:border-neutral-400 hover:bg-stone-100/60">
                  <span className="text-sm font-medium text-neutral-700">
                    {file ? "Replace image" : "Click to upload an image"}
                  </span>
                  <span className="mt-2 text-sm text-neutral-500">
                    JPG, PNG, or similar
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-neutral-800">Tone</p>

                <div className="flex flex-wrap gap-4">
                  {toneOptions.map((option) => {
                    const selected = tone === option;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTone(option)}
                        className={`rounded-full px-4 py-2.5 text-sm font-medium capitalize transition ${selected
                          ? "bg-[#7D2027] text-white shadow-sm"
                          : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"
                          }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={!file || loading}
                  className="inline-flex min-w-[190px] items-center justify-center rounded-full bg-[#7D2027] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#661A21] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? loadingStep || "Generating..." : buttonLabel}
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
                  {error}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-10">
            <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
              <div className="border-b border-neutral-200/60 px-6 py-5 md:px-8">
                <p className="text-sm font-medium text-neutral-700">Image</p>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded preview"
                    className="aspect-[4/5] w-full rounded-[24px] object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[24px] bg-stone-100 px-6 text-center text-sm text-neutral-500">
                    Start with a moment.
                  </div>
                )}
              </div>
            </div>

            <div
              id="story-section"
              className={`overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5 ${story ? "animate-fade-in-up" : ""
                }`}
            >
              <div className="border-b border-neutral-200/60 px-6 py-5 md:px-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-neutral-700">Story</p>

                  {story && (
                    <button
                      type="button"
                      onClick={downloadStory}
                      className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-[#7D2027]/5 hover:text-[#7D2027]"
                    >
                      Download text
                    </button>
                  )}
                </div>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                {story ? (
                  <>
                    <p className="mb-4 text-sm italic text-neutral-500">
                      This is one possible story…
                    </p>
                    <p className="max-w-[60ch] whitespace-pre-wrap text-[18px] leading-[1.9] text-neutral-800">
                      {story}
                    </p>
                    <p className="mt-6 text-sm italic text-neutral-500">
                      Every picture holds more than one story.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-7 text-neutral-500">
                    Once interpreted, the story will appear here.
                  </p>
                )}
              </div>
            </div>

            <div
              id="audio-section"
              className={`overflow-hidden rounded-[28px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5 ${audioUrl ? "animate-fade-in-up" : ""
                }`}
            >
              <div className="border-b border-neutral-200/60 px-6 py-5 md:px-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-neutral-700">
                    Narration
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {audioUrl && (
                      <a
                        href={audioUrl}
                        download="picture-story.mp3"
                        className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-[#7D2027]/5 hover:text-[#7D2027]"
                      >
                        Download audio
                      </a>
                    )}

                    {audioUrl && imagePreviewUrl && (
                      <button
                        type="button"
                        onClick={downloadVideo}
                        disabled={videoLoading}
                        className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-[#7D2027]/5 hover:text-[#7D2027] disabled:opacity-50"
                      >
                        {videoLoading ? "Creating video..." : "Download video"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                {audioUrl ? (
                  <>
                    <p className="mb-3 text-sm text-neutral-500">
                      Listen to the narration
                    </p>
                    <audio controls autoPlay src={audioUrl} className="w-full" />
                  </>
                ) : (
                  <p className="text-sm leading-7 text-neutral-500">
                    The voice will follow.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-16 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
          <p>
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/anielabrondum/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition hover:text-[#7D2027]"
            >
              Aniela Brøndum
            </a>
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Exploring voice-first storytelling
          </p>
        </footer>
      </div>
    </main>
  );
}