/**
 * Deploy → Settings → "Custom domain" dialog, as captured (day2/01): the project is not published, so the
 * dialog says "Publish this app first, then connect your own domain to it." No DOM snapshot; markup is the
 * app bundle's own (`AIe` with DialogContent `rn` + `TIe`, Alert `ri`/`ai`), classes merged as tailwind-merge
 * does. The connect / verify / live states exist in the app code but were never observed live (owner-attested
 * feature, no domain recorded), so they are not rebuilt.
 */
import React from "react";
import { DialogCloseButton, DialogOverlay } from "./shared";

export type CustomDomainDialogProps = {
  title: string;
  description: string;
  message: string;
  /** Overlay + dialog opacity (0..1) for a fade; 1 = as captured. */
  opacity: number;
};

export const CustomDomainDialog: React.FC<CustomDomainDialogProps> = ({ title, description, message, opacity }) => (
  <>
    <DialogOverlay opacity={opacity} />
    <div
      role="dialog"
      data-state="open"
      tabIndex={-1}
      className="fixed left-[50%] top-[50%] z-modal w-[95vw] max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-background dark:bg-card dark:border-white/8 dark:shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)] shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] md:w-full max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/15 flex flex-col gap-5 p-7 sm:max-w-[640px] sm:rounded-2xl"
      style={{ pointerEvents: "auto", opacity }}
    >
      <div className="flex flex-col sm:text-left space-y-1 text-left">
        {/* tailwind-merge drops "leading-none" when the later "text-xl" is merged in (font-size wins over line-height) */}
        <h2 className="font-semibold tracking-tight text-xl">{title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      <div
        role="alert"
        className="relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7 bg-background text-foreground"
      >
        <div className="text-sm [&_p]:leading-relaxed">{message}</div>
      </div>
      <DialogCloseButton />
    </div>
  </>
);

export const CUSTOM_DOMAIN_COPY: CustomDomainDialogProps = {
  title: "Custom domain",
  description: "Serve this app on your own domain.",
  message: "Publish this app first, then connect your own domain to it.",
  opacity: 1,
};
