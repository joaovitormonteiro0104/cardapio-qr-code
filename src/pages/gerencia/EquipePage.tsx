import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AvisoFlutuante, type Aviso } from '@/components/AvisoFlutuante'
import { Carregando } from '@/components/Carregando'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { matriculaEquivalente, proximaMatriculaLivre } from '@/domain/equipe/matricula'
import {
  MENSAGENS_NAO_DESATIVA,
  MENSAGENS_NAO_MUDA_PAPEL,
  motivoNaoPodeDesativar,
  motivoNaoPodeMudarPapel,
} from '@/domain/equipe/regras'
import { useAuth } from '@/hooks/useAuth'
import { gerarPin } from '@/lib/pin'
import * as equipeRepo from '@/repositories/equipeRepo'
import type { Funcionario } from '@/repositories/equipeRepo'
import { PinSchema, type Papel } from '@/schemas/auth'

type Acao =
  | { tipo: 'criar' }
  | { tipo: 'pin'; funcionario: Funcionario }
  | { tipo: 'reativar'; funcionario: Funcionario }
  | { tipo: 'desativar'; funcionario: Funcionario }
  | { tipo: 'papel'; funcionario: Funcionario; papel: Papel }
  | null

/** Mostrado uma única vez, grande, para o funcionário anotar. */
type Credencial = { nome: string; matricula: string; pin: string; titulo: string } | null

const ROTULO_PAPEL: Record<Papel, string> = { operacao: 'Operação', gerencia: 'Gerência' }
const DESCRICAO_PAPEL: Record<Papel, string> = {
  operacao: 'Cozinha, caixa e garçom: Pedidos e Contas.',
  gerencia: 'Tudo da Operação, mais cardápio, mesas, equipe, auditoria e configurações.',
}

function mensagem(falha: unknown): string {
  if (falha instanceof equipeRepo.ErroEquipe) return falha.message
  return 'Não foi possível concluir. Verifique a conexão e tente de novo.'
}

