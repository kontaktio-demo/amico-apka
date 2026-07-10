import { get, set, del } from 'idb-keyval'
import type { Baza } from './types'

const KEY = 'amico-baza-v1'

export async function loadBaza(): Promise<Baza | undefined> {
  try {
    return (await get(KEY)) as Baza | undefined
  } catch (e) {
    console.error('Blad odczytu bazy', e)
    return undefined
  }
}

export async function saveBaza(baza: Baza): Promise<void> {
  try {
    await set(KEY, baza)
  } catch (e) {
    console.error('Blad zapisu bazy (moze QuotaExceeded)', e)
    throw e
  }
}

export async function clearBaza(): Promise<void> {
  await del(KEY)
}

// Trwale przechowywanie – chroni dane przed czyszczeniem przez przegladarke
export async function requestPersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    try {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    } catch {
      return false
    }
  }
  return false
}

export async function storageInfo(): Promise<{ persisted: boolean; usage?: number; quota?: number }> {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false
  let usage: number | undefined
  let quota: number | undefined
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    usage = est.usage
    quota = est.quota
  }
  return { persisted, usage, quota }
}
