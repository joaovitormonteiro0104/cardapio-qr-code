// Atalhos de período da Auditoria ("Hoje", "Ontem"...). Puro: recebe o dia de
// hoje já no fuso do estabelecimento, como "2026-11-13".

export type AtalhoPeriodo = 'hoje' | 'ontem' | 'semana' | 'mes'

export const ROTULOS_ATALHO: Record<AtalhoPeriodo, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Últimos 7 dias',
  mes: 'Este mês',
}

function deslocar(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function periodoDoAtalho(atalho: AtalhoPeriodo, hoje: string): { inicio: string; fim: string } {
  switch (atalho) {
    case 'hoje':
      return { inicio: hoje, fim: hoje }
    case 'ontem': {
      const ontem = deslocar(hoje, -1)
      return { inicio: ontem, fim: ontem }
    }
    case 'semana':
      return { inicio: deslocar(hoje, -6), fim: hoje }
    case 'mes':
      return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje }
  }
}

/** Qual atalho corresponde ao período escolhido (para destacar o botão), ou null. */
export function atalhoAtivo(inicio: string, fim: string, hoje: string): AtalhoPeriodo | null {
  return (Object.keys(ROTULOS_ATALHO) as AtalhoPeriodo[]).find(a => {
    const p = periodoDoAtalho(a, hoje)
    return p.inicio === inicio && p.fim === fim
  }) ?? null
}
