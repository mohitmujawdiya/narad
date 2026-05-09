"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:3000`;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Default staleTime is 0 — every component mount triggers a refetch even
  // when the cached data is fresh. With remote DB latency that means each view
  // switch shows a flash of empty/loading state. 30s staleTime keeps the cache
  // warm across view switches without making mutations slow to reflect (those
  // explicitly invalidate via utils.<x>.invalidate).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors position="bottom-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
