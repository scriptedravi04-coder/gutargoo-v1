import { User, ChevronDown, Menu, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { confirmLeave } from "@/lib/leaveGuard";

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // an upload / unsaved video on this page would be lost
    if (!confirmLeave()) return;
    try {
      signOut();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border/50 bg-background/95 px-3 md:px-6 backdrop-blur-xl gap-2 md:gap-4">
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-0.5 md:gap-1">
        {/* Divider - hidden on mobile */}
        <div className="hidden md:block mx-2 h-8 w-px bg-border/50" />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-9 md:h-10 gap-2 md:gap-3 rounded-xl px-2 md:px-3 transition-colors hover:bg-secondary"
            >
              <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
                <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold leading-tight">
                  {user?.name || user?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  Admin
                </p>
              </div>
              <ChevronDown className="hidden lg:block h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {user?.name || user?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => {
                if (confirmLeave()) navigate("/settings");
              }}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings &amp; password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="rounded-lg text-destructive focus:text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}