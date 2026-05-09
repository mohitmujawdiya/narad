"use client";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="h-14 flex items-center border-b border-border bg-background px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
