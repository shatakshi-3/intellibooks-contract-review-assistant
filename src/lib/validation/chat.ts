import { z } from "zod";

export const chatSessionParamsSchema = z.object({
  id: z.string().uuid("Invalid contract ID"),
  sessionId: z.string().uuid("Invalid session ID"),
});

export const createSessionSchema = z.object({
  title: z.string().trim().max(100, "Title cannot exceed 100 characters").optional(),
});

export const sendMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(5000, "Message cannot exceed 5000 characters"),
});

export const quickChatSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID").optional(),
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(5000, "Message cannot exceed 5000 characters"),
});
