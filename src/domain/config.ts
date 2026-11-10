// Configurações de tempo usadas pelas regras de domínio (valores vêm de
// `configuracoes`, AGENTS.md §10 — nunca hardcode).
export interface ConfigsTempo {
  janelaEdicaoPreparandoMin: number
  timeoutAutoCancelamentoMin: number
  timeoutSessaoMesaH: number
}

export const MS_POR_MINUTO = 60_000
export const MS_POR_HORA = 3_600_000
