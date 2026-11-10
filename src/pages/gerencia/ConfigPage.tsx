import { useCallback, useEffect, useState } from 'react'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { useConfig } from '@/lib/config'
import { formatarDataHora } from '@/lib/formato'
import * as configRepo from '@/repositories/configRepo'
import { CHAVES_CONFIG, VALIDADORES_CONFIG, type ChaveConfig } from '@/schemas/config'

interface Descricao {
  rotulo: string
  ajuda: string
  sufixo?: string
  numerico?: boolean
}

const DESCRICOES: Record<ChaveConfig, Descricao> = {
  janela_edicao_preparando_min: {
    rotulo: 'Janela de edição em preparo',
    ajuda: 'Por quantos minutos depois que a cozinha aceita o cliente ainda pode mudar ou cancelar sozinho. 0 = só antes de aceitar.',
    sufixo: 'min',
    numerico: true,
  },
  timeout_auto_cancelamento_min: {
    rotulo: 'Cancelar pedido não aceito após',
    ajuda: 'Pedido que a cozinha não aceitar nesse tempo é cancelado automaticamente.',
    sufixo: 'min',
    numerico: true,
  },
  timeout_sessao_mesa_h: {
    rotulo: 'Mesa inativa após',
    ajuda: 'Horas sem movimento até a mesa ser destacada (e fechada sozinha, se paga e sem pedidos em andamento).',
    sufixo: 'h',
    numerico: true,
  },
  chave_pix: {
    rotulo: 'Chave Pix',
    ajuda: 'CPF, CNPJ, e-mail, telefone (+55…) ou chave aleatória. Sem ela, o pagamento pelo celular fica indisponível.',
  },
  nome_estabelecimento: {
    rotulo: 'Nome do estabelecimento',
    ajuda: 'Aparece no topo do cardápio e no Pix (até 25 caracteres).',
  },
  cidade_estabelecimento: {
    rotulo: 'Cidade',
    ajuda: 'Exigida pelo padrão do Pix (até 15 caracteres).',
  },
  telefone_estabelecimento: {
    rotulo: 'Telefone',
    ajuda: 'Para contato do cliente.',
  },
}

type Brutas = Awaited<ReturnType<typeof configRepo.listarConfigsBrutas>>

export default function ConfigPage() {
  const { recarregar: recarregarContexto } = useConfig()
  const [brutas, setBrutas] = useState<Brutas>({})
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setBrutas(await configRepo.listarConfigsBrutas())
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível carregar as configurações.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <LayoutEquipe titulo="Configurações">
      {erro && <p role="alert" className="mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">{erro}</p>}
      <p className="mb-5 max-w-2xl text-tinta-suave">As mudanças valem para todos os aparelhos em até um minuto, sem atualizar o app.</p>
      <ul className="max-w-2xl divide-y divide-borda rounded-2xl bg-superficie ring-1 ring-borda">
        {CHAVES_CONFIG.map(chave => (
          <LinhaConfig
            key={chave}
            chave={chave}
            atual={brutas[chave]}
            aoSalvar={async valor => {
              await configRepo.setConfig(chave, valor)
              await Promise.all([carregar(), recarregarContexto()])
            }}
          />
        ))}
      </ul>
    </LayoutEquipe>
  )
}

interface PropsLinha {
  chave: ChaveConfig
  atual: Brutas[string] | undefined
  aoSalvar: (valor: string) => Promise<void>
}

function LinhaConfig({ chave, atual, aoSalvar }: PropsLinha) {
  const descricao = DESCRICOES[chave]
  const [valor, setValor] = useState('')
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const id = `config-${chave}`

  useEffect(() => setValor(atual?.valor ?? ''), [atual?.valor])

  const alterado = atual !== undefined && valor !== atual.valor

  async function salvar() {
    const validacao = VALIDADORES_CONFIG[chave].safeParse(valor)
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Valor inválido.')
      return
    }
    setErro(null)
    setEstado('salvando')
    try {
      await aoSalvar(valor)
      setEstado('salvo')
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível salvar.')
      setEstado('ocioso')
    }
  }

  return (
    <li className="px-4 py-4">
      <label htmlFor={id} className="rotulo">
        {descricao.rotulo}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            id={id}
            className={`campo ${descricao.numerico ? 'max-w-32 tabular-nums' : ''}`}
            inputMode={descricao.numerico ? 'numeric' : undefined}
            value={valor}
            onChange={e => {
              setValor(e.target.value)
              setEstado('ocioso')
              setErro(null)
            }}
            aria-describedby={`${id}-ajuda`}
          />
          {descricao.sufixo && <span className="text-tinta-suave">{descricao.sufixo}</span>}
        </div>
        <button type="button" className="botao-secundario" disabled={!alterado || estado === 'salvando'} onClick={() => void salvar()}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <p id={`${id}-ajuda`} className="mt-1 text-sm text-tinta-suave">
        {descricao.ajuda}
      </p>
      <p role="status" className="mt-1 min-h-5 text-sm">
        {erro && <span className="font-medium text-perigo">{erro}</span>}
        {!erro && estado === 'salvo' && <span className="text-sucesso">Salvo.</span>}
        {!erro && estado !== 'salvo' && atual?.atualizadoPor && atual.atualizadoPor !== 'seed' && (
          <span className="text-tinta-suave">
            Alterado por {atual.atualizadoPor} em {formatarDataHora(new Date(atual.atualizadoEm))}
          </span>
        )}
      </p>
    </li>
  )
}
