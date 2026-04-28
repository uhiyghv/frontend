import { toast as sonnerToast } from "sonner";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

type ToastOpts = { description?: ReactNode; duration?: number };

const base = "border shadow-lg backdrop-blur-md";

export const appToast = {
  success: (title: ReactNode, opts?: ToastOpts) =>
    sonnerToast.success(title, {
      ...opts,
      icon: <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />,
      className: `${base} !bg-[hsl(var(--success)/0.08)] !border-[hsl(var(--success)/0.35)] !text-foreground`,
    }),
  error: (title: ReactNode, opts?: ToastOpts) =>
    sonnerToast.error(title, {
      ...opts,
      icon: <AlertCircle className="h-5 w-5 text-[hsl(var(--destructive))]" />,
      className: `${base} !bg-[hsl(var(--destructive)/0.08)] !border-[hsl(var(--destructive)/0.4)] !text-foreground`,
    }),
  warning: (title: ReactNode, opts?: ToastOpts) =>
    sonnerToast.warning(title, {
      ...opts,
      icon: <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />,
      className: `${base} !bg-[hsl(var(--warning)/0.1)] !border-[hsl(var(--warning)/0.4)] !text-foreground`,
    }),
  info: (title: ReactNode, opts?: ToastOpts) =>
    sonnerToast.info(title, {
      ...opts,
      icon: <Info className="h-5 w-5 text-primary" />,
      className: `${base} !bg-primary/10 !border-primary/30 !text-foreground`,
    }),
  scan: (title: ReactNode, opts?: ToastOpts) =>
    sonnerToast(title, {
      ...opts,
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      className: `${base} !bg-gradient-to-r !from-primary/15 !to-primary/5 !border-primary/40 !text-foreground`,
    }),
  dismiss: sonnerToast.dismiss,
};
