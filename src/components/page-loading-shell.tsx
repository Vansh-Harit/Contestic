export function PageLoadingShell() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8 md:py-10" aria-busy="true" aria-label="Loading page">
      <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
      <div className="mt-7 rounded-2xl border border-outline-variant bg-white p-6 shadow-sm md:p-8">
        <div className="h-8 w-2/3 max-w-xl animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded bg-gray-100" />
        <div className="mt-2 h-4 w-3/4 max-w-xl animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="h-48 animate-pulse rounded-2xl border border-outline-variant bg-white shadow-sm">
            <div className="m-6 h-5 w-1/2 rounded bg-gray-200" />
            <div className="mx-6 mt-4 h-3 w-4/5 rounded bg-gray-100" />
            <div className="mx-6 mt-2 h-3 w-3/5 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </main>
  )
}
