import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Neumorphic primitives. The shared rule of the style: every element keeps
 * the page background (bg-neu-base); raised = shadow-neu, inset = inputs
 * and pressed states.
 */

function cx(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function NeuCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-3xl bg-neu-base p-6 shadow-neu", className)}
      {...props}
    />
  );
}

export function NeuButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        "rounded-2xl bg-neu-base px-5 py-2.5 font-semibold text-neu-accent shadow-neu-sm",
        "transition-shadow hover:shadow-neu active:shadow-neu-inset-sm",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function NeuInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "rounded-2xl bg-neu-base px-4 py-2.5 text-neu-text shadow-neu-inset-sm",
        "placeholder:text-neu-muted focus:outline-none focus:shadow-neu-inset",
        className,
      )}
      {...props}
    />
  );
}

export function NeuTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "rounded-2xl bg-neu-base px-4 py-3 text-neu-text shadow-neu-inset",
        "placeholder:text-neu-muted focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
