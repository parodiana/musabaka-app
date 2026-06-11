import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Para Dance Sport - Puanlama Sistemi',
  description: 'Profesyonel müsabaka puanlama ve yönetim uygulaması',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
