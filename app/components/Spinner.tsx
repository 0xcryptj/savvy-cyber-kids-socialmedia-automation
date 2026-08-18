export function Spinner({ label = "Working" }: { label?: string }) { return <span className="working"><span className="spinner" aria-hidden="true" />{label}</span>; }
