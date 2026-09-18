import { useI18n } from "@legal-ai/i18n";
import { Link } from "react-router";

/**
 * A component rather than the inline `<div>` it used to be, because a hook
 * cannot be called from inside the route table — and `routes.tsx` is the one
 * file every feature track touches, so it stays a table of routes rather than
 * growing a screen.
 */
export function NotFound() {
  const { t } = useI18n();

  // A dead end with no way out of it: the sentence alone left a reader to
  // edit the address bar. The catalogue is where every other screen starts.
  return (
    <div className="space-y-2">
      <p className="text-inkMute">{t("route.notFound")}</p>
      <Link to="/services" className="text-sm text-brand hover:underline">
        {t("route.notFound.back")}
      </Link>
    </div>
  );
}