export default function EquipePage() {
  const { usuario } = useAuth()
  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)
  const [acao, setAcao] = useState<Acao>(null)
  const [credencial, setCredencial] = useState<Credencial>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const limparAviso = useCallback(() => setAviso(null), [])

  const carregar = useCallback(async () => {
    try {
      setEquipe(await equipeRepo.listarFuncionarios())
      setErroCarga(false)
    } catch (falha) {
      console.error(falha)
      setErroCarga(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function concluir(texto: string, nova?: Credencial) {
    setAcao(null)
    if (nova) setCredencial(nova)
    else setAviso({ tipo: 'ok', texto })
    await carregar()
  }

  const paraRegra = equipe.map(f => ({ id: f.id, usuarioId: f.usuarioId, papel: f.papel, ativo: f.ativo }))
  const matriculas = equipe.map(f => f.matricula)

  return (
    <LayoutEquipe titulo="Equipe">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" className="botao-primario" onClick={() => setAcao({ tipo: 'criar' })}>
          Novo funcionário
        </button>
        <p className="text-sm text-tinta-suave">Cada pessoa entra com a matrícula e um PIN de 6 números.</p>
      </div>

      {carregando ? (
        <Carregando texto="Carregando equipe…" />
      ) : erroCarga ? (
        <div role="alert" className="max-w-3xl rounded-2xl bg-perigo-clara px-6 py-8 text-center text-perigo">
          <p className="font-semibold">Não foi possível carregar a equipe.</p>
          <button type="button" className="botao-primario mt-4" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <ul className="max-w-3xl divide-y divide-borda rounded-2xl bg-superficie ring-1 ring-borda">
          {equipe.map(f => {
            const souEu = usuario?.id === f.usuarioId
            const outroPapel: Papel = f.papel === 'gerencia' ? 'operacao' : 'gerencia'
            const bloqueioDesativar = usuario ? motivoNaoPodeDesativar({ ...f }, usuario.id, paraRegra) : 'si_mesmo'
            const bloqueioPapel = usuario ? motivoNaoPodeMudarPapel({ ...f }, outroPapel, usuario.id, paraRegra) : 'si_mesmo'
            // Motivo visível só quando ajuda (no próprio usuário as ações simplesmente não aparecem).
            const motivoVisivel =
              !souEu && f.ativo && bloqueioDesativar === 'ultimo_gerente' ? MENSAGENS_NAO_DESATIVA.ultimo_gerente : null
            return (
              <li key={f.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${f.ativo ? '' : 'bg-fundo/60'}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {f.nome}
                    {souEu && <span className="text-sm font-normal text-tinta-suave">(você)</span>}
                    <span
                      className={`rounded-md px-2 py-0.5 text-sm font-semibold ${
                        f.papel === 'gerencia' ? 'bg-brasa-clara text-brasa-forte' : 'bg-fundo text-tinta'
                      }`}
                    >
                      {ROTULO_PAPEL[f.papel]}
                    </span>
                    {!f.ativo && <span className="rounded-md bg-perigo-clara px-2 py-0.5 text-sm font-semibold text-perigo">Desativado</span>}
                  </p>
                  <p className="text-sm tabular-nums text-tinta-suave">Matrícula {f.matricula}</p>
                  {motivoVisivel && <p className="mt-1 text-sm text-tinta">{motivoVisivel}</p>}
                </div>
                {f.ativo ? (
                  <details className="relative">
                    <summary className="botao-secundario min-h-11 list-none text-sm" aria-label={`Ações de ${f.nome}`}>
                      Ações ▾
                    </summary>
                    <div
                      className="absolute right-0 z-20 mt-1 flex w-60 flex-col gap-1 rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda"
                      onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}
                    >
                      <button type="button" className="botao justify-start text-sm hover:bg-fundo" onClick={() => setAcao({ tipo: 'pin', funcionario: f })}>
                        Trocar PIN
                      </button>
                      {bloqueioPapel === null && (
                        <button
                          type="button"
                          className="botao justify-start text-sm hover:bg-fundo"
                          onClick={() => setAcao({ tipo: 'papel', funcionario: f, papel: outroPapel })}
                        >
                          {outroPapel === 'gerencia' ? 'Tornar gerente' : 'Mudar para Operação'}
                        </button>
                      )}
                      {bloqueioDesativar === null && (
                        <button
                          type="button"
                          className="botao justify-start text-sm text-perigo hover:bg-perigo-clara"
                          onClick={() => setAcao({ tipo: 'desativar', funcionario: f })}
                        >
                          Desativar acesso
                        </button>
                      )}
                      {souEu && <p className="px-2 py-1 text-sm text-tinta-suave">{MENSAGENS_NAO_MUDA_PAPEL.si_mesmo}</p>}
                    </div>
                  </details>
                ) : (
                  <button type="button" className="botao-secundario text-sm" onClick={() => setAcao({ tipo: 'reativar', funcionario: f })}>
                    Reativar com PIN novo
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {acao?.tipo === 'criar' && (
        <CriarModal matriculas={matriculas} aoFechar={() => setAcao(null)} aoConcluir={concluir} />
      )}
      {acao?.tipo === 'pin' && (
        <PinModal
          titulo={`Trocar PIN de ${acao.funcionario.nome}`}
          botao="Trocar PIN"
          aviso="O PIN antigo deixa de valer na hora."
          executar={pin => equipeRepo.trocarPin(acao.funcionario.id, pin)}
          funcionario={acao.funcionario}
          tituloCredencial="PIN trocado"
          aoFechar={() => setAcao(null)}
          aoConcluir={concluir}
        />
      )}
      {acao?.tipo === 'reativar' && (
        <PinModal
          titulo={`Reativar ${acao.funcionario.nome}`}
          botao="Reativar"
          aviso="A pessoa volta a entrar com este PIN novo. O antigo não vale mais."
          executar={pin => equipeRepo.reativar(acao.funcionario.id, pin)}
          funcionario={acao.funcionario}
          tituloCredencial="Acesso reativado"
          aoFechar={() => setAcao(null)}
          aoConcluir={concluir}
        />
      )}
      {acao?.tipo === 'papel' && (
        <ConfirmarModal
          titulo={acao.papel === 'gerencia' ? `Tornar ${acao.funcionario.nome} gerente?` : `Mudar ${acao.funcionario.nome} para Operação?`}
          texto={DESCRICAO_PAPEL[acao.papel]}
          botao={acao.papel === 'gerencia' ? 'Tornar gerente' : 'Mudar para Operação'}
          executar={() => equipeRepo.mudarPapel(acao.funcionario.id, acao.papel)}
          sucesso={`${acao.funcionario.nome} agora é da ${ROTULO_PAPEL[acao.papel]}.`}
          aoFechar={() => setAcao(null)}
          aoConcluir={concluir}
        />
      )}
      {acao?.tipo === 'desativar' && (
        <ConfirmarModal
          titulo={`Desativar ${acao.funcionario.nome}?`}
          texto={`A matrícula ${acao.funcionario.matricula} perde o acesso na hora, inclusive em tablets já abertos. O histórico na auditoria continua. Para voltar, use "Reativar com PIN novo".`}
          botao="Desativar"
          perigo
          executar={() => equipeRepo.desativar(acao.funcionario.id)}
          sucesso={`${acao.funcionario.nome} foi desativado.`}
          aoFechar={() => setAcao(null)}
          aoConcluir={concluir}
        />
      )}

      <Modal aberto={credencial !== null} titulo={credencial?.titulo ?? ''} aoFechar={() => setCredencial(null)} acoes={
        <button type="button" className="botao-primario" onClick={() => setCredencial(null)}>
          Pronto, já anotou
        </button>
      }>
        {credencial && (
          <>
            <p>
              Mostre para <strong>{credencial.nome}</strong> anotar:
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-fundo p-4 text-center">
              <div>
                <dt className="text-sm text-tinta-suave">Matrícula</dt>
                <dd className="text-3xl font-bold tabular-nums">{credencial.matricula}</dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">PIN</dt>
                <dd className="text-3xl font-bold tracking-widest tabular-nums">{credencial.pin}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-tinta-suave">O PIN não aparece de novo. Se esquecer, troque o PIN aqui na Equipe.</p>
          </>
        )}
      </Modal>

      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
    </LayoutEquipe>
  )
}

interface PropsModal {
  aoFechar: () => void
  aoConcluir: (aviso: string, credencial?: Credencial) => Promise<void>
}

/** Campo de PIN visível (quem digita é o gerente, que vai passar o PIN à pessoa), com "Gerar". */
function CampoPin({
  id,
  valor,
  aoMudar,
  erro,
  rotulo,
}: {
  id: string
  valor: string
  aoMudar: (pin: string) => void
  erro: string | null
  rotulo: string
}) {
  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="campo text-lg tracking-[0.4em] tabular-nums"
          inputMode="numeric"
          maxLength={6}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          value={valor}
          onChange={e => aoMudar(e.target.value.replace(/\D/g, ''))}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : `${id}-ajuda`}
        />
        <button type="button" className="botao-secundario shrink-0 text-sm" onClick={() => aoMudar(gerarPin())}>
          Gerar PIN
        </button>
      </div>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1 text-sm font-medium text-perigo">
          {erro}
        </p>
      ) : (
        <p id={`${id}-ajuda`} className="mt-1 text-sm text-tinta-suave">
          6 números. Depois de salvar, o PIN aparece grande para a pessoa anotar.
        </p>
      )}
    </div>
  )
}

type CampoCriar = 'nome' | 'matricula' | 'pin'

function CriarModal({ matriculas, aoFechar, aoConcluir }: PropsModal & { matriculas: readonly string[] }) {
  const id = useId()
  const [nome, setNome] = useState('')
  const [matricula, setMatricula] = useState(() => proximaMatriculaLivre(matriculas))
  const [papel, setPapel] = useState<Papel>('operacao')
  const [pin, setPin] = useState('')
  const [erros, setErros] = useState<Partial<Record<CampoCriar | 'geral', string>>>({})
  const [enviando, setEnviando] = useState(false)
  const campoNome = useRef<HTMLInputElement>(null)

  useEffect(() => campoNome.current?.focus(), [])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const novos: Partial<Record<CampoCriar, string>> = {}
    const validacao = equipeRepo.NovoFuncionarioSchema.safeParse({ matricula, nome, papel, pin })
    if (!validacao.success) {
      for (const problema of validacao.error.issues) {
        const campo = problema.path[0]
        if ((campo === 'nome' || campo === 'matricula' || campo === 'pin') && !novos[campo]) novos[campo] = problema.message
      }
    }
    const igual = matriculaEquivalente(matricula, matriculas)
    if (!novos.matricula && igual) {
      novos.matricula = igual === matricula ? `A matrícula ${igual} já existe.` : `${matricula} é igual à matrícula ${igual}, que já existe.`
    }
    setErros(novos)
    const primeiro = (['nome', 'matricula', 'pin'] as const).find(c => novos[c])
    if (primeiro || !validacao.success) {
      if (primeiro) document.getElementById(`${id}-${primeiro}`)?.focus()
      return
    }
    setEnviando(true)
    try {
      await equipeRepo.criarFuncionario(validacao.data)
      await aoConcluir('', {
        titulo: 'Funcionário cadastrado',
        nome: validacao.data.nome,
        matricula: validacao.data.matricula,
        pin: validacao.data.pin,
      })
    } catch (falha) {
      console.error(falha)
      setErros({ geral: mensagem(falha) })
    } finally {
      setEnviando(false)
    }
  }

  const descreve = (c: CampoCriar) => (erros[c] ? `${id}-${c}-erro` : undefined)

  return (
    <Modal
      aberto
      titulo="Novo funcionário"
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" form={`${id}-form`} className="botao-primario" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={enviar} noValidate className="space-y-4">
        <div>
          <label htmlFor={`${id}-nome`} className="rotulo">
            Nome
          </label>
          <input
            ref={campoNome}
            id={`${id}-nome`}
            className="campo"
            maxLength={80}
            autoComplete="off"
            value={nome}
            onChange={e => setNome(e.target.value)}
            aria-invalid={erros.nome ? true : undefined}
            aria-describedby={descreve('nome')}
          />
          {erros.nome && (
            <p id={`${id}-nome-erro`} role="alert" className="mt-1 text-sm font-medium text-perigo">
              {erros.nome}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-matricula`} className="rotulo">
            Matrícula
          </label>
          <input
            id={`${id}-matricula`}
            className="campo tabular-nums"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            value={matricula}
            onChange={e => setMatricula(e.target.value.replace(/\D/g, ''))}
            aria-invalid={erros.matricula ? true : undefined}
            aria-describedby={erros.matricula ? `${id}-matricula-erro` : `${id}-matricula-ajuda`}
          />
          {erros.matricula ? (
            <p id={`${id}-matricula-erro`} role="alert" className="mt-1 text-sm font-medium text-perigo">
              {erros.matricula}
            </p>
          ) : (
            <p id={`${id}-matricula-ajuda`} className="mt-1 text-sm text-tinta-suave">
              Sugerimos a próxima livre. No login vale com ou sem os zeros da frente.
            </p>
          )}
        </div>
        <fieldset>
          <legend className="rotulo">Papel</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['operacao', 'gerencia'] as const).map(p => (
              <label
                key={p}
                className={`flex min-h-11 cursor-pointer gap-3 rounded-xl border p-3 ${papel === p ? 'border-brasa bg-brasa-clara/50' : 'border-borda-campo/50'}`}
              >
                <input type="radio" name={`${id}-papel`} className="mt-1 size-5 accent-brasa" checked={papel === p} onChange={() => setPapel(p)} />
                <span>
                  <span className="block font-semibold">{ROTULO_PAPEL[p]}</span>
                  <span className="block text-sm text-tinta-suave">{DESCRICAO_PAPEL[p]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <CampoPin id={`${id}-pin`} rotulo="PIN inicial" valor={pin} aoMudar={setPin} erro={erros.pin ?? null} />
        {erros.geral && (
          <p role="alert" className="text-sm font-medium text-perigo">
            {erros.geral}
          </p>
        )}
      </form>
    </Modal>
  )
}

function PinModal({
  titulo,
  botao,
  aviso,
  executar,
  funcionario,
  tituloCredencial,
  aoFechar,
  aoConcluir,
}: PropsModal & {
  titulo: string
  botao: string
  aviso: string
  executar: (pin: string) => Promise<void>
  funcionario: Funcionario
  tituloCredencial: string
}) {
  const id = useId()
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!PinSchema.safeParse(pin).success) {
      setErro('O PIN tem exatamente 6 números.')
      document.getElementById(id)?.focus()
      return
    }
    setErro(null)
    setErroGeral(null)
    setEnviando(true)
    try {
      await executar(pin)
      await aoConcluir('', { titulo: tituloCredencial, nome: funcionario.nome, matricula: funcionario.matricula, pin })
    } catch (falha) {
      console.error(falha)
      setErroGeral(mensagem(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo={titulo}
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" form={`${id}-form`} className="botao-primario" disabled={enviando}>
            {enviando ? 'Salvando…' : botao}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={enviar} noValidate className="space-y-3">
        <p className="text-tinta-suave">{aviso}</p>
        <CampoPin id={id} rotulo="PIN novo" valor={pin} aoMudar={setPin} erro={erro} />
        {erroGeral && (
          <p role="alert" className="text-sm font-medium text-perigo">
            {erroGeral}
          </p>
        )}
      </form>
    </Modal>
  )
}

function ConfirmarModal({
  titulo,
  texto,
  botao,
  perigo = false,
  executar,
  sucesso,
  aoFechar,
  aoConcluir,
}: PropsModal & { titulo: string; texto: string; botao: string; perigo?: boolean; executar: () => Promise<void>; sucesso: string }) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      await executar()
      await aoConcluir(sucesso)
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
      titulo={titulo}
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className={perigo ? 'botao-perigo' : 'botao-primario'} disabled={enviando} onClick={() => void confirmar()}>
            {enviando ? 'Salvando…' : botao}
          </button>
        </>
      }
    >
      <p>{texto}</p>
      {erro && (
        <p role="alert" className="mt-2 text-sm font-medium text-perigo">
          {erro}
        </p>
      )}
    </Modal>
  )
}
