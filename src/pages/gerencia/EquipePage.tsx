import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { MENSAGENS_NAO_DESATIVA, motivoNaoPodeDesativar } from '@/domain/equipe/regras'
import { useAuth } from '@/hooks/useAuth'
import * as equipeRepo from '@/repositories/equipeRepo'
import type { Funcionario } from '@/repositories/equipeRepo'
import { PinSchema, type Papel } from '@/schemas/auth'

type Acao = { tipo: 'criar' } | { tipo: 'pin'; funcionario: Funcionario } | { tipo: 'desativar'; funcionario: Funcionario } | null

const ROTULO_PAPEL: Record<Papel, string> = { operacao: 'Operação', gerencia: 'Gerência' }

function mensagem(falha: unknown): string {
  if (falha instanceof equipeRepo.ErroEquipe) return falha.message
  return 'Não foi possível concluir. Verifique a conexão e tente de novo.'
}

export default function EquipePage() {
  const { usuario } = useAuth()
  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [acao, setAcao] = useState<Acao>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setEquipe(await equipeRepo.listarFuncionarios())
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível carregar a equipe.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function concluir(texto: string) {
    setAcao(null)
    setAviso(texto)
    await carregar()
  }

  const paraRegra = equipe.map(f => ({ id: f.id, usuarioId: f.usuarioId, papel: f.papel, ativo: f.ativo }))

  return (
    <LayoutEquipe titulo="Equipe">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" className="botao-primario" onClick={() => setAcao({ tipo: 'criar' })}>
          Novo funcionário
        </button>
        <p className="text-sm text-tinta-suave">Cada pessoa entra com a matrícula e um PIN de 6 números.</p>
      </div>
      {aviso && <p role="status" className="mb-4 rounded-xl bg-sucesso-clara px-4 py-3 text-sm font-medium text-sucesso">{aviso}</p>}
      {erro && <p role="alert" className="mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">{erro}</p>}

      <ul className="max-w-3xl divide-y divide-borda rounded-2xl bg-superficie ring-1 ring-borda">
        {equipe.map(f => {
          const bloqueio = usuario ? motivoNaoPodeDesativar({ ...f }, usuario.id, paraRegra) : 'si_mesmo'
          return (
            <li key={f.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${f.ativo ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {f.nome}
                  {usuario?.id === f.usuarioId && <span className="ml-2 text-xs text-tinta-suave">(você)</span>}
                </p>
                <p className="text-sm tabular-nums text-tinta-suave">
                  Matrícula {f.matricula} · {ROTULO_PAPEL[f.papel]}
                  {!f.ativo && <span className="ml-2 font-semibold">Desativado</span>}
                </p>
              </div>
              {f.ativo && (
                <div className="flex gap-2">
                  <button type="button" className="botao-secundario text-sm" onClick={() => setAcao({ tipo: 'pin', funcionario: f })}>
                    Trocar PIN
                  </button>
                  <button
                    type="button"
                    className="botao-secundario text-sm text-perigo"
                    disabled={bloqueio !== null}
                    title={bloqueio ? MENSAGENS_NAO_DESATIVA[bloqueio] : undefined}
                    onClick={() => setAcao({ tipo: 'desativar', funcionario: f })}
                  >
                    Desativar
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {acao?.tipo === 'criar' && <CriarModal aoFechar={() => setAcao(null)} aoConcluir={concluir} />}
      {acao?.tipo === 'pin' && <PinModal funcionario={acao.funcionario} aoFechar={() => setAcao(null)} aoConcluir={concluir} />}
      {acao?.tipo === 'desativar' && (
        <DesativarModal funcionario={acao.funcionario} aoFechar={() => setAcao(null)} aoConcluir={concluir} />
      )}
    </LayoutEquipe>
  )
}

interface PropsModal {
  aoFechar: () => void
  aoConcluir: (aviso: string) => Promise<void>
}

function CriarModal({ aoFechar, aoConcluir }: PropsModal) {
  const id = useId()
  const [matricula, setMatricula] = useState('')
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState<Papel>('operacao')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const validacao = equipeRepo.NovoFuncionarioSchema.safeParse({ matricula, nome, papel, pin })
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Confira os campos.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await equipeRepo.criarFuncionario(validacao.data)
      await aoConcluir(`${validacao.data.nome} foi cadastrado com a matrícula ${validacao.data.matricula}.`)
    } catch (falha) {
      console.error(falha)
      setErro(mensagem(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo="Novo funcionário"
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form={`${id}-form`} className="botao-primario" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={enviar} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-mat`} className="rotulo">Matrícula</label>
            <input id={`${id}-mat`} className="campo tabular-nums" inputMode="numeric" maxLength={6} autoComplete="off" value={matricula} onChange={e => setMatricula(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label htmlFor={`${id}-papel`} className="rotulo">Papel</label>
            <select id={`${id}-papel`} className="campo" value={papel} onChange={e => setPapel(e.target.value === 'gerencia' ? 'gerencia' : 'operacao')}>
              <option value="operacao">Operação (cozinha, caixa, garçom)</option>
              <option value="gerencia">Gerência</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-nome`} className="rotulo">Nome</label>
          <input id={`${id}-nome`} className="campo" maxLength={80} autoComplete="off" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-pin`} className="rotulo">PIN inicial (6 números)</label>
          <input id={`${id}-pin`} type="password" className="campo tracking-[0.4em]" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          <p className="mt-1 text-xs text-tinta-suave">Combine o PIN pessoalmente. Ele não aparece em nenhum outro lugar.</p>
        </div>
        <p role="alert" className="min-h-5 text-sm font-medium text-perigo">{erro}</p>
      </form>
    </Modal>
  )
}

function PinModal({ funcionario, aoFechar, aoConcluir }: PropsModal & { funcionario: Funcionario }) {
  const id = useId()
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!PinSchema.safeParse(pin).success) {
      setErro('O PIN tem exatamente 6 números.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await equipeRepo.trocarPin(funcionario.id, pin)
      await aoConcluir(`PIN de ${funcionario.nome} trocado.`)
    } catch (falha) {
      console.error(falha)
      setErro(mensagem(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo={`Trocar PIN de ${funcionario.nome}`}
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form={`${id}-form`} className="botao-primario" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Trocar PIN'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={enviar} noValidate>
        <label htmlFor={`${id}-pin`} className="rotulo">Novo PIN (6 números)</label>
        <input id={`${id}-pin`} type="password" className="campo tracking-[0.4em]" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">{erro}</p>
      </form>
    </Modal>
  )
}

function DesativarModal({ funcionario, aoFechar, aoConcluir }: PropsModal & { funcionario: Funcionario }) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function desativar() {
    setEnviando(true)
    setErro(null)
    try {
      await equipeRepo.desativar(funcionario.id)
      await aoConcluir(`${funcionario.nome} foi desativado.`)
    } catch (falha) {
      console.error(falha)
      setErro(mensagem(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo={`Desativar ${funcionario.nome}?`}
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="botao-perigo" disabled={enviando} onClick={() => void desativar()}>
            {enviando ? 'Desativando…' : 'Desativar'}
          </button>
        </>
      }
    >
      <p>A matrícula {funcionario.matricula} perde o acesso na hora, inclusive em tablets já abertos. O histórico na auditoria continua.</p>
      <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">{erro}</p>
    </Modal>
  )
}
