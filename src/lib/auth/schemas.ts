import { z } from "zod";

// Schémas des formulaires d'auth, validés côté serveur avant tout appel à Neon Auth.
// Bornes de mot de passe = défauts de Better Auth (8 à 128 caractères).
const email = z.email().trim().toLowerCase().max(254);

export const signInSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const requestResetSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  otp: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/),
  password: z.string().min(8).max(128),
});
