---
name: Fresh Technical Trace
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3c4a46'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6b7a76'
  outline-variant: '#bacac5'
  surface-tint: '#006b5c'
  primary: '#006b5c'
  on-primary: '#ffffff'
  primary-container: '#00c4ab'
  on-primary-container: '#004b40'
  inverse-primary: '#3eddc3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#9b4420'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff9166'
  on-tertiary-container: '#762905'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#63fadf'
  primary-fixed-dim: '#3eddc3'
  on-primary-fixed: '#00201b'
  on-primary-fixed-variant: '#005045'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370d00'
  on-tertiary-fixed-variant: '#7c2e09'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style
This design system embodies a high-precision, technical aesthetic tailored for developer tools and high-performance SaaS platforms. It prioritizes clarity, systematic organization, and a "traceable" UI where every element feels intentional and engineered.

The design style is **Minimalist-Technical**. It utilizes a clean, high-contrast light interface that leverages heavy whitespace to reduce cognitive load. The aesthetic is punctuated by sharp, vibrant accents that draw the eye to critical data points and primary actions, creating an environment that feels both cutting-edge and profoundly reliable.

## Colors
The palette is rooted in a pristine white background to maximize legibility. The primary accent is a refined Mint Cyan, adjusted from its neon origins to a slightly deeper tone (#00C4AB) to ensure WCAG AA accessibility standards are met when used for text or critical iconography against light surfaces.

- **Primary:** High-energy Mint Cyan used for key actions and status indicators.
- **Surface Containers:** Subtle off-white and cool grays used to delineate sections without adding visual weight.
- **Typography:** A deep slate for headlines to provide maximum punch, with a softer slate for body copy to facilitate long-form reading.

## Typography
The system uses **Geist** as its primary typeface to communicate a modern, developer-centric precision. Headlines use tighter letter spacing and heavier weights to anchor the page. 

**JetBrains Mono** is introduced as a secondary label font for metadata, technical specifications, and code snippets, reinforcing the "technical trace" narrative. Ensure that all technical labels are set in uppercase when used for categorization to distinguish them from standard body text.

## Layout & Spacing
The layout follows a strict 4px baseline grid. On desktop, use a 12-column fluid grid with 24px gutters and a maximum container width of 1280px. 

On mobile devices, the margin shifts to 16px and the layout collapses to a single column. Spacing between functional groups should be generous (typically 48px+) to maintain the minimalist aesthetic, while internal component spacing should remain tight (8px to 16px) to feel "engineered" and compact.

## Elevation & Depth
In this light-mode execution, depth is communicated through **Tonal Layering** and **Crisp Outlines** rather than heavy shadows. 

- **Level 0 (Background):** Pure white (#FFFFFF).
- **Level 1 (Surface):** Subtle gray (#F8FAFC) with a 1px border (#E2E8F0).
- **Level 2 (Popovers/Modals):** Pure white with a very soft, diffused ambient shadow (0px 8px 24px rgba(15, 23, 42, 0.08)) and a defined border.

Avoid using shadows for standard cards; use 1px borders to define boundaries, maintaining the "trace" aesthetic where elements appear to be etched into the interface.

## Shapes
Following the **ROUND_EIGHT** principle, the standard corner radius for primary UI elements is 8px (0.5rem). 

- **Small Components (Checkboxes, Tags):** 4px (0.25rem).
- **Standard Components (Buttons, Inputs, Cards):** 8px (0.5rem).
- **Large Containers (Modals, Large Sections):** 16px (1rem).

This consistency ensures that the interface feels approachable yet structured and professional.

## Components
- **Buttons:** Primary buttons use a solid Mint Cyan (#00C4AB) fill with white text. Secondary buttons use a white fill with a 1px slate border. Use the JetBrains Mono font for button labels to emphasize the technical nature.
- **Input Fields:** Use a white background with a #E2E8F0 border. Upon focus, the border color transitions to Mint Cyan with a subtle 2px outer glow in the same color at 10% opacity.
- **Chips/Tags:** Use a soft slate background (#F1F5F9) with deep slate text (#475569). For "active" traces, use a light mint tint background with primary mint text.
- **Cards:** Cards are defined by their #E2E8F0 borders. Header sections within cards should be separated by a subtle horizontal rule of the same color.
- **Data Tables:** Use horizontal lines only (#F1F5F9) for a clean, scannable look. Row headers should use the `label-sm` typography style for a "data-first" feel.