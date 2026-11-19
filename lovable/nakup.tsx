import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-head";
import { ExternalLink } from "lucide-react";

// Samostatná aplikácia Nákupy (repozitár kopcek24/N-kupny-zoznam) beží na GitHub Pages
// a má vlastné prihlásenie cez Google (Firebase). Tu je len vložená pod hlavné menu.
export const NAKUPY_APP_URL = "https://kopcek24.github.io/N-kupny-zoznam/";

export const Route = createFileRoute("/nakup")({
  head: () =>
    pageHead({
      title: "Nákup",
      description: "Spoločný nákupný zoznam s akciami z letákov.",
      path: "/nakup",
    }),
  component: PageComponent,
});

function PageComponent() {
  return (
    <main className="relative flex flex-col" style={{ height: "calc(100dvh - var(--nav-h, 52px))" }}>
      <iframe
        src={NAKUPY_APP_URL}
        title="Nákupy"
        className="w-full flex-1 border-0 bg-[#f3f5f1]"
        allow="clipboard-write"
      />
      <a
        href={NAKUPY_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-2 bottom-2 sm:bottom-auto sm:top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white backdrop-blur hover:bg-black"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ExternalLink className="h-3 w-3" /> Celá obrazovka
      </a>
    </main>
  );
}
