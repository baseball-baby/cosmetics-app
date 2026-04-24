import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { UPLOADS_DIR_PATH } from '@/lib/db'

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }

  const filename = `${randomId()}.${ext}`
  if (!fs.existsSync(UPLOADS_DIR_PATH)) fs.mkdirSync(UPLOADS_DIR_PATH, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(path.join(UPLOADS_DIR_PATH, filename), buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
