import { z } from 'zod'

/**
 * Domínio dos emails sintéticos dos funcionários (AGENTS.md §6.9).
 * Matrícula 001 vira 001@restaurante.local. O funcionário nunca vê isso.
 */
export const DOMINIO_EMAIL_SINTETICO = 'restaurante.local'

/** Matrícula: só dígitos, de 1 a 6. Espaços nas pontas são ignorados. */
export const MatriculaSchema = z
  .string()
  .trim()
  .regex(/^\d{1,6}$/, 'A matrícula tem de 1 a 6 números.')

/** PIN: exatamente 6 dígitos numéricos (mínimo de senha do Supabase Auth). */
export const PinSchema = z.string().regex(/^\d{6}$/, 'O PIN tem exatamente 6 números.')

export const LoginSchema = z.object({
  matricula: MatriculaSchema,
  pin: PinSchema,
})
export type Login = z.infer<typeof LoginSchema>

export const PAPEIS = ['operacao', 'gerencia'] as const
export const PapelSchema = z.enum(PAPEIS)
export type Papel = z.infer<typeof PapelSchema>

/** Converte a matrícula no email sintético usado no Supabase Auth. */
export function emailSintetico(matricula: string): string {
  return `${MatriculaSchema.parse(matricula)}@${DOMINIO_EMAIL_SINTETICO}`
}
