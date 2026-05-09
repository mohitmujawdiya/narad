"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, ChevronDown, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProjectSwitcherProps = {
  projectId: string;
  collapsed?: boolean;
};

export function ProjectSwitcher({ projectId, collapsed }: ProjectSwitcherProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);
  const utils = trpc.useUtils();
  const { data: projects } = trpc.project.list.useQuery();
  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      utils.project.list.invalidate();
      router.push(`/${project.slug}`);
      setDialogOpen(false);
      setNewProjectName("");
    },
  });
  const updateMutation = trpc.project.update.useMutation({
    onSuccess: (data, variables) => {
      utils.project.list.invalidate();
      utils.project.byId.invalidate({ id: variables.id });
      // Navigate to new slug if the current project was renamed
      if (variables.id === projectId) {
        router.replace(`/${data.slug}`, { scroll: false });
      }
      setEditDialogOpen(false);
      setEditingProject(null);
      toast.success("Project renamed");
    },
  });
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
    },
  });
  const restoreMutation = trpc.project.restore.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
    },
  });
  const hardDeleteMutation = trpc.project.hardDelete.useMutation();

  const currentProject = projects?.find((p) => p.id === projectId);

  const handleCreate = () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    createMutation.mutate({ name: trimmed });
  };

  const handleRename = () => {
    if (!editingProject) return;
    const trimmed = editingProject.name.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id: editingProject.id, name: trimmed });
  };

  const handleDelete = (project: { id: string; name: string }) => {
    let cancelled = false;

    deleteMutation.mutate({ id: project.id }, {
      onSuccess: () => {
        if (project.id === projectId) {
          const remaining = projects?.filter((p) => p.id !== project.id);
          if (remaining && remaining.length > 0) {
            router.push(`/${remaining[0].slug}`);
          } else {
            router.push("/");
          }
        }

        toast(`"${project.name}" deleted`, {
          duration: 10000,
          action: {
            label: "Undo",
            onClick: () => {
              cancelled = true;
              restoreMutation.mutate({ id: project.id });
            },
          },
          onDismiss: () => {
            if (!cancelled) {
              hardDeleteMutation.mutate({ id: project.id });
            }
          },
        });
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
              title={currentProject?.name ?? "Switch project"}
            >
              <Folder className="h-5 w-5" />
            </button>
          ) : (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent/50 transition-colors text-left"
            >
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">
                {currentProject?.name ?? "Select project"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={collapsed ? "start" : "start"}
          side={collapsed ? "right" : "bottom"}
          className="w-56"
        >
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects?.map((project) => (
            <DropdownMenuItem
              key={project.id}
              className="group flex items-center gap-2 pr-1"
              onSelect={() => {
                if (project.id !== projectId) {
                  router.push(`/${project.slug}`);
                }
              }}
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  project.id === projectId ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="flex-1 truncate">{project.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingProject({ id: project.id, name: project.name });
                  setEditDialogOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {(projects?.length ?? 0) > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete({ id: project.id, name: project.name });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Fitness App"
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newProjectName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setEditingProject(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-name">Project name</Label>
              <Input
                id="edit-project-name"
                value={editingProject?.name ?? ""}
                onChange={(e) =>
                  setEditingProject((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev
                  )
                }
                placeholder="e.g. Fitness App"
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!editingProject?.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
