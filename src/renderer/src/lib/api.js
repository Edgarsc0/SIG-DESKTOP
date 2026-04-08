const DRF_BASE_URL = import.meta.env.VITE_API_URL || 'https://sig-desktop-api.onrender.com'
const CHUNK_SIZE = 500
const PARALLEL_REQUESTS = 3
const FETCH_TIMEOUT = 60000

export const API_CONFIG = {
  baseUrl: DRF_BASE_URL,
  chunkSize: CHUNK_SIZE,
  parallelRequests: PARALLEL_REQUESTS,
  timeout: FETCH_TIMEOUT
}

async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

async function cargarChunksEnParalelo(rows, endpoint, label, agregarLog, extraBody = {}) {
  const total = rows.length
  const totalChunks = Math.ceil(total / CHUNK_SIZE)
  agregarLog(
    `  ${total.toLocaleString()} filas — ${totalChunks} lote(s) — paralelo x${PARALLEL_REQUESTS}`
  )

  const batches = []
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    batches.push({ index: i, chunk: rows.slice(i, i + CHUNK_SIZE) })
  }

  let insertadas = 0

  for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
    const group = batches.slice(i, i + PARALLEL_REQUESTS)
    const batchNum = i / PARALLEL_REQUESTS + 1

    const results = await Promise.allSettled(
      group.map(({ index, chunk }) =>
        fetchWithTimeout(`${DRF_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk, ...extraBody })
        }).then((res) => res.json())
      )
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const chunkStart = group[j].index + 1
      const chunkEnd = Math.min(group[j].index + CHUNK_SIZE, total)

      if (result.status === 'rejected') {
        agregarLog(
          `ERROR BD ${label} [lote ${batchNum + j}/${totalChunks}]: ${result.reason?.message || result.reason}`
        )
        return { success: false, insertadas }
      }

      const data = result.value
      if (!data.ok) {
        agregarLog(
          `ERROR BD ${label} [lote ${batchNum + j}/${totalChunks}]: ${data.error || 'Error desconocido'}`
        )
        return { success: false, insertadas }
      }

      insertadas += data.insertadas ?? group[j].chunk.length
      agregarLog(`  Lote ${batchNum + j}/${totalChunks}: filas ${chunkStart}–${chunkEnd} OK`)
    }
  }

  return { success: true, insertadas }
}

export async function cargarSimple(rows, endpoint, truncarTabla, label, agregarLog) {
  agregarLog(`  Truncando ${truncarTabla}...`)
  try {
    const tRes = await fetchWithTimeout(`${DRF_BASE_URL}/api/truncar-tabla/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: truncarTabla })
    })
    const tData = await tRes.json()
    if (!tData.ok) {
      agregarLog(`ERROR al truncar ${truncarTabla}: ${tData.error ?? 'Error'}`)
      return { insertadas: 0, eliminados: 0 }
    }
  } catch (err) {
    agregarLog(`ERROR al truncar ${truncarTabla}: ${err.message}`)
    return { insertadas: 0, eliminados: 0 }
  }

  const result = await cargarChunksEnParalelo(rows, endpoint, label, agregarLog)
  if (!result.success) return { insertadas: 0, eliminados: 0 }

  agregarLog(`  Eliminando duplicados exactos...`)
  try {
    const dRes = await fetchWithTimeout(`${DRF_BASE_URL}/api/deduplicar-tabla/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: truncarTabla })
    })
    const dData = await dRes.json()
    if (!dData.ok) {
      agregarLog(`ERROR al deduplicar ${truncarTabla}: ${dData.error ?? 'Error'}`)
      return { insertadas: result.insertadas, eliminados: 0 }
    }
    const eliminados = dData.eliminados ?? 0

    agregarLog(`✓ ${label} cargado.`)
    agregarLog(
      `  Insertadas: ${result.insertadas.toLocaleString()} — Duplicados eliminados: ${eliminados.toLocaleString()} — En tabla: ${(result.insertadas - eliminados).toLocaleString()}`
    )
    return { insertadas: result.insertadas, eliminados }
  } catch (err) {
    agregarLog(`ERROR al deduplicar ${truncarTabla}: ${err.message}`)
    return { insertadas: result.insertadas, eliminados: 0 }
  }
}

export async function cargarSync(rows, endpoint, label, agregarLog) {
  const anioActual = new Date().getFullYear()

  agregarLog(`  Eliminando registros del ${anioActual}...`)
  try {
    const eliminarRes = await fetchWithTimeout(
      `${DRF_BASE_URL}/api/eliminar-registros-movimientos/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ año: anioActual })
      }
    )
    const eliminarData = await eliminarRes.json()
    if (!eliminarData.ok) {
      agregarLog(`ERROR al eliminar registros: ${eliminarData.error ?? 'Error desconocido'}`)
      return { insertadas: 0, eliminados: 0 }
    }
  } catch (err) {
    agregarLog(`ERROR al eliminar registros: ${err.message}`)
    return { insertadas: 0, eliminados: 0 }
  }

  const result = await cargarChunksEnParalelo(rows, endpoint, label, agregarLog, {
    año: anioActual
  })
  if (!result.success) return { insertadas: 0, eliminados: 0 }

  agregarLog(`✓ ${label} cargado.`)
  agregarLog(`  Eliminando Duplicados de registros de Movimientos...`)

  try {
    const dRes = await fetchWithTimeout(`${DRF_BASE_URL}/api/deduplicar-tabla/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: 'MOV_TOTAL' })
    })
    const dData = await dRes.json()
    if (!dData.ok) {
      agregarLog(`ERROR al deduplicar MOV_TOTAL: ${dData.error ?? 'Error'}`)
      return { insertadas: result.insertadas, eliminados: 0 }
    }
    const eliminados = dData.eliminados ?? 0

    agregarLog(`✓ MOV_TOTAL cargado.`)
    agregarLog(
      `  Insertadas: ${result.insertadas.toLocaleString()} — Duplicados eliminados: ${eliminados.toLocaleString()}`
    )
    return { insertadas: result.insertadas, eliminados }
  } catch (err) {
    agregarLog(`ERROR al deduplicar MOV_TOTAL: ${err.message}`)
    return { insertadas: result.insertadas, eliminados: 0 }
  }
}

export { DRF_BASE_URL, CHUNK_SIZE }
