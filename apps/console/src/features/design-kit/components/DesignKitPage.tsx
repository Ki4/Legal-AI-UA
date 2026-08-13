import {
  Badge,
  Button,
  Citation,
  Confidence,
  EmptyState,
  FormField,
  Input,
  Provenance,
  Select,
  Spinner,
  Table,
  TableCell,
  TableHead,
  TableRow,
  type ProvenanceState,
} from "@legal-ai/ui";
import { AlertCircle, FileX2 } from "lucide-react";
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

const statusInkPairs = [
  { tone: "ok", vivid: "text-ok", ink: "text-ok-ink", tint: "bg-ok/10" },
  { tone: "warn", vivid: "text-warn", ink: "text-warn-ink", tint: "bg-warn/10" },
  { tone: "danger", vivid: "text-danger", ink: "text-danger-ink", tint: "bg-danger/10" },
] as const;

const provenanceStates: ProvenanceState[] = ["ai", "confirmed", "edited"];

const mockTableRows = [
  {
    id: "row-1",
    service: "Divorce application",
    mode: "Full generation",
    price: "€120",
    selected: false,
  },
  { id: "row-2", service: "Alimony claim", mode: "Block assembly", price: "€90", selected: true },
  { id: "row-3", service: "Power of attorney", mode: "Template", price: "€30", selected: false },
  { id: "row-4", service: "NDA for a contractor", mode: "Template", price: "€25", selected: false },
] as const;

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
  const [demoLawyer, setDemoLawyer] = useState("");

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
          <FormField
            htmlFor="design-kit-demo-select"
            label="Accountable lawyer"
            hint="A native select: the control the person already knows, and 44px tall."
          >
            <Select
              id="design-kit-demo-select"
              placeholder="Choose a lawyer"
              options={[
                { value: "olena", label: "Olena Kovalchuk" },
                { value: "taras", label: "Taras Bondarenko" },
                { value: "dmytro", label: "Dmytro Lysenko — on leave", disabled: true },
              ]}
              value={demoLawyer}
              onChange={(event) => setDemoLawyer(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="design-kit-demo-select-error"
            label="Practice area"
            error="Not saved: every service sits in a practice area"
          >
            <Select
              id="design-kit-demo-select-error"
              placeholder="Choose an area"
              options={[{ value: "family", label: "Family" }]}
              value=""
              onChange={() => undefined}
              invalid
            />
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

      <Section
        title="Status ink pairs"
        description="Vivid tokens (ok · warn · danger) stay on dots/fills/tints; label TEXT uses the AA-safe -ink sibling. warn was ~3.7:1 on its tint, warn-ink measures ~5.9:1."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statusInkPairs.map((pair) => (
            <div key={pair.tone} className={`space-y-2 rounded-btn p-4 ${pair.tint}`}>
              <p className={`text-sm font-semibold ${pair.vivid}`}>{pair.vivid} (vivid)</p>
              <p className={`text-sm font-semibold ${pair.ink}`}>{pair.ink} (AA-safe)</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Trust layer"
        description="Human-in-the-Loop core: what is machine-suggested vs human-confirmed, confidence without a fake percentage, and a source for every fact."
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.07em] text-inkMute">
              Provenance
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {provenanceStates.map((state) => (
                <Provenance key={state} state={state} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.07em] text-inkMute">
              Confidence
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Confidence level="high" />
              <span className="text-xs text-inkMute">
                (high renders nothing — quiet is the signal)
              </span>
              <Confidence level="needs-review" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.07em] text-inkMute">
              Citation
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Citation source="art. 180 FC" />
              <Citation
                source="Family Code of Ukraine, art. 112"
                href="/laws/family-code#art-112"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Table"
        description="Comfortable rows, horizontal lines over zebra striping, selected row gets a brand tint and left border."
      >
        <Table>
          <TableHead>
            <tr>
              <th>Service</th>
              <th>Mode</th>
              <th>Price</th>
            </tr>
          </TableHead>
          <tbody>
            {mockTableRows.map((row) => (
              <TableRow key={row.id} selected={row.selected}>
                <TableCell>{row.service}</TableCell>
                <TableCell>{row.mode}</TableCell>
                <TableCell align="num">{row.price}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section
        title="Empty state"
        description="Muted icon, warm title, optional hint and action — never 'No data'."
      >
        <div className="rounded-card border border-line">
          <EmptyState
            icon={FileX2}
            title="No services yet"
            hint="Create the first one — it takes minutes"
            action={<Button variant="primary">New service</Button>}
          />
        </div>
      </Section>
    </div>
  );
}
