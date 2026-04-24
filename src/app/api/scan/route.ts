import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { barcode } = await req.json()
  if (!barcode) return NextResponse.json({ error: 'No barcode' }, { status: 400 })

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
    const data = await res.json()

    if (data.status === 0) {
      return NextResponse.json({ found: false })
    }

    const product = data.product
    return NextResponse.json({
      found: true,
      brand: product.brands || '',
      name: product.product_name || product.product_name_en || '',
      official_description: product.generic_name || '',
    })
  } catch {
    return NextResponse.json({ found: false })
  }
}
