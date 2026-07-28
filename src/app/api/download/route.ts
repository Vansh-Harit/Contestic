import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const targetUrl = new URL(url)
    
    // Basic SSRF protection - only allow https
    if (targetUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS URLs are supported' }, { status: 400 })
    }

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    // Extract filename from URL or default to 'download'
    let filename = url.split('/').pop()?.split('?')[0] || 'download'
    if (!filename.includes('.')) {
      filename = `${filename}.jpg`
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Download proxy error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
