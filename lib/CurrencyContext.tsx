"use client"
import { createContext, useContext } from "react"
import { fmtCurrency } from "./calc"

const CurrencyContext = createContext("USD")

export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

export function useFmtCurrency() {
  const currency = useCurrency()
  return (v: number) => fmtCurrency(v, currency)
}
