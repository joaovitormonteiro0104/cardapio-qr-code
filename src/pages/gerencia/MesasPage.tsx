import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { QrCode } from '@/components/QrCode'
import { useConfig } from '@/lib/config'
import * as mesaRepo from '@/repositories/mesaRepo'
import type { Mesa } from '@/schemas/comanda'

function urlDaMesa(numero: number): string {
  return `${window.location.origin}/mesa/${numero}`
}

export default function MesasPage() {
  const { configs } = useConfig()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [numero, setNumero] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setMesas(await mesaRepo.listarMesas())
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível carregar as mesas.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const valor = Number(numero)
    if (!Number.isInteger(valor) || valor <= 0 || valor > 9999) {
      setErro('Informe um número de mesa entre 1 e 9999.')
      return
    }
    setOcupado('nova')
    setErro(null)
    try {
      await mesaRepo.criarMesa(valor)
      setNumero('')
      await carregar()
    } catch (falha) {
      console.error(falha)
      setErro(falha instanceof mesaRepo.MesaDuplicadaError ? `A mesa ${valor} já existe.` : 'Não foi possível criar a mesa.')
    } finally {
      setOcupado(null)
    }
  }

  async function alternar(mesa: Mesa) {
    setOcupado(mesa.id)
    setErro(null)
    try {
      await mesaRepo.definirMesaAtiva(mesa, !mesa.ativa)
      await carregar()
    } catch (falha) {
      console.error(falha)
      setErro(
        falha instanceof mesaRepo.MesaComContaAbertaError
          ? `A mesa ${mesa.numero} está com a conta #${falha.numeroConta} aberta. Feche a conta (aba Contas) antes de desativar.`
          : 'Não foi possível salvar.',
      )
    } finally {
      setOcupado(null)
    }
  }

  const ativas = mesas.filter(m => m.ativa)

  return (
    <LayoutEquipe titulo="Mesas">
      <div className="nao-imprimir">
        <form onSubmit={criar} className="mb-5 flex max-w-md items-end gap-2">
          <div className="flex-1">
            <label htmlFor="nova-mesa" className="rotulo">
              Nova mesa
            </label>
            <input
              id="nova-mesa"
              className="campo tabular-nums"
              inputMode="numeric"
              placeholder="Número"
              value={numero}
              onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button type="submit" className="botao-primario" disabled={ocupado === 'nova'}>
            Adicionar
          </button>
        </form>
        {erro && <p role="alert" className="mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">{erro}</p>}

        <ul className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {mesas.map(mesa => (
            <li key={mesa.id} className="flex items-center justify-between gap-3 rounded-xl bg-superficie px-4 py-2 ring-1 ring-borda">
              <span className={`text-lg font-semibold tabular-nums ${mesa.ativa ? '' : 'text-tinta-suave line-through'}`}>
                Mesa {mesa.numero}
              </span>
              <button type="button" className="botao-secundario text-sm" disabled={ocupado === mesa.id} onClick={() => void alternar(mesa)}>
                {mesa.ativa ? 'Desativar' : 'Ativar'}
              </button>
            </li>
          ))}
        </ul>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">QR Codes para imprimir ({ativas.length})</h2>
          <button type="button" className="botao-primario" disabled={ativas.length === 0} onClick={() => window.print()}>
            Imprimir QR Codes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {ativas.map(mesa => (
          <figure key={mesa.id} className="flex break-inside-avoid flex-col items-center rounded-2xl bg-white p-4 text-center text-black ring-1 ring-borda print:ring-black/30">
            {configs?.nomeEstabelecimento && <p className="text-sm font-semibold">{configs.nomeEstabelecimento}</p>}
            <QrCode texto={urlDaMesa(mesa.numero)} descricao={`QR Code da mesa ${mesa.numero}`} tamanho={160} />
            <figcaption className="mt-2">
              <span className="block text-2xl font-bold tabular-nums">Mesa {mesa.numero}</span>
              <span className="block text-xs">Aponte a câmera para ver o cardápio e pedir</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </LayoutEquipe>
  )
}
