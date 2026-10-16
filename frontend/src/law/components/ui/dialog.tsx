"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon, ArrowLeftIcon } from "lucide-react";

import { cn } from "./utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  // QEYD (2026-09, split-screen): overlay indi yüngül bir kölgə (bg-black/20) —
  // panel açıldıqda arxadakı dashboard qaralmır, görünən qalır. Faktiki
  // rəng/animasiya qaydaları globals.css-də [data-slot="dialog-overlay"]
  // üzərində !important ilə tətbiq olunur (bax: globals.css, "SPLIT-SCREEN
  // PANEL"); buradakı siniflər yalnız defolt/fallback təyinatdır.
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn("fixed inset-0 z-[100] bg-black/20", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

function DialogContent({
  className,
  children,
  onBack,
  backLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Verilsə, bağlama düyməsinin yanında "geri" oxu göstərilir — modallar arasında
   * bir addım geri qayıtmaq üçün (tam bağlamadan). */
  onBack?: () => void;
  backLabel?: string;
}) {
  // QEYD (2026-09, split-screen redesign): bu komponent əvvəllər ekranın
  // ortasında üzən (fixed top-50%/left-50%, translate ilə mərkəzləşdirilmiş)
  // klassik "modul pəncərə" kimi qurulmuşdu. İstifadəçinin tələbi ilə (bax
  // layihənin əsas göstərişi) bütün sistemdə açılan pəncərələr indi split-
  // screen məntiqi ilə — ekranın sağ kənarına doğru sürüşən bir panel kimi
  // açılır ki, arxadakı siyahı/dashboard görünən qalsın. Bu, YALNIZ görünüş
  // qatıdır: bu fayl bütün ~50 modal komponenti tərəfindən ortaq istifadə
  // olunduğu üçün (Dialog/DialogContent/DialogHeader və s.), TƏK bu faylı
  // dəyişməklə bütün sistem eyni anda düzəlir — heç bir modalın öz JSX/iş
  // məntiqinə toxunulmayıb, yalnız bu "qabıq" komponentin mövqeyi/animasiyası
  // dəyişib. Hər modalın öz className-də göndərdiyi max-w-*/max-h-*/h-* kimi
  // ölçü override-ları olduğu kimi işləməyə davam edir (tailwind-merge sayəsində
  // sonuncu override qazanır) — sadəcə indi mərkəzdə deyil, sağda "dock"
  // olunmuş şəkildə göstərilir. Faktiki güclü (!important) məcburiyyət
  // globals.css-də "[data-slot=\"dialog-content\"]" üzərindədir (bax: həmin
  // fayl, "SPLIT-SCREEN PANEL" bölməsi) — buradakı siniflər defolt dəyərlərdir.
  //
  // QEYD (2026-09, "altdan kəsik" bug-fix): istifadəçi bildirdi ki, bəzi
  // modallar (məs. NewLawyerModal.tsx, öz className-ində "h-[90vh]" göndərən)
  // panel ekranın altına qədər uzanmır — altda boşluq qalır və arxadakı
  // dashboard görünür. globals.css-dəki `[data-slot="dialog-content"] {
  // height: 100vh !important; }` qaydası nəzəri olaraq bunu ötməli idi, amma
  // canlı mühitdə tam etibarlı işləmədiyi müşahidə olundu (səbəbi dəqiq
  // müəyyən edilmədi — ehtimal ki, brauzer keşi və ya gözlənilməz bir cascade
  // incəliyi). Ən etibarlı, mübahisəsiz həll: bu kritik ölçü/mövqe
  // xüsusiyyətlərini birbaşa inline `style` atributu ilə tətbiq etmək — inline
  // style CSS cascade-də əhəmiyyət (importance) və spesifiklikdən asılı
  // olmayaraq HƏR HANSI adi (important olmayan) stylesheet elanını üstələyir,
  // ona görə də istehlakçı modalın öz `h-[XXvh]` Tailwind sinfi artıq
  // panelin tam-hündürlükdə olmasına mane ola bilməz. `{...props}`-dan SONRA
  // qoyulub ki, xarici tərəfdən gözlənilməz bir `style` gəlsə belə, bizim
  // kritik dəyərlərimiz həmişə qalib gəlsin (consumer-in öz style-ı əvvəlcə
  // spread olunur, bizim sahələrimiz sonra yazılıb üstünə düşür).
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-0 right-0 z-[100] grid h-full w-full gap-4 border-l p-6 shadow-2xl sm:max-w-4xl",
          className,
        )}
        {...props}
        style={{
          ...(props.style || {}),
          position: "fixed",
          top: 0,
          right: 0,
          left: "auto",
          bottom: 0,
          height: "100vh",
          maxHeight: "100vh",
          margin: 0,
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-slot="dialog-back"
            className="-mb-2 flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-xs font-medium text-muted-foreground opacity-80 transition-opacity hover:opacity-100 hover:text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <ArrowLeftIcon className="size-3.5" />
            {backLabel || "Geri"}
          </button>
        )}
        {children}
        <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};