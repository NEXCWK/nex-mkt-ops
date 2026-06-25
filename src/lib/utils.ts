import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Fuso horário oficial do sistema: Brasília
export const TIMEZONE = 'America/Sao_Paulo'

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', { timeZone: TIMEZONE })
}

/** Data de hoje (yyyy-mm-dd) no fuso de Brasília — para defaults de inputs de data. */
export function dataHojeISO(): string {
  // en-CA gera o formato yyyy-mm-dd
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
