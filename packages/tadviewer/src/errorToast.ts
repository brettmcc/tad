import { OverlayToaster, Position, ToasterInstance } from "@blueprintjs/core";

let errorToaster: ToasterInstance | null = null;

/**
 * Report a failure the user triggered but that has nowhere else to
 * surface -- without this, a data source that won't open just leaves the
 * grid empty with no explanation.
 */
export function showErrorToast(message: string): void {
  if (errorToaster == null) {
    errorToaster = OverlayToaster.create({ position: Position.TOP });
  }
  errorToaster.show({ intent: "danger", icon: "error", message });
}

/** Message text for `err`, for use in an error toast. */
export function errorMessage(err: unknown): string {
  const msg = (err as any)?.message;
  return typeof msg === "string" && msg.length > 0 ? msg : String(err);
}
