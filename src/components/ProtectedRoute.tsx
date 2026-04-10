import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "patient" | "medical_responder" | "hospital_admin";
  requiredRoles?: ("patient" | "medical_responder" | "hospital_admin")[];
}

export const ProtectedRoute = ({ children, requiredRole, requiredRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const rolesToCheck = requiredRoles || (requiredRole ? [requiredRole] : undefined);
  const [roleChecked, setRoleChecked] = useState(!rolesToCheck);
  const [hasRole, setHasRole] = useState(false);

  useEffect(() => {
    if (!user || !rolesToCheck) return;

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setHasRole(data?.some((r) => rolesToCheck.includes(r.role as any)) ?? false);
        setRoleChecked(true);
      });
  }, [user, requiredRole, requiredRoles]);

  if (loading || (user && rolesToCheck && !roleChecked)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (rolesToCheck && !hasRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
