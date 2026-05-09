export default function RootLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold animate-pulse">
          H
        </div>
        <span className="text-sm text-muted-foreground animate-pulse">
          Loading...
        </span>
      </div>
    </div>
  );
}
