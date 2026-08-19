import { z } from "zod";
import { BOOK_TYPE_IDS } from "./book-types";

export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

export const bookGenerateSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).optional(),
  topic: z.string().trim().min(1).max(200),
  audience: z.string().trim().min(1).max(100),
  bookType: z.enum(BOOK_TYPE_IDS as [string, ...string[]]),
  pageCount: z.number().int().min(1).max(400),
  difficulty: difficultySchema.default("MEDIUM"),
  trimWidthIn: z.number().positive().max(20),
  trimHeightIn: z.number().positive().max(20),
  bleed: z.boolean().default(false),
  interiorColor: z.enum(["BW", "COLOR"]).default("BW"),
  paperType: z.enum(["WHITE", "CREAM"]).default("WHITE"),
  coverFinish: z.enum(["MATTE", "GLOSSY"]).default("MATTE"),
  description: z.string().trim().max(2000).optional(),
});
export type BookGenerateRequest = z.infer<typeof bookGenerateSchema>;

export const pageRegenerateSchema = z.object({
  pageId: z.string().min(1),
});
export type PageRegenerateRequest = z.infer<typeof pageRegenerateSchema>;

export const coverGenerateSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(200).optional(),
  author: z.string().trim().min(1).max(120),
  style: z.string().trim().max(200).optional(),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{3,6}$/)).min(1).max(4).optional(),
});
export type CoverGenerateRequest = z.infer<typeof coverGenerateSchema>;

export const metadataGenerateSchema = z.object({
  projectId: z.string().min(1),
});
export type MetadataGenerateRequest = z.infer<typeof metadataGenerateSchema>;

export const exportSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["INTERIOR_PDF", "COVER_PDF", "FULL_PACKAGE"]),
});
export type ExportRequest = z.infer<typeof exportSchema>;

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  bookType: z.enum(BOOK_TYPE_IDS as [string, ...string[]]),
});
export type ProjectCreateRequest = z.infer<typeof projectCreateSchema>;
