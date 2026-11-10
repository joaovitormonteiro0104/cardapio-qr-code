import { supabase } from './supabase'
import type { Ator, NovoEvento } from '@/domain/auditoria/evento'
import { DOMINIO_EMAIL_SINTETICO } from '@/schemas/auth'

/**
 * Grava um evento no log append-only (AGENTS.md §6.10).
 *
 * Chamado pelo repository que fez a mutação, logo depois da escrita. NÃO lança
 * erro: a mutação já aconteceu e não pode ser desfeita daqui; uma falha aqui é
 * registrada no console de forma visível (limitação aceita no MVP).
 */
export async function registrar(evento: NovoEvento): Promise<void> {
  const { error } = await supabase.from('eventos_auditoria').insert({
    comanda_id: evento.comandaId,
    pedido_id: evento.pedidoId,
    ator_tipo: evento.ator.tipo,
    ator_id: evento.ator.id,
    tipo_evento: evento.tipoEvento,
    payload: evento.payload,
    motivo: evento.motivo,
  })
  if (error) {
    console.error(
      `%c[AUDITORIA] evento NÃO gravado: ${evento.tipoEvento}`,
      'color:#fff;background:#b91c1c;padding:2px 6px;border-radius:4px',
      error.message,
      evento,
    )
  }
}

/**
 * Ator da sessão atual: funcionário (pela matrícula do email sintético) ou
 * cliente (pelo auth.uid()).
 */
export async function atorDaSessao(): Promise<Ator> {
  const { data } = await supabase.auth.getSession()
  const usuario = data.session?.user
  if (!usuario) throw new Error('atorDaSessao: ninguém logado')

  const sufixo = `@${DOMINIO_EMAIL_SINTETICO}`
  const email = usuario.email ?? ''
  if (!usuario.is_anonymous && email.endsWith(sufixo)) {
    return { tipo: 'funcionario', id: email.slice(0, -sufixo.length) }
  }
  return { tipo: 'cliente', id: usuario.id }
}
