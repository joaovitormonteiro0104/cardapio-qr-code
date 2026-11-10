import { z } from 'zod'

/** timestamptz do Postgres ("2026-11-10T01:42:09.123456+00:00") → Date. */
export const DataHoraSchema = z.iso.datetime({ offset: true }).transform(texto => new Date(texto))

/** Igual, aceitando null. */
export const DataHoraOpcionalSchema = DataHoraSchema.nullable()
