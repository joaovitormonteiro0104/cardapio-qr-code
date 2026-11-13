import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AvisoFlutuante, type Aviso } from '@/components/AvisoFlutuante'
import { Carregando } from '@/components/Carregando'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { ROTULOS_TIPO_CHAVE, prontidaoPix, tipoChavePix } from '@/domain/pagamento/chavePix'
import { useConfig } from '@/lib/config'
import { formatarDataHora } from '@/lib/formato'
import * as configRepo from '@/repositories/configRepo'
import * as equipeRepo from '@/repositories/equipeRepo'
import { VALIDADORES_CONFIG, type ChaveConfig } from '@/schemas/config'

interface Descricao {
  rotulo: string
  ajuda: string
  sufixo?: string
  numerico?: boolean
  maximo?: number
  padrao?: string
  tipo?: 'tel'
}

const DESCRICOES: Record<ChaveConfig, Descricao> = {
  chave_pix: {
    rotulo: 'Chave Pix',
    ajuda: 'CPF, CNPJ, e-mail, telefone com +55 ou chave aleatória. É para onde vai o dinheiro dos clientes.',
    maximo: 77,
  },
  nome_estabelecimento: {
    rotulo: 'Nome do estabelecimento',
    ajuda: 'Aparece no topo do cardápio e como recebedor no app do banco.',
    maximo: 25,
  },
  cidade_estabelecimento: { rotulo: 'Cidade', ajuda: 'Exigida pelo padrão do Pix.', maximo: 15 },
  telefone_estabelecimento: { rotulo: 'Telefone', ajuda: 'Para contato do cliente.', maximo: 20, tipo: 'tel' },
  janela_edicao_preparando_min: {
    rotulo: 'Tempo para o cliente mudar o pedido depois que a cozinha aceita',
    ajuda: 'Depois disso, só chamando o garçom. 0 = só antes de a cozinha aceitar.',
    sufixo: 'minutos',
    numerico: true,
    padrao: '2',
  },
  timeout_auto_cancelamento_min: {
    rotulo: 'Cancelar pedido que a cozinha não aceitou após',
    ajuda: 'O pedido é cancelado sozinho e o cliente vê o motivo.',
    sufixo: 'minutos',
    numerico: true,
    padrao: '15',
  },
  timeout_sessao_mesa_h: {
    rotulo: 'Mesa parada é destacada após',
    ajuda: 'Sem movimento nesse tempo, a mesa fica destacada. Se estiver paga e sem pedidos em andamento, fecha sozinha.',
    sufixo: 'horas',
    numerico: true,
    padrao: '4',
  },
}

const GRUPOS: { titulo: string; chaves: ChaveConfig[] }[] = [
  { titulo: 'Pagamento Pix', chaves: ['chave_pix', 'nome_estabelecimento', 'cidade_estabelecimento'] },
  { titulo: 'Contato', chaves: ['telefone_estabelecimento'] },
  { titulo: 'Tempos automáticos', chaves: ['janela_edicao_preparando_min', 'timeout_auto_cancelamento_min', 'timeout_sessao_mesa_h'] },
]

type Brutas = Awaited<ReturnType<typeof configRepo.listarConfigsBrutas>>

