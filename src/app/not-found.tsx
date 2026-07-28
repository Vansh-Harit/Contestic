import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Go back home
        </Link>
      </div>
    </div>
  )
}
