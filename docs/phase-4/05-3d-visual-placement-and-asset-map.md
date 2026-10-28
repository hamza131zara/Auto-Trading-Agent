# Phase 4.5 — 3D Visual Placement and Brand Asset Map

**Status:** D-030 is owner-locked; placement recommendations are a Phase 4 design proposal.

## 1. Approved assets

| Asset | Intended use | Constraints |
|---|---|---|
| [Dark wordmark](../../assets/brand/auto-trading-agent-logo-dark.svg) | Light backgrounds | Use dark-surface lockup with adequate clear space |
| [Light wordmark](../../assets/brand/auto-trading-agent-logo-light.svg) | Dark backgrounds | Check tagline legibility at narrow size |
| [Compact mark](../../assets/brand/auto-trading-agent-mark.svg) | App icon, sidebar, favicon exploration | Test legibility at 16–32 px; do not shrink full wordmark into this role |
| [3D market-intelligence hero](../../assets/brand/auto-trading-agent-3d-hero.svg) | Public landing hero, product explainer, architecture section | Decorative illustration only; contains no live metrics |

## 2. Section-by-section map

| Section | Visual treatment | Data/interaction boundary |
|---|---|---|
| Public home hero | Large 3D market-intelligence asset or carefully cropped variant | No unverified “live” chart, profit claims or active status badges |
| How-it-works | Isometric sequence: discovery → analysis → risk veto → bounded execution → reconciliation | Each stage must explain fail-closed/no-trade outcomes too |
| Architecture/security | Layered local runtime, portal plane and independent signer boundary | Diagram labels must keep portal out of the wallet/signing trust boundary |
| Self-hosted deployment | Dimensional isolated server/workstation and secure boundary motif | Avoid implying that our vendor can access the customer's wallet or host |
| Market/strategy education | Small 3D support icon beside flat, sourced chart/table | Actual chart is flat and accurately scaled; illustrative 3D illustration is labelled |
| Onboarding guide | Numbered steps with small icon/illustration | Must not replace written setup steps or customer-owned secret guidance |
| Empty state | Optional small 3D icon (no positions, no saved reports) | Clear reason and next safe action remain textual |
| Error/unknown/blocked | No celebratory 3D decoration; restrained status icon only | Failure, unknown execution state and safety reason take precedence |
| Runtime cockpit | Shallow elevation on selected panels; tiny illustrative accents only | Prices, fills, fees, risk caps and transaction states remain flat/data-first |
| License/portal | Minimal brand mark and maybe subtle dimensional progress indicator | Payment/licensing truth is conveyed by text and backend status, not animation |

## 3. Composition and restraint

- 3D is selective emphasis, not the universal component style. Use a clear purpose for each instance.
- Favor the existing vector illustration for static product surfaces; build new static vector artwork only when a new task needs a distinct concept.
- Use a consistent camera/perspective, key-light direction, material palette and subtle shadow language across assets.
- Use brand gradients mostly for logo/decorative accents, not as the background of long text or key risk states.
- Maintain a strong separation between decoration and control surfaces: no 3D object should appear to be a button, slider or control unless it is an actual accessible interactive component.
- Never draw fake financial numbers into the illustration. If a marketing screenshot uses data-like shapes, mark it DEMO / ILLUSTRATIVE.

## 4. Delivery and performance

- SVG is preferred for simple isometric shapes; compressed raster is acceptable for complex rendered art if reviewed for contrast and file size.
- Decorative asset failures must leave a complete page and meaningful alt text or be marked decorative when appropriate.
- Avoid autoplaying video, heavy canvas or WebGL by default.
- Check aspect ratio, cropping, contrast in both themes, and mobile safe area before acceptance.
- Phase 5 may implement the design only after this placement map and related screen specs are reviewed; it should not invent additional 3D scenes indiscriminately.
