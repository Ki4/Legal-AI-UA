import { useI18n } from "@legal-ai/i18n";

/**
 * A component rather than the inline `<div>` it used to be, because a hook
 * cannot be called from inside the route table — and `routes.tsx` is the one
 * file every feature track touches, so it stays a table of routes rather than
 * growing a screen.
 */
export function NotFound() {
  const { t } = useI18n();

  return <div className="text-inkMute">{t("route.notFound")}</div>;
}
