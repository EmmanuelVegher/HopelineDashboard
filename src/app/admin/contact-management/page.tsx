
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Plus, Edit, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAdminData } from "@/contexts/AdminDataProvider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { type UssdCode } from "@/lib/data";


function UssdForm({ ussdCode, onSave, onCancel }: { ussdCode?: UssdCode | null; onSave: () => void; onCancel: () => void }) {
    const [name, setName] = useState(ussdCode?.name || '');
    const [code, setCode] = useState(ussdCode?.code || '');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !code) {
            toast({ title: "Missing Fields", description: "Please provide both a name and a number/code.", variant: "destructive" });
            return;
        }
        setLoading(true);

        const dataToSave = { name, code };

        try {
            if (ussdCode?.id) {
                // Update
                const ussdRef = doc(db, "ussdCodes", ussdCode.id);
                await updateDoc(ussdRef, dataToSave);
                toast({ title: "Success", description: "Contact number updated successfully." });
            } else {
                // Create
                await addDoc(collection(db, "ussdCodes"), dataToSave);
                toast({ title: "Success", description: "Contact number added successfully." });
            }
            onSave();
        } catch (error) {
            console.error("Error saving contact number:", error);
            toast({ title: "Error", description: "Could not save the contact number.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Service Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Emergency SOS or Police" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="code">Number or Code</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., *347*100# or 112" required />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? 'Saving...' : 'Save Number'}
                </Button>
            </DialogFooter>
        </form>
    );
}


export default function ContactManagementPage() {
    const { ussdCodes, loading, permissionError, fetchData } = useAdminData();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedUssd, setSelectedUssd] = useState<UssdCode | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const handleAddNew = () => {
        setSelectedUssd(null);
        setIsFormOpen(true);
    };

    const handleEdit = (code: UssdCode) => {
        setSelectedUssd(code);
        setIsFormOpen(true);
    };

    const handleDelete = async (codeId: string) => {
        if (!window.confirm("Are you sure you want to delete this contact number?")) return;
        setActionLoading(true);
        try {
            await deleteDoc(doc(db, "ussdCodes", codeId));
            toast({ title: "Success", description: "Contact number deleted." });
            fetchData();
        } catch (error) {
            console.error("Error deleting contact number:", error);
            toast({ title: "Error", description: "Could not delete the number.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };
    
    const handleSave = () => {
        setIsFormOpen(false);
        fetchData();
    };

    const handleCancel = () => {
        setIsFormOpen(false);
    };

  return (
    <>
    <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); else setIsFormOpen(true);}}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{selectedUssd ? "Edit Contact Number" : "Add New Contact Number"}</DialogTitle>
                <DialogDescription>
                    {selectedUssd ? "Update the details for this contact." : "Add a new USSD code or emergency number."}
                </DialogDescription>
            </DialogHeader>
            <UssdForm ussdCode={selectedUssd} onSave={handleSave} onCancel={handleCancel} />
        </DialogContent>
    </Dialog>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Contact Numbers Management</CardTitle>
            <CardDescription>
            Add, edit, or delete USSD codes and emergency numbers that are displayed on user-facing pages.
            </CardDescription>
        </div>
        <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4"/> Add New Number</Button>
      </CardHeader>
      <CardContent>
         {permissionError && (
            <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to manage contact numbers. Please check your Firestore security rules.
                </AlertDescription>
            </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Name</TableHead>
              <TableHead>Number / Code</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || !ussdCodes ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : ussdCodes.length > 0 ? (
              ussdCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-medium">{code.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{code.code}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={actionLoading}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(code)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(code.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : !permissionError ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No contact numbers found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </>
  );
}
