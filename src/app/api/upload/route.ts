import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

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
  const buffer = Buffer.from(await file.arrayBuffer())
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  const { error } = await supabase.storage
    .from('uploads')
    .upload(filename, buffer, { contentType, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabase.storage.from('uploads').getPublicUrl(filename)
  return NextResponse.json({ url: data.publicUrl })
}