export default function ConfigPage() {
  const { recarregar: recarregarContexto } = useConfig()
  const [brutas, setBrutas] = useState<Brutas | null>(null)
  const [erroCarga, setErroCarga] = useState(false)
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [rascunhos, setRascunhos] = useState<Partial<Record<ChaveConfig, string>>>({})
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const limparAviso = useCallback(() => setAviso(null), [])

  const carregar = useCallback(async () => {
    try {
      setBrutas(await configRepo.listarConfigsBrutas())
      setErroCarga(false)
    } catch (falha) {
      console.error(falha)
      setErroCarga(true)
    }
  }, [])

  useEffect(() => {
    void carregar()
    equipeRepo
      .listarFuncionarios()
      .then(lista => setNomes(new Map(lista.map(f => [f.matricula, f.nome]))))
      .catch(falha => console.error(falha))
  }, [carregar])

  // Alterações não salvas: o navegador pergunta antes de sair ou recarregar.
  const haRascunho = Object.keys(rascunhos).length > 0
  useEffect(() => {
    if (!haRascunho) return
    const aoSair = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', aoSair)
    return () => window.removeEventListener('beforeunload', aoSair)
  }, [haRascunho])

  const marcarRascunho = useCallback((chave: ChaveConfig, valor: string | null) => {
    setRascunhos(atual => {
      const { [chave]: _antigo, ...resto } = atual
      return valor === null ? resto : { ...resto, [chave]: valor }
    })
  }, [])

  // Valores para o cartão do Pix: o que está digitado (mesmo não salvo) ou o salvo.
  const valorDe = (chave: ChaveConfig) => rascunhos[chave] ?? brutas?.[chave]?.valor ?? ''
  const pix = prontidaoPix({ chave: valorDe('chave_pix'), nome: valorDe('nome_estabelecimento'), cidade: valorDe('cidade_estabelecimento') })

  async function salvar(chave: ChaveConfig, valor: string) {
    await configRepo.setConfig(chave, valor)
    marcarRascunho(chave, null)
    setAviso({ tipo: 'ok', texto: `${DESCRICOES[chave].rotulo}: salvo. Vale em todos os aparelhos em até 1 minuto.` })
    await Promise.all([carregar(), recarregarContexto()])
  }

  if (erroCarga && !brutas) {
    return (
      <LayoutEquipe titulo="Configurações">
        <div role="alert" className="max-w-2xl rounded-2xl bg-perigo-clara px-6 py-8 text-center text-perigo">
          <p className="font-semibold">Não foi possível carregar as configurações.</p>
          <button type="button" className="botao-primario mt-4" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </div>
      </LayoutEquipe>
    )
  }

  return (
    <LayoutEquipe titulo="Configurações">
      {!brutas ? (
        <Carregando texto="Carregando configurações…" />
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* O que mais importa: o Pix está pronto para receber? */}
          <div
            role="status"
            className={`rounded-2xl px-4 py-4 ring-1 ${pix.pronto ? 'bg-sucesso-clara ring-sucesso/30' : 'bg-alerta-clara ring-alerta/40'}`}
          >
            <p className="text-lg font-bold">{pix.pronto ? '✓ Pix pronto para receber' : `Pix incompleto: falta ${pix.faltando.join(', ')}`}</p>
            {pix.pronto ? (
              <p className="mt-1 text-sm">
                No app do banco do cliente aparece: <strong>{pix.nomeNoBanco}</strong> · {pix.cidadeNoBanco}
              </p>
            ) : (
              <p className="mt-1 text-sm">Sem isso, o cliente vê “Pagamento pelo celular indisponível” e precisa chamar um atendente.</p>
            )}
            {haRascunho && <p className="mt-1 text-sm font-medium">Há mudanças ainda não salvas abaixo.</p>}
          </div>

          {GRUPOS.map(grupo => (
            <section key={grupo.titulo} aria-labelledby={`grupo-${grupo.titulo}`}>
              <h2 id={`grupo-${grupo.titulo}`} className="mb-2 text-lg font-semibold">
                {grupo.titulo}
              </h2>
              <ul className="divide-y divide-borda rounded-2xl bg-superficie ring-1 ring-borda">
                {grupo.chaves.map(chave => (
                  <LinhaConfig
                    key={chave}
                    chave={chave}
                    atual={brutas[chave]}
                    nomes={nomes}
                    aoMudar={marcarRascunho}
                    aoSalvar={valor => salvar(chave, valor)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
    </LayoutEquipe>
  )
}

interface PropsLinha {
  chave: ChaveConfig
  atual: Brutas[string] | undefined
  nomes: ReadonlyMap<string, string>
  aoMudar: (chave: ChaveConfig, valor: string | null) => void
  aoSalvar: (valor: string) => Promise<void>
}

function LinhaConfig({ chave, atual, nomes, aoMudar, aoSalvar }: PropsLinha) {
  const descricao = DESCRICOES[chave]
  const salvo = atual?.valor ?? ''
  const [valor, setValor] = useState(salvo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarChave, setConfirmarChave] = useState(false)
  const id = `config-${chave}`

  useEffect(() => setValor(salvo), [salvo])

  const alterado = valor.trim() !== salvo.trim()
  const tipoChave = chave === 'chave_pix' ? tipoChavePix(valor) : null

  function mudar(novo: string) {
    setValor(novo)
    setErro(null)
    aoMudar(chave, novo.trim() !== salvo.trim() ? novo : null)
  }

  function desfazer() {
    mudar(salvo)
  }

  async function gravar() {
    setConfirmarChave(false)
    setSalvando(true)
    try {
      await aoSalvar(valor)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível salvar. Verifique a conexão e tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!alterado) return
    const validacao = VALIDADORES_CONFIG[chave].safeParse(valor)
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Valor inválido.')
      document.getElementById(id)?.focus()
      return
    }
    // Trocar para onde vai o dinheiro sempre pede confirmação.
    if (chave === 'chave_pix') {
      setConfirmarChave(true)
      return
    }
    void gravar()
  }

  const descreve = [erro ? `${id}-erro` : null, `${id}-ajuda`].filter(Boolean).join(' ')
  const autor = atual?.atualizadoPor && atual.atualizadoPor !== 'seed' ? atual.atualizadoPor : null
  const nomeAutor = autor ? (nomes.get(autor) ? `${nomes.get(autor)} (${autor})` : autor) : null

  return (
    <li className="px-4 py-4">
      <form onSubmit={enviar} noValidate>
        <label htmlFor={id} className="rotulo">
          {descricao.rotulo}
          {alterado && <span className="ml-2 rounded bg-alerta-clara px-1.5 text-sm font-semibold text-tinta">não salvo</span>}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex min-w-0 items-center gap-2 ${descricao.numerico ? '' : 'flex-1'}`}>
            <input
              id={id}
              className={`campo ${descricao.numerico ? 'w-24 tabular-nums' : ''}`}
              type={descricao.tipo ?? 'text'}
              inputMode={descricao.numerico ? 'numeric' : descricao.tipo === 'tel' ? 'tel' : undefined}
              maxLength={descricao.maximo}
              autoCapitalize={chave === 'chave_pix' ? 'off' : undefined}
              autoCorrect={chave === 'chave_pix' ? 'off' : undefined}
              spellCheck={chave === 'chave_pix' ? false : undefined}
              value={valor}
              onChange={e => mudar(e.target.value)}
              aria-invalid={erro ? true : undefined}
              aria-describedby={descreve}
            />
            {descricao.sufixo && <span className="text-tinta-suave">{descricao.sufixo}</span>}
          </div>
          <button
            type="submit"
            className={alterado ? 'botao-primario' : 'botao-secundario'}
            disabled={!alterado || salvando}
            aria-label={`Salvar ${descricao.rotulo}`}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {alterado && !salvando && (
            <button type="button" className="text-sm font-semibold text-brasa-forte underline" onClick={desfazer}>
              Desfazer
            </button>
          )}
        </div>
        {erro && (
          <p id={`${id}-erro`} role="alert" className="mt-1 text-sm font-medium text-perigo">
            {erro}
          </p>
        )}
        <p id={`${id}-ajuda`} className="mt-1 text-sm text-tinta-suave">
          {descricao.ajuda}
          {descricao.padrao && <> Padrão: {descricao.padrao} {descricao.sufixo}.</>}
          {descricao.maximo && !descricao.numerico && chave !== 'telefone_estabelecimento' && (
            <span className="tabular-nums">
              {' '}
              ({valor.length}/{descricao.maximo})
            </span>
          )}
        </p>
        {tipoChave && tipoChave !== 'vazia' && (
          <p className={`mt-1 text-sm font-medium ${tipoChave === 'desconhecida' ? 'text-perigo' : 'text-sucesso'}`}>
            {tipoChave === 'desconhecida' ? 'Formato não reconhecido: confira a chave.' : `Reconhecida como ${ROTULOS_TIPO_CHAVE[tipoChave]}.`}
          </p>
        )}
        {nomeAutor && atual && (
          <p className="mt-1 text-sm text-tinta-suave">
            Alterado por {nomeAutor} em {formatarDataHora(new Date(atual.atualizadoEm))}
          </p>
        )}
      </form>

      {chave === 'chave_pix' && (
        <Modal
          aberto={confirmarChave}
          titulo="Trocar a chave Pix?"
          aoFechar={() => setConfirmarChave(false)}
          acoes={
            <>
              <button type="button" className="botao-secundario" onClick={() => setConfirmarChave(false)}>
                Voltar
              </button>
              <button type="button" className="botao-primario" onClick={() => void gravar()}>
                Sim, trocar a chave
              </button>
            </>
          }
        >
          <p>Os próximos pagamentos dos clientes vão para a chave nova.</p>
          <dl className="mt-3 space-y-2 rounded-xl bg-fundo px-4 py-3 text-sm">
            <div>
              <dt className="text-tinta-suave">Antes</dt>
              <dd className="break-all font-semibold">{salvo || '(sem chave)'}</dd>
            </div>
            <div>
              <dt className="text-tinta-suave">Depois{tipoChave ? ` · ${ROTULOS_TIPO_CHAVE[tipoChave]}` : ''}</dt>
              <dd className="break-all font-semibold">{valor.trim() || '(sem chave)'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-tinta-suave">Dica: depois de salvar, faça um Pix de teste de valor pequeno pela tela Pagar.</p>
        </Modal>
      )}
    </li>
  )
}
