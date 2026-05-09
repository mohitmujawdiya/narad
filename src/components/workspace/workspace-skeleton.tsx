// Static layout placeholder shown during hydration. The previous version used
// pulsing skeletons which made the brief mount delay feel longer than it
// actually is. Static structure feels closer to "instant" because the eye
// isn't tracking an animation.

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="flex h-full w-[220px] shrink-0 flex-col bg-sidebar border-r border-border/50">
        <div className="h-12 border-b border-border" />
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="h-12 border-b border-border" />
      </div>
    </div>
  );
}
