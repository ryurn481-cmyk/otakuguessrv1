import type { AttributeFeedback } from "@/types/game";
import { AttributeCell } from "./attribute-cell";
export function GuessRow({ title, attributes }: { title: string; attributes: AttributeFeedback[] }) { return <div className="grid grid-cols-[minmax(110px,1.25fr)_repeat(8,minmax(66px,1fr))] overflow-hidden rounded-xl border border-white/10"><div className="flex items-center bg-white/[.04] px-3 text-sm font-bold text-white">{title}</div>{attributes.map((attribute) => <AttributeCell key={attribute.key} feedback={attribute} />)}</div>; }
