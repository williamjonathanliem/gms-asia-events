import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  if (!token) return new NextResponse('Not found', { status: 404 })

  const buffer = await QRCode.toBuffer(token, {
    width: 400,
    margin: 2,
    color: { dark: '#111111', light: '#FFFFFF' },
  })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
