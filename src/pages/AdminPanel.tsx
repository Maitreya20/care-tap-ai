import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, Loader2, UserCog, Save } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  roleId: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive text-destructive-foreground",
  doctor: "bg-primary text-primary-foreground",
  staff: "bg-secondary text-secondary-foreground",
  patient: "bg-muted text-muted-foreground",
  medical_responder: "bg-accent text-accent-foreground",
  hospital_admin: "bg-primary/80 text-primary-foreground",
};

const ASSIGNABLE_ROLES: AppRole[] = ["patient", "doctor", "staff", "admin", "medical_responder", "hospital_admin"];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [pending, setPending] = useState<Record<string, AppRole>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);

      if (pErr || rErr) throw pErr || rErr;

      const roleMap = new Map(roles?.map((r) => [r.user_id, { role: r.role as AppRole, roleId: r.id }]));

      const merged: UserWithRole[] = (profiles ?? []).map((p) => {
        const r = roleMap.get(p.id);
        return {
          userId: p.id,
          email: p.email,
          fullName: p.full_name,
          role: r?.role ?? "patient",
          roleId: r?.roleId ?? "",
        };
      });

      merged.sort((a, b) => {
        const order: Record<string, number> = { admin: 0, doctor: 1, staff: 2 };
        const aO = order[a.role] ?? 9;
        const bO = order[b.role] ?? 9;
        return aO !== bO ? aO - bO : a.fullName.localeCompare(b.fullName);
      });

      setUsers(merged);
      setPending({});
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (userId: string, newRole: AppRole, currentRole: AppRole) => {
    setPending((prev) => {
      const next = { ...prev };
      if (newRole === currentRole) {
        delete next[userId];
      } else {
        next[userId] = newRole;
      }
      return next;
    });
  };

  const handleSave = async (user: UserWithRole) => {
    const newRole = pending[user.userId];
    if (!newRole) return;
    setSavingId(user.userId);
    try {
      let error;
      if (user.roleId) {
        ({ error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("id", user.roleId));
      } else {
        // No row exists yet — insert one
        const insertRes = await supabase
          .from("user_roles")
          .insert({ user_id: user.userId, role: newRole })
          .select("id")
          .single();
        error = insertRes.error;
        if (insertRes.data) {
          user.roleId = insertRes.data.id;
        }
      }

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.userId === user.userId ? { ...u, role: newRole, roleId: user.roleId } : u))
      );
      setPending((prev) => {
        const next = { ...prev };
        delete next[user.userId];
        return next;
      });
      toast.success(`Role updated to ${newRole.replace("_", " ")}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update role");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="bg-primary p-2 rounded-lg">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage user roles &amp; permissions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              User Roles ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="font-medium">{u.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge className={ROLE_COLORS[u.role] ?? ""}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={pending[u.userId] ?? u.role}
                              onValueChange={(val) => handleSelect(u.userId, val as AppRole, u.role)}
                              disabled={savingId === u.userId}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ASSIGNABLE_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role.replace("_", " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleSave(u)}
                              disabled={!pending[u.userId] || savingId === u.userId}
                            >
                              {savingId === u.userId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-1" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminPanel;
