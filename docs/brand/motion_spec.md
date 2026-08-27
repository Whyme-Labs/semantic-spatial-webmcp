# SceneIndex logo motion specification

## Personality derivation

SceneIndex sits at low-to-medium energy and a serious tone. The geometric path and restrained charcoal/teal palette call for predictable motion. The selected personality is trustworthy/professional.

Three words for the motion: precise, spatial, settled.

```css
--p2m-duration: 900ms;
--p2m-ease-enter: cubic-bezier(0, 0, 0.2, 1);
--p2m-ease-settle: cubic-bezier(0.4, 0, 0.2, 1);
--p2m-squash: 0;
--p2m-overshoot: 1;
```

## Choreography

| Time | Phase | Action | Principle |
| --- | --- | --- | --- |
| 0-120 ms | Staging hold | Empty field gives the route a clear entrance | Anticipation, staging |
| 120-760 ms | Route draw | The continuous path draws from and back toward the waypoint | Timing, slow in/out, solid drawing |
| 500-880 ms | Name reveal | The wordmark wipes left to right while the route finishes | Staging, overlapping action |
| 660-900 ms | Waypoint settle | The node fades and scales from 0.78 to 1 with no overshoot | Follow-through, appeal |

The route is the product metaphor, so it receives the longest action. The wordmark waits until the path is readable. The node is the final visual stop.

## Interaction variants

- Hover: the complete mark lifts 2 px over 200 ms.
- Ambient: only the waypoint pulses from 0.76 to 1 opacity over 1800 ms.
- Press: the app icon scales uniformly to 0.97 over 120 ms and returns over 180 ms.

No idle motion runs in the production application. The variants in `logo_motion.html` are motion studies for future product use.

## Accessibility and final state

`prefers-reduced-motion: reduce` and `?static=1` render the finished lockup immediately. `?t=<milliseconds>` pauses the reveal at an exact point for QA. The last animated frame must match the static frame exactly in the same browser pipeline.
