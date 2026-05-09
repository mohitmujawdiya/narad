"use client";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="border-b bg-background px-6 py-3 sticky top-0 z-10">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
