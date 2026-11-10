// Convert a share link into an embeddable player URL. Falls back to null (plain link).
export function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  // Google Drive: a single file plays in Drive's previewer (folders can't embed).
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{20,})/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}
