"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          background: "#eef2f2",
          color: "#10212a",
        }}
      >
        <title>Something went wrong | Metapick MLBB</title>
        <h1 style={{ fontSize: "1.5rem" }}>Metapick failed to load</h1>
        <p>Reload the page. If it keeps failing, try again in a few minutes.</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            borderRadius: 10,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
