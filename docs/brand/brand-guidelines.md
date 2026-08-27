# SceneIndex brand guidelines

SceneIndex is the product name. "Semantic spatial browser" is the product descriptor, not a second name.

## Brand idea

The mark is one continuous spatial path that bends into an abstract S and returns to a waypoint. It connects the product's three concrete jobs: index a scene, navigate its spatial graph, and keep every agent action visible in the same place a person sees.

The voice is precise, calm, and direct. Copy should name the object, action, or measured result. Avoid generic AI language and inflated claims.

## Logo system

- Primary lockup: `assets/brand/logo.svg`
- Dark-background lockup: `assets/brand/logo-inverse.svg`
- Primary mark: `assets/brand/mark.svg`
- Dark-background mark: `assets/brand/mark-inverse.svg`
- App icon and favicon source: `assets/brand/app-icon.svg`

Keep clear space around the mark equal to the outside diameter of its waypoint node. Do not rotate, stretch, recolor individual path sections, add shadows, or detach the node.

Use the lockup at 160 CSS pixels wide or larger. Use the mark alone below that size. Do not render the mark below 20 CSS pixels.

## Color

| Token | Hex | Use |
| --- | --- | --- |
| Charcoal | `#111418` | Main canvas, text on light backgrounds |
| Deep teal | `#0D4D57` | Brand field, selected spatial state |
| Light gray | `#F2F4F6` | Dividers, quiet surfaces |
| Stone | `#8A8F98` | Secondary text |
| Off white | `#FAFBFC` | Main text and light canvas |

Deep teal is a field color, not body text on charcoal. Off white carries primary text and controls on dark screens so the interface stays readable.

## Type

Use Inter when it is available. The production fallback is `Helvetica Neue`, Arial, then the system sans-serif. The wordmark uses regular weight and tight tracking. Interface labels may use semibold weight and wide tracking when they are short.

## Naming

- First mention: `SceneIndex, a semantic spatial browser`
- Product name: `SceneIndex`
- Descriptor: `Semantic spatial browser`
- Technical project slug and stable public links: `semantic-spatial-webmcp`

The repository, Worker name, and production URL retain their technical slug so published evidence and judge links do not break.

## Motion

The spatial path draws in one continuous move. The waypoint resolves after the route is legible, then the wordmark completes. Motion uses the trustworthy/professional timing family: 900 ms total, no squash, no bounce, and an exact final settle.

See `docs/brand/motion_spec.md` and `docs/brand/logo_motion.html` for the production motion study and QA hooks.
