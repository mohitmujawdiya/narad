import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            H
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Hannibal
          </span>
        </Link>
        <span className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}
