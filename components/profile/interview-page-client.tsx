"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Abigail" : "Interviewer"}: ${m.content}`)
    .join("\n\n");
}

export function InterviewPageClient() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [writingProfile, setWritingProfile] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const initializedRef = React.useRef(false);

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      setLoading(true);
      try {
        const res = await fetch("/api/profile/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [] }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Failed to start interview",
          );
        }
        const data = (await res.json()) as ChatMessage;
        setMessages([data]);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start interview",
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/profile/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to get response",
        );
      }
      const data = (await res.json()) as ChatMessage;
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to get response",
      );
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const transcript = formatTranscript(messages);

      const genRes = await fetch("/api/profile/interview/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!genRes.ok) {
        const data = await genRes.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to generate profile",
        );
      }
      const { writingProfile: profile } = (await genRes.json()) as {
        writingProfile: string;
      };

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writingProfile: profile }),
      });
      if (!patchRes.ok) {
        throw new Error("Failed to save writing profile");
      }

      setWritingProfile(profile);
      setDone(true);
      toast.success("Writing profile saved!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate profile",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const userExchangeCount = messages.filter((m) => m.role === "user").length;
  const showGenerate = userExchangeCount >= 4 && !done;

  if (done && writingProfile) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-lg font-semibold">
              Your Writing Profile
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {writingProfile}
            </p>
          </CardContent>
        </Card>
        <div className="flex justify-start">
          <Button asChild variant="outline">
            <Link href="/profile">Back to Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col">
      <Card className="flex flex-col">
        <CardContent className="flex flex-col gap-4 pt-6">
          {/* Message area */}
          <div
            ref={scrollRef}
            className="flex max-h-[60vh] min-h-[300px] flex-col gap-3 overflow-y-auto pr-1"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Composer: single bordered region, send aligned with input */}
          <div
            className={cn(
              "flex min-h-[4.5rem] w-full gap-0 overflow-hidden rounded-lg border border-input bg-background shadow-sm",
              "ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            )}
          >
            <Textarea
              ref={textareaRef}
              placeholder="Type your reply..."
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || generating}
              className="min-h-[4.5rem] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="flex shrink-0 items-end pb-2 pr-2 pl-1 pt-2">
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || loading || generating}
                className="size-10 shrink-0 rounded-md"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Generate button */}
          {showGenerate && (
            <div className="flex justify-center pt-2">
              <Button
                onClick={handleGenerate}
                disabled={generating || loading}
                variant="outline"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating profile...
                  </>
                ) : (
                  "Generate writing profile"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
