// Formatação para a UI. Só na borda: o resto do código trabalha com centavos e Date.

export const FUSO_HORARIO = 'America/Fortaleza'

export function formatarReal(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/** "09/11/2026 14:05" no horário de Fortaleza. */
export function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: FUSO_HORARIO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "14:05" no horário de Fortaleza. */
export function formatarHora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO, hour: '2-digit', minute: '2-digit' })
}

/** Duração curta: "agora", "3 min", "1 h 12 min". */
export function formatarDuracao(ms: number): string {
  const minutos = Math.floor(Math.max(0, ms) / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}
