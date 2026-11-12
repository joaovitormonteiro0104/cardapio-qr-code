// Bipe curto gerado pelo próprio navegador (Web Audio), sem arquivo de som.
// O navegador só libera áudio depois de um toque do usuário: por isso o
// contexto é criado no clique de "Ativar som".

let contexto: AudioContext | null = null

/** Chame dentro de um clique. Devolve false se o aparelho não tem áudio. */
export function liberarSom(): boolean {
  try {
    contexto ??= new AudioContext()
    void contexto.resume()
    return true
  } catch {
    return false
  }
}

/** Dois bipes curtos. Silencioso se o som não foi liberado. */
export function bipe(): void {
  if (!contexto || contexto.state !== 'running') return
  const agora = contexto.currentTime
  for (const inicio of [0, 0.22]) {
    const osc = contexto.createOscillator()
    const volume = contexto.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    volume.gain.setValueAtTime(0.0001, agora + inicio)
    volume.gain.exponentialRampToValueAtTime(0.3, agora + inicio + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + inicio + 0.18)
    osc.connect(volume).connect(contexto.destination)
    osc.start(agora + inicio)
    osc.stop(agora + inicio + 0.2)
  }
}
