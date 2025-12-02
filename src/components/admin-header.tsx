
"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FileText, Bell, Download, Loader2, Menu } from "lucide-react";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { AlertSettingsDialog } from "./alert-settings-dialog";
import { useSidebar } from "./ui/sidebar";

export function AdminHeader() {
    const { exportData, loading } = useAdminData();
    const { toggleSidebar } = useSidebar();


    return (
         <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
             <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={toggleSidebar}
            >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 ml-auto">
                <AlertSettingsDialog />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="sm" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            Export Report
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => exportData('alerts')}>
                            <FileText className="mr-2 h-4 w-4" />
                            Export Alerts
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportData('persons')}>
                            <FileText className="mr-2 h-4 w-4" />
                            Export Displaced Persons
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportData('shelters')}>
                             <FileText className="mr-2 h-4 w-4" />
                            Export Shelters
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => exportData('drivers')}>
                              <FileText className="mr-2 h-4 w-4" />
                             Export Drivers
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => exportData('users')}>
                              <FileText className="mr-2 h-4 w-4" />
                             Export Users
                         </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportData('ussd')}>
                              <FileText className="mr-2 h-4 w-4" />
                             Export Contact Numbers
                         </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
