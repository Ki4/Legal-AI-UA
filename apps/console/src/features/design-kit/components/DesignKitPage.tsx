import { Badge, Button, FormField, Input, Spinner } from "@legal-ai/ui";
import { AlertCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

const colorSwatches = [
  { name: "canvas", className: "bg-canvas" },
  { name: "paper", className: "bg-paper" },
  { name: "paperAlt", className: "bg-paperAlt" },
  { name: "line", className: "bg-line" },
  { name: "lineStrong", className: "bg-lineStrong" },
  { name: "ink", className: "bg-ink" },
  { name: "inkSoft", className: "bg-inkSoft" },
  { name: "inkMute", className: "bg-inkMute" },
  { name: "brand", className: "bg-brand" },
  { name: "ok", className: "bg-ok" },
  { name: "warn", className: "bg-warn" },
  { name: "danger", className: "bg-danger" },
];

const buttonVariants = ["primary", "secondary", "ghost", "danger"] as const;

const badgeTones = ["ok", "warn", "danger", "brand", "neutral"] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-card border border-line bg-paper p-6 shadow-card">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-inkSoft">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function DesignKitPage() {
  const [demoValue, setDemoValue] = useState("");
  const [demoTouched, setDemoTouched] = useState(false);

  const demoError = demoTouched && demoValue.trim() === "" ? "This field is required" : undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Design</h1>
        <p className="mt-1 text-sm text-inkSoft">
          Live gallery of the Legal AI design system tokens and exemplar components. Every value
          shown here comes from a semantic token in{" "}
          <span className="font-mono text-brand">@legal-ai/ui</span> — nothing on this page is
          hand-picked.
        </p>
      </div>

      <Section
        title="Typography"
        description="A single grotesque (Geist), five fixed sizes — no splitting the scale."
      >
        <div className="space-y-3">
          <div>
            <p className="text-2xl font-semibold tracking-[-0.02em] text-ink">
              H1 / Display — 24px / 600
            </p>
          </div>
          <div>
            <p className="text-lg font-semibold text-ink">H2 / Heading — 18px / 600</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.07em] text-inkMute">
              Label / section — 13px / 600
            </p>
          </div>
          <div>
            <p className="text-[15px] leading-[1.6] text-ink">
              Body — 15px / 400, line-height 1.6. This is the baseline size for primary reading text
              and is never set smaller.
            </p>
          </div>
          <div>
            <p className="text-xs text-inkMute">Meta — 12px / 400–500 · 2 days ago · 24 fields</p>
          </div>
          <div>
            <p className="font-mono text-[13px] text-brand">Mono — first_name, art. 180 CK</p>
          </div>
        </div>
      </Section>

      <Section
        title="Color tokens"
        description="Semantic tokens only — primitives never reach components."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {colorSwatches.map((swatch) => (
            <div key={swatch.name} className="space-y-1.5">
              <div className={`h-14 rounded-btn border border-line ${swatch.className}`} />
              <p className="font-mono text-xs text-inkSoft">{swatch.name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Button"
        description="Variants primary · secondary · ghost · danger. Hover, focus-visible and active are live states — try tabbing and clicking."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {buttonVariants.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant[0]!.toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {buttonVariants.map((variant) => (
              <Button key={`${variant}-disabled`} variant={variant} disabled>
                Disabled
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {buttonVariants.map((variant) => (
              <Button key={`${variant}-loading`} variant={variant} loading>
                Loading
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Badge"
        description="Tones ok · warn · danger · brand · neutral, with an optional dot."
      >
        <div className="flex flex-wrap items-center gap-3">
          {badgeTones.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {badgeTones.map((tone) => (
            <Badge key={`${tone}-dot`} tone={tone} dot>
              {tone}
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        title="FormField"
        description="Label + control + hint or error. Errors are never color alone — text and an icon."
      >
        <div className="max-w-sm space-y-4">
          <FormField
            htmlFor="design-kit-demo"
            label="Case reference"
            hint="Used to link this record to the client file."
          >
            <Input
              id="design-kit-demo"
              placeholder="e.g. 2026-0114"
              value={demoValue}
              onChange={(event) => setDemoValue(event.target.value)}
              onBlur={() => setDemoTouched(true)}
              invalid={Boolean(demoError)}
            />
          </FormField>
          <FormField
            htmlFor="design-kit-demo-error"
            label="Marriage date"
            error="Not saved: “Marriage date” is empty"
          >
            <Input id="design-kit-demo-error" invalid />
          </FormField>
          <p className="flex items-center gap-1 text-xs text-inkMute">
            <AlertCircle size={13} aria-hidden="true" />
            Error state pairs an icon with the message — color is never the only signal.
          </p>
        </div>
      </Section>

      <Section title="Spinner" description="Inline pending state — Lucide Loader2 in text-inkMute.">
        <div className="flex items-center gap-4">
          <Spinner size={14} />
          <Spinner size={16} />
          <Spinner size={20} />
        </div>
      </Section>
    </div>
  );
}
