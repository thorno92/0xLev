# 0xLeverage — Purple Aesthetic System & Theme Architecture

## Core Philosophy
Purple is not just a colour — it is THE identity. Every interactive element, every glow, every accent breathes purple. The terminal should feel like you're trading inside a neon-lit command centre. Deep, immersive, addictive.

---

## Three Themes

### 1. CYBERPUNK (Default Dark)
**Vibe:** Blade Runner meets Bloomberg. Deep void black with electric purple neon.
- **Background:** #09080F (near-black with purple undertone, NOT blue-black)
- **Surface 1 (cards/panels):** #110F1B (dark purple-tinted)
- **Surface 2 (elevated):** #1A1726 (slightly lighter purple-dark)
- **Surface 3 (hover/active):** #231F33
- **Border:** rgba(139, 92, 246, 0.12) — purple-tinted borders
- **Border hover:** rgba(139, 92, 246, 0.25)
- **Primary:** #8B5CF6 (vivid purple — hsl(258, 90%, 66%))
- **Primary bright:** #A78BFA (lighter purple for hover states)
- **Primary glow:** rgba(139, 92, 246, 0.4) — for box-shadow neon effects
- **Primary deep:** #6D28D9 (darker purple for pressed states)
- **Text primary:** #F0ECF9 (warm white with purple tint)
- **Text secondary:** #9B8FC2 (muted purple-gray)
- **Text tertiary:** #6B5F8A (dim purple-gray)
- **Green (profit/buy):** #22C55E
- **Red (loss/sell):** #EF4444
- **Neon effects:**
  - Subtle purple glow on interactive elements: `box-shadow: 0 0 12px rgba(139, 92, 246, 0.15)`
  - Active/focused elements: `box-shadow: 0 0 20px rgba(139, 92, 246, 0.3)`
  - "Neon stream" lines: 1px borders with purple glow on panels
  - Connect Wallet button: solid purple with outer glow
  - Active tab underline: purple with glow spread

### 2. MIDNIGHT CITY (Dark Alt)
**Vibe:** Rainy Tokyo at 2am. Deeper, moodier, more contrast. Purple as accent, not flood.
- **Background:** #07060C (absolute deep void)
- **Surface 1:** #0E0C16
- **Surface 2:** #15121F
- **Surface 3:** #1D1929
- **Border:** rgba(167, 139, 250, 0.08) — subtler purple tint
- **Border hover:** rgba(167, 139, 250, 0.18)
- **Primary:** #A78BFA (softer, more ethereal purple)
- **Primary bright:** #C4B5FD
- **Primary glow:** rgba(167, 139, 250, 0.3)
- **Primary deep:** #7C3AED
- **Text primary:** #E8E4F0
- **Text secondary:** #8B82A8
- **Text tertiary:** #5E5678
- **Green:** #34D399 (more teal-green, cooler)
- **Red:** #F87171 (softer red)
- **Neon effects:** More restrained — glow only on primary CTA and active states

### 3. LAVENDER HAZE (Light Mode)
**Vibe:** Clean, premium, Apple-meets-purple. Soft lavender backgrounds, deep purple accents.
- **Background:** #FAFAFF (barely-there lavender white)
- **Surface 1:** #F3F0FA (soft lavender card)
- **Surface 2:** #EDE8F5 (slightly deeper lavender)
- **Surface 3:** #E4DDF0 (hover state)
- **Border:** rgba(109, 40, 217, 0.12)
- **Border hover:** rgba(109, 40, 217, 0.22)
- **Primary:** #7C3AED (deep vivid purple — pops on light)
- **Primary bright:** #8B5CF6
- **Primary glow:** rgba(124, 58, 237, 0.15)
- **Primary deep:** #6D28D9
- **Text primary:** #1A1128 (deep purple-black)
- **Text secondary:** #5B4F73 (muted purple)
- **Text tertiary:** #8E82A6
- **Green:** #16A34A (rich green)
- **Red:** #DC2626 (strong red)
- **Neon effects:** None — clean shadows instead: `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`

---

## Neon Stream Effects (Cyberpunk & Midnight City only)

### Panel borders
```css
border: 1px solid rgba(139, 92, 246, 0.12);
box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.05);
```

### Active panel / focused input
```css
border-color: rgba(139, 92, 246, 0.4);
box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2), 0 0 20px rgba(139, 92, 246, 0.1);
```

### Connect Wallet button (primary CTA)
```css
background: #8B5CF6;
box-shadow: 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.15);
```

### Tab active underline
```css
border-bottom: 2px solid #8B5CF6;
box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
```

### Subtle animated glow on key metrics (optional)
```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(139, 92, 246, 0.1); }
  50% { box-shadow: 0 0 16px rgba(139, 92, 246, 0.25); }
}
```

---

## Theme Selector UI
- Position: Header, near the settings/gear area
- Style: Small dropdown or 3-icon toggle
- Icons: Cyberpunk (lightning bolt), Midnight City (moon), Lavender Haze (sun)
- Transition: 200ms smooth colour transition on all themed properties
- Persist: localStorage

---

## Implementation Strategy
1. CSS custom properties for ALL colours — theme switch = swap CSS vars
2. Add `data-theme="cyberpunk|midnight|lavender"` on <html>
3. Three CSS blocks: `[data-theme="cyberpunk"]`, `[data-theme="midnight"]`, `[data-theme="lavender"]`
4. ThemeContext provides current theme + toggle
5. All components use CSS vars — zero hardcoded colours
