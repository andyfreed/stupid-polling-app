export function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-6 text-xs text-zinc-400">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Data sources:{" "}
          <a
            className="underline underline-offset-2 hover:text-white"
            href="https://votehub.com/polls/api/"
            target="_blank"
            rel="noreferrer"
          >
            VoteHub (CC BY 4.0)
          </a>
          {" · "}
          <a
            className="underline underline-offset-2 hover:text-white"
            href="https://civicapi.org/api-documentation"
            target="_blank"
            rel="noreferrer"
          >
            civicAPI (attribution required)
          </a>
        </div>
        <div className="text-zinc-500">Not affiliated with any source.</div>
      </div>
    </footer>
  );
}
