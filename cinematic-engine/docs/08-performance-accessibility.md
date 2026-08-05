# 08 — Performance and accessibility

## Performance controls

- Canvas DPR is capped at 1.75.
- Rendering pauses when the document is hidden.
- One renderer and one RAF loop are used across routes.
- Procedural geometry is deterministic; there is no particle allocation stream.
- Frame cadence and CPU render cost are recorded separately because headless video capture may throttle RAF scheduling.
- The latest measured values live in `rendered/rendered-evidence.json`.

## Reduced motion

`prefers-reduced-motion: reduce` disables the continuous RAF loop. State changes render a meaningful still frame and Axiom uses a deterministic atlas frame. The browser test asserts zero continuous frame samples.

## Semantic and no-JS behavior

Canvas is `aria-hidden`. Controls, decisions, reasons, exact released answer, category values, and receipts remain semantic DOM. With JavaScript disabled, the page states the complete release contract, three worlds, withheld behavior, and Axiom authority boundary. The proof remains understandable without motion.

## Responsive behavior

Desktop uses a fixed cinematic stage. Mobile becomes a vertical single-world document with a centered scene, non-overlapping Axiom placement, and semantic control panels. Automated checks compare document scroll width to client width for Field, Gate, and Benchmark.
