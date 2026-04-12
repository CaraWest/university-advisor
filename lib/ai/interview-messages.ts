/**
 * Anthropic Messages API requires a non-empty list that starts with a user message.
 * The interview UI stores the thread from the assistant's opening onward, so we
 * normalize before each create() call.
 */
export const INTERVIEW_KICKOFF_USER_MESSAGE =
  "Hi, I'm ready — let's start whenever you are.";

export type InterviewChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export function toAnthropicInterviewMessages(
  messages: InterviewChatTurn[],
): InterviewChatTurn[] {
  if (messages.length === 0) {
    return [{ role: "user", content: INTERVIEW_KICKOFF_USER_MESSAGE }];
  }
  if (messages[0].role === "assistant") {
    return [
      { role: "user", content: INTERVIEW_KICKOFF_USER_MESSAGE },
      ...messages,
    ];
  }
  return messages;
}
