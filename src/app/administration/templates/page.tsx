import { PageHeader } from "@/components/ui/page-header";

const templateFamilies = [
  ["Project templates", "Lifecycle and reusable engagement configuration; substantive behavior belongs to Category 3."],
  ["Requirement libraries", "Reusable criteria collections owned by Category 4."],
  ["Scoring templates", "Reusable decision models owned by Category 8."],
  ["Risk frameworks", "Reusable diligence/risk structures owned by Category 10."],
  ["Site visit templates", "Reusable field checklists and visit structures owned by Category 10."],
  ["Report templates", "Reusable client deliverable structure owned by Category 11."],
];

export default function TemplatesPage() {
  return <><PageHeader eyebrow="Administration" title="Template Registry" description="Templates are versioned reusable configuration. Projects instantiate a historical working version instead of remaining silently coupled to future template edits." />
  <div className="grid grid-3">{templateFamilies.map(([name, description]) => <div className="card" key={name}><h2>{name}</h2><p>{description}</p></div>)}</div>
  <p className="callout section">A template change may affect future projects or an explicit project upgrade. It must not silently mutate the state on which an earlier client decision was based.</p></>;
}
